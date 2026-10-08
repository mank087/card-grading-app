import { afterEach, describe, expect, it } from 'vitest'
import { analyticsTransactionId, claimPurchaseTracking } from './analyticsTransactionId'

const g = globalThis as any

function stubStorage(store: Record<string, string> = {}) {
  g.window = {
    localStorage: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v },
    },
  }
  return store
}

afterEach(() => { delete g.window })

describe('analyticsTransactionId', () => {
  it('strips the cs_live_ marker, applies the prefix and caps at 64 chars', () => {
    const id = 'cs_live_' + 'a'.repeat(58)
    expect(analyticsTransactionId(id)).toBe('a'.repeat(58))
    expect(analyticsTransactionId(id, 'card_lovers_')).toHaveLength(64)
    expect(analyticsTransactionId(id, 'founders_').startsWith('founders_')).toBe(true)
  })
})

describe('claimPurchaseTracking', () => {
  it('claims a session once and refuses it afterwards', () => {
    const store = stubStorage()
    expect(claimPurchaseTracking('cs_test_1')).toBe(true)
    expect(store['dcm_tracked_purchase_cs_test_1']).toBeTruthy()
    expect(claimPurchaseTracking('cs_test_1')).toBe(false)
    expect(claimPurchaseTracking('cs_test_2')).toBe(true)
  })

  it('refuses a missing session id', () => {
    stubStorage()
    expect(claimPurchaseTracking(null)).toBe(false)
    expect(claimPurchaseTracking('')).toBe(false)
  })

  it('fails open when storage throws', () => {
    g.window = { localStorage: { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } } }
    expect(claimPurchaseTracking('cs_test_3')).toBe(true)
  })
})
