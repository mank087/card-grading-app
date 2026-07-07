/**
 * Market Pricing — Batch Price Refresh API
 *
 * Refreshes PriceCharting + eBay-fallback prices for the caller's
 * collection. Per-card logic lives in @/lib/pricing/batchPriceRefresh
 * so the weekly cron at /api/cron/update-card-prices can share it.
 *
 * Open to all authenticated users (July 2026) — stale-only filter, batch
 * cap, and the server-side cool-down bound the cost. The cool-down also
 * backstops the client's localStorage rate limit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  refreshCardPrice, classifyCategory, parseCardInfo, isCacheStale,
} from '@/lib/pricing/batchPriceRefresh';

// Vercel function timeout. Per-card cost is ~1.5-2s (300ms inter-card
// delay + 1-3 upstream PriceCharting/eBay calls each), so the default
// ~60s ceiling killed the route at ~40 cards. 300s matches the weekly
// cron and admin price-tracker routes.
export const maxDuration = 300;

// 150 cards × ~1.5s/card = ~225s, comfortably under the 300s ceiling
// with headroom for slower API responses. Was 40 (set against the
// previous default timeout); bumped here so a single manual click can
// drain a larger stale-card queue and so the Phase-2 login-triggered
// fire-and-forget refresh can catch up users with mid-sized portfolios
// in one pass.
const MAX_CARDS_PER_BATCH = 150;
const DELAY_BETWEEN_CALLS_MS = 300;
// Minimum gap between manual refreshes per user. The page also limits
// to 2 clicks/day client-side via localStorage, but that's bypassable by
// clearing site data — this server-side guard keeps the upstream
// PriceCharting/eBay APIs from being hammered by anyone determined.
const MIN_REFRESH_INTERVAL_MS = 60_000;
// In-memory last-refresh tracker. Vercel functions are stateless across
// cold starts, so this catches rapid double-clicks within the same warm
// invocation window (~10 minutes) but resets on redeploy/cold start.
// Combined with the 60-second gap, that's enough to stop the abuse
// pattern the audit flagged without needing a new DB column.
const lastRefreshByUser = new Map<string, number>();

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // July 2026: open to ALL authenticated users. Auto-triggers (app open,
    // portfolio open, card detail open) keep everyone's prices fresh; the
    // stale-only filter + batch cap + cool-down bound the upstream cost.
    // The Card Lovers premium is the on-demand button UI, not the endpoint.

    // Server-side cool-down — backstop for the client's localStorage limit.
    const lastRefresh = lastRefreshByUser.get(auth.userId);
    if (lastRefresh && Date.now() - lastRefresh < MIN_REFRESH_INTERVAL_MS) {
      const waitSec = Math.ceil((MIN_REFRESH_INTERVAL_MS - (Date.now() - lastRefresh)) / 1000);
      return NextResponse.json(
        { success: false, error: `Please wait ${waitSec}s before refreshing again.`, retryAfterSec: waitSec },
        { status: 429 },
      );
    }
    lastRefreshByUser.set(auth.userId, Date.now());

    const supabase = supabaseServer();

    const { data: allCards, error: fetchError } = await supabase
      .from('cards')
      .select(`
        id, category,
        conversational_card_info,
        conversational_decimal_grade,
        card_name, featured, pokemon_featured, card_set, card_number, release_date,
        manufacturer_name, is_foil, foil_type, mtg_rarity,
        dcm_price_product_id, dcm_price_updated_at
      `)
      .eq('user_id', auth.userId)
      .not('category', 'is', null);

    if (fetchError) {
      console.error('[BatchRefresh] Error fetching cards:', fetchError);
      return NextResponse.json({ success: false, error: 'Failed to fetch cards' }, { status: 500 });
    }

    if (!allCards || allCards.length === 0) {
      return NextResponse.json({ success: true, refreshed: 0, total: 0, message: 'No cards found' });
    }

    // Filter to stale cards (>7 days or never priced). Cards with negative-
    // cache markers (dcm_price_match_confidence='no-match' written within
    // the last 7 days) are skipped via isCacheStale returning false — same
    // staleness window for hits and misses.
    const staleCards = allCards.filter(c => isCacheStale(c.dcm_price_updated_at));

    // Sort: cards with product IDs first (fast path), then the rest.
    staleCards.sort((a, b) => {
      if (a.dcm_price_product_id && !b.dcm_price_product_id) return -1;
      if (!a.dcm_price_product_id && b.dcm_price_product_id) return 1;
      return 0;
    });

    const cardsToRefresh = staleCards.slice(0, MAX_CARDS_PER_BATCH);

    console.log(`[BatchRefresh] ${staleCards.length} stale of ${allCards.length} total cards. Processing ${cardsToRefresh.length} this batch.`);

    if (cardsToRefresh.length === 0) {
      return NextResponse.json({
        success: true,
        refreshed: 0,
        total: allCards.length,
        stale: 0,
        message: 'All cards have fresh prices',
      });
    }

    const results: Array<{ id: string; success: boolean; estimate: number | null; source: string }> = [];

    for (let i = 0; i < cardsToRefresh.length; i++) {
      const card = cardsToRefresh[i] as Record<string, unknown>;
      const cardInfo = parseCardInfo(card);

      if (!cardInfo) {
        results.push({ id: card.id as string, success: false, estimate: null, source: 'no-card-info' });
        continue;
      }

      const cardType = classifyCategory(card.category as string);
      const dcmGrade = (card.conversational_decimal_grade as number) || 8;

      const result = await refreshCardPrice(card, cardInfo, cardType, dcmGrade);
      results.push({ id: card.id as string, ...result });

      if (i < cardsToRefresh.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CALLS_MS));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      refreshed: successCount,
      failed: failedCount,
      total: allCards.length,
      stale: staleCards.length,
      remaining: Math.max(0, staleCards.length - cardsToRefresh.length),
      results,
      message: `Refreshed ${successCount} of ${cardsToRefresh.length} cards`,
    });
  } catch (error) {
    console.error('[BatchRefresh] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to refresh prices' },
      { status: 500 }
    );
  }
}
