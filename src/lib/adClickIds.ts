/**
 * First-party ad click-ID capture (2026-09-11).
 *
 * Google (gclid / gbraid / wbraid) and Microsoft (msclkid) append a click ID
 * to the landing URL of every paid click. Keeping it first-party lets us
 * report conversions server-side later (Stripe webhook, in-app purchases)
 * instead of relying on a client-side pixel firing on the success page.
 *
 * Nothing here talks to a third party. Storage is still gated on the consent
 * regime, because under ePrivacy even a first-party cookie set for ad
 * measurement is non-essential:
 *   - us-optout mode: capture immediately (the visitor can opt out later,
 *     which clears the cookies).
 *   - strict mode: capture only once the visitor has accepted. The IDs are
 *     re-read from the URL at that moment, so a same-page acceptance still
 *     attributes; a later-page acceptance does not, by design.
 */

export const CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid', 'msclkid'] as const
export type ClickIdKey = (typeof CLICK_ID_PARAMS)[number]
export type ClickIds = Partial<Record<ClickIdKey, string>> & { landing?: string; captured_at?: string }

const COOKIE_PREFIX = 'dcm_'
const MAX_AGE_DAYS = 90
const MAX_LEN = 200

function setCookie(name: string, value: string) {
  const expires = new Date(Date.now() + MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

/** Pull any click IDs off the current URL into first-party cookies. */
export function captureClickIdsFromUrl(): ClickIds {
  const found: ClickIds = {}
  try {
    const params = new URLSearchParams(window.location.search)
    for (const key of CLICK_ID_PARAMS) {
      const v = params.get(key)
      if (v && /^[A-Za-z0-9_.-]+$/.test(v) && v.length <= MAX_LEN) {
        found[key] = v
        setCookie(COOKIE_PREFIX + key, v)
      }
    }
    if (Object.keys(found).length) {
      const meta = { landing: window.location.pathname, captured_at: new Date().toISOString() }
      setCookie(COOKIE_PREFIX + 'click_meta', JSON.stringify(meta))
      found.landing = meta.landing
      found.captured_at = meta.captured_at
    }
  } catch { /* storage unavailable */ }
  return found
}

/** Read whatever click IDs are stored for this browser. */
export function readClickIds(): ClickIds {
  const out: ClickIds = {}
  try {
    for (const key of CLICK_ID_PARAMS) {
      const v = readCookie(COOKIE_PREFIX + key)
      if (v) out[key] = v
    }
    const meta = readCookie(COOKIE_PREFIX + 'click_meta')
    if (meta) {
      try {
        const parsed = JSON.parse(meta)
        if (typeof parsed?.landing === 'string') out.landing = parsed.landing
        if (typeof parsed?.captured_at === 'string') out.captured_at = parsed.captured_at
      } catch { /* ignore */ }
    }
  } catch { /* storage unavailable */ }
  return out
}

export function hasClickIds(ids: ClickIds): boolean {
  return CLICK_ID_PARAMS.some((k) => !!ids[k])
}

/**
 * Opt-out clears everything we captured, in the browser and, for a signed-in
 * visitor, on the profile too (so the server-side upload job stops).
 */
export function clearClickIds() {
  try {
    for (const key of [...CLICK_ID_PARAMS, 'click_meta']) {
      document.cookie = `${COOKIE_PREFIX}${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`
    }
    localStorage.removeItem('dcm_click_ids_synced')
  } catch { /* ignore */ }
  try {
    // Session shape written by src/lib/directAuth.ts; read defensively so the
    // consent flow never depends on the auth module.
    const raw = localStorage.getItem('supabase.auth.token')
    const token = raw ? (JSON.parse(raw)?.access_token as string | undefined) : undefined
    if (token) {
      fetch('/api/account/click-ids', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, keepalive: true }).catch(() => { })
    }
  } catch { /* ignore */ }
}

/**
 * Persist the stored click IDs onto the signed-in user's profile so the
 * server can attribute later purchases. Fire-and-forget; never throws.
 */
export function syncClickIdsToProfile(accessToken: string | null | undefined, extra?: { consent?: string; region?: string }) {
  try {
    if (!accessToken) return
    const ids = readClickIds()
    if (!hasClickIds(ids)) return
    const marker = 'dcm_click_ids_synced'
    const fingerprint = CLICK_ID_PARAMS.map((k) => ids[k] || '').join('|')
    if (localStorage.getItem(marker) === fingerprint) return
    fetch('/api/account/click-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ...ids, ...extra }),
      keepalive: true,
    })
      .then((r) => { if (r.ok) localStorage.setItem(marker, fingerprint) })
      .catch(() => { })
  } catch { /* ignore */ }
}
