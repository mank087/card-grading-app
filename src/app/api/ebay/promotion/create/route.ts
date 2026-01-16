/**
 * eBay Promoted Listings Create API
 *
 * POST /api/ebay/promotion/create
 * Create a Promoted Listing for a published eBay listing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getConnectionForUser, refreshTokenIfNeeded } from '@/lib/ebay/auth';
import { promoteListing } from '@/lib/ebay/marketingApi';
import { MARKETING_SCOPE } from '@/lib/ebay/constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

interface CreatePromotionRequest {
  listingId: string;
  bidPercentage: number;
}

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body: CreatePromotionRequest = await request.json();
    const { listingId, bidPercentage } = body;

    // Validate
    if (!listingId) {
      return NextResponse.json(
        { error: 'listingId is required' },
        { status: 400 }
      );
    }

    if (!bidPercentage || bidPercentage < 2 || bidPercentage > 100) {
      return NextResponse.json(
        { error: 'bidPercentage must be between 2 and 100' },
        { status: 400 }
      );
    }

    // Get eBay connection
    let connection = await getConnectionForUser(user.id);
    if (!connection) {
      return NextResponse.json(
        { error: 'No eBay account connected' },
        { status: 400 }
      );
    }

    // Check if user has marketing scope
    const hasMarketingScope = connection.scopes?.includes(MARKETING_SCOPE);
    if (!hasMarketingScope) {
      return NextResponse.json(
        { error: 'Please reconnect your eBay account to enable Promoted Listings.' },
        { status: 403 }
      );
    }

    // Refresh token if needed
    connection = await refreshTokenIfNeeded(connection);
    if (!connection) {
      return NextResponse.json(
        { error: 'Failed to refresh eBay authorization. Please reconnect your account.' },
        { status: 401 }
      );
    }

    console.log('[Promotion Create] Creating promotion for listing:', listingId, 'with bid:', bidPercentage);

    // Create the promotion
    const result = await promoteListing(
      connection.access_token,
      listingId,
      bidPercentage,
      connection.is_sandbox
    );

    if (!result.success) {
      console.error('[Promotion Create] Failed:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to create promotion',
      }, { status: 400 });
    }

    console.log('[Promotion Create] Success:', { campaignId: result.campaignId, adId: result.adId });

    return NextResponse.json({
      success: true,
      campaignId: result.campaignId,
      adId: result.adId,
    });
  } catch (error) {
    console.error('[Promotion Create] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: String(error) },
      { status: 500 }
    );
  }
}
