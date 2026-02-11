/**
 * PriceCharting API Client for Disney Lorcana Cards
 *
 * Documentation: https://www.pricecharting.com/api-documentation
 *
 * Lorcana cards use pricecharting.com API (same token as sportscardspro.com)
 * Console-name format: "Lorcana [Set Name]" e.g., "Lorcana First Chapter"
 *
 * Lorcana variant markers in product-name:
 * - [Foil]
 * - [Enchanted]
 * - [Promo]
 * - [Full Art]
 *
 * Price field mappings for Lorcana cards:
 * - loose-price: Ungraded/raw card
 * - cib-price: Graded 7
 * - new-price: Graded 8
 * - graded-price: Graded 9
 * - box-only-price: Graded 9.5
 * - manual-only-price: PSA 10
 * - bgs-10-price: BGS 10 (Black Label)
 */

// PriceCharting API base URL
const API_BASE_URL = 'https://www.pricecharting.com/api';

// Types
export interface LorcanaPriceProduct {
  id: string;
  'product-name': string;
  'console-name'?: string;  // Set identifier, e.g., "Lorcana First Chapter"
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

export interface LorcanaPriceSearchResult {
  status: string;
  products?: LorcanaPriceProduct[];
}

export interface LorcanaPriceResult {
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

export interface NormalizedLorcanaPrices {
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

export interface LorcanaCardSearchParams {
  cardName: string;
  setName?: string;
  collectorNumber?: string;
  year?: string;
  isFoil?: boolean;
  variant?: string;  // e.g., "Foil", "Enchanted", "Promo", "Full Art"
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
  if (variantLower.includes('enchanted')) {
    return 'Enchanted';
  }
  if (variantLower.includes('promo')) {
    return 'Promo';
  }
  if (variantLower.includes('full art') || variantLower.includes('full-art')) {
    return 'Full Art';
  }

  return variant;
}

/**
 * Build search query for Lorcana cards
 * Format: "Card Name #Number Set [Variant]"
 *
 * For Lorcana, card name + collector number are the PRIMARY identifiers.
 */
function buildLorcanaCardQuery(params: LorcanaCardSearchParams): string {
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
      .replace(/^Lorcana[\s:]+/i, '')  // Remove "Lorcana " prefix
      .replace(/^Disney[\s:]+/i, '')   // Remove "Disney " prefix
      .trim();
    // Only include set name if it's not too long (avoid query overload)
    if (cleanSetName.length <= 30) {
      parts.push(cleanSetName);
    }
  }

  // Variant (Foil, Enchanted, etc.) - last, as it's optional
  const normalizedVariant = normalizeVariant(params.variant, params.isFoil);
  if (normalizedVariant) {
    parts.push(normalizedVariant);
  }

