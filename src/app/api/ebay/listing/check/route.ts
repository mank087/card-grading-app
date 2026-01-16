/**
 * eBay Listing Check API
 *
 * Checks if a card already has an active eBay listing.
 *
 * GET /api/ebay/listing/check?cardId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

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

    // Check for existing active listing
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
      console.error('[eBay Listing Check] Error:', listingError);
    }

    return NextResponse.json({
      hasListing: !!existingListing,
      listing: existingListing || null,
    });
  } catch (error) {
    console.error('[eBay Listing Check] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
