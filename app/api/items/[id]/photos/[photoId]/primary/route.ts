import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedMembership } from '@/lib/supabase/getAuthenticatedMembership'

type Params = { params: Promise<{ id: string; photoId: string }> }

export async function PATCH(_req: NextRequest, { params }: Params) {
  const { id: itemId, photoId } = await params

  const auth = await getAuthenticatedMembership()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createClient()

  // Confirm item belongs to this household
  const { data: item } = await supabase
    .from('items')
    .select('id')
    .eq('id', itemId)
    .eq('household_id', auth.membership.householdId)
    .maybeSingle()

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  // Confirm the target photo belongs to this item
  const { data: photo } = await supabase
    .from('item_photos')
    .select('id')
    .eq('id', photoId)
    .eq('item_id', itemId)
    .maybeSingle()

  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  }

  // Unset all primaries on this item, then set the target
  const { error: unsetError } = await supabase
    .from('item_photos')
    .update({ is_primary: false })
    .eq('item_id', itemId)

  if (unsetError) {
    console.error('[PATCH /primary] unset failed:', unsetError.message)
    return NextResponse.json({ error: 'Failed to update primary photo' }, { status: 500 })
  }

  const { data: updated, error: setError } = await supabase
    .from('item_photos')
    .update({ is_primary: true })
    .eq('id', photoId)
    .select()
    .single()

  if (setError || !updated) {
    console.error('[PATCH /primary] set failed:', setError?.message)
    return NextResponse.json({ error: 'Failed to update primary photo' }, { status: 500 })
  }

  return NextResponse.json({ photo: updated })
}
