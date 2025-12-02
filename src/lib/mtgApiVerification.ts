/**
 * MTG Scryfall API Verification Service
 * Post-grading verification to ensure 100% accurate card identification
 */

import {
  ScryfallCard,
  getCardBySetAndNumber,
  searchCardByFuzzyName,
  searchCardByExactName,
  searchCardsAdvanced,
  extractMTGMetadata,
  getSetCodeFromName,
  getLanguageName,
  determineFoilType,
  isDoubleFaced,
} from './scryfallApi';

export interface MTGApiVerificationResult {
  success: boolean;
  verified: boolean;
  mtg_api_id: string | null;
  mtg_oracle_id: string | null;
  mtg_api_data: ScryfallCard | null;
  verification_method: 'set_collector_number' | 'fuzzy_name_set' | 'fuzzy_name' | 'advanced_search' | 'none';
  confidence: 'high' | 'medium' | 'low';
  corrections: {
    field: string;
    original: string | null;
    corrected: string | null;
  }[];
  error?: string;
}

export interface MTGCardInfoForVerification {
  card_name?: string;
  player_or_character?: string;  // For MTG, this would be the card name
  set_name?: string;
  card_number?: string;
  year?: string;
  set_code?: string;             // 3-letter set code (e.g., "MKM", "OTJ")
  language?: string;             // Card language (e.g., "English", "Japanese")
  is_foil?: boolean;             // Whether card is foil
  foil_type?: string;            // Type of foil treatment
}

/**
 * Normalize collector number for API lookup
 * Handles various formats: "123", "123/300", "123a", "F123"
 */
function normalizeCollectorNumber(cardNumber: string): string {
  if (!cardNumber) return '';

  // If it's a fraction format, extract just the numerator
  const fractionMatch = cardNumber.match(/^(\d+[a-z]?)\/\d+$/i);
  if (fractionMatch) {
    return fractionMatch[1];
  }

  // For promo/special formats like "F123" or "P123"
  const promoMatch = cardNumber.match(/^[FP]?(\d+[a-z]?)$/i);
  if (promoMatch) {
    return promoMatch[1];
  }

  // Remove any leading zeros but keep the rest
  const leadingZeroMatch = cardNumber.match(/^0*(\d+[a-z]?)$/i);
  if (leadingZeroMatch) {
    return leadingZeroMatch[1];
  }

  return cardNumber;
}

/**
 * Try to get set code from set name or the provided set code
 */
function resolveSetCode(setName?: string, setCode?: string): string | null {
  // If set code is already provided, clean it up
  if (setCode) {
    const cleanCode = setCode.toLowerCase().trim();
    if (/^[a-z0-9]{3,4}$/.test(cleanCode)) {
      return cleanCode;
    }
  }

  // Try to get set code from set name
  if (setName) {
    return getSetCodeFromName(setName);
  }

  return null;
}

/**
 * Verify an MTG card using the Scryfall API
 * Attempts multiple lookup strategies to find the exact card
 *
 * @param cardInfo - Card information from grading
 * @returns Verification result with API data and corrections
 */
