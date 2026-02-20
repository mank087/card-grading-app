/**
 * PriceCharting API Client for One Piece TCG Cards
 *
 * Documentation: https://www.pricecharting.com/api-documentation
 *
 * One Piece cards use pricecharting.com API (same token as sportscardspro.com)
 * Console-name format: "One Piece [Set Name]" e.g., "One Piece Awakening of the New Era"
 *
 * One Piece variant markers in product-name:
 * - [Parallel]
 * - [Alt Art]
 * - [Manga Art]
 * - [Special Art]
 * - [Promo]
 *
 * Price field mappings for One Piece cards:
 * - loose-price: Ungraded/raw card
 * - cib-price: Graded 7
 * - new-price: Graded 8
 * - graded-price: Graded 9
 * - box-only-price: Graded 9.5
 * - manual-only-price: PSA 10
 * - bgs-10-price: BGS 10 (Black Label)
 */

import { safePricingFetch, pricingDelay, PricingApiError } from './pricingFetch';

// PriceCharting API base URL
const API_BASE_URL = 'https://www.pricecharting.com/api';

// Types
export interface OnePiecePriceProduct {
  id: string;
  'product-name': string;
  'console-name'?: string;  // Set identifier, e.g., "One Piece Awakening of the New Era"
  'loose-price'?: number;   // Raw/ungraded price in pennies
  'cib-price'?: number;     // Graded 7
  'new-price'?: number;     // Graded 8
  'graded-price'?: number;  // Graded 9
  'box-only-price'?: number; // Graded 9.5
  'manual-only-price'?: number; // PSA 10
  'bgs-10-price'?: number;  // BGS 10
  genre?: string;
  'release-date'?: string;
  'sales-volume'?: string;
  [key: string]: any;
}

export interface OnePiecePriceSearchResult {
  status: string;
  products?: OnePiecePriceProduct[];
}

export interface OnePiecePriceResult {
  status: string;
  'product-name'?: string;
  'console-name'?: string;
  id?: string;
  genre?: string;
  'release-date'?: string;
  'sales-volume'?: string;
  // All price fields in pennies
  'loose-price'?: number;
  'cib-price'?: number;
  'new-price'?: number;
  'graded-price'?: number;
  'box-only-price'?: number;
  'bgs-10-price'?: number;
  'manual-only-price'?: number;
  'condition-17-price'?: number;  // CGC 10
  'condition-18-price'?: number;  // SGC 10
}

export interface NormalizedOnePiecePrices {
  raw: number | null;           // Ungraded/raw price
  psa: Record<string, number>;  // PSA prices by grade
  bgs: Record<string, number>;  // BGS prices by grade
  sgc: Record<string, number>;  // SGC prices by grade
  cgc: Record<string, number>;  // CGC prices by grade
  estimatedDcm: number | null;  // Estimated value for DCM grade
  productId: string;
  productName: string;
  setName: string;
  lastUpdated: string;
  salesVolume: string | null;
  // Fallback pricing info
  isFallback?: boolean;
  exactMatchName?: string;
}

export interface OnePieceCardSearchParams {
  cardName: string;
  setName?: string;
  collectorNumber?: string;
  year?: string;
  variant?: string;  // e.g., "Parallel", "Alt Art", "Manga Art"
}

/**
 * Convert price from pennies to dollars
 */
function penniesToDollars(pennies: number | undefined): number | null {
  if (pennies === undefined || pennies === null || pennies === 0) return null;
  return pennies / 100;
}

/**
 * Normalize variant names to match PriceCharting format
 * One Piece variants in database: parallel, parallel_manga, alternate_art, sp, manga, promo, special_art
 * PriceCharting format: [Parallel], [Alt Art], [Manga Art], [SP], [Promo], etc.
 */