  return parts.join(' ');
}

/**
 * Search for Lorcana card products by query string
 */
export async function searchLorcanaProducts(
  query: string,
  options: { limit?: number; retries?: number } = {}
): Promise<LorcanaPriceProduct[]> {
  const apiKey = process.env.PRICECHARTING_API_KEY;

  if (!apiKey) {
    console.error('[LorcanaPricing] API key not configured');
    throw new Error('PriceCharting API key not configured');
  }

  const { limit = 15, retries = 2 } = options;

  const url = new URL(`${API_BASE_URL}/products`);
  url.searchParams.set('t', apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', limit.toString());

  console.log(`[LorcanaPricing] Searching: "${query}"`);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        if (errorText.includes('DeadlineExceeded') || errorText.includes('timeout')) {
          if (attempt < retries) {
            console.log(`[LorcanaPricing] Timeout, retrying (attempt ${attempt + 2}/${retries + 1})...`);
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
        }
        console.error(`[LorcanaPricing] Search failed: ${response.status} - ${errorText}`);
        throw new Error(`PriceCharting API error: ${response.status}`);
      }

      const data: LorcanaPriceSearchResult = await response.json();

      if (data.status !== 'success' || !data.products) {
        console.log(`[LorcanaPricing] No products found for query: "${query}"`);
        return [];
      }

      // Filter to only Lorcana-related products
      const lorcanaProducts = data.products.filter(p => {
        const consoleName = p['console-name']?.toLowerCase() || '';
        return consoleName.includes('lorcana');
      });

      console.log(`[LorcanaPricing] Found ${lorcanaProducts.length} Lorcana products (${data.products.length} total)`);
      return lorcanaProducts;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < retries) {
          console.log(`[LorcanaPricing] Request timeout, retrying (attempt ${attempt + 2}/${retries + 1})...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        console.error('[LorcanaPricing] Request timed out after all retries');
        throw new Error('PriceCharting API timeout');
      }
      throw error;
    }
  }

  return [];
}

/**
 * Get detailed pricing for a specific product by ID
 */
export async function getLorcanaProductPrices(productId: string, retries: number = 2): Promise<LorcanaPriceResult | null> {
  const apiKey = process.env.PRICECHARTING_API_KEY;

  if (!apiKey) {
    console.error('[LorcanaPricing] API key not configured');
    throw new Error('PriceCharting API key not configured');
  }

  const url = new URL(`${API_BASE_URL}/product`);
  url.searchParams.set('t', apiKey);
  url.searchParams.set('id', productId);

  console.log(`[LorcanaPricing] Fetching prices for product: ${productId}`);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        if (errorText.includes('DeadlineExceeded') || errorText.includes('timeout')) {
          if (attempt < retries) {
            console.log(`[LorcanaPricing] Timeout fetching prices, retrying...`);
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
        }
        console.error(`[LorcanaPricing] Price fetch failed: ${response.status} - ${errorText}`);
        return null;
      }

      const data: LorcanaPriceResult = await response.json();

      if (data.status !== 'success') {
        console.log(`[LorcanaPricing] Failed to get prices for product: ${productId}`);
        return null;
      }

      console.log(`[LorcanaPricing] Got prices for: ${data['product-name']}`);
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < retries) {
          console.log(`[LorcanaPricing] Price fetch timeout, retrying...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        console.error('[LorcanaPricing] Price fetch timed out after all retries');
        return null;
      }
      throw error;
    }
  }

