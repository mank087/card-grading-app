/**
 * SportsCardsPro API Client
 *
 * Documentation: https://www.sportscardspro.com/api-documentation
 *
 * Sports cards use sportscardspro.com API (separate from pricecharting.com)
 * Same authentication token works for both services.
 *
 * Price field mappings for sports cards:
 * - loose-price: Ungraded card
 * - cib-price: Graded 7 or 7.5
 * - new-price: Graded 8 or 8.5
 * - graded-price: Graded 9
 * - box-only-price: Graded 9.5
 * - bgs-10-price: BGS 10
 * - manual-only-price: PSA 10
 * - condition-17-price: CGC 10
 * - condition-18-price: SGC 10
 */

// SportsCardsPro API base URL (for sports trading cards)
const API_BASE_URL = 'https://www.sportscardspro.com/api';

// Types
export interface PriceChartingProduct {
  id: string;
  'product-name': string;
  'console-name'?: string;  // This is actually the "category" or "set" in PC terms
  'loose-price'?: number;   // Raw/ungraded price in pennies
  'cib-price'?: number;     // For cards, this might be PSA 9
  'new-price'?: number;     // For cards, this might be PSA 10
  'graded-price'?: number;  // Generic graded price
  'box-only-price'?: number;
  'manual-only-price'?: number;
  'psa-1-price'?: number;
  'psa-2-price'?: number;
  'psa-3-price'?: number;
  'psa-4-price'?: number;
  'psa-5-price'?: number;
  'psa-6-price'?: number;
  'psa-7-price'?: number;
  'psa-8-price'?: number;
  'psa-9-price'?: number;
  'psa-10-price'?: number;
  'bgs-9-price'?: number;
  'bgs-9.5-price'?: number;
  'bgs-10-price'?: number;
  'sgc-9-price'?: number;
  'sgc-9.5-price'?: number;
  'sgc-10-price'?: number;
  genre?: string;
  'release-date'?: string;
  'sales-volume'?: string;
  // Potential serial number fields (need to verify from API)
  'print-run'?: number;
  'serial-number'?: string;
  'numbered'?: string;
  [key: string]: any;  // Allow any additional fields we haven't mapped yet
}

export interface PriceChartingSearchResult {
  status: string;
  products?: PriceChartingProduct[];
}

export interface SportsCardsPriceResult {
  status: string;
  'product-name'?: string;
  'console-name'?: string;  // Set name, e.g., "Basketball Cards 1986 Fleer"
  id?: string;
  genre?: string;           // Category, e.g., "Baseball Card"
  'release-date'?: string;
  'sales-volume'?: string;
  // All price fields in pennies - SportsCardsPro mapping:
  'loose-price'?: number;           // Ungraded
  'cib-price'?: number;             // Graded 7 or 7.5
  'new-price'?: number;             // Graded 8 or 8.5
  'graded-price'?: number;          // Graded 9
  'box-only-price'?: number;        // Graded 9.5
  'bgs-10-price'?: number;          // BGS 10
  'manual-only-price'?: number;     // PSA 10
  'condition-17-price'?: number;    // CGC 10
  'condition-18-price'?: number;    // SGC 10
  // Retail pricing
  'retail-loose-buy'?: number;
  'retail-loose-sell'?: number;
  'retail-cib-buy'?: number;
  'retail-cib-sell'?: number;
  'retail-new-buy'?: number;
  'retail-new-sell'?: number;
}

export interface NormalizedPrices {
  raw: number | null;           // Ungraded/raw price
  psa: Record<string, number>;  // PSA prices by grade
  bgs: Record<string, number>;  // BGS prices by grade
  sgc: Record<string, number>;  // SGC prices by grade
  estimatedDcm: number | null;  // Estimated value for DCM grade
  productId: string;
  productName: string;
  setName: string;
  lastUpdated: string;
  salesVolume: string | null;   // Sales volume indicator from API
  // Fallback pricing info (when exact match has no prices)
  isFallback?: boolean;         // True if using pricing from a similar card
  exactMatchName?: string;      // Name of the exact match that had no prices
}

export interface SportsCardSearchParams {
  playerName: string;
  year?: string;
  setName?: string;
  cardNumber?: string;
  variant?: string;
  rookie?: boolean;
  sport?: string;  // e.g., "Hockey", "Baseball", "Basketball", "Football"
  serialNumbering?: string;  // e.g., "23/75" or "/99" - we extract the denominator
}

/**
 * Convert price from pennies to dollars
 */
function penniesToDollars(pennies: number | undefined): number | null {
  if (pennies === undefined || pennies === null || pennies === 0) return null;
  return pennies / 100;
}

