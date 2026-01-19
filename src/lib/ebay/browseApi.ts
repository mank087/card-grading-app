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
    console.error('[eBay Browse] Missing credentials:');
    console.error('  EBAY_PROD_APP_ID:', !!process.env.EBAY_PROD_APP_ID);
    console.error('  EBAY_PROD_CERT_ID:', !!process.env.EBAY_PROD_CERT_ID);
    console.error('  EBAY_APP_ID:', !!process.env.EBAY_APP_ID);
    console.error('  EBAY_CERT_ID:', !!process.env.EBAY_CERT_ID);
    throw new Error('eBay API credentials not configured');
  }

  console.log('[eBay Browse] Using credentials:');
  console.log('  App ID:', EBAY_CONFIG.appId.substring(0, 20) + '...');
  console.log('  Cert ID:', EBAY_CONFIG.certId.substring(0, 10) + '...');
  console.log('  Is Production:', EBAY_CONFIG.appId.includes('PRD'));

  // Check cache first
  if (appTokenCache && Date.now() < appTokenCache.expiresAt - 60000) {
    console.log('[eBay Browse] Using cached token');
    return appTokenCache.token;
  }

  const tokenUrl = EBAY_CONFIG.sandbox
    ? EBAY_API_URLS.sandbox.token
    : EBAY_API_URLS.production.token;

  const credentials = Buffer.from(
    `${EBAY_CONFIG.appId}:${EBAY_CONFIG.certId}`
  ).toString('base64');

  console.log('[eBay Browse] Getting application token from:', tokenUrl);

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
    console.error('[eBay Browse] Error response:', errorText);
    console.error('[eBay Browse] Token URL used:', tokenUrl);
    console.error('[eBay Browse] App ID (first 8 chars):', EBAY_CONFIG.appId.substring(0, 8) + '...');

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

  console.log('[eBay Browse] Got application token, expires in', data.expires_in, 'seconds');
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
    filters.push(`categoryIds:{${options.categoryId}}`);
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
  console.log('[eBay Browse] Searching:', searchUrl);
  console.log('[eBay Browse] Query:', query);
  console.log('[eBay Browse] Using production API:', apiUrl);

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

  console.log('[eBay Browse] Found', data.total || 0, 'items');
  console.log('[eBay Browse] Response keys:', Object.keys(data));

  // Log warnings if any
  if (data.warnings) {
    console.warn('[eBay Browse] Warnings:', JSON.stringify(data.warnings));
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

  return {
    total: data.total || 0,
    items,
    lowestPrice,
    highestPrice,
    averagePrice,
  };
}

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
  const cleaned = cleanSearchTerm(cardSet);
  // Get just the main brand (e.g., "Score Football" from "Score Football - Protential")
  const mainSet = cleaned.split(/\s*-\s*/)[0].trim();
  return mainSet;
}

/**
 * Build a search query for a sports card
 * Creates a specific query to find the exact card or very similar ones
 */
export function buildSportsCardQuery(card: {
  card_name?: string;
  featured?: string;
  card_set?: string;
  card_number?: string;
  release_date?: string;
  subset?: string;
  rarity_or_variant?: string;
  manufacturer?: string;
}): string {
  const parts: string[] = [];

  // 1. Player name - most important
  if (card.featured) {
    const playerName = extractPlayerName(card.featured);
    if (playerName) {
      parts.push(playerName);
    }
  }

  // 2. Year - very important for narrowing down
  if (card.release_date) {
    const year = card.release_date.substring(0, 4);
    if (year && !isNaN(Number(year)) && parseInt(year) >= 1900) {
      parts.push(year);
    }
  }

  // 3. Main set name (e.g., "Score", "Prizm", "Topps Chrome")
  if (card.card_set) {
    const mainSet = extractMainSetName(card.card_set);
    if (mainSet && mainSet.length > 2) {
      parts.push(mainSet);
    }
  }

  // 4. Card number - crucial for finding exact card
  if (card.card_number) {
    // Clean up the card number - remove prefixes like "NO." or "#"
    const cleanNumber = card.card_number
      .replace(/^(NO\.?|#)\s*/i, '')
      .trim();
    if (cleanNumber) {
      // Add # prefix which is common on eBay
      parts.push(`#${cleanNumber}`);
    }
  }

  // 5. Subset/Insert name if available (e.g., "Prizm", "Refractor", "Rookie")
  if (card.subset) {
    const cleanSubset = cleanSearchTerm(card.subset);
    // Only add if it's meaningful and not already in the set name
    if (cleanSubset && cleanSubset.length > 2 &&
        !parts.some(p => p.toLowerCase().includes(cleanSubset.toLowerCase()))) {
      parts.push(cleanSubset);
    }
  }

  // 6. Variant/parallel type if available (e.g., "Silver", "Gold", "Holo")
  if (card.rarity_or_variant) {
    const variant = cleanSearchTerm(card.rarity_or_variant);
    if (variant && variant.length > 2 &&
        !parts.some(p => p.toLowerCase().includes(variant.toLowerCase()))) {
      parts.push(variant);
    }
  }

  const query = parts.join(' ');

  console.log('[eBay Query Builder] Input:', card);
  console.log('[eBay Query Builder] Output:', query);

  return query;
}
