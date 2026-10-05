import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn(), redirect: vi.fn(), notFound: vi.fn() }))
vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: () => ({ from: mocks.from }) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }))
import PublicCardLink from './page'
const id = 'b1000000-0000-4000-8000-000000000001'
beforeEach(() => {
  vi.clearAllMocks()
  const query = { select: mocks.select, eq: mocks.eq, is: mocks.is, maybeSingle: mocks.maybeSingle }
  mocks.from.mockReturnValue(query); mocks.select.mockReturnValue(query); mocks.eq.mockReturnValue(query); mocks.is.mockReturnValue(query)
  mocks.notFound.mockImplementation(() => { throw Error('not found') })
  mocks.redirect.mockImplementation(() => { throw Error('redirect') })
})
describe('public app card links', () => {
  it('only queries public, non-deleted cards and redirects to the normal report', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id, category: 'Pokemon' } })
    await expect(PublicCardLink({ params: Promise.resolve({ id }) })).rejects.toThrow('redirect')
    expect(mocks.eq).toHaveBeenCalledWith('visibility', 'public')
    expect(mocks.is).toHaveBeenCalledWith('deleted_at', null)
    expect(mocks.select).toHaveBeenCalledWith('id, category')
    expect(mocks.redirect).toHaveBeenCalledWith(`/pokemon/${id}`)
  })
  it('does not resolve private or deleted cards', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null })
    await expect(PublicCardLink({ params: Promise.resolve({ id }) })).rejects.toThrow('not found')
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
  it('rejects malformed ids before querying storage', async () => {
    await expect(PublicCardLink({ params: Promise.resolve({ id: 'bad' }) })).rejects.toThrow('not found')
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
