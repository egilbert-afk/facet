import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedMembership } from '@/lib/supabase/getAuthenticatedMembership'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ attemptId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await getAuthenticatedMembership()
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { attemptId } = await params
  const supabase = await createClient()

  const { data: attempt } = await supabase
    .from('lookup_attempts')
    .select('id, candidate_item_ids')
    .eq('id', attemptId)
    .maybeSingle()

  // Gracefully handle race condition — attempt may not be inserted yet
  if (!attempt) return NextResponse.json({})

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const b = body as Record<string, unknown>
  if (typeof b.selected_item_id !== 'string' || !b.selected_item_id) {
    return NextResponse.json({ error: 'selected_item_id is required' }, { status: 400 })
  }

  const topId = attempt.candidate_item_ids?.[0] ?? null
  const wasCorrect = topId !== null ? topId === b.selected_item_id : null

  await supabase
    .from('lookup_attempts')
    .update({ selected_item_id: b.selected_item_id, was_correct_top_match: wasCorrect })
    .eq('id', attemptId)

  return NextResponse.json({})
}
