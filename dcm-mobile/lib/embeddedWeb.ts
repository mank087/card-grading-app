import Constants from 'expo-constants'

/**
 * Contract between the native app and dcmgrading.com for embedded WebView pages.
 *
 * The web side detects the app in two ways:
 *   1. the WebView user agent contains `DCMGradingApp/<version>`
 *   2. the URL carries `?app=1`
 *
 * When it detects either, it sets `html[data-embedded="1"]` and tags every
 * piece of *global* chrome (site header, site nav, site footer, launch
 * banner, help bot) with a `data-site-chrome` attribute. In-content headers
 * and section navs deliberately do NOT get that attribute, so they survive.
 *
 * Older web deployments do neither. The app therefore keeps the legacy
 * blanket `header, nav, footer { display:none }` rule, but applies it ONLY
 * when `data-embedded` is absent — see InAppPage's injected script.
 */

/** App version, read at runtime from the Expo config (never hardcoded). */
export const APP_VERSION: string =
  (Constants.expoConfig?.version as string | undefined) ??
  ((Constants as any).manifest?.version as string | undefined) ??
  '0.0.0'

/**
 * Appended to the WebView's *default* user agent via the WebView
 * `applicationNameForUserAgent` prop (both iOS and Android append it to the
 * platform UA rather than replacing it, which is what the web sniff needs).
 */
export const APP_USER_AGENT_SUFFIX = `DCMGradingApp/${APP_VERSION}`

/**
 * Adds `app=1` (and the app version, for web-side debugging) to a DCM URL,
 * preserving any query string / hash the caller already built.
 */
export function withEmbeddedParams(rawUrl: string): string {
  const hashIndex = rawUrl.indexOf('#')
  const hash = hashIndex >= 0 ? rawUrl.slice(hashIndex) : ''
  const base = hashIndex >= 0 ? rawUrl.slice(0, hashIndex) : rawUrl

  if (/[?&]app=1(&|$)/.test(base)) return rawUrl

  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}app=1&appVersion=${encodeURIComponent(APP_VERSION)}${hash}`
}
