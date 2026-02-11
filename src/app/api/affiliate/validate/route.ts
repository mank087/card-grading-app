/**
 * Affiliate Code Validation API
 * GET: Validates a referral code exists and is active
 * Public endpoint (no auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAffiliateByCode } from '@/lib/affiliates';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ valid: false, error: 'code parameter is required' }, { status: 400 });
    }

    const affiliate = await getAffiliateByCode(code);

    if (!affiliate || affiliate.status !== 'active') {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: true,
      code: affiliate.code,
      name: affiliate.name,
    });
  } catch (error) {
    console.error('Error validating affiliate code:', error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
