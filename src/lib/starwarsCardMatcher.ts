// src/lib/starwarsCardMatcher.ts
// Fuzzy matching to find best Star Wars card match from database results

import { supabaseServer } from './supabaseServer';

export interface StarWarsCard {
  id: string;
  card_name: string;
  card_number: string | null;
  /** Bracket content from the PriceCharting product name (NULL = base card).
   *  May be undefined/null on all rows if the variant_text backfill hasn't run yet. */
  variant_text?: string | null;
  set_id: string | null;
  set_name: string | null;
  console_name: string | null;
  genre: string | null;
  release_date: string | null;
  loose_price: number | null;
  cib_price: number | null;
  new_price: number | null;
  graded_price: number | null;
  box_only_price: number | null;
  manual_only_price: number | null;
  bgs_10_price: number | null;
  sales_volume: string | null;
  pricecharting_id: string | null;
}

export interface MatchConfidenceFlags {
  nameMatched: boolean;
  nameScore: number;
  numberMatched: boolean;
  numberScore: number;
  setMatched: boolean;
  setScore: number;
  characterMatched: boolean;
  characterScore: number;
  overallConfidence: 'high' | 'medium' | 'low';
  matchedFeatures: number;
  totalFeatures: number;
  warnings: string[];
}

/** One member of a variant family: rows sharing a card_number/base name that
 *  differ only in their PriceCharting bracket variant (base + foils/parallels). */
export interface FamilyVariant {
  id: string;
  card_name: string;
  variant_text: string | null;
  loose_price: number | null;
  graded_price: number | null;
}

export type VariantResolution =
  | 'single'        // only one row in the family — no ambiguity
  | 'hint'          // variant resolved via the caller-supplied variant hint
  | 'default_base'; // multiple variants, defaulted to the base (non-variant) row

export interface MatchResult {
  card: StarWarsCard | null;
  score: number;
  confidence: MatchConfidenceFlags;
  /** All rows sharing the matched card's number/base name (base + variants). */
  family: FamilyVariant[];
  variantResolution: VariantResolution | null;
}

/**
 * Strip PriceCharting bracket annotations from card names.
 * e.g., "The Emperor's Wrath [Mojo Refractor] #70" → "The Emperor's Wrath #70"
 */
function stripBrackets(str: string): string {
  return str.replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extract PriceCharting bracket variant text from a card name.
 * e.g., "Luke Skywalker [Foil] #100" → "Foil". Null when no brackets (base card).
 */
function extractBracketVariant(name: string | null | undefined): string | null {
  if (!name) return null;
  const matches = name.match(/\[([^\]]+)\]/g);
  if (!matches || matches.length === 0) return null;
  const joined = matches
    .map(m => m.slice(1, -1).trim())
    .filter(Boolean)
    .join(' ');
  return joined || null;
}

/**
 * Effective variant of a DB row: prefer the dedicated variant_text column,
 * falling back to parsing the bracket suffix out of card_name for rows
 * imported before the variant_text backfill ran (column NULL everywhere).
 */
function effectiveVariant(card: StarWarsCard): string | null {
  return card.variant_text ?? extractBracketVariant(card.card_name);
}

// Generic words that don't identify a specific variant on their own
const VARIANT_STOPWORDS = new Set(['parallel', 'variant', 'card', 'base']);

function variantTokens(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 0 && !VARIANT_STOPWORDS.has(t));
}

/**
 * Fetch the variant family for a matched card: all rows in the same set
 * sharing its card_number whose names differ only by bracket variant text
 * (base + foils/parallels). Always includes the matched card itself.
 */
async function fetchVariantFamily(matched: StarWarsCard): Promise<StarWarsCard[]> {
  if (!matched.card_number) return [matched];

  const supabase = supabaseServer();
  let query = supabase
    .from('starwars_cards')
    .select('*')
    .eq('card_number', matched.card_number)
    .limit(50);
  if (matched.set_id) {
    query = query.eq('set_id', matched.set_id);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) return [matched];

  // Family membership = same base name once bracket variants are stripped
  const baseName = stripBrackets(matched.card_name || '').toLowerCase();
  const family = (data as StarWarsCard[]).filter(
    r => stripBrackets(r.card_name || '').toLowerCase() === baseName
  );
  if (!family.some(r => r.id === matched.id)) family.push(matched);
  return family.length > 0 ? family : [matched];
}

