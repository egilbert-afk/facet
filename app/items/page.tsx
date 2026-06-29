import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import BrowseGrid from './BrowseGrid'


export default async function ItemsPage() {
  const supabase = await createClient()

  const [{ data: items, error }, { data: primaryPhotos }] = await Promise.all([
    supabase
      .from('items')
      .select('id, name, category, given_by, created_at')
      .eq('is_archived', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('item_photos')
      .select('item_id, photo_url')
      .eq('is_primary', true),
  ])

  const photoMap = new Map(primaryPhotos?.map(p => [p.item_id, p.photo_url]) ?? [])
  const itemsWithPhotos = (items ?? []).map(item => ({
    ...item,
    primaryPhotoUrl: photoMap.get(item.id) ?? null,
  }))

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-stone-800">Your collection</h1>
        <div className="flex gap-2">
          <Link
            href="/match"
            className="rounded-lg border border-stone-300 text-stone-600 px-3 py-2 text-sm font-medium hover:bg-stone-100"
          >
            Identify
          </Link>
          <Link
            href="/items/new"
            className="rounded-lg bg-stone-800 text-white px-4 py-2 text-sm font-medium hover:bg-stone-700"
          >
            + Add piece
          </Link>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-4">Failed to load your collection.</p>
      )}
      <BrowseGrid items={itemsWithPhotos} />
    </main>
  )
}