/**
 * Extract the denominator from serial numbering (e.g., "23/75" -> "/75", "/99" -> "/99")
 */
function extractSerialDenominator(serialNumbering: string | undefined): string | null {
  if (!serialNumbering) return null;

  // Match patterns like "23/75", "/99", "1/1"
  const match = serialNumbering.match(/\/(\d+)$/);
  if (match) {
    return `/${match[1]}`;
  }
  return null;
}

/**
 * Normalize sport category to specific sport name
 * Maps generic "Sports" to empty (let other context determine)
 */
function normalizeSport(sport: string | undefined): string | undefined {
  if (!sport) return undefined;

  const sportLower = sport.toLowerCase();

  // Already specific sports
  if (['hockey', 'baseball', 'basketball', 'football', 'soccer', 'wrestling', 'golf', 'tennis', 'ufc', 'boxing', 'racing'].includes(sportLower)) {
    return sportLower;
  }

  // Generic "Sports" - don't include as it's too vague
  if (sportLower === 'sports') {
    return undefined;
  }

  return sportLower;
}

/**
 * Normalize player name for better API matching
 * Handles variations like "CJ" vs "C.J." vs "C. J."
 */
function normalizePlayerName(name: string): string {
  // Add periods after single capital letters that are initials
  // "CJ Stroud" -> "C.J. Stroud", "AJ Brown" -> "A.J. Brown"
  let normalized = name;

  // Match patterns like "CJ " or "AJ " at the start (two uppercase letters followed by space)
  normalized = normalized.replace(/^([A-Z])([A-Z])\s+/i, '$1.$2. ');

  // Match patterns like " DJ " in the middle of name
  normalized = normalized.replace(/\s+([A-Z])([A-Z])\s+/gi, ' $1.$2. ');

  return normalized;
}

/**
 * Clean card number - remove prefixes like "NO.", "NUMBER", etc.
 * "NO. 2" -> "2", "#NO. 2" -> "2", "NUMBER 123" -> "123"
 */
