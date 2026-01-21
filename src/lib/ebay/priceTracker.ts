/**
 * eBay Price Tracker
 *
 * Batch job logic for tracking card prices over time.
 * Fetches prices from eBay and stores snapshots in card_price_history table.
 */

import { supabaseServer } from '@/lib/supabaseServer';
import {
  searchEbayPricesWithFallback,
  searchPokemonPricesWithFallback,
  searchMTGPricesWithFallback,
  searchLorcanaPricesWithFallback,
  searchOtherPricesWithFallback,
  type SportsCardQueryOptions,
  type PokemonCardQueryOptions,
  type MTGCardQueryOptions,
  type LorcanaCardQueryOptions,
  type OtherCardQueryOptions,
} from './browseApi';
import { EBAY_CATEGORIES } from './constants';

// Types
export interface PriceSnapshot {
  card_id: string;
  card_type: 'sports' | 'pokemon' | 'mtg' | 'lorcana' | 'other';
  lowest_price: number | null;
  median_price: number | null;
  highest_price: number | null;
  average_price: number | null;
  listing_count: number;
  query_used: string;
  query_strategy: string;
}

export interface BatchJobResult {
  success: boolean;
  total_cards: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ card_id: string; error: string }>;
  duration_ms: number;
}

export interface CardForPricing {
  id: string;
  category: string;
  conversational_card_info: {
    // Primary fields (from conversational grading)
    player_or_character?: string;
    card_name?: string;
    set_name?: string;
    year?: string;
    card_number?: string;
    card_number_raw?: string;
    subset?: string;
    rarity_or_variant?: string;
    manufacturer?: string;
    serial_numbering?: string;
    rookie_card?: boolean;
    rookie_or_first?: boolean;
    // Legacy field names (fallback)
    featured?: string;
    card_set?: string;
    release_date?: string;
    // CCG-specific fields
    is_foil?: boolean;
    foil_type?: string;
    ink_color?: string;  // Lorcana-specific
  } | null;
}

/**
 * Determine card type from category
 */
function getCardType(category: string): 'sports' | 'pokemon' | 'mtg' | 'lorcana' | 'other' {
  const sportsCategories = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];
  const pokemonCategories = ['Pokemon', 'Pokémon'];
  const mtgCategories = ['MTG', 'Magic: The Gathering', 'Magic the Gathering'];
  const lorcanaCategories = ['Lorcana', 'Disney Lorcana'];

  if (sportsCategories.includes(category)) return 'sports';
  if (pokemonCategories.includes(category)) return 'pokemon';
  if (mtgCategories.includes(category)) return 'mtg';
  if (lorcanaCategories.includes(category)) return 'lorcana';
  return 'other';
}

/**
 * Get eBay category ID for a card type
 */
function getEbayCategoryId(cardType: 'sports' | 'pokemon' | 'mtg' | 'lorcana' | 'other'): string {
  switch (cardType) {
    case 'sports':
      return EBAY_CATEGORIES.SPORTS_TRADING_CARDS;
    case 'pokemon':
    case 'mtg':
    case 'lorcana':
      return EBAY_CATEGORIES.CCG_INDIVIDUAL_CARDS;
    default:
      return EBAY_CATEGORIES.NON_SPORT_TRADING_CARDS;
  }
}

/**
 * Fetch price data for a single card
 */
