/**
 * First-party ad click-ID capture (2026-09-11).
 *
 * Google (gclid / gbraid / wbraid), Microsoft (msclkid) and Meta (fbclid)
 * append a click ID to the landing URL of every paid click. Keeping it first-party lets us
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
 *
 * Meta (2026-10-22): an fbclid is also stored as `fbc` in Meta's format
 * (fb.1.<capture ms>.<fbclid>), and the Meta pixel's own `_fbp` browser id is
 * read at sync time when present. `_fbp` only exists once the pixel loaded,
 * which ConsentManager does only after Accept, so it adds no new gate.
 */

export const CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid', 'msclkid', 'fbclid'] as const
export type ClickIdKey = (typeof CLICK_ID_PARAMS)[number]
export type ClickIds = Partial<Record<ClickIdKey, string>> & { fbc?: string; fbp?: string; landing?: string; captured_at?: string }

const COOKIE_PREFIX = 'dcm_'
const MAX_AGE_DAYS = 90
const MAX_LEN = 200
// fbclids are longer than Google/Microsoft ids and keep growing.
const FB_MAX_LEN = 500
const ID_CHARS = /^[A-Za-z0-9_.-]+$/

/** Meta's fbc format: fb.<subdomain index 1>.<unix ms at capture>.<fbclid>. */
export function deriveFbc(fbclid: string, capturedAtMs: number): string {
  return `fb.1.${Math.floor(capturedAtMs)}.${fbclid}`
}

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
      if (v && ID_CHARS.test(v) && v.length <= (key === 'fbclid' ? FB_MAX_LEN : MAX_LEN)) {
        found[key] = v
        setCookie(COOKIE_PREFIX + key, v)
      }
    }
    if (found.fbclid) {
      found.fbc = deriveFbc(found.fbclid, Date.now())
      setCookie(COOKIE_PREFIX + 'fbc', found.fbc)
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
    // Our derived fbc first; the pixel's own _fbc cookie as a fallback.
    const fbc = readCookie(COOKIE_PREFIX + 'fbc') || readCookie('_fbc')
    if (fbc && ID_CHARS.test(fbc) && fbc.length <= FB_MAX_LEN) out.fbc = fbc
    const fbp = readCookie('_fbp')
    if (fbp && ID_CHARS.test(fbp) && fbp.length <= MAX_LEN) out.fbp = fbp
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
  return CLICK_ID_PARAMS.some((k) => !!ids[k]) || !!ids.fbc || !!ids.fbp
}

/**
 * Opt-out clears everything we captured, in the browser and, for a signed-in
 * visitor, on the profile too (so the server-side upload job stops).
 */
export function clearClickIds() {
  try {
    for (const key of [...CLICK_ID_PARAMS, 'fbc', 'click_meta']) {
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
 * server can attribute later purchases. Fire-and-forget; never throws or
 * rejects. The returned promise settles once the write finished (or was
 * skipped), so a caller can enqueue a server-side registration after it.
 */
export function syncClickIdsToProfile(accessToken: string | null | undefined, extra?: { consent?: string; region?: string }): Promise<void> {
  try {
    if (!accessToken) return Promise.resolve()
    const ids = readClickIds()
    if (!hasClickIds(ids)) return Promise.resolve()
    const marker = 'dcm_click_ids_synced'
    const fingerprint = [...CLICK_ID_PARAMS.map((k) => ids[k] || ''), ids.fbc || '', ids.fbp || ''].join('|')
    if (localStorage.getItem(marker) === fingerprint) return Promise.resolve()
    return fetch('/api/account/click-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ...ids, ...extra }),
      keepalive: true,
    })
      .then((r) => { if (r.ok) localStorage.setItem(marker, fingerprint) })
      .catch(() => { })
  } catch { return Promise.resolve() }
}
