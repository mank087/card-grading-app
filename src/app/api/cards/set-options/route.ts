/**
 * GET /api/cards/set-options?category=Pokemon
 * Set names (with release year) from DCM's internal card databases, for the
 * confirmation dialog's Set field. Public catalog data, cacheable.
 */
import { NextRequest, NextResponse } from 'next/server';
import { loadSetOptions, setCatalogKey } from '@/lib/identity/setOptions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category');
  if (!setCatalogKey(category)) return NextResponse.json({ available: false, sets: [] });
  try {
    const sets = await loadSetOptions(category);
    return NextResponse.json({ available: sets.length > 0, sets }, { headers: { 'cache-control': 'public, max-age=3600, s-maxage=3600' } });
  } catch {
    return NextResponse.json({ available: false, sets: [] });
  }
}
