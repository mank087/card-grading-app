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
  const items: EbayPriceResult[] = (data.itemSummaries || []).map((item: any) => ({
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
    total: data.total || 0,
    items,
    lowestPrice,
    highestPrice,
    averagePrice,
    medianPrice,
  };
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
    const skipWords = ['panini', 'topps', 'upper', 'deck', 'bowman', 'donruss', 'fleer', 'score'];
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

  let cleaned = cardNumber
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


  // Check if it's a numbered card (serial like /99)
  const isNumbered = card.serial_numbering && /\/\d+/.test(card.serial_numbering);
  const serialStr = isNumbered ? card.serial_numbering : null;

  // Strategy 1: SPECIFIC - Player + [Parallel] + #Number + Year + Set
  // Example: "Patrick Mahomes [Silver Prizm] #1 2024 Panini Prizm"
  if (playerName) {
    const parts: string[] = [playerName];
    if (parallel) parts.push(`[${parallel}]`);
    if (cardNumber) parts.push(`#${cardNumber}`);
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

  // Strategy 2: MODERATE - Player + #Number + Year + Set + Parallel (no brackets)
  // Example: "Patrick Mahomes #1 2024 Prizm Silver"
  if (playerName) {
    const parts: string[] = [playerName];
    if (cardNumber) parts.push(`#${cardNumber}`);
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

  // Strategy 3: BROAD - Player + Year + Set + #Number (no parallel)
  // Example: "Patrick Mahomes 2024 Prizm #1"
  if (playerName) {
    const parts: string[] = [playerName];
    if (validYear) parts.push(validYear);
    if (brandOnly) parts.push(brandOnly);
    if (cardNumber) parts.push(`#${cardNumber}`);

    if (parts.length >= 2) {
      queries.push({
        query: parts.join(' '),
        strategy: 'broad',
        description: 'Player with year and set',
      });
    }
  }

  // Strategy 4: MINIMAL - Player + Brand + Rookie (if applicable)
  // Example: "Patrick Mahomes Prizm Rookie"
  if (playerName) {
    const parts: string[] = [playerName];
    if (brandOnly) parts.push(brandOnly);
    if (card.rookie_card) parts.push('Rookie');
    else if (validYear) parts.push(validYear);

    queries.push({
      query: parts.join(' '),
      strategy: 'minimal',
      description: 'Basic player and brand search',
    });
  }

  // Fallback: Just player name if nothing else works
  if (queries.length === 0 && playerName) {
    queries.push({
      query: playerName,
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
  } = {}
): Promise<EbayPriceSearchResult & { queryUsed: string; queryStrategy: string }> {
  const queries = buildSportsCardQueries(card);
  const minResults = options.minResults ?? 3;
  const limit = options.limit ?? 25;

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
      // Continue to next query on error
      console.error(`[eBay Search] Query failed: "${queryInfo.query}"`, error);
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
