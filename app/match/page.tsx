'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Candidate = {
  id: string
  name: string
  category: string
  given_by: string | null
  headline: string | null
  primaryPhotoUrl: string | null
}

type State =
  | { phase: 'idle' }
  | { phase: 'processing' }
  | { phase: 'results'; attemptId: string | null; candidates: Candidate[] }
  | { phase: 'error' }

export default function MatchPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>({ phase: 'idle' })

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setState({ phase: 'processing' })

    const formData = new FormData()
    formData.append('photo', file)

    try {
      const res = await fetch('/api/match', { method: 'POST', body: formData })
      if (!res.ok) {
        setState({ phase: 'error' })
        return
      }
      const { candidates, attemptId } = await res.json()
      setState({ phase: 'results', candidates, attemptId })
    } catch {
      setState({ phase: 'error' })
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleSelect(candidate: Candidate) {
    if (state.phase !== 'results' || !state.attemptId) {
      router.push(`/items/${candidate.id}`)
      return
    }
    const { attemptId } = state
    fetch(`/api/match/${attemptId}/selection`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_item_id: candidate.id }),
    }).catch(err => console.error('[match] selection log failed:', err))
    router.push(`/items/${candidate.id}`)
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 max-w-lg mx-auto">
      <a href="/items" className="text-sm text-stone-500 hover:text-stone-700 mb-6 inline-block">
        ← Your collection
      </a>

      <h1 className="text-2xl font-semibold text-stone-800 mb-2">Identify a piece</h1>
      <p className="text-sm text-stone-500 mb-8">Photograph something from your collection to find it.</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      {state.phase === 'idle' && (
        <div>
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-xl bg-stone-800 text-white py-4 text-lg font-medium hover:bg-stone-700"
          >
            Photograph a piece
          </button>
          <p className="text-center mt-4">
            <Link href="/items" className="text-sm text-stone-500 hover:text-stone-700 underline">
              Browse collection instead
            </Link>
          </p>
        </div>
      )}

      {state.phase === 'processing' && (
        <div className="text-center py-16">
          <p className="text-stone-500">Looking through your collection…</p>
        </div>
      )}

      {state.phase === 'error' && (
        <div className="text-center py-8">
          <p className="text-stone-600 mb-4">Something went wrong. Please try again.</p>
          <button
            onClick={() => setState({ phase: 'idle' })}
            className="text-sm text-stone-600 underline"
          >
            Try again
          </button>
        </div>
      )}

      {state.phase === 'results' && (
        <div>
          {state.candidates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-stone-600 mb-4">
                Couldn&apos;t narrow this down — try browsing by category instead.
              </p>
              <Link href="/items" className="text-sm text-stone-700 underline">
                Browse your collection
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-sm text-stone-500 mb-4">
                {state.candidates.length === 1
                  ? 'Best match:'
                  : `${state.candidates.length} possible matches — tap to confirm:`}
              </p>
              <div className="space-y-3">
                {state.candidates.map((candidate, i) => (
                  <button
                    key={candidate.id}
                    onClick={() => handleSelect(candidate)}
                    className="w-full flex items-center gap-4 bg-white rounded-xl border border-stone-200 px-4 py-3 hover:border-stone-300 text-left"
                  >
                    <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-stone-100 flex items-center justify-center">
                      {candidate.primaryPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={candidate.primaryPhotoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl text-stone-300 font-light select-none">
                          {candidate.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-800 truncate">{candidate.name}</p>
                      {candidate.given_by && (
                        <p className="text-sm text-stone-500 mt-0.5">From {candidate.given_by}</p>
                      )}
                      {candidate.headline && (
                        <p className="text-sm text-stone-400 mt-0.5 italic truncate">{candidate.headline}</p>
                      )}
                    </div>
                    {i === 0 && (
                      <span className="shrink-0 text-xs text-stone-400 border border-stone-200 rounded-full px-2 py-0.5">
                        Best match
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-center mt-6 space-x-3">
                <button
                  onClick={() => setState({ phase: 'idle' })}
                  className="text-sm text-stone-500 hover:text-stone-700 underline"
                >
                  Try a different photo
                </button>
                <span className="text-stone-300">·</span>
                <Link href="/items" className="text-sm text-stone-500 hover:text-stone-700 underline">
                  Browse instead
                </Link>
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