export async function fetchCardPrice(card: CardForPricing): Promise<PriceSnapshot | null> {
  const cardInfo = card.conversational_card_info;

  // Map field names (conversational_card_info uses different names than SportsCardQueryOptions)
  const playerOrCharacter = cardInfo?.player_or_character || cardInfo?.featured;
  const cardName = cardInfo?.card_name;
  const setName = cardInfo?.set_name || cardInfo?.card_set;
  const year = cardInfo?.year || cardInfo?.release_date;
  const cardNumber = cardInfo?.card_number_raw || cardInfo?.card_number;
  const isRookie = cardInfo?.rookie_card || cardInfo?.rookie_or_first;

  // Skip cards without enough info for a search
  if (!cardInfo || (!playerOrCharacter && !cardName)) {
    return null;
  }

  const cardType = getCardType(card.category);
  const categoryId = getEbayCategoryId(cardType);

  try {
    let result;

    // Use Pokemon-specific search for Pokemon/CCG cards
    if (cardType === 'pokemon') {
      const pokemonQueryOptions: PokemonCardQueryOptions = {
        card_name: cardName,
        featured: playerOrCharacter,
        card_set: setName,
        card_number: cardNumber,
        release_date: year,
        subset: cardInfo?.subset,
        rarity_or_variant: cardInfo?.rarity_or_variant,
        manufacturer: cardInfo?.manufacturer,
      };

      result = await searchPokemonPricesWithFallback(pokemonQueryOptions, {
        categoryId,
        limit: 25,
        minResults: 3,
      });
    } else {
      // Use sports card search for sports and other cards
      const queryOptions: SportsCardQueryOptions = {
        card_name: cardName,
        featured: playerOrCharacter,
        card_set: setName,
        card_number: cardNumber,
        release_date: year,
        subset: cardInfo?.subset,
        rarity_or_variant: cardInfo?.rarity_or_variant,
        manufacturer: cardInfo?.manufacturer,
        serial_numbering: cardInfo?.serial_numbering,
        rookie_card: isRookie,
      };

      result = await searchEbayPricesWithFallback(queryOptions, {
        categoryId,
        limit: 25,
        minResults: 3,
      });
    }

    return {
      card_id: card.id,
      card_type: cardType,
      lowest_price: result.lowestPrice ?? null,
      median_price: result.medianPrice ?? null,
      highest_price: result.highestPrice ?? null,
      average_price: result.averagePrice ?? null,
      listing_count: result.total,
      query_used: result.queryUsed,
      query_strategy: result.queryStrategy,
    };
  } catch (error) {
    console.error(`[PriceTracker] Error fetching price for card ${card.id}:`, error);
    throw error;
  }
}

/**
 * Save a price snapshot to the database
 */
export async function savePriceSnapshot(snapshot: PriceSnapshot): Promise<void> {
  const supabase = supabaseServer();

  const { error } = await supabase.from('card_price_history').insert({
    card_id: snapshot.card_id,
    card_type: snapshot.card_type,
    lowest_price: snapshot.lowest_price,
    median_price: snapshot.median_price,
    highest_price: snapshot.highest_price,
    average_price: snapshot.average_price,
    listing_count: snapshot.listing_count,
    query_used: snapshot.query_used,
    query_strategy: snapshot.query_strategy,
    recorded_at: new Date().toISOString(),
  });

  if (error) {
    console.error(`[PriceTracker] Error saving snapshot for card ${snapshot.card_id}:`, error);
    throw error;
  }
}

/**
 * Get cards that need price updates
 * Returns cards that either:
 * - Have never had a price snapshot
 * - Haven't had a price snapshot in the last N days
 */
export async function getCardsNeedingPriceUpdate(
  options: {
    limit?: number;
    minDaysSinceUpdate?: number;
    cardTypes?: Array<'sports' | 'pokemon' | 'other'>;
  } = {}
): Promise<CardForPricing[]> {
  const { limit = 100, minDaysSinceUpdate = 7, cardTypes } = options;
  const supabase = supabaseServer();

  // Get all cards with grading results (they have conversational_card_info populated)
  let query = supabase
    .from('cards')
    .select('id, category, conversational_card_info')
    .not('conversational_card_info', 'is', null)
    .limit(limit);

  // Filter by card types if specified
  if (cardTypes && cardTypes.length > 0) {
    const categories: string[] = [];
    if (cardTypes.includes('sports')) {
      categories.push('Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports');
    }
    if (cardTypes.includes('pokemon')) {
      categories.push('Pokemon', 'Pokémon');
    }
    if (cardTypes.includes('other')) {
      categories.push('MTG', 'Magic', 'Lorcana', 'Yu-Gi-Oh', 'Other');
    }
    if (categories.length > 0) {
      query = query.in('category', categories);
    }
  }

  const { data: allCards, error: cardsError } = await query;

  if (cardsError) {
    console.error('[PriceTracker] Error fetching cards:', cardsError);
    throw cardsError;
  }

  if (!allCards || allCards.length === 0) {
    return [];
  }

  // Get card IDs that have recent price history
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - minDaysSinceUpdate);

  const { data: recentSnapshots, error: snapshotsError } = await supabase
    .from('card_price_history')
    .select('card_id')
    .gte('recorded_at', cutoffDate.toISOString());

  if (snapshotsError) {
    console.error('[PriceTracker] Error fetching recent snapshots:', snapshotsError);
    throw snapshotsError;
  }

  // Filter out cards with recent snapshots
  const recentCardIds = new Set(recentSnapshots?.map(s => s.card_id) || []);
  const cardsNeedingUpdate = allCards.filter(card => !recentCardIds.has(card.id));

  return cardsNeedingUpdate as CardForPricing[];
}

