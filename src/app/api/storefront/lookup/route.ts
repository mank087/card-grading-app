import { NextRequest, NextResponse } from 'next/server';
import { lookupOrgSerial } from '@/app/enterprise/[slug]/data';

/** Public: find a card by serial within one org's publicly-visible grades. */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug') || '';
  const serial = request.nextUrl.searchParams.get('serial') || '';
  if (!slug || !serial) return NextResponse.json({ error: 'slug and serial required' }, { status: 400 });
  const hit = await lookupOrgSerial(slug, serial);
  if (!hit) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ id: hit.id });
}
