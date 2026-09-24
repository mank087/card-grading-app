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
  searchLocalDatabase,
  searchLocalByNameNumberSetId,
  searchLocalByNameNumberTotal
} from './pokemonTcgApi';
import { namesAgree, speciesKey, type NameAgreement } from './identity/nameAgreement';
import { findUniqueDigitVariant, positionsOff } from './cardNumberUtils';
import type { CatalogCandidate } from './identity/catalogCandidates';
import { anniversaryNumber, anniversarySetIds, pokemonPrintedNumber, printedDenominatorMatches } from './pokemonAnniversary';

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
  /** Aug 25 2026: how the matched card's name compared with what the model read */
  name_agreement?: NameAgreement;
  /** A set+number hit that was REJECTED because its name contradicted the model's read */
  rejected_candidate?: { id: string; name: string; set_name: string; number: string; reason: string };
  /**
   * Sept 24 2026: the catalog cards this read could be when the lookup was
   * AMBIGUOUS (the in-set digit rescue found more than one, or the name+number
   * search across sets left more than one). Never auto-picked: the owner chooses.
   */
  candidates?: PokemonCatalogCandidate[];
}

/** One catalog card offered to the owner when verification could not decide. */
export type PokemonCatalogCandidate = CatalogCandidate;

export function toCatalogCandidate(card: PokemonCard): PokemonCatalogCandidate {
  return {
    id: card.id,
    name: card.name,
    number: String(card.number),
    set_name: card.set?.name || '',
    set_id: card.set?.id || '',
    rarity: card.rarity || null,
    printed_total: card.set?.printedTotal || null,
    image_small: card.images?.small || null,
  };
}

