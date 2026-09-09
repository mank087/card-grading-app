import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => {
  const query: Record<string, any> = {}
  for (const method of ['select', 'eq', 'or', 'in', 'order']) query[method] = vi.fn(() => query)
  query.limit = vi.fn(async () => ({ data: [], error: null }))
  return { query, cached: vi.fn(), sign: vi.fn(async () => new Map()) }
})
vi.mock('next/cache', () => ({ unstable_cache: (fn: (...args: any[]) => any) => (...args: any[]) => { mocks.cached(...args); return fn(...args) } }))
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: { from: () => mocks.query, storage: {} } }))
vi.mock('@/lib/signedUrlBatch', () => ({ createSignedImageMap: mocks.sign, pickDisplayUrls: () => ({ display: 'thumb', full: 'original' }) }))
import { GET } from './route'
import { HOME_SHOWCASE_IDS } from '@/lib/cards/marketingShowcase'
const request = (query = '') => GET(new NextRequest(`http://localhost/api/cards/featured${query}`))
beforeEach(() => { vi.clearAllMocks(); mocks.query.limit.mockResolvedValue({ data: [], error: null }); mocks.sign.mockResolvedValue(new Map()) })
describe('public featured card selection', () => {
  it('caps the homepage to its five reviewed public cards and uses the cache', async () => {
    expect((await request('?showcase=1&limit=50')).status).toBe(200)
    expect(mocks.query.in).toHaveBeenCalledWith('id', [...HOME_SHOWCASE_IDS])
    expect(mocks.query.eq).toHaveBeenCalledWith('visibility', 'public')
    expect(mocks.query.limit).toHaveBeenCalledWith(5)
    expect(mocks.cached).toHaveBeenCalledOnce()
  })
  it('keeps normal featured galleries live and preserves their featured filter', async () => {
    await request('?limit=20')
    expect(mocks.query.eq).toHaveBeenCalledWith('is_featured', true)
    expect(mocks.query.limit).toHaveBeenCalledWith(20)
    expect(mocks.cached).not.toHaveBeenCalled()
  })
  it('does not let an unknown showcase bypass the featured filter', async () => {
    await request('?showcase=unknown&limit=invalid')
    expect(mocks.query.eq).toHaveBeenCalledWith('is_featured', true)
    expect(mocks.query.limit).toHaveBeenCalledWith(15)
    expect(mocks.cached).not.toHaveBeenCalled()
  })
  it('returns a failure instead of caching a successful empty response on storage failure', async () => {
    mocks.query.limit.mockResolvedValue({ data: [{ front_path: 'front', back_path: 'back' }], error: null })
    mocks.sign.mockRejectedValueOnce(new Error('Storage unavailable'))
    const response = await request('?showcase=1')
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ error: 'Failed to fetch featured cards' })
  })
})
