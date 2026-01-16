/**
 * eBay Promoted Listings Eligibility API
 *
 * GET /api/ebay/promotion/eligibility
 * Check if the user is eligible for Promoted Listings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getConnectionForUser, refreshTokenIfNeeded } from '@/lib/ebay/auth';
import { getAdvertisingEligibility, getTrendingAdRate } from '@/lib/ebay/marketingApi';
import { MARKETING_SCOPE } from '@/lib/ebay/constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const supabase = getAdminClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Get eBay connection
    let connection = await getConnectionForUser(user.id);
    if (!connection) {
      return NextResponse.json({
        eligible: false,
        reason: 'No eBay account connected',
        needsReauth: false,
      });
    }

    // Check if user has marketing scope
    const hasMarketingScope = connection.scopes?.includes(MARKETING_SCOPE);
    if (!hasMarketingScope) {
      return NextResponse.json({
        eligible: false,
        reason: 'Please reconnect your eBay account to enable Promoted Listings.',
        needsReauth: true,
      });
    }

    // Refresh token if needed
    connection = await refreshTokenIfNeeded(connection);
    if (!connection) {
      return NextResponse.json({
        eligible: false,
        reason: 'Failed to refresh eBay authorization. Please reconnect your account.',
        needsReauth: true,
      });
    }

    // Check advertising eligibility
    const eligibility = await getAdvertisingEligibility(
      connection.access_token,
      connection.is_sandbox
    );

    // Get category ID from query params for trending rate
    const categoryId = request.nextUrl.searchParams.get('categoryId') || '183454';
    const trendingRate = await getTrendingAdRate(
      connection.access_token,
      categoryId,
      connection.is_sandbox
    );

    return NextResponse.json({
      eligible: eligibility.eligible,
      reason: eligibility.reason,
      reasonCode: eligibility.reasonCode,
      suggestedRate: trendingRate,
      needsReauth: false,
    });
  } catch (error) {
    console.error('[Promotion Eligibility] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
