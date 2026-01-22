// src/lib/lorcanaCardMatcher.ts
// Fuzzy matching to find best Lorcana card match from database results
// Used when AI scans a card and we need to verify/enhance with database info

import { supabaseServer } from './supabaseServer';

/**
 * Lorcana card data from our local database
 */
export interface LorcanaCard {
  id: string;                    // Card UUID from Lorcast
  name: string;                  // "Elsa", "Mickey Mouse"
  version: string | null;        // "Spirit of Winter", "True Friend"
  full_name: string;             // "Elsa - Spirit of Winter"
  collector_number: string;      // "1", "207"
  set_id: string;                // Set UUID
  set_code: string;              // "1", "2", "P1"
  set_name: string;              // "The First Chapter"
  ink: string | null;            // "Amber", "Amethyst", "Emerald", "Ruby", "Sapphire", "Steel"
  inkwell: boolean;              // Can be put in inkwell
  card_type: string[] | null;    // ["Character"], ["Action", "Song"]
  classifications: string[] | null; // ["Storyborn", "Hero"]
  cost: number | null;           // Ink cost
  strength: number | null;       // Strength value
  willpower: number | null;      // Willpower value
  lore: number | null;           // Lore gained when questing
  card_text: string | null;      // Ability text
  flavor_text: string | null;    // Flavor text
  keywords: string[] | null;     // ["Challenger", "Evasive"]
  rarity: string | null;         // "Common", "Uncommon", "Rare", "Super Rare", "Legendary", "Enchanted"
  image_small: string | null;    // Small image URL
  image_normal: string | null;   // Normal image URL
  image_large: string | null;    // Large image URL
  illustrators: string[] | null; // Artist names
  price_usd: number | null;      // TCGPlayer USD price
  price_usd_foil: number | null; // Foil price
}

/**
 * Confidence flags tracking which features matched
 */
export interface MatchConfidenceFlags {
  setCodeMatched: boolean;
  setCodeScore: number;
  numberMatched: boolean;
  numberScore: number;
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
  card: LorcanaCard | null;
  score: number;
  confidence: MatchConfidenceFlags;
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1.0;

  // Contains match
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Levenshtein distance
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Parse Lorcana card number from various formats
 * Lorcana uses format like "1/204", "207/204", "1", etc.
 * Returns { setCode, collectorNumber }
 */
export function parseCardNumber(cardNumber: string): { setCode: string | null; collectorNumber: string | null } {
  if (!cardNumber) return { setCode: null, collectorNumber: null };

  const normalized = cardNumber.trim();

  // Format: "1/204" or "207/204" (number/total in set)
  // The set total can help identify the set
  const slashMatch = normalized.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slashMatch) {
    return {
      setCode: null, // Set code not in this format
      collectorNumber: slashMatch[1]
    };
  }

  // Format: Just a number "1" or "207"
  const numMatch = normalized.match(/^(\d+)$/);
  if (numMatch) {
    return {
      setCode: null,
      collectorNumber: numMatch[1]
    };
  }

  return { setCode: null, collectorNumber: normalized };
}

/**
 * Normalize collector number (remove leading zeros, etc.)
 */
export function normalizeCollectorNumber(num: string): string {
  if (!num) return '';
  // Remove leading zeros but keep at least one digit
  return num.replace(/^0+/, '') || '0';
}

/**
 * Look up a Lorcana card directly by set code and collector number
 * This is the most reliable method when AI extracts the card number
 */
export async function lookupBySetAndNumber(
  setCode: string,
  collectorNumber: string
): Promise<LorcanaCard | null> {
  const supabase = supabaseServer();
  const normalizedNumber = normalizeCollectorNumber(collectorNumber);

  // Try exact match first
  const { data, error } = await supabase
    .from('lorcana_cards')
    .select('*')
    .eq('set_code', setCode)
    .eq('collector_number', normalizedNumber)
    .limit(1)
    .single();

  if (error || !data) {
    // Try with original number (in case normalization removed needed chars)
    const { data: fallbackData } = await supabase
      .from('lorcana_cards')
      .select('*')
      .eq('set_code', setCode)
      .eq('collector_number', collectorNumber)
      .limit(1)
      .single();

    return fallbackData as LorcanaCard | null;
  }

  return data as LorcanaCard;
}

/**
 * Search for Lorcana cards by name
 */
export async function searchByName(name: string, limit: number = 10): Promise<LorcanaCard[]> {
  const supabase = supabaseServer();

  // Search both name and full_name fields
  const { data, error } = await supabase
    .from('lorcana_cards')
    .select('*')
    .or(`name.ilike.%${name}%,full_name.ilike.%${name}%`)
    .limit(limit);

  if (error) {
    console.error('[Lorcana Matcher] Search error:', error.message);
    return [];
  }

  return (data || []) as LorcanaCard[];
}

