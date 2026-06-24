import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PhotoSection from './PhotoSection'

type Params = { params: Promise<{ id: string }> }

export default async function ItemPage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: item } = await supabase
    .from('items')
    .select('*')
    .eq('id', id)
    .eq('is_archived', false)
    .maybeSingle()

  if (!item) notFound()

  const { data: attributes } = await supabase
    .from('item_attributes')
    .select('*')
    .eq('item_id', id)
    .order('order_index', { ascending: true })

  const { data: photos } = await supabase
    .from('item_photos')
    .select('*')
    .eq('item_id', id)
    .order('order_index', { ascending: true })

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 max-w-lg mx-auto">
      <a href="/items" className="text-sm text-stone-500 hover:text-stone-700 mb-6 inline-block">
        ← Your collection
      </a>

      <div className="mb-6">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-semibold text-stone-800">{item.name}</h1>
          <span className="text-xs text-stone-400 rounded-full border border-stone-200 px-2 py-1 whitespace-nowrap mt-1">
            {item.category}
          </span>
        </div>
        {item.given_by && (
          <p className="text-stone-500 mt-1">From {item.given_by}</p>
        )}
        {item.acquired_era && (
          <p className="text-sm text-stone-400 mt-0.5">{item.acquired_era}</p>
        )}
      </div>

      {/* Photos */}
      <PhotoSection itemId={id} initialPhotos={photos ?? []} />

      {/* Story */}
      {(item.headline || item.story) && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">Story</h2>
          {item.headline && (
            <p className="text-stone-700 font-medium mb-2 italic">{item.headline}</p>
          )}
          {item.story && (
            <p className="text-stone-600 leading-relaxed whitespace-pre-wrap">{item.story}</p>
          )}
        </section>
      )}

      {/* Attributes */}
      {attributes && attributes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">Details</h2>
          <dl className="space-y-2">
            {attributes.map(attr => (
              <div key={attr.id} className="flex gap-3">
                <dt className="text-sm text-stone-400 w-32 shrink-0 capitalize">
                  {attr.attribute_name.replace(/_/g, ' ')}
                </dt>
                <dd className="text-sm text-stone-700">{attr.attribute_value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </main>
  )
}
