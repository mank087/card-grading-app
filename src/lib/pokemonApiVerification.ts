// src/lib/pokemonApiVerification.ts
// Pokemon TCG API Verification Service
// Post-grading verification to ensure 100% accurate card identification

import {
  PokemonCard,
  getPokemonCardById,
  CardNumberFormat,
  normalizeCardNumber as normalizeCardNumberFromApi,
  detectCardNumberFormat,
  getPromoSetId,
  searchLocalFuzzyNumber
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
  'Legendary Collection': 'base6',
  'Expedition': 'ecard1',
  'Aquapolis': 'ecard2',
  'Skyridge': 'ecard3',

  // EX Series Era (2003-2007)
  'EX Ruby & Sapphire': 'ex1',
  'Ruby & Sapphire': 'ex1',
  'EX Sandstorm': 'ex2',
  'Sandstorm': 'ex2',
  'EX Dragon': 'ex3',
  'Dragon': 'ex3',
  'EX Team Magma vs Team Aqua': 'ex4',
  'Team Magma vs Team Aqua': 'ex4',
  'EX Hidden Legends': 'ex5',
  'Hidden Legends': 'ex5',
  'EX FireRed & LeafGreen': 'ex6',
  'FireRed & LeafGreen': 'ex6',
  'EX Team Rocket Returns': 'ex7',
  'Team Rocket Returns': 'ex7',
  'EX Deoxys': 'ex8',
  'Deoxys': 'ex8',
  'EX Emerald': 'ex9',
  'Emerald': 'ex9',
  'EX Unseen Forces': 'ex10',
  'Unseen Forces': 'ex10',
  'EX Delta Species': 'ex11',
  'Delta Species': 'ex11',
  'EX Legend Maker': 'ex12',
  'Legend Maker': 'ex12',
  'EX Holon Phantoms': 'ex13',
  'Holon Phantoms': 'ex13',
  'EX Crystal Guardians': 'ex14',
  'Crystal Guardians': 'ex14',
  'EX Dragon Frontiers': 'ex15',
  'Dragon Frontiers': 'ex15',
  'EX Power Keepers': 'ex16',
  'Power Keepers': 'ex16',

  // Diamond & Pearl Era (2007-2009)
  'Diamond & Pearl': 'dp1',
  'Mysterious Treasures': 'dp2',
  'Secret Wonders': 'dp3',
  'Great Encounters': 'dp4',
  'Majestic Dawn': 'dp5',
  'Legends Awakened': 'dp6',
  'Stormfront': 'dp7',

  // Platinum Era (2009-2010)
  'Platinum': 'pl1',
  'Rising Rivals': 'pl2',
  'Supreme Victors': 'pl3',
  'Arceus': 'pl4',

  // HeartGold & SoulSilver Era (2010-2011)
  'HeartGold & SoulSilver': 'hgss1',
  'Unleashed': 'hgss2',
  'Undaunted': 'hgss3',
  'Triumphant': 'hgss4',
  'Call of Legends': 'col1',

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
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased to 15s

    const response = await fetch(url, {
      headers: { 'X-Api-Key': POKEMON_API_KEY },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Pokemon API Verification] API error: ${response.status} for query: ${query}`);
      try {
        const errorBody = await response.text();
        console.error(`[Pokemon API Verification] Error body: ${errorBody.substring(0, 200)}`);
      } catch {}
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

    console.log(`[Pokemon API Verification] No matches for query: ${query}`);
    return null;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[Pokemon API Verification] Request timeout (15s)');
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
    // Sanitize the name for API query
    const sanitizedName = sanitizePokemonName(name);
    if (!sanitizedName) {
      console.log('[Pokemon API Verification] No valid name for queryByNameAndSet');
      return null;
    }

    let query = `name:"${sanitizedName}" set.name:"${setName}"`;
    if (cardNumber) {
      const normalizedNumber = normalizeCardNumber(cardNumber);
      query += ` number:${normalizedNumber}`;
    }

    const url = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query)}`;

    console.log(`[Pokemon API Verification] Fuzzy query: ${query}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased to 15s

    const response = await fetch(url, {
      headers: { 'X-Api-Key': POKEMON_API_KEY },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Pokemon API Verification] Fuzzy query returned ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      console.log(`[Pokemon API Verification] Found ${data.data.length} match(es) by name/set`);
      return data.data[0];
    }

    console.log(`[Pokemon API Verification] No matches for fuzzy query: ${query}`);
    return null;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[Pokemon API Verification] Fuzzy query timeout (15s)');
    } else {
      console.error('[Pokemon API Verification] Query error:', error.message);
    }
    return null;
  }
}

/**
 * Sanitize Pokemon name for API query
 * - Removes Japanese/CJK characters
 * - Extracts English name from parentheses format "Japanese (English)"
 * - Escapes special Lucene query characters
 */
function sanitizePokemonName(name: string): string {
  if (!name) return '';

  // If name contains parentheses with English inside, extract it
  // Format: "ガマゲロゲ (Seismitoad)" -> "Seismitoad"
  const parenMatch = name.match(/\(([A-Za-z][A-Za-z0-9\s\-\'\.]+)\)/);
  if (parenMatch) {
    return parenMatch[1].trim();
  }

  // Remove CJK characters (Japanese, Chinese, Korean)
  const asciiOnly = name.replace(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uAC00-\uD7AF]/g, '').trim();

  // If we stripped everything, return original (will likely fail but logged)
  if (!asciiOnly) {
    console.warn(`[Pokemon API Verification] Name "${name}" is fully CJK, cannot query API`);
    return name;
  }

  // Escape Lucene special characters: + - && || ! ( ) { } [ ] ^ " ~ * ? : \ /
  // But keep spaces and basic punctuation for Pokemon names
  const escaped = asciiOnly.replace(/([+\-&|!(){}[\]^~*?:\\\/])/g, '\\$1');

  return escaped;
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
    // Sanitize name for API query
    const sanitizedName = sanitizePokemonName(name);
    if (!sanitizedName) {
      console.log('[Pokemon API Verification] No valid name after sanitization');
      return null;
    }

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
        query = `name:"${sanitizedName}" number:"${numberVariation}" set.id:${promoSetId}`;
        console.log(`[Pokemon API Verification] Format-aware promo query: ${query}`);
      } else if (setTotal && format === 'fraction') {
        // Standard cards with denominator: use printedTotal filter
        const printedTotal = setTotal.replace(/^[A-Za-z]+/, '').trim();
        if (/^\d+$/.test(printedTotal)) {
          query = `name:"${sanitizedName}" number:"${numberVariation}" set.printedTotal:${printedTotal}`;
          console.log(`[Pokemon API Verification] Format-aware printedTotal query: ${query}`);
        } else {
          query = `name:"${sanitizedName}" number:"${numberVariation}"`;
        }
      } else {
        // Other formats: standard query
        query = `name:"${sanitizedName}" number:"${numberVariation}"`;
        console.log(`[Pokemon API Verification] Format-aware standard query: ${query}`);
      }

      const url = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query)}`;
      console.log(`[Pokemon API Verification] Full URL: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased to 15s

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
        } else {
          console.log(`[Pokemon API Verification] No matches for number: ${numberVariation}`);
        }
      } else {
        console.error(`[Pokemon API Verification] API returned ${response.status} for query: ${query}`);
        // Try to get error details
        try {
          const errorBody = await response.text();
          console.error(`[Pokemon API Verification] Error body: ${errorBody.substring(0, 200)}`);
        } catch {}
      }
    }

    return null;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[Pokemon API Verification] Format-aware request timeout (15s)');
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

  // Strategy 5 (NEW): Fuzzy number matching - try nearby numbers when exact fails
  // This helps when OCR misreads numbers (e.g., SM226 vs SM228)
  if (!apiCard && cardName && cardNumber) {
    const normalizedNumber = normalizeCardNumber(cardNumber);
    console.log(`[Pokemon API Verification] Strategy 5: Fuzzy number matching (±3 range)`);

    // Detect if this is a promo card
    const promoSetId = getPromoSetId(cardNumberFormat);

    const fuzzyResult = await searchLocalFuzzyNumber(cardName, normalizedNumber, promoSetId || undefined);
    if (fuzzyResult.card) {
      apiCard = fuzzyResult.card;
      result.verification_method = 'fuzzy_match';
      result.confidence = 'medium'; // Medium because name matched but number was corrected

      // Add correction for the number
      if (fuzzyResult.matchedNumber && fuzzyResult.matchedNumber !== normalizedNumber) {
        result.corrections.push({
          field: 'card_number',
          original: cardNumber,
          corrected: `${fuzzyResult.matchedNumber}/${apiCard.set.printedTotal}`
        });
        console.log(`[Pokemon API Verification] Fuzzy match corrected number: ${normalizedNumber} → ${fuzzyResult.matchedNumber}`);
      }
    }
  }

  // Process results
  if (apiCard) {
    // Check for corrections
    const apiSetName = apiCard.set.name;
    const apiCardName = apiCard.name;
    const apiCardNumber = `${apiCard.number}/${apiCard.set.printedTotal}`;
    const apiYear = apiCard.set.releaseDate?.split('/')[0] || '';
    const apiRarity = apiCard.rarity || '';

    // VALIDATION: Reject matches where year is way off (more than 3 years different)
    // This prevents matching 2014 cards to 2025 versions
    if (cardInfo.year && apiYear) {
      const originalYear = parseInt(cardInfo.year);
      const matchedYear = parseInt(apiYear);
      if (!isNaN(originalYear) && !isNaN(matchedYear)) {
        const yearDiff = Math.abs(originalYear - matchedYear);
        if (yearDiff > 3) {
          console.log(`[Pokemon API Verification] REJECTED: Year mismatch too large (${cardInfo.year} vs ${apiYear}, diff=${yearDiff})`);
          console.log(`[Pokemon API Verification] Original card info will be preserved`);
          // Don't use this match - the year is too different
          result.success = false;
          result.verified = false;
          result.pokemon_api_id = null;
          result.pokemon_api_data = null;
          result.verification_method = 'none';
          result.confidence = 'low';
          result.error = `Year mismatch: expected ~${cardInfo.year}, found ${apiYear}`;
          return result;
        }
      }
    }

    // VALIDATION: Reject if card name doesn't match at all
    // (fuzzy searches might return completely wrong cards)
    const normalizedOriginal = cardName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedMatched = apiCardName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedOriginal && normalizedMatched &&
        !normalizedMatched.includes(normalizedOriginal.substring(0, 5)) &&
        !normalizedOriginal.includes(normalizedMatched.substring(0, 5))) {
      console.log(`[Pokemon API Verification] REJECTED: Name mismatch (${cardName} vs ${apiCardName})`);
      result.success = false;
      result.verified = false;
      result.pokemon_api_id = null;
      result.pokemon_api_data = null;
      result.verification_method = 'none';
      result.confidence = 'low';
      result.error = `Name mismatch: expected ${cardName}, found ${apiCardName}`;
      return result;
    }

    result.success = true;
    result.verified = true;
    result.pokemon_api_id = apiCard.id;
    result.pokemon_api_data = apiCard;

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

  // Only apply corrections for high/medium confidence matches
  // Low confidence matches should NOT override original card info
  const shouldApplyCorrections = verificationResult.corrections.length > 0 &&
    (verificationResult.confidence === 'high' || verificationResult.confidence === 'medium');

  // For card_number specifically, only correct if the match is high confidence
  // AND the card number was actually wrong (not just a formatting difference)
  const shouldCorrectCardNumber = verificationResult.confidence === 'high';

  console.log(`[Pokemon API Update] Confidence: ${verificationResult.confidence}, ` +
              `Applying corrections: ${shouldApplyCorrections}, ` +
              `Correcting card_number: ${shouldCorrectCardNumber}`);

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

    // Override card info with verified data (only for high/medium confidence matches)
    ...(shouldApplyCorrections && {
      // Update card info with verified values
      card_name: apiCard.name,
      card_set: apiCard.set.name,
      release_date: apiCard.set.releaseDate?.split('/')[0] || null,
      // Only correct card_number for high confidence matches
      ...(shouldCorrectCardNumber && {
        card_number: `${apiCard.number}/${apiCard.set.printedTotal}`,
      })
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
