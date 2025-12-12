// src/lib/pokemonApiVerification.ts
// Pokemon TCG API Verification Service
// Post-grading verification to ensure 100% accurate card identification

import {
  PokemonCard,
  getPokemonCardById,
  CardNumberFormat,
  normalizeCardNumber as normalizeCardNumberFromApi,
  detectCardNumberFormat,
  getPromoSetId
} from './pokemonTcgApi';

const POKEMON_API_BASE = 'https://api.pokemontcg.io/v2';
// Get API key from environment variable - NO HARDCODED FALLBACKS
const POKEMON_API_KEY = process.env.POKEMON_TCG_API_KEY || '';

export interface PokemonApiVerificationResult {
  success: boolean;
  verified: boolean;
  pokemon_api_id: string | null;
  pokemon_api_data: PokemonCard | null;
  verification_method: 'set_id_number' | 'name_number_set' | 'fuzzy_match' | 'none';
  confidence: 'high' | 'medium' | 'low';
  corrections: {
    field: string;
    original: string | null;
    corrected: string | null;
  }[];
  error?: string;
}

export interface CardInfoForVerification {
  card_name?: string;
  player_or_character?: string;
  set_name?: string;
  card_number?: string;
  year?: string;
  set_code?: string; // 3-letter set code from card (e.g., "SVI", "PAF")
  // New format-aware fields
  card_number_raw?: string; // Full printed number exactly as shown (e.g., "240/193", "SWSH039")
  card_number_format?: string; // Detected format type
  set_total?: string; // Denominator from card number (e.g., "193" from "240/193")
}

/**
 * Normalize card number for API lookup
 * Handles various formats: "085/198", "85/198", "GG70/GG70", "SVP EN 085"
 */
function normalizeCardNumber(cardNumber: string): string {
  if (!cardNumber) return '';

  // If it's a fraction format, extract just the numerator
  const fractionMatch = cardNumber.match(/^(\d+)\/\d+$/);
  if (fractionMatch) {
    // Remove leading zeros for API compatibility
    return fractionMatch[1].replace(/^0+/, '') || '0';
  }

  // For special formats like GG70/GG70
  const specialMatch = cardNumber.match(/^([A-Z]+\d+)\/[A-Z]+\d+$/i);
  if (specialMatch) {
    return specialMatch[1];
  }

  // For promo formats like "SVP EN 085", extract the number
  const promoMatch = cardNumber.match(/\b(\d+)\b/);
  if (promoMatch) {
    return promoMatch[1].replace(/^0+/, '') || '0';
  }

  return cardNumber;
}

/**
 * Map common set names to Pokemon TCG API set IDs
 * This covers modern sets (2020+) which are most commonly graded
 */
