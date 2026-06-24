import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedMembership } from '@/lib/supabase/getAuthenticatedMembership'

type Params = { params: Promise<{ id: string; photoId: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: itemId, photoId } = await params

  const auth = await getAuthenticatedMembership()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createClient()

  // Confirm photo belongs to an item in this household
  const { data: photo } = await supabase
    .from('item_photos')
    .select('id, photo_url, is_primary, item_id')
    .eq('id', photoId)
    .eq('item_id', itemId)
    .maybeSingle()

  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  }

  // Confirm the parent item belongs to this household
  const { data: item } = await supabase
    .from('items')
    .select('id')
    .eq('id', itemId)
    .eq('household_id', auth.membership.householdId)
    .maybeSingle()

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  // Delete from DB first — if storage removal fails, the row is gone and the
  // orphaned file is harmless (not accessible via RLS-scoped URL generation)
  const { error: deleteError } = await supabase
    .from('item_photos')
    .delete()
    .eq('id', photoId)

  if (deleteError) {
    console.error('[DELETE /api/items/[id]/photos/[photoId]] db delete failed:', deleteError.message)
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 })
  }

  // Extract storage path from the public URL
  const url = new URL(photo.photo_url)
  const storagePath = url.pathname.split('/object/public/item-photos/')[1]
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from('item-photos')
      .remove([storagePath])
    if (storageError) {
      console.error('[DELETE /api/items/[id]/photos/[photoId]] storage removal failed:', storageError.message)
    }
  }

  // If the deleted photo was primary, promote the next photo
  if (photo.is_primary) {
    const { data: next } = await supabase
      .from('item_photos')
      .select('id')
      .eq('item_id', itemId)
      .order('order_index', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (next) {
      await supabase
        .from('item_photos')
        .update({ is_primary: true })
        .eq('id', next.id)
    }
  }

  return new NextResponse(null, { status: 204 })
}
