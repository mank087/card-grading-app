/**
 * eBay Listing API (Trading API)
 *
 * Creates eBay listings for graded cards using the Trading API.
 * This allows inline shipping/payment/return details without
 * creating permanent business policies on the seller's account.
 *
 * POST /api/ebay/listing
 *
 * Thin wrapper: auth → parse → publishCardListing() → NextResponse. Every
 * gate, the claim flow, the Trading API call and the error mapping live in
 * src/lib/ebay/publishCardListing.ts so the bulk listing drain can run the
 * same publish without an HTTP round trip.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  publishCardListing,
  type CreateListingRequest,
} from '@/lib/ebay/publishCardListing';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in first.' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const supabase = supabaseServer();

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session', debug: { errorMsg: userError?.message } },
        { status: 401 }
      );
    }

    // Parse request body
    const body: CreateListingRequest = await request.json();

    const result = await publishCardListing(
      { ...body, userId: user.id },
      { supabase }
    );

    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }

    return NextResponse.json(result.listing);
  } catch (error) {
    console.error('[eBay Listing] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: String(error) },
      { status: 500 }
    );
  }
}
