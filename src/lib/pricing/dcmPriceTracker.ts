/**
 * DCM Price Tracker
 *
 * Fetches card prices from SportsCardsPro API and calculates DCM estimated values.
 * Caches prices in the cards table for efficient display on collection page.
 *
 * Only used for sports cards - other card types continue to use eBay pricing.
 */

import { supabaseServer } from '@/lib/supabaseServer';
import {
  searchSportsCardPrices,
  getProductPrices,
  normalizePrices,
  isPriceChartingEnabled,
  type NormalizedPrices,
} from '@/lib/priceCharting';

// Types
export interface DcmCachedPrice {
  estimate: number | null;
  raw: number | null;
  graded_high: number | null;
  median: number | null;
  average: number | null;
  updated_at: string | null;
  match_confidence: string | null;
  product_id: string | null;
  product_name: string | null;
}

export interface CardForDcmPricing {
  id: string;
  category: string;
  conversational_decimal_grade?: number | null;
  conversational_card_info: {
    player_or_character?: string;
    card_name?: string;
    set_name?: string;
    year?: string;
    card_number?: string;
    card_number_raw?: string;
    rarity_or_variant?: string;
    parallel_type?: string;  // Actual parallel color (e.g., "Green", "Gold", "Silver Prizm")
    subset?: string;  // Insert/subset name (e.g., "Downtown", "Kaboom") - NOT used for variant search
    subset_insert_name?: string;  // Alternative field from v3.3 rarity classification
    serial_numbering?: string;
    rookie_card?: boolean;
    rookie_or_first?: boolean;
    featured?: string;
    card_set?: string;
    release_date?: string;
  } | null;
}

/**
 * Check if a category is a sports card category
 */
export function isSportsCardCategory(category: string): boolean {
  const sportsCategories = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];
  return sportsCategories.includes(category);
}

/**
 * Calculate DCM estimated value using multiplier approach
 *
 * DCM is newer and not yet established like PSA, so values are typically
 * a percentage between raw and PSA equivalent grade.
 *
 * Fallback: If no graded equivalent price, use raw × 3
 */
export function calculateDcmEstimate(
  prices: NormalizedPrices,
  dcmGrade: number
): { estimate: number; method: 'multiplier' | 'fallback' } | null {
  const raw = prices.raw;
  const psaGrades = prices.psa;

  // Get the PSA price at equivalent grade
  const roundedGrade = Math.round(dcmGrade).toString();
  const halfGrade = dcmGrade >= 9 ? '9.5' : null;
  const psaEquivalentPrice = psaGrades[roundedGrade] || (halfGrade && psaGrades[halfGrade]) || null;

  // Fallback: if no graded equivalent, use raw × 3
  if (!psaEquivalentPrice && raw) {
    return {
      estimate: Math.round(raw * 3 * 100) / 100,
      method: 'fallback',
    };
  }

  if (!raw || !psaEquivalentPrice) return null;

  // DCM multiplier: represents market premium over raw
  // Higher grades get closer to PSA values, lower grades closer to raw
  let dcmMultiplier: number;
  if (dcmGrade >= 9.5) {
    dcmMultiplier = 0.70; // 70% of PSA premium over raw
  } else if (dcmGrade >= 9) {
    dcmMultiplier = 0.65; // 65% of PSA premium
  } else if (dcmGrade >= 8) {
    dcmMultiplier = 0.55; // 55% of PSA premium
  } else if (dcmGrade >= 7) {
    dcmMultiplier = 0.45; // 45% of PSA premium
  } else {
    dcmMultiplier = 0.35; // 35% of PSA premium for lower grades
  }

  // Calculate: Raw + (PSA premium × DCM multiplier)
  const psaPremium = psaEquivalentPrice - raw;
  const dcmValue = raw + (psaPremium * dcmMultiplier);

  return {
    estimate: Math.round(dcmValue * 100) / 100,
    method: 'multiplier',
  };
}