/**
 * Run the batch price update job
 * Processes cards in batches with rate limiting
 */
export async function runPriceUpdateBatch(
  options: {
    limit?: number;
    batchSize?: number;
    delayBetweenBatches?: number;
    cardTypes?: Array<'sports' | 'pokemon' | 'other'>;
  } = {}
): Promise<BatchJobResult> {
  const {
    limit = 100,
    batchSize = 10,
    delayBetweenBatches = 2000, // 2 seconds between batches
    cardTypes,
  } = options;

  const startTime = Date.now();
  const result: BatchJobResult = {
    success: true,
    total_cards: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    duration_ms: 0,
  };

  try {
    // Get cards needing updates
    const cards = await getCardsNeedingPriceUpdate({
      limit,
      minDaysSinceUpdate: 7,
      cardTypes,
    });

    result.total_cards = cards.length;
    console.log(`[PriceTracker] Starting batch job for ${cards.length} cards`);

    // Process in batches
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);
      console.log(`[PriceTracker] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cards.length / batchSize)}`);

      // Process batch concurrently
      const batchPromises = batch.map(async (card) => {
        try {
          const snapshot = await fetchCardPrice(card);

          if (!snapshot) {
            result.skipped++;
            return;
          }

          await savePriceSnapshot(snapshot);
          result.succeeded++;
          console.log(`[PriceTracker] ✓ Card ${card.id}: ${snapshot.listing_count} listings, median $${snapshot.median_price}`);
        } catch (error) {
          result.failed++;
          result.errors.push({
            card_id: card.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          console.error(`[PriceTracker] ✗ Card ${card.id}:`, error);
        }
        result.processed++;
      });

      await Promise.all(batchPromises);

      // Rate limiting delay between batches
      if (i + batchSize < cards.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    result.duration_ms = Date.now() - startTime;
    console.log(`[PriceTracker] Batch job complete: ${result.succeeded}/${result.total_cards} succeeded in ${result.duration_ms}ms`);

    return result;
  } catch (error) {
    result.success = false;
    result.duration_ms = Date.now() - startTime;
    console.error('[PriceTracker] Batch job failed:', error);
    return result;
  }
}

/**
 * Get price history for a specific card
 */
export async function getCardPriceHistory(
  cardId: string,
  options: { limit?: number } = {}
): Promise<Array<{
  recorded_at: string;
  lowest_price: number | null;
  median_price: number | null;
  highest_price: number | null;
  average_price: number | null;
  listing_count: number;
}>> {
  const { limit = 52 } = options; // Default to ~1 year of weekly data
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from('card_price_history')
    .select('recorded_at, lowest_price, median_price, highest_price, average_price, listing_count')
    .eq('card_id', cardId)
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`[PriceTracker] Error fetching history for card ${cardId}:`, error);
    throw error;
  }

  return data || [];
}

/**
 * Get the latest price snapshot for a card
 */
export async function getLatestCardPrice(cardId: string): Promise<{
  recorded_at: string;
  lowest_price: number | null;
  median_price: number | null;
  highest_price: number | null;
  average_price: number | null;
  listing_count: number;
  query_strategy: string | null;
} | null> {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from('card_price_history')
    .select('recorded_at, lowest_price, median_price, highest_price, average_price, listing_count, query_strategy')
    .eq('card_id', cardId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      return null;
    }
    console.error(`[PriceTracker] Error fetching latest price for card ${cardId}:`, error);
    throw error;
  }

  return data;
}

