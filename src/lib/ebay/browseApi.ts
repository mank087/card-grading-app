/**
 * eBay Browse API Client
 *
 * Uses Application tokens (client credentials) to search active listings.
 * No user authentication required - works with just App ID and Cert ID.
 */

import { EBAY_API_URLS } from './constants';

// =============================================================================
// Types
// =============================================================================

export interface EbayPriceResult {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  condition: string;
  itemWebUrl: string;
  imageUrl?: string;
  seller?: {
    username: string;
    feedbackScore: number;
    feedbackPercentage: string;
  };
  shippingCost?: number;
  itemLocation?: string;
  buyingOptions: string[];
  currentBidPrice?: number;
  bidCount?: number;
}

export interface EbayPriceSearchResult {
  total: number;
  items: EbayPriceResult[];
  lowestPrice?: number;
  highestPrice?: number;
  averagePrice?: number;
  medianPrice?: number;
  queryUsed?: string;
  queryStrategy?: 'specific' | 'moderate' | 'broad' | 'minimal';
}

// =============================================================================
// Configuration
// =============================================================================

// Browse API always uses production credentials since sandbox has no real listings
// Use EBAY_PROD_* env vars if available, otherwise fall back to regular EBAY_* vars
const EBAY_CONFIG = {
  appId: process.env.EBAY_PROD_APP_ID || process.env.EBAY_APP_ID || '',
  certId: process.env.EBAY_PROD_CERT_ID || process.env.EBAY_CERT_ID || '',
  // Always use production for Browse API - sandbox has no inventory to search
  sandbox: false,
};

// Cache for application token
let appTokenCache: { token: string; expiresAt: number } | null = null;

// =============================================================================
// Application Token (Client Credentials)
// =============================================================================

/**
 * Get an application access token using client credentials grant
 * This doesn't require user authentication - just app credentials
 */
async function getApplicationToken(): Promise<string> {
  // Validate credentials
  if (!EBAY_CONFIG.appId || !EBAY_CONFIG.certId) {
    throw new Error('eBay API credentials not configured');
  }

  // Check cache first
  if (appTokenCache && Date.now() < appTokenCache.expiresAt - 60000) {
    return appTokenCache.token;
  }

  const tokenUrl = EBAY_CONFIG.sandbox
    ? EBAY_API_URLS.sandbox.token
    : EBAY_API_URLS.production.token;

  const credentials = Buffer.from(
    `${EBAY_CONFIG.appId}:${EBAY_CONFIG.certId}`
  ).toString('base64');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[eBay Browse] Failed to get application token:', response.status);

    // Parse error for more details
    let errorDetail = `Failed to get eBay application token: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error_description) {
        errorDetail = errorJson.error_description;
      } else if (errorJson.error) {
        errorDetail = errorJson.error;
      }
    } catch {
      // Use status code
    }

    throw new Error(errorDetail);
  }

  const data = await response.json();

  // Cache the token
  appTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return data.access_token;
}

// =============================================================================
// Browse API Search
// =============================================================================

/**
 * Search eBay for active listings and get price data
 */
export async function searchEbayPrices(
  query: string,
  options: {
    categoryId?: string;
    limit?: number;
    minPrice?: number;
    maxPrice?: number;
    condition?: 'NEW' | 'USED' | 'GRADED';
    relevanceFilter?: { playerLastName?: string; cardNumber?: string; year?: string; };
  } = {}
): Promise<EbayPriceSearchResult> {
  const token = await getApplicationToken();

  const apiUrl = EBAY_CONFIG.sandbox
    ? EBAY_API_URLS.sandbox.api
    : EBAY_API_URLS.production.api;

  // Build filter string
  const filters: string[] = [];

  if (options.minPrice !== undefined || options.maxPrice !== undefined) {
    const min = options.minPrice ?? 0;
    const max = options.maxPrice ?? 10000;
    filters.push(`price:[${min}..${max}]`);
    filters.push('priceCurrency:USD');
  }

  if (options.categoryId) {
    // Single category ID - no curly braces needed
    // Curly braces are only for multiple categories: {id1|id2|id3}
    filters.push(`categoryIds:${options.categoryId}`);
  }

  // Build query params
  const params = new URLSearchParams({
    q: query,
    limit: String(options.limit || 20),
  });

  if (filters.length > 0) {
    params.set('filter', filters.join(','));
  }

  // Sort by price to get range
  params.set('sort', 'price');

  const searchUrl = `${apiUrl}/buy/browse/v1/item_summary/search?${params.toString()}`;

  const response = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    },
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error('[eBay Browse] Search failed:', response.status, responseText);
    throw new Error(`eBay search failed: ${response.status} - ${responseText.substring(0, 200)}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error('[eBay Browse] Failed to parse response:', responseText.substring(0, 500));
    throw new Error('Failed to parse eBay response');
  }

  // Parse results
  let items: EbayPriceResult[] = (data.itemSummaries || []).map((item: any) => ({
    itemId: item.itemId,
    title: item.title,
    price: parseFloat(item.price?.value || '0'),
    currency: item.price?.currency || 'USD',
    condition: item.condition || 'Unknown',
    itemWebUrl: item.itemWebUrl,
    imageUrl: item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl,
    seller: item.seller ? {
      username: item.seller.username,
      feedbackScore: item.seller.feedbackScore || 0,
      feedbackPercentage: item.seller.feedbackPercentage || '0%',
    } : undefined,
    shippingCost: item.shippingOptions?.[0]?.shippingCost?.value
      ? parseFloat(item.shippingOptions[0].shippingCost.value)
      : undefined,
    itemLocation: item.itemLocation?.postalCode
      ? `${item.itemLocation.city || ''}, ${item.itemLocation.stateOrProvince || ''}`
      : undefined,
    buyingOptions: item.buyingOptions || [],
    currentBidPrice: item.currentBidPrice?.value
      ? parseFloat(item.currentBidPrice.value)
      : undefined,
    bidCount: item.bidCount,
  }));

  // Apply relevance filter if provided (removes non-card items like magazines, books)
  if (options.relevanceFilter) {
    items = filterRelevantItems(items, options.relevanceFilter);
  }

  // Calculate price statistics
  const prices = items.map(i => i.price).filter(p => p > 0);
  const lowestPrice = prices.length > 0 ? Math.min(...prices) : undefined;
  const highestPrice = prices.length > 0 ? Math.max(...prices) : undefined;
  const averagePrice = prices.length > 0
    ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
    : undefined;

  // Calculate median price (more resistant to outliers than average)
  let medianPrice: number | undefined;
  if (prices.length > 0) {
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianPrice = sorted.length % 2 !== 0
      ? sorted[mid]
      : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
  }

  return {
    total: options.relevanceFilter ? items.length : (data.total || 0),
    items,
    lowestPrice,
    highestPrice,
    averagePrice,
    medianPrice,
  };
}

// =============================================================================
// Relevance Filtering
// =============================================================================

/**
 * Filter eBay results to only items that are actually relevant trading cards.
 * Prevents irrelevant items (magazines, books, etc.) from polluting price data.
 */
