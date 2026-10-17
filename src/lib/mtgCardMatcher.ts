// src/lib/mtgCardMatcher.ts
// Fuzzy matching to find best MTG card match from database results
// Used when AI scans a card and we need to verify/enhance with database info

import { supabaseServer } from './supabaseServer';
import { findUniqueDigitVariant } from './cardNumberUtils';

/**
 * MTG card data from our local database (Scryfall data)
 */
export interface MtgCard {
  /** Scryfall finishes available for this printing (Oct 2026 foil witness). */
  foil?: boolean | null;
  nonfoil?: boolean | null;
  id: string;                    // Scryfall card UUID
  oracle_id: string | null;      // Oracle ID for grouping all prints
  name: string;                  // Card name (first face for DFCs)
  flavor_name: string | null;    // Crossover/alternate name (Universes Beyond, Secret Lair)

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
  // Set when the card NAME matched strongly but the specific PRINT is ambiguous
  // (heavily reprinted card with no usable set/number info). The caller can run
  // visual disambiguation against these to pick the right print.
  printCandidates?: MtgCard[];
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
 * - "F1" → "f1"    (promo prefixes)
 * - "★1" → "★1"    (special characters)
 * - "001" → "1"    (leading zeros for numeric)
 * - "M 0010" → "10" (Universes Beyond prefix + leading zeros, e.g., Marvel "M 0010")
 * - "234/516" → "234" (fraction format — extract numerator)
 */
export function normalizeCollectorNumber(num: string): string {
  if (!num) return '';

  let normalized = num.trim();

  // Handle fraction format "234/516" — extract numerator only
  const fractionMatch = normalized.match(/^(\d+)\s*\/\s*\d+$/);
  if (fractionMatch) {
    normalized = fractionMatch[1];
  }

  // Handle Universes Beyond / crossover prefix format: "M 0010", "S 0023"
  // A single letter followed by a space and a number → strip the prefix
  const prefixMatch = normalized.match(/^[A-Za-z]\s+0*(\d+)$/);
  if (prefixMatch) {
    return prefixMatch[1] || '0';
  }

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
      .eq('collector_number', collectorNumber.toLowerCase().trim())
      .limit(1)
      .single();

    if (fallbackData) return fallbackData as MtgCard;

    // Try extracting just the numeric portion as final fallback
    // Handles cases like "M 0010" → "10", "C0053" → "53"
    const numericOnly = collectorNumber.replace(/[^0-9]/g, '').replace(/^0+/, '') || '0';
    if (numericOnly !== normalizedNumber) {
      const { data: numericData } = await supabase
        .from('mtg_cards')
        .select('*')
        .eq('set_code', normalizedCode)
        .eq('collector_number', numericOnly)
        .limit(1)
        .single();

      return numericData as MtgCard | null;
    }

    return null;
  }

  return data as MtgCard;
}

/**
 * Quote a value for use inside a PostgREST .or() filter list.
 * .or() splits conditions on commas, so unquoted names like
 * "Jace, the Mind Sculptor" produce a malformed query that errors out.
 */
function orPattern(value: string): string {
  return `"%${value.replace(/[\\"]/g, '')}%"`;
}

/**
 * Search for MTG cards by name
 */