// =============================================================================
// Price Caching (cards table - for display)
// =============================================================================

export interface CachedPrice {
  lowest_price: number | null;
  median_price: number | null;
  average_price: number | null;
  highest_price: number | null;
  listing_count: number | null;
  updated_at: string | null;
}

/**
 * Check if cached price is stale (older than specified days)
 */
export function isPriceCacheStale(updatedAt: string | null, maxAgeDays: number = 7): boolean {
  if (!updatedAt) return true;

  const cacheDate = new Date(updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - cacheDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays > maxAgeDays;
}

/**
 * Get cached price from cards table
 */
export async function getCachedCardPrice(cardId: string): Promise<CachedPrice | null> {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from('cards')
    .select('ebay_price_lowest, ebay_price_median, ebay_price_average, ebay_price_highest, ebay_price_listing_count, ebay_price_updated_at')
    .eq('id', cardId)
    .single();

  if (error) {
    console.error(`[PriceTracker] Error fetching cached price for card ${cardId}:`, error);
    return null;
  }

  if (!data || !data.ebay_price_updated_at) {
    return null;
  }

  return {
    lowest_price: data.ebay_price_lowest,
    median_price: data.ebay_price_median,
    average_price: data.ebay_price_average,
    highest_price: data.ebay_price_highest,
    listing_count: data.ebay_price_listing_count,
    updated_at: data.ebay_price_updated_at,
  };
}

/**
 * Save price cache to cards table
 */
async function savePriceCache(
  cardId: string,
  prices: {
    lowest: number | null;
    median: number | null;
    average: number | null;
    highest: number | null;
    listingCount: number;
  }
): Promise<void> {
  const supabase = supabaseServer();

  const { error } = await supabase
    .from('cards')
    .update({
      ebay_price_lowest: prices.lowest,
      ebay_price_median: prices.median,
      ebay_price_average: prices.average,
      ebay_price_highest: prices.highest,
      ebay_price_listing_count: prices.listingCount,
      ebay_price_updated_at: new Date().toISOString(),
    })
    .eq('id', cardId);

  if (error) {
    console.error(`[PriceTracker] Error saving price cache for card ${cardId}:`, error);
    throw error;
  }
}

/**
 * Fetch eBay prices and cache to cards table
 * Used after grading and for refreshing stale cache
 */
export async function fetchAndCacheCardPrice(card: CardForPricing): Promise<CachedPrice | null> {
  const cardInfo = card.conversational_card_info;

  // Map field names (conversational_card_info uses different names than SportsCardQueryOptions)
  // Matches the mapping in CardDetailClient.tsx
  const playerOrCharacter = cardInfo?.player_or_character || cardInfo?.featured;
  const cardName = cardInfo?.card_name;
  const setName = cardInfo?.set_name || cardInfo?.card_set;
  const year = cardInfo?.year || cardInfo?.release_date;
  const cardNumber = cardInfo?.card_number_raw || cardInfo?.card_number;
  const isRookie = cardInfo?.rookie_or_first === true || cardInfo?.rookie_card === true;
  const serialNumbering = cardInfo?.serial_numbering;

  // Skip cards without enough info for a search
  if (!cardInfo || (!playerOrCharacter && !cardName)) {
    return null;
  }

  const cardType = getCardType(card.category);
  const categoryId = getEbayCategoryId(cardType);

  try {
    console.log(`[PriceTracker] Fetching eBay prices for card ${card.id} (type: ${cardType})...`);

    let result;

    // Use card-type-specific search strategies
    if (cardType === 'pokemon') {
      const pokemonQueryOptions: PokemonCardQueryOptions = {
        card_name: cardName,
        featured: playerOrCharacter,
        card_set: setName,
        card_number: cardNumber,
        release_date: year,
        subset: cardInfo?.subset,
        rarity_or_variant: cardInfo?.rarity_or_variant,
        manufacturer: cardInfo?.manufacturer,
      };

      result = await searchPokemonPricesWithFallback(pokemonQueryOptions, {
        categoryId,
        limit: 25,
        minResults: 3,
      });
    } else if (cardType === 'mtg') {
      const mtgQueryOptions: MTGCardQueryOptions = {
        card_name: cardName,
        card_set: setName,
        card_number: cardNumber,
        release_date: year,
        rarity: cardInfo?.rarity_or_variant,
        is_foil: cardInfo?.is_foil || false,
        foil_type: cardInfo?.foil_type,
        manufacturer: cardInfo?.manufacturer,
      };

      result = await searchMTGPricesWithFallback(mtgQueryOptions, {
        categoryId,
        limit: 25,
        minResults: 3,
      });
    } else if (cardType === 'lorcana') {
      const lorcanaQueryOptions: LorcanaCardQueryOptions = {
        card_name: cardName,
        card_set: setName,
        card_number: cardNumber,
        release_date: year,
        rarity: cardInfo?.rarity_or_variant,
        ink_color: cardInfo?.ink_color,
        is_foil: cardInfo?.is_foil || false,
      };

      result = await searchLorcanaPricesWithFallback(lorcanaQueryOptions, {
        categoryId,
        limit: 25,
        minResults: 3,
      });
    } else if (cardType === 'other') {
      // Use Other card search for miscellaneous/non-sport cards
      const otherQueryOptions: OtherCardQueryOptions = {
        card_name: cardName,
        featured: playerOrCharacter,
        card_set: setName,
        card_number: cardNumber,
        release_date: year,
        subset: cardInfo?.subset,
        rarity_or_variant: cardInfo?.rarity_or_variant,
        manufacturer: cardInfo?.manufacturer,
      };

      result = await searchOtherPricesWithFallback(otherQueryOptions, {
        categoryId,
        limit: 25,
        minResults: 3,
      });
    } else {
      // Use sports card search for sports cards
      const queryOptions: SportsCardQueryOptions = {
        card_name: cardName,
        featured: playerOrCharacter,
        card_set: setName,
        card_number: cardNumber,
        release_date: year,
        subset: cardInfo?.subset,
        rarity_or_variant: cardInfo?.rarity_or_variant,
        manufacturer: cardInfo?.manufacturer,
        serial_numbering: serialNumbering,
        rookie_card: isRookie,
      };

      result = await searchEbayPricesWithFallback(queryOptions, {
        categoryId,
        limit: 25,
        minResults: 3,
      });
    }

    const prices = {
      lowest: result.lowestPrice ?? null,
      median: result.medianPrice ?? null,
      average: result.averagePrice ?? null,
      highest: result.highestPrice ?? null,
      listingCount: result.total,
    };

    // Save to cards table cache
    await savePriceCache(card.id, prices);

    console.log(`[PriceTracker] Cached prices for card ${card.id}: $${prices.median} median (${prices.listingCount} listings)`);

    return {
      lowest_price: prices.lowest,
      median_price: prices.median,
      average_price: prices.average,
      highest_price: prices.highest,
      listing_count: prices.listingCount,
      updated_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[PriceTracker] Error fetching/caching price for card ${card.id}:`, error);
    throw error;
  }
}

/**
 * Get card price - from cache if fresh, otherwise fetch and cache
 * This is the main function to call from card detail pages
 */
export async function getCardPriceWithCache(
  cardId: string,
  cardData: {
    category: string;
    conversational_card_info: CardForPricing['conversational_card_info'];
  },
  options: { maxAgeDays?: number; forceRefresh?: boolean } = {}
): Promise<CachedPrice | null> {
  const { maxAgeDays = 7, forceRefresh = false } = options;

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await getCachedCardPrice(cardId);
    if (cached && !isPriceCacheStale(cached.updated_at, maxAgeDays)) {
      console.log(`[PriceTracker] Using cached price for card ${cardId} (age: ${cached.updated_at})`);
      return cached;
    }
  }

  // Fetch fresh prices and cache
  const card: CardForPricing = {
    id: cardId,
    category: cardData.category,
    conversational_card_info: cardData.conversational_card_info,
  };

  return fetchAndCacheCardPrice(card);
}
