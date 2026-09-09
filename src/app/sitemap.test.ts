import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ range: vi.fn(), eq: vi.fn(), is: vi.fn(), or: vi.fn(), orgRange: vi.fn(), profiles: [] as { username: string }[] }))
vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: () => ({ from: (table: string) => {
  const q: any = { then: (resolve: any) => Promise.resolve({ data: table === 'profiles' ? mock.profiles : [], error: null }).then(resolve) }
  for (const method of ['select', 'order', 'lte', 'in']) q[method] = () => q
  q.eq = (...args: any[]) => { mock.eq(...args); return q }
  q.is = (...args: any[]) => { mock.is(...args); return q }
  q.or = (...args: any[]) => { mock.or(...args); return q }
  q.range = (...args: any[]) => table === 'organizations' ? mock.orgRange(...args) : mock.range(...args)
  return q
} }) }))
vi.mock('@/lib/postGradeEmailTemplates', () => ({ categoryToRouteSlug: (category: string) => category === 'Star Wars' ? 'starwars' : 'sports' }))
vi.mock('@/lib/cards/ownership', () => ({ withColumnFallback: (primary: () => unknown) => primary() }))
import sitemap from './sitemap'
beforeEach(() => { vi.clearAllMocks(); mock.range.mockResolvedValue({ data: [], error: null }); mock.orgRange.mockResolvedValue({ data: [], error: null }); mock.profiles = [] })
describe('canonical public sitemap', () => {
  it('continues past the database row cap and includes only canonical card routes', async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ id: `card-${i}`, category: 'Sports', created_at: '2026-08-01T00:00:00Z' }))
    mock.range.mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: [{ ...rows[0], id: 'last-card', category: 'Star Wars' }], error: null })
    const entries = await sitemap()
    expect(mock.range).toHaveBeenNthCalledWith(1, 0, 999)
    expect(mock.range).toHaveBeenNthCalledWith(2, 1000, 1999)
    expect(entries.some(e => e.url.endsWith('/other/last-card'))).toBe(true)
    expect(entries.some(e => e.url.includes('/verify/'))).toBe(false)
    expect(mock.eq).toHaveBeenCalledWith('visibility', 'public')
    expect(mock.is).toHaveBeenCalledWith('deleted_at', null)
    expect(mock.or).toHaveBeenCalledWith('conversational_decimal_grade.not.is.null,conversational_grading.not.is.null')
  })
  it('does not invent static update dates or include account routes', async () => {
    const entries = await sitemap()
    expect(entries.find(e => e.url === 'https://dcmgrading.com')?.lastModified).toBeUndefined()
    for (const route of ['vip', 'enterprise', 'instalist-marketplace', 'sports-database', 'starwars-database']) expect(entries.some(e => e.url.endsWith('/' + route))).toBe(true)
    expect(entries.some(e => /\/(?:login|account|upload|admin|dev)(?:\/|$)/.test(e.url))).toBe(false)
    expect(new Set(entries.map(e => e.url)).size).toBe(entries.length)
  })
  it('discovers only enabled storefronts and owners of public graded cards', async () => {
    mock.range.mockResolvedValueOnce({ data: [{ id: 'public-card', category: 'Sports', user_id: 'owner', org_id: 'active-org' }], error: null })
    mock.orgRange.mockResolvedValueOnce({ data: [{ id: 'active-org', slug: 'card-shop' }], error: null })
    mock.profiles = [{ username: 'collector' }]
    const entries = await sitemap()
    for (const path of ['/enterprise/card-shop', '/enterprise/card-shop/card/public-card', '/collection/collector']) expect(entries.some(entry => entry.url.endsWith(path))).toBe(true)
    expect(mock.eq).toHaveBeenCalledWith('status', 'active')
    expect(mock.eq).toHaveBeenCalledWith('storefront_enabled', true)
  })
  it('fails regeneration rather than returning a partial card listing', async () => {
    mock.range.mockResolvedValueOnce({ data: null, error: { message: 'timeout' } })
    await expect(sitemap()).rejects.toThrow('Unable to generate the public card sitemap')
  })
})
