// src/lib/mtgCardMatcher.ts
// Fuzzy matching to find best MTG card match from database results
// Used when AI scans a card and we need to verify/enhance with database info

import { supabaseServer } from './supabaseServer';

/**
 * MTG card data from our local database (Scryfall data)
 */
export interface MtgCard {
  id: string;                    // Scryfall card UUID
  oracle_id: string | null;      // Oracle ID for grouping all prints
  name: string;                  // Card name (first face for DFCs)

  // Mana and casting
  mana_cost: string | null;      // "{2}{U}{U}"
  cmc: number | null;            // Converted mana cost / mana value

  // Card type and text
  type_line: string | null;      // "Creature — Human Wizard"
  oracle_text: string | null;    // Rules text
  flavor_text: string | null;    // Flavor text

  // Colors
  colors: string[] | null;       // ["U", "W"]
  color_identity: string[] | null;

  // Stats
  power: string | null;          // Can be "*" or "1+*"
  toughness: string | null;
  loyalty: string | null;        // Planeswalker loyalty
  defense: string | null;        // Battle defense

  // Keywords
  keywords: string[] | null;     // ["Flying", "Trample"]

  // Set info
  set_id: string | null;         // Set UUID
  set_code: string;              // "mkm", "one", "dmu"
  set_name: string | null;       // "Murders at Karlov Manor"
  collector_number: string;      // "234", "23a", "F1"

  // Print-specific
  rarity: string | null;         // "common", "uncommon", "rare", "mythic"
  artist: string | null;         // Artist name
  released_at: string | null;    // Release date

  // Frame and layout
  layout: string | null;         // "normal", "transform", "split", etc.
  frame: string | null;          // "2015", "future", etc.
  border_color: string | null;   // "black", "white", "borderless"
  full_art: boolean | null;      // Is full art
  promo: boolean | null;         // Is promo card
  reprint: boolean | null;       // Is a reprint

  // Double-faced card support
  card_faces: any | null;        // Array of card face objects for DFCs

  // Images
  image_small: string | null;
  image_normal: string | null;
  image_large: string | null;
  image_art_crop: string | null;

  // Pricing
  price_usd: number | null;
  price_usd_foil: number | null;
  price_eur: number | null;

  // Legalities
  legalities: Record<string, string> | null;  // {"standard": "legal", "modern": "legal", ...}

  // External IDs
  tcgplayer_id: number | null;
  cardmarket_id: number | null;
  mtgo_id: number | null;
  arena_id: number | null;
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
  card: MtgCard | null;
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
 * Normalize set code (lowercase, trim)
 * MTG set codes are typically 3-6 lowercase characters like "mkm", "one", "dmu"
 */
export function normalizeSetCode(code: string): string {
  if (!code) return '';
  return code.toLowerCase().trim();
}

/**
 * Normalize collector number for MTG cards
 * Handles formats like:
 * - "234" → "234"
 * - "23a" → "23a"  (variant letters)
 * - "F1" → "F1"    (promo prefixes)
 * - "★1" → "★1"    (special characters)
 * - "001" → "1"    (leading zeros for numeric)
 */
export function normalizeCollectorNumber(num: string): string {
  if (!num) return '';

  let normalized = num.trim();

  // If purely numeric, remove leading zeros
  if (/^\d+$/.test(normalized)) {
    return normalized.replace(/^0+/, '') || '0';
  }

  // For alphanumeric (23a, F1, etc.), preserve as-is but lowercase
  return normalized.toLowerCase();
}

/**
 * Look up an MTG card directly by set code and collector number
 * This is the most reliable method when AI extracts the card number
 */
export async function lookupBySetAndNumber(
  setCode: string,
  collectorNumber: string
): Promise<MtgCard | null> {
  const supabase = supabaseServer();
  const normalizedCode = normalizeSetCode(setCode);
  const normalizedNumber = normalizeCollectorNumber(collectorNumber);

  // Try exact match first
  const { data, error } = await supabase
    .from('mtg_cards')
    .select('*')
    .eq('set_code', normalizedCode)
    .eq('collector_number', normalizedNumber)
    .limit(1)
    .single();

  if (error || !data) {
    // Try with original number (in case normalization removed needed chars)
    const { data: fallbackData } = await supabase
      .from('mtg_cards')
      .select('*')
      .eq('set_code', normalizedCode)
      .eq('collector_number', collectorNumber.toLowerCase())
      .limit(1)
      .single();

    return fallbackData as MtgCard | null;
  }

  return data as MtgCard;
}

/**
 * Search for MTG cards by name
 */
export async function searchByName(name: string, limit: number = 10): Promise<MtgCard[]> {
  const supabase = supabaseServer();

  // Search name field with case-insensitive partial match
  const { data, error } = await supabase
    .from('mtg_cards')
    .select('*')
    .ilike('name', `%${name}%`)
    .order('released_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[MTG Matcher] Search error:', error.message);
    return [];
  }