export async function searchByName(name: string, limit: number = 10): Promise<MtgCard[]> {
  const supabase = supabaseServer();

  // Search name and flavor_name fields with case-insensitive partial match
  const { data, error } = await supabase
    .from('mtg_cards')
    .select('*')
    .or(`name.ilike.${orPattern(name)},flavor_name.ilike.${orPattern(name)}`)
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
    .or(`name.ilike.${orPattern(name)},flavor_name.ilike.${orPattern(name)}`)
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
    .or(`name.ilike.${orPattern(name)},flavor_name.ilike.${orPattern(name)}`)
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
 * Get every print of a card (all sets), preferring oracle_id grouping.
 * Ordered oldest-first so vintage prints are never cut off by the limit.
 */
export async function getAllPrints(card: MtgCard, limit: number = 50): Promise<MtgCard[]> {
  const supabase = supabaseServer();

  let query = supabase.from('mtg_cards').select('*');
  if (card.oracle_id) {
    query = query.eq('oracle_id', card.oracle_id);
  } else {
    query = query.eq('name', card.name);
  }

  const { data, error } = await query
    .order('released_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[MTG Matcher] getAllPrints error:', error.message);
    return [card];
  }

  return (data && data.length > 0 ? data : [card]) as MtgCard[];
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
 * Oct 2026: a name the grader misspelled by a letter or two ("Silver Overlord" for
 * Sliver Overlord) finds nothing with the ILIKE searches, and the card then goes
 * unlinked (34% of MTG cards graded since Sept 1 had no catalog link). Search on
 * the longest token and keep candidates whose whole name is within a couple of
 * edits of what was read.
 */
export function fuzzyNameScore(read: string, candidate: string): number {
  return calculateSimilarity(read, candidate);
}

export async function searchByFuzzyName(name: string, limit: number = 80): Promise<MtgCard[]> {
  const exact = await searchByName(name, limit);
  if (exact.length > 0) return exact;
  const tokens = name.split(/[^A-Za-z0-9']+/).filter(t => t.length >= 4).sort((a, b) => b.length - a.length);
  if (tokens.length === 0) return [];
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('mtg_cards')
    .select('*')
    .or(`name.ilike.${orPattern(tokens[0])},flavor_name.ilike.${orPattern(tokens[0])}`)
    .order('released_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return (data as MtgCard[])
    .filter(c => Math.max(fuzzyNameScore(name, c.name), c.flavor_name ? fuzzyNameScore(name, c.flavor_name) : 0) >= 0.85)
    .slice(0, limit);
}

/**
 * Oct 2026: the printed collector number decides the printing. A Planar Chaos
 * Damnation read as "85/165" was linked to Time Spiral Remastered #106 because
 * the name+set search found exactly one Damnation in the claimed set and never
 * looked at the number. Every printing of the (fuzzily matched) name whose
 * collector number equals the read one; the caller takes a unique hit over the
 * claimed set.
 */
export async function printingsByNameAndNumber(name: string, collectorNumber: string): Promise<MtgCard[]> {
  const wanted = normalizeCollectorNumber(collectorNumber);
  if (!wanted) return [];
  const candidates = await searchByFuzzyName(name, 120);
  return candidates.filter(c => normalizeCollectorNumber(String(c.collector_number || '')) === wanted);
}

function setNamesAgree(a: string | undefined, b: string | null | undefined): boolean {
  const n = (v: string | null | undefined) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const x = n(a), y = n(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/**
 * Oct 2026 border witness. Alpha and Beta are black-bordered; a white-bordered
 * Animate Dead was linked to Limited Edition Alpha, and two white-bordered cards
 * were linked to "Fourth Edition Foreign Black Border". The first look now reports
 * the outer border as an enum; when it contradicts the linked printing's border
 * colour, the printing is re-picked among the same card's prints with that
 * border (the read collector number chooses between several). With no
 * consistent printing the match drops to low and the candidates go to the
 * visual disambiguation. Only the strong pairs count: white vs black/silver/gold
 * and black vs white. Borderless prints have a dark edge and are left alone.
 */
export type ObservedBorder = 'black' | 'white' | 'silver' | 'gold' | 'borderless' | 'other' | 'unclear';

export function borderContradicts(observed: string | null | undefined, catalog: string | null | undefined): boolean {
  const o = String(observed || '').toLowerCase(), c = String(catalog || '').toLowerCase();
  if (!o || !c) return false;
  if (o === 'white') return c === 'black' || c === 'silver' || c === 'gold';
  if (o === 'black') return c === 'white';
  return false;
}

export async function applyBorderWitness(
  result: MatchResult,
  observed: string | null | undefined,
  readNumber?: string | null,
  prints: (card: MtgCard) => Promise<MtgCard[]> = c => getAllPrints(c, 60),
): Promise<MatchResult> {
  const card = result.card;
  if (!card || !borderContradicts(observed, card.border_color)) return result;
  const consistent = (await prints(card)).filter(p => String(p.border_color || '').toLowerCase() === String(observed).toLowerCase());
  // No printing of this card has the observed border: the observation is the likelier error
  // (a silver artifact frame read as "white" on a black-bordered Chrome Mox). Keep the link.
  if (consistent.length === 0) {
    console.log(`[MTG Matcher] Border witness: photo shows ${observed}, "${card.set_name}" is ${card.border_color}, but no ${observed}-bordered printing exists; link kept`);
    return { ...result, confidence: { ...result.confidence, warnings: [...result.confidence.warnings, `Border read as ${observed} but no ${observed}-bordered printing of this card exists; link kept`] } };
  }
  const wanted = readNumber ? normalizeCollectorNumber(readNumber) : '';
  const byNumber = wanted ? consistent.filter(p => normalizeCollectorNumber(String(p.collector_number || '')) === wanted) : [];
  const pick = byNumber.length === 1 ? byNumber[0] : consistent.length === 1 ? consistent[0] : null;
  const note = `Border witness: the photo shows a ${observed} border, "${card.set_name}" is ${card.border_color}-bordered`;
  if (pick) {
    console.log(`[MTG Matcher] ${note}; re-picked ${pick.set_name} #${pick.collector_number}`);
    return {
      card: pick, score: 0.9,
      confidence: { ...result.confidence, setCodeMatched: false, setCodeScore: 0, overallConfidence: byNumber.length === 1 ? 'high' : 'medium', warnings: [...result.confidence.warnings, `${note}; re-picked "${pick.set_name}"`] },
    };
  }
  console.log(`[MTG Matcher] ${note}; ${consistent.length} ${observed}-bordered printings, none chosen`);
  return {
    card: null, score: 0.4,
    confidence: { ...result.confidence, overallConfidence: 'low', warnings: [...result.confidence.warnings, `${note}; ${consistent.length} printings with a ${observed} border`] },
    printCandidates: consistent.length > 1 ? consistent : undefined,
  };
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

    // Name match - weight 3 (also check flavor_name for crossover cards)
    if (aiIdentification.name) {
      let nameScore = calculateSimilarity(card.name, aiIdentification.name);
      // If flavor_name exists and gives a better match, use that score
      if (card.flavor_name) {
        const flavorScore = calculateSimilarity(card.flavor_name, aiIdentification.name);
        nameScore = Math.max(nameScore, flavorScore);
      }
      score += nameScore * 3;
      factors += 3;
      confidence.nameScore = nameScore;
      confidence.nameMatched = nameScore >= 0.7;
      if (nameScore < 0.5) {
        confidence.warnings.push(`Name mismatch: "${aiIdentification.name}" vs "${card.name}"${card.flavor_name ? ` / "${card.flavor_name}"` : ''}`);
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

  // Strategy 1: Direct set code + collector number lookup
  // IMPORTANT: Must validate name to prevent misidentification (e.g., wrong set code → wrong card)
  if (setCode && collectorNumber) {
    const directMatch = await lookupBySetAndNumber(setCode, collectorNumber);
    if (directMatch) {
      // Validate name against AI-extracted name (prevents wrong card from number-only matches)
      let nameScore = 1.0;
      let nameMatched = true;
      const warnings: string[] = [];

      if (name) {
        nameScore = calculateSimilarity(directMatch.name, name);
        // Also check flavor_name for crossover cards (Universes Beyond, Secret Lair)
        if (directMatch.flavor_name) {
          const flavorScore = calculateSimilarity(directMatch.flavor_name, name);
          nameScore = Math.max(nameScore, flavorScore);
        }
        nameMatched = nameScore >= 0.5;

        if (nameScore < 0.35) {
          // Name is very different — this is likely a wrong card
          console.log(`[MTG Matcher] Direct set/number match REJECTED: name mismatch "${name}" vs "${directMatch.name}" (score: ${nameScore.toFixed(2)})`);
          // Fall through to Strategy 1b and beyond
        } else {
          const confidence: 'high' | 'medium' | 'low' = nameScore >= 0.65 ? 'high' : 'medium';
          if (!nameMatched) {
            warnings.push(`Name partially matched: "${name}" vs "${directMatch.name}" (score: ${nameScore.toFixed(2)})`);
          }
          console.log(`[MTG Matcher] Direct set/number match found: ${directMatch.name} (name score: ${nameScore.toFixed(2)}, confidence: ${confidence})`);
          return {
            card: directMatch,
            score: nameScore >= 0.65 ? 1.0 : 0.85,
            confidence: {
              setCodeMatched: true,
              setCodeScore: 1.0,
              numberMatched: true,
              numberScore: 1.0,
              nameMatched,
              nameScore,
              overallConfidence: confidence,
              matchedFeatures: nameMatched ? 3 : 2,
              totalFeatures: 3,
              warnings
            }
          };
        }
      } else {
        // No AI name to validate against — trust set/number match with medium confidence
        console.log(`[MTG Matcher] Direct set/number match found (no name to validate): ${directMatch.name}`);
        return {
          card: directMatch,
          score: 0.85,
          confidence: {
            setCodeMatched: true,
            setCodeScore: 1.0,
            numberMatched: true,
            numberScore: 1.0,
            nameMatched: false,
            nameScore: 0,
            overallConfidence: 'medium',
            matchedFeatures: 2,
            totalFeatures: 3,
            warnings: ['No AI card name provided for validation']
          }
        };
      }
    }
    // Strategy 1a-rescue: single-digit misread. If the name matches cards in
    // the claimed set and EXACTLY ONE of them has a collector number one
    // character off from the AI's number, correct to it (OCR-class misread).
    if (name) {
      const setCandidates = await searchByNameAndSetCode(name, setCode, 25);
      const variant = findUniqueDigitVariant(
        setCandidates,
        c => normalizeCollectorNumber(c.collector_number),
        normalizeCollectorNumber(collectorNumber)
      );
      if (variant) {
        console.log(`[MTG Matcher] 🔢 Digit-misread corrected: "${collectorNumber}" → "${variant.collector_number}" (${variant.name}, ${variant.set_name})`);
        return {
          card: variant,
          score: 0.9,
          confidence: {
            setCodeMatched: true,
            setCodeScore: 1.0,
            numberMatched: true,
            numberScore: 0.9,
            nameMatched: true,
            nameScore: 1.0,
            overallConfidence: 'high',
            matchedFeatures: 3,
            totalFeatures: 3,
            warnings: [`Collector number corrected from "${collectorNumber}" to "${variant.collector_number}" (single-digit misread; name and set matched)`]
          }
        };
      }
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
      // If only one result AND the AI gave no name, use it with medium confidence.
      // Aug 25 2026: when a name WAS given and scored low above, falling through
      // here returned a name-contradicting card at medium, which the route applies
      // (renamed customer cards in the Yu-Gi-Oh equivalent). Name disagreement ends here.
      if (name) {
        console.log(`[MTG Matcher] number-only candidate(s) rejected: name "${name}" does not match ${numberResults.map(r => r.name).slice(0, 3).join(' / ')}`);
      } else if (numberResults.length === 1) {
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

  // Strategy 1n (Oct 2026): name + printed collector number across every set.
  // Exactly one printing with that number wins, whatever set the grader named;
  // several printings share the number only when the claimed set picks one.
  if (name && collectorNumber) {
    const byNumber = await printingsByNameAndNumber(name, collectorNumber);
    const chosen = byNumber.length === 1 ? byNumber[0]
      : byNumber.length > 1 && setName ? (byNumber.filter(c => setNamesAgree(setName, c.set_name)).length === 1 ? byNumber.find(c => setNamesAgree(setName, c.set_name))! : null)
      : null;
    // A misread digit must not move the card to another set: when the claimed set holds a
    // printing of this name whose number is one character off the read, that printing wins
    // (Lightning Bolt read "149" in Magic 2010 is M10 #146, not Magic 2011 #149).
    if (chosen && setName && !setNamesAgree(setName, chosen.set_name)) {
      const inClaimed = (await searchByNameAndSet(name, setName, 25)).filter(c => Math.max(fuzzyNameScore(name, c.name), c.flavor_name ? fuzzyNameScore(name, c.flavor_name) : 0) >= 0.85);
      const variant = findUniqueDigitVariant(inClaimed, c => normalizeCollectorNumber(String(c.collector_number || '')), normalizeCollectorNumber(collectorNumber));
      if (variant) {
        console.log(`[MTG Matcher] Number witness deferred to the claimed set: "${collectorNumber}" is one digit off ${variant.set_name} #${variant.collector_number}`);
        return {
          card: variant, score: 0.9,
          confidence: { setCodeMatched: false, setCodeScore: 0.9, numberMatched: true, numberScore: 0.9, nameMatched: true, nameScore: 1, overallConfidence: 'high', matchedFeatures: 3, totalFeatures: 3,
            warnings: [`Collector number corrected from "${collectorNumber}" to "${variant.collector_number}" (single-digit misread; name and set matched)`] },
        };
      }
    }
    if (chosen) {
      const nameScore = Math.max(fuzzyNameScore(name, chosen.name), chosen.flavor_name ? fuzzyNameScore(name, chosen.flavor_name) : 0);
      const warnings: string[] = [];
      if (setName && !setNamesAgree(setName, chosen.set_name)) warnings.push(`AI set "${setName}" was incorrect; collector number ${collectorNumber} names "${chosen.set_name}"`);
      if (nameScore < 1) warnings.push(`Name corrected from "${name}" to "${chosen.name}" (fuzzy match ${nameScore.toFixed(2)})`);
      console.log(`[MTG Matcher] Number witness: ${chosen.name} #${chosen.collector_number} (${chosen.set_name})${warnings.length ? ' - ' + warnings.join('; ') : ''}`);
      return {
        card: chosen,
        score: 0.95,
        confidence: {
          setCodeMatched: !!setCode && normalizeSetCode(setCode) === chosen.set_code, setCodeScore: setCode ? (normalizeSetCode(setCode) === chosen.set_code ? 1 : 0) : 0,
          numberMatched: true, numberScore: 1,
          nameMatched: true, nameScore,
          overallConfidence: 'high',
          matchedFeatures: 2 + (setName && setNamesAgree(setName, chosen.set_name) ? 1 : 0), totalFeatures: 3,
          warnings,
        },
      };
    }
  }

  // Strategy 1c (Sept 2026): no set code, but a name and a set NAME. Old-frame
  // cards (Tempest, Urza's block, Planeshift, Judgment...) print no set code, so
  // the grader and the owner supply the set by name. Searching the collector
  // number across every set first returned an unrelated card at low confidence
  // ("Snap" #43 -> Lakeshore Apothecary) and the name+set search never ran.
  // Take the card when exactly one printing of that name exists in that set, or
  // when the collector number picks one of several.
  if (!setCode && name && setName?.trim()) {
    const inSet = (await searchByNameAndSet(name.trim(), setName.trim()))
      .filter(c => Math.max(calculateSimilarity(c.name, name), c.flavor_name ? calculateSimilarity(c.flavor_name, name) : 0) >= 0.9);
    const byNumber = collectorNumber
      ? inSet.filter(c => normalizeCollectorNumber(c.collector_number) === normalizeCollectorNumber(collectorNumber))
      : [];
    const pick = inSet.length === 1 ? inSet[0] : byNumber.length === 1 ? byNumber[0] : null;
    if (pick) {
      console.log(`[MTG Matcher] Name + set-name match: ${pick.name} (${pick.set_name}) #${pick.collector_number}`);
      return {
        card: pick,
        score: 0.95,
        confidence: {
          setCodeMatched: false, setCodeScore: 0.9,
          numberMatched: byNumber.length === 1, numberScore: byNumber.length === 1 ? 1 : 0,
          nameMatched: true, nameScore: 1,
          overallConfidence: 'high',
          matchedFeatures: byNumber.length === 1 ? 3 : 2, totalFeatures: 3,
          warnings: inSet.length === 1 ? [] : [`${inSet.length} printings in the set; collector number chose one`],
        },
      };
    }
    if (inSet.length > 1) {
      console.log(`[MTG Matcher] Name + set-name: ${inSet.length} printings, number did not choose — continuing`);
    }
  }

  // Strategy 2: Search by collector number (if we have it but not set code)
  if (collectorNumber && !setCode) {
    const numberResults = await searchByCollectorNumber(collectorNumber);
    if (numberResults.length > 0) {
      // If we also have a name, use it to refine. A low-confidence pick across
      // every set is not a match: fall through to the name searches below
      // instead of returning it (it hid them for every set-code-less card).
      if (name) {
        const byNumber = findBestMatchWithConfidence(numberResults, {
          collectorNumber,
          name,
          set: setName
        });
        if (byNumber.card && byNumber.confidence.overallConfidence !== 'low') return byNumber;
      } else {
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
    // Fall back to name-only search (fuzzy when the exact name finds nothing, Oct 2026)
    searchResults = await searchByFuzzyName(name);
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
  const best = findBestMatchWithConfidence(searchResults, {
    setCode,
    collectorNumber,
    name,
    set: setName
  });

  // Name-only rescue: the name matched strongly but nothing (set/number) confirms
  // the specific PRINT. Vintage cards (no printed collector info) and comma-name
  // legends land here. Resolve via print count instead of discarding the match.
  if (
    best.card &&
    best.confidence.overallConfidence === 'low' &&
    best.confidence.nameScore >= 0.9
  ) {
    const prints = await getAllPrints(best.card);

    // The only catalog print must not contradict a set the card states. Sept 25:
    // "Cytoplast Manipulator" read as Teenage Mutant Ninja Turtles #5 was accepted
    // as the Dissension print, because the catalog has no TMNT printing yet.
    const statedSet = String(setName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const printSet = String(prints[0]?.set_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const setContradicts = !!statedSet && !!printSet && !statedSet.includes(printSet) && !printSet.includes(statedSet)
      && calculateSimilarity(statedSet, printSet) < 0.8;
    if (prints.length === 1 && setContradicts) {
      console.log(`[MTG Matcher] Single print ${prints[0].name} (${prints[0].set_name}) contradicts the stated set "${setName}" — not accepted`);
    } else if (prints.length === 1) {
      // Only one print exists — the name alone identifies the card completely
      console.log(`[MTG Matcher] Name-only match accepted (single print): ${prints[0].name} (${prints[0].set_name})`);
      return {
        card: prints[0],
        score: 0.8,
        confidence: {
          ...best.confidence,
          overallConfidence: 'medium',
          warnings: [...best.confidence.warnings, 'Matched by name only — single known print']
        }
      };
    }

    // Multiple prints — leave confidence low but surface the candidates so the
    // caller can run visual print disambiguation.
    console.log(`[MTG Matcher] Name matched but print ambiguous: ${best.card.name} has ${prints.length} prints`);
    return {
      ...best,
      printCandidates: prints,
      confidence: {
        ...best.confidence,
        warnings: [...best.confidence.warnings, `Name matched but print ambiguous (${prints.length} prints)`]
      }
    };
  }

  return best;
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
