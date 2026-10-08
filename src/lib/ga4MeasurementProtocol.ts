/**
 * Server-side GA4 purchase events via the Measurement Protocol (2026-10-08).
 *
 * The browser sends GA4 `purchase` from the checkout success pages, but only
 * when the buyer accepted analytics. Purchases the browser never reports are
 * sent from the server instead:
 *   - iOS / Android in-app purchases (no browser at all)
 *   - web Stripe purchases where the buyer had no GA client (no `_ga` cookie
 *     at checkout, i.e. analytics not accepted)
 *   - enterprise/org Stripe purchases (no success page fires `purchase`)
 *
 * Double counting: Stripe checkout routes stamp the buyer's `_ga` client id
 * into the session metadata as `ga_client_id`. The webhook skips the
 * server-side event for consumer purchases that carry it, because the
 * browser's success page already sent `purchase`. transaction_id always
 * matches what the browser would send, so GA dedupes the rare overlap.
 *
 * Payload is minimal and pseudonymous: client id (the buyer's own GA id, or a
 * random one), transaction id, value, currency, items. No user_id, no email.
 *
 * Nothing is sent until GA4_MP_API_SECRET is set (GA4 Admin > Data streams >
 * Measurement Protocol API secrets). Never throws; never blocks a grant.
 */

const GA4_MEASUREMENT_ID = 'G-YLC2FKKBGC'
const GA4_MP_ENDPOINT = 'https://www.google-analytics.com/mp/collect'
const TIMEOUT_MS = 3000

export type Ga4PurchaseSource = 'stripe' | 'stripe_org' | 'apple' | 'google_play'

export interface Ga4Item {
  item_id: string
  item_name: string
  price?: number
  quantity?: number
}

export interface Ga4PurchaseInput {
  /** The buyer's GA client id (from the `_ga` cookie), when known. */
  clientId?: string | null
  transactionId: string
  /** Omitted from the event when undefined. */
  value?: number
  currency?: string
  items: Ga4Item[]
  source: Ga4PurchaseSource
}

let warnedMissingSecret = false

/** GA's own client id shape: random 31-bit int + "." + unix seconds. */
function randomClientId(): string {
  const rand = Math.floor(Math.random() * 2147483647) + 1
  return `${rand}.${Math.floor(Date.now() / 1000)}`
}

/**
 * Client id from a `_ga` cookie value: "GA1.1.123456789.1700000000" ->
 * "123456789.1700000000". Returns null for anything else.
 */
export function gaClientIdFromCookie(cookieValue: string | null | undefined): string | null {
  if (!cookieValue) return null
  const match = /^GA\d+\.\d+\.(\d+\.\d+)$/.exec(cookieValue.trim())
  return match ? match[1] : null
}

/**
 * Checkout-session metadata carrying the buyer's GA client id, or {} when the
 * request has no `_ga` cookie (analytics not accepted, so GA never ran).
 */
export function gaClientIdMetadata(request: {
  cookies: { get(name: string): { value: string } | undefined }
}): { ga_client_id?: string } {
  try {
    const clientId = gaClientIdFromCookie(request.cookies.get('_ga')?.value)
    return clientId ? { ga_client_id: clientId } : {}
  } catch {
    return {}
  }
}

/**
 * Send one GA4 `purchase` event. Never throws. Returns true when GA accepted
 * the request (the MP endpoint returns 2xx even for malformed events).
 */
export async function sendGa4Purchase(input: Ga4PurchaseInput): Promise<boolean> {
  try {
    const apiSecret = process.env.GA4_MP_API_SECRET
    if (!apiSecret) {
      if (!warnedMissingSecret) {
        warnedMissingSecret = true
        console.log('[ga4MP] GA4_MP_API_SECRET not set; server-side GA4 purchases disabled')
      }
      return false
    }
    if (!input.transactionId) return false

    const params: Record<string, unknown> = {
      transaction_id: input.transactionId,
      currency: (input.currency || 'USD').toUpperCase(),
      items: input.items,
      engagement_time_msec: 1,
      purchase_source: input.source,
    }
    if (typeof input.value === 'number' && Number.isFinite(input.value)) {
      params.value = Number(input.value.toFixed(2))
    }

    const body = {
      client_id: input.clientId || randomClientId(),
      non_personalized_ads: true,
      events: [{ name: 'purchase', params }],
    }

    const url = `${GA4_MP_ENDPOINT}?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${encodeURIComponent(apiSecret)}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {
        console.error('[ga4MP] purchase send failed:', res.status)
        return false
      }
      return true
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    console.error('[ga4MP] purchase send error:', e)
    return false
  }
}
