/**
 * Shared per-card refresh logic used by both:
 *   - /api/market-pricing/refresh-prices (manual, Card Lovers only)
 *   - /api/cron/update-card-prices       (weekly cron, all users)
 *
 * Routes each card to the correct PriceCharting library based on category
 * and writes the result (or a negative-cache marker) to the cards table
 * so the portfolio's `dcm_price_estimate` column is the freshest data.
 *
 * Extracted from refresh-prices/route.ts so the cron can call the same
 * code path the manual refresh uses — without this, the cron only wrote
 * card_price_history snapshots and the actual portfolio value column
 * stayed stale until someone clicked the manual refresh button.
 */

import { supabaseServer } from '@/lib/supabaseServer';
import {
  getPokemonPricesForProductId, searchPokemonCardPrices, estimatePokemonDcmValue,
} from '@/lib/pokemonPricing';
import {
  getMTGPricesForProductId, searchMTGCardPrices, estimateMTGDcmValue,
} from '@/lib/mtgPricing';
import {
  getLorcanaPricesForProductId, searchLorcanaCardPrices, estimateLorcanaDcmValue,
} from '@/lib/lorcanaPricing';
import {
  getOnePiecePricesForProductId, searchOnePieceCardPrices, estimateOnePieceDcmValue,
} from '@/lib/onepiecePricing';
import {
  getOtherPricesForProductId, searchOtherCardPrices, estimateOtherDcmValue,
} from '@/lib/otherPricing';
import {
  searchSportsCardPrices, getProductPrices as getSportsProductPrices,
  normalizePrices as normalizeSportsPrices,
} from '@/lib/priceCharting';
import { calculateDcmEstimate } from '@/lib/pricing/dcmPriceTracker';
import { fetchAndCacheCardPrice } from '@/lib/ebay/priceTracker';

export const CACHE_MAX_AGE_DAYS = 7;
const SPORTS_CATEGORIES = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];

export type CardCategory = 'pokemon' | 'mtg' | 'lorcana' | 'onepiece' | 'sports' | 'other';

export function classifyCategory(category: string): CardCategory {
  if (['Pokemon', 'Pokémon'].includes(category)) return 'pokemon';
  if (['MTG', 'Magic: The Gathering'].includes(category)) return 'mtg';
  if (['Lorcana', 'Disney Lorcana'].includes(category)) return 'lorcana';
  if (['One Piece'].includes(category)) return 'onepiece';
  if (SPORTS_CATEGORIES.includes(category)) return 'sports';
  return 'other';
}

