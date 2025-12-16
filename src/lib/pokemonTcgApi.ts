// src/lib/pokemonTcgApi.ts
// Pokemon TCG API client for fetching card data
// Now uses local Supabase database first, with API fallback for new releases

import { createClient } from '@supabase/supabase-js';

const POKEMON_API_BASE = 'https://api.pokemontcg.io/v2';
// Get API key from environment variable - NO HARDCODED FALLBACKS
const POKEMON_API_KEY = process.env.POKEMON_TCG_API_KEY || '';

// DISABLE EXTERNAL API - Use local database only
// Set to true to disable all external Pokemon TCG API calls
// The local database should have all cards from the import
const DISABLE_EXTERNAL_API = true;

// Initialize Supabase client for local database queries
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create Supabase client only if we have the required env vars
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface PokemonCard {
  id: string;                    // "base1-4"
  name: string;                  // "Charizard"
  supertype: string;             // "Pokémon"
  subtypes: string[];            // ["Stage 2"]
  hp?: string;                   // "120"
  types?: string[];              // ["Fire"]
  evolvesFrom?: string;          // "Charmeleon"

  set: {
    id: string;                  // "base1"
    name: string;                // "Base"
    series: string;              // "Base"
    printedTotal: number;        // 102
    total: number;               // 102
    releaseDate: string;         // "1999/01/09"
    images: {
      symbol: string;
      logo: string;
    };
  };

  number: string;                // "4"
  rarity: string;                // "Rare Holo"
  artist?: string;               // "Mitsuhiro Arita"

  images: {
    small: string;               // Low-res image URL
    large: string;               // High-res image URL
  };

  tcgplayer?: {
    url: string;
    updatedAt: string;
    prices?: {
      holofoil?: {
        low: number;
        mid: number;
        high: number;
        market: number;
      };
      normal?: {
        low: number;
        mid: number;
        high: number;
        market: number;
      };
      '1stEditionHolofoil'?: {
        low: number;
        mid: number;
        high: number;
        market: number;
      };
      reverseHolofoil?: {
        low: number;
        mid: number;
        high: number;
        market: number;
      };
    };
  };

  cardmarket?: {
    url: string;
    updatedAt: string;
    prices?: {
      averageSellPrice: number;
      lowPrice: number;
      trendPrice: number;
    };
  };
}

export interface PokemonSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  releaseDate: string;
  images: {
    symbol: string;
    logo: string;
  };
}

// Local database result type
interface LocalCardResult {
  id: string;
  name: string;
  number: string;
  set_id: string | null;
  supertype: string | null;
  subtypes: string[] | null;
  types: string[] | null;
  hp: string | null;
  evolves_from: string | null;
  evolves_to: string[] | null;
  rarity: string | null;
  artist: string | null;
  flavor_text: string | null;
  image_small: string | null;
  image_large: string | null;
  tcgplayer_url: string | null;
  cardmarket_url: string | null;
  set_name: string | null;
  set_series: string | null;
  set_printed_total: number | null;
  set_release_date: string | null;
}

/**
 * Convert local database result to PokemonCard interface
 */
function convertLocalCardToApiFormat(card: LocalCardResult): PokemonCard {
  return {
    id: card.id,
    name: card.name,
    supertype: card.supertype || 'Pokémon',
    subtypes: card.subtypes || [],
    hp: card.hp || undefined,
    types: card.types || undefined,
    evolvesFrom: card.evolves_from || undefined,
    set: {
      id: card.set_id || '',
      name: card.set_name || '',
      series: card.set_series || '',
      printedTotal: card.set_printed_total || 0,
      total: card.set_printed_total || 0, // Use printedTotal as total
      releaseDate: card.set_release_date || '',
      images: {
        symbol: '',
        logo: ''
      }
    },
    number: card.number,
    rarity: card.rarity || '',
    artist: card.artist || undefined,
    images: {
      small: card.image_small || '',
      large: card.image_large || ''
    },
    tcgplayer: card.tcgplayer_url ? {
      url: card.tcgplayer_url,
      updatedAt: ''
    } : undefined,
    cardmarket: card.cardmarket_url ? {
      url: card.cardmarket_url,
      updatedAt: ''
    } : undefined
  };
}

/**
 * Search local Supabase database for Pokemon cards
 * Returns cards matching name, optionally filtered by set name and card number
 */
