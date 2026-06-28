import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthenticatedMembership } from '@/lib/supabase/getAuthenticatedMembership'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
type AllowedType = typeof ALLOWED_TYPES[number]
function isAllowedType(t: string): t is AllowedType {
  return (ALLOWED_TYPES as readonly string[]).includes(t)
}

type CatalogItem = {
  id: string
  name: string
  category: string
  given_by: string | null
  headline: string | null
}
type AttrRow = { item_id: string; attribute_name: string; attribute_value: string }

function buildCatalog(items: CatalogItem[], attrMap: Map<string, AttrRow[]>): string {
  return items.map(item => {
    const attrs = attrMap.get(item.id) ?? []
    const parts = [
      `ID: ${item.id}`,
      `Name: ${item.name}`,
      `Category: ${item.category}`,
      item.given_by ? `Given by: ${item.given_by}` : '',
      item.headline ? `Description: ${item.headline}` : '',
      attrs.length > 0
        ? `Attributes: ${attrs.map(a => `${a.attribute_name}=${a.attribute_value}`).join(', ')}`
        : '',
    ]
    return parts.filter(Boolean).join('\n')
  }).join('\n---\n')
}

function buildPrompt(catalog: string): string {
  return `You are helping identify a piece of jewelry from a personal collection.

The user has photographed a piece they are holding. Based on the photo, return ONLY a JSON array of item IDs from the catalog that could plausibly be this piece, ranked from most to least likely. Include at most 5 candidates. If nothing matches, return [].

Return only the raw JSON array — no explanation, no markdown, no code blocks. Example: ["id1","id2"]

Catalog:
${catalog}`
}

function parseCandidateIds(text: string, validIds: Set<string>): string[] {
  try {
    const cleaned = text.replace(/```(?:json)?\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((id): id is string => typeof id === 'string' && validIds.has(id))
      .slice(0, 5)
  } catch {
    return []
  }
}

async function logAttempt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  attemptId: string,
  householdId: string,
  userId: string,
  candidateIds: string[],
) {
  const { error } = await supabase.from('lookup_attempts').insert({
    id: attemptId,
    household_id: householdId,
    attempted_by: userId,
    candidate_item_ids: candidateIds,
  })
  if (error) throw error
}

export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedMembership()
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { userId, householdId } = auth.membership

  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('photo')
  if (!(file instanceof File)) return NextResponse.json({ error: 'photo is required' }, { status: 400 })
  if (!isAllowedType(file.type)) return NextResponse.json({ error: 'Photo must be JPEG, PNG, or WebP' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Photo must be under 10MB' }, { status: 400 })

  const supabase = await createClient()

  const [{ data: items }, { data: attributes }] = await Promise.all([
    supabase
      .from('items')
      .select('id, name, category, given_by, headline')
      .eq('is_archived', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('item_attributes')
      .select('item_id, attribute_name, attribute_value'),
  ])

  const itemList: CatalogItem[] = items ?? []

  if (itemList.length === 0) {
    return NextResponse.json({ candidates: [], attemptId: null })
  }

  const validIds = new Set(itemList.map(i => i.id))
  const attrMap = new Map<string, AttrRow[]>()
  for (const attr of (attributes ?? []) as AttrRow[]) {
    const list = attrMap.get(attr.item_id) ?? []
    list.push(attr)
    attrMap.set(attr.item_id, list)
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  const anthropic = new Anthropic()
  let candidateIds: string[] = []

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } },
          { type: 'text', text: buildPrompt(buildCatalog(itemList, attrMap)) },
        ],
      }],
    })
    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    candidateIds = parseCandidateIds(text, validIds)
  } catch (err) {
    console.error('[POST /api/match] Claude API error:', err)
    return NextResponse.json({ candidates: [], attemptId: null })
  }

  const { data: photos } = candidateIds.length > 0
    ? await supabase
        .from('item_photos')
        .select('item_id, photo_url')
        .eq('is_primary', true)
        .in('item_id', candidateIds)
    : { data: [] }

  const photoMap = new Map((photos ?? []).map(p => [p.item_id, p.photo_url]))

  const candidates = candidateIds.map(id => {
    const item = itemList.find(i => i.id === id)!
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      given_by: item.given_by,
      headline: item.headline,
      primaryPhotoUrl: photoMap.get(id) ?? null,
    }
  })

  const attemptId = crypto.randomUUID()
  logAttempt(supabase, attemptId, householdId, userId, candidateIds)
    .catch(err => console.error('[POST /api/match] logging failed:', err))

  return NextResponse.json({ candidates, attemptId })
}