/**
 * Calculate market statistics from normalized prices
 */
function calculateMarketStats(prices: NormalizedPrices): {
  low: number | null;
  high: number | null;
  median: number;
  average: number;
} | null {
  const allPrices: number[] = [];

  // Add raw price
  if (prices.raw && prices.raw > 0) allPrices.push(prices.raw);

  // Add graded prices from all companies
  Object.values(prices.psa).forEach(p => p > 0 && allPrices.push(p));
  Object.values(prices.bgs).forEach(p => p > 0 && allPrices.push(p));
  Object.values(prices.sgc).forEach(p => p > 0 && allPrices.push(p));

  if (allPrices.length === 0) return null;

  const sortedPrices = [...allPrices].sort((a, b) => a - b);
  const low = sortedPrices[0];
  const high = sortedPrices[sortedPrices.length - 1];

  // Calculate median
  const mid = Math.floor(sortedPrices.length / 2);
  const median = sortedPrices.length % 2 !== 0
    ? sortedPrices[mid]
    : (sortedPrices[mid - 1] + sortedPrices[mid]) / 2;

  // Calculate average
  const average = allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length;

  return {
    low: Math.round(low * 100) / 100,
    high: Math.round(high * 100) / 100,
    median: Math.round(median * 100) / 100,
    average: Math.round(average * 100) / 100,
  };
}

/**
 * Check if cached DCM price is stale (older than specified days)
 */
