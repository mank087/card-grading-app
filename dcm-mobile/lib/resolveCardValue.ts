/**
 * Mobile copy of @/lib/pricing/resolveCardValue (web).
 *
 * Kept as a verbatim copy rather than a metro-aliased import so the
 * mobile bundler doesn't have to reach across the project boundary.
 * If you change the chain in the web file, update this one too —
 * grep for `resolveCardValue` to find all the call sites.
 */

export type PriceSource =
  | 'dcm-estimate'
  | 'dcm-cached'
  | 'scryfall-foil'
  | 'scryfall'
  | 'ebay-median'
  | 'none'

export interface CardForPricing {
  category?: string | null
  is_foil?: boolean | null
  dcm_price_estimate?: number | null
  dcm_cached_prices?: { estimatedValue?: number | null } | null
  scryfall_price_usd?: number | null
  scryfall_price_usd_foil?: number | null
  ebay_price_median?: number | null
}

export interface ResolvedValue {
  value: number
  source: PriceSource
}

function isPositiveNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

export function resolveCardValue(card: CardForPricing): ResolvedValue {
  if (isPositiveNumber(card.dcm_price_estimate)) {
    return { value: card.dcm_price_estimate, source: 'dcm-estimate' }
  }
  const cachedEstimate = card.dcm_cached_prices?.estimatedValue
  if (isPositiveNumber(cachedEstimate)) {
    return { value: cachedEstimate, source: 'dcm-cached' }
  }
  if (card.category === 'MTG') {
    if (card.is_foil && isPositiveNumber(card.scryfall_price_usd_foil)) {
      return { value: card.scryfall_price_usd_foil, source: 'scryfall-foil' }
    }
    if (isPositiveNumber(card.scryfall_price_usd)) {
      return { value: card.scryfall_price_usd, source: 'scryfall' }
    }
  }
  if (isPositiveNumber(card.ebay_price_median)) {
    return { value: card.ebay_price_median, source: 'ebay-median' }
  }
  return { value: 0, source: 'none' }
}

export function getCardValue(card: CardForPricing): number {
  return resolveCardValue(card).value
}
