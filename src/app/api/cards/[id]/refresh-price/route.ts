/**
 * Single-card price refresh — fired (fire-and-forget) when a card detail
 * page loads, so the card a user is actually looking at never shows a
 * >7-day-old price. The batch equivalent for whole collections lives at
 * /api/market-pricing/refresh-prices; both share the per-card logic in
 * @/lib/pricing/batchPriceRefresh.
 *
 * Cost controls:
 *   - stale gate: no-op unless dcm_price_updated_at is >7 days old
 *     (isCacheStale, same window as the batch + cron paths)
 *   - owner-only: viewers of someone else's card don't trigger upstream calls
 *   - 60s per-card in-memory cooldown against reload spam
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  refreshCardPrice, classifyCategory, parseCardInfo, isCacheStale,
} from '@/lib/pricing/batchPriceRefresh';

// One card = at most a few upstream PriceCharting/eBay calls (~1-3s).
export const maxDuration = 60;

const lastRefreshByCard = new Map<string, number>();
const CARD_COOLDOWN_MS = 60_000;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const cardId = params.id;
    const last = lastRefreshByCard.get(cardId);
    if (last && Date.now() - last < CARD_COOLDOWN_MS) {
      return NextResponse.json({ success: true, refreshed: false, reason: 'cooldown' });
    }

    const supabase = supabaseServer();
    const { data: card, error } = await supabase
      .from('cards')
      .select(`
        id, user_id, category,
        conversational_card_info,
        conversational_decimal_grade,
        card_name, featured, pokemon_featured, card_set, card_number, release_date,
        manufacturer_name, is_foil, foil_type, mtg_rarity,
        dcm_price_product_id, dcm_price_updated_at
      `)
      .eq('id', cardId)
      .single();

    if (error || !card) {
      return NextResponse.json({ success: false, error: 'Card not found' }, { status: 404 });
    }
    if (card.user_id !== auth.userId) {
      // Not the owner — silently no-op rather than 403 so detail pages can
      // fire this unconditionally without console noise on featured cards.
      return NextResponse.json({ success: true, refreshed: false, reason: 'not-owner' });
    }
    if (!card.category || !isCacheStale(card.dcm_price_updated_at as string | null)) {
      return NextResponse.json({ success: true, refreshed: false, reason: 'fresh' });
    }

    const cardInfo = parseCardInfo(card as Record<string, unknown>);
    if (!cardInfo) {
      return NextResponse.json({ success: true, refreshed: false, reason: 'no-card-info' });
    }

    lastRefreshByCard.set(cardId, Date.now());

    const cardType = classifyCategory(card.category as string);
    const dcmGrade = (card.conversational_decimal_grade as number) || 8;
    const result = await refreshCardPrice(card as Record<string, unknown>, cardInfo, cardType, dcmGrade);

    return NextResponse.json({
      success: true,
      refreshed: result.success,
      estimate: result.estimate,
      source: result.source,
    });
  } catch (error) {
    console.error('[CardRefreshPrice] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to refresh price' },
      { status: 500 }
    );
  }
}
