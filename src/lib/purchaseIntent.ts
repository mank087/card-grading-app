/**
 * Purchase intent handoff.
 *
 * A signed-out visitor who clicks a plan or pack has told us what they want.
 * Sending them to signup and dropping that choice makes them start over, so we
 * park the intent in localStorage, return them to the same page with `?resume=1`
 * and preselect what they picked. We never auto-start checkout: the person has
 * to press the button again on a page they can read.
 *
 * Two carriers, because email confirmation often lands in a different browser:
 *  - localStorage (same browser), key `dcm.purchaseIntent`
 *  - an `intent` query param on the Supabase emailRedirectTo, rebuilt by
 *    /auth/callback when localStorage is empty
 *
 * Nothing here is trusted input. Every field is checked against an allowlist.
 * No price and no arbitrary URL is ever stored or returned.
 */

export type PurchaseIntent = {
  product: 'card_lovers' | 'pack'
  plan?: 'monthly' | 'annual'
  pack?: 'basic' | 'pro' | 'elite' | 'vip'
  ref?: string
  returnTo: '/credits' | '/card-lovers'
  at: number
}

export const PURCHASE_INTENT_KEY = 'dcm.purchaseIntent'

/** Intents older than this are stale. The visitor moved on. */
export const PURCHASE_INTENT_MAX_AGE_MS = 24 * 60 * 60 * 1000

const VALID_PRODUCTS = ['card_lovers', 'pack'] as const
const VALID_PLANS = ['monthly', 'annual'] as const
const VALID_PACKS = ['basic', 'pro', 'elite', 'vip'] as const
const VALID_RETURN_TO = ['/credits', '/card-lovers'] as const

/** Affiliate codes are short alphanumerics. Anything else is dropped. */
const REF_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

export type PromoCode = 'GRADE10' | 'GRADE20'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Coerce unknown data into a PurchaseIntent, or null. Shared by the storage
 * reader and the URL-param decoder so both apply the same allowlist.
 */
export function normalizePurchaseIntent(input: unknown, now = Date.now()): PurchaseIntent | null {
  if (!isRecord(input)) return null

  const product = input.product
  const returnTo = input.returnTo
  const at = input.at

  if (!VALID_PRODUCTS.includes(product as PurchaseIntent['product'])) return null
  if (!VALID_RETURN_TO.includes(returnTo as PurchaseIntent['returnTo'])) return null
  if (typeof at !== 'number' || !Number.isFinite(at)) return null
  // Reject stale intents, and clocks that claim to be from the future.
  if (at > now + 60_000) return null
  if (now - at > PURCHASE_INTENT_MAX_AGE_MS) return null

  // A plan or pack that is present but not on the allowlist means the payload
  // was tampered with or is from an older shape. Drop the whole thing rather
  // than silently buying something the visitor did not choose.
  if (input.plan !== undefined && !VALID_PLANS.includes(input.plan as 'monthly' | 'annual')) return null
  if (input.pack !== undefined && !VALID_PACKS.includes(input.pack as 'basic' | 'pro' | 'elite' | 'vip')) return null

  const plan = input.plan as PurchaseIntent['plan'] | undefined
  const pack = input.pack as PurchaseIntent['pack'] | undefined
  const ref = typeof input.ref === 'string' && REF_PATTERN.test(input.ref) ? input.ref : undefined

  return {
    product: product as PurchaseIntent['product'],
    ...(plan ? { plan } : {}),
    ...(pack ? { pack } : {}),
    ...(ref ? { ref } : {}),
    returnTo: returnTo as PurchaseIntent['returnTo'],
    at,
  }
}

export function savePurchaseIntent(intent: PurchaseIntent): void {
  if (typeof window === 'undefined') return
  const clean = normalizePurchaseIntent({ ...intent, at: intent?.at || Date.now() })
  if (!clean) return
  try {
    window.localStorage.setItem(PURCHASE_INTENT_KEY, JSON.stringify(clean))
  } catch {
    // Private mode or a full quota. The signup still works, the user just has
    // to pick again.
  }
}

export function readPurchaseIntent(): PurchaseIntent | null {
  if (typeof window === 'undefined') return null
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(PURCHASE_INTENT_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    return normalizePurchaseIntent(JSON.parse(raw))
  } catch {
    return null
  }
}

export function clearPurchaseIntent(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PURCHASE_INTENT_KEY)
  } catch {
    // Nothing to do.
  }
}

/** Where to send a returning visitor. Always one of our own pricing pages. */
export function purchaseIntentReturnUrl(intent: PurchaseIntent): string {
  const returnTo = VALID_RETURN_TO.includes(intent?.returnTo) ? intent.returnTo : '/credits'
  return `${returnTo}?resume=1`
}

/**
 * Compact form for the email confirmation link, e.g. `card_lovers:monthly` or
 * `pack:pro`. Only the product and the plan or pack travel. The ref and the
 * timestamp do not.
 */
export function encodePurchaseIntentParam(intent: PurchaseIntent): string | null {
  if (!intent) return null
  if (intent.product === 'card_lovers') {
    return intent.plan ? `card_lovers:${intent.plan}` : 'card_lovers'
  }
  if (intent.product === 'pack') {
    return intent.pack ? `pack:${intent.pack}` : 'pack'
  }
  return null
}

/** Rebuild an intent from the `intent` query param. Null if it is not valid. */
export function decodePurchaseIntentParam(
  value: string | null | undefined,
  now = Date.now()
): PurchaseIntent | null {
  if (typeof value !== 'string' || !value) return null
  const [product, detail] = value.split(':')

  if (product === 'card_lovers') {
    return normalizePurchaseIntent(
      // /credits owns the ?resume=1 handler and preselects the membership plan
      // there; /card-lovers has none, so an email-confirm return must not go there.
      { product: 'card_lovers', plan: detail, returnTo: '/credits', at: now },
      now
    )
  }
  if (product === 'pack') {
    return normalizePurchaseIntent({ product: 'pack', pack: detail, returnTo: '/credits', at: now }, now)
  }
  return null
}

/**
 * The post-grade email series is the only place these codes are handed out.
 * GRADE20 is 20% off a credit pack; GRADE10 (sent as "Grade10") is 10% off.
 * Anything not on the allowlist is null, so no attacker-chosen text reaches
 * the UI or Stripe.
 */
export function readPromoFromUrl(search: string): PromoCode | null {
  if (typeof search !== 'string' || !search) return null
  let params: URLSearchParams
  try {
    params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  } catch {
    return null
  }
  const promo = (params.get('promo') || '').trim().toUpperCase()
  if (promo === 'GRADE10') return 'GRADE10'
  if (promo === 'GRADE20') return 'GRADE20'
  return null
}
