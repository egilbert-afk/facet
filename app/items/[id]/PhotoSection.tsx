'use client'

import { useState, useRef } from 'react'

type Photo = {
  id: string
  photo_url: string
  is_primary: boolean
  caption: string | null
  order_index: number
}

export default function PhotoSection({ itemId, initialPhotos }: {
  itemId: string
  initialPhotos: Photo[]
}) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('photo', file)

    const res = await fetch(`/api/items/${itemId}/photos`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Upload failed. Please try again.')
    } else {
      const { photo } = await res.json()
      setPhotos(prev => [...prev, photo])
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleSetPrimary(photoId: string) {
    const res = await fetch(`/api/items/${itemId}/photos/${photoId}/primary`, {
      method: 'PATCH',
    })
    if (res.ok) {
      setPhotos(prev => prev.map(p => ({ ...p, is_primary: p.id === photoId })))
    }
  }

  async function handleDelete(photoId: string) {
    const res = await fetch(`/api/items/${itemId}/photos/${photoId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      const removed = photos.find(p => p.id === photoId)
      const remaining = photos.filter(p => p.id !== photoId)
      // Promote next as primary if the deleted one was primary
      if (removed?.is_primary && remaining.length > 0) {
        remaining[0] = { ...remaining[0], is_primary: true }
      }
      setPhotos(remaining)
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide">Photos</h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-sm text-stone-600 hover:text-stone-800 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : '+ Add photo'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {photos.length === 0 && !uploading && (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-stone-200 rounded-xl py-10 text-center text-stone-400 cursor-pointer hover:border-stone-300"
        >
          <p className="text-sm">Tap to add a photo</p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {photos.map(photo => (
            <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-square bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.photo_url}
                alt=""
                className="w-full h-full object-cover"
              />
              {photo.is_primary && (
                <span className="absolute top-2 left-2 text-xs bg-stone-800 text-white px-2 py-0.5 rounded-full">
                  Primary
                </span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 gap-2">
                {!photo.is_primary && (
                  <button
                    onClick={() => handleSetPrimary(photo.id)}
                    className="text-xs bg-white text-stone-800 rounded-full px-2 py-1 hover:bg-stone-100"
                  >
                    Set primary
                  </button>
                )}
                <button
                  onClick={() => handleDelete(photo.id)}
                  className="text-xs bg-red-500 text-white rounded-full px-2 py-1 hover:bg-red-600 ml-auto"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