  return null;
}

/**
 * Normalize price data from PriceCharting API response
 */
export function normalizeLorcanaPrices(product: LorcanaPriceResult): NormalizedLorcanaPrices {
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

  console.log(`[LorcanaPricing] Normalized prices:`, {
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
export function estimateLorcanaDcmValue(
  prices: NormalizedLorcanaPrices,
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
 * For Lorcana: Card name + Collector number are the PRIMARY identifiers
 */
function scoreLorcanaProductMatch(
  product: LorcanaPriceProduct,
  params: LorcanaCardSearchParams
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
        console.log(`[LorcanaPricing] SKIP: Card name mismatch - looking for "${params.cardName}", found "${productName}" (${matchingParts.length}/${nameParts.length} words)`);
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
      console.log(`[LorcanaPricing] SKIP: Collector number mismatch - looking for #${cleanNum} (or #${cleanNumNoZeros}), found "${productName}"`);
      return -1;
    }
  }

  // SET NAME VALIDATION (Important but not critical - helps narrow down)
  if (params.setName) {
    const setLower = params.setName.toLowerCase()
      .replace(/^lorcana[\s:]+/i, '')
      .replace(/^disney[\s:]+/i, '')
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

  // VARIANT MATCHING (Secondary - Enchanted is particularly important for Lorcana)
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
 * Search for Lorcana card prices
 */
export async function searchLorcanaCardPrices(
  params: LorcanaCardSearchParams
): Promise<{ prices: NormalizedLorcanaPrices | null; matchConfidence: 'high' | 'medium' | 'low' | 'none'; queryUsed: string }> {
  console.log('[LorcanaPricing] === SEARCH REQUEST ===');
  console.log('[LorcanaPricing] Card Name:', params.cardName);
  console.log('[LorcanaPricing] Set:', params.setName || '(not specified)');
  console.log('[LorcanaPricing] Collector #:', params.collectorNumber || '(not specified)');
  console.log('[LorcanaPricing] Foil:', params.isFoil || false);
  console.log('[LorcanaPricing] Variant:', params.variant || '(no variant)');

  const query = buildLorcanaCardQuery(params);
  console.log('[LorcanaPricing] FINAL QUERY:', `"${query}"`);

  const products = await searchLorcanaProducts(query, { limit: 15 });

  if (products.length > 0) {
    const scoredProducts = products
      .map(product => ({
        product,
        score: scoreLorcanaProductMatch(product, params)
      }))
      .filter(p => p.score >= 0)
      .sort((a, b) => b.score - a.score);

    console.log(`[LorcanaPricing] Scored ${scoredProducts.length} matching products`);
    scoredProducts.slice(0, 5).forEach((p, i) => {
      console.log(`[LorcanaPricing]   ${i + 1}. Score ${p.score}: ${p.product['product-name']} (${p.product['console-name']})`);
    });

    let exactMatchWithoutPrices: { product: any; score: number } | null = null;

    for (const { product, score } of scoredProducts) {
      console.log(`[LorcanaPricing] Checking product (score ${score}):`, product['product-name']);

      const priceData = await getLorcanaProductPrices(product.id);
      if (priceData) {
        const normalized = normalizeLorcanaPrices(priceData);

        const hasRawPrice = normalized.raw !== null && normalized.raw > 0;
        const hasPsaPrices = Object.values(normalized.psa).some(p => p > 0);
        const hasBgsPrices = Object.values(normalized.bgs).some(p => p > 0);

        if (hasRawPrice || hasPsaPrices || hasBgsPrices) {
          const isFallback = exactMatchWithoutPrices !== null && score < exactMatchWithoutPrices.score;

          if (isFallback) {
            console.log(`[LorcanaPricing] Using FALLBACK product with prices: ${product['product-name']}`);
          } else {
            console.log('[LorcanaPricing] Found matching product with prices:', product['product-name']);
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
          console.log('[LorcanaPricing] Product has no prices, continuing search...');
        }
      }
    }

    if (exactMatchWithoutPrices) {
      console.log(`[LorcanaPricing] No prices found. Best match was: ${exactMatchWithoutPrices.product['product-name']}`);
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

  console.log('[LorcanaPricing] No matching products found');
  return {
    prices: null,
    matchConfidence: 'none',
    queryUsed: query,
  };
}

/**
 * Get all available variants for a Lorcana card
 */
export async function getAvailableLorcanaVariants(
  params: LorcanaCardSearchParams
): Promise<{ id: string; name: string; setName: string; hasPrice: boolean }[]> {
  console.log('[LorcanaPricing] === GET AVAILABLE VARIANTS ===');

  const paramsWithoutVariant = {
    ...params,
    variant: undefined,
    isFoil: undefined
  };
  const query = buildLorcanaCardQuery(paramsWithoutVariant);

  console.log('[LorcanaPricing] VARIANT SEARCH QUERY:', `"${query}"`);

  const products = await searchLorcanaProducts(query, { limit: 25 });

  if (products.length === 0) {
    console.log('[LorcanaPricing] No products found for variant search');
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

  console.log(`[LorcanaPricing] Found ${matchingProducts.length} variant options`);

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
export async function getLorcanaPricesForProductId(
  productId: string
): Promise<NormalizedLorcanaPrices | null> {
  console.log(`[LorcanaPricing] === GET PRICES FOR SELECTED PRODUCT: ${productId} ===`);

  const priceData = await getLorcanaProductPrices(productId);
  if (!priceData) {
    console.log('[LorcanaPricing] No price data found for product');
    return null;
  }

  return normalizeLorcanaPrices(priceData);
}

/**
 * Check if PriceCharting API is configured
 */
export function isLorcanaPricingEnabled(): boolean {
  return !!process.env.PRICECHARTING_API_KEY;
}
