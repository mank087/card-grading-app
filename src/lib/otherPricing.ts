/**
 * PriceCharting API Client for "Other" Trading Cards
 *
 * Documentation: https://www.pricecharting.com/api-documentation
 *
 * This is a GENERIC pricing client that works for any trading card game:
 * - Yu-Gi-Oh, Digimon, Dragon Ball, Weiss Schwarz, Flesh and Blood,
 * - Cardfight Vanguard, Star Wars, Marvel, Garbage Pail Kids, etc.
 *
 * Unlike game-specific clients, this does NOT filter by console-name.
 * Instead, it searches broadly and uses smart matching to find the best result.
 *
 * Price field mappings (same as other TCGs):
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
export interface OtherPriceProduct {
  id: string;
  'product-name': string;
  'console-name'?: string;  // Game/category identifier
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

export interface OtherPriceSearchResult {
  status: string;
  products?: OtherPriceProduct[];
}

export interface OtherPriceResult {
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

export interface NormalizedOtherPrices {
  raw: number | null;           // Ungraded/raw price
  psa: Record<string, number>;  // PSA prices by grade
  bgs: Record<string, number>;  // BGS prices by grade
  sgc: Record<string, number>;  // SGC prices by grade
  cgc: Record<string, number>;  // CGC prices by grade
  estimatedDcm: number | null;  // Estimated value for DCM grade
  productId: string;
  productName: string;
  consoleName: string;          // The game/category (e.g., "Yu-Gi-Oh", "Digimon")
  lastUpdated: string;
  salesVolume: string | null;
  // Fallback pricing info
  isFallback?: boolean;
  exactMatchName?: string;
}

export interface OtherCardSearchParams {
  cardName: string;
  setName?: string;
  cardNumber?: string;
  year?: string;
  manufacturer?: string;
  variant?: string;
  gameType?: string;  // Optional hint about the game (e.g., "Yu-Gi-Oh", "Digimon")
}

/**
 * Convert price from pennies to dollars
 */
function penniesToDollars(pennies: number | undefined): number | null {
  if (pennies === undefined || pennies === null || pennies === 0) return null;
  return pennies / 100;
}

/**
 * Build search query for generic cards
 * Format: "Card Name #Number Set"
 */
/**
 * Extract core card name, removing subset prefixes like "Reflections - C-3PO" -> "C-3PO"
 */
function extractCoreCardName(cardName: string): string {
  // Pattern: "Subset - Name" or "Subset: Name"
  const prefixMatch = cardName.match(/^[A-Za-z0-9\s]+([-–—:]\s*)(.+)$/);
  if (prefixMatch && prefixMatch[2]) {
    const coreName = prefixMatch[2].trim();
    // Only use extracted name if it looks like a character/card name (not too short)
    if (coreName.length >= 3) {
      return coreName;
    }
  }
  return cardName;
}

