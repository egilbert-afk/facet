'use client'

import { useState } from 'react'

type Attribute = {
  id: string
  attribute_name: string
  attribute_value: string
  order_index: number
}

const SUGGESTED_ATTRIBUTES = ['metal', 'gemstone', 'carat_weight', 'setting_style', 'hallmark', 'ring_size', 'chain_length']

export default function AttributeSection({ itemId, initialAttributes }: {
  itemId: string
  initialAttributes: Attribute[]
}) {
  const [attributes, setAttributes] = useState<Attribute[]>(initialAttributes)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editValue, setEditValue] = useState('')
  const [addName, setAddName] = useState<string | null>(null)
  const [addValue, setAddValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function startEdit(attr: Attribute) {
    setEditingId(attr.id)
    setEditName(attr.attribute_name)
    setEditValue(attr.attribute_value)
    setAddName(null)
    setError('')
  }

  async function saveEdit() {
    if (!editingId || !editName.trim() || !editValue.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch(`/api/items/${itemId}/attributes/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attribute_name: editName, attribute_value: editValue }),
    })
    if (res.ok) {
      const { attribute } = await res.json()
      setAttributes(prev => prev.map(a => a.id === editingId ? attribute : a))
      setEditingId(null)
    } else {
      setError('Failed to save. Please try again.')
    }
    setSaving(false)
  }

  async function handleDelete(attrId: string) {
    const res = await fetch(`/api/items/${itemId}/attributes/${attrId}`, { method: 'DELETE' })
    if (res.ok) {
      setAttributes(prev => prev.filter(a => a.id !== attrId))
      if (editingId === attrId) setEditingId(null)
    }
  }

  function startAdd(name: string) {
    setAddName(name)
    setAddValue('')
    setEditingId(null)
    setError('')
  }

  async function saveAdd() {
    if (addName === null || !addName.trim() || !addValue.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch(`/api/items/${itemId}/attributes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attribute_name: addName.trim(), attribute_value: addValue.trim() }),
    })
    if (res.ok) {
      const { attribute } = await res.json()
      setAttributes(prev => [...prev, attribute])
      setAddName(null)
    } else {
      setError('Failed to save. Please try again.')
    }
    setSaving(false)
  }

  const existingNames = new Set(attributes.map(a => a.attribute_name))
  const availableSuggestions = SUGGESTED_ATTRIBUTES.filter(s => !existingNames.has(s))

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">Details</h2>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {attributes.length > 0 && (
        <dl className="space-y-2 mb-4">
          {attributes.map(attr => (
            <div key={attr.id}>
              {editingId === attr.id ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Detail"
                    className="w-28 shrink-0 rounded-lg border border-stone-300 px-2 py-1 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                  <input
                    type="text"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    placeholder="Value"
                    autoFocus
                    className="flex-1 rounded-lg border border-stone-300 px-2 py-1 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                  <button
                    onClick={saveEdit}
                    disabled={saving || !editName.trim() || !editValue.trim()}
                    className="text-sm text-stone-700 font-medium hover:text-stone-900 disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-stone-400 hover:text-stone-600 text-lg leading-none"
                    aria-label="Cancel"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="flex gap-3 items-center">
                  <dt className="text-sm text-stone-400 w-28 shrink-0 capitalize">
                    {attr.attribute_name.replace(/_/g, ' ')}
                  </dt>
                  <dd className="text-sm text-stone-700 flex-1">{attr.attribute_value}</dd>
                  <button
                    onClick={() => startEdit(attr)}
                    className="text-xs text-stone-400 hover:text-stone-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(attr.id)}
                    className="text-stone-300 hover:text-red-500 text-lg leading-none"
                    aria-label="Delete"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          ))}
        </dl>
      )}

      {addName !== null && (
        <div className="flex gap-2 items-center mb-4">
          <input
            type="text"
            value={addName}
            onChange={e => setAddName(e.target.value)}
            placeholder="Detail"
            className="w-28 shrink-0 rounded-lg border border-stone-300 px-2 py-1 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <input
            type="text"
            value={addValue}
            onChange={e => setAddValue(e.target.value)}
            placeholder="Value"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && saveAdd()}
            className="flex-1 rounded-lg border border-stone-300 px-2 py-1 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <button
            onClick={saveAdd}
            disabled={saving || !addName.trim() || !addValue.trim()}
            className="text-sm text-stone-700 font-medium hover:text-stone-900 disabled:opacity-40"
          >
            Save
          </button>
          <button
            onClick={() => setAddName(null)}
            className="text-stone-400 hover:text-stone-600 text-lg leading-none"
            aria-label="Cancel"
          >
            ×
          </button>
        </div>
      )}

      {addName === null && (
        <div>
          {availableSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {availableSuggestions.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => startAdd(s)}
                  className="text-xs rounded-full border border-stone-300 px-3 py-1 text-stone-600 hover:bg-stone-100"
                >
                  + {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => startAdd('')}
            className="text-sm text-stone-500 hover:text-stone-700 underline"
          >
            + Add custom detail
          </button>
        </div>
      )}
    </section>
  )
}
