// src/lib/starwarsCardMatcher.ts
// Fuzzy matching to find best Star Wars card match from database results

import { supabaseServer } from './supabaseServer';

export interface StarWarsCard {
  id: string;
  card_name: string;
  card_number: string | null;
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

export interface MatchResult {
  card: StarWarsCard | null;
  score: number;
  confidence: MatchConfidenceFlags;
}

function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
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
 */
export async function lookupStarWarsCard(
  cardName: string,
  cardNumber?: string,
  setName?: string,
  characterName?: string
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

  // Calculate overall confidence
  const totalFeatures = (cardNumber ? 1 : 0) + 1 + (setName ? 1 : 0) + (characterName ? 1 : 0);
  const matchedFeatures = (flags.numberMatched ? 1 : 0) + (flags.nameMatched ? 1 : 0) + (flags.setMatched ? 1 : 0) + (flags.characterMatched ? 1 : 0);
  flags.totalFeatures = totalFeatures;
  flags.matchedFeatures = matchedFeatures;

  if (bestScore >= 90) flags.overallConfidence = 'high';
  else if (bestScore >= 60) flags.overallConfidence = 'medium';
  else flags.overallConfidence = 'low';

  if (!bestCard) {
    warnings.push(`No match found for "${cardName}"${cardNumber ? ` (#${cardNumber})` : ''}`);
  }

  return { card: bestCard, score: bestScore, confidence: flags };
}