function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  // Strip bracket annotations before comparing (PriceCharting adds [Parallel] etc.)
  const s1 = stripBrackets(str1).toLowerCase().trim();
  const s2 = stripBrackets(str2).toLowerCase().trim();
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w));
  if (commonWords.length > 0) {
    return commonWords.length / Math.max(words1.length, words2.length);
  }
  return 0;
}

/**
 * Normalize card number for comparison.
 * Strips leading zeros, #, spaces. Handles "45/100" → "45".
 */
function normalizeCardNumber(num: string): string {
  if (!num) return '';
  let n = num.trim().toLowerCase();
  // Remove leading # or other prefixes
  n = n.replace(/^[#\s]+/, '');
  // For "45/100" format, take the first part
  if (n.includes('/')) {
    n = n.split('/')[0].trim();
  }
  // Remove leading zeros (but keep "0" itself)
  n = n.replace(/^0+(?=\d)/, '');
  return n;
}

/**
 * Search by card number (most reliable identifier)
 */
async function searchByNumber(
  cardNumber: string,
  setName?: string
): Promise<StarWarsCard[]> {
  if (!cardNumber) return [];

  const supabase = supabaseServer();

  // Try exact match first
  let query = supabase
    .from('starwars_cards')
    .select('*')
    .eq('card_number', cardNumber)
    .limit(20);

  if (setName) {
    query = query.or(`set_name.ilike.%${setName}%,console_name.ilike.%${setName}%`);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    // Try with normalized number if exact match failed
    const normalized = normalizeCardNumber(cardNumber);
    if (normalized !== cardNumber) {
      const { data: data2 } = await supabase
        .from('starwars_cards')
        .select('*')
        .eq('card_number', normalized)
        .limit(20);
      return data2 || [];
    }
    return [];
  }
  return data;
}

/**
 * Search by card name
 */
async function searchByName(
  cardName: string,
  setName?: string
): Promise<StarWarsCard[]> {
  if (!cardName) return [];

  const supabase = supabaseServer();
  let query = supabase
    .from('starwars_cards')
    .select('*')
    .ilike('card_name', `%${cardName}%`)
    .limit(20);

  if (setName) {
    query = query.or(`set_name.ilike.%${setName}%,console_name.ilike.%${setName}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data;
}

/**
 * Main lookup function: multi-strategy matching
 *
 * @param cardName - Card title (may be on back of card for Galaxy sets)
 * @param cardNumber - Card collector number (most reliable ID)
 * @param setName - Set name
 * @param characterName - Character/subject depicted on front (for verification)
 * @param variantHint - AI-detected rarity/variant text (e.g. "Foil", "Mojo Refractor")
 *                      used to pick the right row when base + parallels share a card_number
 */
export async function lookupStarWarsCard(
  cardName: string,
  cardNumber?: string,
  setName?: string,
  characterName?: string,
  variantHint?: string
): Promise<MatchResult> {
  const warnings: string[] = [];
  let bestCard: StarWarsCard | null = null;
  let bestScore = 0;
  const flags: MatchConfidenceFlags = {
    nameMatched: false,
    nameScore: 0,
    numberMatched: false,
    numberScore: 0,
    setMatched: false,
    setScore: 0,
    characterMatched: false,
    characterScore: 0,
    overallConfidence: 'low',
    matchedFeatures: 0,
    totalFeatures: 0,
    warnings,
  };

  // Strategy 1 (HIGHEST PRIORITY): Card number lookup
  // Card number is the most reliable identifier — unique within a set
  if (cardNumber) {
    const results = await searchByNumber(cardNumber, setName);
    for (const result of results) {
      let score = 75; // Number match starts at 75

      // Verify name matches (card_name or character name)
      const nameSim = cardName ? calculateSimilarity(cardName, result.card_name) : 0;
      const charSim = characterName ? calculateSimilarity(characterName, result.card_name) : 0;
      const bestNameSim = Math.max(nameSim, charSim);

      if (bestNameSim >= 0.8) score += 20;       // Strong name verification → 95
      else if (bestNameSim >= 0.5) score += 15;   // Decent name verification → 90
      else if (bestNameSim >= 0.3) score += 10;   // Weak name verification → 85
      // Even without name match, number + set is still reliable

      // Boost for set match
      if (setName && result.set_name) {
        const setSim = calculateSimilarity(setName, result.set_name);
        if (setSim > 0.5) score += 5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCard = result;
        flags.numberMatched = true;
        flags.numberScore = 100;
        flags.nameMatched = bestNameSim > 0.5;
        flags.nameScore = Math.round(bestNameSim * 100);
        if (characterName) {
          flags.characterMatched = charSim > 0.5;
          flags.characterScore = Math.round(charSim * 100);
        }
        if (setName && result.set_name) {
          const setSim = calculateSimilarity(setName, result.set_name);
          flags.setMatched = setSim > 0.5;
          flags.setScore = Math.round(setSim * 100);
        }
      }
    }
  }

  // Strategy 2: Name + set search (if number search didn't find a strong match)
  if ((!bestCard || bestScore < 85) && cardName) {
    const results = await searchByName(cardName, setName);
    for (const result of results) {
      let score = 0;
      const nameSim = calculateSimilarity(cardName, result.card_name);

      if (nameSim === 1.0) score = 90;
      else if (nameSim >= 0.8) score = 75;
      else if (nameSim >= 0.5) score = 60;
      else score = 40;

      // Boost if card number matches
      if (cardNumber && result.card_number) {
        const numMatch = normalizeCardNumber(result.card_number) === normalizeCardNumber(cardNumber);
        if (numMatch) score += 10;
      }

      // Boost if set name matches
      if (setName && result.set_name) {
        const setSim = calculateSimilarity(setName, result.set_name);
        if (setSim > 0.5) score += 5;
      }

      // Boost if character name matches the DB card name
      // (useful when card_name from AI is the character but DB has the card title)
      if (characterName && characterName !== cardName) {
        const charSim = calculateSimilarity(characterName, result.card_name);
        if (charSim > 0.5) score += 5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCard = result;
        flags.nameMatched = nameSim > 0.5;
        flags.nameScore = Math.round(nameSim * 100);
        if (setName && result.set_name) {
          const setSim = calculateSimilarity(setName, result.set_name);
          flags.setMatched = setSim > 0.5;
          flags.setScore = Math.round(setSim * 100);
        }
      }
    }
  }

  // Strategy 3: Character name search (if card_name didn't work)
  // For Galaxy and similar sets, the character name visible on front
  // may not match the card title on the back
  if ((!bestCard || bestScore < 60) && characterName && characterName !== cardName) {
    const results = await searchByName(characterName, setName);
    for (const result of results) {
      const charSim = calculateSimilarity(characterName, result.card_name);
      let score = Math.round(charSim * 65);

      // Boost if card number also matches
      if (cardNumber && result.card_number) {
        const numMatch = normalizeCardNumber(result.card_number) === normalizeCardNumber(cardNumber);
        if (numMatch) score += 20;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCard = result;
        flags.characterMatched = charSim > 0.5;
        flags.characterScore = Math.round(charSim * 100);
        warnings.push('Matched by character name — card title may differ');
      }
    }
  }

  // Strategy 4: Broad name search without set filter (last resort)
  if (!bestCard || bestScore < 60) {
    const broadResults = await searchByName(cardName);
    for (const result of broadResults) {
      const nameSim = calculateSimilarity(cardName, result.card_name);
      const score = Math.round(nameSim * 70);
      if (score > bestScore) {
        bestScore = score;
        bestCard = result;
        flags.nameMatched = nameSim > 0.5;
        flags.nameScore = Math.round(nameSim * 100);
        warnings.push('Matched by name only — set could not be verified');
      }
    }
  }

  // VARIANT RESOLUTION (WS7.3): base and foil/parallel rows share the same
  // card_number and differ only in bracket variant text — resolve which family
  // member the physical card actually is instead of keeping an arbitrary row.
  let family: StarWarsCard[] = [];
  let variantResolution: VariantResolution | null = null;
  let capConfidenceToMedium = false;

  if (bestCard) {
    try {
      family = await fetchVariantFamily(bestCard);
    } catch {
      family = [bestCard];
    }

    if (family.length > 1) {
      // Base row = no variant text (from column or, pre-backfill, card_name brackets).
      // If variant_text is null on every row AND names carry no brackets, there is
      // no signal to distinguish them — baseRow picks the first and we degrade gracefully.
      const baseRow = family.find(r => effectiveVariant(r) === null) || null;
      const hintTokens = variantTokens(variantHint);

      if (hintTokens.length > 0) {
        // Prefer the family member whose variant tokens overlap the hint
        let bestVariantRow: StarWarsCard | null = null;
        let bestOverlap = 0;
        let bestRatio = 0;
        for (const row of family) {
          const vTokens = variantTokens(effectiveVariant(row));
          if (vTokens.length === 0) continue;
          const overlap = vTokens.filter(t => hintTokens.includes(t)).length;
          const ratio = overlap / vTokens.length;
          if (overlap > bestOverlap || (overlap === bestOverlap && overlap > 0 && ratio > bestRatio)) {
            bestOverlap = overlap;
            bestRatio = ratio;
            bestVariantRow = row;
          }
        }

        if (bestVariantRow && bestOverlap > 0) {
          bestCard = bestVariantRow;
          variantResolution = 'hint';
        } else {
          // Hint matched no known variant — fall back to the base row, but the
          // physical card may still be a parallel we don't have: cap confidence.
          if (baseRow) bestCard = baseRow;
          variantResolution = 'default_base';
          capConfidenceToMedium = true;
          warnings.push(`Variant hint "${variantHint}" did not match any of ${family.length} known variants — defaulted to base version`);
        }
      } else {
        // No usable hint — default to the base (non-variant) row
        if (baseRow) bestCard = baseRow;
        variantResolution = 'default_base';
        warnings.push(`${family.length} variants share card #${bestCard.card_number || '?'} — defaulted to base version`);
      }
    } else {
      variantResolution = 'single';
    }
  }

  // Calculate overall confidence
  const totalFeatures = (cardNumber ? 1 : 0) + 1 + (setName ? 1 : 0) + (characterName ? 1 : 0);
  const matchedFeatures = (flags.numberMatched ? 1 : 0) + (flags.nameMatched ? 1 : 0) + (flags.setMatched ? 1 : 0) + (flags.characterMatched ? 1 : 0);
  flags.totalFeatures = totalFeatures;
  flags.matchedFeatures = matchedFeatures;

  if (bestScore >= 90) flags.overallConfidence = 'high';
  else if (bestScore >= 60) flags.overallConfidence = 'medium';
  else flags.overallConfidence = 'low';

  // Hint given but unmatched among variants → we can't be sure which parallel
  // this is, so never report 'high' confidence
  if (capConfidenceToMedium && flags.overallConfidence === 'high') {
    flags.overallConfidence = 'medium';
  }

  if (!bestCard) {
    warnings.push(`No match found for "${cardName}"${cardNumber ? ` (#${cardNumber})` : ''}`);
  }

  const familyOut: FamilyVariant[] = family.map(r => ({
    id: r.id,
    card_name: r.card_name,
    variant_text: effectiveVariant(r),
    loose_price: r.loose_price,
    graded_price: r.graded_price,
  }));

  return { card: bestCard, score: bestScore, confidence: flags, family: familyOut, variantResolution };
}