function buildOtherCardQuery(params: OtherCardSearchParams): string {
  const parts: string[] = [];

  // Card name first (required) - extract core name if it has a subset prefix
  const coreName = extractCoreCardName(params.cardName);
  parts.push(coreName);

  // Card number (critical for uniqueness - e.g., "#R-11")
  if (params.cardNumber) {
    // Strip leading zeros to match PriceCharting format (e.g., "027" → "27")
    const cleanNumber = params.cardNumber.replace(/^#/, '').split('/')[0].trim().replace(/^0+(\d)/, '$1');
    if (cleanNumber) {
      parts.push(`#${cleanNumber}`);
    }
  }

  // Set name - extract key words (PriceCharting uses simplified set names)
  if (params.setName) {
    // Remove bullet points, dashes, and split into meaningful parts
    const cleanSetName = params.setName
      .replace(/[•·\-–—]/g, ' ')  // Replace bullets and dashes with spaces
      .replace(/^(Yu-Gi-Oh|Yugioh|Digimon|Dragon Ball|DBZ|DBS|Pokemon|Pokémon|MTG|Magic)[\s:!]+/i, '')
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();

    // Take first few words of set name (PriceCharting uses concise names)
    const setWords = cleanSetName.split(' ').filter(w => w.length > 1);
    if (setWords.length > 0) {
      // Use up to 4 key words from set name
      const keySetWords = setWords.slice(0, 4).join(' ');
      if (keySetWords.length <= 35) {
        parts.push(keySetWords);
      }
    }
  }

  // Year (PriceCharting often includes year in product names)
  if (params.year) {
    const yearMatch = params.year.match(/\d{4}/);
    if (yearMatch) {
      parts.push(yearMatch[0]);
    }
  }

  // Variant if specified (e.g., "Holo", "Alt Art")
  if (params.variant) {
    parts.push(params.variant);
  }

  return parts.join(' ');
}

/**
 * Search for products by query string (no console filtering)
 */
export async function searchOtherProducts(
  query: string,
  options: { limit?: number; retries?: number } = {}
): Promise<OtherPriceProduct[]> {
  const apiKey = process.env.PRICECHARTING_API_KEY;

  if (!apiKey) {
    console.error('[OtherPricing] API key not configured');
    throw new Error('PriceCharting API key not configured');
  }

  const { limit = 20, retries = 2 } = options;

  const url = new URL(`${API_BASE_URL}/products`);
  url.searchParams.set('t', apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', limit.toString());

  console.log(`[OtherPricing] Searching: "${query}"`);

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
            console.log(`[OtherPricing] Timeout, retrying (attempt ${attempt + 2}/${retries + 1})...`);
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
        }
        console.error(`[OtherPricing] Search failed: ${response.status} - ${errorText}`);
        throw new Error(`PriceCharting API error: ${response.status}`);
      }

      const data: OtherPriceSearchResult = await response.json();

      if (data.status !== 'success' || !data.products) {
        console.log(`[OtherPricing] No products found for query: "${query}"`);
        return [];
      }

      // Filter out sports cards and video games (we want trading cards only)
      const tradingCards = data.products.filter(p => {
        const consoleName = p['console-name']?.toLowerCase() || '';
        // Exclude sports cards (handled separately), video games, and non-card items
        const isExcluded =
          consoleName.includes('football') ||
          consoleName.includes('baseball') ||
          consoleName.includes('basketball') ||
          consoleName.includes('hockey') ||
          consoleName.includes('soccer') ||
          consoleName.includes('wrestling') ||
          consoleName.includes('nintendo') ||
          consoleName.includes('playstation') ||
          consoleName.includes('xbox') ||
          consoleName.includes('sega') ||
          consoleName.includes('atari') ||
          consoleName.includes('funko');

        return !isExcluded;
      });

      console.log(`[OtherPricing] Found ${tradingCards.length} trading card products (${data.products.length} total)`);
      return tradingCards;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < retries) {
          console.log(`[OtherPricing] Request timeout, retrying (attempt ${attempt + 2}/${retries + 1})...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        console.error('[OtherPricing] Request timed out after all retries');
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
export async function getOtherProductPrices(productId: string, retries: number = 2): Promise<OtherPriceResult | null> {
  const apiKey = process.env.PRICECHARTING_API_KEY;

  if (!apiKey) {
    console.error('[OtherPricing] API key not configured');
    throw new Error('PriceCharting API key not configured');
  }

  const url = new URL(`${API_BASE_URL}/product`);
  url.searchParams.set('t', apiKey);
  url.searchParams.set('id', productId);

  console.log(`[OtherPricing] Fetching prices for product: ${productId}`);

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
            console.log(`[OtherPricing] Timeout fetching prices, retrying...`);
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
        }
        console.error(`[OtherPricing] Price fetch failed: ${response.status} - ${errorText}`);
        return null;
      }

      const data: OtherPriceResult = await response.json();

      if (data.status !== 'success') {
        console.log(`[OtherPricing] Failed to get prices for product: ${productId}`);
        return null;
      }

      console.log(`[OtherPricing] Got prices for: ${data['product-name']} (${data['console-name']})`);
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < retries) {
          console.log(`[OtherPricing] Price fetch timeout, retrying...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        console.error('[OtherPricing] Price fetch timed out after all retries');
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
export function normalizeOtherPrices(product: OtherPriceResult): NormalizedOtherPrices {
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
    consoleName: product['console-name'] || '',
    lastUpdated: new Date().toISOString(),
    salesVolume: product['sales-volume'] || null,
  };

  console.log(`[OtherPricing] Normalized prices:`, {
    consoleName: normalized.consoleName,
    raw: normalized.raw,
    psa: normalized.psa,
  });

  return normalized;
}

/**
 * Estimate DCM grade equivalent value based on graded prices
 */
export function estimateOtherDcmValue(
  prices: NormalizedOtherPrices,
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
 */
function scoreOtherProductMatch(
  product: OtherPriceProduct,
  params: OtherCardSearchParams
): number {
  const productName = product['product-name']?.toLowerCase() || '';
  const consoleName = product['console-name']?.toLowerCase() || '';
  let score = 0;

  // CARD NAME VALIDATION (most important)
  if (params.cardName) {
    const cardNameLower = params.cardName.toLowerCase().trim();
    // Also try the core name (without subset prefix like "Reflections - ")
    const coreNameLower = extractCoreCardName(params.cardName).toLowerCase().trim();

    // Check for exact match at start (try both full name and core name)
    if (productName.startsWith(cardNameLower + ' ') || productName.startsWith(cardNameLower + '#') || productName === cardNameLower) {
      score += 50;
    } else if (productName.startsWith(coreNameLower + ' ') || productName.startsWith(coreNameLower + '#') || productName === coreNameLower) {
      // Core name match (e.g., "C-3PO" matches when looking for "Reflections - C-3PO")
      score += 45;
    } else {
      // Check for partial match - significant words must be present
      // Use core name for matching to avoid subset words polluting the match
      const nameParts = coreNameLower.split(/\s+/).filter(p => p.length > 1);
      const matchingParts = nameParts.filter(part => productName.includes(part));

      const matchRatio = nameParts.length > 0 ? matchingParts.length / nameParts.length : 0;

      if (matchRatio < 0.5) {
        console.log(`[OtherPricing] SKIP: Card name mismatch - looking for "${coreNameLower}" (from "${params.cardName}"), found "${productName}"`);
        return -1;
      }
      score += matchingParts.length * 10;
    }
  }

  // CARD NUMBER VALIDATION (critical for accurate matching)
  if (params.cardNumber) {
    const cleanNum = params.cardNumber.replace(/^#/, '').split('/')[0].trim().toLowerCase();
    // Strip leading zeros for comparison (e.g., "027" → "27")
    const cleanNumNoZeros = cleanNum.replace(/^0+(\d)/, '$1');
    const hasNumber = productName.includes(`#${cleanNum}`) ||
                      productName.includes(` ${cleanNum}/`) ||
                      productName.includes(` ${cleanNum} `) ||
                      productName.endsWith(` ${cleanNum}`) ||
                      productName.includes(`#${cleanNum}]`) ||
                      productName.includes(`#${cleanNum})`) ||
                      productName.includes(`#${cleanNumNoZeros}`) ||
                      productName.includes(` ${cleanNumNoZeros}/`) ||
                      productName.includes(` ${cleanNumNoZeros} `) ||
                      productName.endsWith(` ${cleanNumNoZeros}`) ||
                      productName.includes(`#${cleanNumNoZeros}]`) ||
                      productName.includes(`#${cleanNumNoZeros})`);

    if (hasNumber) {
      score += 35;
    } else {
      // If we have a card number but it doesn't match, this is likely wrong card
      // Apply significant penalty
      score -= 30;
      console.log(`[OtherPricing] Card number mismatch: looking for "#${cleanNum}" (or "#${cleanNumNoZeros}"), not found in "${productName}"`);
    }
  }

  // SET NAME MATCHING
  if (params.setName) {
    const setLower = params.setName.toLowerCase().trim();
    // Check both product name and console name for set
    if (productName.includes(setLower) || consoleName.includes(setLower)) {
      score += 25;
    } else {
      // Check for partial set name match
      const setWords = setLower.split(/\s+/).filter(w => w.length > 3);
      const matchingWords = setWords.filter(word =>
        productName.includes(word) || consoleName.includes(word)
      );
      if (matchingWords.length > 0) {
        score += matchingWords.length * 5;
      }
    }
  }

  // GAME TYPE HINT (if provided)
  if (params.gameType) {
    const gameTypeLower = params.gameType.toLowerCase();
    if (consoleName.includes(gameTypeLower)) {
      score += 20;
    }
  }

  // MANUFACTURER MATCHING
  if (params.manufacturer) {
    const mfgLower = params.manufacturer.toLowerCase();
    // Common manufacturer -> game mappings
    if (mfgLower.includes('konami') && consoleName.includes('yu-gi-oh')) {
      score += 15;
    } else if (mfgLower.includes('bandai') && (consoleName.includes('digimon') || consoleName.includes('dragon ball'))) {
      score += 15;
    } else if (mfgLower.includes('bushiroad') && (consoleName.includes('weiss') || consoleName.includes('cardfight'))) {
      score += 15;
    } else if (mfgLower.includes('topps') && (consoleName.includes('star wars') || consoleName.includes('topps'))) {
      score += 15;
    } else if (mfgLower.includes('upper deck') && (consoleName.includes('marvel') || consoleName.includes('upper deck'))) {
      score += 15;
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
 * Build a simple fallback query with just card name + number
 */
function buildSimpleQuery(params: OtherCardSearchParams): string {
  // Use core name to avoid subset prefixes
  const coreName = extractCoreCardName(params.cardName);
  const parts: string[] = [coreName];

  if (params.cardNumber) {
    // Strip leading zeros to match PriceCharting format (e.g., "027" → "27")
    const cleanNumber = params.cardNumber.replace(/^#/, '').split('/')[0].trim().replace(/^0+(\d)/, '$1');
    if (cleanNumber) {
      parts.push(`#${cleanNumber}`);
    }
  }

  return parts.join(' ');
}

/**
 * Search for card prices with fallback strategies
 */
export async function searchOtherCardPrices(
  params: OtherCardSearchParams
): Promise<{ prices: NormalizedOtherPrices | null; matchConfidence: 'high' | 'medium' | 'low' | 'none'; queryUsed: string; useEbayFallback?: boolean }> {
  console.log('[OtherPricing] === SEARCH REQUEST ===');
  console.log('[OtherPricing] Card Name:', params.cardName);
  console.log('[OtherPricing] Set:', params.setName || '(not specified)');
  console.log('[OtherPricing] Card #:', params.cardNumber || '(not specified)');
  console.log('[OtherPricing] Year:', params.year || '(not specified)');
  console.log('[OtherPricing] Manufacturer:', params.manufacturer || '(not specified)');
  console.log('[OtherPricing] Game Type:', params.gameType || '(not specified)');

  // Build primary query
  const primaryQuery = buildOtherCardQuery(params);
  console.log('[OtherPricing] PRIMARY QUERY:', `"${primaryQuery}"`);

  // Try primary query first
  let products = await searchOtherProducts(primaryQuery, { limit: 20 });
  let queryUsed = primaryQuery;

  // If no results, try simple query (just card name + number)
  if (products.length === 0 && params.cardNumber) {
    const simpleQuery = buildSimpleQuery(params);
    if (simpleQuery !== primaryQuery) {
      console.log('[OtherPricing] No results, trying simple query:', `"${simpleQuery}"`);
      products = await searchOtherProducts(simpleQuery, { limit: 20 });
      if (products.length > 0) {
        queryUsed = simpleQuery;
      }
    }
  }

  // Minimum score required for a valid match
  // If we have a card number, we need it to match (which gives +35 points)
  // Name match at start gives +45-50 points
  // So a good match should have at least 40+ points
  const MIN_SCORE_FOR_MATCH = params.cardNumber ? 30 : 20;

  if (products.length > 0) {
    const scoredProducts = products
      .map(product => ({
        product,
        score: scoreOtherProductMatch(product, params)
      }))
      .filter(p => p.score >= MIN_SCORE_FOR_MATCH)  // Stricter filtering
      .sort((a, b) => b.score - a.score);

    console.log(`[OtherPricing] Scored ${scoredProducts.length} matching products (min score: ${MIN_SCORE_FOR_MATCH})`);
    scoredProducts.slice(0, 5).forEach((p, i) => {
      console.log(`[OtherPricing]   ${i + 1}. Score ${p.score}: ${p.product['product-name']} (${p.product['console-name']})`);
    });

    // If no products meet the minimum score, signal to use eBay fallback
    if (scoredProducts.length === 0) {
      console.log('[OtherPricing] No products met minimum score threshold - recommend eBay fallback');
      return {
        prices: null,
        matchConfidence: 'none',
        queryUsed: queryUsed,
        useEbayFallback: true,
      };
    }

    let exactMatchWithoutPrices: { product: any; score: number } | null = null;

    for (const { product, score } of scoredProducts) {
      console.log(`[OtherPricing] Checking product (score ${score}):`, product['product-name']);

      const priceData = await getOtherProductPrices(product.id);
      if (priceData) {
        const normalized = normalizeOtherPrices(priceData);

        const hasRawPrice = normalized.raw !== null && normalized.raw > 0;
        const hasPsaPrices = Object.values(normalized.psa).some(p => p > 0);
        const hasBgsPrices = Object.values(normalized.bgs).some(p => p > 0);

        if (hasRawPrice || hasPsaPrices || hasBgsPrices) {
          const isFallback = exactMatchWithoutPrices !== null && score < exactMatchWithoutPrices.score;

          if (isFallback) {
            console.log(`[OtherPricing] Using FALLBACK product with prices: ${product['product-name']}`);
          } else {
            console.log('[OtherPricing] Found matching product with prices:', product['product-name']);
          }

          // Stricter confidence thresholds
          let confidence: 'high' | 'medium' | 'low' = 'low';
          if (!isFallback && score >= 60) {
            confidence = 'high';
          } else if (!isFallback && score >= 40) {
            confidence = 'medium';
          }

          return {
            prices: {
              ...normalized,
              isFallback,
              exactMatchName: isFallback ? exactMatchWithoutPrices?.product['product-name'] : undefined,
            },
            matchConfidence: confidence,
            queryUsed: queryUsed,
          };
        } else {
          if (!exactMatchWithoutPrices || score > exactMatchWithoutPrices.score) {
            exactMatchWithoutPrices = { product, score };
          }
          console.log('[OtherPricing] Product has no prices, continuing search...');
        }
      }
    }

    if (exactMatchWithoutPrices) {
      console.log(`[OtherPricing] No prices found. Best match was: ${exactMatchWithoutPrices.product['product-name']}`);
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
          consoleName: exactMatchWithoutPrices.product['console-name'],
          lastUpdated: new Date().toISOString(),
          salesVolume: '0',
        },
        matchConfidence: 'low',
        queryUsed: queryUsed,
      };
    }
  }

  console.log('[OtherPricing] No matching products found - recommend eBay fallback');
  return {
    prices: null,
    matchConfidence: 'none',
    queryUsed: queryUsed,
    useEbayFallback: true,
  };
}

/**
 * Get all available variants for a card
 */
export async function getAvailableOtherVariants(
  params: OtherCardSearchParams
): Promise<{ id: string; name: string; consoleName: string; hasPrice: boolean }[]> {
  console.log('[OtherPricing] === GET AVAILABLE VARIANTS ===');

  const query = buildOtherCardQuery({ ...params, variant: undefined });
  console.log('[OtherPricing] VARIANT SEARCH QUERY:', `"${query}"`);

  const products = await searchOtherProducts(query, { limit: 25 });

  if (products.length === 0) {
    console.log('[OtherPricing] No products found for variant search');
    return [];
  }

  // Filter to products that match the card name
  const matchingProducts = products.filter(product => {
    const productName = product['product-name']?.toLowerCase() || '';

    if (params.cardName) {
      const nameParts = params.cardName.toLowerCase().split(/\s+/).filter(p => p.length > 2);
      const matchingParts = nameParts.filter(part => productName.includes(part));
      if (matchingParts.length === 0) return false;
    }

    return true;
  });

  console.log(`[OtherPricing] Found ${matchingProducts.length} variant options`);

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
      consoleName: product['console-name'] || '',
      hasPrice: hasSearchPrices,
    };
  });

  // Sort: products with prices first, then alphabetically
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
export async function getOtherPricesForProductId(
  productId: string
): Promise<NormalizedOtherPrices | null> {
  console.log(`[OtherPricing] === GET PRICES FOR SELECTED PRODUCT: ${productId} ===`);

  const priceData = await getOtherProductPrices(productId);
  if (!priceData) {
    console.log('[OtherPricing] No price data found for product');
    return null;
  }

  return normalizeOtherPrices(priceData);
}

/**
 * Check if PriceCharting API is configured
 */
export function isOtherPricingEnabled(): boolean {
  return !!process.env.PRICECHARTING_API_KEY;
}