export function isCacheStale(updatedAt: string | null): boolean {
  if (!updatedAt) return true;
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  return diffMs > CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Parse card info from various storage formats (covers historical schema
 * changes — newest cards use conversational_card_info, older have
 * ai_grading JSON or direct columns).
 */
export function parseCardInfo(card: Record<string, unknown>): Record<string, unknown> | null {
  if (card.conversational_card_info) {
    const info = card.conversational_card_info;
    if (typeof info === 'string') {
      try { return JSON.parse(info); } catch { /* fall through */ }
    }
    return info as Record<string, unknown>;
  }
  if (card.conversational_grading && typeof card.conversational_grading === 'string') {
    try {
      const parsed = JSON.parse(card.conversational_grading as string);
      if (parsed?.card_info) return parsed.card_info;
    } catch { /* fall through */ }
  }
  if (card.ai_grading) {
    try {
      const aiGrading = typeof card.ai_grading === 'string'
        ? JSON.parse(card.ai_grading as string)
        : card.ai_grading;
      const cardInfo = aiGrading?.['Card Information'] || aiGrading?.card_info;
      if (cardInfo) return cardInfo;
    } catch { /* fall through */ }
  }
  if (card.featured || card.card_name || card.pokemon_featured) {
    return {
      player_or_character: card.pokemon_featured || card.featured,
      card_name: card.card_name,
      set_name: card.card_set,
      card_number: card.card_number,
      year: card.release_date,
      manufacturer: card.manufacturer_name,
      is_foil: card.is_foil || false,
      foil_type: card.foil_type,
      rarity_or_variant: card.mtg_rarity,
    };
  }
  return null;
}

async function savePriceToDb(
  cardId: string,
  data: {
    estimatedValue: number | null;
    raw: number | null;
    matchConfidence: string;
    productId: string;
    productName: string;
    fullData: unknown;
  },
): Promise<void> {
  const supabase = supabaseServer();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('cards')
    .update({
      dcm_cached_prices: data.fullData,
      dcm_prices_cached_at: now,
      dcm_price_estimate: data.estimatedValue,
      dcm_price_raw: data.raw,
      dcm_price_updated_at: now,
      dcm_price_match_confidence: data.matchConfidence,
      dcm_price_product_id: data.productId,
      dcm_price_product_name: data.productName,
    })
    .eq('id', cardId);
  if (error) {
    console.error(`[BatchRefresh] Failed to save price for card ${cardId}:`, error);
  }
}

/**
 * Negative-cache marker so we don't burn API quota retrying cards that
 * have no match on either PriceCharting or eBay. After 7 days the
 * isCacheStale check expires and we'll try again — fair compromise
 * between freshness and API conservation.
 */
async function markNoMatch(cardId: string): Promise<void> {
  const supabase = supabaseServer();
  const now = new Date().toISOString();
  await supabase
    .from('cards')
    .update({
      dcm_price_updated_at: now,
      dcm_price_match_confidence: 'no-match',
    })
    .eq('id', cardId);
}

export async function refreshCardPrice(
  card: Record<string, unknown>,
  cardInfo: Record<string, unknown>,
  cardType: CardCategory,
  dcmGrade: number,
): Promise<{ success: boolean; estimate: number | null; source: string }> {
  const cardId = card.id as string;
  const productId = card.dcm_price_product_id as string | null;

  // ── Fast path: use cached product ID ──
  if (productId) {
    try {
      let prices: any = null;
      let estimatedValue: number | null = null;

      switch (cardType) {
        case 'pokemon':
          prices = await getPokemonPricesForProductId(productId);
          if (prices) estimatedValue = estimatePokemonDcmValue(prices, dcmGrade);
          break;
        case 'mtg':
          prices = await getMTGPricesForProductId(productId);
          if (prices) estimatedValue = estimateMTGDcmValue(prices, dcmGrade);
          break;
        case 'lorcana':
          prices = await getLorcanaPricesForProductId(productId);
          if (prices) estimatedValue = estimateLorcanaDcmValue(prices, dcmGrade);
          break;
        case 'onepiece':
          prices = await getOnePiecePricesForProductId(productId);
          if (prices) estimatedValue = estimateOnePieceDcmValue(prices, dcmGrade);
          break;
        case 'sports': {
          const raw = await getSportsProductPrices(productId);
          if (raw) {
            prices = normalizeSportsPrices(raw);
            const result = calculateDcmEstimate(prices, dcmGrade);
            estimatedValue = result?.estimate ?? null;
          }
          break;
        }
        case 'other':
          prices = await getOtherPricesForProductId(productId);
          if (prices) estimatedValue = estimateOtherDcmValue(prices, dcmGrade);
          break;
      }

      if (prices) {
        await savePriceToDb(cardId, {
          estimatedValue,
          raw: prices.raw ?? null,
          matchConfidence: 'high',
          productId: prices.productId || productId,
          productName: prices.productName || '',
          fullData: { prices, estimatedValue, matchConfidence: 'high', queryUsed: `Product ID: ${productId}` },
        });
        return { success: true, estimate: estimatedValue, source: 'pricecharting-id' };
      }
    } catch {
      console.warn(`[BatchRefresh] Product ID lookup failed for ${cardId}, falling back to search`);
    }
  }

  // ── Search path: find the card on PriceCharting ──
  const playerOrCharacter = (cardInfo.player_or_character || cardInfo.featured) as string | undefined;
  const cardName = cardInfo.card_name as string | undefined;
  const setName = (cardInfo.set_name || cardInfo.card_set) as string | undefined;
  const year = (cardInfo.year || cardInfo.release_date) as string | undefined;
  const cardNumber = (cardInfo.card_number_raw || cardInfo.card_number) as string | undefined;
  const variant = (cardInfo.rarity_or_variant || cardInfo.parallel_type) as string | undefined;

  if (!playerOrCharacter && !cardName) {
    return { success: false, estimate: null, source: 'skipped-no-info' };
  }

  try {
    let prices: any = null;
    let estimatedValue: number | null = null;
    let matchConfidence = 'none';
    let queryUsed = '';

    switch (cardType) {
      case 'pokemon': {
        const result = await searchPokemonCardPrices({
          pokemonName: (playerOrCharacter || cardName) as string,
          setName, cardNumber, year, variant,
        });
        if (result.prices) {
          prices = result.prices;
          estimatedValue = estimatePokemonDcmValue(result.prices, dcmGrade);
          matchConfidence = result.matchConfidence;
          queryUsed = result.queryUsed;
        }
        break;
      }
      case 'mtg': {
        const result = await searchMTGCardPrices({
          cardName: (cardName || playerOrCharacter) as string,
          setName, collectorNumber: cardNumber, year,
          isFoil: !!cardInfo.is_foil, variant,
        });
        if (result.prices) {
          prices = result.prices;
          estimatedValue = estimateMTGDcmValue(result.prices, dcmGrade);
          matchConfidence = result.matchConfidence;
          queryUsed = result.queryUsed;
        }
        break;
      }
      case 'lorcana': {
        const result = await searchLorcanaCardPrices({
          cardName: (cardName || playerOrCharacter) as string,
          setName, collectorNumber: cardNumber, year,
          isFoil: !!cardInfo.is_foil, variant,
        });
        if (result.prices) {
          prices = result.prices;
          estimatedValue = estimateLorcanaDcmValue(result.prices, dcmGrade);
          matchConfidence = result.matchConfidence;
          queryUsed = result.queryUsed;
        }
        break;
      }
      case 'onepiece': {
        const result = await searchOnePieceCardPrices({
          cardName: (cardName || playerOrCharacter) as string,
          setName, collectorNumber: cardNumber, year, variant,
        });
        if (result.prices) {
          prices = result.prices;
          estimatedValue = estimateOnePieceDcmValue(result.prices, dcmGrade);
          matchConfidence = result.matchConfidence;
          queryUsed = result.queryUsed;
        }
        break;
      }
      case 'sports': {
        const result = await searchSportsCardPrices({
          playerName: playerOrCharacter as string,
          year, setName, cardNumber, variant,
          sport: card.category as string,
          serialNumbering: cardInfo.serial_numbering as string | undefined,
          rookie: !!cardInfo.rookie_card || !!cardInfo.rookie_or_first,
        });
        if (result.prices) {
          prices = result.prices;
          const dcmResult = calculateDcmEstimate(result.prices, dcmGrade);
          estimatedValue = dcmResult?.estimate ?? null;
          matchConfidence = result.matchConfidence;
          queryUsed = result.queryUsed;
        }
        break;
      }
      case 'other': {
        const result = await searchOtherCardPrices({
          cardName: (cardName || playerOrCharacter) as string,
          setName, cardNumber, year, variant,
          manufacturer: cardInfo.manufacturer as string | undefined,
          gameType: card.category as string,
        });
        if (result.prices) {
          prices = result.prices;
          estimatedValue = estimateOtherDcmValue(result.prices, dcmGrade);
          matchConfidence = result.matchConfidence;
          queryUsed = result.queryUsed;
        }
        // eBay fallback for "other" cards if PriceCharting had no match.
        if (!prices && (result as any).useEbayFallback) {
          try {
            await fetchAndCacheCardPrice({
              id: cardId,
              category: card.category as string,
              conversational_card_info: cardInfo as any,
            });
            return { success: true, estimate: null, source: 'ebay-fallback' };
          } catch {
            // Fall through to the no-match handler below.
          }
        }
        break;
      }
    }

    if (prices) {
      await savePriceToDb(cardId, {
        estimatedValue,
        raw: prices.raw ?? null,
        matchConfidence,
        productId: prices.productId || '',
        productName: prices.productName || '',
        fullData: { prices, estimatedValue, matchConfidence, queryUsed },
      });
      return { success: true, estimate: estimatedValue, source: 'pricecharting-search' };
    }

    // No PriceCharting match — try eBay as final fallback.
    try {
      await fetchAndCacheCardPrice({
        id: cardId,
        category: card.category as string,
        conversational_card_info: cardInfo as any,
      });
      return { success: true, estimate: null, source: 'ebay-fallback' };
    } catch {
      await markNoMatch(cardId).catch(() => {});
      return { success: false, estimate: null, source: 'no-match' };
    }
  } catch (error) {
    console.error(`[BatchRefresh] Search failed for card ${cardId}:`, error);
    return { success: false, estimate: null, source: 'error' };
  }
}
