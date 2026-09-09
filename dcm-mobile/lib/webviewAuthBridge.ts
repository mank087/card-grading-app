/**
 * Auth hand-off for the hidden "bridge" WebViews (label-export,
 * label-preview, ebay-image-prep).
 *
 * TODAY these pages are opened with the Supabase access token in the URL
 * query string. A URL is the worst place for a bearer token: it lands in
 * WebView history, in any redirect's Referer, in server access logs, and in
 * crash/breadcrumb reports.
 *
 * The web side does not accept postMessage auth yet, so this module ships
 * the safe half: the code path that never puts the token in the URL exists
 * and is exercised by the same call sites, behind a flag that is OFF.
 * Default behaviour is byte-for-byte what it was.
 *
 * ── WHAT THE WEB MUST IMPLEMENT before this flag can be flipped ──────────
 *
 * On /label-export/[id], /label-preview/[id] and /ebay-image-prep/[id]:
 *
 *   1. Render without a session when `?token=` is absent, instead of
 *      redirecting to sign-in or erroring. Show nothing / a spinner and
 *      wait — do not fetch card data yet.
 *   2. Listen for a message on `window`:
 *
 *        window.addEventListener('message', (e) => {
 *          let msg; try { msg = JSON.parse(e.data) } catch { return }
 *          if (msg?.type !== 'dcm-auth' || !msg.token) return
 *          // adopt the token for Supabase / API calls, then start the
 *          // normal render path
 *        })
 *
 *      React Native's injected `window.postMessage(json, '*')` arrives as a
 *      MessageEvent whose `.data` is that JSON string.
 *   3. Keep honouring `?token=` for at least one full release, so older
 *      installed binaries (which cannot be OTA'd past a native pin) keep
 *      working. Only after those age out should the query path be removed.
 *   4. Never echo the token back through postMessage or into the DOM.
 *
 * When all three pages do that, flip USE_POSTMESSAGE_BRIDGE to true and ship
 * it as an OTA update.
 */

/**
 * OFF by default. Flipping this to `true` stops sending `?token=` and sends
 * the token by postMessage after the page loads instead. Do not flip until
 * the web pages listed above accept `dcm-auth`.
 */
export const USE_POSTMESSAGE_BRIDGE = false

/**
 * The `token` query fragment for a bridge URL — `&token=…` today, and the
 * empty string once the postMessage path is enabled.
 *
 * Callers append this to a URL that already has at least one query
 * parameter (every bridge URL does).
 */
export function bridgeTokenParam(token: string | null | undefined): string {
  if (USE_POSTMESSAGE_BRIDGE) return ''
  if (!token) return ''
  return `&token=${encodeURIComponent(token)}`
}

/**
 * Same, for a URL where the token is the FIRST parameter (`?token=…`).
 * Returns '?' -prefixed text or '' so the caller can concatenate blindly.
 */
export function bridgeTokenFirstParam(token: string | null | undefined): string {
  if (USE_POSTMESSAGE_BRIDGE) return ''
  if (!token) return ''
  return `?token=${encodeURIComponent(token)}`
}

/**
 * JS to `injectJavaScript()` after `onLoadEnd`, handing the page its token
 * out-of-band. Returns null when the flag is off (nothing to inject) or
 * there is no token.
 *
 * The token is JSON-escaped into the script, never string-concatenated into
 * a URL, and the message is posted to the page's own window only.
 */
export function authBridgeInjection(token: string | null | undefined): string | null {
  if (!USE_POSTMESSAGE_BRIDGE || !token) return null
  const payload = JSON.stringify(JSON.stringify({ type: 'dcm-auth', token }))
  return `(function(){ try { window.postMessage(${payload}, '*'); } catch(e) {} })(); true;`
}