function cleanCardNumber(cardNumber: string): string {
  return cardNumber
    .replace(/^#/, '')                     // Remove leading #
    .replace(/^NO\.?\s*/i, '')             // Remove "NO." or "NO " prefix
    .replace(/^NUMBER\.?\s*/i, '')         // Remove "NUMBER" prefix
    .replace(/^NUM\.?\s*/i, '')            // Remove "NUM" prefix
    .trim();
}

/**
 * Strip leading zeros from a card number for comparison.
 * e.g., "027" → "27", "001" → "1", "0" → "0"
 */
function stripLeadingZeros(num: string): string {
  return num.replace(/^0+(\d)/, '$1');
}

/**
 * Normalize card number for comparison - handles O/0 confusion
 * "RO5-MTG" and "R05-MTG" should match (letter O vs number 0)
 */
function normalizeCardNumberForComparison(cardNumber: string): string {
  return cardNumber
    .toLowerCase()
    .replace(/o/g, '0')  // Replace letter O with number 0
    .replace(/l/g, '1')  // Replace letter l with number 1 (less common but helps)
    .replace(/i/g, '1'); // Replace letter I with number 1
}

/**
 * Build search query for sports cards
 * Format: "Player Name Year Set #Number /Serial Variant" for accurate matching
 *
 * Search priority:
 * 1. Player name (required)
 * 2. Year (helps narrow down)
 * 3. Set name (for accurate matching)
 * 4. Card number (important for accuracy)
 * 5. Serial denominator (e.g., /99, /25 - helps match specific parallel)
 * 6. Variant/parallel color (e.g., "Green", "Gold")
 */
function buildSportsCardQuery(params: SportsCardSearchParams): string {
  const parts: string[] = [];

  // Player name first (required) - normalize initials
  parts.push(normalizePlayerName(params.playerName));

  // Year helps narrow down to specific release
  // Handle year ranges like "2024-25" -> "2024"
  if (params.year) {
    const yearMatch = params.year.match(/^(\d{4})/);
    if (yearMatch) {
      parts.push(yearMatch[1]);
    } else {
      parts.push(params.year);
    }
  }

  // Set name for accurate matching (e.g., "Topps Allen and Ginter")
  if (params.setName) {
    // Clean up set name - remove bullets/dashes, duplicate manufacturer, redundant sport words
    let cleanSetName = params.setName
      .replace(/[•·●–—-]/g, ' ')           // Remove bullet and dash characters
      .replace(/\s+/g, ' ')                // Normalize whitespace
      .replace(/^Topps\s+Topps\s+/i, 'Topps ')
      .replace(/^Panini\s+Panini\s+/i, 'Panini ')
      .trim();

    // Remove redundant sport words (the sport is already in the category)
    cleanSetName = cleanSetName
      .replace(/\bFootball\b/gi, '')
      .replace(/\bBasketball\b/gi, '')
      .replace(/\bBaseball\b/gi, '')
      .replace(/\bHockey\b/gi, '')
      .replace(/\bSoccer\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract the main set name and subset/insert name
    // e.g., "Score • PROTENTIAL" -> "Score PROTENTIAL"
    const setParts = cleanSetName.split(/\s+/);
    // Keep first meaningful words (up to 4) to avoid overly long queries
    if (setParts.length > 4) {
      cleanSetName = setParts.slice(0, 4).join(' ');
    }

    if (cleanSetName) {
      parts.push(cleanSetName);
    }
  }

  // Card number (important for accurate matching)
  if (params.cardNumber) {
    // Clean and normalize the card number, strip leading zeros to match PriceCharting format
    const cleanNumber = stripLeadingZeros(cleanCardNumber(params.cardNumber));
    if (cleanNumber) {
      parts.push(`#${cleanNumber}`);
    }
  }

  // Serial denominator (e.g., /99, /25) - helps match specific parallel print run
  const serialDenom = extractSerialDenominator(params.serialNumbering);
  if (serialDenom) {
    parts.push(serialDenom);
  }

  // Variant/parallel color (e.g., "Green", "Red", "Prizm Silver")
  // Only include if it's a meaningful variant, not a generic type
  if (params.variant) {
    const variantLower = params.variant.toLowerCase();
    // Filter out generic/meaningless variant types (card types, not parallel colors)
    const genericVariants = [
      'insert', 'base', 'base_common', 'common', 'standard', 'regular',
      'parallel', 'modern_parallel', 'parallel_variant', 'sp', 'ssp',
      'autographed', 'autograph', 'auto', 'rookie', 'rc', 'memorabilia', 'relic', 'patch'
    ];
    if (!genericVariants.includes(variantLower)) {
      parts.push(params.variant);
    }
  }

  return parts.join(' ');
}

/**
 * Search for products by query string
 * Includes retry logic for transient API errors
 */
export async function searchProducts(
  query: string,
  options: { limit?: number; retries?: number } = {}
): Promise<PriceChartingProduct[]> {
  const apiKey = process.env.PRICECHARTING_API_KEY;

  if (!apiKey) {
    console.error('[SportsCardsPro] API key not configured');
    throw new Error('SportsCardsPro API key not configured');
  }

  const { limit = 10, retries = 2 } = options;

  const url = new URL(`${API_BASE_URL}/products`);
  url.searchParams.set('t', apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', limit.toString());

  console.log(`[SportsCardsPro] Searching: "${query}"`);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout

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
        // Check for transient errors (deadline exceeded, timeout)
        if (errorText.includes('DeadlineExceeded') || errorText.includes('timeout')) {
          if (attempt < retries) {
            console.log(`[SportsCardsPro] Timeout, retrying (attempt ${attempt + 2}/${retries + 1})...`);
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // Exponential backoff
            continue;
          }
        }
        console.error(`[SportsCardsPro] Search failed: ${response.status} - ${errorText}`);
        throw new Error(`SportsCardsPro API error: ${response.status}`);
      }

      const data: PriceChartingSearchResult = await response.json();

      if (data.status !== 'success' || !data.products) {
        console.log(`[SportsCardsPro] No products found for query: "${query}"`);
        return [];
      }

      console.log(`[SportsCardsPro] Found ${data.products.length} products`);
      return data.products;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < retries) {
          console.log(`[SportsCardsPro] Request timeout, retrying (attempt ${attempt + 2}/${retries + 1})...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        console.error('[SportsCardsPro] Request timed out after all retries');
        throw new Error('SportsCardsPro API timeout');
      }
      throw error;
    }
  }

  return [];
}

/**
 * Get detailed pricing for a specific product by ID
 * Includes retry logic for transient API errors
 */
export async function getProductPrices(productId: string, retries: number = 2): Promise<SportsCardsPriceResult | null> {
  const apiKey = process.env.PRICECHARTING_API_KEY;

  if (!apiKey) {
    console.error('[SportsCardsPro] API key not configured');
    throw new Error('SportsCardsPro API key not configured');
  }

  const url = new URL(`${API_BASE_URL}/product`);
  url.searchParams.set('t', apiKey);
  url.searchParams.set('id', productId);

  console.log(`[SportsCardsPro] Fetching prices for product: ${productId}`);

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
            console.log(`[SportsCardsPro] Timeout fetching prices, retrying...`);
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
        }
        console.error(`[SportsCardsPro] Price fetch failed: ${response.status} - ${errorText}`);
        return null;
      }

      const data: SportsCardsPriceResult = await response.json();

      // Log all keys in the response to see what fields are available
      console.log(`[SportsCardsPro] Full API response keys:`, Object.keys(data));
      console.log(`[SportsCardsPro] Full API response:`, JSON.stringify(data, null, 2));

      if (data.status !== 'success') {
        console.log(`[SportsCardsPro] Failed to get prices for product: ${productId}`);
        return null;
      }

      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < retries) {
          console.log(`[SportsCardsPro] Price fetch timeout, retrying...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        console.error('[SportsCardsPro] Price fetch timed out after all retries');
        return null;
      }
      throw error;
    }
  }

  return null;
}

