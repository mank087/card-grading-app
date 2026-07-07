/**
 * Shared eBay OAuth WebView navigation classifier.
 *
 * Both the listing wizard (app/pages/ebay-list.tsx) and the InstaList
 * Marketplace tab (app/(tabs)/instalist-marketplace.tsx) drive the same
 * server OAuth flow through a native WebView modal. The navigation-state
 * handling is subtle: the flow passes through an intermediate
 * /api/ebay/callback hop, failures are reported as query params ON the
 * success URL (ebay_error= / ebay_connected=false), and a consent-screen
 * denial surfaces as error=access_denied on an eBay URL. The two screens
 * diverged once already — keep the logic here so they can't again.
 */

export type EbayOAuthNavResult =
  /** Still mid-flow (eBay pages, the /api/ebay/callback hop, etc.) — do nothing. */
  | { type: 'pending' }
  /** Landed on /ebay-auth-success with no error params — connection saved server-side. */
  | { type: 'success' }
  /** Landed on /ebay-auth-success but the server reported a failure. */
  | { type: 'failure'; message: string }
  /** User denied at the eBay consent screen. */
  | { type: 'cancelled' }

export function classifyEbayOAuthNavigation(url: string): EbayOAuthNavResult {
  // Only react to the FINAL success page, not the intermediate /api/ebay/callback
  // hop — the server needs that hop to exchange the code for tokens and save the
  // connection before redirecting to /ebay-auth-success?ebay_connected=true.
  if (url.includes('/ebay-auth-success')) {
    if (url.includes('ebay_error=') || url.includes('ebay_connected=false')) {
      let message = 'eBay connection failed.'
      try {
        message = new URL(url).searchParams.get('message') || message
      } catch {}
      return { type: 'failure', message }
    }
    return { type: 'success' }
  }
  // User denied at the eBay consent screen
  if (url.includes('error=access_denied')) {
    return { type: 'cancelled' }
  }
  return { type: 'pending' }
}