const SET_NAME_TO_ID: Record<string, string> = {
  // Scarlet & Violet Era (2023-2025)
  'Scarlet & Violet': 'sv1',
  'Scarlet & Violet Base': 'sv1',
  'Paldea Evolved': 'sv2',
  'Obsidian Flames': 'sv3',
  'Paradox Rift': 'sv4',
  'Paldean Fates': 'sv4pt5',
  'Temporal Forces': 'sv5',
  'Twilight Masquerade': 'sv6',
  'Shrouded Fable': 'sv6pt5',
  'Stellar Crown': 'sv7',
  'Surging Sparks': 'sv8',
  '151': 'sv3pt5',
  'Pokemon 151': 'sv3pt5',
  'Pokémon 151': 'sv3pt5',

  // Sword & Shield Era (2020-2023)
  'Sword & Shield': 'swsh1',
  'Sword & Shield Base': 'swsh1',
  'Rebel Clash': 'swsh2',
  'Darkness Ablaze': 'swsh3',
  'Vivid Voltage': 'swsh4',
  'Battle Styles': 'swsh5',
  'Chilling Reign': 'swsh6',
  'Evolving Skies': 'swsh7',
  'Fusion Strike': 'swsh8',
  'Brilliant Stars': 'swsh9',
  'Astral Radiance': 'swsh10',
  'Lost Origin': 'swsh11',
  'Silver Tempest': 'swsh12',
  'Crown Zenith': 'swsh12pt5',
  'Shining Fates': 'swsh45',
  'Celebrations': 'cel25',

  // Sun & Moon Era (2017-2019)
  'Sun & Moon': 'sm1',
  'Guardians Rising': 'sm2',
  'Burning Shadows': 'sm3',
  'Crimson Invasion': 'sm4',
  'Ultra Prism': 'sm5',
  'Forbidden Light': 'sm6',
  'Celestial Storm': 'sm7',
  'Lost Thunder': 'sm8',
  'Team Up': 'sm9',
  'Unbroken Bonds': 'sm10',
  'Unified Minds': 'sm11',
  'Cosmic Eclipse': 'sm12',
  'Hidden Fates': 'sma',

  // XY Era (2014-2016)
  'XY': 'xy1',
  'Flashfire': 'xy2',
  'Furious Fists': 'xy3',
  'Phantom Forces': 'xy4',
  'Primal Clash': 'xy5',
  'Roaring Skies': 'xy6',
  'Ancient Origins': 'xy7',
  'BREAKthrough': 'xy8',
  'BREAKpoint': 'xy9',
  'Fates Collide': 'xy10',
  'Steam Siege': 'xy11',
  'Evolutions': 'xy12',

  // Black & White Era (2011-2013)
  'Black & White': 'bw1',
  'Emerging Powers': 'bw2',
  'Noble Victories': 'bw3',
  'Next Destinies': 'bw4',
  'Dark Explorers': 'bw5',
  'Dragons Exalted': 'bw6',
  'Boundaries Crossed': 'bw7',
  'Plasma Storm': 'bw8',
  'Plasma Freeze': 'bw9',
  'Plasma Blast': 'bw10',
  'Legendary Treasures': 'bw11',

  // WOTC Era (1999-2003)
  'Base Set': 'base1',
  'Base': 'base1',
  'Jungle': 'base2',
  'Fossil': 'base3',
  'Base Set 2': 'base4',
  'Team Rocket': 'base5',
  'Gym Heroes': 'gym1',
  'Gym Challenge': 'gym2',
  'Neo Genesis': 'neo1',
  'Neo Discovery': 'neo2',
  'Neo Revelation': 'neo3',
  'Neo Destiny': 'neo4',

  // Promos
  'Scarlet & Violet Black Star Promos': 'svp',
  'Scarlet & Violet Promos': 'svp',
  'SVP': 'svp',
  'Sword & Shield Black Star Promos': 'swshp',
  'Sword & Shield Promos': 'swshp',
  'Sun & Moon Black Star Promos': 'smp',
  'XY Black Star Promos': 'xyp',
  'Black & White Black Star Promos': 'bwp',
};

/**
 * Convert 3-letter set code to API set ID
 */
const SET_CODE_TO_ID: Record<string, string> = {
  // Scarlet & Violet
  'SVI': 'sv1',
  'PAL': 'sv2',
  'OBF': 'sv3',
  'MEW': 'sv3pt5',
  'PAR': 'sv4',
  'PAF': 'sv4pt5',
  'TEF': 'sv5',
  'TWM': 'sv6',
  'SFA': 'sv6pt5',
  'SCR': 'sv7',
  'SSP': 'sv8',
  'SVP': 'svp',

  // Sword & Shield
  'SSH': 'swsh1',
  'RCL': 'swsh2',
  'DAA': 'swsh3',
  'VIV': 'swsh4',
  'BST': 'swsh5',
  'CRE': 'swsh6',
  'EVS': 'swsh7',
  'FST': 'swsh8',
  'BRS': 'swsh9',
  'ASR': 'swsh10',
  'LOR': 'swsh11',
  'SIT': 'swsh12',
  'CRZ': 'swsh12pt5',
};

/**
 * Query Pokemon TCG API by set ID and card number
 * This is the most reliable method for card identification
 */
async function queryBySetIdAndNumber(setId: string, cardNumber: string): Promise<PokemonCard | null> {
  try {
    const normalizedNumber = normalizeCardNumber(cardNumber);
    const query = `set.id:${setId} number:${normalizedNumber}`;
    const url = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query)}`;

    console.log(`[Pokemon API Verification] Query: ${query}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: { 'X-Api-Key': POKEMON_API_KEY },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Pokemon API Verification] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.data && data.data.length === 1) {
      console.log(`[Pokemon API Verification] Found unique match: ${data.data[0].name} (${data.data[0].id})`);
      return data.data[0];
    } else if (data.data && data.data.length > 1) {
      console.log(`[Pokemon API Verification] Found ${data.data.length} matches, returning first`);
      return data.data[0];
    }

    return null;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[Pokemon API Verification] Request timeout');
    } else {
      console.error('[Pokemon API Verification] Query error:', error.message);
    }
    return null;
  }
}