export async function searchLocalDatabase(
  name: string,
  setName?: string,
  cardNumber?: string
): Promise<PokemonCard[]> {
  if (!supabase) {
    console.log('[Pokemon Local DB] Supabase not configured, skipping local search');
    return [];
  }

  try {
    console.log('[Pokemon Local DB] Searching:', { name, setName, cardNumber });

    let query = supabase
      .from('pokemon_cards')
      .select('*')
      .ilike('name', `%${name}%`);

    // Add set name filter if provided
    if (setName) {
      query = query.ilike('set_name', `%${setName}%`);
    }

    // Add card number filter if provided
    if (cardNumber) {
      // Try exact match first, then partial
      query = query.eq('number', cardNumber);
    }

    // Limit results and order by relevance (newer sets first)
    query = query.order('set_release_date', { ascending: false }).limit(20);

    const { data, error } = await query;

    if (error) {
      console.error('[Pokemon Local DB] Search error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('[Pokemon Local DB] No results found');
      return [];
    }

    console.log(`[Pokemon Local DB] Found ${data.length} card(s)`);
    return data.map(convertLocalCardToApiFormat);
  } catch (error) {
    console.error('[Pokemon Local DB] Exception during search:', error);
    return [];
  }
}

/**
 * Generate nearby number variations for fuzzy matching
 * For SM226, generates: SM224, SM225, SM226, SM227, SM228 (±2 range)
 * For standard numbers like "4", generates: 2, 3, 4, 5, 6
 */
function generateNearbyNumbers(cardNumber: string, range: number = 3): string[] {
  const variations: string[] = [];

  // Check for prefix format like SM226, SWSH039, TG10
  const prefixMatch = cardNumber.match(/^([A-Za-z]+)(\d+)$/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    const num = parseInt(prefixMatch[2], 10);
    const padLength = prefixMatch[2].length; // Preserve leading zeros

    for (let i = -range; i <= range; i++) {
      const newNum = num + i;
      if (newNum > 0) {
        variations.push(prefix + String(newNum).padStart(padLength, '0'));
      }
    }
    return variations;
  }

  // Standard numeric format
  const numMatch = cardNumber.match(/^(\d+)$/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    for (let i = -range; i <= range; i++) {
      const newNum = num + i;
      if (newNum > 0) {
        variations.push(String(newNum));
      }
    }
    return variations;
  }

  // If we can't parse it, just return the original
  return [cardNumber];
}

/**
 * Fuzzy number search - tries nearby numbers when exact match fails
 * Cross-references with card name to find the correct card
 * Exported for use in verification code
 */
export async function searchLocalFuzzyNumber(
  name: string,
  cardNumber: string,
  setId?: string
): Promise<{ card: PokemonCard | null, matchedNumber: string | null }> {
  if (!supabase) {
    return { card: null, matchedNumber: null };
  }

  try {
    // Generate nearby number variations
    const numberVariations = generateNearbyNumbers(cardNumber, 3);
    console.log(`[Pokemon Local DB] Fuzzy search: name="${name}", trying numbers:`, numberVariations);

    // Build query for all number variations at once
    let query = supabase
      .from('pokemon_cards')
      .select('*')
      .ilike('name', `%${name}%`)
      .in('number', numberVariations);

    // Add set filter if provided
    if (setId) {
      query = query.eq('set_id', setId);
    }

    query = query.order('set_release_date', { ascending: false }).limit(20);

    const { data, error } = await query;

    if (error) {
      console.error('[Pokemon Local DB] Fuzzy search error:', error);
      return { card: null, matchedNumber: null };
    }

    if (!data || data.length === 0) {
      console.log('[Pokemon Local DB] No fuzzy matches found');
      return { card: null, matchedNumber: null };
    }

    // Score and rank matches
    // Prefer: exact name match > partial name match
    // Then: closest number to original
    const originalNum = parseInt(cardNumber.replace(/^[A-Za-z]+/, ''), 10);

    const scored = data.map(card => {
      const cardNum = parseInt(card.number.replace(/^[A-Za-z]+/, ''), 10);
      const numberDistance = Math.abs(cardNum - originalNum);
      const exactNameMatch = card.name.toLowerCase() === name.toLowerCase();

      return {
        card,
        score: (exactNameMatch ? 100 : 0) - numberDistance,
        numberDistance
      };
    });

    // Sort by score (higher = better)
    scored.sort((a, b) => b.score - a.score);

    const bestMatch = scored[0];
    console.log(`[Pokemon Local DB] Fuzzy match found: ${bestMatch.card.name} #${bestMatch.card.number} (distance: ${bestMatch.numberDistance})`);

    return {
      card: convertLocalCardToApiFormat(bestMatch.card),
      matchedNumber: bestMatch.card.number
    };
  } catch (error) {
    console.error('[Pokemon Local DB] Fuzzy search exception:', error);
    return { card: null, matchedNumber: null };
  }
}

/**
 * Search local database by name, number, and set ID (for promo cards)
 */
export async function searchLocalByNameNumberSetId(
  name: string,
  cardNumber: string,
  setId: string
): Promise<PokemonCard[]> {
  if (!supabase) {
    return [];
  }

  try {
    console.log('[Pokemon Local DB] Searching promo by name+number+setId:', { name, cardNumber, setId });

    const { data, error } = await supabase
      .from('pokemon_cards')
      .select('*')
      .ilike('name', `%${name}%`)
      .eq('number', cardNumber)
      .eq('set_id', setId)
      .limit(10);

    if (error) {
      console.error('[Pokemon Local DB] Promo search error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    console.log(`[Pokemon Local DB] Found ${data.length} promo card(s)`);
    return data.map(convertLocalCardToApiFormat);
  } catch (error) {
    console.error('[Pokemon Local DB] Promo search exception:', error);
    return [];
  }
}

/**
 * Search local database by name, number, and set printed total
 * This is the primary lookup for grading (uses the denormalized set_printed_total)
 */
export async function searchLocalByNameNumberTotal(
  name: string,
  cardNumber: string,
  printedTotal?: number
): Promise<PokemonCard[]> {
  if (!supabase) {
    return [];
  }

  try {
    console.log('[Pokemon Local DB] Searching by name+number+total:', { name, cardNumber, printedTotal });

    let query = supabase
      .from('pokemon_cards')
      .select('*')
      .ilike('name', `%${name}%`)
      .eq('number', cardNumber);

    if (printedTotal) {
      query = query.eq('set_printed_total', printedTotal);
    }

    query = query.order('set_release_date', { ascending: false }).limit(10);

    const { data, error } = await query;

    if (error) {
      console.error('[Pokemon Local DB] Search error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    console.log(`[Pokemon Local DB] Found ${data.length} card(s) by name+number+total`);
    return data.map(convertLocalCardToApiFormat);
  } catch (error) {
    console.error('[Pokemon Local DB] Exception:', error);
    return [];
  }
}

/**
 * Search for Pokemon cards by name and optional set
 * Now searches local database first, with API fallback (if enabled)
 */
export async function searchPokemonCards(
  name: string,
  setName?: string,
  cardNumber?: string
): Promise<PokemonCard[]> {
  // 1. Try local database first (fast, no API calls)
  const localResults = await searchLocalDatabase(name, setName, cardNumber);
  if (localResults.length > 0) {
    console.log(`[Pokemon Search] ✅ Found ${localResults.length} card(s) in local database`);
    return localResults;
  }

  // If external API is disabled, return empty (local-only mode)
  if (DISABLE_EXTERNAL_API) {
    console.log('[Pokemon Search] Local database miss, external API disabled - returning empty');
    return [];
  }

  console.log('[Pokemon Search] Local database miss, falling back to API...');

  // 2. Fall back to external API
  try {
    // Build query
    let query = `name:"${name}"`;
    if (cardNumber) {
      query += ` number:"${cardNumber}"`;
    }
    if (setName) {
      query += ` set.name:"${setName}"`;
    }

    const url = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query)}`;

    // Add timeout and retry logic for flaky API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const response = await fetch(url, {
        headers: {
          'X-Api-Key': POKEMON_API_KEY
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // For 504 timeout errors, just return empty instead of throwing
        if (response.status === 504) {
          console.warn(`Pokemon TCG API timeout (504) for query: ${query}`);
          return [];
        }
        throw new Error(`Pokemon TCG API error: ${response.status}`);
      }

      const json = await response.json();
      return json.data || [];
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.warn(`Pokemon TCG API request timeout for query: ${query}`);
        return [];
      }
      throw error;
    }
  } catch (error) {
    console.error('Error searching Pokemon cards:', error);
    return [];
  }
}

/**
 * Card number format types for format-aware API queries
 */
export type CardNumberFormat =
  | 'fraction'          // Standard X/Y format (240/193)
  | 'swsh_promo'        // SWSH prefix (SWSH039)
  | 'sv_promo'          // Scarlet & Violet promo (SVP EN 085, or just digits)
  | 'trainer_gallery'   // TG prefix (TG10/TG30)
  | 'galarian_gallery'  // GG prefix (GG33/GG70)
  | 'single'            // Just a number (25)
  | 'none';             // No visible number

/**
 * Normalize card number to API-compatible format based on detected format type
 * Returns array of variations to try (most likely first)
 *
 * API NUMBER FORMATS (confirmed via research):
 * - SVP promos: Store ONLY digits ("85" not "SVP EN 085")
 * - SWSH promos: Store full prefix+number ("SWSH039")
 * - Gallery cards: Store prefix+number ("TG10", "GG33")
 * - Standard cards: Store just numerator ("240")
 */
export function normalizeCardNumber(cardNumber: string, format: CardNumberFormat): string[] {
  if (!cardNumber) return [];

  const variations: string[] = [];

  switch (format) {
    case 'fraction':
      // "240/193" → ["240"]
      // "025/102" → ["25", "025"]
      const numerator = cardNumber.split('/')[0]?.trim() || cardNumber;
      const withoutLeading = numerator.replace(/^0+/, '');
      if (withoutLeading && withoutLeading !== numerator) {
        variations.push(withoutLeading); // Try without leading zeros first
        variations.push(numerator);
      } else {
        variations.push(numerator);
      }
      break;

    case 'swsh_promo':
      // "SWSH039" → ["SWSH039", "SWSH39"] - API stores with prefix
      const swshMatch = cardNumber.match(/SWSH(\d+)/i);
      if (swshMatch) {
        const num = swshMatch[1];
        const withoutLeadingZeros = num.replace(/^0+/, '') || num;
        variations.push(`SWSH${num}`); // Original format first
        if (withoutLeadingZeros !== num) {
          variations.push(`SWSH${withoutLeadingZeros}`);
        }
      } else {
        variations.push(cardNumber);
      }
      break;

    case 'sv_promo':
      // "SVP EN 085" → ["85", "085"] - API stores ONLY digits
      // "085" → ["85", "085"]
      const svDigits = cardNumber.match(/\d+/)?.[0] || '';
      if (svDigits) {
        const noLeading = svDigits.replace(/^0+/, '') || svDigits;
        variations.push(noLeading); // Try without leading zeros first (API preference)
        if (noLeading !== svDigits) {
          variations.push(svDigits);
        }
      }
      break;

    case 'trainer_gallery':
      // "TG10/TG30" or "TG10" → ["TG10"]
      const tgNumber = cardNumber.split('/')[0]?.trim() || cardNumber;
      variations.push(tgNumber);
      break;

    case 'galarian_gallery':
      // "GG33/GG70" or "GG33" → ["GG33"]
      const ggNumber = cardNumber.split('/')[0]?.trim() || cardNumber;
      variations.push(ggNumber);
      break;

    case 'single':
      // "25" → ["25"]
      // "025" → ["25", "025"]
      const singleNum = cardNumber.trim();
      const singleNoLeading = singleNum.replace(/^0+/, '') || singleNum;
      if (singleNoLeading !== singleNum) {
        variations.push(singleNoLeading);
        variations.push(singleNum);
      } else {
        variations.push(singleNum);
      }
      break;

    case 'none':
    default:
      // No card number to normalize
      break;
  }

  // Remove duplicates while preserving order
  return [...new Set(variations)];
}

/**
 * Detect card number format from the raw printed number
 */
export function detectCardNumberFormat(cardNumberRaw: string): CardNumberFormat {
  if (!cardNumberRaw) return 'none';

  const raw = cardNumberRaw.trim().toUpperCase();

  // Check for SWSH promo format: SWSH###
  if (/^SWSH\d+$/i.test(raw)) {
    return 'swsh_promo';
  }

  // Check for SV promo format: SVP EN ###, SVP ###, or just digits with known context
  if (/SVP/i.test(raw) || /^SVP?\s*(EN\s*)?\d+$/i.test(raw)) {
    return 'sv_promo';
  }

  // Check for Trainer Gallery: TG##/TG## or TG##
  if (/^TG\d+/i.test(raw)) {
    return 'trainer_gallery';
  }

  // Check for Galarian Gallery: GG##/GG## or GG##
  if (/^GG\d+/i.test(raw)) {
    return 'galarian_gallery';
  }

  // Check for standard fraction format: X/Y
  if (/^\d+\s*\/\s*\d+$/.test(raw)) {
    return 'fraction';
  }

  // Check for single number (digits only, possibly with leading zeros)
  if (/^\d+$/.test(raw)) {
    return 'single';
  }

  // Default: try to extract something useful
  if (/\d/.test(raw)) {
    return 'single'; // Has digits, treat as single
  }

  return 'none';
}

/**
 * Get the appropriate set.id constraint for promo formats
 */
export function getPromoSetId(format: CardNumberFormat): string | null {
  switch (format) {
    case 'swsh_promo':
      return 'swshp';
    case 'sv_promo':
      return 'svp';
    case 'galarian_gallery':
      return 'swsh12pt5gg'; // Crown Zenith Galarian Gallery
    default:
      return null;
  }
}

/**
 * Smart search with multi-tier fallback strategy
 * Tries multiple search strategies to find the best matches
 * Enhanced with format-aware card number handling
 */
export async function smartSearchPokemonCards(
  name: string,
  setName?: string,
  cardNumber?: string,
  fullNumberText?: string
): Promise<{ results: PokemonCard[], strategy: string }> {
  console.log('[Pokemon Smart Search] Starting with:', { name, setName, cardNumber, fullNumberText });

  // Clean up inputs - ignore "Not visible" or similar placeholder values
  const cleanSetName = setName && !setName.toLowerCase().includes('not visible') && !setName.toLowerCase().includes('unknown') ? setName : undefined;
  const cleanCardNumber = cardNumber && !cardNumber.toLowerCase().includes('not visible') && !cardNumber.toLowerCase().includes('unknown') ? cardNumber : undefined;
  const cleanFullText = fullNumberText && !fullNumberText.toLowerCase().includes('not visible') && !fullNumberText.toLowerCase().includes('unknown') ? fullNumberText : undefined;

  // Extract just the card number without the total (e.g., "4" from "4/102")
  const justNumber = cleanCardNumber?.split('/')[0]?.trim();

  // Generate multiple number format variations to try (remove duplicates)
  const numberVariationsSet = new Set<string>();
  if (justNumber) {
    numberVariationsSet.add(justNumber); // "085"
    const withoutLeadingZeros = justNumber.replace(/^0+/, '');
    if (withoutLeadingZeros && withoutLeadingZeros !== justNumber) {
      numberVariationsSet.add(withoutLeadingZeros); // "85" (without leading zeros)
    }
  }
  if (cleanFullText && cleanFullText !== justNumber) {
    numberVariationsSet.add(cleanFullText); // "SVP EN 085"
  }
  if (cleanCardNumber && cleanCardNumber !== justNumber) {
    numberVariationsSet.add(cleanCardNumber); // "4/102" format
  }

  const numberVariations = Array.from(numberVariationsSet);

  console.log('[Pokemon Smart Search] Cleaned inputs:', { name, cleanSetName, numberVariations });

  // Strategy 1: Most Precise - name + number + set (try all number variations)
  if (numberVariations.length > 0 && cleanSetName) {
    console.log('[Pokemon Smart Search] Strategy 1: name + number + set (with variations)');
    for (const numVariation of numberVariations) {
      const results = await searchPokemonCards(name, cleanSetName, numVariation);
      if (results.length > 0) {
        console.log(`[Pokemon Smart Search] ✅ Found ${results.length} card(s) with Strategy 1 using number: ${numVariation}`);
        return { results, strategy: `precise (name + number[${numVariation}] + set)` };
      }
    }
  }

  // Strategy 2: Very Good - name + number (try all variations)
  if (numberVariations.length > 0) {
    console.log('[Pokemon Smart Search] Strategy 2: name + number (with variations)');
    for (const numVariation of numberVariations) {
      const results = await searchPokemonCards(name, undefined, numVariation);
      if (results.length > 0) {
        console.log(`[Pokemon Smart Search] ✅ Found ${results.length} card(s) with Strategy 2 using number: ${numVariation}`);
        return { results, strategy: `good (name + number[${numVariation}])` };
      }
    }
  }

  // Strategy 3: Good - name + set
  if (cleanSetName) {
    console.log('[Pokemon Smart Search] Strategy 3: name + set');
    const results = await searchPokemonCards(name, cleanSetName);
    if (results.length > 0) {
      console.log(`[Pokemon Smart Search] ✅ Found ${results.length} card(s) with Strategy 3`);
      return { results, strategy: 'moderate (name + set)' };
    }
  }

  // Strategy 4: Broad - name only
  console.log('[Pokemon Smart Search] Strategy 4: name only');
  const results = await searchPokemonCards(name);
  if (results.length > 0) {
    console.log(`[Pokemon Smart Search] ✅ Found ${results.length} card(s) with Strategy 4`);
    return { results, strategy: 'broad (name only)' };
  }

  // No results found
  console.log('[Pokemon Smart Search] ❌ No cards found with any strategy');
  return { results, strategy: 'none' };
}

/**
 * Enhanced format-aware smart search
 * Uses detected card number format to optimize API queries
 *
 * @param name - Pokemon name
 * @param cardNumber - Extracted card number (numerator only for API)
 * @param cardNumberRaw - Full printed card number as shown on card
 * @param cardNumberFormat - Detected format type (or will be auto-detected from raw)
 * @param setName - Set name (optional)
 * @param setTotal - Denominator from card number (for set identification)
 */
export async function formatAwareSearch(
  name: string,
  cardNumber?: string,
  cardNumberRaw?: string,
  cardNumberFormat?: CardNumberFormat,
  setName?: string,
  setTotal?: string
): Promise<{ results: PokemonCard[], strategy: string }> {
  console.log('[Format-Aware Search] Starting with:', {
    name, cardNumber, cardNumberRaw, cardNumberFormat, setName, setTotal
  });

  // Clean up inputs
  const cleanSetName = setName && !setName.toLowerCase().includes('not visible') &&
                       !setName.toLowerCase().includes('unknown') ? setName : undefined;

  // Auto-detect format if not provided
  const format: CardNumberFormat = cardNumberFormat ||
    (cardNumberRaw ? detectCardNumberFormat(cardNumberRaw) : 'none');

  console.log('[Format-Aware Search] Detected format:', format);

  // Get format-specific API variations
  const numberVariations = normalizeCardNumber(cardNumber || cardNumberRaw || '', format);
  console.log('[Format-Aware Search] Number variations:', numberVariations);

  // Get promo set ID if applicable
  const promoSetId = getPromoSetId(format);

  // Strategy 0 (NEW): For promos, search with set.id constraint first
  // Try local database first, then API fallback
  if (promoSetId && numberVariations.length > 0) {
    console.log(`[Format-Aware Search] Strategy 0: Promo search with set.id:${promoSetId}`);

    // Try local database first
    for (const numVariation of numberVariations) {
      const localResults = await searchLocalByNameNumberSetId(name, numVariation, promoSetId);
      if (localResults.length > 0) {
        console.log(`[Format-Aware Search] ✅ Found ${localResults.length} promo card(s) in LOCAL DB`);
        return { results: localResults, strategy: `promo-local (name + number[${numVariation}] + set.id:${promoSetId})` };
      }
    }

    // Fall back to API (if enabled)
    if (!DISABLE_EXTERNAL_API) {
      console.log('[Format-Aware Search] Local DB miss for promo, falling back to API');
      for (const numVariation of numberVariations) {
        // Build query with set.id constraint
        const query = `name:"${name}" number:"${numVariation}" set.id:${promoSetId}`;
        const url = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query)}`;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(url, {
            headers: { 'X-Api-Key': POKEMON_API_KEY },
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const json = await response.json();
            if (json.data?.length > 0) {
              console.log(`[Format-Aware Search] ✅ Found ${json.data.length} card(s) with promo strategy (API)`);
              return { results: json.data, strategy: `promo (name + number[${numVariation}] + set.id:${promoSetId})` };
            }
          }
        } catch (error: any) {
          if (error.name === 'AbortError') {
            console.warn('[Format-Aware Search] Promo search timeout');
          }
        }
      }
    }
  }

  // Strategy 1: Use setTotal (denominator) to filter by printedTotal
  // Try local database first, then API fallback
  if (setTotal && numberVariations.length > 0 && format === 'fraction') {
    // Clean the setTotal (remove TG/GG prefixes if present, extract number)
    const printedTotal = setTotal.replace(/^[A-Za-z]+/, '').trim();
    if (printedTotal && /^\d+$/.test(printedTotal)) {
      console.log(`[Format-Aware Search] Strategy 1: name + number + set.printedTotal:${printedTotal}`);

      // Try local database first (fast!)
      for (const numVariation of numberVariations) {
        const localResults = await searchLocalByNameNumberTotal(name, numVariation, parseInt(printedTotal));
        if (localResults.length > 0) {
          console.log(`[Format-Aware Search] ✅ Found ${localResults.length} card(s) in LOCAL DB with printedTotal strategy`);
          return { results: localResults, strategy: `precise-local (name + number[${numVariation}] + printedTotal:${printedTotal})` };
        }
      }

      // Fall back to API if not in local database (if enabled)
      if (!DISABLE_EXTERNAL_API) {
        console.log('[Format-Aware Search] Local DB miss, falling back to API for printedTotal search');
        for (const numVariation of numberVariations) {
          const query = `name:"${name}" number:"${numVariation}" set.printedTotal:${printedTotal}`;
          const url = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query)}`;

          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(url, {
              headers: { 'X-Api-Key': POKEMON_API_KEY },
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
              const json = await response.json();
              if (json.data?.length > 0) {
                console.log(`[Format-Aware Search] ✅ Found ${json.data.length} card(s) with printedTotal strategy (API)`);
                return { results: json.data, strategy: `precise (name + number[${numVariation}] + printedTotal:${printedTotal})` };
              }
            }
          } catch (error: any) {
            if (error.name === 'AbortError') {
              console.warn('[Format-Aware Search] PrintedTotal search timeout');
            }
          }
        }
      }
    }
  }

  // Strategy 2: Name + number + set name (existing approach)
  if (numberVariations.length > 0 && cleanSetName) {
    console.log('[Format-Aware Search] Strategy 2: name + number + set name');
    for (const numVariation of numberVariations) {
      const results = await searchPokemonCards(name, cleanSetName, numVariation);
      if (results.length > 0) {
        console.log(`[Format-Aware Search] ✅ Found ${results.length} card(s) with Strategy 2`);
        return { results, strategy: `good (name + number[${numVariation}] + set)` };
      }
    }
  }

  // Strategy 3: Name + number only
  if (numberVariations.length > 0) {
    console.log('[Format-Aware Search] Strategy 3: name + number');
    for (const numVariation of numberVariations) {
      const results = await searchPokemonCards(name, undefined, numVariation);
      if (results.length > 0) {
        console.log(`[Format-Aware Search] ✅ Found ${results.length} card(s) with Strategy 3`);
        return { results, strategy: `moderate (name + number[${numVariation}])` };
      }
    }
  }

  // Strategy 3.5 (NEW): Fuzzy number matching - try nearby numbers with same name
  // This helps when OCR misreads the number (e.g., SM226 vs SM228)
  if (numberVariations.length > 0) {
    console.log('[Format-Aware Search] Strategy 3.5: Fuzzy number matching (±3 range)');
    const primaryNumber = numberVariations[0];

    // Detect if this is a promo card to narrow search
    const promoSetId = getPromoSetId(format);

    const fuzzyResult = await searchLocalFuzzyNumber(name, primaryNumber, promoSetId || undefined);
    if (fuzzyResult.card) {
      const correctedNumber = fuzzyResult.matchedNumber;
      console.log(`[Format-Aware Search] ✅ Fuzzy match found! AI read "${primaryNumber}", corrected to "${correctedNumber}"`);
      return {
        results: [fuzzyResult.card],
        strategy: `fuzzy-number (name + nearby numbers, corrected ${primaryNumber} → ${correctedNumber})`
      };
    }
  }

  // Strategy 4: Name + set name
  if (cleanSetName) {
    console.log('[Format-Aware Search] Strategy 4: name + set');
    const results = await searchPokemonCards(name, cleanSetName);
    if (results.length > 0) {
      console.log(`[Format-Aware Search] ✅ Found ${results.length} card(s) with Strategy 4`);
      return { results, strategy: 'broad (name + set)' };
    }
  }

  // Strategy 5: Name only (fallback)
  console.log('[Format-Aware Search] Strategy 5: name only');
  const results = await searchPokemonCards(name);
  if (results.length > 0) {
    console.log(`[Format-Aware Search] ✅ Found ${results.length} card(s) with Strategy 5`);
    return { results, strategy: 'fallback (name only)' };
  }

  console.log('[Format-Aware Search] ❌ No cards found');
  return { results: [], strategy: 'none' };
}

/**
 * Get a specific card by ID
 */
export async function getPokemonCardById(cardId: string): Promise<PokemonCard | null> {
  // If external API is disabled, we can't fetch by ID (would need local DB lookup)
  if (DISABLE_EXTERNAL_API) {
    console.log('[Pokemon API] getPokemonCardById disabled - external API is off');
    return null;
  }

  try {
    const url = `${POKEMON_API_BASE}/cards/${cardId}`;

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': POKEMON_API_KEY
      }
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return json.data || null;
  } catch (error) {
    console.error('Error fetching Pokemon card:', error);
    return null;
  }
}

/**
 * Search for Pokemon sets
 */
export async function searchPokemonSets(name: string): Promise<PokemonSet[]> {
  // If external API is disabled, return empty (would need local DB lookup)
  if (DISABLE_EXTERNAL_API) {
    console.log('[Pokemon API] searchPokemonSets disabled - external API is off');
    return [];
  }

  try {
    const query = `name:"${name}"`;
    const url = `${POKEMON_API_BASE}/sets?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': POKEMON_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Pokemon TCG API error: ${response.status}`);
    }

    const json = await response.json();
    return json.data || [];
  } catch (error) {
    console.error('Error searching Pokemon sets:', error);
    return [];
  }
}

/**
 * Get all available rarities
 */
export async function getPokemonRarities(): Promise<string[]> {
  // If external API is disabled, return empty
  if (DISABLE_EXTERNAL_API) {
    console.log('[Pokemon API] getPokemonRarities disabled - external API is off');
    return [];
  }

  try {
    const url = `${POKEMON_API_BASE}/rarities`;

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': POKEMON_API_KEY
      }
    });

    if (!response.ok) {
      return [];
    }

    const json = await response.json();
    return json.data || [];
  } catch (error) {
    console.error('Error fetching rarities:', error);
    return [];
  }
}

