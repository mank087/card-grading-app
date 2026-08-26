import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { requireCron } from './cronAuth'
import type { NextRequest } from 'next/server'

/** requireCron only reads request.headers.get('authorization'). */
function req(authorization?: string): NextRequest {
  return { headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? authorization ?? null : null) } } as unknown as NextRequest
}

// process.env rejects Object.defineProperty ("only accepts a configurable,
// writable, and enumerable data descriptor"), so use vitest's stubbing, which
// also restores cleanly via unstubAllEnvs.
function setEnv(nodeEnv: string, secret: string | undefined) {
  vi.stubEnv('NODE_ENV', nodeEnv)
  vi.stubEnv('CRON_SECRET', secret as any)
}

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('requireCron', () => {
  test('allows a request whose bearer token matches', () => {
    setEnv('production', 'topsecret')
    expect(requireCron(req('Bearer topsecret'), 't').ok).toBe(true)
  })

  test('rejects a mismatched token with 401', async () => {
    setEnv('production', 'topsecret')
    const r = requireCron(req('Bearer wrong'), 't')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(401)
  })

  test('rejects a missing Authorization header with 401', async () => {
    setEnv('production', 'topsecret')
    const r = requireCron(req(undefined), 't')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(401)
  })

  // THE REGRESSION THIS FILE EXISTS FOR.
  // The old guard was `if (CRON_SECRET && auth !== ...)`, which evaluates to
  // false when the secret is unset — so an unconfigured production deploy left
  // these endpoints publicly callable. They spend money (OpenAI, paid pricing
  // APIs, outbound email), so a public one is an unmetered bill.
  test('FAILS CLOSED in production when CRON_SECRET is unset', async () => {
    setEnv('production', undefined)
    const r = requireCron(req('Bearer anything'), 't')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(500)
  })

  test('an unset secret in production rejects even a request with no auth header at all', async () => {
    setEnv('production', undefined)
    expect(requireCron(req(undefined), 't').ok).toBe(false)
  })

  test('allows an unset secret outside production so local dev still runs', () => {
    setEnv('development', undefined)
    expect(requireCron(req(undefined), 't').ok).toBe(true)
  })

  test('still enforces a set secret outside production', () => {
    setEnv('development', 'topsecret')
    expect(requireCron(req('Bearer wrong'), 't').ok).toBe(false)
  })
})
