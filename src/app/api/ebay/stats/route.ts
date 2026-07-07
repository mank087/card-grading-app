/**
 * GET /api/ebay/stats
 *
 * Returns aggregated marketplace stats for the authenticated user.
 * Powers the StatsStrip at the top of /instalist-marketplace.
 *
 * Per v1 spec (locked 2026-06-02): revenue is GROSS sale price, not net.
 * Phase 4 (analytics dashboard) will introduce net via Sell Finances API.
 *
 * Note on `price` semantics: on sold rows, sync.ts overwrites `price` with
 * the FINAL SALE PRICE (auction winning bid / accepted Best Offer / fixed
 * price) when eBay exposes it. Best-effort: rows sold before that capture
 * existed (or where eBay returned no usable price) still hold the ask.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
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

    // Pull just the columns we aggregate. limit 5000 to keep the payload
    // bounded; very few users will have that many lifetime listings.
    const { data: rows, error } = await supabase
      .from('ebay_listings')
      .select('status, price, quantity_sold, view_count, watch_count, sold_at')
      .eq('user_id', user.id)
      .limit(5000);

    if (error) {
      console.error('[stats] DB error:', error);
      return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
    }

    let activeCount = 0;
    let soldCount = 0;
    let endedCount = 0;
    let grossRevenue = 0;
    let totalViews = 0;
    let totalWatchers = 0;

    for (const r of rows ?? []) {
      const price = Number(r.price) || 0;
      const qtySold = Math.max(1, Number(r.quantity_sold) || 0);
      const views = Number(r.view_count) || 0;
      const watchers = Number(r.watch_count) || 0;

      if (r.status === 'active' || r.status === 'pending') {
        activeCount++;
        totalViews += views;
        totalWatchers += watchers;
      } else if (r.status === 'sold') {
        soldCount++;
        // Gross = final sale price * quantity sold (price is rewritten to
        // the sale price by sync when the row goes sold). Matches the
        // per-row math in SoldTab so the strip and table tell the same story.
        grossRevenue += price * qtySold;
      } else if (r.status === 'ended' || r.status === 'cancelled') {
        endedCount++;
      }
    }

    return NextResponse.json({
      activeCount,
      soldCount,
      endedCount,
      grossRevenue,        // gross — fees not deducted in v1
      totalViews,          // sum across active listings only
      totalWatchers,
      currency: 'USD',
    });
  } catch (err: any) {
    console.error('[stats] unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
