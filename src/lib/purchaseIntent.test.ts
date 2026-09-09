import { describe, it, expect, beforeEach } from 'vitest'
import {
  PURCHASE_INTENT_KEY,
  PURCHASE_INTENT_MAX_AGE_MS,
  savePurchaseIntent,
  readPurchaseIntent,
  clearPurchaseIntent,
  purchaseIntentReturnUrl,
  encodePurchaseIntentParam,
  decodePurchaseIntentParam,
  readPromoFromUrl,
  normalizePurchaseIntent,
  type PurchaseIntent,
} from './purchaseIntent'

// The vitest environment is node, so stand up the minimum localStorage the
// module touches.
class MemoryStorage {
  private map = new Map<string, string>()
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null }
  setItem(k: string, v: string) { this.map.set(k, String(v)) }
  removeItem(k: string) { this.map.delete(k) }
  clear() { this.map.clear() }
}

const store = new MemoryStorage()
;(globalThis as any).window = { localStorage: store }

function write(raw: string) {
  store.setItem(PURCHASE_INTENT_KEY, raw)
}

describe('purchaseIntent storage', () => {
  beforeEach(() => store.clear())

  it('round-trips a card lovers intent', () => {
    const intent: PurchaseIntent = {
      product: 'card_lovers',
      plan: 'annual',
      ref: 'joey-42',
      returnTo: '/card-lovers',
      at: Date.now(),
    }
    savePurchaseIntent(intent)
    expect(readPurchaseIntent()).toEqual(intent)
  })

  it('round-trips a pack intent', () => {
    const intent: PurchaseIntent = { product: 'pack', pack: 'pro', returnTo: '/credits', at: Date.now() }
    savePurchaseIntent(intent)
    expect(readPurchaseIntent()).toEqual(intent)
  })

  it('returns null when nothing is stored', () => {
    expect(readPurchaseIntent()).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    write('{not json')
    expect(readPurchaseIntent()).toBeNull()
  })

  it('returns null for an intent older than 24h', () => {
    write(JSON.stringify({
      product: 'pack',
      pack: 'vip',
      returnTo: '/credits',
      at: Date.now() - PURCHASE_INTENT_MAX_AGE_MS - 1000,
    }))
    expect(readPurchaseIntent()).toBeNull()
  })

  it('keeps an intent just inside the 24h window', () => {
    write(JSON.stringify({
      product: 'pack',
      pack: 'vip',
      returnTo: '/credits',
      at: Date.now() - (PURCHASE_INTENT_MAX_AGE_MS - 5000),
    }))
    expect(readPurchaseIntent()?.pack).toBe('vip')
  })

  it('rejects unknown products, plans, packs and return paths', () => {
    write(JSON.stringify({ product: 'gold', returnTo: '/credits', at: Date.now() }))
    expect(readPurchaseIntent()).toBeNull()
    write(JSON.stringify({ product: 'card_lovers', plan: 'weekly', returnTo: '/card-lovers', at: Date.now() }))
    expect(readPurchaseIntent()).toBeNull()
    write(JSON.stringify({ product: 'pack', pack: 'mega', returnTo: '/credits', at: Date.now() }))
    expect(readPurchaseIntent()).toBeNull()
    write(JSON.stringify({ product: 'pack', returnTo: 'https://evil.example.com', at: Date.now() }))
    expect(readPurchaseIntent()).toBeNull()
  })

  it('drops a ref that is not a plain code but keeps the intent', () => {
    write(JSON.stringify({
      product: 'pack',
      pack: 'basic',
      ref: 'javascript:alert(1)',
      returnTo: '/credits',
      at: Date.now(),
    }))
    const intent = readPurchaseIntent()
    expect(intent?.pack).toBe('basic')
    expect(intent?.ref).toBeUndefined()
  })

  it('ignores extra fields such as a price', () => {
    write(JSON.stringify({ product: 'pack', pack: 'elite', price: 0.01, returnTo: '/credits', at: Date.now() }))
    expect(readPurchaseIntent()).toEqual({ product: 'pack', pack: 'elite', returnTo: '/credits', at: expect.any(Number) })
  })

  it('clears', () => {
    savePurchaseIntent({ product: 'pack', pack: 'pro', returnTo: '/credits', at: Date.now() })
    clearPurchaseIntent()
    expect(readPurchaseIntent()).toBeNull()
  })

  it('does not persist an invalid intent', () => {
    savePurchaseIntent({ product: 'nope', returnTo: '/credits', at: Date.now() } as unknown as PurchaseIntent)
    expect(store.getItem(PURCHASE_INTENT_KEY)).toBeNull()
  })

  it('normalizePurchaseIntent rejects non-objects', () => {
    expect(normalizePurchaseIntent(null)).toBeNull()
    expect(normalizePurchaseIntent('card_lovers')).toBeNull()
    expect(normalizePurchaseIntent([])).toBeNull()
  })
})

