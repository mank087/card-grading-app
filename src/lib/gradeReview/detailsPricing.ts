import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAndCacheDcmPrice, isSportsCardCategory } from '@/lib/pricing/dcmPriceTracker';
import { fetchCardPrice, savePriceSnapshot } from '@/lib/ebay/priceTracker';

/**
 * After an identification correction the cached market data describes the
 * wrong card (Dean's 1960 Mantle priced as a 2021 reprint). Refresh both
 * sources best-effort; a pricing failure must never fail the review itself.
 */
export async function refreshPricesAfterDetails(db: SupabaseClient, cardId: string): Promise<{ dcm: number | null; ebayMedian: number | null; errors: string[] }> {
  const errors: string[] = [];
  let dcm: number | null = null, ebayMedian: number | null = null;
  const { data: card, error } = await db.from('cards').select('id, category, conversational_decimal_grade, conversational_card_info').eq('id', cardId).maybeSingle();
  if (error || !card) return { dcm, ebayMedian, errors: [error?.message ?? 'card_not_found'] };
  const info = typeof card.conversational_card_info === 'string' ? JSON.parse(card.conversational_card_info) : card.conversational_card_info;
  const forPricing = { id: card.id, category: card.category, conversational_decimal_grade: card.conversational_decimal_grade, conversational_card_info: info };
  if (isSportsCardCategory(card.category)) {
    try { dcm = (await fetchAndCacheDcmPrice(forPricing))?.estimate ?? null; } catch (e) { errors.push(`dcm: ${e instanceof Error ? e.message : String(e)}`); }
  }
  try {
    const snap = await fetchCardPrice(forPricing);
    if (snap) {
      await savePriceSnapshot(snap);
      const { error: saveError } = await db.from('cards').update({ ebay_price_lowest: snap.lowest_price, ebay_price_median: snap.median_price, ebay_price_average: snap.average_price, ebay_price_highest: snap.highest_price, ebay_price_listing_count: snap.listing_count, ebay_price_updated_at: new Date().toISOString() }).eq('id', cardId);
      if (saveError) errors.push(`ebay save: ${saveError.message}`); else ebayMedian = snap.median_price;
    }
  } catch (e) { errors.push(`ebay: ${e instanceof Error ? e.message : String(e)}`); }
  return { dcm, ebayMedian, errors };
}