export function isDcmPriceCacheStale(updatedAt: string | null, maxAgeDays: number = 7): boolean {
  if (!updatedAt) return true;

  const cacheDate = new Date(updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - cacheDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays > maxAgeDays;
}

/**
 * Get cached DCM price from cards table
 */
export async function getCachedDcmPrice(cardId: string): Promise<DcmCachedPrice | null> {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from('cards')
    .select(`
      dcm_price_estimate,
      dcm_price_raw,
      dcm_price_graded_high,
      dcm_price_median,
      dcm_price_average,
      dcm_price_updated_at,
      dcm_price_match_confidence,
      dcm_price_product_id,
      dcm_price_product_name
    `)
    .eq('id', cardId)
    .single();

  if (error) {
    console.error(`[DcmPriceTracker] Error fetching cached price for card ${cardId}:`, error);
    return null;
  }

  if (!data || !data.dcm_price_updated_at) {
    return null;
  }

  return {
    estimate: data.dcm_price_estimate,
    raw: data.dcm_price_raw,
    graded_high: data.dcm_price_graded_high,
    median: data.dcm_price_median,
    average: data.dcm_price_average,
    updated_at: data.dcm_price_updated_at,
    match_confidence: data.dcm_price_match_confidence,
    product_id: data.dcm_price_product_id,
    product_name: data.dcm_price_product_name,
  };
}

/**
 * Save DCM price cache to cards table
 */
async function saveDcmPriceCache(
  cardId: string,
  data: {
    estimate: number | null;
    raw: number | null;
    gradedHigh: number | null;
    median: number | null;
    average: number | null;
    matchConfidence: string;
    productId: string;
    productName: string;
  },
  options: { isInitialGrading?: boolean } = {}
): Promise<void> {
  const supabase = supabaseServer();
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {
    dcm_price_estimate: data.estimate,
    dcm_price_raw: data.raw,
    dcm_price_graded_high: data.gradedHigh,
    dcm_price_median: data.median,
    dcm_price_average: data.average,
    dcm_price_updated_at: now,
    dcm_price_match_confidence: data.matchConfidence,
    dcm_price_product_id: data.productId,
    dcm_price_product_name: data.productName,
  };

  // Set "price at grading" only on initial grading (never overwrite)
  if (options.isInitialGrading && data.estimate !== null) {
    // Check if already set (e.g. re-grade scenario)
    const { data: existing } = await supabase
      .from('cards')
      .select('dcm_price_at_grading')
      .eq('id', cardId)
      .single();

    if (!existing?.dcm_price_at_grading) {
      updateData.dcm_price_at_grading = data.estimate;
      updateData.dcm_price_at_grading_date = now;
    }
  }

  const { error } = await supabase
    .from('cards')
    .update(updateData)
    .eq('id', cardId);

  if (error) {
    console.error(`[DcmPriceTracker] Error saving price cache for card ${cardId}:`, error);
    throw error;
  }
}

/**
 * Fetch DCM prices from SportsCardsPro and cache to cards table
 */
export async function fetchAndCacheDcmPrice(card: CardForDcmPricing, options: { isInitialGrading?: boolean } = {}): Promise<DcmCachedPrice | null> {
  // Check if PriceCharting API is enabled
  if (!isPriceChartingEnabled()) {
    console.error('[DcmPriceTracker] SportsCardsPro API is not configured');
    return null;
  }

  const cardInfo = card.conversational_card_info;

  // Map field names
  const playerOrCharacter = cardInfo?.player_or_character || cardInfo?.featured;
  const setName = cardInfo?.set_name || cardInfo?.card_set;
  const year = cardInfo?.year || cardInfo?.release_date;
  // Prefer card_number_raw (preserves original format like "WC-11") over card_number (may be normalized)
  const cardNumber = cardInfo?.card_number_raw || cardInfo?.card_number;
  const isRookie = cardInfo?.rookie_or_first === true || cardInfo?.rookie_card === true;
  const serialNumbering = cardInfo?.serial_numbering;
  // Use parallel_type for actual parallel color (e.g., "Green", "Gold", "Silver Prizm")
  // NOT subset - that's the insert/subset name (e.g., "Downtown", "Kaboom")
  // Fall back to rarity_or_variant only if parallel_type is not available
  // Also filter out generic type classifications that don't help with matching
  const genericTypes = [
    'base', 'insert', 'modern_parallel', 'parallel', 'parallel_variant', 'sp', 'ssp',
    'autographed', 'autograph', 'auto', 'rookie', 'rc', 'memorabilia', 'relic', 'patch'
  ];
  const parallelType = cardInfo?.parallel_type;
  const variant = parallelType && !genericTypes.includes(parallelType.toLowerCase())
    ? parallelType
    : (cardInfo?.rarity_or_variant && !genericTypes.includes(cardInfo.rarity_or_variant.toLowerCase())
        ? cardInfo.rarity_or_variant
        : undefined);

  // Log search parameters clearly
  console.log(`[DcmPriceTracker] === Card ${card.id} SEARCH ===`);
  console.log(`[DcmPriceTracker] Player: ${playerOrCharacter}`);
  console.log(`[DcmPriceTracker] Year: ${year || '(not specified)'}`);
  console.log(`[DcmPriceTracker] Set: ${setName || '(not specified)'}`);
  console.log(`[DcmPriceTracker] Card #: ${cardNumber || '(not specified)'}`);
  console.log(`[DcmPriceTracker] Serial: ${serialNumbering || '(not numbered)'}`);
  console.log(`[DcmPriceTracker] Parallel Type: ${cardInfo?.parallel_type || '(none)'}`);
  console.log(`[DcmPriceTracker] Subset (NOT used): ${cardInfo?.subset || '(none)'}`);
  console.log(`[DcmPriceTracker] Rarity/Variant: ${cardInfo?.rarity_or_variant || '(none)'}`);
  console.log(`[DcmPriceTracker] VARIANT USED: ${variant || '(none)'}`);

  // Skip cards without enough info
  if (!cardInfo || !playerOrCharacter) {
    console.log(`[DcmPriceTracker] Skipping card ${card.id} - missing player/character info`);
    return null;
  }

  // Only process sports cards
  if (!isSportsCardCategory(card.category)) {
    console.log(`[DcmPriceTracker] Skipping card ${card.id} - not a sports card (category: ${card.category})`);
    return null;
  }

  try {
    console.log(`[DcmPriceTracker] Fetching SportsCardsPro prices for card ${card.id}...`);

    // Search SportsCardsPro
    const result = await searchSportsCardPrices({
      playerName: playerOrCharacter,
      year: year || undefined,
      setName: setName || undefined,
      cardNumber: cardNumber || undefined,
      variant: variant || undefined,  // Use parallel_type if available, else rarity_or_variant
      rookie: isRookie,
      sport: card.category,
      serialNumbering: serialNumbering || undefined,
    });

    if (!result.prices) {
      console.log(`[DcmPriceTracker] No prices found for card ${card.id} (query: "${result.queryUsed}", confidence: ${result.matchConfidence})`);
      return null;
    }

    const prices = result.prices;
    const dcmGrade = card.conversational_decimal_grade || 8; // Default to 8 if no grade

    // Calculate DCM estimate
    const dcmResult = calculateDcmEstimate(prices, dcmGrade);

    // Calculate market stats
    const stats = calculateMarketStats(prices);

    // Get highest graded price
    const gradedPrices: number[] = [];
    Object.values(prices.psa).forEach(p => p > 0 && gradedPrices.push(p));
    Object.values(prices.bgs).forEach(p => p > 0 && gradedPrices.push(p));
    Object.values(prices.sgc).forEach(p => p > 0 && gradedPrices.push(p));
    const gradedHigh = gradedPrices.length > 0 ? Math.max(...gradedPrices) : null;

    const cacheData = {
      estimate: dcmResult?.estimate || null,
      raw: prices.raw,
      gradedHigh,
      median: stats?.median || null,
      average: stats?.average || null,
      matchConfidence: result.matchConfidence,
      productId: prices.productId,
      productName: prices.productName,
    };

    // Save to cache
    await saveDcmPriceCache(card.id, cacheData, { isInitialGrading: options.isInitialGrading });

    console.log(`[DcmPriceTracker] Cached DCM price for card ${card.id}: $${cacheData.estimate} (${result.matchConfidence} match)`);

    return {
      estimate: cacheData.estimate,
      raw: cacheData.raw,
      graded_high: cacheData.gradedHigh,
      median: cacheData.median,
      average: cacheData.average,
      updated_at: new Date().toISOString(),
      match_confidence: cacheData.matchConfidence,
      product_id: cacheData.productId,
      product_name: cacheData.productName,
    };
  } catch (error) {
    console.error(`[DcmPriceTracker] Error fetching/caching price for card ${card.id}:`, error);
    throw error;
  }
}

/**
 * Refresh DCM price using cached product ID (faster, no search needed)
 */
export async function refreshDcmPriceByProductId(
  cardId: string,
  productId: string,
  dcmGrade: number
): Promise<DcmCachedPrice | null> {
  if (!isPriceChartingEnabled()) {
    console.error('[DcmPriceTracker] SportsCardsPro API is not configured');
    return null;
  }

  try {
    console.log(`[DcmPriceTracker] Refreshing price for card ${cardId} using product ID ${productId}...`);

    // Fetch prices directly by product ID
    const priceResult = await getProductPrices(productId);
    if (!priceResult) {
      console.log(`[DcmPriceTracker] No price data for product ${productId}`);
      return null;
    }

    const prices = normalizePrices(priceResult);

    // Calculate DCM estimate
    const dcmResult = calculateDcmEstimate(prices, dcmGrade);

    // Calculate market stats
    const stats = calculateMarketStats(prices);

    // Get highest graded price
    const gradedPrices: number[] = [];
    Object.values(prices.psa).forEach(p => p > 0 && gradedPrices.push(p));
    Object.values(prices.bgs).forEach(p => p > 0 && gradedPrices.push(p));
    Object.values(prices.sgc).forEach(p => p > 0 && gradedPrices.push(p));
    const gradedHigh = gradedPrices.length > 0 ? Math.max(...gradedPrices) : null;

    const cacheData = {
      estimate: dcmResult?.estimate || null,
      raw: prices.raw,
      gradedHigh,
      median: stats?.median || null,
      average: stats?.average || null,
      matchConfidence: 'high', // Direct product lookup is always high confidence
      productId: prices.productId,
      productName: prices.productName,
    };

    // Save to cache
    await saveDcmPriceCache(cardId, cacheData);

    console.log(`[DcmPriceTracker] Refreshed DCM price for card ${cardId}: $${cacheData.estimate}`);

    return {
      estimate: cacheData.estimate,
      raw: cacheData.raw,
      graded_high: cacheData.gradedHigh,
      median: cacheData.median,
      average: cacheData.average,
      updated_at: new Date().toISOString(),
      match_confidence: cacheData.matchConfidence,
      product_id: cacheData.productId,
      product_name: cacheData.productName,
    };
  } catch (error) {
    console.error(`[DcmPriceTracker] Error refreshing price for card ${cardId}:`, error);
    throw error;
  }
}

/**
 * Get DCM price - from cache if fresh, otherwise fetch and cache
 * This is the main function to call from card detail pages and collection
 *
 * Options:
 * - maxAgeDays: Cache freshness threshold (default 7 days)
 * - forceRefresh: Bypass cache freshness check but still use cached product ID
 * - forceNewSearch: Do a completely fresh search ignoring cached product ID
 *                   Use this when card info (like subset/parallel) has changed
 */
export async function getDcmPriceWithCache(
  cardId: string,
  cardData: {
    category: string;
    conversational_decimal_grade?: number | null;
    conversational_card_info: CardForDcmPricing['conversational_card_info'];
  },
  options: { maxAgeDays?: number; forceRefresh?: boolean; forceNewSearch?: boolean } = {}
): Promise<DcmCachedPrice | null> {
  const { maxAgeDays = 7, forceRefresh = false, forceNewSearch = false } = options;

  // Only process sports cards
  if (!isSportsCardCategory(cardData.category)) {
    return null;
  }

  // If forcing a new search, skip all caching and go straight to fresh search
  if (forceNewSearch) {
    console.log(`[DcmPriceTracker] Force new search requested for card ${cardId}`);
    const card: CardForDcmPricing = {
      id: cardId,
      category: cardData.category,
      conversational_decimal_grade: cardData.conversational_decimal_grade,
      conversational_card_info: cardData.conversational_card_info,
    };
    return fetchAndCacheDcmPrice(card);
  }

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await getCachedDcmPrice(cardId);
    if (cached && !isDcmPriceCacheStale(cached.updated_at, maxAgeDays)) {
      console.log(`[DcmPriceTracker] Using cached DCM price for card ${cardId}`);
      return cached;
    }

    // If we have a cached product ID, use it for faster refresh
    if (cached?.product_id && cardData.conversational_decimal_grade) {
      try {
        return await refreshDcmPriceByProductId(cardId, cached.product_id, cardData.conversational_decimal_grade);
      } catch (error) {
        console.error(`[DcmPriceTracker] Product ID refresh failed, falling back to search:`, error);
      }
    }
  }

  // Fetch fresh prices via search
  const card: CardForDcmPricing = {
    id: cardId,
    category: cardData.category,
    conversational_decimal_grade: cardData.conversational_decimal_grade,
    conversational_card_info: cardData.conversational_card_info,
  };

  return fetchAndCacheDcmPrice(card);
}