  return (data || []) as MtgCard[];
}

/**
 * Search for MTG cards by name and set
 */
export async function searchByNameAndSet(
  name: string,
  setName: string,
  limit: number = 10
): Promise<MtgCard[]> {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from('mtg_cards')
    .select('*')
    .ilike('name', `%${name}%`)
    .ilike('set_name', `%${setName}%`)
    .order('released_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[MTG Matcher] Search error:', error.message);
    return [];
  }

  return (data || []) as MtgCard[];
}

/**
 * Search for MTG cards by name and set code
 */
export async function searchByNameAndSetCode(
  name: string,
  setCode: string,
  limit: number = 10
): Promise<MtgCard[]> {
  const supabase = supabaseServer();
  const normalizedCode = normalizeSetCode(setCode);

  const { data, error } = await supabase
    .from('mtg_cards')
    .select('*')
    .ilike('name', `%${name}%`)
    .eq('set_code', normalizedCode)
    .order('collector_number', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[MTG Matcher] Search error:', error.message);
    return [];
  }

  return (data || []) as MtgCard[];
}

/**
 * Search by collector number across all sets
 */
export async function searchByCollectorNumber(
  collectorNumber: string,
  limit: number = 10
): Promise<MtgCard[]> {
  const supabase = supabaseServer();
  const normalized = normalizeCollectorNumber(collectorNumber);

  const { data, error } = await supabase
    .from('mtg_cards')
    .select('*')
    .eq('collector_number', normalized)
    .order('released_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[MTG Matcher] Search error:', error.message);
    return [];
  }

  return (data || []) as MtgCard[];
}

/**
 * Find best matching card with confidence scoring
 */
