import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedMembership } from '@/lib/supabase/getAuthenticatedMembership'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
const MAX_BYTES = 10 * 1024 * 1024 // 10MB

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: itemId } = await params

  const auth = await getAuthenticatedMembership()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createClient()

  // Confirm the item belongs to this household before returning its photos
  const { data: item } = await supabase
    .from('items')
    .select('id')
    .eq('id', itemId)
    .eq('household_id', auth.membership.householdId)
    .maybeSingle()

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const { data: photos, error } = await supabase
    .from('item_photos')
    .select('*')
    .eq('item_id', itemId)
    .order('order_index', { ascending: true })

  if (error) {
    console.error('[GET /api/items/[id]/photos] query failed:', error.message)
    return NextResponse.json({ error: 'Failed to load photos' }, { status: 500 })
  }

  return NextResponse.json({ photos })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: itemId } = await params

  const auth = await getAuthenticatedMembership()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createClient()

  // Confirm the item belongs to this household
  const { data: item } = await supabase
    .from('items')
    .select('id')
    .eq('id', itemId)
    .eq('household_id', auth.membership.householdId)
    .maybeSingle()

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('photo') as File | null

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'photo file is required' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Photo must be jpeg, png, webp, or heic' },
      { status: 400 }
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Photo must be under 10MB' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const filename = `${crypto.randomUUID()}.${ext}`
  const storagePath = `${auth.membership.householdId}/${itemId}/${filename}`

  const { error: uploadError } = await supabase.storage
    .from('item-photos')
    .upload(storagePath, file, { contentType: file.type })

  if (uploadError) {
    console.error('[POST /api/items/[id]/photos] upload failed:', uploadError.message)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('item-photos')
    .getPublicUrl(storagePath)

  // Check if this is the first photo — if so, make it primary automatically
  const { count } = await supabase
    .from('item_photos')
    .select('*', { count: 'exact', head: true })
    .eq('item_id', itemId)

  const isFirst = count === null || count === 0

  const { data: photo, error: insertError } = await supabase
    .from('item_photos')
    .insert({
      item_id: itemId,
      photo_url: publicUrl,
      is_primary: isFirst,
      order_index: count ?? 0,
    })
    .select()
    .single()

  if (insertError || !photo) {
    console.error('[POST /api/items/[id]/photos] db insert failed:', insertError?.message)
    // Storage upload succeeded but DB failed — clean up the orphaned file
    await supabase.storage.from('item-photos').remove([storagePath])
    return NextResponse.json({ error: 'Failed to save photo' }, { status: 500 })
  }

  return NextResponse.json({ photo }, { status: 201 })
}
