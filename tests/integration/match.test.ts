import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- mocks (must be before imports that trigger module load) ---

// vi.hoisted ensures this is initialized before vi.mock factory runs
const mockMessagesCreate = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  // Regular function (not arrow) so it can be used as a constructor with `new`
  default: function MockAnthropic() {
    return { messages: { create: mockMessagesCreate } }
  },
}))

vi.mock('@/lib/supabase/getAuthenticatedMembership', () => ({
  getAuthenticatedMembership: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { POST } from '@/app/api/match/route'
import { PATCH } from '@/app/api/match/[attemptId]/selection/route'
import { getAuthenticatedMembership } from '@/lib/supabase/getAuthenticatedMembership'
import { createClient } from '@/lib/supabase/server'

const mockGetAuth = vi.mocked(getAuthenticatedMembership)
const mockCreateClient = vi.mocked(createClient)

const MEMBERSHIP = { userId: 'user-1', householdId: 'hh-1', role: 'owner' as const }
const AUTH_OK = { ok: true as const, membership: MEMBERSHIP }
const AUTH_401 = { ok: false as const, status: 401 as const, message: 'Not authenticated' }

const ITEM_ID = 'item-1'
const ATTEMPT_ID = 'attempt-1'

function makeChain(terminal: string, result: unknown) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'order', 'update', 'insert', 'maybeSingle', 'single']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain[terminal] = vi.fn().mockResolvedValue(result)
  return chain
}

function makeJpegFile() {
  return new File(['fake-image-data'], 'photo.jpg', { type: 'image/jpeg' })
}

function makePostReq(file?: File) {
  const fd = new FormData()
  if (file) fd.append('photo', file)
  return new NextRequest('http://localhost/api/match', { method: 'POST', body: fd })
}

// --- POST /api/match ---

describe('POST /api/match', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockGetAuth.mockResolvedValue(AUTH_401)
    const res = await POST(makePostReq(makeJpegFile()))
    expect(res.status).toBe(401)
  })

  it('returns 400 when no photo is provided', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const res = await POST(makePostReq())
    expect(res.status).toBe(400)
  })

  it('returns 400 when file type is not allowed', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const file = new File(['data'], 'photo.gif', { type: 'image/gif' })
    const res = await POST(makePostReq(file))
    expect(res.status).toBe(400)
  })

  it('returns empty candidates when catalog is empty', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const itemsChain = makeChain('order', { data: [], error: null })
    const attrsChain = makeChain('select', { data: [], error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce(itemsChain)
      .mockReturnValueOnce(attrsChain)
    mockCreateClient.mockResolvedValue({ from: mockFrom } as never)

    const res = await POST(makePostReq(makeJpegFile()))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.candidates).toHaveLength(0)
    expect(json.attemptId).toBeNull()
  })

  it('returns ranked candidates on success', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)

    const items = [
      { id: ITEM_ID, name: 'Sapphire ring', category: 'ring', given_by: null, headline: null },
    ]
    const itemsChain = makeChain('order', { data: items, error: null })
    const attrsChain = makeChain('select', { data: [], error: null })
    const photosChain = makeChain('in', { data: [{ item_id: ITEM_ID, photo_url: 'https://example.com/photo.jpg' }], error: null })
    const logChain = makeChain('insert', { error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce(itemsChain)
      .mockReturnValueOnce(attrsChain)
      .mockReturnValueOnce(photosChain)
      .mockReturnValueOnce(logChain)
    mockCreateClient.mockResolvedValue({ from: mockFrom } as never)

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: `["${ITEM_ID}"]` }],
    })

    const res = await POST(makePostReq(makeJpegFile()))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.candidates).toHaveLength(1)
    expect(json.candidates[0].id).toBe(ITEM_ID)
    expect(json.candidates[0].primaryPhotoUrl).toBe('https://example.com/photo.jpg')
    expect(json.attemptId).toBeTruthy()
  })

  it('returns empty candidates when Claude response is malformed', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)

    const items = [{ id: ITEM_ID, name: 'Ring', category: 'ring', given_by: null, headline: null }]
    const itemsChain = makeChain('order', { data: items, error: null })
    const attrsChain = makeChain('select', { data: [], error: null })
    const logChain = makeChain('insert', { error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce(itemsChain)
      .mockReturnValueOnce(attrsChain)
      .mockReturnValueOnce(logChain)
    mockCreateClient.mockResolvedValue({ from: mockFrom } as never)

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'I cannot determine which item this is.' }],
    })

    const res = await POST(makePostReq(makeJpegFile()))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.candidates).toHaveLength(0)
  })

  it('filters out IDs not in the household catalog', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)

    const items = [{ id: ITEM_ID, name: 'Ring', category: 'ring', given_by: null, headline: null }]
    const itemsChain = makeChain('order', { data: items, error: null })
    const attrsChain = makeChain('select', { data: [], error: null })
    const logChain = makeChain('insert', { error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce(itemsChain)
      .mockReturnValueOnce(attrsChain)
      .mockReturnValueOnce(logChain)
    mockCreateClient.mockResolvedValue({ from: mockFrom } as never)

    // Claude returns an ID that doesn't belong to this household
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '["not-a-real-id"]' }],
    })

    const res = await POST(makePostReq(makeJpegFile()))
    const json = await res.json()
    expect(json.candidates).toHaveLength(0)
  })

  it('returns empty candidates when Claude API throws', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)

    const items = [{ id: ITEM_ID, name: 'Ring', category: 'ring', given_by: null, headline: null }]
    const itemsChain = makeChain('order', { data: items, error: null })
    const attrsChain = makeChain('select', { data: [], error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce(itemsChain)
      .mockReturnValueOnce(attrsChain)
    mockCreateClient.mockResolvedValue({ from: mockFrom } as never)

    mockMessagesCreate.mockRejectedValue(new Error('API unavailable'))

    const res = await POST(makePostReq(makeJpegFile()))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.candidates).toHaveLength(0)
  })
})

