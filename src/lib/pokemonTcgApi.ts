// src/lib/pokemonTcgApi.ts
// Pokemon TCG API client for fetching card data

const POKEMON_API_BASE = 'https://api.pokemontcg.io/v2';
// Get API key from environment variable - NO HARDCODED FALLBACKS
const POKEMON_API_KEY = process.env.POKEMON_TCG_API_KEY || '';

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

/**
 * Search for Pokemon cards by name and optional set
 */
export async function searchPokemonCards(
  name: string,
  setName?: string,
  cardNumber?: string
): Promise<PokemonCard[]> {
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
 * Smart search with multi-tier fallback strategy
 * Tries multiple search strategies to find the best matches
 * Enhanced with flexible card number matching
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
 * Get a specific card by ID
 */
export async function getPokemonCardById(cardId: string): Promise<PokemonCard | null> {
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
 * Lookup Pokemon set by card number (for hybrid set identification system)
 *
 * This function is called when the AI's mini lookup table doesn't contain the set.
 * It queries the Pokemon TCG API to identify the set based on the card number.
 *
 * @param cardNumber - Card number string (e.g., "251/264", "GG70/GG70")
 * @param pokemonName - Pokemon name for additional context (optional)
 * @param year - Copyright year from card (optional, helps disambiguation)
 * @returns SetLookupResult with set information
 */
export async function lookupSetByCardNumber(
  cardNumber: string,
  pokemonName?: string,
  year?: string
): Promise<SetLookupResult> {

  // Generate cache key
  const cacheKey = `${cardNumber}|${pokemonName || ''}|${year || ''}`;

  // Check cache first
  const cachedResult = setLookupCache.get(cacheKey);
  if (cachedResult) {
    console.log('[PokemonTCG API] Set lookup cache hit:', cacheKey);
    return { ...cachedResult, cache_hit: true };
  }

  try {
    // Parse card number - supports multiple formats:
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
