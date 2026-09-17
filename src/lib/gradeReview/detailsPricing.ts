import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAndCacheDcmPrice, isSportsCardCategory } from '@/lib/pricing/dcmPriceTracker';
import { fetchCardPrice, savePriceSnapshot } from '@/lib/ebay/priceTracker';
import {
  guardedPriceUpdate, readPriceRevisions, PRICE_REVISION_SELECT,
} from '@/lib/pricing/guardedPriceWrite';
import { PRICING_INVALIDATION_COLUMNS } from '@/lib/identity/saveCardIdentity';

/**
 * The eBay comps bound to the OLD identity. Cleared before the refresh when the
 * admin's correction was material, so the page cannot keep presenting the wrong
 * card's comps as current while the refresh runs or if it finds nothing.
 */
const EBAY_COMP_COLUMNS = PRICING_INVALIDATION_COLUMNS.filter(c => c.startsWith('ebay_price_'));

/**
 * After an identification correction the cached market data describes the
 * wrong card (Dean's 1960 Mantle priced as a 2021 reprint). Refresh both
 * sources best-effort; a pricing failure must never fail the review itself.
 *
 * Phase 2C notes for whoever touches this next:
 *  - Both writes are revision-guarded. The revisions are read in the select
 *    below, which is the same read the pricing search uses, so a correction
 *    landing mid-refresh discards this write instead of resurrecting old money.
 *  - `materialChange` is passed by the caller (the review knows whether it
 *    rewrote the identity). When it is true the eBay comps are cleared FIRST,
 *    so the "keep the previous comps when the search comes back empty" rule
 *    below no longer keeps the wrong card's comps. When it is false the old
 *    behaviour is unchanged: comps are only replaced by better ones.
 *  - Deliberately NOT refactored further: this writer still only refreshes DCM
 *    pricing for sports categories, and it still does not touch
 *    dcm_price_* for non-sports cards or scryfall_price_usd for MTG. Those gaps
 *    predate Phase 2C. A material correction on an MTG card therefore relies on
 *    the Phase 2A invalidation in save_card_identity() to clear scryfall prices.
 */
export async function refreshPricesAfterDetails(
  db: SupabaseClient,
  cardId: string,
  options: { materialChange?: boolean } = {},
): Promise<{ dcm: number | null; ebayMedian: number | null; errors: string[] }> {
  const errors: string[] = [];
  let dcm: number | null = null, ebayMedian: number | null = null;
  const { data: card, error } = await db
    .from('cards')
    .select(`id, category, conversational_decimal_grade, conversational_card_info, ${PRICE_REVISION_SELECT}`)
    .eq('id', cardId)
    .maybeSingle();
  if (error || !card) return { dcm, ebayMedian, errors: [error?.message ?? 'card_not_found'] };
  const revisions = readPriceRevisions(card as Record<string, any>);
  const info = typeof card.conversational_card_info === 'string' ? JSON.parse(card.conversational_card_info) : card.conversational_card_info;
  const forPricing = {
    id: card.id,
    category: card.category,
    conversational_decimal_grade: card.conversational_decimal_grade,
    conversational_card_info: info,
    identity_revision: revisions?.identity_revision,
    pricing_selection_revision: revisions?.pricing_selection_revision,
  };

  // A material correction means the stored comps are for a different card.
  // Clear them before refreshing so nothing stale is left on display.
  if (options.materialChange) {
    const cleared: Record<string, null> = {};
    for (const column of EBAY_COMP_COLUMNS) cleared[column] = null;
    const clearResult = await guardedPriceUpdate(db, cardId, revisions, cleared, 'GradeReview/details');
    if (clearResult.status === 'stale') {
      return { dcm, ebayMedian, errors: ['stale_identity'] };
    }
    if (clearResult.status === 'error') errors.push(`ebay clear: ${clearResult.error}`);
  }

  if (isSportsCardCategory(card.category)) {
    try { dcm = (await fetchAndCacheDcmPrice(forPricing))?.estimate ?? null; } catch (e) { errors.push(`dcm: ${e instanceof Error ? e.message : String(e)}`); }
  }
  try {
    const snap = await fetchCardPrice(forPricing);
    // A snapshot with no listings usually means the eBay search failed (rate
    // limit, outage). Keep the previous comps rather than overwriting them
    // with an empty result. On a material change there are no previous comps
    // left to keep, because they were cleared above.
    if (snap && snap.listing_count > 0 && snap.median_price != null) {
      await savePriceSnapshot(snap);
      const saveResult = await guardedPriceUpdate(db, cardId, revisions, {
        ebay_price_lowest: snap.lowest_price,
        ebay_price_median: snap.median_price,
        ebay_price_average: snap.average_price,
        ebay_price_highest: snap.highest_price,
        ebay_price_listing_count: snap.listing_count,
        ebay_price_updated_at: new Date().toISOString(),
      }, 'GradeReview/details');
      if (saveResult.status === 'stale') errors.push('stale_identity');
      else if (saveResult.status === 'error') errors.push(`ebay save: ${saveResult.error}`);
      else ebayMedian = snap.median_price;
    }
  } catch (e) { errors.push(`ebay: ${e instanceof Error ? e.message : String(e)}`); }
  return { dcm, ebayMedian, errors };
}