export function findBestMatchWithConfidence(
  dbResults: MtgCard[],
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

  // Normalize AI-provided values
  const normalizedAiNumber = aiIdentification.collectorNumber
    ? normalizeCollectorNumber(aiIdentification.collectorNumber)
    : null;
  const normalizedAiSetCode = aiIdentification.setCode
    ? normalizeSetCode(aiIdentification.setCode)
    : null;

  // Score each result with detailed tracking
  const scored = dbResults.map(card => {
    let score = 0;
    let factors = 0;
    const confidence: MatchConfidenceFlags = { ...emptyConfidence, warnings: [] };

    // Set code match - weight 4 (important for MTG with many printings)
    if (normalizedAiSetCode) {
      const setCodeScore = card.set_code === normalizedAiSetCode ? 1.0 : 0;
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
      const nameScore = calculateSimilarity(card.name, aiIdentification.name);
      score += nameScore * 3;
      factors += 3;
      confidence.nameScore = nameScore;
      confidence.nameMatched = nameScore >= 0.7;
      if (nameScore < 0.5) {
        confidence.warnings.push(`Name mismatch: "${aiIdentification.name}" vs "${card.name}"`);
      }
    }

    // Calculate matched features count
    let matchedFeatures = 0;
    let totalFeatures = 0;
    if (normalizedAiSetCode) { totalFeatures++; if (confidence.setCodeMatched) matchedFeatures++; }
    if (normalizedAiNumber) { totalFeatures++; if (confidence.numberMatched) matchedFeatures++; }
    if (aiIdentification.name) { totalFeatures++; if (confidence.nameMatched) matchedFeatures++; }

    confidence.matchedFeatures = matchedFeatures;
    confidence.totalFeatures = totalFeatures;

    // Determine overall confidence
    // Set code + number match is most reliable for MTG
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

  console.log('[MTG Matcher] Top 3 matches:');
  scored.slice(0, 3).forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.card.set_code}/${result.card.collector_number}: ${result.card.name} (${result.card.set_name}) - Score: ${result.score.toFixed(2)}, Confidence: ${result.confidence.overallConfidence}`);
    if (result.confidence.warnings.length > 0) {
      result.confidence.warnings.forEach(w => console.log(`     Warning: ${w}`));
    }
  });

  // Return best match
  return scored[0];
}

/**
 * Main lookup function: Find an MTG card from AI-extracted info
 * Tries set code + number first (most reliable), then falls back to name search
 */
export async function lookupMtgCard(
  aiIdentification: {
    card_name?: string;
    expansion_code?: string;
    card_number?: string;
    set_name?: string;
  }
): Promise<MatchResult> {
  console.log('[MTG Matcher] Looking up card:', aiIdentification);

  // Normalize input for internal use
  const setCode = aiIdentification.expansion_code;
  const collectorNumber = aiIdentification.card_number;
  const name = aiIdentification.card_name;
  const setName = aiIdentification.set_name;

  // Strategy 1: Direct set code + collector number lookup (most reliable)
  if (setCode && collectorNumber) {
    const directMatch = await lookupBySetAndNumber(setCode, collectorNumber);
    if (directMatch) {
      console.log('[MTG Matcher] Direct set/number match found:', directMatch.name);
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
    // Strategy 1b: Set+number failed, try just collector number across ALL sets
    // This handles AI misidentifying the set code
    console.log('[MTG Matcher] Set/number lookup failed, trying collector number across all sets...');
    const numberResults = await searchByCollectorNumber(collectorNumber);
    if (numberResults.length > 0) {
      console.log(`[MTG Matcher] Found ${numberResults.length} cards with collector number ${normalizeCollectorNumber(collectorNumber)}`);
      // Use name to find best match among results
      if (name) {
        const bestMatch = findBestMatchWithConfidence(numberResults, {
          setCode,
          collectorNumber,
          name,
          set: setName
        });
        if (bestMatch.card && bestMatch.confidence.overallConfidence !== 'low') {
          console.log(`[MTG Matcher] Best match by number+name: ${bestMatch.card.name} (${bestMatch.card.set_name})`);
          bestMatch.confidence.warnings.push(`AI set "${setName}" was incorrect, found in "${bestMatch.card.set_name}"`);
          return bestMatch;
        }
      }
      // If only one result, use it with medium confidence
      if (numberResults.length === 1) {
        console.log(`[MTG Matcher] Single match by number: ${numberResults[0].name} (${numberResults[0].set_name})`);
        return {
          card: numberResults[0],
          score: 0.8,
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
            warnings: [`AI set "${setName}" was incorrect, found in "${numberResults[0].set_name}"`]
          }
        };
      }
    }
  }

  // Strategy 2: Search by collector number (if we have it but not set code)
  if (collectorNumber && !setCode) {
    const numberResults = await searchByCollectorNumber(collectorNumber);
    if (numberResults.length > 0) {
      // If we also have a name, use it to refine
      if (name) {
        return findBestMatchWithConfidence(numberResults, {
          collectorNumber,
          name,
          set: setName
        });
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
  let searchResults: MtgCard[] = [];

  if (name && setCode) {
    // Try with set code first
    searchResults = await searchByNameAndSetCode(name, setCode);
  }

  if (searchResults.length === 0 && name && setName) {
    // Try with set name
    searchResults = await searchByNameAndSet(name, setName);
  }

  if (searchResults.length === 0 && name) {
    // Fall back to name-only search
    searchResults = await searchByName(name);
  }

  if (searchResults.length === 0) {
    console.log('[MTG Matcher] No matches found');
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
  return findBestMatchWithConfidence(searchResults, {
    setCode,
    collectorNumber,
    name,
    set: setName
  });
}

/**
 * Get all cards from a specific set
 */
export async function getCardsFromSet(setCode: string): Promise<MtgCard[]> {
  const supabase = supabaseServer();
  const normalizedCode = normalizeSetCode(setCode);

  const { data, error } = await supabase
    .from('mtg_cards')
    .select('*')
    .eq('set_code', normalizedCode)
    .order('collector_number', { ascending: true });

  if (error) {
    console.error('[MTG Matcher] Error fetching set cards:', error.message);
    return [];
  }

  return (data || []) as MtgCard[];
}

/**
 * Get all MTG sets
 */
export async function getAllSets(): Promise<any[]> {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from('mtg_sets')
    .select('*')
    .order('released_at', { ascending: false });

  if (error) {
    console.error('[MTG Matcher] Error fetching sets:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Get sets grouped by type for UI display
 */
export async function getSetsGroupedByType(): Promise<Record<string, any[]>> {
  const sets = await getAllSets();

  const grouped: Record<string, any[]> = {};

  sets.forEach(set => {
    const type = set.set_type || 'other';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(set);
  });

  return grouped;
}
