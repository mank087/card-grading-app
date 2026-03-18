// src/lib/yugiohCardMatcher.ts
// Fuzzy matching to find best Yu-Gi-Oh! card match from database results
// Used when AI scans a card and we need to verify/enhance with database info

import { supabaseServer } from './supabaseServer';

/**
 * Yu-Gi-Oh! card data from our local database
 */
export interface YugiohCard {
  card_id: number;
  name: string;
  type: string | null;
  frame_type: string | null;
  card_desc: string | null;
  race: string | null;          // Monster type (Spellcaster, Dragon) or spell/trap type
  attribute: string | null;     // DARK, LIGHT, FIRE, WATER, EARTH, WIND, DIVINE
  archetype: string | null;
  atk: number | null;
  def: number | null;
  level: number | null;
  scale: number | null;         // Pendulum scale
  linkval: number | null;       // Link rating
  linkmarkers: string[] | null; // Link arrows
  image_url: string | null;
  image_url_small: string | null;
  image_url_cropped: string | null;
  set_code: string | null;      // Specific printing code (e.g., "LOB-005")
  set_name: string | null;
  set_rarity: string | null;
  set_price: number | null;
  tcgplayer_price: number | null;
  cardmarket_price: number | null;
}

/**
 * Confidence flags tracking which features matched
 */
export interface MatchConfidenceFlags {
  setCodeMatched: boolean;
  setCodeScore: number;
  nameMatched: boolean;
  nameScore: number;
  overallConfidence: 'high' | 'medium' | 'low';
  matchedFeatures: number;
  totalFeatures: number;
  warnings: string[];
}

/**
 * Extended match result with confidence flags
 */
export interface MatchResult {
  card: YugiohCard | null;
  score: number;
  confidence: MatchConfidenceFlags;
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Simple word overlap score
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w));
  if (commonWords.length > 0) {
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  return 0;
}

/**
 * Parse a Yu-Gi-Oh set code into prefix and number
 * e.g., "LOB-005" -> { prefix: "LOB", number: "005" }
 * e.g., "CT13-EN003" -> { prefix: "CT13-EN", number: "003" }
 */
function parseSetCode(setCode: string): { prefix: string; number: string } | null {
  // Match patterns like "LOB-005", "CT13-EN003", "SDMY-EN010"
  const match = setCode.match(/^(.+?)[-]?(\d{2,4})$/);
  if (match) {
    return { prefix: match[1], number: match[2] };
  }
  return null;
}

/**
 * Strategy 1: Direct set code lookup (most reliable for YGO)
 * Yu-Gi-Oh set codes like "LOB-005" uniquely identify a printing
 */
async function lookupBySetCode(setCode: string): Promise<YugiohCard | null> {
  if (!setCode) return null;

  const { data, error } = await supabaseServer
    .from('yugioh_card_printings')
    .select(`
      card_id, card_name, set_code, set_name, set_rarity, set_rarity_code, set_price,
      yugioh_cards!inner (
        id, name, type, frame_type, card_desc, race, attribute, archetype,
        atk, def, level, scale, linkval, linkmarkers,
        image_url, image_url_small, image_url_cropped,
        tcgplayer_price, cardmarket_price
      )
    `)
    .ilike('set_code', setCode)
    .limit(1)
    .single();

  if (error || !data) return null;

  const card = data.yugioh_cards as any;
  return {
    card_id: card.id,
    name: card.name,
    type: card.type,
    frame_type: card.frame_type,
    card_desc: card.card_desc,
    race: card.race,
    attribute: card.attribute,
    archetype: card.archetype,
    atk: card.atk,
    def: card.def,
    level: card.level,
    scale: card.scale,
    linkval: card.linkval,
    linkmarkers: card.linkmarkers,
    image_url: card.image_url,
    image_url_small: card.image_url_small,
    image_url_cropped: card.image_url_cropped,
    set_code: data.set_code,
    set_name: data.set_name,
    set_rarity: data.set_rarity,
    set_price: data.set_price,
    tcgplayer_price: card.tcgplayer_price,
    cardmarket_price: card.cardmarket_price,
  };
}

/**
 * Strategy 2: Name search with optional set name filter
 */