/**
 * Lookup result for set identification (hybrid system)
 */
export interface SetLookupResult {
  success: boolean;
  set_name: string | null;
  set_id: string | null;
  set_year: number | null;
  set_era: string | null;
  set_confidence: 'high' | 'medium' | 'low';
  set_identifier_source: string[];
  set_identifier_reason: string;
  cache_hit: boolean;
  error?: string;
}

// In-memory cache for set lookups
const setLookupCache = new Map<string, SetLookupResult>();

/**
 * Infer era from series name
 */
function inferEraFromSeries(series: string): string | null {
  const seriesLower = series.toLowerCase();

  if (seriesLower.includes('scarlet') || seriesLower.includes('violet')) {
    return 'Scarlet & Violet';
  }
  if (seriesLower.includes('sword') || seriesLower.includes('shield')) {
    return 'Sword & Shield';
  }
  if (seriesLower.includes('sun') || seriesLower.includes('moon')) {
    return 'Sun & Moon';
  }
  if (seriesLower.includes('xy')) {
    return 'XY';
  }
  if (seriesLower.includes('black') || seriesLower.includes('white')) {
    return 'Black & White';
  }
  if (seriesLower.includes('diamond') || seriesLower.includes('pearl') || seriesLower.includes('platinum')) {
    return 'Diamond & Pearl';
  }
  if (seriesLower.includes('heartgold') || seriesLower.includes('soulsilver')) {
    return 'HeartGold SoulSilver';
  }
  if (seriesLower.includes('ex')) {
    return 'EX';
  }
  if (seriesLower.includes('base') || seriesLower.includes('jungle') || seriesLower.includes('fossil') || seriesLower.includes('rocket')) {
    return 'WOTC';
  }

  return series; // Return as-is if no match
}

