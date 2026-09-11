/**
 * Consent region resolution (2026-09-11).
 *
 * The consent banner runs in one of two regimes depending on where the
 * visitor is:
 *
 *   strict     Opt-in. Nothing non-essential loads until the visitor accepts.
 *              Used for the EEA, UK and Switzerland (GDPR + ePrivacy), for any
 *              country we cannot identify, and for every visitor sending a
 *              Global Privacy Control signal. This is the behavior the whole
 *              site has had since July 2026.
 *
 *   us-optout  Notice-and-opt-out. Only ever used for visitors resolved to the
 *              United States AND only when NEXT_PUBLIC_CONSENT_US_OPTOUT=1.
 *              With the flag unset every US visitor gets `strict`, so flipping
 *              the flag is the single switch counsel controls.
 *
 * The country comes from Vercel's edge geolocation, stamped into the
 * `dcm_region` cookie by src/middleware.ts on the first request. It is a
 * coarse bucket (eu / us / other / unknown), never the raw country, so the
 * cookie itself carries no meaningful personal data.
 */

export const REGION_COOKIE = 'dcm_region'

export type ConsentRegion = 'eu' | 'us' | 'other' | 'unknown'
export type ConsentMode = 'strict' | 'us-optout'

/** EEA (27 EU members + Iceland, Liechtenstein, Norway) plus the UK and Switzerland. */
const GDPR_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
  'GB', 'CH',
])

export function regionForCountry(countryCode: string | null | undefined): ConsentRegion {
  const cc = (countryCode || '').toUpperCase()
  if (!cc) return 'unknown'
  if (cc === 'US') return 'us'
  if (GDPR_COUNTRIES.has(cc)) return 'eu'
  return 'other'
}

export function parseRegion(value: string | null | undefined): ConsentRegion {
  if (value === 'eu' || value === 'us' || value === 'other') return value
  return 'unknown'
}

/** Client-side: read the region bucket the middleware stamped. */
export function readRegionCookie(): ConsentRegion {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + REGION_COOKIE + '=([^;]*)'))
    return parseRegion(m ? decodeURIComponent(m[1]) : null)
  } catch {
    return 'unknown'
  }
}

/** The counsel-controlled switch. Unset or anything but "1" means strict everywhere. */
export function usOptOutEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CONSENT_US_OPTOUT === '1'
}

export function consentModeFor(region: ConsentRegion, gpc: boolean): ConsentMode {
  if (gpc) return 'strict'
  if (region === 'us' && usOptOutEnabled()) return 'us-optout'
  return 'strict'
}