/**
 * Batch refresh DCM prices for multiple cards
 *
 * Options:
 * - force: Refresh even if cache is fresh (but still use cached product ID)
 * - forceNewSearch: Do a completely fresh search ignoring cached product IDs
 *                   Use this when card info (like subset/parallel) has been updated
 * - delayMs: Delay between API calls to avoid rate limiting
 */
export async function batchRefreshDcmPrices(
  cardIds: string[],
  options: { force?: boolean; forceNewSearch?: boolean; delayMs?: number } = {}
): Promise<{
  success: boolean;
  refreshed: number;
  failed: number;
  skipped: number;
  results: Array<{ cardId: string; success: boolean; estimate?: number | null; error?: string }>;
}> {
  const { force = false, forceNewSearch = false, delayMs = 500 } = options;
  const supabase = supabaseServer();

  const results: Array<{ cardId: string; success: boolean; estimate?: number | null; error?: string }> = [];
  let refreshed = 0;
  let failed = 0;
  let skipped = 0;

  // Fetch card data for all cards
  const { data: cards, error: fetchError } = await supabase
    .from('cards')
    .select(`
      id,
      category,
      conversational_decimal_grade,
      conversational_card_info,
      dcm_price_updated_at,
      dcm_price_product_id
    `)
    .in('id', cardIds);

  if (fetchError) {
    console.error('[DcmPriceTracker] Error fetching cards for batch refresh:', fetchError);
    return {
      success: false,
      refreshed: 0,
      failed: cardIds.length,
      skipped: 0,
      results: cardIds.map(id => ({ cardId: id, success: false, error: 'Failed to fetch card data' })),
    };
  }

  for (const card of cards || []) {
    // Skip non-sports cards
    if (!isSportsCardCategory(card.category)) {
      skipped++;
      results.push({ cardId: card.id, success: true, error: 'Not a sports card' });
      continue;
    }

    // Skip if not stale and not forced
    if (!force && !isDcmPriceCacheStale(card.dcm_price_updated_at)) {
      skipped++;
      results.push({ cardId: card.id, success: true, error: 'Cache still fresh' });
      continue;
    }

    try {
      let result: DcmCachedPrice | null = null;

      // Parse conversational_card_info if it's a JSON string
      let parsedCardInfo = card.conversational_card_info;
      if (typeof parsedCardInfo === 'string') {
        try {
          parsedCardInfo = JSON.parse(parsedCardInfo);
          console.log(`[DcmPriceTracker] Parsed conversational_card_info from string for card ${card.id}`);
        } catch (e) {
          console.error(`[DcmPriceTracker] Failed to parse conversational_card_info for card ${card.id}:`, e);
        }
      }

      // Debug: Log what card info we have
      console.log(`[DcmPriceTracker] Processing card ${card.id}:`, {
        category: card.category,
        hasCardInfo: !!parsedCardInfo,
        cardInfoType: typeof parsedCardInfo,
        player: parsedCardInfo?.player_or_character,
        grade: card.conversational_decimal_grade
      });

      // Create card object with parsed info
      const cardWithParsedInfo: CardForDcmPricing = {
        ...card,
        conversational_card_info: parsedCardInfo
      };

      // If forceNewSearch is true, always do a fresh search ignoring cached product ID
      // This is useful when card info (subset/parallel) has been updated
      if (forceNewSearch) {
        console.log(`[DcmPriceTracker] Force new search for card ${card.id}`);
        result = await fetchAndCacheDcmPrice(cardWithParsedInfo);
      }
      // Otherwise, try product ID refresh first if available (faster)
      else if (card.dcm_price_product_id && card.conversational_decimal_grade) {
        result = await refreshDcmPriceByProductId(card.id, card.dcm_price_product_id, card.conversational_decimal_grade);
      }
      // Fall back to fresh search if no cached product ID
      else {
        result = await fetchAndCacheDcmPrice(cardWithParsedInfo);
      }

      refreshed++;
      results.push({ cardId: card.id, success: true, estimate: result?.estimate ?? null });
    } catch (error) {
      failed++;
      results.push({
        cardId: card.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Rate limiting delay
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return {
    success: failed === 0,
    refreshed,
    failed,
    skipped,
    results,
  };
}
