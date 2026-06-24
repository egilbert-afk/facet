import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/items/[id]/attributes/route'
import { PATCH, DELETE } from '@/app/api/items/[id]/attributes/[attrId]/route'

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
const ATTR_ID = 'attr-1'

function makeParams(overrides: Record<string, string> = {}) {
  return { params: Promise.resolve({ id: ITEM_ID, attrId: ATTR_ID, ...overrides }) }
}

function makeChain(terminal: string, result: unknown) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'limit', 'update', 'delete', 'insert', 'maybeSingle', 'single']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain[terminal] = vi.fn().mockResolvedValue(result)
  return chain
}

// --- POST /api/items/[id]/attributes ---

describe('POST /api/items/[id]/attributes', () => {
  beforeEach(() => vi.clearAllMocks())

  function makePostReq(body: unknown) {
    return new NextRequest(`http://localhost/api/items/${ITEM_ID}/attributes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 when not authenticated', async () => {
    mockGetAuth.mockResolvedValue(AUTH_401)
    const res = await POST(makePostReq({ attribute_name: 'metal', attribute_value: 'gold' }), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when item does not belong to household', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const itemChain = makeChain('maybeSingle', { data: null, error: null })
    mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(itemChain) } as never)

    const res = await POST(makePostReq({ attribute_name: 'metal', attribute_value: 'gold' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 400 when attribute_name is missing', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const itemChain = makeChain('maybeSingle', { data: { id: ITEM_ID }, error: null })
    mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(itemChain) } as never)

    const res = await POST(makePostReq({ attribute_value: 'gold' }), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 400 when attribute_value is empty', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const itemChain = makeChain('maybeSingle', { data: { id: ITEM_ID }, error: null })
    mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(itemChain) } as never)

    const res = await POST(makePostReq({ attribute_name: 'metal', attribute_value: '   ' }), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 201 with new attribute on success', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const newAttr = { id: ATTR_ID, item_id: ITEM_ID, attribute_name: 'metal', attribute_value: 'gold', order_index: 1 }
    const itemChain = makeChain('maybeSingle', { data: { id: ITEM_ID }, error: null })
    const lastChain = makeChain('maybeSingle', { data: { order_index: 0 }, error: null })
    const insertChain = makeChain('single', { data: newAttr, error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce(itemChain)
      .mockReturnValueOnce(lastChain)
      .mockReturnValueOnce(insertChain)
    mockCreateClient.mockResolvedValue({ from: mockFrom } as never)

    const res = await POST(makePostReq({ attribute_name: 'metal', attribute_value: 'gold' }), makeParams())
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.attribute.attribute_name).toBe('metal')
  })
})

// --- PATCH /api/items/[id]/attributes/[attrId] ---

describe('PATCH /api/items/[id]/attributes/[attrId]', () => {
  beforeEach(() => vi.clearAllMocks())

  function makePatchReq(body: unknown) {
    return new NextRequest(`http://localhost/api/items/${ITEM_ID}/attributes/${ATTR_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 when not authenticated', async () => {
    mockGetAuth.mockResolvedValue(AUTH_401)
    const res = await PATCH(makePatchReq({ attribute_value: 'platinum' }), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when item does not belong to household', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const itemChain = makeChain('maybeSingle', { data: null, error: null })
    mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(itemChain) } as never)

    const res = await PATCH(makePatchReq({ attribute_value: 'platinum' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 404 when attribute does not exist', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const itemChain = makeChain('maybeSingle', { data: { id: ITEM_ID }, error: null })
    const attrChain = makeChain('maybeSingle', { data: null, error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce(itemChain)
      .mockReturnValueOnce(attrChain)
    mockCreateClient.mockResolvedValue({ from: mockFrom } as never)

    const res = await PATCH(makePatchReq({ attribute_value: 'platinum' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 400 when no valid fields provided', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const itemChain = makeChain('maybeSingle', { data: { id: ITEM_ID }, error: null })
    const attrChain = makeChain('maybeSingle', { data: { id: ATTR_ID }, error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce(itemChain)
      .mockReturnValueOnce(attrChain)
    mockCreateClient.mockResolvedValue({ from: mockFrom } as never)

    const res = await PATCH(makePatchReq({}), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 200 with updated attribute on success', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const updatedAttr = { id: ATTR_ID, attribute_name: 'metal', attribute_value: 'platinum', order_index: 0 }
    const itemChain = makeChain('maybeSingle', { data: { id: ITEM_ID }, error: null })
    const attrChain = makeChain('maybeSingle', { data: { id: ATTR_ID }, error: null })
    const updateChain = makeChain('single', { data: updatedAttr, error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce(itemChain)
      .mockReturnValueOnce(attrChain)
      .mockReturnValueOnce(updateChain)
    mockCreateClient.mockResolvedValue({ from: mockFrom } as never)

    const res = await PATCH(makePatchReq({ attribute_value: 'platinum' }), makeParams())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.attribute.attribute_value).toBe('platinum')
  })
})

// --- DELETE /api/items/[id]/attributes/[attrId] ---

describe('DELETE /api/items/[id]/attributes/[attrId]', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeDeleteReq() {
    return new NextRequest(`http://localhost/api/items/${ITEM_ID}/attributes/${ATTR_ID}`, { method: 'DELETE' })
  }

  it('returns 401 when not authenticated', async () => {
    mockGetAuth.mockResolvedValue(AUTH_401)
    const res = await DELETE(makeDeleteReq(), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when item does not belong to household', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const itemChain = makeChain('maybeSingle', { data: null, error: null })
    mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(itemChain) } as never)

    const res = await DELETE(makeDeleteReq(), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 204 on successful deletion', async () => {
    mockGetAuth.mockResolvedValue(AUTH_OK)
    const itemChain = makeChain('maybeSingle', { data: { id: ITEM_ID }, error: null })
    const attrChain = makeChain('maybeSingle', { data: { id: ATTR_ID }, error: null })
    const deleteChain = makeChain('eq', { error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce(itemChain)
      .mockReturnValueOnce(attrChain)
      .mockReturnValueOnce(deleteChain)
    mockCreateClient.mockResolvedValue({ from: mockFrom } as never)

    const res = await DELETE(makeDeleteReq(), makeParams())
    expect(res.status).toBe(204)
  })
})
