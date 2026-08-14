import { NextRequest, NextResponse } from 'next/server';

/**
 * Tenant subdomain routing (Enterprise Pages, Phase 2A).
 *
 * {slug}.dcmgrading.com/* rewrites to /enterprise/{slug}/* — the same routes
 * are directly reachable at dcmgrading.com/enterprise/{slug} (used for local
 * testing and as the pre-DNS fallback), so this middleware is pure routing
 * sugar with no rendering logic of its own. Legacy /storefront/{slug} URLs
 * (printed QR codes) 308-redirect via src/app/storefront/[...path]/route.ts.
 *
 * Local testing: http://manifold.localhost:3000 works in Chromium browsers
 * without any hosts-file changes.
 */

// Subdomains that must never resolve to a storefront
const RESERVED = new Set(['www', 'api', 'app', 'admin', 'mail', 'staging', 'dev', 'cdn', 'assets']);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

function storefrontSlug(hostHeader: string | null): string | null {
  if (!hostHeader) return null;
  const host = hostHeader.toLowerCase().split(':')[0];
  let sub: string | null = null;
  if (host.endsWith('.dcmgrading.com')) {
    sub = host.slice(0, -'.dcmgrading.com'.length);
  } else if (host.endsWith('.localhost')) {
    sub = host.slice(0, -'.localhost'.length);
  }
  if (!sub || sub.includes('.')) return null; // no nested subdomains
  if (RESERVED.has(sub) || !SLUG_RE.test(sub)) return null;
  return sub;
}

export function middleware(request: NextRequest) {
  const slug = storefrontSlug(request.headers.get('host'));
  if (!slug) return NextResponse.next();

  const { pathname } = request.nextUrl;
  // API + Next internals + files pass through untouched on the subdomain
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }
  // Already-rewritten (or hand-typed) org-page paths pass through; legacy
  // /storefront/ paths fall to the redirect route.
  if (pathname.startsWith('/enterprise/') || pathname.startsWith('/storefront/')) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/enterprise/${slug}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip static assets entirely
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
