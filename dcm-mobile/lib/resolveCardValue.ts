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
 * Every source that can be reached by a NAME-ONLY search (1, 2 and 4) also
 * passes the displayed-value guard in ./valueGuard. A large number resting on
 * a card with no set or no year resolves to `{ value: 0, source: 'withheld' }`
 * with the original number kept in `withheldValue` so a surface can explain
 * itself instead of printing a dollar figure nobody vouched for. Scryfall is
 * exempt: it is per printing and is only set once an MTG card has been matched
 * to an exact card id, so it cannot drift onto a more famous card.
 *
 * Mobile copies this file verbatim at dcm-mobile/lib/resolveCardValue.ts.
 * If you change the chain here, update the mobile copy too.
 */
import { assessValueTrust, type CardIdentityForGuard, type ValueTrustReason } from './valueGuard';

export type PriceSource =
  | 'dcm-estimate'
  | 'dcm-cached'
  | 'scryfall-foil'
  | 'scryfall'
  | 'ebay-median'
  | 'withheld'
  | 'none';

/**
 * Minimal interface the resolver needs. Any object with these fields can
 * be resolved — works for the portfolio's flat card rows, the collection
 * Card type, the mobile native CardRow type, etc.
 *
 * The identity fields are the guard's input. They are optional, but a caller
 * that leaves them out gets the pre-guard behaviour, so every select that feeds
 * this resolver should ask for card_set, release_date, dcm_selected_product_id
 * and identity_confirmed_revision.
 */
export interface CardForPricing extends CardIdentityForGuard {
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
  /** The number the guard suppressed, present only when source is 'withheld'. */
  withheldValue?: number;
  /** Why it was suppressed, present only when source is 'withheld'. */
  withheldReason?: ValueTrustReason;
}

function isPositiveNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/**
 * Resolve a card to its current displayed value. Always returns a
 * non-negative number; `source` indicates which column was used so
 * callers can show a small attribution line ("via PriceCharting" /
 * "via Scryfall" / "via eBay") if desired.
 *
 * `source: 'withheld'` means a price exists but is not displayable. Callers
 * that only add numbers up can keep treating `value` as the truth: it is 0.
 */
export function resolveCardValue(card: CardForPricing): ResolvedValue {
  // 1. Primary — the cached, grade-adjusted DCM estimate.
  if (isPositiveNumber(card.dcm_price_estimate)) {
    return guard(card, card.dcm_price_estimate, 'dcm-estimate');
  }

  // 2. Legacy JSON blob fallback for cards cached before the dedicated
  //    column existed. Read defensively — older rows might have
  //    estimatedValue as a string.
  const cachedEstimate = card.dcm_cached_prices?.estimatedValue;
  if (isPositiveNumber(cachedEstimate)) {
    return guard(card, cachedEstimate, 'dcm-cached');
  }

  // 3. MTG-only Scryfall fallback. Set during MTG card verification, per
  //    printing, so it is not guarded.
  if (card.category === 'MTG') {
    if (card.is_foil && isPositiveNumber(card.scryfall_price_usd_foil)) {
      return { value: card.scryfall_price_usd_foil, source: 'scryfall-foil' };
    }
    if (isPositiveNumber(card.scryfall_price_usd)) {
      return { value: card.scryfall_price_usd, source: 'scryfall' };
    }
  }

  // 4. eBay median as the last priced fallback. Guarded too: the eBay search
  //    is built from the same name when there is no set or year.
  if (isPositiveNumber(card.ebay_price_median)) {
    return guard(card, card.ebay_price_median, 'ebay-median');
  }

  return { value: 0, source: 'none' };
}

/** Let a value through, or replace it with a withheld result. */
function guard(card: CardForPricing, value: number, source: PriceSource): ResolvedValue {
  const trust = assessValueTrust(card, value);
  if (trust.trusted) return { value, source };
  return { value: 0, source: 'withheld', withheldValue: value, withheldReason: trust.reason };
}

/**
 * Convenience for callers that only need the number, not the source.
 * `resolveCardValue(card).value` works too — this is just less verbose.
 *
 * A withheld card returns 0 here, which is what every total wants.
 */
export function getCardValue(card: CardForPricing): number {
  return resolveCardValue(card).value;
}

/** True when a price exists but the guard is hiding it. */
export function isValueWithheld(resolved: ResolvedValue): boolean {
  return resolved.source === 'withheld';
}