/**
 * Extract year from release date string
 */
function extractYearFromDate(releaseDate: string): number | null {
  try {
    const year = parseInt(releaseDate.split('/')[0]);
    return isNaN(year) ? null : year;
  } catch {
    return null;
  }
}

/**
 * 3-letter set code to Pokemon TCG API set.id mapping
 * These are the official set abbreviations printed on modern cards
 */
const SET_CODE_TO_ID: Record<string, string> = {
  // Scarlet & Violet Era (2023+)
  'SVI': 'sv1',      // Scarlet & Violet Base
  'PAL': 'sv2',      // Paldea Evolved
  'OBF': 'sv3',      // Obsidian Flames
  'MEW': 'sv3pt5',   // Pokemon 151
  'PAR': 'sv4',      // Paradox Rift
  'PAF': 'sv4pt5',   // Paldean Fates
  'TEF': 'sv5',      // Temporal Forces
  'TWM': 'sv6',      // Twilight Masquerade
  'SFA': 'sv6pt5',   // Shrouded Fable
  'SCR': 'sv7',      // Stellar Crown
  'SSP': 'sv8',      // Surging Sparks
  'SVP': 'svp',      // SV Promos
  'SVE': 'sve',      // SV Energies
  // Sword & Shield Era (2020-2023)
  'SSH': 'swsh1',    // Sword & Shield Base
  'RCL': 'swsh2',    // Rebel Clash
  'DAA': 'swsh3',    // Darkness Ablaze
  'VIV': 'swsh4',    // Vivid Voltage
  'BST': 'swsh5',    // Battle Styles
  'CRE': 'swsh6',    // Chilling Reign
  'EVS': 'swsh7',    // Evolving Skies
  'FST': 'swsh8',    // Fusion Strike
  'BRS': 'swsh9',    // Brilliant Stars
  'ASR': 'swsh10',   // Astral Radiance
  'LOR': 'swsh11',   // Lost Origin
  'SIT': 'swsh12',   // Silver Tempest
  'CRZ': 'swsh12pt5', // Crown Zenith
  'SHF': 'swsh45',   // Shining Fates
  'CEL': 'cel25',    // Celebrations
  'SWSHP': 'swshp',  // SWSH Promos
  // Sun & Moon Era (2017-2020)
  'SUM': 'sm1',      // Sun & Moon Base
  'GRI': 'sm2',      // Guardians Rising
  'BUS': 'sm3',      // Burning Shadows
  'SLG': 'sm35',     // Shining Legends
  'CIN': 'sm4',      // Crimson Invasion
  'UPR': 'sm5',      // Ultra Prism
  'FLI': 'sm6',      // Forbidden Light
  'CES': 'sm7',      // Celestial Storm
  'LOT': 'sm8',      // Lost Thunder
  'TEU': 'sm9',      // Team Up
  'UNB': 'sm10',     // Unbroken Bonds
  'UNM': 'sm11',     // Unified Minds
  'CEC': 'sm12',     // Cosmic Eclipse
};

