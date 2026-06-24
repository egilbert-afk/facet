import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedMembership } from '@/lib/supabase/getAuthenticatedMembership'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string; attrId: string }> }

async function resolveAttribute(itemId: string, attrId: string, householdId: string) {
  const supabase = await createClient()

  const { data: item } = await supabase
    .from('items')
    .select('id')
    .eq('id', itemId)
    .eq('household_id', householdId)
    .maybeSingle()
  if (!item) return { supabase, error: NextResponse.json({ error: 'Item not found' }, { status: 404 }) }

  const { data: attr } = await supabase
    .from('item_attributes')
    .select('id')
    .eq('id', attrId)
    .eq('item_id', itemId)
    .maybeSingle()
  if (!attr) return { supabase, error: NextResponse.json({ error: 'Attribute not found' }, { status: 404 }) }

  return { supabase, error: null }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await getAuthenticatedMembership()
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { id: itemId, attrId } = await params
  const { supabase, error } = await resolveAttribute(itemId, attrId, auth.membership.householdId)
  if (error) return error

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const b = body as Record<string, unknown>

  const updates: { attribute_name?: string; attribute_value?: string } = {}
  if (b.attribute_name !== undefined) {
    if (typeof b.attribute_name !== 'string' || !b.attribute_name.trim()) {
      return NextResponse.json({ error: 'attribute_name must be a non-empty string' }, { status: 400 })
    }
    updates.attribute_name = b.attribute_name.trim()
  }
  if (b.attribute_value !== undefined) {
    if (typeof b.attribute_value !== 'string' || !b.attribute_value.trim()) {
      return NextResponse.json({ error: 'attribute_value must be a non-empty string' }, { status: 400 })
    }
    updates.attribute_value = b.attribute_value.trim()
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: attribute, error: updateError } = await supabase
    .from('item_attributes')
    .update(updates)
    .eq('id', attrId)
    .select()
    .single()

  if (updateError) {
    console.error('[PATCH /api/items/[id]/attributes/[attrId]]', updateError)
    return NextResponse.json({ error: 'Failed to update attribute' }, { status: 500 })
  }

  return NextResponse.json({ attribute })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await getAuthenticatedMembership()
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { id: itemId, attrId } = await params
  const { supabase, error } = await resolveAttribute(itemId, attrId, auth.membership.householdId)
  if (error) return error

  const { error: deleteError } = await supabase
    .from('item_attributes')
    .delete()
    .eq('id', attrId)

  if (deleteError) {
    console.error('[DELETE /api/items/[id]/attributes/[attrId]]', deleteError)
    return NextResponse.json({ error: 'Failed to delete attribute' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