function normalizeVariant(variant: string | undefined): string | null {
  if (!variant) return null;

  // Replace underscores with spaces for matching
  const variantLower = variant.toLowerCase().trim().replace(/_/g, ' ');

  // Map common variant names to PriceCharting format
  // Check for parallel first (includes parallel_manga → "Parallel")
  if (variantLower.includes('parallel')) {
    return 'Parallel';
  }
  // Alt art / alternate art
  if (variantLower.includes('alt art') || variantLower.includes('alternate art')) {
    return 'Alt Art';
  }
  // Manga art (but not parallel_manga, which is caught above)
  if (variantLower.includes('manga')) {
    return 'Manga Art';
  }
  // SP (Special Parallel) - common One Piece variant
  if (variantLower === 'sp' || variantLower.includes('special parallel')) {
    return 'SP';
  }
  // Special art
  if (variantLower.includes('special art')) {
    return 'Special Art';
  }
  // Promo
  if (variantLower.includes('promo')) {
    return 'Promo';
  }

  return variant;
}

/**
 * Build search query for One Piece cards
 * Format: "Card Name #Number Set [Variant]"
 *
 * For One Piece, card name + collector number are the PRIMARY identifiers.
 */
function buildOnePieceCardQuery(params: OnePieceCardSearchParams): string {
  const parts: string[] = [];

  // Card name first (required) - this is the most important identifier
  parts.push(params.cardName);

  // Collector number SECOND (critical - identifies exact card)
  if (params.collectorNumber) {
    // Strip leading zeros to match PriceCharting format (e.g., "027" → "27")
    const cleanNumber = params.collectorNumber.replace(/^#/, '').split('/')[0].trim().replace(/^0+(\d)/, '$1');
    if (cleanNumber) {
      parts.push(`#${cleanNumber}`);
    }
  }

  // Set name third - helps narrow down
  if (params.setName) {
    // Clean up set name
    const cleanSetName = params.setName
      .replace(/^One Piece[\s:]+/i, '')  // Remove "One Piece " prefix
      .trim();
    // Only include set name if it's not too long (avoid query overload)
    if (cleanSetName.length <= 40) {
      parts.push(cleanSetName);
    }
  }

  // Variant (Parallel, Alt Art, etc.) - last, as it's optional
  const normalizedVariant = normalizeVariant(params.variant);
  if (normalizedVariant) {
    parts.push(normalizedVariant);
  }

  return parts.join(' ');
}

/**
 * Search for One Piece card products by query string
 * Uses safePricingFetch for Cloudflare detection, retry, and proper error handling
 */
export async function searchOnePieceProducts(
  query: string,
  options: { limit?: number; retries?: number } = {}
): Promise<OnePiecePriceProduct[]> {
  const apiKey = process.env.PRICECHARTING_API_KEY;

  if (!apiKey) {
    console.error('[OnePiecePricing] API key not configured');
    throw new Error('PriceCharting API key not configured');
  }

  const { limit = 15, retries = 2 } = options;

  const url = new URL(`${API_BASE_URL}/products`);
  url.searchParams.set('t', apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', limit.toString());

  console.log(`[OnePiecePricing] Searching: "${query}"`);

  const { data, error } = await safePricingFetch<OnePiecePriceSearchResult>(url.toString(), {
    retries,
    logPrefix: '[OnePiecePricing]',
    throwOnError: true,
  });

  if (error || !data) {
    return [];
  }

  if (data.status !== 'success' || !data.products) {
    console.log(`[OnePiecePricing] No products found for query: "${query}"`);
    return [];
  }

  // Filter to only One Piece-related products
  const onePieceProducts = data.products.filter(p => {
    const consoleName = p['console-name']?.toLowerCase() || '';
    return consoleName.includes('one piece');
  });

  console.log(`[OnePiecePricing] Found ${onePieceProducts.length} One Piece products (${data.products.length} total)`);
  return onePieceProducts;
}

/**
 * Get detailed pricing for a specific product by ID
 * Uses safePricingFetch for Cloudflare detection, retry, and proper error handling
 */
export async function getOnePieceProductPrices(productId: string, retries: number = 2): Promise<OnePiecePriceResult | null> {
  const apiKey = process.env.PRICECHARTING_API_KEY;

  if (!apiKey) {
    console.error('[OnePiecePricing] API key not configured');
    throw new Error('PriceCharting API key not configured');
  }

  const url = new URL(`${API_BASE_URL}/product`);
  url.searchParams.set('t', apiKey);
  url.searchParams.set('id', productId);

  console.log(`[OnePiecePricing] Fetching prices for product: ${productId}`);

  const { data, error } = await safePricingFetch<OnePiecePriceResult>(url.toString(), {
    retries,
    logPrefix: '[OnePiecePricing]',
    throwOnError: false,
  });

  if (error || !data) {
    return null;
  }

  if (data.status !== 'success') {
    console.log(`[OnePiecePricing] Failed to get prices for product: ${productId}`);
    return null;
  }

  console.log(`[OnePiecePricing] Got prices for: ${data['product-name']}`);
  return data;
}

/**
 * Normalize price data from PriceCharting API response
 */
export function normalizeOnePiecePrices(product: OnePiecePriceResult): NormalizedOnePiecePrices {
  const psa: Record<string, number> = {};
  const bgs: Record<string, number> = {};
  const sgc: Record<string, number> = {};
  const cgc: Record<string, number> = {};

  // Map price fields to grade-based prices
  if (product['cib-price']) psa['7'] = penniesToDollars(product['cib-price']) || 0;
  if (product['new-price']) psa['8'] = penniesToDollars(product['new-price']) || 0;
  if (product['graded-price']) psa['9'] = penniesToDollars(product['graded-price']) || 0;
  if (product['box-only-price']) psa['9.5'] = penniesToDollars(product['box-only-price']) || 0;
  if (product['manual-only-price']) psa['10'] = penniesToDollars(product['manual-only-price']) || 0;

  // BGS prices
  if (product['graded-price']) bgs['9'] = penniesToDollars(product['graded-price']) || 0;
  if (product['box-only-price']) bgs['9.5'] = penniesToDollars(product['box-only-price']) || 0;
  if (product['bgs-10-price']) bgs['10'] = penniesToDollars(product['bgs-10-price']) || 0;

  // SGC prices
  if (product['graded-price']) sgc['9'] = penniesToDollars(product['graded-price']) || 0;
  if (product['condition-18-price']) sgc['10'] = penniesToDollars(product['condition-18-price']) || 0;

  // CGC prices
  if (product['graded-price']) cgc['9'] = penniesToDollars(product['graded-price']) || 0;
  if (product['condition-17-price']) cgc['10'] = penniesToDollars(product['condition-17-price']) || 0;

  const normalized = {
    raw: penniesToDollars(product['loose-price']),
    psa,
    bgs,
    sgc,
    cgc,
    estimatedDcm: null,
    productId: product.id || '',
    productName: product['product-name'] || '',
    setName: product['console-name'] || '',
    lastUpdated: new Date().toISOString(),
    salesVolume: product['sales-volume'] || null,
  };

  console.log(`[OnePiecePricing] Normalized prices:`, {
    raw: normalized.raw,
    psa: normalized.psa,
    bgs: normalized.bgs,
  });

  return normalized;
}

/**
 * Estimate DCM grade equivalent value based on graded prices
 * DCM values are calculated as a percentage of the PSA premium over raw
 */
export function estimateOnePieceDcmValue(
  prices: NormalizedOnePiecePrices,
  dcmGrade: number
): number | null {
  const raw = prices.raw;

  // Get PSA equivalent price for the grade
  const roundedGrade = Math.round(dcmGrade).toString();
  const halfGrade = dcmGrade >= 9 ? '9.5' : null;
  const psaEquivalentPrice = prices.psa[roundedGrade] || (halfGrade ? prices.psa[halfGrade] : null) || null;

  // Fallback: if no graded equivalent, use raw × 3
  if (!psaEquivalentPrice && raw) {
    return Math.round(raw * 3 * 100) / 100;
  }

  if (!raw || !psaEquivalentPrice) {
    // If we have PSA price but no raw, just return a discounted PSA price
    if (psaEquivalentPrice) {
      // Apply a 30% discount (DCM is 70% of PSA value)
      return Math.round(psaEquivalentPrice * 0.70 * 100) / 100;
    }
    return null;
  }

  // DCM multiplier: represents market premium over raw
  // Higher grades get closer to PSA values, lower grades closer to raw
  // This is a conservative estimate since DCM is establishing market presence
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

  return Math.round(dcmValue * 100) / 100;
}

/**
 * Score how well a product matches the search criteria
 * For One Piece: Card name + Collector number are the PRIMARY identifiers
 */
function scoreOnePieceProductMatch(
  product: OnePiecePriceProduct,
  params: OnePieceCardSearchParams
): number {
  const productName = product['product-name']?.toLowerCase() || '';
  const consoleName = product['console-name']?.toLowerCase() || '';
  let score = 0;

  // CARD NAME VALIDATION (CRITICAL - must match)
  if (params.cardName) {
    const cardNameLower = params.cardName.toLowerCase().trim();

    // Check for exact match at start of product name (most reliable)
    if (productName.startsWith(cardNameLower + ' ') || productName.startsWith(cardNameLower + '#') || productName === cardNameLower) {
      score += 50;  // Strong bonus for exact card name match
    } else {
      // Check for partial match - all significant words must be present
      const nameParts = cardNameLower.split(/\s+/).filter(p => p.length > 1);
      const matchingParts = nameParts.filter(part => productName.includes(part));

      // Require at least 80% of words to match for multi-word names
      const matchRatio = nameParts.length > 0 ? matchingParts.length / nameParts.length : 0;

      if (matchRatio < 0.8) {
        console.log(`[OnePiecePricing] SKIP: Card name mismatch - looking for "${params.cardName}", found "${productName}" (${matchingParts.length}/${nameParts.length} words)`);
        return -1;
      }
      score += matchingParts.length * 10;
    }
  }

  // COLLECTOR NUMBER VALIDATION (CRITICAL - identifies exact card)
  if (params.collectorNumber) {
    const cleanNum = params.collectorNumber.replace(/^#/, '').split('/')[0].trim().toLowerCase();
    // Strip leading zeros for comparison (e.g., "027" → "27")
    const cleanNumNoZeros = cleanNum.replace(/^0+(\d)/, '$1');

    // Check various formats: #123, 123/, 123 (space after) — try both padded and unpadded
    const hasNumber = productName.includes(`#${cleanNum}`) ||
                      productName.includes(` ${cleanNum}/`) ||
                      productName.includes(` ${cleanNum} `) ||
                      productName.endsWith(` ${cleanNum}`) ||
                      productName.includes(`#${cleanNumNoZeros}`) ||
                      productName.includes(` ${cleanNumNoZeros}/`) ||
                      productName.includes(` ${cleanNumNoZeros} `) ||
                      productName.endsWith(` ${cleanNumNoZeros}`);

    if (hasNumber) {
      score += 40;  // Strong bonus for matching collector number
    } else {
      // If we have a collector number but it doesn't match, this is likely wrong card
      console.log(`[OnePiecePricing] SKIP: Collector number mismatch - looking for #${cleanNum} (or #${cleanNumNoZeros}), found "${productName}"`);
      return -1;
    }
  }

  // SET NAME VALIDATION (Important but not critical - helps narrow down)
  if (params.setName) {
    const setLower = params.setName.toLowerCase()
      .replace(/^one piece[\s:]+/i, '')
      .trim();

    if (consoleName.includes(setLower) || consoleName.includes(setLower.replace(/\s+/g, ''))) {
      score += 25;
    } else {
      // Check for partial set name match
      const setWords = setLower.split(/\s+/).filter(w => w.length > 3);
      const matchingWords = setWords.filter(word => consoleName.includes(word));
      if (matchingWords.length > 0) {
        score += matchingWords.length * 5;
      }
    }
  }

  // VARIANT MATCHING (Secondary)
  const normalizedVariant = normalizeVariant(params.variant);
  if (normalizedVariant) {
    const variantLower = normalizedVariant.toLowerCase();
    if (productName.includes(`[${variantLower}]`) || productName.includes(variantLower)) {
      score += 15;
    } else {
      score -= 5;
    }
  }

  // YEAR MATCHING
  if (params.year) {
    const yearStr = params.year.split('-')[0];
    if (consoleName.includes(yearStr) || productName.includes(yearStr)) {
      score += 10;
    }
  }

  return score;
}

/**
 * Search for One Piece card prices
 */
export async function searchOnePieceCardPrices(
  params: OnePieceCardSearchParams
): Promise<{ prices: NormalizedOnePiecePrices | null; matchConfidence: 'high' | 'medium' | 'low' | 'none'; queryUsed: string }> {
  console.log('[OnePiecePricing] === SEARCH REQUEST ===');
  console.log('[OnePiecePricing] Card Name:', params.cardName);
  console.log('[OnePiecePricing] Set:', params.setName || '(not specified)');
  console.log('[OnePiecePricing] Collector #:', params.collectorNumber || '(not specified)');
  console.log('[OnePiecePricing] Variant:', params.variant || '(no variant)');

  const query = buildOnePieceCardQuery(params);
  console.log('[OnePiecePricing] FINAL QUERY:', `"${query}"`);

  const products = await searchOnePieceProducts(query, { limit: 15 });

  if (products.length > 0) {
    const scoredProducts = products
      .map(product => ({
        product,
        score: scoreOnePieceProductMatch(product, params)
      }))
      .filter(p => p.score >= 0)
      .sort((a, b) => b.score - a.score);

    console.log(`[OnePiecePricing] Scored ${scoredProducts.length} matching products`);
    scoredProducts.slice(0, 5).forEach((p, i) => {
      console.log(`[OnePiecePricing]   ${i + 1}. Score ${p.score}: ${p.product['product-name']} (${p.product['console-name']})`);
    });

    let exactMatchWithoutPrices: { product: any; score: number } | null = null;

    for (let i = 0; i < scoredProducts.length; i++) {
      const { product, score } = scoredProducts[i];
      console.log(`[OnePiecePricing] Checking product (score ${score}):`, product['product-name']);

      // Add delay between sequential API calls to avoid rate limiting
      if (i > 0) await pricingDelay();

      const priceData = await getOnePieceProductPrices(product.id);
      if (priceData) {
        const normalized = normalizeOnePiecePrices(priceData);

        const hasRawPrice = normalized.raw !== null && normalized.raw > 0;
        const hasPsaPrices = Object.values(normalized.psa).some(p => p > 0);
        const hasBgsPrices = Object.values(normalized.bgs).some(p => p > 0);

        if (hasRawPrice || hasPsaPrices || hasBgsPrices) {
          const isFallback = exactMatchWithoutPrices !== null && score < exactMatchWithoutPrices.score;

          if (isFallback) {
            console.log(`[OnePiecePricing] Using FALLBACK product with prices: ${product['product-name']}`);
          } else {
            console.log('[OnePiecePricing] Found matching product with prices:', product['product-name']);
          }

          let confidence: 'high' | 'medium' | 'low' = 'low';
          if (!isFallback && score >= 40) {
            confidence = 'high';
          } else if (!isFallback && score >= 20) {
            confidence = 'medium';
          }

          return {
            prices: {
              ...normalized,
              isFallback,
              exactMatchName: isFallback ? exactMatchWithoutPrices?.product['product-name'] : undefined,
            },
            matchConfidence: confidence,
            queryUsed: query,
          };
        } else {
          if (!exactMatchWithoutPrices || score > exactMatchWithoutPrices.score) {
            exactMatchWithoutPrices = { product, score };
          }
          console.log('[OnePiecePricing] Product has no prices, continuing search...');
        }
      }
    }

    if (exactMatchWithoutPrices) {
      console.log(`[OnePiecePricing] No prices found. Best match was: ${exactMatchWithoutPrices.product['product-name']}`);
      return {
        prices: {
          raw: null,
          psa: {},
          bgs: {},
          sgc: {},
          cgc: {},
          estimatedDcm: null,
          productId: exactMatchWithoutPrices.product.id,
          productName: exactMatchWithoutPrices.product['product-name'],
          setName: exactMatchWithoutPrices.product['console-name'],
          lastUpdated: new Date().toISOString(),
          salesVolume: '0',
        },
        matchConfidence: 'low',
        queryUsed: query,
      };
    }
  }

  console.log('[OnePiecePricing] No matching products found');
  return {
    prices: null,
    matchConfidence: 'none',
    queryUsed: query,
  };
}

/**
 * Get all available variants for a One Piece card
 */
export async function getAvailableOnePieceVariants(
  params: OnePieceCardSearchParams
): Promise<{ id: string; name: string; setName: string; hasPrice: boolean }[]> {
  console.log('[OnePiecePricing] === GET AVAILABLE VARIANTS ===');

  const paramsWithoutVariant = {
    ...params,
    variant: undefined
  };
  const query = buildOnePieceCardQuery(paramsWithoutVariant);

  console.log('[OnePiecePricing] VARIANT SEARCH QUERY:', `"${query}"`);

  const products = await searchOnePieceProducts(query, { limit: 25 });

  if (products.length === 0) {
    console.log('[OnePiecePricing] No products found for variant search');
    return [];
  }

  const matchingProducts = products.filter(product => {
    const productName = product['product-name']?.toLowerCase() || '';

    if (params.cardName) {
      const nameParts = params.cardName.toLowerCase().split(/\s+/).filter(p => p.length > 1);
      const matchingParts = nameParts.filter(part => productName.includes(part));
      if (matchingParts.length === 0) return false;
    }

    return true;
  });

  console.log(`[OnePiecePricing] Found ${matchingProducts.length} variant options`);

  const variantsWithPriceInfo = matchingProducts.map(product => {
    const hasSearchPrices = !!(
      product['loose-price'] ||
      product['graded-price'] ||
      product['new-price'] ||
      product['manual-only-price']
    );

    return {
      id: product.id,
      name: product['product-name'] || 'Unknown',
      setName: product['console-name'] || '',
      hasPrice: hasSearchPrices,
    };
  });

  variantsWithPriceInfo.sort((a, b) => {
    if (a.hasPrice && !b.hasPrice) return -1;
    if (!a.hasPrice && b.hasPrice) return 1;
    return a.name.localeCompare(b.name);
  });

  return variantsWithPriceInfo;
}

/**
 * Get prices for a specific product by ID
 */
export async function getOnePiecePricesForProductId(
  productId: string
): Promise<NormalizedOnePiecePrices | null> {
  console.log(`[OnePiecePricing] === GET PRICES FOR SELECTED PRODUCT: ${productId} ===`);

  const priceData = await getOnePieceProductPrices(productId);
  if (!priceData) {
    console.log('[OnePiecePricing] No price data found for product');
    return null;
  }

  return normalizeOnePiecePrices(priceData);
}

/**
 * Check if PriceCharting API is configured
 */
export function isOnePiecePricingEnabled(): boolean {
  return !!process.env.PRICECHARTING_API_KEY;
}
