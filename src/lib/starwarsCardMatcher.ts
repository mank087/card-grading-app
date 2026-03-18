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
 * Strategy 1: Search by card name + set name
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
    query = query.ilike('set_name', `%${setName}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data;
}

/**
 * Strategy 2: Search by card number + set
 */
async function searchByNumber(
  cardNumber: string,
  setName?: string
): Promise<StarWarsCard[]> {
  if (!cardNumber) return [];

  const supabase = supabaseServer();
  let query = supabase
    .from('starwars_cards')
    .select('*')
    .eq('card_number', cardNumber)
    .limit(20);

  if (setName) {
    query = query.ilike('set_name', `%${setName}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data;
}

/**
 * Main lookup function: multi-strategy matching
 */
export async function lookupStarWarsCard(
  cardName: string,
  cardNumber?: string,
  setName?: string
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
    overallConfidence: 'low',
    matchedFeatures: 0,
    totalFeatures: 0,
    warnings,
  };

  // Strategy 1: Name + set search (highest priority for Star Wars)
  if (cardName) {
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
        const numMatch = result.card_number.toLowerCase() === cardNumber.toLowerCase();
        if (numMatch) score += 10;
      }

      // Boost if set name matches
      if (setName && result.set_name) {
        const setSim = calculateSimilarity(setName, result.set_name);
        if (setSim > 0.5) score += 5;
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

  // Strategy 2: Card number + set (if name search didn't find a strong match)
  if ((!bestCard || bestScore < 80) && cardNumber) {
    const results = await searchByNumber(cardNumber, setName);
    for (const result of results) {
      let score = 70; // Number match starts at 70

      // Verify name roughly matches
      if (cardName) {
        const nameSim = calculateSimilarity(cardName, result.card_name);
        if (nameSim > 0.5) score += 20;
        else if (nameSim > 0.3) score += 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCard = result;
        flags.numberMatched = true;
        flags.numberScore = 100;
      }
    }
  }

  // Strategy 3: Broad name search without set filter
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
  const totalFeatures = (cardNumber ? 1 : 0) + 1 + (setName ? 1 : 0);
  const matchedFeatures = (flags.numberMatched ? 1 : 0) + (flags.nameMatched ? 1 : 0) + (flags.setMatched ? 1 : 0);
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
