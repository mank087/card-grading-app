/**
 * PriceCharting API Client for Magic: The Gathering Cards
 *
 * Documentation: https://www.pricecharting.com/api-documentation
 *
 * MTG cards use pricecharting.com API (same token as sportscardspro.com)
 * Console-name format: "Magic [Set Name]" e.g., "Magic Revised"
 *
 * MTG variant markers in product-name:
 * - [Foil]
 * - [Borderless]
 * - [Extended Art]
 * - [Showcase]
 * - [Retro Frame]
 * - [Full Art]
 *
 * Price field mappings for MTG cards:
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
export interface MTGPriceProduct {
  id: string;
  'product-name': string;
  'console-name'?: string;  // Set identifier, e.g., "Magic Revised"
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

export interface MTGPriceSearchResult {
  status: string;
  products?: MTGPriceProduct[];
}

export interface MTGPriceResult {
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

export interface NormalizedMTGPrices {
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

export interface MTGCardSearchParams {
  cardName: string;
  setName?: string;
  collectorNumber?: string;
  expansionCode?: string;
  year?: string;
  isFoil?: boolean;
  variant?: string;  // e.g., "Foil", "Borderless", "Extended Art", "Showcase"
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
 */
function normalizeVariant(variant: string | undefined, isFoil?: boolean): string | null {
  if (isFoil) return 'Foil';
  if (!variant) return null;

  const variantLower = variant.toLowerCase().trim();

  // Map common variant names to PriceCharting format
  if (variantLower.includes('foil')) {
    return 'Foil';
  }
  if (variantLower.includes('borderless')) {
    return 'Borderless';
  }
  if (variantLower.includes('extended art') || variantLower.includes('extended-art')) {
    return 'Extended Art';
  }
  if (variantLower.includes('showcase')) {
    return 'Showcase';
  }
  if (variantLower.includes('retro frame') || variantLower.includes('retro-frame')) {
    return 'Retro Frame';
  }
  if (variantLower.includes('full art') || variantLower.includes('full-art')) {
    return 'Full Art';
  }

  return variant;
}

/**
 * Build search query for MTG cards
 * Format: "Card Name #Number Set [Variant]"
 *
 * For MTG, card name + collector number are the PRIMARY identifiers.
 * Many cards are reprinted across sets, so the number helps find the exact printing.
 */
