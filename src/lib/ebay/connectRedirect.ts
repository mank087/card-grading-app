/**
 * Where `EbayListingButton` sends a seller who has not connected eBay yet.
 *
 * WHY IT IS ITS OWN FUNCTION (review 2026-09-22, finding 2). The button built
 * the return destination inline as `pathname + search`, which DROPPED the
 * fragment. On the card-detail V2 page the fragment IS the destination: the
 * InstaList tab lives at `#instalist`, so a seller who pressed "Connect eBay to
 * continue" from that tab came back to the Overview tab and had to find their
 * way there again.
 *
 * THE ROUND TRIP, verified end to end in the code:
 *   1. here — `/ebay/connect?redirect=` + encodeURIComponent('/pokemon/ID#instalist'),
 *      so the '#' travels as %23 and stays inside the query value;
 *   2. `/ebay/connect` reads it with `searchParams.get('redirect')` (decoded)
 *      and re-encodes it into `/api/ebay/auth?return_url=…`;
 *   3. `/api/ebay/auth` runs `sanitizeReturnUrl` — which only requires a leading
 *      '/' and rejects '//' and '/\' — and signs it into the OAuth state;
 *   4. `/api/ebay/callback` verifies the state and builds
 *      `new URL(returnUrl, baseUrl)`, then `searchParams.set('ebay_connected'…)`.
 *      `URL.toString()` serialises the query BEFORE the fragment, so the seller
 *      lands on `/pokemon/ID?ebay_connected=true&ebay_username=…#instalist`.
 * No change was needed in either route: the fragment survives untouched. The
 * only reason it never arrived is that the button never sent one.
 *
 * WHAT THIS DOES NOT DO: it does not carry the draft. The draft is React state
 * and a full-page redirect ends the session that holds it — which is why the
 * InstaList tab now asks a disconnected seller to connect BEFORE it unlocks the
 * fields, rather than letting them type into something a redirect will discard.
 *
 * Pure. No DOM; the caller reads `window.location` and passes the three parts.
 */

export interface ConnectRedirectLocation {
  /** `window.location.pathname` */
  pathname: string;
  /** `window.location.search` — '' or '?a=b' */
  search?: string;
  /** `window.location.hash` — '' or '#instalist' */
  hash?: string;
}

/**
 * The path the seller should be returned to after connecting: everything about
 * where they are standing that a URL can carry.
 */
export function connectReturnPath(location: ConnectRedirectLocation): string {
  const pathname = location.pathname || '/';
  const search = location.search ?? '';
  const hash = location.hash ?? '';
  return `${pathname}${search}${hash}`;
}

/** The full `/ebay/connect` href, with the return path encoded into it. */
export function buildEbayConnectHref(location: ConnectRedirectLocation): string {
  return `/ebay/connect?redirect=${encodeURIComponent(connectReturnPath(location))}`;
}

export default buildEbayConnectHref;