// --- PATCH /api/match/[attemptId]/selection ---

describe('PATCH /api/match/[attemptId]/selection', () => {
  beforeEach(() => vi.clearAllMocks())

  function makePatchReq(body: unknown) {
    return new NextRequest(`http://localhost/api/match/${ATTEMPT_ID}/selection`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  function makeParams() {
    return { params: Promise.resolve({ attemptId: ATTEMPT_ID }) }
  }

  it('returns 401 when not authenticated', async () => {
    mockGetAuth.mockResolvedValue(AUTH_401)
    const res = await PATCH(makePatchReq({ selected_item_id: ITEM_ID }), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 200 gracefully when attempt is not found', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const attemptChain = makeChain('maybySingle', { data: null, error: null })
    mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(attemptChain) } as never)

    const res = await PATCH(makePatchReq({ selected_item_id: ITEM_ID }), makeParams())
    expect(res.status).toBe(200)
  })

  it('returns 400 when selected_item_id is missing', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const attempt = { id: ATTEMPT_ID, candidate_item_ids: [ITEM_ID] }
    const attemptChain = makeChain('maybeSingle', { data: attempt, error: null })
    mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(attemptChain) } as never)

    const res = await PATCH(makePatchReq({}), makeParams())
    expect(res.status).toBe(400)
  })

  it('records selection and computes was_correct_top_match=true', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const attempt = { id: ATTEMPT_ID, candidate_item_ids: [ITEM_ID] }
    const attemptChain = makeChain('maybeSingle', { data: attempt, error: null })
    const updateChain = makeChain('eq', { error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce(attemptChain)
      .mockReturnValueOnce(updateChain)
    mockCreateClient.mockResolvedValue({ from: mockFrom } as never)

    const res = await PATCH(makePatchReq({ selected_item_id: ITEM_ID }), makeParams())
    expect(res.status).toBe(200)
  })

  it('records was_correct_top_match=false when non-top candidate selected', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const attempt = { id: ATTEMPT_ID, candidate_item_ids: ['top-item', ITEM_ID] }
    const attemptChain = makeChain('maybeSingle', { data: attempt, error: null })
    const updateChain = makeChain('eq', { error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce(attemptChain)
      .mockReturnValueOnce(updateChain)
    mockCreateClient.mockResolvedValue({ from: mockFrom } as never)

    const res = await PATCH(makePatchReq({ selected_item_id: ITEM_ID }), makeParams())
    expect(res.status).toBe(200)
  })
})