async function searchByName(
  cardName: string,
  setName?: string
): Promise<YugiohCard[]> {
  if (!cardName) return [];

  let query = supabaseServer
    .from('yugioh_card_printings')
    .select(`
      card_id, card_name, set_code, set_name, set_rarity, set_price,
      yugioh_cards!inner (
        id, name, type, frame_type, card_desc, race, attribute, archetype,
        atk, def, level, scale, linkval, linkmarkers,
        image_url, image_url_small, image_url_cropped,
        tcgplayer_price, cardmarket_price
      )
    `)
    .ilike('card_name', `%${cardName}%`)
    .limit(20);

  if (setName) {
    query = query.ilike('set_name', `%${setName}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => {
    const card = row.yugioh_cards;
    return {
      card_id: card.id,
      name: card.name,
      type: card.type,
      frame_type: card.frame_type,
      card_desc: card.card_desc,
      race: card.race,
      attribute: card.attribute,
      archetype: card.archetype,
      atk: card.atk,
      def: card.def,
      level: card.level,
      scale: card.scale,
      linkval: card.linkval,
      linkmarkers: card.linkmarkers,
      image_url: card.image_url,
      image_url_small: card.image_url_small,
      image_url_cropped: card.image_url_cropped,
      set_code: row.set_code,
      set_name: row.set_name,
      set_rarity: row.set_rarity,
      set_price: row.set_price,
      tcgplayer_price: card.tcgplayer_price,
      cardmarket_price: card.cardmarket_price,
    };
  });
}

/**
 * Main lookup function: multi-strategy matching
 *
 * @param cardName - Card name from AI identification
 * @param setCode  - Full set code from AI (e.g., "LOB-005") or OCR
 * @param setName  - Set name from AI identification
 */
export async function lookupYugiohCard(
  cardName: string,
  setCode?: string,
  setName?: string
): Promise<MatchResult> {
  const warnings: string[] = [];
  let bestCard: YugiohCard | null = null;
  let bestScore = 0;
  const flags: MatchConfidenceFlags = {
    setCodeMatched: false,
    setCodeScore: 0,
    nameMatched: false,
    nameScore: 0,
    overallConfidence: 'low',
    matchedFeatures: 0,
    totalFeatures: 0,
    warnings,
  };

  // Strategy 1: Direct set code lookup (highest confidence)
  if (setCode) {
    const directMatch = await lookupBySetCode(setCode);
    if (directMatch) {
      flags.setCodeMatched = true;
      flags.setCodeScore = 100;

      // Verify the name roughly matches
      const nameSim = calculateSimilarity(cardName, directMatch.name);
      flags.nameMatched = nameSim > 0.5;
      flags.nameScore = Math.round(nameSim * 100);

      if (nameSim < 0.3) {
        warnings.push(`Set code ${setCode} found "${directMatch.name}" but AI identified "${cardName}" — name mismatch`);
      }

      bestCard = directMatch;
      bestScore = nameSim > 0.5 ? 100 : 80;
    } else {
      warnings.push(`Set code "${setCode}" not found in database`);
    }
  }

  // Strategy 2: Name + set name search
  if (!bestCard || bestScore < 90) {
    const results = await searchByName(cardName, setName);

    if (results.length > 0) {
      // Score each result
      for (const result of results) {
        let score = 0;
        const nameSim = calculateSimilarity(cardName, result.name);

        if (nameSim === 1.0) score = 90;
        else if (nameSim >= 0.8) score = 75;
        else if (nameSim >= 0.5) score = 60;
        else score = 40;

        // Boost if set name also matches
        if (setName && result.set_name) {
          const setSim = calculateSimilarity(setName, result.set_name);
          if (setSim > 0.5) score += 10;
        }

        if (score > bestScore) {
          bestScore = score;
          bestCard = result;
          flags.nameMatched = nameSim > 0.5;
          flags.nameScore = Math.round(nameSim * 100);
        }
      }
    }
  }

  // Strategy 3: Broad name search (no set filter)
  if (!bestCard || bestScore < 60) {
    const broadResults = await searchByName(cardName);

    if (broadResults.length > 0) {
      for (const result of broadResults) {
        const nameSim = calculateSimilarity(cardName, result.name);
        const score = Math.round(nameSim * 70); // Max 70 for broad match

        if (score > bestScore) {
          bestScore = score;
          bestCard = result;
          flags.nameMatched = nameSim > 0.5;
          flags.nameScore = Math.round(nameSim * 100);
          warnings.push('Matched by name only — set could not be verified');
        }
      }
    }
  }

  // Calculate overall confidence
  const totalFeatures = (setCode ? 1 : 0) + 1; // set code + name
  const matchedFeatures = (flags.setCodeMatched ? 1 : 0) + (flags.nameMatched ? 1 : 0);
  flags.totalFeatures = totalFeatures;
  flags.matchedFeatures = matchedFeatures;

  if (bestScore >= 90) flags.overallConfidence = 'high';
  else if (bestScore >= 60) flags.overallConfidence = 'medium';
  else flags.overallConfidence = 'low';

  if (!bestCard) {
    warnings.push(`No match found for "${cardName}"${setCode ? ` (${setCode})` : ''}`);
  }

  return { card: bestCard, score: bestScore, confidence: flags };
}