export async function verifyMTGCard(cardInfo: MTGCardInfoForVerification): Promise<MTGApiVerificationResult> {
  console.log('[MTG API Verification] Starting verification for:', cardInfo);

  const result: MTGApiVerificationResult = {
    success: false,
    verified: false,
    mtg_api_id: null,
    mtg_oracle_id: null,
    mtg_api_data: null,
    verification_method: 'none',
    confidence: 'low',
    corrections: []
  };

  // Extract card info
  const cardName = cardInfo.card_name || cardInfo.player_or_character || '';
  const setName = cardInfo.set_name || '';
  const cardNumber = cardInfo.card_number || '';
  const providedSetCode = cardInfo.set_code || '';
  const language = cardInfo.language || 'English';

  if (!cardName && !cardNumber) {
    result.error = 'Insufficient card information for verification';
    return result;
  }

  let apiCard: ScryfallCard | null = null;

  // Strategy 1: Set code + collector number (most reliable)
  const setCode = resolveSetCode(setName, providedSetCode);
  if (setCode && cardNumber) {
    const normalizedNumber = normalizeCollectorNumber(cardNumber);
    console.log(`[MTG API Verification] Strategy 1: Set ${setCode} + Number ${normalizedNumber}`);

    apiCard = await getCardBySetAndNumber(setCode, normalizedNumber, language);

    if (apiCard) {
      result.verification_method = 'set_collector_number';
      result.confidence = 'high';
      console.log(`[MTG API Verification] Strategy 1 SUCCESS: ${apiCard.name}`);
    }
  }

  // Strategy 2: Exact name + set code
  if (!apiCard && cardName && setCode) {
    console.log(`[MTG API Verification] Strategy 2: Exact name "${cardName}" + set ${setCode}`);
    apiCard = await searchCardByExactName(cardName, setCode);

    if (apiCard) {
      result.verification_method = 'fuzzy_name_set';
      result.confidence = 'high';
      console.log(`[MTG API Verification] Strategy 2 SUCCESS: ${apiCard.name}`);
    }
  }

  // Strategy 3: Fuzzy name + set code
  if (!apiCard && cardName && setCode) {
    console.log(`[MTG API Verification] Strategy 3: Fuzzy name "${cardName}" + set ${setCode}`);
    apiCard = await searchCardByFuzzyName(cardName, setCode);

    if (apiCard) {
      result.verification_method = 'fuzzy_name_set';
      result.confidence = 'medium';
      console.log(`[MTG API Verification] Strategy 3 SUCCESS: ${apiCard.name}`);
    }
  }

  // Strategy 4: Fuzzy name only (broader search)
  if (!apiCard && cardName) {
    console.log(`[MTG API Verification] Strategy 4: Fuzzy name only "${cardName}"`);
    apiCard = await searchCardByFuzzyName(cardName);

    if (apiCard) {
      result.verification_method = 'fuzzy_name';
      result.confidence = 'low';
      console.log(`[MTG API Verification] Strategy 4 SUCCESS: ${apiCard.name}`);
    }
  }

  // Strategy 5: Advanced search with multiple parameters
  if (!apiCard && (cardName || cardNumber)) {
    console.log(`[MTG API Verification] Strategy 5: Advanced search`);

    const searchResult = await searchCardsAdvanced({
      name: cardName || undefined,
      set: setCode || undefined,
      collector_number: cardNumber ? normalizeCollectorNumber(cardNumber) : undefined,
      language: language !== 'English' ? language : undefined
    });

    if (searchResult && searchResult.data.length > 0) {
      apiCard = searchResult.data[0];
      result.verification_method = 'advanced_search';
      result.confidence = searchResult.data.length === 1 ? 'medium' : 'low';
      console.log(`[MTG API Verification] Strategy 5 SUCCESS: ${apiCard.name} (${searchResult.data.length} results)`);
    }
  }

  // Process results
  if (apiCard) {
    result.success = true;
    result.verified = true;
    result.mtg_api_id = apiCard.id;
    result.mtg_oracle_id = apiCard.oracle_id;
    result.mtg_api_data = apiCard;

    // Check for corrections
    const apiSetName = apiCard.set_name;
    const apiCardName = apiCard.name;
    const apiCollectorNumber = apiCard.collector_number;
    const apiSetCode = apiCard.set.toUpperCase();
    const apiLanguage = getLanguageName(apiCard.lang);

    // Record corrections if AI got something different
    if (setName && setName.toLowerCase() !== apiSetName.toLowerCase()) {
      result.corrections.push({
        field: 'set_name',
        original: setName,
        corrected: apiSetName
      });
    }

    if (cardName && cardName.toLowerCase() !== apiCardName.toLowerCase()) {
      result.corrections.push({
        field: 'card_name',
        original: cardName,
        corrected: apiCardName
      });
    }

    if (providedSetCode && providedSetCode.toUpperCase() !== apiSetCode) {
      result.corrections.push({
        field: 'set_code',
        original: providedSetCode,
        corrected: apiSetCode
      });
    }

    if (language && language !== apiLanguage) {
      result.corrections.push({
        field: 'language',
        original: language,
        corrected: apiLanguage
      });
    }

    console.log(`[MTG API Verification] SUCCESS: ${apiCard.name} (${apiCard.id}) from ${apiCard.set_name}`);
    if (result.corrections.length > 0) {
      console.log(`[MTG API Verification] Corrections needed:`, result.corrections);
    }
  } else {
    result.error = 'No matching card found in Scryfall API';
    console.log(`[MTG API Verification] FAILED: No match found for ${cardName} #${cardNumber}`);
  }

  return result;
}

/**
 * Get fields to update in database from verification result
 */
export function getMTGApiUpdateFields(verificationResult: MTGApiVerificationResult) {
  if (!verificationResult.success || !verificationResult.mtg_api_data) {
    return null;
  }

  const apiCard = verificationResult.mtg_api_data;
  const metadata = extractMTGMetadata(apiCard);

  return {
    // API verification fields
    mtg_api_id: verificationResult.mtg_api_id,
    mtg_oracle_id: verificationResult.mtg_oracle_id,
    mtg_api_data: apiCard, // Full API response as JSONB
    mtg_api_verified: true,
    mtg_api_verified_at: new Date().toISOString(),
    mtg_api_confidence: verificationResult.confidence,
    mtg_api_method: verificationResult.verification_method,

    // MTG-specific fields from API
    mtg_mana_cost: metadata.mtg_mana_cost,
    mtg_type_line: metadata.mtg_type_line,
    mtg_colors: metadata.mtg_colors,
    mtg_rarity: metadata.mtg_rarity,
    mtg_set_code: metadata.mtg_set_code,
    card_language: metadata.card_language,
    is_foil: metadata.is_foil,
    foil_type: metadata.foil_type,
    is_double_faced: metadata.is_double_faced,

    // Pricing from Scryfall
    scryfall_price_usd: metadata.scryfall_price_usd,
    scryfall_price_usd_foil: metadata.scryfall_price_usd_foil,
    scryfall_price_eur: metadata.scryfall_price_eur,
    scryfall_price_updated_at: new Date().toISOString(),

    // Override card info with verified data (if corrections needed)
    ...(verificationResult.corrections.length > 0 && {
      card_name: apiCard.name,
      card_set: apiCard.set_name,
      card_number: apiCard.collector_number,
    })
  };
}