function buildMTGCardQuery(params: MTGCardSearchParams): string {
  const parts: string[] = [];

  // Card name first (required) - this is the most important identifier
  // For double-faced cards ("Front // Back"), use only the front face name
  // PriceCharting lists these by front face only
  const cardName = params.cardName.includes('//')
    ? params.cardName.split('//')[0].trim()
    : params.cardName;
  parts.push(cardName);

  // Collector number SECOND (helps identify exact printing)
  if (params.collectorNumber) {
    // Strip leading zeros and non-numeric prefixes to match PriceCharting format
    // Handles: "027" → "27", "M 0354" → "354", "#123" → "123"
    let cleanNumber = params.collectorNumber.replace(/^#/, '').split('/')[0].trim();
    // If it has non-numeric prefixes (e.g., "M 0354"), extract just the number
    const numericMatch = cleanNumber.match(/(\d+)/);
    if (numericMatch) {
      cleanNumber = numericMatch[1].replace(/^0+(\d)/, '$1');
    }
    if (cleanNumber && /^\d+$/.test(cleanNumber)) {
      parts.push(`#${cleanNumber}`);
    }
  }

  // Set name third - helps narrow down but less critical than number
  if (params.setName) {
    // Clean up set name
    const cleanSetName = params.setName
      .replace(/^Magic[\s:]+/i, '')  // Remove "Magic " or "Magic: " prefix
      .replace(/^The Gathering[\s:]+/i, '')  // Remove "The Gathering" if present
      .trim();
    // Only include set name if it's not too long (avoid query overload)
    if (cleanSetName.length <= 30) {
      parts.push(cleanSetName);
    }
  }

  // Variant (Foil, Borderless, etc.) - last, as it's optional
  const normalizedVariant = normalizeVariant(params.variant, params.isFoil);
  if (normalizedVariant) {
    parts.push(normalizedVariant);
  }

  return parts.join(' ');
}

/**
 * Search for MTG card products by query string
 * Uses safePricingFetch for Cloudflare detection, retry, and proper error handling
 */
export async function searchMTGProducts(
  query: string,
  options: { limit?: number; retries?: number } = {}
): Promise<MTGPriceProduct[]> {
  const apiKey = process.env.PRICECHARTING_API_KEY;

  if (!apiKey) {
    console.error('[MTGPricing] API key not configured');
    throw new Error('PriceCharting API key not configured');
  }

  const { limit = 15, retries = 2 } = options;

  const url = new URL(`${API_BASE_URL}/products`);
  url.searchParams.set('t', apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', limit.toString());

  console.log(`[MTGPricing] Searching: "${query}"`);

  const { data, error } = await safePricingFetch<MTGPriceSearchResult>(url.toString(), {
    retries,
    logPrefix: '[MTGPricing]',
    throwOnError: true,
  });

  if (error || !data) {
    return [];
  }

  if (data.status !== 'success' || !data.products) {
    console.log(`[MTGPricing] No products found for query: "${query}"`);
    return [];
  }

  // Filter to only Magic-related products
  const mtgProducts = data.products.filter(p => {
    const consoleName = p['console-name']?.toLowerCase() || '';
    return consoleName.includes('magic');
  });

  console.log(`[MTGPricing] Found ${mtgProducts.length} MTG products (${data.products.length} total)`);
  return mtgProducts;
}

/**
 * Get detailed pricing for a specific product by ID
 * Uses safePricingFetch for Cloudflare detection, retry, and proper error handling
 */
export async function getMTGProductPrices(productId: string, retries: number = 2): Promise<MTGPriceResult | null> {
  const apiKey = process.env.PRICECHARTING_API_KEY;

  if (!apiKey) {
    console.error('[MTGPricing] API key not configured');
    throw new Error('PriceCharting API key not configured');
  }

  const url = new URL(`${API_BASE_URL}/product`);
  url.searchParams.set('t', apiKey);
  url.searchParams.set('id', productId);

  console.log(`[MTGPricing] Fetching prices for product: ${productId}`);

  const { data, error } = await safePricingFetch<MTGPriceResult>(url.toString(), {
    retries,
    logPrefix: '[MTGPricing]',
    throwOnError: false,
  });

  if (error || !data) {
    return null;
  }

  if (data.status !== 'success') {
    console.log(`[MTGPricing] Failed to get prices for product: ${productId}`);
    return null;
  }

  console.log(`[MTGPricing] Got prices for: ${data['product-name']}`);
  return data;
}

/**
 * Normalize price data from PriceCharting API response
 */
export function normalizeMTGPrices(product: MTGPriceResult): NormalizedMTGPrices {
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

  console.log(`[MTGPricing] Normalized prices:`, {
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
export function estimateMTGDcmValue(
  prices: NormalizedMTGPrices,
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
 * For MTG: Card name + Collector number are the PRIMARY identifiers
 */
function scoreMTGProductMatch(
  product: MTGPriceProduct,
  params: MTGCardSearchParams
): number {
  const productName = product['product-name']?.toLowerCase() || '';
  const consoleName = product['console-name']?.toLowerCase() || '';
  let score = 0;

  // CARD NAME VALIDATION (CRITICAL - must match)
  if (params.cardName) {
    // For double-faced cards ("Front Name // Back Name"), use only the front face
    // PriceCharting typically lists just the front face name
    const fullNameLower = params.cardName.toLowerCase().trim();
    const cardNameLower = fullNameLower.includes('//')
      ? fullNameLower.split('//')[0].trim()
      : fullNameLower;

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
        console.log(`[MTGPricing] SKIP: Card name mismatch - looking for "${cardNameLower}", found "${productName}" (${matchingParts.length}/${nameParts.length} words)`);
        return -1;
      }
      score += matchingParts.length * 10;
    }
  }

  // COLLECTOR NUMBER VALIDATION (helpful for MTG - same card reprinted in many sets)
  if (params.collectorNumber) {
    const cleanNum = params.collectorNumber.replace(/^#/, '').split('/')[0].trim().toLowerCase();
    // Strip leading zeros for comparison (e.g., "027" → "27")
    const cleanNumNoZeros = cleanNum.replace(/^0+(\d)/, '$1');
    // Extract just the numeric portion for flexible matching (e.g., "M 0354" → "354")
    const numericOnly = cleanNum.replace(/[^0-9]/g, '').replace(/^0+(\d)/, '$1');

    // Check various formats: #123, 123/, 123 (space after) — try both padded and unpadded
    const hasNumber = productName.includes(`#${cleanNum}`) ||
                      productName.includes(` ${cleanNum}/`) ||
                      productName.includes(` ${cleanNum} `) ||
                      productName.endsWith(` ${cleanNum}`) ||
                      productName.includes(`#${cleanNumNoZeros}`) ||
                      productName.includes(` ${cleanNumNoZeros}/`) ||
                      productName.includes(` ${cleanNumNoZeros} `) ||
                      productName.endsWith(` ${cleanNumNoZeros}`) ||
                      (numericOnly && numericOnly !== cleanNumNoZeros && (
                        productName.includes(`#${numericOnly}`) ||
                        productName.includes(` ${numericOnly}/`) ||
                        productName.includes(` ${numericOnly} `) ||
                        productName.endsWith(` ${numericOnly}`)
                      ));

    if (hasNumber) {
      score += 40;  // Strong bonus for matching collector number
    } else {
      // Penalize but don't reject — collector number formats vary across sources
      score -= 10;
      console.log(`[MTGPricing] Collector number mismatch (penalty) - looking for #${cleanNum}, found "${productName}"`);
    }
  }

  // SET NAME VALIDATION (Important but not critical - helps narrow down)
  if (params.setName) {
    const setLower = params.setName.toLowerCase()
      .replace(/^magic[\s:]+/i, '')
      .replace(/^the gathering[\s:]+/i, '')
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

  // FOIL MATCHING (Secondary - affects pricing significantly)
  if (params.isFoil) {
    if (productName.includes('[foil]') || productName.includes('foil')) {
      score += 20;
    } else {
      score -= 15;  // Looking for foil but not found
    }
  } else {
    // Non-foil preferred if not specifically looking for foil
    if (productName.includes('[foil]') || productName.includes('foil')) {
      score -= 10;
    }
  }

  // VARIANT MATCHING (Secondary)
  const normalizedVariant = normalizeVariant(params.variant, false);
  if (normalizedVariant && normalizedVariant !== 'Foil') {
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
 * Search for MTG card prices
 */
export async function searchMTGCardPrices(
  params: MTGCardSearchParams
): Promise<{ prices: NormalizedMTGPrices | null; matchConfidence: 'high' | 'medium' | 'low' | 'none'; queryUsed: string }> {
  console.log('[MTGPricing] === SEARCH REQUEST ===');
  console.log('[MTGPricing] Card Name:', params.cardName);
  console.log('[MTGPricing] Set:', params.setName || '(not specified)');
  console.log('[MTGPricing] Collector #:', params.collectorNumber || '(not specified)');
  console.log('[MTGPricing] Foil:', params.isFoil || false);
  console.log('[MTGPricing] Variant:', params.variant || '(no variant)');

  const query = buildMTGCardQuery(params);
  console.log('[MTGPricing] FINAL QUERY:', `"${query}"`);

  const products = await searchMTGProducts(query, { limit: 15 });

  if (products.length > 0) {
    const scoredProducts = products
      .map(product => ({
        product,
        score: scoreMTGProductMatch(product, params)
      }))
      .filter(p => p.score >= 0)
      .sort((a, b) => b.score - a.score);

    console.log(`[MTGPricing] Scored ${scoredProducts.length} matching products`);
    scoredProducts.slice(0, 5).forEach((p, i) => {
      console.log(`[MTGPricing]   ${i + 1}. Score ${p.score}: ${p.product['product-name']} (${p.product['console-name']})`);
    });

    let exactMatchWithoutPrices: { product: any; score: number } | null = null;

    for (let i = 0; i < scoredProducts.length; i++) {
      const { product, score } = scoredProducts[i];
      console.log(`[MTGPricing] Checking product (score ${score}):`, product['product-name']);

      // Add delay between sequential API calls to avoid rate limiting
      if (i > 0) await pricingDelay();

      const priceData = await getMTGProductPrices(product.id);
      if (priceData) {
        const normalized = normalizeMTGPrices(priceData);

        const hasRawPrice = normalized.raw !== null && normalized.raw > 0;
        const hasPsaPrices = Object.values(normalized.psa).some(p => p > 0);
        const hasBgsPrices = Object.values(normalized.bgs).some(p => p > 0);

        if (hasRawPrice || hasPsaPrices || hasBgsPrices) {
          const isFallback = exactMatchWithoutPrices !== null && score < exactMatchWithoutPrices.score;

          if (isFallback) {
            console.log(`[MTGPricing] Using FALLBACK product with prices: ${product['product-name']}`);
          } else {
            console.log('[MTGPricing] Found matching product with prices:', product['product-name']);
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
          console.log('[MTGPricing] Product has no prices, continuing search...');
        }
      }
    }

    if (exactMatchWithoutPrices) {
      console.log(`[MTGPricing] No prices found. Best match was: ${exactMatchWithoutPrices.product['product-name']}`);
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

  // Fallback: try simpler query with just card name + set (no collector number)
  if (params.collectorNumber || (params.setName && query.includes(params.setName))) {
    const fallbackParams = { ...params, collectorNumber: undefined };
    const fallbackQuery = buildMTGCardQuery(fallbackParams);

    // Only retry if the fallback query is actually different
    if (fallbackQuery !== query) {
      console.log(`[MTGPricing] Retrying with simplified query: "${fallbackQuery}"`);
      await pricingDelay();

      const fallbackProducts = await searchMTGProducts(fallbackQuery, { limit: 15 });

      if (fallbackProducts.length > 0) {
        const scoredFallback = fallbackProducts
          .map(product => ({
            product,
            score: scoreMTGProductMatch(product, { ...params, collectorNumber: undefined })
          }))
          .filter(p => p.score >= 0)
          .sort((a, b) => b.score - a.score);

        console.log(`[MTGPricing] Fallback scored ${scoredFallback.length} products`);
        scoredFallback.slice(0, 3).forEach((p, i) => {
          console.log(`[MTGPricing]   ${i + 1}. Score ${p.score}: ${p.product['product-name']} (${p.product['console-name']})`);
        });

        for (let i = 0; i < Math.min(scoredFallback.length, 3); i++) {
          const { product, score } = scoredFallback[i];
          if (i > 0) await pricingDelay();

          const priceData = await getMTGProductPrices(product.id);
          if (priceData) {
            const normalized = normalizeMTGPrices(priceData);
            const hasAnyPrice = (normalized.raw !== null && normalized.raw > 0) ||
              Object.values(normalized.psa).some(p => p > 0) ||
              Object.values(normalized.bgs).some(p => p > 0);

            if (hasAnyPrice) {
              console.log(`[MTGPricing] Fallback found pricing: ${product['product-name']}`);
              return {
                prices: normalized,
                matchConfidence: score >= 40 ? 'medium' as const : 'low' as const,
                queryUsed: fallbackQuery,
              };
            }
          }
        }
      }
    }
  }

  console.log('[MTGPricing] No matching products found');
  return {
    prices: null,
    matchConfidence: 'none',
    queryUsed: query,
  };
}

/**
 * Get all available variants for an MTG card
 */
export async function getAvailableMTGVariants(
  params: MTGCardSearchParams
): Promise<{ id: string; name: string; setName: string; hasPrice: boolean }[]> {
  console.log('[MTGPricing] === GET AVAILABLE VARIANTS ===');

  const paramsWithoutVariant = {
    ...params,
    variant: undefined,
    isFoil: undefined
  };
  const query = buildMTGCardQuery(paramsWithoutVariant);

  console.log('[MTGPricing] VARIANT SEARCH QUERY:', `"${query}"`);

  const products = await searchMTGProducts(query, { limit: 25 });

  if (products.length === 0) {
    console.log('[MTGPricing] No products found for variant search');
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

  console.log(`[MTGPricing] Found ${matchingProducts.length} variant options`);

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
export async function getMTGPricesForProductId(
  productId: string
): Promise<NormalizedMTGPrices | null> {
  console.log(`[MTGPricing] === GET PRICES FOR SELECTED PRODUCT: ${productId} ===`);

  const priceData = await getMTGProductPrices(productId);
  if (!priceData) {
    console.log('[MTGPricing] No price data found for product');
    return null;
  }

  return normalizeMTGPrices(priceData);
}

/**
 * Check if PriceCharting API is configured
 */
export function isMTGPricingEnabled(): boolean {
  return !!process.env.PRICECHARTING_API_KEY;
}
