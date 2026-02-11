/**
 * Affiliate Click Tracking API
 * POST: Records a click event for tracking (fire-and-forget from frontend)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAffiliateByCode, recordClick, hashIP } from '@/lib/affiliates';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, landing_page } = body;

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }

    const affiliate = await getAffiliateByCode(code);
    if (!affiliate || affiliate.status !== 'active') {
      return NextResponse.json({ error: 'Invalid code' }, { status: 404 });
    }

    // Hash IP for privacy-safe fraud detection
    const rawIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const ipHash = hashIP(rawIP);

    const userAgent = request.headers.get('user-agent') || null;

    await recordClick(affiliate.id, ipHash, userAgent, landing_page || null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording affiliate click:', error);
    // Return success anyway — click tracking is fire-and-forget
    return NextResponse.json({ success: true });
  }
}