/**
 * Extract display metadata from verified API card
 * For UI display purposes
 */
export function extractMTGDisplayMetadata(apiCard: ScryfallCard) {
  return {
    // Card details
    card_name: apiCard.name,
    mana_cost: apiCard.mana_cost || apiCard.card_faces?.[0]?.mana_cost || null,
    cmc: apiCard.cmc,
    type_line: apiCard.type_line,
    oracle_text: apiCard.oracle_text || apiCard.card_faces?.[0]?.oracle_text || null,
    colors: apiCard.colors || apiCard.card_faces?.[0]?.colors || [],
    color_identity: apiCard.color_identity,
    keywords: apiCard.keywords,

    // Set details
    set_code: apiCard.set.toUpperCase(),
    set_name: apiCard.set_name,
    set_type: apiCard.set_type,
    collector_number: apiCard.collector_number,
    rarity: apiCard.rarity,

    // Card features
    is_foil: apiCard.foil || apiCard.finishes?.includes('foil') || apiCard.finishes?.includes('etched'),
    foil_type: determineFoilType(apiCard),
    is_double_faced: isDoubleFaced(apiCard),
    layout: apiCard.layout,
    frame: apiCard.frame,
    frame_effects: apiCard.frame_effects || [],
    full_art: apiCard.full_art,
    textless: apiCard.textless,
    border_color: apiCard.border_color,
    promo: apiCard.promo,
    promo_types: apiCard.promo_types || [],

    // Language
    language: getLanguageName(apiCard.lang),

    // Images
    image_small: apiCard.image_uris?.small || apiCard.card_faces?.[0]?.image_uris?.small || null,
    image_normal: apiCard.image_uris?.normal || apiCard.card_faces?.[0]?.image_uris?.normal || null,
    image_large: apiCard.image_uris?.large || apiCard.card_faces?.[0]?.image_uris?.large || null,
    image_art_crop: apiCard.image_uris?.art_crop || apiCard.card_faces?.[0]?.image_uris?.art_crop || null,

    // Back face (for double-faced cards)
    back_face: apiCard.card_faces?.[1] ? {
      name: apiCard.card_faces[1].name,
      mana_cost: apiCard.card_faces[1].mana_cost,
      type_line: apiCard.card_faces[1].type_line,
      oracle_text: apiCard.card_faces[1].oracle_text,
      image_normal: apiCard.card_faces[1].image_uris?.normal || null,
    } : null,

    // Artist
    artist: apiCard.artist || null,

    // Pricing
    price_usd: apiCard.prices.usd ? parseFloat(apiCard.prices.usd) : null,
    price_usd_foil: apiCard.prices.usd_foil ? parseFloat(apiCard.prices.usd_foil) : null,
    price_usd_etched: apiCard.prices.usd_etched ? parseFloat(apiCard.prices.usd_etched) : null,
    price_eur: apiCard.prices.eur ? parseFloat(apiCard.prices.eur) : null,

    // External links
    scryfall_uri: apiCard.scryfall_uri,
    purchase_uris: apiCard.purchase_uris || {},

    // Legalities
    legalities: apiCard.legalities,

    // Other metadata
    released_at: apiCard.released_at,
    reprint: apiCard.reprint,
    digital: apiCard.digital,
    reserved: apiCard.reserved,
    games: apiCard.games,
  };
}

/**
 * Format mana cost for display (converts {U}{U} to symbols)
 */
export function formatManaCost(manaCost: string | null): string {
  if (!manaCost) return '';
  // Just return the raw mana cost - UI can render the symbols
  return manaCost;
}

/**
 * Get rarity display name
 */
export function getRarityDisplay(rarity: string): string {
  const rarityMap: Record<string, string> = {
    'common': 'Common',
    'uncommon': 'Uncommon',
    'rare': 'Rare',
    'mythic': 'Mythic Rare',
    'special': 'Special',
    'bonus': 'Bonus',
  };
  return rarityMap[rarity] || rarity;
}

/**
 * Get color name from color code
 */
export function getColorName(code: string): string {
  const colorMap: Record<string, string> = {
    'W': 'White',
    'U': 'Blue',
    'B': 'Black',
    'R': 'Red',
    'G': 'Green',
  };
  return colorMap[code] || code;
}
