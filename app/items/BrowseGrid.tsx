'use client'

import { useState } from 'react'
import Link from 'next/link'

const CATEGORIES = ['ring', 'necklace', 'bracelet', 'earrings', 'brooch', 'watch', 'other'] as const

type Item = {
  id: string
  name: string
  category: string
  given_by: string | null
  primaryPhotoUrl: string | null
}

export default function BrowseGrid({ items }: { items: Item[] }) {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [query, setQuery] = useState('')

  const filtered = items.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    const q = query.trim().toLowerCase()
    const matchesSearch = !q ||
      item.name.toLowerCase().includes(q) ||
      (item.given_by?.toLowerCase().includes(q) ?? false)
    return matchesCategory && matchesSearch
  })

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search by name or giver…"
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 mb-4"
      />

      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
            selectedCategory === 'all'
              ? 'bg-stone-800 text-white border-stone-800'
              : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
          }`}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium border capitalize transition-colors ${
              selectedCategory === cat
                ? 'bg-stone-800 text-white border-stone-800'
                : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-stone-400">
          {items.length === 0 ? (
            <>
              <p className="text-lg mb-2">No pieces yet.</p>
              <p className="text-sm">Add your first piece to get started.</p>
            </>
          ) : (
            <p className="text-sm">No pieces match your search.</p>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(item => (
            <Link key={item.id} href={`/items/${item.id}`} className="block">
              <div className="relative rounded-xl overflow-hidden aspect-square bg-stone-100">
                {item.primaryPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.primaryPhotoUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-3xl text-stone-300 font-light select-none">
                      {item.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-3">
                  <p className="text-sm font-medium text-white leading-tight">{item.name}</p>
                  {item.given_by && (
                    <p className="text-xs text-white/70 mt-0.5">From {item.given_by}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