/**
 * Additional lookup options for smarter API queries
 */
export interface SetLookupOptions {
  setCode?: string;           // 3-letter set code (e.g., "SVI", "FST")
  cardFormat?: string;        // Card number format (e.g., "fraction", "sv_promo")
}

/**
 * Lookup Pokemon set by card number (for hybrid set identification system)
 *
 * This function is called when the AI's mini lookup table doesn't contain the set.
 * It queries the Pokemon TCG API to identify the set based on the card number.
 *
 * @param cardNumber - Card number string (e.g., "251/264", "GG70/GG70")
 * @param pokemonName - Pokemon name for additional context (optional)
 * @param year - Copyright year from card (optional, helps disambiguation)
 * @param options - Additional lookup options (setCode, cardFormat)
 * @returns SetLookupResult with set information
 */
export async function lookupSetByCardNumber(
  cardNumber: string,
  pokemonName?: string,
  year?: string,
  options?: SetLookupOptions
): Promise<SetLookupResult> {

  // If external API is disabled, return a failure result
  if (DISABLE_EXTERNAL_API) {
    console.log('[Pokemon API] lookupSetByCardNumber disabled - external API is off');
    return {
      success: false,
      set_name: null,
      set_id: null,
      set_year: null,
      set_era: null,
      set_confidence: 'low',
      set_identifier_source: ['local_only'],
      set_identifier_reason: 'External API disabled - using local database only',
      cache_hit: false,
      error: 'External API disabled'
    };
  }

  // Generate cache key (include options for better cache hit rate)
  const cacheKey = `${cardNumber}|${pokemonName || ''}|${year || ''}|${options?.setCode || ''}|${options?.cardFormat || ''}`;

  // Check cache first
  const cachedResult = setLookupCache.get(cacheKey);
  if (cachedResult) {
    console.log('[PokemonTCG API] Set lookup cache hit:', cacheKey);
    return { ...cachedResult, cache_hit: true };
  }

  try {
    // 🆕 FAST PATH: If we have a set_code, use it directly (fastest lookup)
    if (options?.setCode) {
      const setId = SET_CODE_TO_ID[options.setCode.toUpperCase()];
      if (setId) {
        console.log(`[PokemonTCG API] 🚀 Fast path: Using set_code ${options.setCode} → set.id:${setId}`);

        // Extract just the card number for query
        let cardNum = cardNumber;
        const fractionMatch = cardNumber.match(/^([A-Z0-9]+)\/[A-Z0-9]+$/i);
        if (fractionMatch) {
          cardNum = fractionMatch[1];
        } else {
          // Extract digits for promo-style numbers
          const digitMatch = cardNumber.match(/\b(\d+)\b/);
          if (digitMatch) {
            cardNum = digitMatch[1];
          }
        }

        // Query by set.id + number (very specific, fast)
        const fastQuery = `set.id:${setId} number:${cardNum}`;
        const fastUrl = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(fastQuery)}`;
        console.log('[PokemonTCG API] Fast query URL:', fastUrl);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        try {
          const response = await fetch(fastUrl, {
            headers: { 'X-Api-Key': POKEMON_API_KEY },
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            if (data.data && data.data.length > 0) {
              const card = data.data[0];
              const result: SetLookupResult = {
                success: true,
                set_name: card.set.name,
                set_id: card.set.id,
                set_year: extractYearFromDate(card.set.releaseDate),
                set_era: card.set.series,
                set_confidence: 'high',
                set_identifier_source: ['set_code', 'api_lookup'],
                set_identifier_reason: `Matched via set_code ${options.setCode} → ${card.set.name}`,
                cache_hit: false
              };
              setLookupCache.set(cacheKey, result);
              console.log(`[PokemonTCG API] ✅ Fast path success: ${card.set.name}`);
              return result;
            }
          }
        } catch (e: any) {
          clearTimeout(timeoutId);
          console.warn(`[PokemonTCG API] Fast path failed, falling back:`, e.message);
        }
      }
    }

    // 🆕 PROMO PATH: If card_format indicates a promo, use promo set ID
    if (options?.cardFormat === 'sv_promo' || options?.cardFormat === 'swsh_promo') {
      const promoSetId = options.cardFormat === 'sv_promo' ? 'svp' : 'swshp';
      console.log(`[PokemonTCG API] 🎁 Promo path: Using format ${options.cardFormat} → set.id:${promoSetId}`);

      // Extract just the number
      let cardNum = cardNumber.match(/\b(\d+)\b/)?.[1] || cardNumber;
      // Try with and without leading zeros
      const cardNumNoZeros = cardNum.replace(/^0+/, '') || cardNum;

      for (const numVariation of [cardNumNoZeros, cardNum]) {
        const promoQuery = `set.id:${promoSetId} number:${numVariation}`;
        const promoUrl = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(promoQuery)}`;
        console.log('[PokemonTCG API] Promo query URL:', promoUrl);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch(promoUrl, {
            headers: { 'X-Api-Key': POKEMON_API_KEY },
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            if (data.data && data.data.length > 0) {
              // If multiple results and we have Pokemon name, filter by it
              let cards = data.data;
              if (pokemonName && cards.length > 1) {
                const nameMatch = cards.find((c: any) =>
                  c.name.toLowerCase().includes(pokemonName.toLowerCase()) ||
                  pokemonName.toLowerCase().includes(c.name.toLowerCase())
                );
                if (nameMatch) cards = [nameMatch];
              }

              const card = cards[0];
              const result: SetLookupResult = {
                success: true,
                set_name: card.set.name,
                set_id: card.set.id,
                set_year: extractYearFromDate(card.set.releaseDate),
                set_era: card.set.series,
                set_confidence: 'high',
                set_identifier_source: ['card_format', 'promo_lookup'],
                set_identifier_reason: `Matched via ${options.cardFormat} format → ${card.set.name}`,
                cache_hit: false
              };
              setLookupCache.set(cacheKey, result);
              console.log(`[PokemonTCG API] ✅ Promo path success: ${card.set.name}`);
              return result;
            }
          }
        } catch (e: any) {
          clearTimeout(timeoutId);
          console.warn(`[PokemonTCG API] Promo path variation ${numVariation} failed:`, e.message);
        }
      }
    }

    // STANDARD PATH: Parse card number - supports multiple formats:
    // 1. Standard: "251/264" → cardNum=251, totalCards=264
    // 2. Promo: "SVP EN 085" → cardNum=085, totalCards=null
    // 3. Gallery: "GG70/GG70" → cardNum=GG70, totalCards=GG70
    let cardNum: string;
    let totalCards: string | null = null;

    const standardMatch = cardNumber.match(/^([A-Z0-9]+)\/([A-Z0-9]+)$/);
    if (standardMatch) {
      cardNum = standardMatch[1];
      totalCards = standardMatch[2];
    } else {
      // Try to extract numeric portion for promo cards (SVP EN 085 → 085)
      const promoMatch = cardNumber.match(/\b(\d+)\b/);
      if (promoMatch) {
        cardNum = promoMatch[1];
        console.log(`[PokemonTCG API] Extracted number from promo format: ${cardNumber} → ${cardNum}`);
      } else {
        // Cannot parse
        const result: SetLookupResult = {
          success: false,
          set_name: null,
          set_id: null,
          set_year: null,
          set_era: null,
          set_confidence: 'low',
          set_identifier_source: [],
          set_identifier_reason: `Unable to parse card number "${cardNumber}" for API lookup.`,
          cache_hit: false,
          error: 'Invalid card number format'
        };
        setLookupCache.set(cacheKey, result);
        return result;
      }
    }

    console.log(`[PokemonTCG API] Looking up set for card: ${cardNumber} (parsed: ${cardNum}), Pokemon: ${pokemonName || 'unknown'}, Year: ${year || 'unknown'}`);

    // Build query - try multiple strategies
    let query = `number:${cardNum}`;

    // Detect if this is a promo card
    const isPromoCard = !totalCards && (
      cardNumber.includes('SVP') ||
      cardNumber.includes('SV') ||
      cardNumber.toLowerCase().includes('promo') ||
      cardNum.length === 3  // Promo cards often have 3-digit numbers like "085"
    );

    // For promo cards, add Pokemon name (more important than year)
    if (isPromoCard && pokemonName) {
      query += ` name:"${pokemonName}"`;
      console.log('[PokemonTCG API] Promo card detected, added Pokemon name to query');
    }

    // Add year filter, but make it broader for promo cards
    if (year && !isPromoCard) {
      // Standard cards: use exact year
      query += ` set.releaseDate:[${year}-01-01 TO ${year}-12-31]`;
    } else if (year && isPromoCard) {
      // Promo cards: use ±1 year range (promos can have delayed releases)
      const yearNum = parseInt(year);
      const yearStart = yearNum - 1;
      const yearEnd = yearNum + 1;
      query += ` set.releaseDate:[${yearStart}-01-01 TO ${yearEnd}-12-31]`;
      console.log(`[PokemonTCG API] Using broader year range for promo: ${yearStart}-${yearEnd}`);
    }

    // Call Pokemon TCG API
    const url = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query)}`;
    console.log('[PokemonTCG API] Request URL:', url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        headers: {
          'X-Api-Key': POKEMON_API_KEY
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      let data: any;

      if (!response.ok) {
        // If 404 and we had year filter, try again without it
        if (response.status === 404 && year) {
          console.warn(`[PokemonTCG API] 404 with year filter, retrying without year...`);

          // Retry without year filter
          const retryQuery = isPromoCard && pokemonName
            ? `number:${cardNum} name:"${pokemonName}"`
            : `number:${cardNum}`;

          const retryUrl = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(retryQuery)}`;
          console.log('[PokemonTCG API] Retry URL:', retryUrl);

          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), 8000);

          try {
            const retryResponse = await fetch(retryUrl, {
              headers: {
                'X-Api-Key': POKEMON_API_KEY
              },
              signal: retryController.signal
            });

            clearTimeout(retryTimeoutId);

            if (!retryResponse.ok) {
              throw new Error(`Retry also failed: ${retryResponse.status} ${retryResponse.statusText}`);
            }

            data = await retryResponse.json();

            if (data.data && data.data.length > 0) {
              console.log(`[PokemonTCG API] ✅ Retry successful, found ${data.data.length} result(s)`);
              // Continue processing with retry data below
            } else {
              throw new Error('No results found even without year filter');
            }
          } catch (retryError: any) {
            clearTimeout(retryTimeoutId);
            throw new Error(`API request failed: ${response.status} ${response.statusText}, retry also failed: ${retryError.message}`);
          }
        } else {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
      } else {
        data = await response.json();
      }

      if (!data.data || data.data.length === 0) {
        const result: SetLookupResult = {
          success: false,
          set_name: null,
          set_id: null,
          set_year: null,
          set_era: null,
          set_confidence: 'low',
          set_identifier_source: ['api_lookup'],
          set_identifier_reason: `No results found for card number ${cardNumber} in Pokemon TCG API.`,
          cache_hit: false,
          error: 'No matching cards found'
        };
        setLookupCache.set(cacheKey, result);
        return result;
      }

      // Filter by set total if multiple results
      let cards: PokemonCard[] = data.data;

      console.log(`[PokemonTCG API] Found ${cards.length} initial result(s)`);

      // Try to match set total (denominator) - only if we have a totalCards value
      if (totalCards && !isNaN(parseInt(totalCards))) {
        const matchingCards = cards.filter((card: PokemonCard) =>
          card.set.printedTotal === parseInt(totalCards) ||
          card.set.total === parseInt(totalCards)
        );

        if (matchingCards.length > 0) {
          console.log(`[PokemonTCG API] Filtered by set total ${totalCards}: ${matchingCards.length} result(s)`);
          cards = matchingCards;
        }
      }

      // If multiple results and pokemonName provided, filter by name
      if (cards.length > 1 && pokemonName) {
        const nameMatch = cards.filter((card: PokemonCard) =>
          card.name.toLowerCase().includes(pokemonName.toLowerCase())
        );
        if (nameMatch.length > 0) {
          console.log(`[PokemonTCG API] Filtered by Pokemon name "${pokemonName}": ${nameMatch.length} result(s)`);
          cards = nameMatch;
        }
      }

      // For promo cards, prefer sets with "Promo" in the name
      if (!totalCards && cards.length > 1) {
        const promoCards = cards.filter((card: PokemonCard) =>
          card.set.name.toLowerCase().includes('promo')
        );
        if (promoCards.length > 0) {
          console.log(`[PokemonTCG API] Filtered to promo sets: ${promoCards.length} result(s)`);
          cards = promoCards;
        }
      }

      if (cards.length === 0) {
        const result: SetLookupResult = {
          success: false,
          set_name: null,
          set_id: null,
          set_year: null,
          set_era: null,
          set_confidence: 'low',
          set_identifier_source: ['api_lookup'],
          set_identifier_reason: `No matching results after filtering for card number ${cardNumber}.`,
          cache_hit: false,
          error: 'No matching cards after filtering'
        };
        setLookupCache.set(cacheKey, result);
        return result;
      }

      // Take first result
      const card: PokemonCard = cards[0];
      const set = card.set;

      const result: SetLookupResult = {
        success: true,
        set_name: set.name,
        set_id: set.id,
        set_year: extractYearFromDate(set.releaseDate),
        set_era: inferEraFromSeries(set.series),
        set_confidence: 'high',
        set_identifier_source: ['api_lookup', 'card_number_match'],
        set_identifier_reason: `Found via Pokemon TCG API: ${set.name} (${set.id}). Card ${cardNumber} from ${set.series} series. Matched ${cards.length > 1 ? `1 of ${data.data.length}` : 'unique'} result(s).`,
        cache_hit: false
      };

      console.log('[PokemonTCG API] Set lookup success:', result);

      // Cache result
      setLookupCache.set(cacheKey, result);

      return result;

    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.warn(`[PokemonTCG API] Set lookup timeout for: ${cardNumber}`);
      }
      throw error;
    }

  } catch (error: any) {
    console.error('[PokemonTCG API] Set lookup error:', error);

    const result: SetLookupResult = {
      success: false,
      set_name: null,
      set_id: null,
      set_year: null,
      set_era: null,
      set_confidence: 'low',
      set_identifier_source: ['api_lookup'],
      set_identifier_reason: `API lookup failed: ${error.message}`,
      cache_hit: false,
      error: error.message
    };

    // Cache failed lookups briefly to avoid repeated API calls
    setLookupCache.set(cacheKey, result);
    setTimeout(() => setLookupCache.delete(cacheKey), 5 * 60 * 1000); // 5 min TTL for errors

    return result;
  }
}

