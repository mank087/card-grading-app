// src/lib/pokemonApiVerification.ts
// Pokemon Card Verification Service
// Uses LOCAL Supabase database for card lookup - NO external API calls
// v2.0 - Switched from external Pokemon TCG API to local database

import {
  PokemonCard,
  CardNumberFormat,
  normalizeCardNumber as normalizeCardNumberFromApi,
  detectCardNumberFormat,
  getPromoSetId,
  searchLocalFuzzyNumber,
  searchLocalDatabase,
  searchLocalByNameNumberSetId,
  searchLocalByNameNumberTotal
} from './pokemonTcgApi';

export interface PokemonApiVerificationResult {
  success: boolean;
  verified: boolean;
  pokemon_api_id: string | null;
  pokemon_api_data: PokemonCard | null;
  verification_method: 'set_id_number' | 'name_number_set' | 'fuzzy_match' | 'local_db' | 'none';
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
 * Normalize card number for database lookup
 * Handles various formats: "085/198", "85/198", "GG70/GG70", "SVP EN 085"
 */
function normalizeCardNumber(cardNumber: string): string {
  if (!cardNumber) return '';

  // If it's a fraction format, extract just the numerator
  const fractionMatch = cardNumber.match(/^(\d+)\/\d+$/);
  if (fractionMatch) {
    // Remove leading zeros for consistency
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
 * Used for local database queries
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
 * Sanitize Pokemon name for database query
 * - Removes Japanese/CJK characters
 * - Extracts English name from parentheses format "Japanese (English)"
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

  // If we stripped everything, return original
  if (!asciiOnly) {
    console.warn(`[Pokemon Local Verification] Name "${name}" is fully CJK`);
    return name;
  }

  return asciiOnly;
}

/**
 * Query local database by set ID and card number
 * This is the most reliable method for card identification
 */
async function queryBySetIdAndNumber(setId: string, cardNumber: string): Promise<PokemonCard | null> {
  try {
    const normalizedNumber = normalizeCardNumber(cardNumber);
    console.log(`[Pokemon Local Verification] Query by set+number: setId=${setId}, number=${normalizedNumber}`);

    const results = await searchLocalByNameNumberSetId('', normalizedNumber, setId);

    if (results.length > 0) {
      console.log(`[Pokemon Local Verification] Found ${results.length} match(es) by set+number`);
      return results[0];
    }

    console.log(`[Pokemon Local Verification] No matches for set ${setId} number ${normalizedNumber}`);
    return null;
  } catch (error: any) {
    console.error('[Pokemon Local Verification] Query error:', error.message);
    return null;
  }
}

/**
 * Query local database by name and set name
 * Fallback method when set ID is not available
 */
async function queryByNameAndSet(name: string, setName: string, cardNumber?: string): Promise<PokemonCard | null> {
  try {
    const sanitizedName = sanitizePokemonName(name);
    if (!sanitizedName) {
      console.log('[Pokemon Local Verification] No valid name for queryByNameAndSet');
      return null;
    }

    console.log(`[Pokemon Local Verification] Query by name+set: name=${sanitizedName}, set=${setName}, number=${cardNumber}`);

    const results = await searchLocalDatabase(sanitizedName, setName, cardNumber ? normalizeCardNumber(cardNumber) : undefined);

    if (results.length > 0) {
      console.log(`[Pokemon Local Verification] Found ${results.length} match(es) by name/set`);
      return results[0];
    }

    console.log(`[Pokemon Local Verification] No matches for name+set query`);
    return null;
  } catch (error: any) {
    console.error('[Pokemon Local Verification] Query error:', error.message);
    return null;
  }
}

/**
 * Query local database using format-aware number normalization
 * Uses detected format type to construct optimal query
 */
async function queryByFormatAwareNumber(
  name: string,
  cardNumberRaw: string,
  format: CardNumberFormat,
  setTotal?: string
): Promise<PokemonCard | null> {
  try {
    const sanitizedName = sanitizePokemonName(name);
    if (!sanitizedName) {
      console.log('[Pokemon Local Verification] No valid name after sanitization');
      return null;
    }

    // Get format-specific number variations
    const numberVariations = normalizeCardNumberFromApi(cardNumberRaw, format);
    if (numberVariations.length === 0) {
      console.log('[Pokemon Local Verification] No number variations generated');
      return null;
    }

    // Check if this is a promo format - use set.id constraint
    const promoSetId = getPromoSetId(format);

    for (const numberVariation of numberVariations) {
      let results: PokemonCard[] = [];

      if (promoSetId) {
        // Promo cards: use set.id constraint
        console.log(`[Pokemon Local Verification] Format-aware promo search: name=${sanitizedName}, number=${numberVariation}, setId=${promoSetId}`);
        results = await searchLocalByNameNumberSetId(sanitizedName, numberVariation, promoSetId);
      } else if (setTotal && format === 'fraction') {
        // Standard cards with denominator: use printedTotal filter
        const printedTotal = setTotal.replace(/^[A-Za-z]+/, '').trim();
        if (/^\d+$/.test(printedTotal)) {
          console.log(`[Pokemon Local Verification] Format-aware printedTotal search: name=${sanitizedName}, number=${numberVariation}, total=${printedTotal}`);
          results = await searchLocalByNameNumberTotal(sanitizedName, numberVariation, parseInt(printedTotal));
        }
      }

      if (results.length === 0) {
        // Fallback: standard name+number search
        console.log(`[Pokemon Local Verification] Format-aware standard search: name=${sanitizedName}, number=${numberVariation}`);
        results = await searchLocalByNameNumberTotal(sanitizedName, numberVariation);
      }

      if (results.length > 0) {
        console.log(`[Pokemon Local Verification] Format-aware search found ${results.length} match(es)`);
        return results[0];
      }
    }

    return null;
  } catch (error: any) {
    console.error('[Pokemon Local Verification] Format-aware query error:', error.message);
    return null;
  }
}

/**
 * Validate that a candidate match has the correct denominator
 * Returns true if match is valid, false if it should be rejected
 */
function validateDenominator(candidate: PokemonCard, aiSetTotal: string | undefined): boolean {
  if (!aiSetTotal || !candidate.set.printedTotal) {
    return true; // Can't validate, allow the match
  }

  // Extract numeric portion from setTotal (handles cases like "102", "TG30", etc.)
  const aiDenominatorStr = aiSetTotal.replace(/^[A-Za-z]+/, '').trim();
  const aiDenominator = parseInt(aiDenominatorStr);
  const dbDenominator = candidate.set.printedTotal;

  if (isNaN(aiDenominator)) {
    return true; // Can't parse, allow the match
  }

  if (aiDenominator !== dbDenominator) {
    console.log(`[Pokemon Local Verification] Candidate rejected: ${candidate.name} from ${candidate.set.name} (${dbDenominator} cards) - AI extracted /${aiSetTotal}`);
    return false;
  }

  return true;
}

/**
 * Filter an array of candidate matches to only those with matching denominator
 */
function filterByDenominator(candidates: PokemonCard[], aiSetTotal: string | undefined): PokemonCard[] {
  if (!aiSetTotal) {
    return candidates;
  }
  return candidates.filter(c => validateDenominator(c, aiSetTotal));
}

/**
 * Verify a Pokemon card using the LOCAL Supabase database
 * Attempts multiple lookup strategies to find the exact card
 * NO external API calls - uses local database only
 *
 * @param cardInfo - Card information from grading (conversational_card_info)
 * @returns Verification result with local database data and corrections
 */
export async function verifyPokemonCard(cardInfo: CardInfoForVerification): Promise<PokemonApiVerificationResult> {
  console.log('[Pokemon Local Verification] Starting verification for:', cardInfo);

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

  console.log(`[Pokemon Local Verification] Detected format: ${cardNumberFormat}, setTotal: ${setTotal}`);

  let dbCard: PokemonCard | null = null;

  // Strategy 0 (NEW): Format-aware search for promos and special formats
  if (!dbCard && cardName && cardNumberRaw && (cardNumberFormat === 'swsh_promo' || cardNumberFormat === 'sv_promo' || cardNumberFormat === 'galarian_gallery' || cardNumberFormat === 'trainer_gallery')) {
    console.log(`[Pokemon Local Verification] Strategy 0: Format-aware search for ${cardNumberFormat}`);
    dbCard = await queryByFormatAwareNumber(cardName, cardNumberRaw, cardNumberFormat, setTotal);
    if (dbCard) {
      result.verification_method = 'set_id_number';
      result.confidence = 'high';
    }
  }

  // Strategy 1: Use set code (most reliable for modern cards)
  if (!dbCard && setCode && cardNumber) {
    const setId = SET_CODE_TO_ID[setCode.toUpperCase()];
    if (setId) {
      console.log(`[Pokemon Local Verification] Strategy 1: Set code ${setCode} -> ${setId}`);
      dbCard = await queryBySetIdAndNumber(setId, cardNumber);
      if (dbCard) {
        result.verification_method = 'set_id_number';
        result.confidence = 'high';
      }
    }
  }

  // Strategy 1.5 (NEW): Use printedTotal from setTotal for fraction format
  if (!dbCard && cardName && cardNumber && setTotal && cardNumberFormat === 'fraction') {
    const printedTotal = setTotal.replace(/^[A-Za-z]+/, '').trim();
    if (/^\d+$/.test(printedTotal)) {
      console.log(`[Pokemon Local Verification] Strategy 1.5: Name + Number + printedTotal:${printedTotal}`);
      dbCard = await queryByFormatAwareNumber(cardName, cardNumberRaw, cardNumberFormat, setTotal);
      if (dbCard) {
        result.verification_method = 'set_id_number';
        result.confidence = 'high';
      }
    }
  }

  // Strategy 2: Use set name mapping
  if (!dbCard && setName && cardNumber) {
    const setId = SET_NAME_TO_ID[setName];
    if (setId) {
      console.log(`[Pokemon Local Verification] Strategy 2: Set name "${setName}" -> ${setId}`);
      dbCard = await queryBySetIdAndNumber(setId, cardNumber);
      if (dbCard) {
        result.verification_method = 'set_id_number';
        result.confidence = 'high';
      }
    }
  }

  // Strategy 3: Fuzzy lookup by name + set name + number
  if (!dbCard && cardName && setName) {
    console.log(`[Pokemon Local Verification] Strategy 3: Name + Set fuzzy search`);
    dbCard = await queryByNameAndSet(cardName, setName, cardNumber);
    if (dbCard) {
      result.verification_method = 'name_number_set';
      result.confidence = cardNumber ? 'medium' : 'low';
    }
  }

  // Strategy 4: Just name + number (broader search)
  if (!dbCard && cardName && cardNumber) {
    const normalizedNumber = normalizeCardNumber(cardNumber);
    console.log(`[Pokemon Local Verification] Strategy 4: Name + Number only`);

    try {
      let results = await searchLocalByNameNumberTotal(cardName, normalizedNumber);
      if (results.length > 0) {
        // CRITICAL: Filter by denominator first to avoid misidentification
        const denominatorFiltered = filterByDenominator(results, setTotal);
        if (denominatorFiltered.length > 0) {
          results = denominatorFiltered;
          console.log(`[Pokemon Local Verification] Filtered ${results.length} results by denominator ${setTotal}`);
        } else if (setTotal) {
          console.log(`[Pokemon Local Verification] WARNING: No results matched denominator ${setTotal}, using unfiltered results`);
        }

        // If we have year, filter by it
        if (cardInfo.year) {
          const yearMatch = results.find((c: PokemonCard) =>
            c.set.releaseDate?.startsWith(cardInfo.year!)
          );
          dbCard = yearMatch || results[0];
        } else {
          dbCard = results[0];
        }
        result.verification_method = 'local_db';
        result.confidence = 'low';
      }
    } catch (error) {
      console.error('[Pokemon Local Verification] Strategy 4 failed:', error);
    }
  }

  // Strategy 5: Fuzzy number matching - try nearby numbers when exact fails
  // NOTE: Skip fuzzy matching for vintage cards (WOTC era) to avoid misidentification
  const isVintageCard = setTotal && parseInt(setTotal.replace(/[^0-9]/g, '')) <= 132; // WOTC sets had <=132 cards
  if (!dbCard && cardName && cardNumber && !isVintageCard) {
    const normalizedNumber = normalizeCardNumber(cardNumber);
    console.log(`[Pokemon Local Verification] Strategy 5: Fuzzy number matching (±3 range)`);

    // Detect if this is a promo card
    const promoSetId = getPromoSetId(cardNumberFormat);

    const fuzzyResult = await searchLocalFuzzyNumber(cardName, normalizedNumber, promoSetId || undefined);
    if (fuzzyResult.card && validateDenominator(fuzzyResult.card, setTotal)) {
      dbCard = fuzzyResult.card;
      result.verification_method = 'fuzzy_match';
      result.confidence = 'medium'; // Medium because name matched but number was corrected

      // Add correction for the number
      if (fuzzyResult.matchedNumber && fuzzyResult.matchedNumber !== normalizedNumber) {
        result.corrections.push({
          field: 'card_number',
          original: cardNumber,
          corrected: `${fuzzyResult.matchedNumber}/${dbCard.set.printedTotal}`
        });
        console.log(`[Pokemon Local Verification] Fuzzy match corrected number: ${normalizedNumber} → ${fuzzyResult.matchedNumber}`);
      }
    }
  } else if (isVintageCard && !dbCard) {
    console.log(`[Pokemon Local Verification] Skipping fuzzy matching for vintage card (denominator ${setTotal})`);
  }

  // Process results
  if (dbCard) {
    // Check for corrections
    const dbSetName = dbCard.set.name;
    const dbCardName = dbCard.name;
    const dbCardNumber = `${dbCard.number}/${dbCard.set.printedTotal}`;
    const dbYear = dbCard.set.releaseDate?.split('/')[0] || '';

    // VALIDATION: Reject matches where year is way off (more than 3 years different)
    if (cardInfo.year && dbYear) {
      const originalYear = parseInt(cardInfo.year);
      const matchedYear = parseInt(dbYear);
      if (!isNaN(originalYear) && !isNaN(matchedYear)) {
        const yearDiff = Math.abs(originalYear - matchedYear);
        if (yearDiff > 3) {
          console.log(`[Pokemon Local Verification] REJECTED: Year mismatch too large (${cardInfo.year} vs ${dbYear}, diff=${yearDiff})`);
          result.success = false;
          result.verified = false;
          result.pokemon_api_id = null;
          result.pokemon_api_data = null;
          result.verification_method = 'none';
          result.confidence = 'low';
          result.error = `Year mismatch: expected ~${cardInfo.year}, found ${dbYear}`;
          return result;
        }
      }
    }

    // CRITICAL VALIDATION: Reject matches where set denominator doesn't match
    // This prevents misidentification of cards like Base Set Charizard (4/102) vs Celebrations (4/25)
    if (setTotal && dbCard.set.printedTotal) {
      // Extract numeric portion from setTotal (handles cases like "102", "TG30", etc.)
      const aiDenominatorStr = setTotal.replace(/^[A-Za-z]+/, '').trim();
      const aiDenominator = parseInt(aiDenominatorStr);
      const dbDenominator = dbCard.set.printedTotal;

      if (!isNaN(aiDenominator) && aiDenominator !== dbDenominator) {
        console.log(`[Pokemon Local Verification] REJECTED: Denominator mismatch (AI extracted: ${setTotal} → ${aiDenominator}, DB card: ${dbDenominator})`);
        console.log(`[Pokemon Local Verification] AI identified set total ${aiDenominator} but matched card is from set with ${dbDenominator} cards`);
        result.success = false;
        result.verified = false;
        result.pokemon_api_id = null;
        result.pokemon_api_data = null;
        result.verification_method = 'none';
        result.confidence = 'low';
        result.error = `Set mismatch: card shows /${setTotal} but matched set has ${dbDenominator} cards`;
        return result;
      }
    }

    // VALIDATION: Reject if card name doesn't match at all
    const normalizedOriginal = cardName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedMatched = dbCardName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedOriginal && normalizedMatched &&
        !normalizedMatched.includes(normalizedOriginal.substring(0, 5)) &&
        !normalizedOriginal.includes(normalizedMatched.substring(0, 5))) {
      console.log(`[Pokemon Local Verification] REJECTED: Name mismatch (${cardName} vs ${dbCardName})`);
      result.success = false;
      result.verified = false;
      result.pokemon_api_id = null;
      result.pokemon_api_data = null;
      result.verification_method = 'none';
      result.confidence = 'low';
      result.error = `Name mismatch: expected ${cardName}, found ${dbCardName}`;
      return result;
    }

    result.success = true;
    result.verified = true;
    result.pokemon_api_id = dbCard.id;
    result.pokemon_api_data = dbCard;

    // Record corrections if AI got something wrong
    if (setName && setName !== dbSetName && setName.toLowerCase() !== dbSetName.toLowerCase()) {
      result.corrections.push({
        field: 'set_name',
        original: setName,
        corrected: dbSetName
      });
    }

    if (cardName && cardName !== dbCardName && cardName.toLowerCase() !== dbCardName.toLowerCase()) {
      result.corrections.push({
        field: 'card_name',
        original: cardName,
        corrected: dbCardName
      });
    }

    if (cardInfo.year && cardInfo.year !== dbYear) {
      result.corrections.push({
        field: 'year',
        original: cardInfo.year,
        corrected: dbYear
      });
    }

    console.log(`[Pokemon Local Verification] SUCCESS: ${dbCard.name} (${dbCard.id}) from ${dbCard.set.name}`);
    if (result.corrections.length > 0) {
      console.log(`[Pokemon Local Verification] Corrections needed:`, result.corrections);
    }
  } else {
    result.error = 'No matching card found in local database';
    console.log(`[Pokemon Local Verification] FAILED: No match found for ${cardName} #${cardNumber}`);
  }

  return result;
}

/**
 * Save Pokemon verification results to database
 * Updates the card with verified data from local lookup
 */
export function getPokemonApiUpdateFields(verificationResult: PokemonApiVerificationResult) {
  if (!verificationResult.success || !verificationResult.pokemon_api_data) {
    return null;
  }

  const dbCard = verificationResult.pokemon_api_data;

  // Only apply corrections for high/medium confidence matches
  const shouldApplyCorrections = verificationResult.corrections.length > 0 &&
    (verificationResult.confidence === 'high' || verificationResult.confidence === 'medium');

  // For card_number specifically, only correct if the match is high confidence
  const shouldCorrectCardNumber = verificationResult.confidence === 'high';

  console.log(`[Pokemon Local Update] Confidence: ${verificationResult.confidence}, ` +
              `Applying corrections: ${shouldApplyCorrections}, ` +
              `Correcting card_number: ${shouldCorrectCardNumber}`);

  return {
    // Verification fields
    pokemon_api_id: verificationResult.pokemon_api_id,
    pokemon_api_data: dbCard, // Full card data as JSONB
    pokemon_api_verified: true,
    pokemon_api_verified_at: new Date().toISOString(),
    pokemon_api_confidence: verificationResult.confidence,
    pokemon_api_method: verificationResult.verification_method,

    // TCGPlayer direct product URL if available
    tcgplayer_url: dbCard.tcgplayer?.url || null,

    // Override card info with verified data (only for high/medium confidence matches)
    ...(shouldApplyCorrections && {
      card_name: dbCard.name,
      card_set: dbCard.set.name,
      release_date: dbCard.set.releaseDate?.split('/')[0] || null,
      ...(shouldCorrectCardNumber && {
        card_number: `${dbCard.number}/${dbCard.set.printedTotal}`,
      })
    })
  };
}

/**
 * Extract additional metadata from verified card
 * For display purposes
 */
export function extractPokemonMetadata(dbCard: PokemonCard) {
  return {
    // Card details
    pokemon_name: dbCard.name,
    pokemon_type: dbCard.types?.[0] || null,
    hp: dbCard.hp ? parseInt(dbCard.hp) : null,
    card_type: dbCard.supertype, // Pokemon, Trainer, Energy
    subtypes: dbCard.subtypes || [],
    evolves_from: dbCard.evolvesFrom || null,
    rarity: dbCard.rarity || null,
    artist: dbCard.artist || null,

    // Set details
    set_id: dbCard.set.id,
    set_name: dbCard.set.name,
    set_series: dbCard.set.series,
    set_printed_total: dbCard.set.printedTotal,
    set_total: dbCard.set.total,
    set_release_date: dbCard.set.releaseDate,
    set_symbol_url: dbCard.set.images?.symbol || null,
    set_logo_url: dbCard.set.images?.logo || null,

    // Images
    api_image_small: dbCard.images?.small || null,
    api_image_large: dbCard.images?.large || null,

    // Market data
    tcgplayer_url: dbCard.tcgplayer?.url || null,
    market_price: dbCard.tcgplayer?.prices?.holofoil?.market ||
                  dbCard.tcgplayer?.prices?.normal?.market ||
                  dbCard.tcgplayer?.prices?.reverseHolofoil?.market ||
                  dbCard.cardmarket?.prices?.averageSellPrice ||
                  null
  };
}