/**
 * Query Pokemon TCG API by name and set name
 * Fallback method when set ID is not available
 */
async function queryByNameAndSet(name: string, setName: string, cardNumber?: string): Promise<PokemonCard | null> {
  try {
    let query = `name:"${name}" set.name:"${setName}"`;
    if (cardNumber) {
      const normalizedNumber = normalizeCardNumber(cardNumber);
      query += ` number:${normalizedNumber}`;
    }

    const url = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query)}`;

    console.log(`[Pokemon API Verification] Fuzzy query: ${query}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: { 'X-Api-Key': POKEMON_API_KEY },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      console.log(`[Pokemon API Verification] Found ${data.data.length} match(es) by name/set`);
      return data.data[0];
    }

    return null;
  } catch (error: any) {
    console.error('[Pokemon API Verification] Query error:', error.message);
    return null;
  }
}

/**
 * Query Pokemon TCG API using format-aware number normalization
 * Uses detected format type to construct optimal API query
 */
async function queryByFormatAwareNumber(
  name: string,
  cardNumberRaw: string,
  format: CardNumberFormat,
  setTotal?: string
): Promise<PokemonCard | null> {
  try {
    // Get format-specific number variations
    const numberVariations = normalizeCardNumberFromApi(cardNumberRaw, format);
    if (numberVariations.length === 0) {
      console.log('[Pokemon API Verification] No number variations generated');
      return null;
    }

    // Check if this is a promo format - use set.id constraint
    const promoSetId = getPromoSetId(format);

    for (const numberVariation of numberVariations) {
      let query: string;

      if (promoSetId) {
        // Promo cards: use set.id constraint
        query = `name:"${name}" number:"${numberVariation}" set.id:${promoSetId}`;
        console.log(`[Pokemon API Verification] Format-aware promo query: ${query}`);
      } else if (setTotal && format === 'fraction') {
        // Standard cards with denominator: use printedTotal filter
        const printedTotal = setTotal.replace(/^[A-Za-z]+/, '').trim();
        if (/^\d+$/.test(printedTotal)) {
          query = `name:"${name}" number:"${numberVariation}" set.printedTotal:${printedTotal}`;
          console.log(`[Pokemon API Verification] Format-aware printedTotal query: ${query}`);
        } else {
          query = `name:"${name}" number:"${numberVariation}"`;
        }
      } else {
        // Other formats: standard query
        query = `name:"${name}" number:"${numberVariation}"`;
        console.log(`[Pokemon API Verification] Format-aware standard query: ${query}`);
      }

      const url = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        headers: { 'X-Api-Key': POKEMON_API_KEY },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          console.log(`[Pokemon API Verification] Format-aware search found ${data.data.length} match(es) for number: ${numberVariation}`);
          return data.data[0];
        }
      }
    }

    return null;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[Pokemon API Verification] Format-aware request timeout');
    } else {
      console.error('[Pokemon API Verification] Format-aware query error:', error.message);
    }
    return null;
  }
}

/**
 * Verify a Pokemon card using the Pokemon TCG API
 * Attempts multiple lookup strategies to find the exact card
 *
 * @param cardInfo - Card information from grading (conversational_card_info)
 * @returns Verification result with API data and corrections
 */
