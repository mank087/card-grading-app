import { NextRequest, NextResponse } from 'next/server';
// Edge runtime: orgSlugs is dependency-free pure constants, safe to import here.
import { RESERVED_SLUGS, SLUG_RE } from '@/lib/orgSlugs';
import { REGION_COOKIE, parseRegion, regionForCountry } from '@/lib/consentRegion';

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
 *
 * Consent region (2026-09-11): every response also carries the `dcm_region`
 * cookie (eu / us / other / unknown) derived from Vercel's edge geolocation
 * header, so the consent banner can pick the GDPR opt-in regime or the US
 * regime client-side. Set once, refreshed only if the stored value is
 * malformed; the bucket never contains the raw country.
 */

// Subdomains that must never resolve to a storefront: the shared canonical
// reserved-slug list (src/lib/orgSlugs.ts) — same set slug creation enforces.
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
  if (RESERVED_SLUGS.has(sub) || !SLUG_RE.test(sub)) return null;
  return sub;
}

function withRegionCookie(request: NextRequest, response: NextResponse): NextResponse {
  const existing = request.cookies.get(REGION_COOKIE)?.value;
  // A valid bucket is sticky for the year; "unknown" is retried on every
  // request so a transient geo miss does not pin a visitor to the strict
  // regime for a year.
  if (existing && parseRegion(existing) !== 'unknown') return response;
  const country = request.headers.get('x-vercel-ip-country');
  const region = regionForCountry(country);
  if (region === 'unknown' && existing === 'unknown') return response;
  response.cookies.set(REGION_COOKIE, region, {
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
    sameSite: 'lax',
    // Readable by the consent banner on the client; carries no PII.
    httpOnly: false,
  });
  return response;
}

export function middleware(request: NextRequest) {
  const slug = storefrontSlug(request.headers.get('host'));
  if (!slug) return withRegionCookie(request, NextResponse.next());

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
