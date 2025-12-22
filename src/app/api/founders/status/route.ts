/**
 * Founder Status API
 * Check if user is a founder and get founder-related settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserCredits } from '@/lib/credits';
import { verifyAuth } from '@/lib/serverAuth';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;

    // Get user credits (includes founder fields)
    const credits = await getUserCredits(userId);

    if (!credits) {
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      isFounder: credits.is_founder,
      founderPurchasedAt: credits.founder_purchased_at,
      showFounderBadge: credits.show_founder_badge,
    });
  } catch (error) {
    console.error('Founder status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check founder status' },
      { status: 500 }
    );
  }
}