describe('purchaseIntentReturnUrl', () => {
  it('appends resume=1 to the allowlisted path', () => {
    expect(purchaseIntentReturnUrl({ product: 'card_lovers', plan: 'monthly', returnTo: '/card-lovers', at: 1 }))
      .toBe('/card-lovers?resume=1')
    expect(purchaseIntentReturnUrl({ product: 'pack', pack: 'pro', returnTo: '/credits', at: 1 }))
      .toBe('/credits?resume=1')
  })

  it('falls back to /credits for a bad returnTo', () => {
    expect(purchaseIntentReturnUrl({ product: 'pack', returnTo: '//evil.com' as any, at: 1 }))
      .toBe('/credits?resume=1')
  })
})

describe('intent url param', () => {
  it('encodes', () => {
    expect(encodePurchaseIntentParam({ product: 'card_lovers', plan: 'monthly', returnTo: '/card-lovers', at: 1 }))
      .toBe('card_lovers:monthly')
    expect(encodePurchaseIntentParam({ product: 'pack', pack: 'pro', returnTo: '/credits', at: 1 }))
      .toBe('pack:pro')
    expect(encodePurchaseIntentParam({ product: 'pack', returnTo: '/credits', at: 1 })).toBe('pack')
  })

  it('decodes to a fresh intent with the right return path', () => {
    expect(decodePurchaseIntentParam('card_lovers:annual')).toMatchObject({
      product: 'card_lovers', plan: 'annual', returnTo: '/card-lovers',
    })
    expect(decodePurchaseIntentParam('pack:vip')).toMatchObject({
      product: 'pack', pack: 'vip', returnTo: '/credits',
    })
    expect(decodePurchaseIntentParam('card_lovers')).toMatchObject({
      product: 'card_lovers', returnTo: '/card-lovers',
    })
  })

  it('rejects junk', () => {
    expect(decodePurchaseIntentParam('')).toBeNull()
    expect(decodePurchaseIntentParam(null)).toBeNull()
    expect(decodePurchaseIntentParam('pack:mega')).toBeNull()
    expect(decodePurchaseIntentParam('card_lovers:weekly')).toBeNull()
    expect(decodePurchaseIntentParam('https://evil.example.com')).toBeNull()
  })

  it('encode then decode preserves the choice', () => {
    const param = encodePurchaseIntentParam({ product: 'card_lovers', plan: 'annual', returnTo: '/card-lovers', at: 1 })
    expect(decodePurchaseIntentParam(param)).toMatchObject({ product: 'card_lovers', plan: 'annual' })
  })
})

describe('readPromoFromUrl', () => {
  it('reads allowlisted codes, case-insensitively', () => {
    expect(readPromoFromUrl('?promo=GRADE20')).toBe('GRADE20')
    expect(readPromoFromUrl('promo=grade10')).toBe('GRADE10')
    expect(readPromoFromUrl('?utm_source=email&promo=Grade20&x=1')).toBe('GRADE20')
  })

  it('returns null for anything else', () => {
    expect(readPromoFromUrl('')).toBeNull()
    expect(readPromoFromUrl('?promo=')).toBeNull()
    expect(readPromoFromUrl('?promo=FREEMONEY')).toBeNull()
    expect(readPromoFromUrl('?utm_source=email')).toBeNull()
    expect(readPromoFromUrl(undefined as unknown as string)).toBeNull()
  })
})