/** Candidates merged by catalog id, in first-seen order, capped. */
function addCandidates(result: PokemonApiVerificationResult, cards: PokemonCard[]): void {
  const list = result.candidates ? [...result.candidates] : [];
  for (const card of cards) {
    if (!card?.id || list.some(c => c.id === card.id)) continue;
    list.push(toCatalogCandidate(card));
  }
  if (list.length) result.candidates = list.slice(0, 6);
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
  const rgb = anniversaryNumber(cardNumber);
  if (rgb) return rgb;

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
 * Aug 25 2026: NAME-AWARE set+number lookup. The bare set+number hit is where a
 * misread digit becomes a different real card (Alolan Raichu ↔ Alolan Rattata,
 * Double Colorless ↔ Double Turbo Energy sit in the same sets with nearby
 * numbers). When the model read a name:
 *   1. take the set+number row only if its name agrees with that read;
 *   2. otherwise look for the ONE card in the same set whose name agrees and
 *      whose number is a single digit off (OCR-class misread) — correct to it;
 *   3. otherwise return nothing and record the rejected candidate.
 * With no AI name, behave as before (caller marks the result medium).
 */
async function queryBySetIdAndNumberChecked(
  setId: string,
  cardNumber: string,
  aiName: string,
  result: PokemonApiVerificationResult,
): Promise<{ card: PokemonCard | null; corrected?: boolean }> {
  const hit = await queryBySetIdAndNumber(setId, cardNumber);
  if (!aiName) return { card: hit };
  if (hit) {
    const agreement = namesAgree(aiName, hit.name);
    if (agreement.agrees) {
      result.name_agreement = agreement;
      return { card: hit };
    }
    console.log(`[Pokemon Local Verification] set+number hit "${hit.name}" REJECTED — ${agreement.reason}`);
    result.rejected_candidate = { id: hit.id, name: hit.name, set_name: hit.set?.name || '', number: String(hit.number), reason: agreement.reason };
  }
  // Digit-misread rescue within the same set, anchored on the species the model read
  try {
    const key = speciesKey(aiName) || aiName;
    const firstToken = key.split(' ')[0];
    const pool = await searchLocalNameInSet(firstToken, setId);
    const agreeing = pool.filter(c => namesAgree(aiName, c.name).agrees);
    const variant = findUniqueDigitVariant(agreeing, c => String(c.number), normalizeCardNumber(cardNumber));
    if (variant) {
      console.log(`[Pokemon Local Verification] 🔢 number misread corrected within set ${setId}: "${cardNumber}" → "${variant.number}" (${variant.name})`);
      result.corrections.push({ field: 'card_number', original: cardNumber, corrected: `${variant.number}/${variant.set.printedTotal}` });
      result.name_agreement = namesAgree(aiName, variant.name);
      return { card: variant, corrected: true };
    }
    // Two or more cards of this species sit one digit away (Espeon-GX 150/149 →
    // #140 and #152 in Sun & Moon). Guessing picks a different real card; the
    // owner picks instead.
    const target = normalizeCardNumber(cardNumber);
    const nearby = agreeing.filter(c => positionsOff(target, String(c.number)) === 1);
    if (nearby.length > 1) {
      console.log(`[Pokemon Local Verification] number "${cardNumber}" is ambiguous within set ${setId}: ${nearby.map(c => c.number).join(', ')}`);
      addCandidates(result, nearby);
    }
  } catch (e: any) {
    console.warn('[Pokemon Local Verification] rescue lookup failed:', e?.message);
  }
  return { card: null };
}

/** Name-only scan inside one set (used by the misread rescue). */
async function searchLocalNameInSet(nameToken: string, setId: string): Promise<PokemonCard[]> {
  try {
    const { supabaseServer } = await import('./supabaseServer');
    const { data } = await supabaseServer()
      .from('pokemon_cards')
      .select('*')
      .eq('set_id', setId)
      .ilike('name', `%${nameToken}%`)
      .limit(25);
    if (!data?.length) return [];
    // Reuse the local→API shape converter via a number-less search helper is not exposed;
    // map the minimal fields the rescue needs (id, name, number, set), plus what an
    // owner-facing candidate shows (rarity, thumbnail).
    return (data as any[]).map(r => ({
      id: r.id,
      name: r.name,
      number: String(r.number),
      rarity: r.rarity || '',
      images: { small: r.image_small || '', large: r.image_large || '' },
      set: { id: r.set_id, name: r.set_name, printedTotal: r.set_printed_total, releaseDate: r.set_release_date },
    })) as unknown as PokemonCard[];
  } catch {
    return [];
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
  const cardNumber = cardInfo.card_number || cardInfo.card_number_raw || '';
  const setCode = cardInfo.set_code || '';
  // New format-aware fields
  const cardNumberRaw = cardInfo.card_number_raw || cardNumber;
  const cardNumberFormat = cardInfo.card_number_format as CardNumberFormat || detectCardNumberFormat(cardNumberRaw);
  const setTotal = cardInfo.set_total || cardNumberRaw.split('/')[1]?.trim() || '';

  if (!cardName && !cardNumber) {
    result.error = 'Insufficient card information for verification';
    return result;
  }

  console.log(`[Pokemon Local Verification] Detected format: ${cardNumberFormat}, setTotal: ${setTotal}`);

  let dbCard: PokemonCard | null = null;

  // Anniversary evidence must be resolved before denominator-based legacy searches.
  // Reprints share numbers/fractions with their originals and 30C spans two sets.
  const anniversarySets = anniversarySetIds(cardInfo);
  if (anniversarySets) {
    const normalized = normalizeCardNumber(cardNumberRaw);
    const candidates: PokemonCard[] = [];
    for (const setId of anniversarySets) {
      const matches = await searchLocalByNameNumberSetId('', normalized, setId);
      candidates.push(...matches.filter(card =>
        namesAgree(cardName, card.name).agrees &&
        printedDenominatorMatches(card.printedNumber || pokemonPrintedNumber(card.id, card.number, card.set.printedTotal), setTotal)
      ));
    }
    if (candidates.length !== 1) {
      result.error = candidates.length ? 'Ambiguous anniversary card; retain the observed identity' : 'No anniversary card matches the observed name, number and denominator';
      return result; // Never fall back to an older printing for explicit anniversary evidence.
    }
    dbCard = candidates[0];
    result.verification_method = 'set_id_number';
    result.confidence = cardName ? 'high' : 'medium';
  }

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
      const checked = await queryBySetIdAndNumberChecked(setId, cardNumber, cardName, result);
      dbCard = checked.card;
      if (dbCard) {
        result.verification_method = 'set_id_number';
        // No AI name to cross-check → the number alone is not "high"
        result.confidence = cardName ? 'high' : 'medium';
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
      const checked = await queryBySetIdAndNumberChecked(setId, cardNumber, cardName, result);
      dbCard = checked.card;
      if (dbCard) {
        result.verification_method = 'set_id_number';
        result.confidence = cardName ? 'high' : 'medium';
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

  // Strategy 4: Just name + number (broader search, across every set).
  // Sept 24 2026: accepted ONLY when exactly one card survives the denominator
  // (and year) filter. It used to take results[0] and, with no denominator match,
  // fall back to the unfiltered list — a real card from some other set.
  if (!dbCard && cardName && cardNumber) {
    const normalizedNumber = normalizeCardNumber(cardNumber);
    console.log(`[Pokemon Local Verification] Strategy 4: Name + Number only`);

    try {
      const results = await searchLocalByNameNumberTotal(cardName, normalizedNumber);
      if (results.length > 0) {
        let pool = filterByDenominator(results, setTotal);
        if (cardInfo.year && pool.length > 1) {
          const sameYear = pool.filter((c: PokemonCard) => c.set.releaseDate?.startsWith(cardInfo.year!));
          if (sameYear.length > 0) pool = sameYear;
        }
        if (pool.length === 1) {
          dbCard = pool[0];
          result.verification_method = 'local_db';
          result.confidence = 'low';
        } else if (pool.length > 1) {
          console.log(`[Pokemon Local Verification] Strategy 4 ambiguous: ${pool.length} cards across sets — no match`);
          addCandidates(result, pool.filter(c => namesAgree(cardName, c.name).agrees));
        } else {
          console.log(`[Pokemon Local Verification] Strategy 4: no card matches denominator ${setTotal} — no match`);
        }
      }
    } catch (error) {
      console.error('[Pokemon Local Verification] Strategy 4 failed:', error);
    }
  }

  // Strategy 5 (cross-set ±3 fuzzy number match) was REMOVED Sept 24 2026: it
  // searched every set by name and ranked by numeric distance, and accepted
  // Espeon-GX sm1-152 (a different Rainbow Rare) for a card printed 140/149.

  // Process results
  if (dbCard) {
    return settleMatch(result, dbCard, { cardName, setName, year: cardInfo.year, setTotal, anniversary: !!anniversarySets });
  }
  result.error = 'No matching card found in local database';
  console.log(`[Pokemon Local Verification] FAILED: No match found for ${cardName} #${cardNumber}${result.candidates?.length ? ` (${result.candidates.length} candidates for the owner)` : ''}`);
  return result;
}

/**
 * Validate a found card against what was read (year, denominator, name) and
 * record the corrections. Shared by the strategy chain and the first-look
 * printed-number path so both apply the same rejections.
 */
function settleMatch(
  result: PokemonApiVerificationResult,
  dbCard: PokemonCard,
  read: { cardName: string; setName: string; year?: string; setTotal: string; anniversary: boolean },
): PokemonApiVerificationResult {
  const { cardName, setName, setTotal } = read;
  const cardInfo = { year: read.year };
  const anniversarySets = read.anniversary;
  {
    // Check for corrections
    const dbSetName = dbCard.set.name;
    const dbCardName = dbCard.name;
    const dbCardNumber = dbCard.printedNumber || pokemonPrintedNumber(dbCard.id, dbCard.number, dbCard.set.printedTotal);
    const dbYear = dbCard.set.releaseDate?.match(/^\d{4}/)?.[0] || '';

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
    if (anniversarySets && !printedDenominatorMatches(dbCardNumber, setTotal)) {
      result.error = 'Anniversary printed denominator mismatch';
      return result;
    }
    if (!anniversarySets && setTotal && dbCard.set.printedTotal) {
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

    // VALIDATION: Reject if the card name does not agree with what the model read.
    // Aug 25 2026: species-level agreement (variant tokens stripped) replaces the
    // old 5-character prefix test that passed "Alolan Raichu" for "Alolan Rattata".
    const agreement = namesAgree(cardName, dbCardName);
    result.name_agreement = agreement;
    if (!agreement.agrees) {
      console.log(`[Pokemon Local Verification] REJECTED: ${agreement.reason} (${cardName} vs ${dbCardName})`);
      result.rejected_candidate = { id: dbCard.id, name: dbCardName, set_name: dbSetName, number: String(dbCard.number), reason: agreement.reason };
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
    delete result.candidates;
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
  }
  return result;
}

/** "140/149" → { number: "140", total: 149 }; "TG05/TG30" → { number: "TG05", total: 30 }. */
export function splitPrintedPokemonNumber(printed: string | null | undefined): { number: string; total: number } | null {
  const raw = String(printed || '').trim().replace(/^#\s*/, '');
  const m = /^([A-Za-z]{0,6}\d+[A-Za-z]?)\s*\/\s*([A-Za-z]{0,6})(\d+)$/.exec(raw);
  if (!m) return null;
  const number = normalizeCardNumber(`${m[1]}/${m[2]}${m[3]}`);
  const total = parseInt(m[3], 10);
  if (!number || !Number.isFinite(total) || total <= 0) return null;
  return { number, total };
}

/**
 * The ONE catalog card with this exact printed number and set total whose name
 * agrees with `name` (namesAgree: "Espeon GX" agrees with "Espeon-GX"). The name
 * is compared in code, not with ilike, so hyphen/space variants of GX, EX, V,
 * VMAX and ex all match. Zero or 2+ agreeing cards → no match.
 */
export async function findUniqueCatalogMatch(
  name: string,
  printed: string,
): Promise<{ card: PokemonCard | null; agreeing: PokemonCard[] }> {
  const parsed = splitPrintedPokemonNumber(printed);
  if (!parsed || !String(name || '').trim()) return { card: null, agreeing: [] };
  const rows = await searchLocalByNameNumberTotal('', parsed.number, parsed.total);
  const agreeing = rows.filter(c => namesAgree(name, c.name).agrees);
  return { card: agreeing.length === 1 ? agreeing[0] : null, agreeing };
}

/**
 * Sept 24 2026 — the second read. When the grading call's number found no exact
 * catalog card (or several), first look's printed number is tried: it wins only
 * when it names exactly one catalog card whose name agrees with the read and
 * whose set total agrees with the grading call's denominator (when there is
 * one). The number change is recorded as a correction so the row, label and
 * report follow it.
 */
export async function verifyPokemonCardByPrintedNumber(
  cardInfo: CardInfoForVerification,
  printedNumber: string,
): Promise<PokemonApiVerificationResult> {
  const result: PokemonApiVerificationResult = {
    success: false, verified: false, pokemon_api_id: null, pokemon_api_data: null,
    verification_method: 'none', confidence: 'low', corrections: [],
  };
  const cardName = cardInfo.player_or_character || cardInfo.card_name || '';
  const gradingRaw = cardInfo.card_number_raw || cardInfo.card_number || '';
  const parsed = splitPrintedPokemonNumber(printedNumber);
  if (!cardName || !parsed) {
    result.error = 'No name or printed number to check';
    return result;
  }
  const gradingTotalText = cardInfo.set_total || gradingRaw.split('/')[1] || '';
  const gradingTotal = parseInt(String(gradingTotalText).replace(/[^0-9]/g, ''), 10);
  if (Number.isFinite(gradingTotal) && gradingTotal !== parsed.total) {
    result.error = `Printed denominator /${parsed.total} disagrees with the grading read /${gradingTotal}`;
    return result;
  }
  const { card, agreeing } = await findUniqueCatalogMatch(cardName, printedNumber);
  if (!card) {
    result.error = agreeing.length > 1 ? 'Printed number matches more than one catalog card' : 'Printed number has no catalog card with this name';
    if (agreeing.length > 1) addCandidates(result, agreeing);
    return result;
  }
  result.verification_method = 'set_id_number';
  result.confidence = 'high';
  const corrected = card.printedNumber || pokemonPrintedNumber(card.id, card.number, card.set.printedTotal);
  result.corrections.push({ field: 'card_number', original: gradingRaw || null, corrected });
  return settleMatch(result, card, {
    cardName, setName: cardInfo.set_name || '', year: cardInfo.year, setTotal: String(parsed.total), anniversary: false,
  });
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

  // Only apply corrections for high/medium confidence matches WHOSE NAME AGREED
  // with the model's read (Aug 25 2026 — a number-first match must never rename
  // or re-set a card on the strength of the number alone).
  const nameAgreed = verificationResult.name_agreement?.agrees !== false;
  const shouldApplyCorrections = verificationResult.corrections.length > 0 && nameAgreed &&
    (verificationResult.confidence === 'high' || verificationResult.confidence === 'medium');

  // For card_number and card_name specifically, only correct on a high-confidence match
  const shouldCorrectCardNumber = verificationResult.confidence === 'high' && nameAgreed;
  const shouldCorrectCardName = verificationResult.confidence === 'high' && nameAgreed;

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
      ...(shouldCorrectCardName && { card_name: dbCard.name }),
      card_set: dbCard.set.name,
      release_date: dbCard.set.releaseDate?.match(/^\d{4}/)?.[0] || null,
      ...(shouldCorrectCardNumber && {
        card_number: dbCard.printedNumber || pokemonPrintedNumber(dbCard.id, dbCard.number, dbCard.set.printedTotal),
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
