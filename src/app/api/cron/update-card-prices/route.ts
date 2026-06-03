/**
 * Card Price Update Cron
 *
 * Runs weekly to refresh PriceCharting + eBay prices for ALL graded
 * cards across all users so the Portfolio's `dcm_price_estimate`
 * column stays fresh even for cards no one happens to visit.
 *
 * Previously this only wrote `card_price_history` snapshots via the
 * eBay-only `runPriceUpdateBatch`. The actual portfolio value column
 * (dcm_price_estimate) wasn't touched, so cards drifted indefinitely
 * stale unless a user manually refreshed via /market-pricing.
 *
 * Vercel Cron: every Sunday at 3 AM UTC (see vercel.json).
 * Security: validates CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  refreshCardPrice, classifyCategory, parseCardInfo, isCacheStale,
} from '@/lib/pricing/batchPriceRefresh';

// Vercel Pro: up to 300s per invocation. We stop a bit before the cutoff
// so the in-flight batch can finish its final card cleanly.
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_DURATION_MS = 270_000;          // 4m30s — leaves 30s headroom
const DELAY_BETWEEN_CALLS_MS = 250;
// Hard cap so the cron can't accidentally chew through the entire DB in
// a single run if everything is stale. Anything over this gets the next
// cron pass next week.
const MAX_CARDS_PER_RUN = 600;

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  // Vercel sends CRON_SECRET via the Authorization header for scheduled jobs.
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    console.warn('[Price Cron] Unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Price Cron] Starting weekly price-refresh run');

    // Pull all graded cards that have card info we can search. Order by
    // oldest dcm_price_updated_at first so the most-stale cards are
    // refreshed first. `nullsFirst: true` puts never-priced cards at
    // the top — they need pricing more urgently than 8-day-old cards.
    const { data: cards, error: fetchErr } = await supabaseAdmin
      .from('cards')
      .select(`
        id, category,
        conversational_card_info,
        conversational_decimal_grade,
        card_name, featured, pokemon_featured, card_set, card_number, release_date,
        manufacturer_name, is_foil, foil_type, mtg_rarity,
        dcm_price_product_id, dcm_price_updated_at
      `)
      .not('category', 'is', null)
      .order('dcm_price_updated_at', { ascending: true, nullsFirst: true })
      .limit(MAX_CARDS_PER_RUN);

    if (fetchErr) {
      console.error('[Price Cron] Card fetch failed:', fetchErr);
      return NextResponse.json({ success: false, error: 'Failed to fetch cards' }, { status: 500 });
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'No cards to refresh' });
    }

    const staleCards = cards.filter(c => isCacheStale(c.dcm_price_updated_at));
    if (staleCards.length === 0) {
      console.log('[Price Cron] All cards in this slice are fresh');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No stale cards in this run',
        scanned: cards.length,
      });
    }

    // Cards with product IDs first (fast path).
    staleCards.sort((a, b) => {
      if (a.dcm_price_product_id && !b.dcm_price_product_id) return -1;
      if (!a.dcm_price_product_id && b.dcm_price_product_id) return 1;
      return 0;
    });

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    let processed = 0;
    let timedOut = false;

    for (const card of staleCards) {
      if (Date.now() - startedAt > MAX_DURATION_MS) {
        timedOut = true;
        break;
      }

      const cardInfo = parseCardInfo(card as unknown as Record<string, unknown>);
      if (!cardInfo) {
        skipped++;
        processed++;
        continue;
      }

      const cardType = classifyCategory(card.category as string);
      const dcmGrade = (card.conversational_decimal_grade as number) || 8;

      try {
        const result = await refreshCardPrice(
          card as unknown as Record<string, unknown>,
          cardInfo,
          cardType,
          dcmGrade,
        );
        if (result.success) succeeded++;
        else failed++;
      } catch (err) {
        console.error('[Price Cron] refresh threw:', err);
        failed++;
      }

      processed++;
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_CALLS_MS));
    }

    const durationMs = Date.now() - startedAt;
    console.log(
      `[Price Cron] Done in ${durationMs}ms — processed=${processed} succeeded=${succeeded} failed=${failed} skipped=${skipped} timedOut=${timedOut}`,
    );

    return NextResponse.json({
      success: true,
      processed,
      succeeded,
      failed,
      skipped,
      timedOut,
      remaining: Math.max(0, staleCards.length - processed),
      durationMs,
    });
  } catch (error) {
    console.error('[Price Cron] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