/**
 * Search for Lorcana cards by name and set
 */
export async function searchByNameAndSet(
  name: string,
  setName: string,
  limit: number = 10
): Promise<LorcanaCard[]> {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from('lorcana_cards')
    .select('*')
    .or(`name.ilike.%${name}%,full_name.ilike.%${name}%`)
    .ilike('set_name', `%${setName}%`)
    .limit(limit);

  if (error) {
    console.error('[Lorcana Matcher] Search error:', error.message);
    return [];
  }

  return (data || []) as LorcanaCard[];
}

/**
 * Search by collector number across all sets
 */
export async function searchByCollectorNumber(
  collectorNumber: string,
  limit: number = 10
): Promise<LorcanaCard[]> {
  const supabase = supabaseServer();
  const normalized = normalizeCollectorNumber(collectorNumber);

  const { data, error } = await supabase
    .from('lorcana_cards')
    .select('*')
    .eq('collector_number', normalized)
    .order('set_code', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Lorcana Matcher] Search error:', error.message);
    return [];
  }

  return (data || []) as LorcanaCard[];
}

/**
 * Find best matching card with confidence scoring
 */
export function findBestMatchWithConfidence(
  dbResults: LorcanaCard[],
  aiIdentification: {
    setCode?: string;
    collectorNumber?: string;
    name?: string;
    set?: string;
  }
): MatchResult {
  const emptyConfidence: MatchConfidenceFlags = {
    setCodeMatched: false,
    setCodeScore: 0,
    numberMatched: false,
    numberScore: 0,
    nameMatched: false,
    nameScore: 0,
    overallConfidence: 'low',
    matchedFeatures: 0,
    totalFeatures: 0,
    warnings: []
  };

  if (dbResults.length === 0) {
    return {
      card: null,
      score: 0,
      confidence: { ...emptyConfidence, warnings: ['No database results to match against'] }
    };
  }

  // Normalize AI-provided collector number
  const normalizedAiNumber = aiIdentification.collectorNumber
    ? normalizeCollectorNumber(aiIdentification.collectorNumber)
    : null;

  // Score each result with detailed tracking
  const scored = dbResults.map(card => {
    let score = 0;
    let factors = 0;
    const confidence: MatchConfidenceFlags = { ...emptyConfidence, warnings: [] };

    // Set code match - weight 4 (important for Lorcana)
    if (aiIdentification.setCode) {
      const setCodeScore = card.set_code === aiIdentification.setCode ? 1.0 : 0;
      score += setCodeScore * 4;
      factors += 4;
      confidence.setCodeScore = setCodeScore;
      confidence.setCodeMatched = setCodeScore >= 0.9;
      if (setCodeScore < 0.5) {
        confidence.warnings.push(`Set code mismatch: "${aiIdentification.setCode}" vs "${card.set_code}"`);
      }
    }

    // Collector number match - weight 5 (MOST important)
    if (normalizedAiNumber) {
      const cardNumber = normalizeCollectorNumber(card.collector_number);
      const numberScore = cardNumber === normalizedAiNumber ? 1.0 : 0;
      score += numberScore * 5;
      factors += 5;
      confidence.numberScore = numberScore;
      confidence.numberMatched = numberScore >= 0.9;
      if (numberScore < 0.5) {
        confidence.warnings.push(`Number mismatch: "${aiIdentification.collectorNumber}" vs "${card.collector_number}"`);
      }
    }

    // Name match - weight 3
    if (aiIdentification.name) {
      // Check against both name and full_name
      const nameScore = Math.max(
        calculateSimilarity(card.name, aiIdentification.name),
        calculateSimilarity(card.full_name || card.name, aiIdentification.name)
      );
      score += nameScore * 3;
      factors += 3;
      confidence.nameScore = nameScore;
      confidence.nameMatched = nameScore >= 0.7;
      if (nameScore < 0.5) {
        confidence.warnings.push(`Name mismatch: "${aiIdentification.name}" vs "${card.full_name || card.name}"`);
      }
    }

    // Calculate matched features count
    let matchedFeatures = 0;
    let totalFeatures = 0;
    if (aiIdentification.setCode) { totalFeatures++; if (confidence.setCodeMatched) matchedFeatures++; }
    if (normalizedAiNumber) { totalFeatures++; if (confidence.numberMatched) matchedFeatures++; }
    if (aiIdentification.name) { totalFeatures++; if (confidence.nameMatched) matchedFeatures++; }

    confidence.matchedFeatures = matchedFeatures;
    confidence.totalFeatures = totalFeatures;

    // Determine overall confidence
    // Set code + number match is most reliable for Lorcana
    if (confidence.setCodeMatched && confidence.numberMatched) {
      confidence.overallConfidence = 'high';
    } else if (confidence.numberMatched && confidence.nameMatched) {
      confidence.overallConfidence = 'high';
    } else if (matchedFeatures >= 2) {
      confidence.overallConfidence = 'medium';
    } else {
      confidence.overallConfidence = 'low';
    }

    return {
      card,
      score: factors > 0 ? score / factors : 0,
      confidence
    };
  });

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  console.log('[Lorcana Matcher] Top 3 matches:');
  scored.slice(0, 3).forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.card.set_code}/${result.card.collector_number}: ${result.card.full_name} (${result.card.set_name}) - Score: ${result.score.toFixed(2)}, Confidence: ${result.confidence.overallConfidence}`);
    if (result.confidence.warnings.length > 0) {
      result.confidence.warnings.forEach(w => console.log(`     Warning: ${w}`));
    }
  });

  // Return best match
  return scored[0];
}

/**
 * Main lookup function: Find a Lorcana card from AI-extracted info
 * Tries set code + number first (most reliable), then falls back to name search
 */
export async function lookupLorcanaCard(
  aiIdentification: {
    setCode?: string;
    collectorNumber?: string;
    name?: string;
    set?: string;
  }
): Promise<MatchResult> {
  console.log('[Lorcana Matcher] Looking up card:', aiIdentification);

  // Strategy 1: Direct set code + collector number lookup (most reliable)
  if (aiIdentification.setCode && aiIdentification.collectorNumber) {
    const directMatch = await lookupBySetAndNumber(
      aiIdentification.setCode,
      aiIdentification.collectorNumber
    );
    if (directMatch) {
      console.log('[Lorcana Matcher] Direct set/number match found:', directMatch.full_name);
      return {
        card: directMatch,
        score: 1.0,
        confidence: {
          setCodeMatched: true,
          setCodeScore: 1.0,
          numberMatched: true,
          numberScore: 1.0,
          nameMatched: true,
          nameScore: 1.0,
          overallConfidence: 'high',
          matchedFeatures: 3,
          totalFeatures: 3,
          warnings: []
        }
      };
    }
  }

  // Strategy 2: Search by collector number (if we have it but not set code)
  if (aiIdentification.collectorNumber && !aiIdentification.setCode) {
    const numberResults = await searchByCollectorNumber(aiIdentification.collectorNumber);
    if (numberResults.length > 0) {
      // If we also have a name, use it to refine
      if (aiIdentification.name) {
        return findBestMatchWithConfidence(numberResults, aiIdentification);
      }
      // Otherwise return first result with medium confidence
      return {
        card: numberResults[0],
        score: 0.7,
        confidence: {
          setCodeMatched: false,
          setCodeScore: 0,
          numberMatched: true,
          numberScore: 1.0,
          nameMatched: false,
          nameScore: 0,
          overallConfidence: 'medium',
          matchedFeatures: 1,
          totalFeatures: 2,
          warnings: ['Set code not provided, matched by collector number only']
        }
      };
    }
  }

  // Strategy 3: Search by name and set
  let searchResults: LorcanaCard[] = [];

  if (aiIdentification.name && aiIdentification.set) {
    searchResults = await searchByNameAndSet(aiIdentification.name, aiIdentification.set);
  } else if (aiIdentification.name) {
    searchResults = await searchByName(aiIdentification.name);
  }

  if (searchResults.length === 0) {
    console.log('[Lorcana Matcher] No matches found');
    return {
      card: null,
      score: 0,
      confidence: {
        setCodeMatched: false,
        setCodeScore: 0,
        numberMatched: false,
        numberScore: 0,
        nameMatched: false,
        nameScore: 0,
        overallConfidence: 'low',
        matchedFeatures: 0,
        totalFeatures: 0,
        warnings: ['No matching cards found in database']
      }
    };
  }

  // Find best match with confidence scoring
  return findBestMatchWithConfidence(searchResults, aiIdentification);
}

/**
 * Get all cards from a specific set
 */
export async function getCardsFromSet(setCode: string): Promise<LorcanaCard[]> {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from('lorcana_cards')
    .select('*')
    .eq('set_code', setCode)
    .order('collector_number', { ascending: true });

  if (error) {
    console.error('[Lorcana Matcher] Error fetching set cards:', error.message);
    return [];
  }

  return (data || []) as LorcanaCard[];
}

/**
 * Get set totals mapping (for identifying sets by card count)
 * Lorcana sets have specific card counts that can help identify them
 */
export async function getSetTotals(): Promise<Map<number, string>> {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from('lorcana_sets')
    .select('code, total_cards');

  if (error) {
    console.error('[Lorcana Matcher] Error fetching set totals:', error.message);
    return new Map();
  }

  const totals = new Map<number, string>();
  (data || []).forEach(set => {
    if (set.total_cards) {
      totals.set(set.total_cards, set.code);
    }
  });

  return totals;
}