/**
 * Normalize price data from SportsCardsPro API response
 *
 * SportsCardsPro price field mappings:
 * - loose-price: Ungraded
 * - cib-price: Graded 7/7.5
 * - new-price: Graded 8/8.5
 * - graded-price: Graded 9
 * - box-only-price: Graded 9.5
 * - manual-only-price: PSA 10
 * - bgs-10-price: BGS 10
 * - condition-17-price: CGC 10
 * - condition-18-price: SGC 10
 */
export function normalizePrices(product: SportsCardsPriceResult): NormalizedPrices {
  const psa: Record<string, number> = {};
  const bgs: Record<string, number> = {};
  const sgc: Record<string, number> = {};

  // Map SportsCardsPro fields to grade-based prices
  // PSA equivalent grades (most common grading company for sports cards)
  if (product['cib-price']) psa['7'] = penniesToDollars(product['cib-price']) || 0;
  if (product['new-price']) psa['8'] = penniesToDollars(product['new-price']) || 0;
  if (product['graded-price']) psa['9'] = penniesToDollars(product['graded-price']) || 0;
  if (product['box-only-price']) psa['9.5'] = penniesToDollars(product['box-only-price']) || 0;
  if (product['manual-only-price']) psa['10'] = penniesToDollars(product['manual-only-price']) || 0;

  // BGS prices
  if (product['bgs-10-price']) bgs['10'] = penniesToDollars(product['bgs-10-price']) || 0;
  // BGS 9.5 often maps to box-only-price as well
  if (product['box-only-price']) bgs['9.5'] = penniesToDollars(product['box-only-price']) || 0;
  if (product['graded-price']) bgs['9'] = penniesToDollars(product['graded-price']) || 0;

  // SGC prices
  if (product['condition-18-price']) sgc['10'] = penniesToDollars(product['condition-18-price']) || 0;
  if (product['graded-price']) sgc['9'] = penniesToDollars(product['graded-price']) || 0;

  const normalized = {
    raw: penniesToDollars(product['loose-price']),
    psa,
    bgs,
    sgc,
    estimatedDcm: null, // Will be calculated based on DCM grade
    productId: product.id || '',
    productName: product['product-name'] || '',
    setName: product['console-name'] || '',
    lastUpdated: new Date().toISOString(),
    salesVolume: product['sales-volume'] || null,
  };

  console.log(`[SportsCardsPro] Normalized prices:`, {
    raw: normalized.raw,
    psa: normalized.psa,
    bgs: normalized.bgs,
    sgc: normalized.sgc,
  });

  return normalized;
}

/**
 * Estimate DCM grade equivalent value based on PSA prices
 * DCM grades map approximately to PSA grades
 *
 * SportsCardsPro provides prices for grades: 7, 8, 9, 9.5, 10
 * We interpolate between available grades for DCM values
 */
