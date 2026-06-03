/**
 * eBay Listing Check API
 *
 * Checks if a card already has an active eBay listing.
 * Verifies with eBay's API that the listing is still active.
 *
 * GET /api/ebay/listing/check?cardId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getConnectionForUser, refreshTokenIfNeeded } from '@/lib/ebay/auth';
import { getItemStatus, type TradingApiConfig } from '@/lib/ebay/tradingApi';

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
    const supabase = supabaseServer();

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Get card ID from query params
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get('cardId');

    if (!cardId) {
      return NextResponse.json(
        { error: 'cardId is required' },
        { status: 400 }
      );
    }

    // Check for existing active listing in our database
    const { data: existingListing, error: listingError } = await supabase
      .from('ebay_listings')
      .select('id, listing_id, listing_url, status, created_at')
      .eq('card_id', cardId)
      .eq('user_id', user.id)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (listingError && listingError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      console.error('[eBay Listing Check] Database error:', listingError);
    }

    // If no listing in database, return early
    if (!existingListing) {
      return NextResponse.json({
        hasListing: false,
        listing: null,
      });
    }

    // We have a listing in our database - verify it's still active on eBay
    console.log('[eBay Listing Check] Found listing in DB, verifying with eBay:', existingListing.listing_id);

    // Get eBay connection for the user. If we can't verify with eBay,
    // downgrade to a soft warning (previousListing) instead of a hard block
    // — the user knows their own intent better than our stale DB row, and
    // forcing them to give up on relisting because of a token issue is the
    // wrong call.
    let connection = await getConnectionForUser(user.id);
    if (!connection) {
      console.log('[eBay Listing Check] No eBay connection — soft warning');
      return NextResponse.json({
        hasListing: false,
        listing: null,
        previousListing: existingListing,
        verified: false,
        message: `Couldn't reach eBay to verify your existing listing. If you've already ended it on eBay, you're safe to proceed.`,
      });
    }

    // Refresh token if needed
    connection = await refreshTokenIfNeeded(connection);
    if (!connection) {
      console.log('[eBay Listing Check] Token refresh failed — soft warning');
      return NextResponse.json({
        hasListing: false,
        listing: null,
        previousListing: existingListing,
        verified: false,
        message: `Couldn't refresh your eBay session to verify the existing listing. If you've already ended it on eBay, you're safe to proceed.`,
      });
    }

    // Call eBay API to check listing status
    const tradingConfig: TradingApiConfig = {
      accessToken: connection.access_token,
      sandbox: connection.is_sandbox,
    };

    const ebayStatus = await getItemStatus(tradingConfig, existingListing.listing_id);

    console.log('[eBay Listing Check] eBay status response:', ebayStatus);

    // If we couldn't get status from eBay (transient API error, listing
    // too old to be findable, etc.) downgrade to soft warning so a
    // verification glitch can't permanently block a relist.
    if (!ebayStatus.success) {
      console.log('[eBay Listing Check] Could not verify with eBay:', ebayStatus.error);
      return NextResponse.json({
        hasListing: false,
        listing: null,
        previousListing: existingListing,
        verified: false,
        message: `Couldn't verify the existing listing with eBay (${ebayStatus.error || 'unknown error'}). If you've already ended it on eBay, you're safe to proceed.`,
      });
    }

    // Check if listing is still active on eBay
    const ebayListingStatus = ebayStatus.item?.listingStatus;

    if (ebayListingStatus === 'Active') {
      // Listing is still active on eBay
      console.log('[eBay Listing Check] Listing is still active on eBay');
      return NextResponse.json({
        hasListing: true,
        listing: {
          ...existingListing,
          listing_url: ebayStatus.item?.viewItemUrl || existingListing.listing_url,
        },
        verified: true,
        ebayStatus: ebayListingStatus,
      });
    }

    // Listing is no longer active on eBay (Ended, Completed, or not found)
    console.log('[eBay Listing Check] Listing is no longer active on eBay:', ebayListingStatus);

    // Update our database to reflect the ended status
    const newStatus = ebayListingStatus === 'Completed' ? 'sold' : 'ended';
    const { error: updateError } = await supabase
      .from('ebay_listings')
      .update({ status: newStatus })
      .eq('id', existingListing.id);

    if (updateError) {
      console.error('[eBay Listing Check] Failed to update listing status:', updateError);
    } else {
      console.log('[eBay Listing Check] Updated listing status to:', newStatus);
    }

    // Return that there's no active listing (user can create a new one)
    return NextResponse.json({
      hasListing: false,
      listing: null,
      previousListing: {
        ...existingListing,
        status: newStatus,
      },
      ebayStatus: ebayListingStatus,
      message: `Previous listing was ${ebayListingStatus === 'Completed' ? 'sold' : 'ended'}. You can create a new listing.`,
    });
  } catch (error) {
    console.error('[eBay Listing Check] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