export async function verifyPokemonCard(cardInfo: CardInfoForVerification): Promise<PokemonApiVerificationResult> {
  console.log('[Pokemon API Verification] Starting verification for:', cardInfo);

  const result: PokemonApiVerificationResult = {
    success: false,
    verified: false,
    pokemon_api_id: null,
    pokemon_api_data: null,
    verification_method: 'none',
    confidence: 'low',
    corrections: []
  };

  // Extract card info
  const cardName = cardInfo.player_or_character || cardInfo.card_name || '';
  const setName = cardInfo.set_name || '';
  const cardNumber = cardInfo.card_number || '';
  const setCode = cardInfo.set_code || '';
  // New format-aware fields
  const cardNumberRaw = cardInfo.card_number_raw || cardNumber;
  const cardNumberFormat = cardInfo.card_number_format as CardNumberFormat || detectCardNumberFormat(cardNumberRaw);
  const setTotal = cardInfo.set_total || '';

  if (!cardName && !cardNumber) {
    result.error = 'Insufficient card information for verification';
    return result;
  }

  console.log(`[Pokemon API Verification] Detected format: ${cardNumberFormat}, setTotal: ${setTotal}`);

  let apiCard: PokemonCard | null = null;

  // Strategy 0 (NEW): Format-aware search for promos and special formats
  if (!apiCard && cardName && cardNumberRaw && (cardNumberFormat === 'swsh_promo' || cardNumberFormat === 'sv_promo' || cardNumberFormat === 'galarian_gallery' || cardNumberFormat === 'trainer_gallery')) {
    console.log(`[Pokemon API Verification] Strategy 0: Format-aware search for ${cardNumberFormat}`);
    apiCard = await queryByFormatAwareNumber(cardName, cardNumberRaw, cardNumberFormat, setTotal);
    if (apiCard) {
      result.verification_method = 'set_id_number';
      result.confidence = 'high';
    }
  }

  // Strategy 1: Use set code (most reliable for modern cards)
  if (!apiCard && setCode && cardNumber) {
    const setId = SET_CODE_TO_ID[setCode.toUpperCase()];
    if (setId) {
      console.log(`[Pokemon API Verification] Strategy 1: Set code ${setCode} -> ${setId}`);
      apiCard = await queryBySetIdAndNumber(setId, cardNumber);
      if (apiCard) {
        result.verification_method = 'set_id_number';
        result.confidence = 'high';
      }
    }
  }

  // Strategy 1.5 (NEW): Use printedTotal from setTotal for fraction format
  if (!apiCard && cardName && cardNumber && setTotal && cardNumberFormat === 'fraction') {
    const printedTotal = setTotal.replace(/^[A-Za-z]+/, '').trim();
    if (/^\d+$/.test(printedTotal)) {
      console.log(`[Pokemon API Verification] Strategy 1.5: Name + Number + printedTotal:${printedTotal}`);
      apiCard = await queryByFormatAwareNumber(cardName, cardNumberRaw, cardNumberFormat, setTotal);
      if (apiCard) {
        result.verification_method = 'set_id_number';
        result.confidence = 'high';
      }
    }
  }

  // Strategy 2: Use set name mapping
  if (!apiCard && setName && cardNumber) {
    const setId = SET_NAME_TO_ID[setName];
    if (setId) {
      console.log(`[Pokemon API Verification] Strategy 2: Set name "${setName}" -> ${setId}`);
      apiCard = await queryBySetIdAndNumber(setId, cardNumber);
      if (apiCard) {
        result.verification_method = 'set_id_number';
        result.confidence = 'high';
      }
    }
  }

  // Strategy 3: Fuzzy lookup by name + set name + number
  if (!apiCard && cardName && setName) {
    console.log(`[Pokemon API Verification] Strategy 3: Name + Set fuzzy search`);
    apiCard = await queryByNameAndSet(cardName, setName, cardNumber);
    if (apiCard) {
      result.verification_method = 'name_number_set';
      result.confidence = cardNumber ? 'medium' : 'low';
    }
  }

  // Strategy 4: Just name + number (broader search)
  if (!apiCard && cardName && cardNumber) {
    const normalizedNumber = normalizeCardNumber(cardNumber);
    const query = `name:"${cardName}" number:${normalizedNumber}`;
    console.log(`[Pokemon API Verification] Strategy 4: Name + Number only`);

    try {
      const url = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: { 'X-Api-Key': POKEMON_API_KEY }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          // If we have year, filter by it
          if (cardInfo.year) {
            const yearMatch = data.data.find((c: PokemonCard) =>
              c.set.releaseDate?.startsWith(cardInfo.year!)
            );
            apiCard = yearMatch || data.data[0];
          } else {
            apiCard = data.data[0];
          }
          result.verification_method = 'fuzzy_match';
          result.confidence = 'low';
        }
      }
    } catch (error) {
      console.error('[Pokemon API Verification] Strategy 4 failed:', error);
    }
  }

  // Process results
  if (apiCard) {
    result.success = true;
    result.verified = true;
    result.pokemon_api_id = apiCard.id;
    result.pokemon_api_data = apiCard;

    // Check for corrections
    const apiSetName = apiCard.set.name;
    const apiCardName = apiCard.name;
    const apiCardNumber = `${apiCard.number}/${apiCard.set.printedTotal}`;
    const apiYear = apiCard.set.releaseDate?.split('/')[0] || '';
    const apiRarity = apiCard.rarity || '';

    // Record corrections if AI got something wrong
    if (setName && setName !== apiSetName && setName.toLowerCase() !== apiSetName.toLowerCase()) {
      result.corrections.push({
        field: 'set_name',
        original: setName,
        corrected: apiSetName
      });
    }

    if (cardName && cardName !== apiCardName && cardName.toLowerCase() !== apiCardName.toLowerCase()) {
      result.corrections.push({
        field: 'card_name',
        original: cardName,
        corrected: apiCardName
      });
    }

    if (cardInfo.year && cardInfo.year !== apiYear) {
      result.corrections.push({
        field: 'year',
        original: cardInfo.year,
        corrected: apiYear
      });
    }

    console.log(`[Pokemon API Verification] SUCCESS: ${apiCard.name} (${apiCard.id}) from ${apiCard.set.name}`);
    if (result.corrections.length > 0) {
      console.log(`[Pokemon API Verification] Corrections needed:`, result.corrections);
    }
  } else {
    result.error = 'No matching card found in Pokemon TCG API';
    console.log(`[Pokemon API Verification] FAILED: No match found for ${cardName} #${cardNumber}`);
  }

  return result;
}

