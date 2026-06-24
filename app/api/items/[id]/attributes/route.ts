import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedMembership } from '@/lib/supabase/getAuthenticatedMembership'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getAuthenticatedMembership()
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { id: itemId } = await params
  const { householdId } = auth.membership
  const supabase = await createClient()

  const { data: item } = await supabase
    .from('items')
    .select('id')
    .eq('id', itemId)
    .eq('household_id', householdId)
    .maybeSingle()
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const b = body as Record<string, unknown>
  if (
    typeof b.attribute_name !== 'string' || !b.attribute_name.trim() ||
    typeof b.attribute_value !== 'string' || !b.attribute_value.trim()
  ) {
    return NextResponse.json({ error: 'attribute_name and attribute_value are required' }, { status: 400 })
  }

  const { data: last } = await supabase
    .from('item_attributes')
    .select('order_index')
    .eq('item_id', itemId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextIndex = last ? last.order_index + 1 : 0

  const { data: attribute, error } = await supabase
    .from('item_attributes')
    .insert({
      item_id: itemId,
      attribute_name: b.attribute_name.trim(),
      attribute_value: b.attribute_value.trim(),
      order_index: nextIndex,
    })
    .select()
    .single()

  if (error) {
    console.error('[POST /api/items/[id]/attributes]', error)
    return NextResponse.json({ error: 'Failed to save attribute' }, { status: 500 })
  }

  return NextResponse.json({ attribute }, { status: 201 })
}