export function estimateDcmValue(
  prices: NormalizedPrices,
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
 * Search for sports card prices
 * Query format: "Player Name Year Set #CardNumber /Serial Variant"
 */
export async function searchSportsCardPrices(
  params: SportsCardSearchParams
): Promise<{ prices: NormalizedPrices | null; matchConfidence: 'high' | 'medium' | 'low' | 'none'; queryUsed: string }> {
  // Log search parameters clearly
  console.log('[SportsCardsPro] === SEARCH REQUEST ===');
  console.log('[SportsCardsPro] Player:', params.playerName);
  console.log('[SportsCardsPro] Year:', params.year || '(not specified)');
  console.log('[SportsCardsPro] Set:', params.setName || '(not specified)');
  console.log('[SportsCardsPro] Card #:', params.cardNumber || '(not specified)');
  console.log('[SportsCardsPro] Serial:', params.serialNumbering || '(not numbered)');
  console.log('[SportsCardsPro] Variant:', params.variant || '(no variant)');
  console.log('[SportsCardsPro] Sport:', params.sport || '(not specified)');

  // Build query
  const query = buildSportsCardQuery(params);
  console.log('[SportsCardsPro] FINAL QUERY:', `"${query}"`);

  const products = await searchProducts(query, { limit: 10 });

  if (products.length > 0) {
    // Helper function to score how well a product matches the search criteria
    // Returns -1 if it's a definite mismatch, 0+ for match quality (higher = better)
    const scoreProductMatch = (product: any): number => {
      const productName = product['product-name']?.toLowerCase() || '';
      const consoleName = product['console-name']?.toLowerCase() || '';
      const genre = product['genre']?.toLowerCase() || '';
      let score = 0;

      // PLAYER NAME VALIDATION: The product name MUST contain the player's name (or significant parts of it)
      // This prevents cross-player matches (e.g., "Don Smith" matching "Don Mattingly")
      if (params.playerName) {
        // Normalize both names for comparison
        // Handle variations: "CJ Stroud" vs "C.J. Stroud" vs "C. J. Stroud"
        // Handle multi-player cards: "LeBron James / Bronny James Jr."
        const normalizeForComparison = (name: string) => {
          return name
            .toLowerCase()
            .replace(/[.\/]/g, ' ')       // Remove periods and slashes: "c.j." -> "c j", "Player / Player" -> "Player  Player"
            .replace(/\s+/g, ' ')         // Normalize spaces
            .replace(/(\b\w)\s+(?=\w\b)/g, '$1')  // Collapse single letters: "c j " -> "cj"
            .trim();
        };

        const normalizedPlayer = normalizeForComparison(params.playerName);
        const normalizedProduct = normalizeForComparison(productName);

        // Split into parts for matching, filter out very short parts (like "jr")
        const playerParts = normalizedPlayer.split(/\s+/).filter(p => p.length > 1);

        // For multi-player cards or longer names, require matching at least 2-3 significant parts
        // For short names (1-2 parts), all parts must match
        const requiredMatches = playerParts.length <= 2 ? playerParts.length : Math.min(3, Math.ceil(playerParts.length / 2));

        // Check how many parts match
        const matchingParts = playerParts.filter(part => normalizedProduct.includes(part));

        if (matchingParts.length < requiredMatches) {
          console.log(`[SportsCardsPro] SKIP: Player mismatch - looking for "${params.playerName}" (normalized: "${normalizedPlayer}"), found "${productName}" (normalized: "${normalizedProduct}") - matched ${matchingParts.length}/${requiredMatches} parts`);
          return -1;
        }
        score += matchingParts.length * 5; // Player name matches
      }

      // SPORT VALIDATION: If we have a specific sport, the product MUST match that sport
      // This prevents cross-sport matches (e.g., hockey card matching baseball card)
      // Skip validation if sport is "sports" (generic category that includes all sports)
      if (params.sport && params.sport.toLowerCase() !== 'sports') {
        const sportLower = params.sport.toLowerCase();
        // Check both consoleName (e.g., "Hockey Cards 1991 Pro Set") and genre (e.g., "Hockey Card")
        const sportInConsole = consoleName.includes(sportLower);
        const sportInGenre = genre.includes(sportLower);

        if (!sportInConsole && !sportInGenre) {
          console.log(`[SportsCardsPro] SKIP: Sport mismatch - looking for "${sportLower}", found console="${consoleName}", genre="${genre}"`);
          return -1;
        }
        score += 25; // Sport matches - high priority!
      } else if (params.sport?.toLowerCase() === 'sports') {
        // For generic "sports" category, just verify it's a sports card (not Pokemon, MTG, etc.)
        const isSportsCard = genre.includes('card') && (
          consoleName.includes('hockey') || consoleName.includes('baseball') ||
          consoleName.includes('basketball') || consoleName.includes('football') ||
          consoleName.includes('soccer') || consoleName.includes('golf') ||
          consoleName.includes('racing') || consoleName.includes('wrestling') ||
          consoleName.includes('boxing') || consoleName.includes('tennis') ||
          consoleName.includes('sports')
        );
        if (!isSportsCard) {
          console.log(`[SportsCardsPro] SKIP: Not a sports card - found console="${consoleName}", genre="${genre}"`);
          return -1;
        }
        score += 10; // Generic sports category match
      }

      // If we have a card number, the product MUST contain it
      if (params.cardNumber) {
        // Use the same cleaning logic as query building
        const cleanCardNum = cleanCardNumber(params.cardNumber).toLowerCase();
        // Strip leading zeros (e.g., "027" → "27") since PriceCharting may not zero-pad
        const cleanCardNumNoZeros = stripLeadingZeros(cleanCardNum);
        // Normalize for O/0 confusion
        const normalizedSearchNum = normalizeCardNumberForComparison(cleanCardNum);
        const normalizedSearchNumNoZeros = normalizeCardNumberForComparison(cleanCardNumNoZeros);
        const normalizedProductName = normalizeCardNumberForComparison(productName);

        // Check if product name contains the card number (with or without #, with or without leading zeros)
        const exactMatch = productName.includes(`#${cleanCardNum}`) || productName.includes(cleanCardNum) ||
          productName.includes(`#${cleanCardNumNoZeros}`) || productName.includes(cleanCardNumNoZeros);
        const normalizedMatch = normalizedProductName.includes(`#${normalizedSearchNum}`) || normalizedProductName.includes(normalizedSearchNum) ||
          normalizedProductName.includes(`#${normalizedSearchNumNoZeros}`) || normalizedProductName.includes(normalizedSearchNumNoZeros);

        if (!exactMatch && !normalizedMatch) {
          console.log(`[SportsCardsPro] SKIP: Card # mismatch - looking for "${cleanCardNum}" (or "${cleanCardNumNoZeros}"), found "${productName}"`);
          return -1;
        }
        score += 10; // Card number matches
      }

      // If we have a set name, check for some overlap with console-name
      // This is a soft match - require at least 1 word overlap for relevance
      // Player name + card number are the primary validators
      if (params.setName) {
        const searchSet = params.setName.toLowerCase();
        const setWords = searchSet.split(/\s+/).filter(w => w.length > 3);
        const matchingWords = setWords.filter(word => consoleName.includes(word));

        // Also check for year match in consoleName (e.g., "1955" in "hockey cards 1955 parkhurst")
        const yearInConsole = params.year && consoleName.includes(params.year.split('-')[0]);

        // Require at least 1 matching word OR year match for basic relevance
        if (matchingWords.length === 0 && !yearInConsole) {
          console.log(`[SportsCardsPro] SKIP: Set mismatch - looking for "${searchSet}" (year: ${params.year}), found "${consoleName}"`);
          return -1;
        }

        // Bonus points for set matches
        score += matchingWords.length * 3;
        if (yearInConsole) score += 5;
      }

      // Check if variant/parallel matches (e.g., "Green Refractor" in product name)
      // Check if product name has variant markers like [Refractor], [Gold], etc.
      const variantMarkerMatch = productName.match(/\[(.*?)\]/);
      const hasVariantMarker = !!variantMarkerMatch;
      const productVariant = variantMarkerMatch ? variantMarkerMatch[1].toLowerCase() : '';

      if (params.variant) {
        const variantLower = params.variant.toLowerCase();

        // Check if this is a "base" card request (base_common, base, common, standard, etc.)
        const isBaseRequest = ['base_common', 'base', 'common', 'standard', 'regular'].includes(variantLower);

        if (isBaseRequest) {
          // For base cards, prefer products WITHOUT color/parallel markers
          if (!hasVariantMarker) {
            score += 25; // Strong preference for base cards
            console.log(`[SportsCardsPro] +25 Base card match (no variant marker)`);
          } else {
            // Has a variant marker - this is a parallel, not a base card
            // Skip colored parallels when looking for base
            console.log(`[SportsCardsPro] SKIP: Looking for base card, found parallel "${productVariant}" in "${productName}"`);
            return -1;
          }
        } else if (productName.includes(variantLower)) {
          score += 20; // Parallel type matches - big bonus!
          console.log(`[SportsCardsPro] +20 Parallel match: "${params.variant}" found in "${productName}"`);
        } else {
          // Check for partial matches (e.g., "Green" in "Green Refractor")
          const variantWords = variantLower.split(/\s+/);
          const matchingVariantWords = variantWords.filter(w => w.length > 2 && productName.includes(w));
          if (matchingVariantWords.length > 0) {
            score += matchingVariantWords.length * 5;
            console.log(`[SportsCardsPro] +${matchingVariantWords.length * 5} Partial parallel match: ${matchingVariantWords.join(', ')}`);
          } else if (hasVariantMarker) {
            // Looking for a specific variant but found a different one - penalize
            score -= 10;
            console.log(`[SportsCardsPro] -10 Wrong variant: looking for "${params.variant}", found "${productVariant}"`);
          }
        }
      } else {
        // No variant specified - prefer base/non-variant cards
        if (!hasVariantMarker) {
          score += 5; // Prefer base cards when no variant specified
        }
      }

      // Check if serial numbering matches (e.g., "/99" in product name)
      if (params.serialNumbering) {
        const serialDenom = extractSerialDenominator(params.serialNumbering);
        if (serialDenom && productName.includes(serialDenom)) {
          score += 15; // Serial matches - good bonus!
          console.log(`[SportsCardsPro] +15 Serial match: "${serialDenom}" found in "${productName}"`);
        }
      }

      return score;
    };

    // Score all products and sort by best match
    const scoredProducts = products
      .map(product => ({
        product,
        score: scoreProductMatch(product)
      }))
      .filter(p => p.score >= 0) // Remove definite mismatches
      .sort((a, b) => b.score - a.score); // Sort by score descending

    console.log(`[SportsCardsPro] Scored ${scoredProducts.length} matching products (sorted by relevance)`);
    scoredProducts.slice(0, 5).forEach((p, i) => {
      console.log(`[SportsCardsPro]   ${i + 1}. Score ${p.score}: ${p.product['product-name']}`);
    });

    // Track the best exact match (even without prices) for fallback messaging
    let exactMatchWithoutPrices: { product: any; score: number } | null = null;

    // Iterate through scored products (best matches first) to find one with price data
    for (const { product, score } of scoredProducts) {
      console.log(`[SportsCardsPro] Checking product (score ${score}):`, product['product-name'], '-', product['console-name']);

      const priceData = await getProductPrices(product.id);
      if (priceData) {
        const normalized = normalizePrices(priceData);

        // Check if this product has any actual price data
        const hasRawPrice = normalized.raw !== null && normalized.raw > 0;
        const hasPsaPrices = Object.values(normalized.psa).some(p => p > 0);
        const hasBgsPrices = Object.values(normalized.bgs).some(p => p > 0);
        const hasSgcPrices = Object.values(normalized.sgc).some(p => p > 0);

        if (hasRawPrice || hasPsaPrices || hasBgsPrices || hasSgcPrices) {
          // Check if this is a fallback (we found an exact match earlier but it had no prices)
          const isFallback = exactMatchWithoutPrices !== null && score < exactMatchWithoutPrices.score;

          if (isFallback) {
            console.log(`[SportsCardsPro] ✓ Using FALLBACK product with prices: ${product['product-name']}`);
            console.log(`[SportsCardsPro]   (Exact match "${exactMatchWithoutPrices.product['product-name']}" had no prices)`);
          } else {
            console.log('[SportsCardsPro] ✓ Found matching product with prices:', product['product-name']);
          }

          // Determine confidence based on match quality
          // High (30+): matched parallel AND serial
          // Medium (15-29): matched parallel OR serial
          // Low (<15): only matched card number/set OR using fallback
          let confidence: 'high' | 'medium' | 'low' = 'low';
          if (!isFallback && score >= 30) {
            confidence = 'high';
          } else if (!isFallback && score >= 15) {
            confidence = 'medium';
          }

          return {
            prices: {
              ...normalized,
              // Include fallback info so UI can show appropriate message
              isFallback: isFallback,
              exactMatchName: isFallback ? exactMatchWithoutPrices.product['product-name'] : undefined,
            },
            matchConfidence: confidence,
            queryUsed: query,
          };
        } else {
          // No prices for this product - remember it if it's our best match so far
          if (!exactMatchWithoutPrices || score > exactMatchWithoutPrices.score) {
            exactMatchWithoutPrices = { product, score };
            console.log(`[SportsCardsPro] Best match so far (no prices): ${product['product-name']} (score ${score})`);
          }
          // Continue looking for a similar card with prices
          console.log('[SportsCardsPro] Product has no prices, continuing search for similar card...');
        }
      }
    }

    // If we found an exact match but no prices anywhere, return it with info
    if (exactMatchWithoutPrices) {
      console.log(`[SportsCardsPro] No prices found. Best match was: ${exactMatchWithoutPrices.product['product-name']}`);
      return {
        prices: {
          raw: null,
          psa: {},
          bgs: {},
          sgc: {},
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

  // No matching products found at all
  console.log('[SportsCardsPro] No matching products found');
  return {
    prices: null,
    matchConfidence: 'none',
    queryUsed: query,
  };
}

/**
 * Get all available parallels for a sports card
 * Returns all matching products with the same card number for user selection
 */
export async function getAvailableParallels(
  params: SportsCardSearchParams
): Promise<{ id: string; name: string; setName: string; hasPrice: boolean }[]> {
  console.log('[SportsCardsPro] === GET AVAILABLE PARALLELS ===');
  console.log('[SportsCardsPro] Player:', params.playerName);
  console.log('[SportsCardsPro] Card #:', params.cardNumber || '(not specified)');

  // Build a simpler query without variant to find all parallels
  const paramsWithoutVariant = { ...params, variant: undefined, serialNumbering: undefined };
  const query = buildSportsCardQuery(paramsWithoutVariant);
  console.log('[SportsCardsPro] PARALLEL SEARCH QUERY:', `"${query}"`);

  const products = await searchProducts(query, { limit: 25 });

  if (products.length === 0) {
    console.log('[SportsCardsPro] No products found for parallel search');
    return [];
  }

  // Helper function to normalize names for comparison
  // Handle variations: "CJ Stroud" vs "C.J. Stroud", multi-player cards with "/"
  const normalizeForComparison = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[.\/]/g, ' ')       // Remove periods and slashes
      .replace(/\s+/g, ' ')         // Normalize spaces
      .replace(/(\b\w)\s+(?=\w\b)/g, '$1')  // Collapse single letters: "c j " -> "cj"
      .trim();
  };

  // Filter to products that match the card number AND player name
  const matchingProducts = products.filter(product => {
    const productName = product['product-name']?.toLowerCase() || '';

    // Player name validation - product MUST contain the player's name
    if (params.playerName) {
      const normalizedPlayer = normalizeForComparison(params.playerName);
      const normalizedProduct = normalizeForComparison(productName);

      const playerParts = normalizedPlayer.split(/\s+/).filter(p => p.length > 1);
      const requiredMatches = playerParts.length <= 2 ? playerParts.length : Math.min(3, Math.ceil(playerParts.length / 2));

      const matchingParts = playerParts.filter(part => normalizedProduct.includes(part));
      if (matchingParts.length < requiredMatches) {
        return false;
      }
    }

    // If we have a card number, product MUST contain it
    if (params.cardNumber) {
      const cleanCardNum = cleanCardNumber(params.cardNumber).toLowerCase();
      const cleanCardNumNoZeros = stripLeadingZeros(cleanCardNum);
      const normalizedSearchNum = normalizeCardNumberForComparison(cleanCardNum);
      const normalizedSearchNumNoZeros = normalizeCardNumberForComparison(cleanCardNumNoZeros);
      const normalizedProductName = normalizeCardNumberForComparison(productName);

      // Check both exact and normalized matches, with and without leading zeros
      const exactMatch = productName.includes(`#${cleanCardNum}`) || productName.includes(cleanCardNum) ||
        productName.includes(`#${cleanCardNumNoZeros}`) || productName.includes(cleanCardNumNoZeros);
      const normalizedMatch = normalizedProductName.includes(`#${normalizedSearchNum}`) || normalizedProductName.includes(normalizedSearchNum) ||
        normalizedProductName.includes(`#${normalizedSearchNumNoZeros}`) || normalizedProductName.includes(normalizedSearchNumNoZeros);

      if (!exactMatch && !normalizedMatch) {
        return false;
      }
    }

    return true;
  });

  console.log(`[SportsCardsPro] Found ${matchingProducts.length} parallel variants`);

  // Check which products have pricing data (async check for first few)
  const parallelsWithPriceInfo = await Promise.all(
    matchingProducts.map(async (product) => {
      // Quick check for price data - look at search result fields first
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
    })
  );

  // Sort: products with prices first, then alphabetically
  parallelsWithPriceInfo.sort((a, b) => {
    if (a.hasPrice && !b.hasPrice) return -1;
    if (!a.hasPrice && b.hasPrice) return 1;
    return a.name.localeCompare(b.name);
  });

  return parallelsWithPriceInfo;
}

/**
 * Get prices for a specific product by ID
 * Used when user manually selects a parallel
 */
export async function getPricesForProductId(
  productId: string
): Promise<NormalizedPrices | null> {
  console.log(`[SportsCardsPro] === GET PRICES FOR SELECTED PRODUCT: ${productId} ===`);

  const priceData = await getProductPrices(productId);
  if (!priceData) {
    console.log('[SportsCardsPro] No price data found for product');
    return null;
  }

  const normalized = normalizePrices(priceData);
  return normalized;
}

/**
 * Check if PriceCharting API is configured and available
 */
export function isPriceChartingEnabled(): boolean {
  return !!process.env.PRICECHARTING_API_KEY;
}