/**
 * Convert API card data to our database format
 */
export function convertApiCardToMetadata(apiCard: PokemonCard) {
  return {
    card_name: apiCard.name,
    player_or_character: apiCard.name,
    set_name: apiCard.set.name,
    card_number: `${apiCard.number}/${apiCard.set.printedTotal}`,
    year: apiCard.set.releaseDate?.split('/')[0] || null,
    manufacturer: apiCard.set.releaseDate && apiCard.set.releaseDate.startsWith('199')
      ? 'Wizards of the Coast'
      : 'The Pokemon Company',
    sport_or_category: 'Pokemon',
    rarity_tier: apiCard.rarity,

    // Pokemon-specific
    pokemon_type: apiCard.types?.[0] || null,
    hp: apiCard.hp ? parseInt(apiCard.hp) : null,
    card_type: apiCard.supertype, // "Pokémon", "Trainer", "Energy"
    subtypes: apiCard.subtypes,
    evolvesFrom: apiCard.evolvesFrom,
    artist: apiCard.artist,

    // API metadata
    api_card_id: apiCard.id,
    api_image_small: apiCard.images.small,
    api_image_large: apiCard.images.large,

    // Market prices
    tcgplayer_url: apiCard.tcgplayer?.url,
    market_price: apiCard.tcgplayer?.prices?.holofoil?.market ||
                  apiCard.tcgplayer?.prices?.normal?.market ||
                  apiCard.tcgplayer?.prices?.reverseHolofoil?.market ||
                  apiCard.cardmarket?.prices?.averageSellPrice ||
                  null,

    // Price breakdown for display
    price_breakdown: apiCard.tcgplayer?.prices || apiCard.cardmarket?.prices || null
  };
}
