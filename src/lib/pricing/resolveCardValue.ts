/**
 * Single source of truth for "current value of a graded card."
 *
 * Used by every surface that shows a price: the Market Pricing portfolio
 * endpoint, the web Collection page, web card-detail pages, the mobile
 * native Collection tab, and the mobile native card-detail screen.
 *
 * Three different priority chains were in production before this lib —
 * one card could show different numbers depending on where you looked.
 * Consolidating here means a price change only has to be made in one
 * place, and every surface stays in lockstep.
 *
 * Priority order (mirrors the portfolio's getCardValue chain that was
 * audited and confirmed as the most-correct version):
 *   1. dcm_price_estimate column          — grade-adjusted DCM estimate
 *   2. dcm_cached_prices.estimatedValue   — legacy JSON blob for older cards
 *   3. MTG-only: foil-aware Scryfall      — Scryfall is set at MTG verify time
 *   4. ebay_price_median                  — last-resort live-listing median
 *   5. 0                                  — never priced / no data anywhere
 *
 * Mobile copies this file verbatim at dcm-mobile/lib/resolveCardValue.ts.
 * If you change the chain here, update the mobile copy too.
 */

export type PriceSource =
  | 'dcm-estimate'
  | 'dcm-cached'
  | 'scryfall-foil'
  | 'scryfall'
  | 'ebay-median'
  | 'none';

/**
 * Minimal interface the resolver needs. Any object with these fields can
 * be resolved — works for the portfolio's flat card rows, the collection
 * Card type, the mobile native CardRow type, etc.
 */
export interface CardForPricing {
  category?: string | null;
  is_foil?: boolean | null;
  dcm_price_estimate?: number | null;
  dcm_cached_prices?: { estimatedValue?: number | null } | null;
  scryfall_price_usd?: number | null;
  scryfall_price_usd_foil?: number | null;
  ebay_price_median?: number | null;
}

export interface ResolvedValue {
  value: number;
  source: PriceSource;
}

function isPositiveNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/**
 * Resolve a card to its current displayed value. Always returns a
 * non-negative number; `source` indicates which column was used so
 * callers can show a small attribution line ("via PriceCharting" /
 * "via Scryfall" / "via eBay") if desired.
 */
export function resolveCardValue(card: CardForPricing): ResolvedValue {
  // 1. Primary — the cached, grade-adjusted DCM estimate.
  if (isPositiveNumber(card.dcm_price_estimate)) {
    return { value: card.dcm_price_estimate, source: 'dcm-estimate' };
  }

  // 2. Legacy JSON blob fallback for cards cached before the dedicated
  //    column existed. Read defensively — older rows might have
  //    estimatedValue as a string.
  const cachedEstimate = card.dcm_cached_prices?.estimatedValue;
  if (isPositiveNumber(cachedEstimate)) {
    return { value: cachedEstimate, source: 'dcm-cached' };
  }

  // 3. MTG-only Scryfall fallback. Set during MTG card verification.
  if (card.category === 'MTG') {
    if (card.is_foil && isPositiveNumber(card.scryfall_price_usd_foil)) {
      return { value: card.scryfall_price_usd_foil, source: 'scryfall-foil' };
    }
    if (isPositiveNumber(card.scryfall_price_usd)) {
      return { value: card.scryfall_price_usd, source: 'scryfall' };
    }
  }

  // 4. eBay median as the last priced fallback.
  if (isPositiveNumber(card.ebay_price_median)) {
    return { value: card.ebay_price_median, source: 'ebay-median' };
  }

  return { value: 0, source: 'none' };
}

/**
 * Convenience for callers that only need the number, not the source.
 * `resolveCardValue(card).value` works too — this is just less verbose.
 */
export function getCardValue(card: CardForPricing): number {
  return resolveCardValue(card).value;
}
