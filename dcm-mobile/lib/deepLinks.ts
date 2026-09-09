import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * ONE place that turns an incoming URL (universal link, App Link,
 * `dcmgrading://` scheme link, QR code on a slab) into an in-app route, and
 * ONE place that remembers where a signed-out user was trying to go.
 *
 * Previously `+not-found.tsx` did its own regex on `usePathname()` and
 * dropped every query parameter, and a card link opened while signed out
 * landed on the welcome carousel with no way back to the card.
 */

/**
 * Card-type path segments mirrored from the website's URL scheme. Keep in
 * sync with `src/app/(<cardType>)/[id]/page.tsx` route folders on the web.
 */
export const CARD_TYPE_PATHS = new Set([
  'sports', 'pokemon', 'mtg', 'lorcana', 'onepiece', 'yugioh', 'starwars', 'other',
])

/** Web paths that have a dedicated native screen under `app/pages/`. */
const NATIVE_PAGE_ROUTES: Record<string, string> = {
  '/credits': '/pages/credits',
  '/card-lovers': '/pages/card-lovers',
  '/vip': '/pages/vip',
  '/account': '/pages/my-account',
  '/label-studio': '/pages/label-studio',
  '/market-pricing': '/pages/market-pricing',
  '/terms': '/pages/terms',
  '/privacy': '/pages/privacy',
}

export type DeepLinkKind = 'card' | 'native-page' | 'embedded-web' | 'home'

export interface ResolvedDeepLink {
  kind: DeepLinkKind
  /** Route to navigate to (expo-router href), query string preserved. */
  href: string
  /** Path without query/hash, normalised with a leading slash. */
  path: string
  /** The original query string including '?', or '' when there was none. */
  search: string
}

/** Split a raw URL or path into `{ path, search }`, dropping origin + hash. */
export function splitUrl(raw: string): { path: string; search: string } {
  if (!raw) return { path: '/', search: '' }
  let rest = raw

  // Strip a scheme + host: https://dcmgrading.com/x, dcmgrading://x
  const schemeMatch = rest.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)(.*)$/i)
  if (schemeMatch) rest = schemeMatch[2] || '/'

  const hashIndex = rest.indexOf('#')
  if (hashIndex >= 0) rest = rest.slice(0, hashIndex)

  const qIndex = rest.indexOf('?')
  const path = (qIndex >= 0 ? rest.slice(0, qIndex) : rest) || '/'
  const search = qIndex >= 0 ? rest.slice(qIndex) : ''

  return { path: path.startsWith('/') ? path : `/${path}`, search }
}

/**
 * Resolve an incoming URL/path to an in-app destination.
 *
 * Query parameters are always carried through — several web destinations
 * (search, pop report filters, label previews) are meaningless without them.
 */
export function resolveDeepLink(raw: string): ResolvedDeepLink {
  const { path, search } = splitUrl(raw)

  if (!path || path === '/' || path === '/+not-found') {
    return { kind: 'home', href: '/', path, search }
  }

  // /<cardType>/<id> and /card/<id> both open the native report.
  const cardMatch = path.match(/^\/([a-z]+)\/([0-9a-f-]{8,})$/i)
  if (cardMatch) {
    const seg = cardMatch[1].toLowerCase()
    if (seg === 'card' || CARD_TYPE_PATHS.has(seg)) {
      return { kind: 'card', href: `/card/${cardMatch[2]}${search}`, path, search }
    }
  }

  const nativePage = NATIVE_PAGE_ROUTES[path]
  if (nativePage) {
    return { kind: 'native-page', href: `${nativePage}${search}`, path, search }
  }

  // Everything else renders the web page inside the app shell.
  return { kind: 'embedded-web', href: `${path}${search}`, path, search }
}

// ---------------------------------------------------------------------------
// Pending redirect (login return path)
// ---------------------------------------------------------------------------

const PENDING_KEY = 'dcm_pending_redirect'

/** In-memory copy so the post-login redirect doesn't wait on disk. */
let pending: string | null = null

/** Routes we must never bounce back to after signing in. */
function isReturnable(href: string): boolean {
  if (!href || !href.startsWith('/')) return false
  if (href === '/' || href.startsWith('/+not-found')) return false
  if (href.startsWith('/(auth)') || href.startsWith('/(tabs)')) return false
  return true
}

/** Remember where the user was heading before we asked them to sign in. */
export function setPendingRedirect(href: string | null | undefined) {
  if (!href || !isReturnable(href)) return
  pending = href
  AsyncStorage.setItem(PENDING_KEY, href).catch(() => {})
}

/** Read + clear the pending destination. Returns null when there is none. */
export function consumePendingRedirect(): string | null {
  const value = pending
  pending = null
  AsyncStorage.removeItem(PENDING_KEY).catch(() => {})
  return value
}

/** Peek without clearing. */
export function peekPendingRedirect(): string | null {
  return pending
}

/** Restore the pending destination from disk (cold start after a link tap). */
export async function hydratePendingRedirect(): Promise<string | null> {
  if (pending) return pending
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY)
    if (raw && isReturnable(raw)) pending = raw
  } catch {}
  return pending
}
