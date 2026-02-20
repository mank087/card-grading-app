/**
 * PriceCharting API Client for Pokemon Cards
 *
 * Documentation: https://www.pricecharting.com/api-documentation
 *
 * Pokemon cards use pricecharting.com API (same token as sportscardspro.com)
 * Console-name format: "Pokemon [Set Name]" e.g., "Pokemon Base Set"
 *
 * Pokemon variant markers in product-name:
 * - [1st Edition]
 * - [Holofoil]
 * - [Reverse Holo] or [Reverse Holofoil]
 * - [Shadowless]
 * - [Unlimited]
 *
 * Price field mappings for Pokemon cards:
 * - loose-price: Ungraded/raw card
 * - cib-price: Graded (generic)
 * - new-price: Sealed/mint
 * - graded-price: PSA 9 equivalent
 * - manual-only-price: PSA 10 equivalent
 * - bgs-10-price: BGS 10 (Black Label)
 */

import { safePricingFetch, pricingDelay, PricingApiError } from './pricingFetch';

// PriceCharting API base URL (for Pokemon/trading cards)
const API_BASE_URL = 'https://www.pricecharting.com/api';

// Types
export interface PokemonPriceProduct {
  id: string;
  'product-name': string;
  'console-name'?: string;  // Set identifier, e.g., "Pokemon Base Set"
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

export interface PokemonPriceSearchResult {
  status: string;
  products?: PokemonPriceProduct[];
}

export interface PokemonPriceResult {
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

export interface NormalizedPokemonPrices {
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

export interface PokemonCardSearchParams {
  pokemonName: string;
  setName?: string;
  cardNumber?: string;
  year?: string;
  variant?: string;  // e.g., "1st Edition", "Holofoil", "Reverse Holo", "Shadowless"
  isHolo?: boolean;
  isFirstEdition?: boolean;
  isReverseHolo?: boolean;
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
function normalizeVariant(variant: string | undefined): string | null {
  if (!variant) return null;

  const variantLower = variant.toLowerCase().trim();

  // Map common variant names to PriceCharting format
  if (variantLower.includes('1st edition') || variantLower.includes('first edition')) {
    return '1st Edition';
  }
  if (variantLower.includes('shadowless')) {
    return 'Shadowless';
  }
  if (variantLower.includes('reverse holo') || variantLower.includes('reverse foil')) {
    return 'Reverse Holo';
  }
  if (variantLower.includes('holo') || variantLower.includes('holofoil')) {
    return 'Holofoil';
  }
  if (variantLower.includes('unlimited')) {
    return 'Unlimited';
  }

  return variant;
}

/**
 * Build search query for Pokemon cards
 * Format: "Pokemon Name #Number [Variant]"
 *
 * PriceCharting uses console-name as set identifier (e.g., "Pokemon Base Set")
 * So we focus on Pokemon name, card number, and variant in the query
 */
function buildPokemonCardQuery(params: PokemonCardSearchParams): string {
  const parts: string[] = [];

  // Pokemon name first (required)
  parts.push(params.pokemonName);

  // Set name helps narrow down results
  if (params.setName) {
    // Clean up set name - Pokemon TCG sets often have year prefixes
    const cleanSetName = params.setName
      .replace(/^Pokemon\s+/i, '')  // Remove "Pokemon " prefix if present
      .trim();
    parts.push(cleanSetName);
  }

  // Card number (very important for Pokemon cards)
  if (params.cardNumber) {
    // Remove any leading # and format as #XX, strip leading zeros to match PriceCharting format
    const cleanNumber = params.cardNumber.replace(/^#/, '').split('/')[0].trim().replace(/^0+(\d)/, '$1');
    if (cleanNumber) {
      parts.push(`#${cleanNumber}`);
    }
  }

  // Variant (1st Edition, Holofoil, etc.)
  // These appear in brackets in PriceCharting product names
  const normalizedVariant = normalizeVariant(params.variant);
  if (normalizedVariant) {
    parts.push(normalizedVariant);
  } else {
    // Check individual flags
    if (params.isFirstEdition) {
      parts.push('1st Edition');
    }
    if (params.isHolo && !params.isReverseHolo) {
      parts.push('Holofoil');
    }
    if (params.isReverseHolo) {
      parts.push('Reverse Holo');
    }
  }

  return parts.join(' ');
}

/**
 * Search for Pokemon card products by query string
 * Uses safePricingFetch for Cloudflare detection, retry, and proper error handling
 */
export async function searchPokemonProducts(
  query: string,
  options: { limit?: number; retries?: number } = {}
): Promise<PokemonPriceProduct[]> {
  const apiKey = process.env.PRICECHARTING_API_KEY;

  if (!apiKey) {
    console.error('[PokemonPricing] API key not configured');
    throw new Error('PriceCharting API key not configured');
  }

  const { limit = 15, retries = 2 } = options;

  const url = new URL(`${API_BASE_URL}/products`);
  url.searchParams.set('t', apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', limit.toString());

  console.log(`[PokemonPricing] Searching: "${query}"`);

  const { data, error } = await safePricingFetch<PokemonPriceSearchResult>(url.toString(), {
    retries,
    logPrefix: '[PokemonPricing]',
    throwOnError: true,
  });

  if (error || !data) {
    return [];
  }

  if (data.status !== 'success' || !data.products) {
    console.log(`[PokemonPricing] No products found for query: "${query}"`);
    return [];
  }

  // Filter to only Pokemon-related products
  const pokemonProducts = data.products.filter(p => {
    const consoleName = p['console-name']?.toLowerCase() || '';
    return consoleName.includes('pokemon') || consoleName.includes('pokémon');
  });

  console.log(`[PokemonPricing] Found ${pokemonProducts.length} Pokemon products (${data.products.length} total)`);
  return pokemonProducts;
}

/**
 * Get detailed pricing for a specific product by ID
 * Uses safePricingFetch for Cloudflare detection, retry, and proper error handling
 */
export async function getPokemonProductPrices(productId: string, retries: number = 2): Promise<PokemonPriceResult | null> {
  const apiKey = process.env.PRICECHARTING_API_KEY;

  if (!apiKey) {
    console.error('[PokemonPricing] API key not configured');
    throw new Error('PriceCharting API key not configured');
  }

  const url = new URL(`${API_BASE_URL}/product`);
  url.searchParams.set('t', apiKey);
  url.searchParams.set('id', productId);

  console.log(`[PokemonPricing] Fetching prices for product: ${productId}`);

  const { data, error } = await safePricingFetch<PokemonPriceResult>(url.toString(), {
    retries,
    logPrefix: '[PokemonPricing]',
    throwOnError: false,
  });

  if (error || !data) {
    return null;
  }

  if (data.status !== 'success') {
    console.log(`[PokemonPricing] Failed to get prices for product: ${productId}`);
    return null;
  }

  console.log(`[PokemonPricing] Got prices for: ${data['product-name']}`);
  return data;
}

/**
 * Normalize price data from PriceCharting API response
 *
 * PriceCharting price field mappings for Pokemon:
 * - loose-price: Ungraded/raw
 * - cib-price: Graded 7
 * - new-price: Graded 8
 * - graded-price: Graded 9
 * - box-only-price: Graded 9.5
 * - manual-only-price: PSA 10
 * - bgs-10-price: BGS 10
 * - condition-17-price: CGC 10
 * - condition-18-price: SGC 10
 */
export function normalizePokemonPrices(product: PokemonPriceResult): NormalizedPokemonPrices {
  const psa: Record<string, number> = {};
  const bgs: Record<string, number> = {};
  const sgc: Record<string, number> = {};
  const cgc: Record<string, number> = {};

  // Map price fields to grade-based prices
  // PSA equivalent grades
  if (product['cib-price']) psa['7'] = penniesToDollars(product['cib-price']) || 0;
  if (product['new-price']) psa['8'] = penniesToDollars(product['new-price']) || 0;
  if (product['graded-price']) psa['9'] = penniesToDollars(product['graded-price']) || 0;
  if (product['box-only-price']) psa['9.5'] = penniesToDollars(product['box-only-price']) || 0;
  if (product['manual-only-price']) psa['10'] = penniesToDollars(product['manual-only-price']) || 0;

  // BGS prices (use same mappings, add BGS 10 specific)
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

  console.log(`[PokemonPricing] Normalized prices:`, {
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
export function estimatePokemonDcmValue(
  prices: NormalizedPokemonPrices,
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
 * Returns -1 for definite mismatch, 0+ for match quality
 */
function scorePokemonProductMatch(
  product: PokemonPriceProduct,
  params: PokemonCardSearchParams
): number {
  const productName = product['product-name']?.toLowerCase() || '';
  const consoleName = product['console-name']?.toLowerCase() || '';
  let score = 0;

  // POKEMON NAME VALIDATION
  if (params.pokemonName) {
    const pokemonNameLower = params.pokemonName.toLowerCase();
    const nameParts = pokemonNameLower.split(/\s+/).filter(p => p.length > 1);

    // Check if product name contains the Pokemon name
    const matchingParts = nameParts.filter(part => productName.includes(part));

    if (matchingParts.length === 0) {
      console.log(`[PokemonPricing] SKIP: Pokemon name mismatch - looking for "${params.pokemonName}", found "${productName}"`);
      return -1;
    }
    score += matchingParts.length * 10;
  }

  // CARD NUMBER VALIDATION
  if (params.cardNumber) {
    const cleanNum = params.cardNumber.replace(/^#/, '').split('/')[0].toLowerCase();
    // Strip leading zeros for comparison (e.g., "027" → "27") since PriceCharting
    // doesn't zero-pad card numbers (e.g., "#27" not "#027")
    const cleanNumNoZeros = cleanNum.replace(/^0+(\d)/, '$1');
    // Check for #XX format in product name (try both zero-padded and non-padded)
    const hasMatch =
      productName.includes(`#${cleanNum}`) ||
      productName.includes(` ${cleanNum}/`) ||
      productName.includes(`#${cleanNumNoZeros}`) ||
      productName.includes(` ${cleanNumNoZeros}/`);
    if (!hasMatch) {
      console.log(`[PokemonPricing] SKIP: Card number mismatch - looking for "${cleanNum}" (or "${cleanNumNoZeros}"), found "${productName}"`);
      return -1;
    }
    score += 15;
  }

  // SET NAME VALIDATION (soft match)
  if (params.setName) {
    const setLower = params.setName.toLowerCase().replace('pokemon ', '');
    if (consoleName.includes(setLower) || consoleName.includes(setLower.replace(/\s+/g, ''))) {
      score += 20;
    } else {
      // Check for partial match - at least one significant word
      const setWords = setLower.split(/\s+/).filter(w => w.length > 3);
      const matchingWords = setWords.filter(word => consoleName.includes(word));
      if (matchingWords.length > 0) {
        score += matchingWords.length * 5;
      }
    }
  }

  // VARIANT MATCHING
  const normalizedVariant = normalizeVariant(params.variant);
  if (normalizedVariant) {
    const variantLower = normalizedVariant.toLowerCase();

    // Check if variant appears in brackets in product name
    if (productName.includes(`[${variantLower}]`)) {
      score += 25;
    } else if (productName.includes(variantLower)) {
      score += 15;
    } else {
      // Looking for specific variant but not found - penalize
      score -= 5;
    }
  }

  // Check for variant flags
  if (params.isFirstEdition) {
    if (productName.includes('1st edition') || productName.includes('[1st edition]')) {
      score += 25;
    } else {
      score -= 10;  // Looking for 1st Edition but not found
    }
  }

  if (params.isHolo && !params.isReverseHolo) {
    if (productName.includes('holofoil') || productName.includes('[holofoil]')) {
      score += 20;
    } else if (!productName.includes('reverse')) {
      score += 5;  // Might be holo without explicit marker
    }
  }

  if (params.isReverseHolo) {
    if (productName.includes('reverse holo') || productName.includes('[reverse')) {
      score += 25;
    } else {
      score -= 10;
    }
  }

  // YEAR MATCHING (if year in console-name)
  if (params.year) {
    const yearStr = params.year.split('-')[0];
    if (consoleName.includes(yearStr) || productName.includes(yearStr)) {
      score += 10;
    }
  }

  return score;
}

/**
 * Search for Pokemon card prices
 */
export async function searchPokemonCardPrices(
  params: PokemonCardSearchParams
): Promise<{ prices: NormalizedPokemonPrices | null; matchConfidence: 'high' | 'medium' | 'low' | 'none'; queryUsed: string }> {
  console.log('[PokemonPricing] === SEARCH REQUEST ===');
  console.log('[PokemonPricing] Pokemon:', params.pokemonName);
  console.log('[PokemonPricing] Set:', params.setName || '(not specified)');
  console.log('[PokemonPricing] Card #:', params.cardNumber || '(not specified)');
  console.log('[PokemonPricing] Variant:', params.variant || '(no variant)');
  console.log('[PokemonPricing] Year:', params.year || '(not specified)');

  // Build query
  const query = buildPokemonCardQuery(params);
  console.log('[PokemonPricing] FINAL QUERY:', `"${query}"`);

  const products = await searchPokemonProducts(query, { limit: 15 });

  if (products.length > 0) {
    // Score all products and sort by best match
    const scoredProducts = products
      .map(product => ({
        product,
        score: scorePokemonProductMatch(product, params)
      }))
      .filter(p => p.score >= 0)
      .sort((a, b) => b.score - a.score);

    console.log(`[PokemonPricing] Scored ${scoredProducts.length} matching products`);
    scoredProducts.slice(0, 5).forEach((p, i) => {
      console.log(`[PokemonPricing]   ${i + 1}. Score ${p.score}: ${p.product['product-name']} (${p.product['console-name']})`);
    });

    let exactMatchWithoutPrices: { product: any; score: number } | null = null;

    for (let i = 0; i < scoredProducts.length; i++) {
      const { product, score } = scoredProducts[i];
      console.log(`[PokemonPricing] Checking product (score ${score}):`, product['product-name']);

      // Add delay between sequential API calls to avoid rate limiting
      if (i > 0) await pricingDelay();

      const priceData = await getPokemonProductPrices(product.id);
      if (priceData) {
        const normalized = normalizePokemonPrices(priceData);

        // Check if product has any price data
        const hasRawPrice = normalized.raw !== null && normalized.raw > 0;
        const hasPsaPrices = Object.values(normalized.psa).some(p => p > 0);
        const hasBgsPrices = Object.values(normalized.bgs).some(p => p > 0);
        const hasSgcPrices = Object.values(normalized.sgc).some(p => p > 0);

        if (hasRawPrice || hasPsaPrices || hasBgsPrices || hasSgcPrices) {
          const isFallback = exactMatchWithoutPrices !== null && score < exactMatchWithoutPrices.score;

          if (isFallback) {
            console.log(`[PokemonPricing] ✓ Using FALLBACK product with prices: ${product['product-name']}`);
          } else {
            console.log('[PokemonPricing] ✓ Found matching product with prices:', product['product-name']);
          }

          // Determine confidence
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
          console.log('[PokemonPricing] Product has no prices, continuing search...');
        }
      }
    }

    // If we found a match but no prices
    if (exactMatchWithoutPrices) {
      console.log(`[PokemonPricing] No prices found. Best match was: ${exactMatchWithoutPrices.product['product-name']}`);
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

  console.log('[PokemonPricing] No matching products found');
  return {
    prices: null,
    matchConfidence: 'none',
    queryUsed: query,
  };
}

/**
 * Get all available variants for a Pokemon card
 */
export async function getAvailablePokemonVariants(
  params: PokemonCardSearchParams
): Promise<{ id: string; name: string; setName: string; hasPrice: boolean }[]> {
  console.log('[PokemonPricing] === GET AVAILABLE VARIANTS ===');

  // Build simpler query without variant to find all versions
  const paramsWithoutVariant = {
    ...params,
    variant: undefined,
    isHolo: undefined,
    isFirstEdition: undefined,
    isReverseHolo: undefined
  };
  const query = buildPokemonCardQuery(paramsWithoutVariant);

  console.log('[PokemonPricing] VARIANT SEARCH QUERY:', `"${query}"`);

  const products = await searchPokemonProducts(query, { limit: 25 });

  if (products.length === 0) {
    console.log('[PokemonPricing] No products found for variant search');
    return [];
  }

  // Filter to products that match the Pokemon name and card number
  const matchingProducts = products.filter(product => {
    const productName = product['product-name']?.toLowerCase() || '';

    // Pokemon name must match
    if (params.pokemonName) {
      const nameParts = params.pokemonName.toLowerCase().split(/\s+/).filter(p => p.length > 1);
      const matchingParts = nameParts.filter(part => productName.includes(part));
      if (matchingParts.length === 0) return false;
    }

    // Card number must match if provided
    if (params.cardNumber) {
      const cleanNum = params.cardNumber.replace(/^#/, '').split('/')[0].toLowerCase();
      if (!productName.includes(`#${cleanNum}`) && !productName.includes(` ${cleanNum}/`)) {
        return false;
      }
    }

    return true;
  });

  console.log(`[PokemonPricing] Found ${matchingProducts.length} variant options`);

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

  // Sort: products with prices first
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
export async function getPokemonPricesForProductId(
  productId: string
): Promise<NormalizedPokemonPrices | null> {
  console.log(`[PokemonPricing] === GET PRICES FOR SELECTED PRODUCT: ${productId} ===`);

  const priceData = await getPokemonProductPrices(productId);
  if (!priceData) {
    console.log('[PokemonPricing] No price data found for product');
    return null;
  }

  return normalizePokemonPrices(priceData);
}

/**
 * Check if PriceCharting API is configured
 */
export function isPokemonPricingEnabled(): boolean {
  return !!process.env.PRICECHARTING_API_KEY;
}
