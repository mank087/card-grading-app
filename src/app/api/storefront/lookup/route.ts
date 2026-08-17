import { NextRequest, NextResponse } from 'next/server';
import { lookupOrgSerial } from '@/app/enterprise/[slug]/data';
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rateLimit';

// Serial enumeration is feasible (sequential org/DCM serials), so this public
// endpoint is rate limited per IP: 10 lookups/min (in-memory sliding window,
// per Vercel instance — same tradeoff as the rest of src/lib/rateLimit.ts).
const LOOKUP_LIMIT = { maxRequests: 10, windowSeconds: 60 };

/** Public: find a card by serial within one org's publicly-visible grades. */
export async function GET(request: NextRequest) {
  const rl = checkRateLimit(`storefront-lookup:${getRateLimitIdentifier(null, request)}`, LOOKUP_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }
  const slug = request.nextUrl.searchParams.get('slug') || '';
  const serial = request.nextUrl.searchParams.get('serial') || '';
  if (!slug || !serial) return NextResponse.json({ error: 'slug and serial required' }, { status: 400 });
  const hit = await lookupOrgSerial(slug, serial);
  if (!hit) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ id: hit.id });
}