/**
 * Save Pokemon API verification results to database
 * Updates the card with verified API data
 */
export function getPokemonApiUpdateFields(verificationResult: PokemonApiVerificationResult) {
  if (!verificationResult.success || !verificationResult.pokemon_api_data) {
    return null;
  }

  const apiCard = verificationResult.pokemon_api_data;

  return {
    // API verification fields
    pokemon_api_id: verificationResult.pokemon_api_id,
    pokemon_api_data: apiCard, // Full API response as JSONB
    pokemon_api_verified: true,
    pokemon_api_verified_at: new Date().toISOString(),
    pokemon_api_confidence: verificationResult.confidence,
    pokemon_api_method: verificationResult.verification_method,

    // TCGPlayer direct product URL from Pokemon TCG API
    tcgplayer_url: apiCard.tcgplayer?.url || null,

    // Override card info with verified data (only if corrections needed)
    ...(verificationResult.corrections.length > 0 && {
      // Update card info with verified values
      card_name: apiCard.name,
      card_set: apiCard.set.name,
      release_date: apiCard.set.releaseDate?.split('/')[0] || null,
      card_number: `${apiCard.number}/${apiCard.set.printedTotal}`,
    })
  };
}

/**
 * Extract additional metadata from verified API card
 * For display purposes
 */
export function extractPokemonMetadata(apiCard: PokemonCard) {
  return {
    // Card details
    pokemon_name: apiCard.name,
    pokemon_type: apiCard.types?.[0] || null,
    hp: apiCard.hp ? parseInt(apiCard.hp) : null,
    card_type: apiCard.supertype, // Pokemon, Trainer, Energy
    subtypes: apiCard.subtypes || [],
    evolves_from: apiCard.evolvesFrom || null,
    rarity: apiCard.rarity || null,
    artist: apiCard.artist || null,

    // Set details
    set_id: apiCard.set.id,
    set_name: apiCard.set.name,
    set_series: apiCard.set.series,
    set_printed_total: apiCard.set.printedTotal,
    set_total: apiCard.set.total,
    set_release_date: apiCard.set.releaseDate,
    set_symbol_url: apiCard.set.images?.symbol || null,
    set_logo_url: apiCard.set.images?.logo || null,

    // Images
    api_image_small: apiCard.images?.small || null,
    api_image_large: apiCard.images?.large || null,

    // Market data
    tcgplayer_url: apiCard.tcgplayer?.url || null,
    market_price: apiCard.tcgplayer?.prices?.holofoil?.market ||
                  apiCard.tcgplayer?.prices?.normal?.market ||
                  apiCard.tcgplayer?.prices?.reverseHolofoil?.market ||
                  apiCard.cardmarket?.prices?.averageSellPrice ||
                  null
  };
}
