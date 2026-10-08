import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gaClientIdFromCookie, gaClientIdMetadata, sendGa4Purchase } from './ga4MeasurementProtocol'

const input = {
  transactionId: 'abc123',
  value: 9.99,
  currency: 'usd',
  items: [{ item_id: 'pro', item_name: '5 Credits', price: 9.99, quantity: 1 }],
  source: 'stripe' as const,
}

describe('sendGa4Purchase', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('is a no-op without GA4_MP_API_SECRET', async () => {
    vi.stubEnv('GA4_MP_API_SECRET', '')
    expect(await sendGa4Purchase(input)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts a purchase event to the Measurement Protocol endpoint', async () => {
    vi.stubEnv('GA4_MP_API_SECRET', 'sec ret')
    fetchMock.mockResolvedValue({ ok: true, status: 204 })

    expect(await sendGa4Purchase({ ...input, clientId: '111.222' })).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://www.google-analytics.com/mp/collect?measurement_id=G-YLC2FKKBGC&api_secret=sec%20ret')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body).toEqual({
      client_id: '111.222',
      non_personalized_ads: true,
      events: [{
        name: 'purchase',
        params: {
          transaction_id: 'abc123',
          value: 9.99,
          currency: 'USD',
          items: input.items,
          engagement_time_msec: 1,
          purchase_source: 'stripe',
        },
      }],
    })
    expect(body.user_id).toBeUndefined()
  })

  it('generates a GA-shaped client id when none is given and omits an unknown value', async () => {
    vi.stubEnv('GA4_MP_API_SECRET', 'x')
    fetchMock.mockResolvedValue({ ok: true, status: 204 })

    await sendGa4Purchase({ ...input, value: undefined })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.client_id).toMatch(/^\d+\.\d+$/)
    expect('value' in body.events[0].params).toBe(false)
  })

  it('never throws when fetch fails or GA returns an error', async () => {
    vi.stubEnv('GA4_MP_API_SECRET', 'x')
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    await expect(sendGa4Purchase(input)).resolves.toBe(false)

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(sendGa4Purchase(input)).resolves.toBe(false)
  })
})

describe('GA client id from the _ga cookie', () => {
  it('parses the client id from a _ga cookie value', () => {
    expect(gaClientIdFromCookie('GA1.1.123456789.1700000000')).toBe('123456789.1700000000')
    expect(gaClientIdFromCookie('GA1.2.987.654')).toBe('987.654')
  })

  it('rejects missing or malformed values', () => {
    expect(gaClientIdFromCookie(undefined)).toBeNull()
    expect(gaClientIdFromCookie('')).toBeNull()
    expect(gaClientIdFromCookie('garbage')).toBeNull()
    expect(gaClientIdFromCookie('GS1.1.abc.def')).toBeNull()
  })

  it('builds session metadata only when the cookie exists', () => {
    const withCookie = { cookies: { get: (n: string) => (n === '_ga' ? { value: 'GA1.1.42.1700000000' } : undefined) } }
    const without = { cookies: { get: () => undefined } }
    expect(gaClientIdMetadata(withCookie)).toEqual({ ga_client_id: '42.1700000000' })
    expect(gaClientIdMetadata(without)).toEqual({})
  })
})