function filterRelevantItems(
  items: EbayPriceResult[],
  filter: { playerLastName?: string; cardNumber?: string; year?: string; }
): EbayPriceResult[] {
  // If no filter criteria, return all
  if (!filter.playerLastName && !filter.cardNumber && !filter.year) return items;

  return items.filter(item => {
    const titleLower = item.title.toLowerCase();

    // Match player last name in title → relevant
    if (filter.playerLastName && titleLower.includes(filter.playerLastName.toLowerCase())) return true;

    // Match card number in title → relevant
    if (filter.cardNumber && titleLower.includes(filter.cardNumber.toLowerCase())) return true;

    // Match year + card keyword → relevant
    if (filter.year && titleLower.includes(filter.year)) {
      const cardKeywords = [
        'card', 'trading', '#', 'rookie', 'rc', 'psa', 'bgs', 'sgc', 'cgc', 'graded',
        'topps', 'panini', 'upper deck', 'bowman', 'fleer', 'o-pee-chee', 'opc', 'parkhurst',
      ];
      if (cardKeywords.some(kw => titleLower.includes(kw))) return true;
    }

    return false;
  });
}

// =============================================================================
// Query Building Utilities
// =============================================================================

/**
 * Clean up a string for eBay search - remove special chars and extra info
 */
