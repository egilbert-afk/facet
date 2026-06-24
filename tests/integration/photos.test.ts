import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/items/[id]/photos/route'
import { DELETE } from '@/app/api/items/[id]/photos/[photoId]/route'
import { PATCH } from '@/app/api/items/[id]/photos/[photoId]/primary/route'

// --- mocks ---

vi.mock('@/lib/supabase/getAuthenticatedMembership', () => ({
  getAuthenticatedMembership: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { getAuthenticatedMembership } from '@/lib/supabase/getAuthenticatedMembership'
import { createClient } from '@/lib/supabase/server'

const mockGetAuth = vi.mocked(getAuthenticatedMembership)
const mockCreateClient = vi.mocked(createClient)

const MEMBERSHIP = { userId: 'user-1', householdId: 'hh-1', role: 'owner' as const }
const AUTH_OK = { ok: true as const, membership: MEMBERSHIP }
const AUTH_401 = { ok: false as const, status: 401 as const, message: 'Not authenticated' }

const ITEM_ID = 'item-1'
const PHOTO_ID = 'photo-1'

function makeParams(overrides: Record<string, string> = {}) {
  return { params: Promise.resolve({ id: ITEM_ID, photoId: PHOTO_ID, ...overrides }) }
}

function makeGetReq() {
  return new NextRequest(`http://localhost/api/items/${ITEM_ID}/photos`)
}

function makeDeleteReq() {
  return new NextRequest(`http://localhost/api/items/${ITEM_ID}/photos/${PHOTO_ID}`, { method: 'DELETE' })
}

function makePatchReq() {
  return new NextRequest(`http://localhost/api/items/${ITEM_ID}/photos/${PHOTO_ID}/primary`, { method: 'PATCH' })
}

// Builds a fluent Supabase query chain that resolves with `result` at the terminal call
function makeChain(terminal: string, result: unknown) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'limit', 'update', 'delete', 'insert', 'maybeSingle', 'single', 'head']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain[terminal] = vi.fn().mockResolvedValue(result)
  return chain
}

// --- GET /api/items/[id]/photos ---

describe('GET /api/items/[id]/photos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockGetAuth.mockResolvedValue(AUTH_401)
    const res = await GET(makeGetReq(), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when item does not belong to household', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const itemChain = makeChain('maybeSingle', { data: null, error: null })
    const mockFrom = vi.fn().mockReturnValue(itemChain)
    mockCreateClient.mockResolvedValue({ from: mockFrom } as never)

    const res = await GET(makeGetReq(), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns photos for a valid item', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const photos = [{ id: PHOTO_ID, item_id: ITEM_ID, photo_url: 'https://example.com/photo.jpg', is_primary: true }]
    const itemChain = makeChain('maybeSingle', { data: { id: ITEM_ID }, error: null })
    const photoChain = makeChain('order', { data: photos, error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce(itemChain)
      .mockReturnValueOnce(photoChain)
    mockCreateClient.mockResolvedValue({ from: mockFrom } as never)

    const res = await GET(makeGetReq(), makeParams())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.photos).toHaveLength(1)
  })
})

// --- POST /api/items/[id]/photos ---

describe('POST /api/items/[id]/photos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockGetAuth.mockResolvedValue(AUTH_401)
    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}/photos`, { method: 'POST' })
    const res = await POST(req, makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when item does not belong to household', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const itemChain = makeChain('maybeSingle', { data: null, error: null })
    mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(itemChain) } as never)

    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}/photos`, { method: 'POST' })
    const res = await POST(req, makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 400 when no file is provided', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const itemChain = makeChain('maybeSingle', { data: { id: ITEM_ID }, error: null })
    mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(itemChain) } as never)

    const formData = new FormData()
    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}/photos`, {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req, makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 400 when file type is not allowed', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const itemChain = makeChain('maybeSingle', { data: { id: ITEM_ID }, error: null })
    mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(itemChain) } as never)

    const formData = new FormData()
    formData.append('photo', new File(['data'], 'photo.gif', { type: 'image/gif' }))
    const req = new NextRequest(`http://localhost/api/items/${ITEM_ID}/photos`, {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req, makeParams())
    expect(res.status).toBe(400)
  })
})

// --- DELETE /api/items/[id]/photos/[photoId] ---

describe('DELETE /api/items/[id]/photos/[photoId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockGetAuth.mockResolvedValue(AUTH_401)
    const res = await DELETE(makeDeleteReq(), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when photo does not exist', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const photoChain = makeChain('maybeSingle', { data: null, error: null })
    mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(photoChain) } as never)

    const res = await DELETE(makeDeleteReq(), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 204 on successful deletion', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const photo = { id: PHOTO_ID, photo_url: 'https://x.supabase.co/storage/v1/object/public/item-photos/hh-1/item-1/photo.jpg', is_primary: false, item_id: ITEM_ID }
    const photoChain = makeChain('maybeSingle', { data: photo, error: null })
    const itemChain = makeChain('maybeSingle', { data: { id: ITEM_ID }, error: null })
    const deleteChain = makeChain('eq', { error: null })
    const nextPhotoChain = makeChain('maybeSingle', { data: null, error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce(photoChain)
      .mockReturnValueOnce(itemChain)
      .mockReturnValueOnce(deleteChain)
      .mockReturnValueOnce(nextPhotoChain)
    const mockStorage = {
      from: vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    }
    mockCreateClient.mockResolvedValue({ from: mockFrom, storage: mockStorage } as never)

    const res = await DELETE(makeDeleteReq(), makeParams())
    expect(res.status).toBe(204)
  })
})

// --- PATCH /api/items/[id]/photos/[photoId]/primary ---

describe('PATCH /api/items/[id]/photos/[photoId]/primary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockGetAuth.mockResolvedValue(AUTH_401)
    const res = await PATCH(makePatchReq(), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when item does not belong to household', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const itemChain = makeChain('maybeSingle', { data: null, error: null })
    mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(itemChain) } as never)

    const res = await PATCH(makePatchReq(), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns updated photo on success', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const updatedPhoto = { id: PHOTO_ID, is_primary: true }
    const itemChain = makeChain('maybeSingle', { data: { id: ITEM_ID }, error: null })
    const photoChain = makeChain('maybeSingle', { data: { id: PHOTO_ID }, error: null })
    const unsetChain = makeChain('eq', { error: null })
    const setChain = makeChain('single', { data: updatedPhoto, error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce(itemChain)
      .mockReturnValueOnce(photoChain)
      .mockReturnValueOnce(unsetChain)
      .mockReturnValueOnce(setChain)
    mockCreateClient.mockResolvedValue({ from: mockFrom } as never)

    const res = await PATCH(makePatchReq(), makeParams())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.photo.is_primary).toBe(true)
  })
})
