/** Shared decisions for full-page navigation and SPA messages from embedded pages. */
export function isAppOrigin(raw: string, base: string): boolean {
  try {
    const url = new URL(raw)
    const origin = new URL(base).origin
    return !url.username && !url.password && (url.origin === origin ||
      (['https://dcmgrading.com', 'https://www.dcmgrading.com'].includes(origin) &&
        ['https://dcmgrading.com', 'https://www.dcmgrading.com'].includes(url.origin)))
  } catch { return false }
}

export type EmbeddedDestination = { kind: 'web' | 'external' | 'blocked'; url: string } | { kind: 'native'; href: string }
export function embeddedDestination(raw: string, base: string, platform: string, signedIn: boolean): EmbeddedDestination {
  let url: URL
  try { url = new URL(raw, base) } catch { return { kind: 'blocked', url: raw } }
  if (url.username || url.password || !['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) return { kind: 'blocked', url: raw }
  if (!isAppOrigin(url.href, base)) {
    const stripe = ['checkout.stripe.com', 'billing.stripe.com', 'hooks.stripe.com'].includes(url.hostname)
    if (platform === 'ios' && /(^|\.)(stripe\.com|stripe\.link|link\.com)$/.test(url.hostname)) return { kind: 'native', href: '/pages/credits' }
    if (stripe && platform === 'android' && url.protocol === 'https:') return { kind: 'web', url: url.href }
    return { kind: 'external', url: url.href }
  }
  const path = url.pathname.replace(/\/$/, '') || '/'
  const purchases: Record<string, string> = { '/credits': '/pages/credits', '/vip': '/pages/vip', '/card-lovers': '/pages/card-lovers' }
  if (platform === 'ios' && purchases[path]) return { kind: 'native', href: purchases[path] }
  if (path === '/login' || path === '/register') return { kind: 'native', href: `/(auth)${path}${url.search}` }
  if (path === '/upload') return { kind: 'native', href: '/(tabs)/grade' }
  if (path === '/collection' && signedIn) return { kind: 'native', href: '/(tabs)/collection' }
  const card = path.match(/^\/(?:card|sports|pokemon|mtg|lorcana|onepiece|yugioh|starwars|other)\/([0-9a-f-]{36})$/i)
  if (card && signedIn) return { kind: 'native', href: `/card/${card[1]}` }
  return { kind: 'web', url: url.href }
}

export function isPublicAppPath(path: string): boolean {
  return /^\/(?:card|sports|pokemon|mtg|lorcana|onepiece|yugioh|starwars|other)\/[0-9a-f-]{36}\/?$/i.test(path) ||
    /^\/collection\/[a-z0-9-]+\/?$/i.test(path) || /^\/verify\/[^/]+\/?$/.test(path) ||
    ['/reset-password', '/terms', '/privacy', '/pages/terms', '/pages/privacy', '/search', '/pages/search'].includes(path)
}

/** Do not infer an expiry or inject credentials on third-party checkout/OAuth pages. */
export function sessionInjection(base: string, session: unknown): string {
  const origin = new URL(base).origin
  const origins = ['https://dcmgrading.com', 'https://www.dcmgrading.com'].includes(origin)
    ? ['https://dcmgrading.com', 'https://www.dcmgrading.com'] : [origin]
  return `(function(){if(${JSON.stringify(origins)}.indexOf(location.origin)<0)return;
    window.__dcmNativeBridge=1; window.__dcmApplyingSession=true;
    var next=${JSON.stringify(session)}; var value=next?JSON.stringify(next):null;
    var old=localStorage.getItem('supabase.auth.token'); var prior=null;
    try { prior=JSON.parse(old); } catch(e) {}
    if(!next || !prior || !prior.user || prior.user.id!==next.user.id) {
      Object.keys(localStorage).forEach(function(key){if(/^sb-.*-auth-token(?:-code-verifier)?$/.test(key))localStorage.removeItem(key);});
    }
    if(value) localStorage.setItem('supabase.auth.token',value); else localStorage.removeItem('supabase.auth.token');
    if(old!==value) window.dispatchEvent(new Event('dcm-auth-state-change'));
    window.dispatchEvent(new Event('dcm-native-session'));
    window.__dcmApplyingSession=false;
  })(); true;`
}
