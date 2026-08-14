/**
 * Client-side mirror of the storefront host detection in src/middleware.ts.
 * Used by the global chrome (Navigation/Footer/ConsentManager) to stand down
 * on tenant subdomains, where the browser pathname is '/' even though the
 * request was rewritten to /storefront/{slug}.
 */

const RESERVED = new Set(['www', 'api', 'app', 'admin', 'mail', 'staging', 'dev', 'cdn', 'assets']);
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

export function isStorefrontHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  let sub: string | null = null;
  if (host.endsWith('.dcmgrading.com')) sub = host.slice(0, -'.dcmgrading.com'.length);
  else if (host.endsWith('.localhost')) sub = host.slice(0, -'.localhost'.length);
  if (!sub || sub.includes('.')) return false;
  return !RESERVED.has(sub) && SLUG_RE.test(sub);
}

/**
 * True for org Enterprise Page paths (/enterprise/{slug}/...), which bring
 * their own chrome. The /enterprise MARKETING pages (root + static children)
 * keep the normal DCM chrome. Legacy /storefront/ paths count too (they
 * redirect, but the chrome check runs before navigation settles).
 */
const ENTERPRISE_STATIC_CHILDREN = new Set(['apply', 'terms', 'launch-kit']);

export function isOrgPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/storefront/') || pathname === '/storefront') return true;
  if (!pathname.startsWith('/enterprise/')) return false;
  const first = pathname.slice('/enterprise/'.length).split('/')[0];
  return first.length > 0 && !ENTERPRISE_STATIC_CHILDREN.has(first);
}