function cleanSearchTerm(term: string): string {
  return term
    // Remove special characters except spaces, alphanumeric, and #
    .replace(/[^\w\s#]/g, ' ')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

/**
 * Extract just the player/character name (first 2-3 words usually)
 */
function extractPlayerName(featured: string): string {
  const cleaned = cleanSearchTerm(featured);
  const words = cleaned.split(' ');
  // Most player names are 2-3 words (First Last or First Middle Last)
  if (words.length <= 3) {
    return cleaned;
  }
  // Take first 2-3 words for the name
  return words.slice(0, 3).join(' ');
}

/**
 * Extract the main set/brand name without subset details
 */
function extractMainSetName(cardSet: string): string {
  // Split on hyphen FIRST before cleaning (cleanSearchTerm removes hyphens)
  // e.g., "SELECT WWE - Prizm" -> "SELECT WWE"
  const mainSet = cardSet.split(/\s*-\s*/)[0].trim();
  return cleanSearchTerm(mainSet);
}

/**
 * Extract just the brand name (e.g., "Prizm" from "Panini Prizm")
 */
function extractBrandOnly(cardSet: string): string {
  const mainSet = extractMainSetName(cardSet);
  // Common patterns: "Panini Prizm" -> "Prizm", "Topps Chrome" -> "Chrome"
  const words = mainSet.split(' ');
  if (words.length >= 2) {
    // Skip manufacturer names (but keep product line names like "Select", "Prizm", etc.)
    const skipWords = [
      // Modern
      'panini', 'topps', 'upper', 'deck', 'bowman', 'donruss', 'fleer', 'score',
      'leaf', 'sage', 'press', 'pass', 'playoff', 'pinnacle', 'skybox', 'hoops',
      // Vintage
      'imperial', 'tobacco', 'parkhurst', 'o-pee-chee', 'goudey', 'national', 'chicle',
      'american', 'caramel', 'colgate', 'hamilton',
      // Suffixes
      'gum', 'company', 'co', 'inc', 'ltd',
    ];
    const filtered = words.filter(w => !skipWords.includes(w.toLowerCase()));
    if (filtered.length > 0) {
      return filtered.join(' ');
    }
  }
  return mainSet;
}

/**
 * Get the parallel/variant name in eBay bracket format
 * eBay listings commonly use: "[Silver Prizm]", "[Refractor]", etc.
 */
function formatParallelForSearch(subset?: string, rarity?: string): string | null {
  // Prefer subset (specific name like "Silver Prizm") over rarity type ("Parallel")
  const parallel = subset || rarity;
  if (!parallel) return null;

  const cleaned = cleanSearchTerm(parallel);

  // Skip generic rarity types that don't help search
  const genericTypes = ['base', 'common', 'parallel', 'insert', 'variant'];
  if (genericTypes.includes(cleaned.toLowerCase())) {
    return null;
  }

  // Return cleaned parallel name (without brackets - we'll add strategically)
  return cleaned;
}

export interface SportsCardQueryOptions {
  card_name?: string;
  featured?: string;
  card_set?: string;
  card_number?: string;
  release_date?: string;
  subset?: string;
  rarity_or_variant?: string;
  manufacturer?: string;
  serial_numbering?: string;
  rookie_card?: boolean;
  sport?: string;  // "Hockey", "Baseball", "Football", etc.
}

export interface QueryStrategy {
  query: string;
  strategy: 'specific' | 'moderate' | 'broad' | 'minimal';
  description: string;
}

/**
 * Clean and extract card number from various formats
 * Handles: "RA-ABS", "#123", "NO. 45", "Card Number: 123", etc.
 */
function cleanCardNumber(cardNumber?: string): string | null {
  if (!cardNumber) return null;

  const cleaned = cardNumber
    // Remove common label prefixes that might be included
    .replace(/^(Card\s*Number|Card\s*#|Number|No\.?)\s*:?\s*/i, '')
    // Remove # prefix (we'll add it back)
    .replace(/^#\s*/, '')
    // Remove "NO." prefix
    .replace(/^NO\.?\s*/i, '')
    // Remove newlines and extra whitespace
    .replace(/[\r\n]+/g, ' ')
    .trim();

  // If empty after cleaning, return null
  if (!cleaned || cleaned.length === 0) return null;

  // Take only the first "word" if there are multiple (avoid label text)
  // But preserve hyphens within card numbers like "RA-ABS"
  const firstPart = cleaned.split(/\s+/)[0];

  return firstPart || null;
}

/**
 * Build multiple search queries with fallback strategies
 * Returns queries from most specific to most broad
 */
export function buildSportsCardQueries(card: SportsCardQueryOptions): QueryStrategy[] {
  const queries: QueryStrategy[] = [];

  // Extract components
  const playerName = card.featured ? extractPlayerName(card.featured) : null;
  const year = card.release_date?.substring(0, 4);
  const validYear = year && !isNaN(Number(year)) && parseInt(year) >= 1900 ? year : null;
  const mainSet = card.card_set ? extractMainSetName(card.card_set) : null;
  const brandOnly = card.card_set ? extractBrandOnly(card.card_set) : null;
  const cardNumber = cleanCardNumber(card.card_number);
  const parallel = formatParallelForSearch(card.subset, card.rarity_or_variant);

  // Sport context for fallback queries (mirrors Pokemon's "Pokemon card" pattern)
  const sport = card.sport?.toLowerCase() || null;
  const yearNum = validYear ? parseInt(validYear) : null;
  const isVintage = yearNum !== null && yearNum < 1980;
  // e.g. "hockey card" or just "card" if no sport specified
  const sportCardSuffix = sport ? `${sport} card` : 'card';

  // Check if it's a numbered card (serial like /99)
  const isNumbered = card.serial_numbering && /\/\d+/.test(card.serial_numbering);
  const serialStr = isNumbered ? card.serial_numbering : null;

  // Helper: format card number (# prefix only for numeric)
  const formatCardNum = (num: string) => {
    const isNumeric = /^\d+$/.test(num);
    return isNumeric ? `#${num}` : num;
  };

  // Strategy 1: SPECIFIC - Player + [Parallel] + CardNumber + Year + Set
  // Example: "Patrick Mahomes [Silver Prizm] #1 2024 Panini Prizm"
  // Example: "Matthew Stafford [Silver Bar] SS-MS 2021 Impeccable Football"
  if (playerName) {
    const parts: string[] = [playerName];
    if (parallel) parts.push(`[${parallel}]`);
    if (cardNumber) parts.push(formatCardNum(cardNumber));
    if (validYear) parts.push(validYear);
    if (mainSet) parts.push(mainSet);
    if (serialStr) parts.push(serialStr);

    if (parts.length >= 3) {
      queries.push({
        query: parts.join(' '),
        strategy: 'specific',
        description: 'Exact match with parallel and card number',
      });
    }
  }

  // Strategy 2: MODERATE - Player + CardNumber + Year + Set + Parallel (no brackets)
  // Example: "Patrick Mahomes #1 2024 Prizm Silver"
  // Example: "Matthew Stafford SS-MS 2021 Impeccable Silver Bar"
  if (playerName) {
    const parts: string[] = [playerName];
    if (cardNumber) parts.push(formatCardNum(cardNumber));
    if (validYear) parts.push(validYear);
    if (brandOnly) parts.push(brandOnly);
    if (parallel) parts.push(parallel);

    if (parts.length >= 3) {
      queries.push({
        query: parts.join(' '),
        strategy: 'moderate',
        description: 'Card number with parallel name',
      });
    }
  }

  // Strategy 3: BROAD - Player + Year + Set + CardNumber (no parallel)
  // For vintage cards without a recognized brand, append sport keyword
  // Example: "Patrick Mahomes 2024 Prizm #1"
  // Example: "Don Smith 1911 C55 hockey"
  if (playerName) {
    const parts: string[] = [playerName];
    if (validYear) parts.push(validYear);
    if (brandOnly) parts.push(brandOnly);
    if (cardNumber) parts.push(formatCardNum(cardNumber));
    // For vintage cards, add sport keyword to prevent irrelevant results
    if (isVintage && sport && !brandOnly) parts.push(sport);

    if (parts.length >= 2) {
      queries.push({
        query: parts.join(' '),
        strategy: 'broad',
        description: 'Player with year and set',
      });
    }
  }

  // Strategy 4: MINIMAL - Player + Brand + Year + Card Number + sport card context
  // Example: "Patrick Mahomes Prizm 2024 #1" or "Don Smith C55 1911 hockey card"
  if (playerName) {
    const parts: string[] = [playerName];
    if (brandOnly) parts.push(brandOnly);
    if (validYear) parts.push(validYear);
    // Include card number without # prefix for alphanumeric numbers like "SS-MS"
    if (cardNumber) {
      // Only add # prefix for purely numeric card numbers
      const isNumeric = /^\d+$/.test(cardNumber);
      parts.push(isNumeric ? `#${cardNumber}` : cardNumber);
    }
    if (card.rookie_card) parts.push('Rookie');
    // Add sport card context to prevent irrelevant results in fallback
    parts.push(sportCardSuffix);

    queries.push({
      query: parts.join(' '),
      strategy: 'minimal',
      description: 'Basic player, brand, and card number search',
    });
  }

  // Strategy 5: FALLBACK - Player + Brand + sport card
  // For when card number might be causing zero results
  // Example: "Don Smith C55 hockey card"
  if (playerName && brandOnly) {
    queries.push({
      query: `${playerName} ${brandOnly} ${sportCardSuffix}`,
      strategy: 'minimal',
      description: 'Player and brand only',
    });
  }

  // Fallback: Just player name + sport card if nothing else works
  // Example: "Don Smith hockey card" instead of just "Don Smith"
  if (queries.length === 0 && playerName) {
    queries.push({
      query: `${playerName} ${sportCardSuffix}`,
      strategy: 'minimal',
      description: 'Player name only',
    });
  }

  return queries;
}

/**
 * Build a single search query for a sports card (legacy compatibility)
 * Uses the moderate strategy by default
 */
export function buildSportsCardQuery(card: SportsCardQueryOptions): string {
  const queries = buildSportsCardQueries(card);
  // Return the moderate strategy query, or first available
  const moderate = queries.find(q => q.strategy === 'moderate');
  return moderate?.query || queries[0]?.query || '';
}

/**
 * Search with fallback - tries multiple queries until finding results
 * Returns the first query that finds at least minResults listings
 */
export async function searchEbayPricesWithFallback(
  card: SportsCardQueryOptions,
  options: {
    categoryId?: string;
    limit?: number;
    minResults?: number;
    relevanceFilter?: { playerLastName?: string; cardNumber?: string; year?: string; };
  } = {}
): Promise<EbayPriceSearchResult & { queryUsed: string; queryStrategy: string }> {
  const queries = buildSportsCardQueries(card);
  const minResults = options.minResults ?? 3;
  const limit = options.limit ?? 25;

  let lastResult: EbayPriceSearchResult | null = null;
  let lastQuery: QueryStrategy | null = null;
  // Track the best result from a more specific strategy (not the broadest fallback)
  let bestSpecificResult: EbayPriceSearchResult | null = null;
  let bestSpecificQuery: QueryStrategy | null = null;

  for (const queryInfo of queries) {
    try {
      const result = await searchEbayPrices(queryInfo.query, {
        categoryId: options.categoryId,
        limit,
        relevanceFilter: options.relevanceFilter,
      });

      // If we found enough results, return immediately
      if (result.total >= minResults) {
        return {
          ...result,
          queryUsed: queryInfo.query,
          queryStrategy: queryInfo.strategy,
        };
      }

      // Track best result from specific/moderate/broad strategies (which include card number)
      // Prefer these over minimal fallback to keep card number in results
      if (result.total > 0 && queryInfo.strategy !== 'minimal') {
        if (!bestSpecificResult || result.total > bestSpecificResult.total) {
          bestSpecificResult = result;
          bestSpecificQuery = queryInfo;
        }
      }

      // Track overall best result in case all queries fail to meet threshold
      if (!lastResult || result.total > lastResult.total) {
        lastResult = result;
        lastQuery = queryInfo;
      }
    } catch (error) {
      // Continue to next query on error
      console.error(`[eBay Search] Query failed: "${queryInfo.query}"`, error);
    }
  }

  // Prefer a more specific result (with card number) if it found at least 1 listing
  if (bestSpecificResult && bestSpecificQuery) {
    return {
      ...bestSpecificResult,
      queryUsed: bestSpecificQuery.query,
      queryStrategy: bestSpecificQuery.strategy,
    };
  }

  // Fall back to broadest result
  if (lastResult && lastQuery) {
    return {
      ...lastResult,
      queryUsed: lastQuery.query,
      queryStrategy: lastQuery.strategy,
    };
  }

  // No results from any query
  return {
    total: 0,
    items: [],
    queryUsed: queries[0]?.query || '',
    queryStrategy: queries[0]?.strategy || 'minimal',
  };
}

// =============================================================================
// Pokemon/CCG Card Query Building
// =============================================================================

export interface PokemonCardQueryOptions {
  card_name?: string;        // Full card name like "Team Rocket's Mewtwo ex"
  featured?: string;         // Pokemon/character name like "Mewtwo"
  card_set?: string;         // Set name like "Surging Sparks"
  card_number?: string;      // Card number like "231/182" or "025"
  release_date?: string;     // Year like "2024"
  subset?: string;           // Variant like "Full Art", "Holo"
  rarity_or_variant?: string;
  manufacturer?: string;
}

/**
 * Clean Pokemon card name for search
 * Preserves important terms like "ex", "V", "VMAX", "GX", etc.
 */
function cleanPokemonCardName(name: string): string {
  return name
    // Replace apostrophes with space (eBay doesn't handle them well)
    .replace(/['`']/g, ' ')
    // Remove other special characters except spaces and alphanumeric
    .replace(/[^\w\s]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format Pokemon card number for search
 * Handles formats like "231/182", "025", "SV049"
 */
function formatPokemonCardNumber(cardNumber: string): string {
  // Clean up the number
  const cleaned = cardNumber
    .replace(/^(Card\s*Number|Card\s*#|Number|No\.?)\s*:?\s*/i, '')
    .replace(/^#\s*/, '')
    .trim();

  // Keep the full format (e.g., "231/182") as-is for Pokemon
  // This is different from sports cards which use just the base number
  return cleaned;
}

/**
 * Build search queries specifically for Pokemon/CCG cards
 * Pokemon cards are best found by: Card Name + Card Number
 */
export function buildPokemonCardQueries(card: PokemonCardQueryOptions): QueryStrategy[] {
  const queries: QueryStrategy[] = [];

  // For Pokemon, card_name is the most important field
  const cardName = card.card_name ? cleanPokemonCardName(card.card_name) : null;
  const pokemonName = card.featured ? cleanPokemonCardName(card.featured) : null;
  const cardNumber = card.card_number ? formatPokemonCardNumber(card.card_number) : null;
  const setName = card.card_set ? cleanSearchTerm(card.card_set) : null;
  const year = card.release_date?.substring(0, 4);
  const validYear = year && !isNaN(Number(year)) && parseInt(year) >= 1900 ? year : null;
  const variant = card.subset || card.rarity_or_variant;
  const cleanVariant = variant ? cleanSearchTerm(variant) : null;

  // Skip generic variants that don't help
  const skipVariants = ['base', 'common', 'uncommon', 'rare', 'holo rare'];
  const useVariant = cleanVariant && !skipVariants.includes(cleanVariant.toLowerCase());

  // Strategy 1: SPECIFIC - Full card name + card number + set
  // Example: "Team Rocket s Mewtwo ex 231/182 Surging Sparks"
  if (cardName && cardNumber) {
    const parts = [cardName, cardNumber];
    if (setName) parts.push(setName);

    queries.push({
      query: parts.join(' '),
      strategy: 'specific',
      description: 'Full card name with number and set',
    });
  }

  // Strategy 2: MODERATE - Card name + card number (no set)
  // Example: "Team Rocket s Mewtwo ex 231/182"
  if (cardName && cardNumber) {
    queries.push({
      query: `${cardName} ${cardNumber}`,
      strategy: 'moderate',
      description: 'Card name with number',
    });
  }

  // Strategy 3: MODERATE - Card name + set + variant
  // Example: "Team Rocket s Mewtwo ex Surging Sparks"
  if (cardName && setName) {
    const parts = [cardName, setName];
    if (useVariant) parts.push(cleanVariant!);

    queries.push({
      query: parts.join(' '),
      strategy: 'moderate',
      description: 'Card name with set',
    });
  }

  // Strategy 4: BROAD - Pokemon name + card number + "Pokemon"
  // Example: "Mewtwo ex 231/182 Pokemon"
  if (pokemonName && cardNumber) {
    // Add "ex", "V", "VMAX", "GX" suffix if it appears in card name but not in pokemon name
    let searchName = pokemonName;
    if (cardName) {
      const suffixes = ['ex', 'EX', 'V', 'VMAX', 'VSTAR', 'GX', 'Tag Team'];
      for (const suffix of suffixes) {
        if (cardName.toLowerCase().includes(suffix.toLowerCase()) &&
            !pokemonName.toLowerCase().includes(suffix.toLowerCase())) {
          searchName = `${pokemonName} ${suffix}`;
          break;
        }
      }
    }

    queries.push({
      query: `${searchName} ${cardNumber} Pokemon`,
      strategy: 'broad',
      description: 'Pokemon name with number',
    });
  }

  // Strategy 5: MINIMAL - Just card name + "Pokemon card"
  // Example: "Team Rocket s Mewtwo ex Pokemon card"
  if (cardName) {
    queries.push({
      query: `${cardName} Pokemon card`,
      strategy: 'minimal',
      description: 'Card name with Pokemon card keyword',
    });
  }

  // Strategy 6: FALLBACK - Pokemon name + set
  // Example: "Mewtwo Surging Sparks"
  if (pokemonName && setName) {
    queries.push({
      query: `${pokemonName} ${setName} Pokemon`,
      strategy: 'minimal',
      description: 'Pokemon and set name',
    });
  }

  // Final fallback: Just the pokemon name
  if (queries.length === 0 && pokemonName) {
    queries.push({
      query: `${pokemonName} Pokemon card`,
      strategy: 'minimal',
      description: 'Pokemon name only',
    });
  }

  return queries;
}

/**
 * Search with fallback for Pokemon/CCG cards
 */
export async function searchPokemonPricesWithFallback(
  card: PokemonCardQueryOptions,
  options: {
    categoryId?: string;
    limit?: number;
    minResults?: number;
  } = {}
): Promise<EbayPriceSearchResult & { queryUsed: string; queryStrategy: string }> {
  const queries = buildPokemonCardQueries(card);
  const minResults = options.minResults ?? 3;
  const limit = options.limit ?? 25;

  console.log(`[eBay Pokemon] Searching with ${queries.length} query strategies`);

  let lastResult: EbayPriceSearchResult | null = null;
  let lastQuery: QueryStrategy | null = null;

  for (const queryInfo of queries) {
    try {
      const result = await searchEbayPrices(queryInfo.query, {
        categoryId: options.categoryId,
        limit,
      });

      // If we found enough results, return immediately
      if (result.total >= minResults) {
        return {
          ...result,
          queryUsed: queryInfo.query,
          queryStrategy: queryInfo.strategy,
        };
      }

      // Track this result in case all queries fail to meet threshold
      if (!lastResult || result.total > lastResult.total) {
        lastResult = result;
        lastQuery = queryInfo;
      }
    } catch (error) {
      console.error(`[eBay Pokemon Search] Query failed: "${queryInfo.query}"`, error);
    }
  }

  // Return best result we found, even if below threshold
  if (lastResult && lastQuery) {
    return {
      ...lastResult,
      queryUsed: lastQuery.query,
      queryStrategy: lastQuery.strategy,
    };
  }

  // No results from any query
  return {
    total: 0,
    items: [],
    queryUsed: queries[0]?.query || '',
    queryStrategy: queries[0]?.strategy || 'minimal',
  };
}

// =============================================================================
// MTG Card Query Building
// =============================================================================

export interface MTGCardQueryOptions {
  card_name?: string;        // Card name like "Lightning Bolt"
  card_set?: string;         // Set name like "Modern Horizons 3"
  card_number?: string;      // Collector number like "150"
  release_date?: string;     // Year like "2024"
  rarity?: string;           // Rarity like "Rare", "Mythic"
  is_foil?: boolean;         // Foil card
  foil_type?: string;        // Type of foil (etched, etc.)
  manufacturer?: string;     // Usually "Wizards of the Coast"
}

/**
 * Clean MTG card name for search
 */
function cleanMTGCardName(name: string): string {
  return name
    // Remove special characters except spaces, alphanumeric, commas, and apostrophes
    .replace(/[^\w\s,'-]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build search queries specifically for MTG cards
 * MTG cards are best found by: Card Name + Set Name + Collector Number
 */
export function buildMTGCardQueries(card: MTGCardQueryOptions): QueryStrategy[] {
  const queries: QueryStrategy[] = [];

  const cardName = card.card_name ? cleanMTGCardName(card.card_name) : null;
  const setName = card.card_set ? cleanSearchTerm(card.card_set) : null;
  const cardNumber = card.card_number ? card.card_number.trim() : null;
  const year = card.release_date?.substring(0, 4);
  const validYear = year && !isNaN(Number(year)) && parseInt(year) >= 1900 ? year : null;
  const isFoil = card.is_foil || false;
  const foilStr = isFoil ? 'foil' : null;

  // Strategy 1: SPECIFIC - Card name + set + collector number + foil
  // Example: "Lightning Bolt Modern Horizons 3 150 foil MTG"
  if (cardName && setName && cardNumber) {
    const parts = [cardName, setName, cardNumber];
    if (foilStr) parts.push(foilStr);

    queries.push({
      query: parts.join(' ') + ' MTG',
      strategy: 'specific',
      description: 'Full card name with set and collector number',
    });
  }

  // Strategy 2: MODERATE - Card name + set + foil
  // Example: "Lightning Bolt Modern Horizons 3 foil MTG"
  if (cardName && setName) {
    const parts = [cardName, setName];
    if (foilStr) parts.push(foilStr);

    queries.push({
      query: parts.join(' ') + ' MTG',
      strategy: 'moderate',
      description: 'Card name with set',
    });
  }

  // Strategy 3: MODERATE - Card name + collector number + MTG
  // Example: "Lightning Bolt 150 MTG"
  if (cardName && cardNumber) {
    queries.push({
      query: `${cardName} ${cardNumber} MTG`,
      strategy: 'moderate',
      description: 'Card name with collector number',
    });
  }

  // Strategy 4: BROAD - Card name + year + MTG
  // Example: "Lightning Bolt 2024 MTG"
  if (cardName && validYear) {
    const parts = [cardName, validYear];
    if (foilStr) parts.push(foilStr);

    queries.push({
      query: parts.join(' ') + ' MTG',
      strategy: 'broad',
      description: 'Card name with year',
    });
  }

  // Strategy 5: MINIMAL - Just card name + MTG
  // Example: "Lightning Bolt MTG card"
  if (cardName) {
    queries.push({
      query: `${cardName} MTG card`,
      strategy: 'minimal',
      description: 'Card name only',
    });
  }

  // Final fallback
  if (queries.length === 0 && cardName) {
    queries.push({
      query: `${cardName} Magic the Gathering`,
      strategy: 'minimal',
      description: 'Card name with full game name',
    });
  }

  return queries;
}

/**
 * Search with fallback for MTG cards
 */
export async function searchMTGPricesWithFallback(
  card: MTGCardQueryOptions,
  options: {
    categoryId?: string;
    limit?: number;
    minResults?: number;
  } = {}
): Promise<EbayPriceSearchResult & { queryUsed: string; queryStrategy: string }> {
  const queries = buildMTGCardQueries(card);
  const minResults = options.minResults ?? 3;
  const limit = options.limit ?? 25;

  console.log(`[eBay MTG] Searching with ${queries.length} query strategies`);

  let lastResult: EbayPriceSearchResult | null = null;
  let lastQuery: QueryStrategy | null = null;

  for (const queryInfo of queries) {
    try {
      const result = await searchEbayPrices(queryInfo.query, {
        categoryId: options.categoryId,
        limit,
      });

      if (result.total >= minResults) {
        return {
          ...result,
          queryUsed: queryInfo.query,
          queryStrategy: queryInfo.strategy,
        };
      }

      if (!lastResult || result.total > lastResult.total) {
        lastResult = result;
        lastQuery = queryInfo;
      }
    } catch (error) {
      console.error(`[eBay MTG Search] Query failed: "${queryInfo.query}"`, error);
    }
  }

  if (lastResult && lastQuery) {
    return {
      ...lastResult,
      queryUsed: lastQuery.query,
      queryStrategy: lastQuery.strategy,
    };
  }

  return {
    total: 0,
    items: [],
    queryUsed: queries[0]?.query || '',
    queryStrategy: queries[0]?.strategy || 'minimal',
  };
}

// =============================================================================
// Lorcana Card Query Building
// =============================================================================

export interface LorcanaCardQueryOptions {
  card_name?: string;        // Card name like "Elsa, Snow Queen"
  card_set?: string;         // Set name like "The First Chapter"
  card_number?: string;      // Card number like "042"
  release_date?: string;     // Year like "2024"
  rarity?: string;           // Rarity like "Legendary", "Enchanted"
  ink_color?: string;        // Ink color like "Sapphire", "Amber"
  is_foil?: boolean;         // Foil/enchanted card
}

/**
 * Clean Lorcana card name for search
 */
function cleanLorcanaCardName(name: string): string {
  return name
    // Remove special characters except spaces, alphanumeric, commas, and hyphens
    .replace(/[^\w\s,'-]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build search queries specifically for Lorcana cards
 * Lorcana cards are best found by: Card Name + Set Name + Card Number
 */
export function buildLorcanaCardQueries(card: LorcanaCardQueryOptions): QueryStrategy[] {
  const queries: QueryStrategy[] = [];

  const cardName = card.card_name ? cleanLorcanaCardName(card.card_name) : null;
  const setName = card.card_set ? cleanSearchTerm(card.card_set) : null;
  const cardNumber = card.card_number ? card.card_number.trim() : null;
  const year = card.release_date?.substring(0, 4);
  const validYear = year && !isNaN(Number(year)) && parseInt(year) >= 1900 ? year : null;
  const isFoil = card.is_foil || false;
  const foilStr = isFoil ? 'foil' : null;
  const rarity = card.rarity ? cleanSearchTerm(card.rarity) : null;

  // Strategy 1: SPECIFIC - Card name + set + card number
  // Example: "Elsa Snow Queen The First Chapter 042 Lorcana"
  if (cardName && setName && cardNumber) {
    const parts = [cardName, setName, cardNumber];
    if (foilStr) parts.push(foilStr);

    queries.push({
      query: parts.join(' ') + ' Lorcana',
      strategy: 'specific',
      description: 'Full card name with set and number',
    });
  }

  // Strategy 2: MODERATE - Card name + set
  // Example: "Elsa Snow Queen The First Chapter Lorcana"
  if (cardName && setName) {
    const parts = [cardName, setName];
    if (foilStr) parts.push(foilStr);

    queries.push({
      query: parts.join(' ') + ' Lorcana',
      strategy: 'moderate',
      description: 'Card name with set',
    });
  }

  // Strategy 3: MODERATE - Card name + card number
  // Example: "Elsa Snow Queen 042 Lorcana"
  if (cardName && cardNumber) {
    queries.push({
      query: `${cardName} ${cardNumber} Lorcana`,
      strategy: 'moderate',
      description: 'Card name with number',
    });
  }

  // Strategy 4: BROAD - Card name + rarity (for enchanted/legendary)
  // Example: "Elsa Snow Queen Enchanted Lorcana"
  if (cardName && rarity && ['enchanted', 'legendary'].includes(rarity.toLowerCase())) {
    queries.push({
      query: `${cardName} ${rarity} Lorcana`,
      strategy: 'broad',
      description: 'Card name with rarity',
    });
  }

  // Strategy 5: MINIMAL - Just card name + Lorcana
  // Example: "Elsa Snow Queen Lorcana card"
  if (cardName) {
    queries.push({
      query: `${cardName} Lorcana card`,
      strategy: 'minimal',
      description: 'Card name only',
    });
  }

  // Final fallback
  if (queries.length === 0 && cardName) {
    queries.push({
      query: `${cardName} Disney Lorcana`,
      strategy: 'minimal',
      description: 'Card name with Disney Lorcana',
    });
  }

  return queries;
}

/**
 * Search with fallback for Lorcana cards
 */
export async function searchLorcanaPricesWithFallback(
  card: LorcanaCardQueryOptions,
  options: {
    categoryId?: string;
    limit?: number;
    minResults?: number;
  } = {}
): Promise<EbayPriceSearchResult & { queryUsed: string; queryStrategy: string }> {
  const queries = buildLorcanaCardQueries(card);
  const minResults = options.minResults ?? 3;
  const limit = options.limit ?? 25;

  console.log(`[eBay Lorcana] Searching with ${queries.length} query strategies`);

  let lastResult: EbayPriceSearchResult | null = null;
  let lastQuery: QueryStrategy | null = null;

  for (const queryInfo of queries) {
    try {
      const result = await searchEbayPrices(queryInfo.query, {
        categoryId: options.categoryId,
        limit,
      });

      if (result.total >= minResults) {
        return {
          ...result,
          queryUsed: queryInfo.query,
          queryStrategy: queryInfo.strategy,
        };
      }

      if (!lastResult || result.total > lastResult.total) {
        lastResult = result;
        lastQuery = queryInfo;
      }
    } catch (error) {
      console.error(`[eBay Lorcana Search] Query failed: "${queryInfo.query}"`, error);
    }
  }

  if (lastResult && lastQuery) {
    return {
      ...lastResult,
      queryUsed: lastQuery.query,
      queryStrategy: lastQuery.strategy,
    };
  }

  return {
    total: 0,
    items: [],
    queryUsed: queries[0]?.query || '',
    queryStrategy: queries[0]?.strategy || 'minimal',
  };
}

// =============================================================================
// One Piece Card Query Building
// =============================================================================

export interface OnePieceCardQueryOptions {
  card_name?: string;        // Card name like "Monkey D. Luffy"
  featured?: string;         // Character name
  card_set?: string;         // Set name like "Romance Dawn" or "OP-01"
  card_number?: string;      // Card number like "OP01-001"
  release_date?: string;     // Year like "2024"
  rarity?: string;           // Rarity like "L", "SR", "SEC"
  variant_type?: string;     // Variant like "parallel", "manga", "sp"
  is_foil?: boolean;         // Foil/parallel card
}

/**
 * Clean One Piece card name for search
 */
function cleanOnePieceCardName(name: string): string {
  return name
    // Remove special characters except spaces, alphanumeric, periods, and hyphens
    .replace(/[^\w\s.'-]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get the search term for a One Piece card variant
 * Maps variant types to common eBay listing terminology
 */
function getOnePieceVariantSearchTerm(variant: string | null): string | null {
  if (!variant) return null;

  const v = variant.toLowerCase();

  // Parallel variants (foil/holo versions)
  if (v === 'parallel' || v === 'parallel_manga') return 'parallel';

  // Alternate art versions
  if (v === 'alternate_art' || v === 'alt_art' || v === 'alternate') return 'alt art';

  // Manga art versions (different artwork style)
  if (v === 'manga') return 'manga art';

  // SP (Special Parallel) - premium foil variants
  if (v === 'sp' || v === 'special_parallel') return 'SP';

  // SEC (Secret Rare) variants
  if (v === 'sec' || v === 'secret') return 'secret rare';

  // Don/Leader cards
  if (v === 'don' || v === 'leader') return v;

  // Promo variants
  if (v === 'promo') return 'promo';

  return null;
}

/**
 * Build search queries specifically for One Piece cards
 * One Piece cards are best found by: Card Name + Card Number (e.g., "Luffy OP01-001")
 * Variants include: parallel, manga, alternate_art, sp, sec, promo
 */
export function buildOnePieceCardQueries(card: OnePieceCardQueryOptions): QueryStrategy[] {
  const queries: QueryStrategy[] = [];

  const cardName = card.card_name ? cleanOnePieceCardName(card.card_name) : null;
  const featured = card.featured ? cleanOnePieceCardName(card.featured) : null;
  const displayName = cardName || featured;
  const cardNumber = card.card_number ? card.card_number.trim() : null;
  const setName = card.card_set ? cleanSearchTerm(card.card_set) : null;
  const variant = card.variant_type ? card.variant_type.toLowerCase() : null;
  const variantTerm = getOnePieceVariantSearchTerm(variant);
  const hasVariant = variantTerm !== null || card.is_foil;

  // Log variant info for debugging
  console.log(`[eBay One Piece] Building queries - variant_type: "${variant}", variantTerm: "${variantTerm}", is_foil: ${card.is_foil}`);

  // Strategy 1: SPECIFIC - Card name + card number + variant
  // Example: "Luffy OP01-001 alt art One Piece" or "Luffy OP01-001 parallel One Piece"
  if (displayName && cardNumber) {
    const parts = [displayName, cardNumber];
    if (variantTerm) {
      parts.push(variantTerm);
    } else if (card.is_foil) {
      parts.push('parallel'); // Default foil = parallel in One Piece TCG
    }
    parts.push('One Piece');

    queries.push({
      query: parts.join(' '),
      strategy: 'specific',
      description: `Card name with number${hasVariant ? ' and variant' : ''}`,
    });
  }

  // Strategy 2: MODERATE - Card number + variant (One Piece card numbers are fairly unique)
  // Example: "OP01-001 alt art One Piece card"
  if (cardNumber) {
    const parts = [cardNumber];
    if (variantTerm) {
      parts.push(variantTerm);
    } else if (card.is_foil) {
      parts.push('parallel');
    }
    parts.push('One Piece card');

    queries.push({
      query: parts.join(' '),
      strategy: 'moderate',
      description: `Card number${hasVariant ? ' with variant' : ''}`,
    });
  }

  // Strategy 3: MODERATE - Card name + set + variant
  // Example: "Luffy Romance Dawn alt art One Piece"
  if (displayName && setName) {
    const parts = [displayName, setName];
    if (variantTerm) {
      parts.push(variantTerm);
    } else if (card.is_foil) {
      parts.push('parallel');
    }
    parts.push('One Piece');

    queries.push({
      query: parts.join(' '),
      strategy: 'moderate',
      description: `Card name with set${hasVariant ? ' and variant' : ''}`,
    });
  }

  // Strategy 4: BROAD - Card name + variant + One Piece (without number)
  // Example: "Monkey D. Luffy alt art One Piece card"
  if (displayName && hasVariant) {
    const parts = [displayName];
    if (variantTerm) {
      parts.push(variantTerm);
    } else if (card.is_foil) {
      parts.push('parallel');
    }
    parts.push('One Piece card');

    queries.push({
      query: parts.join(' '),
      strategy: 'broad',
      description: 'Card name with variant',
    });
  }

  // Strategy 5: BROAD - Just card name + One Piece (fallback without variant)
  // Example: "Monkey D. Luffy One Piece card"
  if (displayName) {
    queries.push({
      query: `${displayName} One Piece card`,
      strategy: 'broad',
      description: 'Card name only (no variant)',
    });
  }

  // Final fallback - card number only
  if (queries.length === 0 && cardNumber) {
    queries.push({
      query: `${cardNumber} One Piece TCG`,
      strategy: 'minimal',
      description: 'Card number with TCG',
    });
  }

  return queries;
}

/**
 * Search with fallback for One Piece cards
 */
export async function searchOnePiecePricesWithFallback(
  card: OnePieceCardQueryOptions,
  options: {
    categoryId?: string;
    limit?: number;
    minResults?: number;
  } = {}
): Promise<EbayPriceSearchResult & { queryUsed: string; queryStrategy: string }> {
  const queries = buildOnePieceCardQueries(card);
  const minResults = options.minResults ?? 3;
  const limit = options.limit ?? 25;

  console.log(`[eBay One Piece] Searching with ${queries.length} query strategies`);

  let lastResult: EbayPriceSearchResult | null = null;
  let lastQuery: QueryStrategy | null = null;

  for (const queryInfo of queries) {
    try {
      console.log(`[eBay One Piece] Trying: "${queryInfo.query}" (${queryInfo.strategy})`);

      const result = await searchEbayPrices(queryInfo.query, {
        categoryId: options.categoryId,
        limit,
      });

      console.log(`[eBay One Piece] Found ${result.total} results`);

      if (result.total >= minResults) {
        return {
          ...result,
          queryUsed: queryInfo.query,
          queryStrategy: queryInfo.strategy,
        };
      }

      if (!lastResult || result.total > lastResult.total) {
        lastResult = result;
        lastQuery = queryInfo;
      }
    } catch (error) {
      console.error(`[eBay One Piece] Query failed:`, error);
    }
  }

  if (lastResult && lastQuery) {
    return {
      ...lastResult,
      queryUsed: lastQuery.query,
      queryStrategy: lastQuery.strategy,
    };
  }

  return {
    total: 0,
    items: [],
    queryUsed: queries[0]?.query || '',
    queryStrategy: queries[0]?.strategy || 'minimal',
  };
}

// =============================================================================
// Other/Generic Card Query Building
// =============================================================================

export interface OtherCardQueryOptions {
  card_name?: string;        // Card name like "Darth Vader"
  featured?: string;         // Featured person/character like "Luke Skywalker"
  card_set?: string;         // Set/series name like "Star Wars"
  card_number?: string;      // Card number like "42" or "SW-42"
  release_date?: string;     // Year like "1977"
  subset?: string;           // Subset like "Chrome", "Refractor"
  rarity_or_variant?: string;
  manufacturer?: string;     // Like "Topps", "Upper Deck"
}

/**
 * Clean generic card name for search
 * Converts accented characters to ASCII equivalents for better eBay search compatibility
 */
function cleanOtherCardName(name: string): string {
  return name
    // Normalize accented characters to ASCII (ü→u, é→e, ñ→n, etc.)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remove special characters except spaces, alphanumeric, and hyphens
    .replace(/[^\w\s-]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format card number for search - handles various formats
 * Prioritizes keeping the number visible in search
 */
function formatOtherCardNumber(cardNumber: string): string {
  const cleaned = cardNumber
    .replace(/^(Card\s*Number|Card\s*#|Number|No\.?)\s*:?\s*/i, '')
    .replace(/^#\s*/, '')
    .trim();

  // If purely numeric, add # prefix for clarity
  if (/^\d+$/.test(cleaned)) {
    return `#${cleaned}`;
  }

  // Keep alphanumeric card numbers as-is (e.g., "SW-42", "GPK-1a")
  return cleaned;
}

/**
 * Build search queries for generic/Other trading cards
 * Prioritizes: Card Number + Featured Name + Set Name
 */
export function buildOtherCardQueries(card: OtherCardQueryOptions): QueryStrategy[] {
  const queries: QueryStrategy[] = [];

  const cardName = card.card_name ? cleanOtherCardName(card.card_name) : null;
  const featured = card.featured ? cleanOtherCardName(card.featured) : null;
  const setName = card.card_set ? cleanSearchTerm(card.card_set) : null;
  const cardNumber = card.card_number ? formatOtherCardNumber(card.card_number) : null;
  const year = card.release_date?.substring(0, 4);
  const validYear = year && !isNaN(Number(year)) && parseInt(year) >= 1900 ? year : null;
  const manufacturer = card.manufacturer ? cleanSearchTerm(card.manufacturer) : null;
  const subset = card.subset ? cleanSearchTerm(card.subset) : null;

  // Check if this is an autograph card (from subset or set name)
  const isAutograph = subset?.toLowerCase().includes('autograph') ||
                      setName?.toLowerCase().includes('autograph') ||
                      card.card_set?.toLowerCase().includes('autograph');

  // Clean set name - remove "Autograph" if it will be added separately
  const cleanSetName = setName?.replace(/\s*-?\s*Autograph\s*/gi, '').trim() || null;

  // For Other cards (autographs, collectibles), prioritize featured person over card_name
  const primaryName = featured || cardName;

  console.log(`[eBay Other] Building queries - featured: "${featured}", cardName: "${cardName}", setName: "${cleanSetName}", cardNumber: "${cardNumber}", isAutograph: ${isAutograph}`);

  // Strategy 1: SIMPLE - Featured + Card Number (most effective for autograph cards)
  // Example: "Gisele Bundchen BA-GB1"
  if (featured && cardNumber) {
    queries.push({
      query: `${featured} ${cardNumber}`,
      strategy: 'specific',
      description: 'Featured with card number',
    });
  }

  // Strategy 2: Featured + Card Number + Autograph
  // Example: "Gisele Bundchen BA-GB1 autograph"
  if (featured && cardNumber && isAutograph) {
    queries.push({
      query: `${featured} ${cardNumber} autograph`,
      strategy: 'specific',
      description: 'Featured with card number and autograph',
    });
  }

  // Strategy 3: Featured + Set + Card Number
  // Example: "Gisele Bundchen Leaf Pop Century BA-GB1"
  if (featured && cleanSetName && cardNumber) {
    queries.push({
      query: `${featured} ${cleanSetName} ${cardNumber}`,
      strategy: 'specific',
      description: 'Featured with set and card number',
    });
  }

  // Strategy 4: Featured + Autograph + Card
  // Example: "Gisele Bundchen autograph card"
  if (featured && isAutograph) {
    queries.push({
      query: `${featured} autograph card`,
      strategy: 'moderate',
      description: 'Featured autograph card',
    });
  }

  // Strategy 5: Featured + Set
  // Example: "Gisele Bundchen Leaf Pop Century"
  if (featured && cleanSetName) {
    queries.push({
      query: `${featured} ${cleanSetName}`,
      strategy: 'moderate',
      description: 'Featured with set',
    });
  }

  // Strategy 6: Featured + Manufacturer
  // Example: "Gisele Bundchen Leaf"
  if (featured && manufacturer) {
    queries.push({
      query: `${featured} ${manufacturer}`,
      strategy: 'moderate',
      description: 'Featured with manufacturer',
    });
  }

  // Strategy 7: Set + Card Number
  // Example: "Leaf Pop Century BA-GB1"
  if (cleanSetName && cardNumber) {
    queries.push({
      query: `${cleanSetName} ${cardNumber}`,
      strategy: 'moderate',
      description: 'Set with card number',
    });
  }

  // Strategy 8: Featured + Card
  // Example: "Gisele Bundchen card"
  if (featured) {
    queries.push({
      query: `${featured} card`,
      strategy: 'broad',
      description: 'Featured only',
    });
  }

  // Strategy 9: Featured only (most minimal)
  // Example: "Gisele Bundchen"
  if (featured) {
    queries.push({
      query: featured,
      strategy: 'minimal',
      description: 'Featured name only',
    });
  }

  // Strategy 10: FALLBACK - Set + Card Number + trading card
  if (cleanSetName && cardNumber && !featured) {
    queries.push({
      query: `${cleanSetName} ${cardNumber} trading card`,
      strategy: 'minimal',
      description: 'Set with number only',
    });
  }

  return queries;
}

/**
 * Search with fallback for generic/Other trading cards
 * Prioritizes card-number searches - even 1 result with card number is better than many generic results
 */
export async function searchOtherPricesWithFallback(
  card: OtherCardQueryOptions,
  options: {
    categoryId?: string;
    limit?: number;
    minResults?: number;
  } = {}
): Promise<EbayPriceSearchResult & { queryUsed: string; queryStrategy: string }> {
  const queries = buildOtherCardQueries(card);
  const minResults = options.minResults ?? 3;
  const limit = options.limit ?? 25;
  const hasCardNumber = !!card.card_number;

  console.log(`[eBay Other] Searching with ${queries.length} query strategies (hasCardNumber: ${hasCardNumber})`);

  let lastResult: EbayPriceSearchResult | null = null;
  let lastQuery: QueryStrategy | null = null;
  let bestCardNumberResult: EbayPriceSearchResult | null = null;
  let bestCardNumberQuery: QueryStrategy | null = null;

  for (const queryInfo of queries) {
    try {
      const result = await searchEbayPrices(queryInfo.query, {
        categoryId: options.categoryId,
        limit,
      });

      // Check if this query includes the card number
      const queryHasCardNumber = hasCardNumber && queryInfo.query.includes(card.card_number!.replace(/^#/, ''));

      console.log(`[eBay Other] Query "${queryInfo.query}" returned ${result.total} results (hasCardNumber: ${queryHasCardNumber})`);

      // For card-number queries, accept ANY results (even just 1)
      // These are more relevant than generic searches with many results
      if (queryHasCardNumber && result.total >= 1) {
        // Track the best card-number result
        if (!bestCardNumberResult || result.total > bestCardNumberResult.total) {
          bestCardNumberResult = result;
          bestCardNumberQuery = queryInfo;
        }
        // If we have enough results, return immediately
        if (result.total >= minResults) {
          return {
            ...result,
            queryUsed: queryInfo.query,
            queryStrategy: queryInfo.strategy,
          };
        }
      }

      // For non-card-number queries, use standard threshold
      if (!queryHasCardNumber && result.total >= minResults) {
        // But prefer card-number results if we have any
        if (bestCardNumberResult && bestCardNumberResult.total >= 1) {
          console.log(`[eBay Other] Preferring card-number search with ${bestCardNumberResult.total} results over generic with ${result.total}`);
          return {
            ...bestCardNumberResult,
            queryUsed: bestCardNumberQuery!.query,
            queryStrategy: bestCardNumberQuery!.strategy,
          };
        }
        return {
          ...result,
          queryUsed: queryInfo.query,
          queryStrategy: queryInfo.strategy,
        };
      }

      if (!lastResult || result.total > lastResult.total) {
        lastResult = result;
        lastQuery = queryInfo;
      }
    } catch (error) {
      console.error(`[eBay Other Search] Query failed: "${queryInfo.query}"`, error);
    }
  }

  // At the end, prefer card-number results even if they have fewer listings
  // A specific card-number match is more valuable than many generic results
  if (bestCardNumberResult && bestCardNumberQuery && bestCardNumberResult.total >= 1) {
    console.log(`[eBay Other] Using card-number search with ${bestCardNumberResult.total} results`);
    return {
      ...bestCardNumberResult,
      queryUsed: bestCardNumberQuery.query,
      queryStrategy: bestCardNumberQuery.strategy,
    };
  }

  if (lastResult && lastQuery) {
    return {
      ...lastResult,
      queryUsed: lastQuery.query,
      queryStrategy: lastQuery.strategy,
    };
  }

  return {
    total: 0,
    items: [],
    queryUsed: queries[0]?.query || '',
    queryStrategy: queries[0]?.strategy || 'minimal',
  };
}
