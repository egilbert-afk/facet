import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function ItemsPage() {
  const supabase = await createClient()
  const { data: items, error } = await supabase
    .from('items')
    .select('id, name, category, given_by, headline, created_at')
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-stone-800">Your collection</h1>
        <Link
          href="/items/new"
          className="rounded-lg bg-stone-800 text-white px-4 py-2 text-sm font-medium hover:bg-stone-700"
        >
          + Add piece
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-4">Failed to load items.</p>
      )}

      {!error && (!items || items.length === 0) && (
        <div className="text-center py-16 text-stone-400">
          <p className="text-lg mb-2">No pieces yet.</p>
          <p className="text-sm">Add your first piece to get started.</p>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="space-y-3">
          {items.map(item => (
            <li key={item.id}>
              <Link href={`/items/${item.id}`} className="block bg-white rounded-xl border border-stone-200 px-4 py-4 hover:border-stone-300">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-stone-800">{item.name}</p>
                  {item.given_by && (
                    <p className="text-sm text-stone-500 mt-0.5">From {item.given_by}</p>
                  )}
                  {item.headline && (
                    <p className="text-sm text-stone-600 mt-1 italic">{item.headline}</p>
                  )}
                </div>
                <span className="text-xs text-stone-400 rounded-full border border-stone-200 px-2 py-0.5 whitespace-nowrap">
                  {item.category}
                </span>
              </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
