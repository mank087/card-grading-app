/**
 * POST /api/ebay/listing/mark-ended
 *
 * Force-marks one of the caller's ebay_listings rows as 'ended' in DCM.
 * Used by the EbayListingModal's "I've already ended this listing" override
 * when eBay's API still reports the listing as Active due to propagation
 * delay after the user ended it on eBay.com.
 *
 * Body: { listingRowId: string }  // ebay_listings.id (NOT the eBay listing_id)
 *
 * No eBay API calls — this is a unilateral DCM state correction so the
 * user can immediately proceed to create a fresh listing. The next sync
 * pass will reconcile if the row actually was still active on eBay.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const supabase = supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const listingRowId: string | undefined = body.listingRowId;
    if (!listingRowId) {
      return NextResponse.json({ error: 'listingRowId is required' }, { status: 400 });
    }

    // Verify ownership before mutating. Using the admin client for the
    // update (RLS isn't bound to the user session on this serverless
    // request), so we MUST hand-check user_id = auth user.id.
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('ebay_listings')
      .select('id, user_id, status')
      .eq('id', listingRowId)
      .single();

    if (lookupError || !existing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Idempotent: if already in a terminal state, just return success.
    if (existing.status === 'ended' || existing.status === 'sold') {
      return NextResponse.json({ success: true, alreadyTerminal: true });
    }

    const { error: updateError } = await supabaseAdmin
      .from('ebay_listings')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', listingRowId);

    if (updateError) {
      console.error('[mark-ended] update failed:', updateError);
      return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[mark-ended] unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
