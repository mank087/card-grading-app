// src/lib/onepieceCardMatcher.ts
// Fuzzy matching to find best One Piece card match from database results
// Used when AI scans a card and we need to verify/enhance with database info

import { supabaseServer } from './supabaseServer';

/**
 * One Piece card data from our local database
 */
export interface OnePieceCard {
  id: string;                    // Card ID: "OP01-001" or "OP01-001_parallel" for variants
  card_name: string;             // "Roronoa Zoro" (cleaned, without variant indicators)
  card_number: string;           // "001"
  set_id: string;                // "OP-01"
  set_name: string;              // "Romance Dawn"
  card_type: string | null;      // "Leader", "Character", "Event", "Stage"
  card_color: string | null;     // "Red", "Blue", etc.
  rarity: string | null;         // "L", "C", "UC", "R", "SR", "SEC", "SP"
  card_cost: number | null;      // Cost to play
  card_power: number | null;     // Power value
  life: number | null;           // Life (Leaders only)
  counter_amount: number | null; // Counter value
  attribute: string | null;      // "Slash", "Strike", etc.
  sub_types: string | null;      // Traits
  card_text: string | null;      // Abilities
  card_image: string | null;     // Image URL
  market_price: number | null;   // TCGPlayer price
  inventory_price: number | null;
  // Variant fields
  variant_type: string | null;   // "parallel", "manga", "alternate_art", "sp", etc. NULL = base card
  base_card_id: string | null;   // Links to base card ID (e.g., "OP01-001") for grouping variants
  original_name: string | null;  // Original API name with variant indicators
}

/**
 * Confidence flags tracking which features matched
 */
export interface MatchConfidenceFlags {
  cardIdMatched: boolean;
  cardIdScore: number;
  nameMatched: boolean;
  nameScore: number;
  setMatched: boolean;
  setScore: number;
  overallConfidence: 'high' | 'medium' | 'low';
  matchedFeatures: number;
  totalFeatures: number;
  warnings: string[];
}

/**
 * Lightweight summary of one row in a card-ID family (base + variants)
 * Used so the route can expose all printings without conflating their prices
 */
export interface OnePieceFamilyEntry {
  id: string;
  variant_type: string | null;
  market_price: number | null;
  image_url: string | null;
}

/**
 * Extended match result with confidence flags
 */
export interface MatchResult {
  card: OnePieceCard | null;
  score: number;
  confidence: MatchConfidenceFlags;
  /** All rows sharing the matched card's base card ID (base + alt-art/manga/parallel variants) */
  family?: OnePieceFamilyEntry[];
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
 * Normalize One Piece card ID to standard format
 * Handles variations like "OP01-001", "OP-01-001", "OP1-1", etc.
 */
export function normalizeCardId(cardId: string): string {
  if (!cardId) return '';

  // Remove spaces and convert to uppercase
  const normalized = cardId.toUpperCase().replace(/\s+/g, '');

  // Handle format like "OP01-001" or "OP-01-001"
  const match = normalized.match(/^([A-Z]+)-?(\d+)-(\d+[A-Za-z]?)$/);
  if (match) {
    const prefix = match[1];
    const setNum = match[2].padStart(2, '0');
    const cardNum = match[3].padStart(3, '0');
    return `${prefix}${setNum}-${cardNum}`;
  }

  return normalized;
}

/**
 * Look up a One Piece card directly by card ID
 * This is the most reliable method when AI extracts the card number
 * Returns the base card (non-variant) by default
 */
export async function lookupByCardId(cardId: string, includeVariants: boolean = false): Promise<OnePieceCard | null> {
  const supabase = supabaseServer();
  const normalizedId = normalizeCardId(cardId);

  // Try exact match first (base card)
  let query = supabase
    .from('onepiece_cards')
    .select('*')
    .or(`id.ilike.${normalizedId},base_card_id.ilike.${normalizedId}`);

  // If not including variants, prefer base card (variant_type is null)
  if (!includeVariants) {
    query = query.is('variant_type', null);
  }

  const { data, error } = await query
    .order('variant_type', { nullsFirst: true })
    .limit(1)
    .single();

  if (error || !data) {
    // Try partial match (in case of format variations)
    const { data: partialData } = await supabase
      .from('onepiece_cards')
      .select('*')
      .or(`id.ilike.%${cardId}%,base_card_id.ilike.%${cardId}%`)
      .order('variant_type', { nullsFirst: true })
      .limit(1)
      .single();

    return partialData as OnePieceCard | null;
  }

  return data as OnePieceCard;
}

/**
 * Get all variants of a card by its base card ID
 * Returns base card plus all variants, sorted by price (highest first)
 */
export async function getCardVariants(baseCardId: string): Promise<OnePieceCard[]> {
  const supabase = supabaseServer();
  const normalizedId = normalizeCardId(baseCardId);

  const { data, error } = await supabase
    .from('onepiece_cards')
    .select('*')
    .or(`id.eq.${normalizedId},base_card_id.eq.${normalizedId}`)
    .order('variant_type', { nullsFirst: true })
    .order('market_price', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('[OnePiece Matcher] Error fetching variants:', error.message);
    return [];
  }

  return (data || []) as OnePieceCard[];
}

/**
 * Look up a specific variant of a card
 */
export async function lookupCardVariant(
  baseCardId: string,
  variantType: string
): Promise<OnePieceCard | null> {
  const supabase = supabaseServer();
  const normalizedId = normalizeCardId(baseCardId);

  const { data, error } = await supabase
    .from('onepiece_cards')
    .select('*')
    .eq('base_card_id', normalizedId)
    .eq('variant_type', variantType)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data as OnePieceCard;
}

/**
 * Search for One Piece cards by name
 * By default returns only base cards (no variants) for cleaner search results
 */
export async function searchByName(
  name: string,
  limit: number = 10,
  includeVariants: boolean = false
): Promise<OnePieceCard[]> {
  const supabase = supabaseServer();

  let query = supabase
    .from('onepiece_cards')
    .select('*')
    .ilike('card_name', `%${name}%`);

  // By default, only return base cards (not variants)
  if (!includeVariants) {
    query = query.is('variant_type', null);
  }

  const { data, error } = await query
    .order('variant_type', { nullsFirst: true })
    .limit(limit);

  if (error) {
    console.error('[OnePiece Matcher] Search error:', error.message);
    return [];
  }

  return (data || []) as OnePieceCard[];
}

/**
 * Search for One Piece cards by name and set
 * By default returns only base cards (no variants)
 */
export async function searchByNameAndSet(
  name: string,
  setName: string,
  limit: number = 10,
  includeVariants: boolean = false
): Promise<OnePieceCard[]> {
  const supabase = supabaseServer();

  let query = supabase
    .from('onepiece_cards')
    .select('*')
    .ilike('card_name', `%${name}%`)
    .ilike('set_name', `%${setName}%`);

  // By default, only return base cards (not variants)
  if (!includeVariants) {
    query = query.is('variant_type', null);
  }

  const { data, error } = await query
    .order('variant_type', { nullsFirst: true })
    .limit(limit);

  if (error) {
    console.error('[OnePiece Matcher] Search error:', error.message);
    return [];
  }

  return (data || []) as OnePieceCard[];
}

/**
 * Find best matching card with confidence scoring
 */
export function findBestMatchWithConfidence(
  dbResults: OnePieceCard[],
  aiIdentification: {
    cardId?: string;
    name?: string;
    set?: string;
  }
): MatchResult {
  const emptyConfidence: MatchConfidenceFlags = {
    cardIdMatched: false,
    cardIdScore: 0,
    nameMatched: false,
    nameScore: 0,
    setMatched: false,
    setScore: 0,
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

  // If AI provided card ID, normalize it for comparison
  const normalizedAiCardId = aiIdentification.cardId
    ? normalizeCardId(aiIdentification.cardId)
    : null;

  // Score each result with detailed tracking
  const scored = dbResults.map(card => {
    let score = 0;
    let factors = 0;
    const confidence: MatchConfidenceFlags = { ...emptyConfidence, warnings: [] };

    // Card ID match (MOST important for One Piece) - weight 5
    if (normalizedAiCardId) {
      const normalizedDbId = normalizeCardId(card.id);
      const cardIdScore = calculateSimilarity(normalizedDbId, normalizedAiCardId);
      score += cardIdScore * 5;
      factors += 5;
      confidence.cardIdScore = cardIdScore;
      confidence.cardIdMatched = cardIdScore >= 0.9;
      if (cardIdScore < 0.7) {
        confidence.warnings.push(`Card ID mismatch: "${aiIdentification.cardId}" vs "${card.id}"`);
      }
    }

    // Name match - weight 3
    if (aiIdentification.name) {
      const nameScore = calculateSimilarity(card.card_name, aiIdentification.name);
      score += nameScore * 3;
      factors += 3;
      confidence.nameScore = nameScore;
      confidence.nameMatched = nameScore >= 0.8;
      if (nameScore < 0.5) {
        confidence.warnings.push(`Name mismatch: "${aiIdentification.name}" vs "${card.card_name}"`);
      }
    }

    // Set match - weight 2
    if (aiIdentification.set && card.set_name) {
      const setScore = calculateSimilarity(card.set_name, aiIdentification.set);
      score += setScore * 2;
      factors += 2;
      confidence.setScore = setScore;
      confidence.setMatched = setScore >= 0.7;
      if (setScore < 0.5) {
        confidence.warnings.push(`Set mismatch: "${aiIdentification.set}" vs "${card.set_name}"`);
      }
    }

    // Calculate matched features count
    let matchedFeatures = 0;
    let totalFeatures = 0;
    if (normalizedAiCardId) { totalFeatures++; if (confidence.cardIdMatched) matchedFeatures++; }
    if (aiIdentification.name) { totalFeatures++; if (confidence.nameMatched) matchedFeatures++; }
    if (aiIdentification.set) { totalFeatures++; if (confidence.setMatched) matchedFeatures++; }

    confidence.matchedFeatures = matchedFeatures;
    confidence.totalFeatures = totalFeatures;

    // Determine overall confidence
    const matchRatio = totalFeatures > 0 ? matchedFeatures / totalFeatures : 0;

    // Card ID match is most important for One Piece
    if (confidence.cardIdMatched) {
      confidence.overallConfidence = 'high';
    } else if (matchRatio >= 0.7) {
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

  console.log('[OnePiece Matcher] Top 3 matches:');
  scored.slice(0, 3).forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.card.id}: ${result.card.card_name} (${result.card.set_name}) - Score: ${result.score.toFixed(2)}, Confidence: ${result.confidence.overallConfidence}`);
    if (result.confidence.warnings.length > 0) {
      result.confidence.warnings.forEach(w => console.log(`     ⚠️ ${w}`));
    }
  });

  // Return best match
  return scored[0];
}

/**
 * Map full card rows to lightweight family entries (id / variant / price / image only)
 * so callers can expose every printing without conflating their prices.
 */
function toFamilyEntries(rows: OnePieceCard[]): OnePieceFamilyEntry[] {
  return rows.map(row => ({
    id: row.id,
    variant_type: row.variant_type,
    market_price: row.market_price,
    image_url: row.card_image
  }));
}

// Common shorthand tokens normalized to the canonical variant_type vocabulary
const VARIANT_TOKEN_SYNONYMS: Record<string, string> = {
  alt: 'alternate',
  aa: 'alternate',
  alternative: 'alternate'
};

// Tokens too generic to identify a variant on their own (e.g. "art" alone must not match "alternate_art")
const GENERIC_VARIANT_TOKENS = new Set(['art', 'card', 'version', 'rare', 'holo', 'foil']);

function tokenizeVariantText(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(token => VARIANT_TOKEN_SYNONYMS[token] || token);
}

/**
 * Resolve a variant row from a family using an AI-extracted hint (e.g. "Alternate Art",
 * "Manga", "Special Parallel"). Case-insensitive token match against variant_type values.
 * Returns null when the hint is absent or matches no variant (caller keeps the base row).
 */
function resolveVariantFromHint(
  familyRows: OnePieceCard[],
  variantHint?: string
): OnePieceCard | null {
  if (!variantHint) return null;

  const hintTokens = new Set(tokenizeVariantText(variantHint));
  if (hintTokens.size === 0) return null;

  let best: OnePieceCard | null = null;
  let bestOverlap = 0;

  for (const row of familyRows) {
    if (!row.variant_type) continue; // base row is the default; hints only select variant rows

    const typeTokens = tokenizeVariantText(row.variant_type);
    const distinctiveTokens = typeTokens.filter(t => !GENERIC_VARIANT_TOKENS.has(t));

    // Require at least one distinctive token match to avoid false positives on generic words
    if (!distinctiveTokens.some(t => hintTokens.has(t))) continue;

    const overlap = typeTokens.filter(t => hintTokens.has(t)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = row;
    }
  }

  return best;
}

/**
 * Fetch the full family for a matched card (base + ALL variant rows — no variant_type filter)
 * and select which row to return: the hinted variant if resolvable, otherwise the base row.
 * Each returned row keeps its OWN market_price — a variant's price is never attached to base
 * or vice versa.
 */
async function buildFamilyAndSelect(
  matchedCard: OnePieceCard,
  variantHint?: string
): Promise<{ family: OnePieceFamilyEntry[]; selected: OnePieceCard }> {
  const baseCardId = matchedCard.base_card_id || matchedCard.id;
  const familyRows = await getCardVariants(baseCardId);
  const rows = familyRows.length > 0 ? familyRows : [matchedCard];

  const baseRow = rows.find(row => row.variant_type === null) || matchedCard;
  const variantRow = resolveVariantFromHint(rows, variantHint);

  return {
    family: toFamilyEntries(rows),
    selected: variantRow || baseRow
  };
}

/**
 * Main lookup function: Find a One Piece card from AI-extracted info
 * Tries card ID first (most reliable), then falls back to name search
 *
 * @param variantHint AI-extracted rarity/variant text (e.g. "Alternate Art", "Manga",
 *                    "Parallel") used to select the correct printing within a card-ID family
 */
export async function lookupOnePieceCard(
  aiIdentification: {
    cardId?: string;
    name?: string;
    set?: string;
  },
  variantHint?: string
): Promise<MatchResult> {
  console.log('[OnePiece Matcher] Looking up card:', aiIdentification, variantHint ? `(variant hint: "${variantHint}")` : '');

  // Strategy 1: Direct card ID lookup (most reliable)
  // IMPORTANT: name must be cross-checked — a misread card number must not become a
  // confident wrong identity (mirrors mtgCardMatcher's nameScore < 0.35 rejection)
  let rejectedDirectMatch: OnePieceCard | null = null;
  let rejectedNameScore = 0;

  if (aiIdentification.cardId) {
    const directMatch = await lookupByCardId(aiIdentification.cardId);
    if (directMatch) {
      if (!aiIdentification.name) {
        // No AI name available to validate — accept, but never at full confidence
        const { family, selected } = await buildFamilyAndSelect(directMatch, variantHint);
        console.log(`[OnePiece Matcher] Direct card ID match found: ${selected.id} (no AI name to validate — medium confidence)`);
        return {
          card: selected,
          score: 0.85,
          confidence: {
            cardIdMatched: true,
            cardIdScore: 1.0,
            nameMatched: false,
            nameScore: 0,
            setMatched: false,
            setScore: 0,
            overallConfidence: 'medium',
            matchedFeatures: 1,
            totalFeatures: 3,
            warnings: ['No AI card name provided for validation']
          },
          family
        };
      }

      const nameScore = calculateSimilarity(directMatch.card_name, aiIdentification.name);
      const nameMatched = nameScore >= 0.5;

      if (nameScore < 0.35) {
        // Name is very different — likely a misread card number. Fall through to name/set strategies.
        console.log(`[OnePiece Matcher] Direct card ID match REJECTED: name mismatch "${aiIdentification.name}" vs "${directMatch.card_name}" (score: ${nameScore.toFixed(2)})`);
        rejectedDirectMatch = directMatch;
        rejectedNameScore = nameScore;
      } else {
        const warnings: string[] = [];
        if (!nameMatched) {
          warnings.push(`Name partially matched: "${aiIdentification.name}" vs "${directMatch.card_name}" (score: ${nameScore.toFixed(2)})`);
        }
        const overallConfidence: 'high' | 'medium' = nameScore >= 0.65 ? 'high' : 'medium';
        const { family, selected } = await buildFamilyAndSelect(directMatch, variantHint);
        console.log(`[OnePiece Matcher] Direct card ID match found: ${selected.id}${selected.variant_type ? ` (variant: ${selected.variant_type})` : ' (base)'} — family size: ${family.length}, name score: ${nameScore.toFixed(2)}, confidence: ${overallConfidence}`);
        return {
          card: selected,
          score: nameScore >= 0.65 ? 1.0 : 0.85,
          confidence: {
            cardIdMatched: true,
            cardIdScore: 1.0,
            nameMatched,
            nameScore,
            setMatched: true,
            setScore: 1.0,
            overallConfidence,
            matchedFeatures: nameMatched ? 3 : 2,
            totalFeatures: 3,
            warnings
          },
          family
        };
      }
    }
  }

  // Strategy 2: Search by name and set
  let searchResults: OnePieceCard[] = [];

  if (aiIdentification.name && aiIdentification.set) {
    searchResults = await searchByNameAndSet(aiIdentification.name, aiIdentification.set);
  } else if (aiIdentification.name) {
    searchResults = await searchByName(aiIdentification.name);
  }

  // Low-confidence fallback for a name-rejected direct card-ID match:
  // return it so the caller can see it, but flag it so it is NOT trusted as identity
  const buildRejectedLowResult = (): MatchResult => ({
    card: rejectedDirectMatch,
    score: 0.3,
    confidence: {
      cardIdMatched: true,
      cardIdScore: 1.0,
      nameMatched: false,
      nameScore: rejectedNameScore,
      setMatched: false,
      setScore: 0,
      overallConfidence: 'low',
      matchedFeatures: 1,
      totalFeatures: 3,
      warnings: [
        `Card ID matched but name mismatch: "${aiIdentification.name}" vs "${rejectedDirectMatch!.card_name}" (score: ${rejectedNameScore.toFixed(2)}) — identity not trusted`
      ]
    }
  });

  if (searchResults.length === 0) {
    if (rejectedDirectMatch) {
      console.log('[OnePiece Matcher] No name/set matches — returning name-rejected direct match at LOW confidence');
      return buildRejectedLowResult();
    }
    console.log('[OnePiece Matcher] No matches found');
    return {
      card: null,
      score: 0,
      confidence: {
        cardIdMatched: false,
        cardIdScore: 0,
        nameMatched: false,
        nameScore: 0,
        setMatched: false,
        setScore: 0,
        overallConfidence: 'low',
        matchedFeatures: 0,
        totalFeatures: 0,
        warnings: ['No matching cards found in database']
      }
    };
  }

  // Find best match with confidence scoring
  const bestMatch = findBestMatchWithConfidence(searchResults, aiIdentification);

  if (bestMatch.card && bestMatch.confidence.overallConfidence !== 'low') {
    // Attach the full printing family and resolve the hinted variant for accepted matches
    const { family, selected } = await buildFamilyAndSelect(bestMatch.card, variantHint);
    return { ...bestMatch, card: selected, family };
  }

  // Nothing better than the rejected direct match — surface it at low confidence with a warning
  if (rejectedDirectMatch) {
    console.log('[OnePiece Matcher] Name/set strategies found nothing better — returning name-rejected direct match at LOW confidence');
    return buildRejectedLowResult();
  }

  return bestMatch;
}

/**
 * Get all cards from a specific set
 * By default returns only base cards (no variants)
 */
export async function getCardsFromSet(
  setId: string,
  includeVariants: boolean = false
): Promise<OnePieceCard[]> {
  const supabase = supabaseServer();

  let query = supabase
    .from('onepiece_cards')
    .select('*')
    .ilike('set_id', `%${setId}%`);

  // By default, only return base cards (not variants)
  if (!includeVariants) {
    query = query.is('variant_type', null);
  }

  const { data, error } = await query
    .order('card_number', { ascending: true })
    .order('variant_type', { nullsFirst: true });

  if (error) {
    console.error('[OnePiece Matcher] Error fetching set cards:', error.message);
    return [];
  }

  return (data || []) as OnePieceCard[];
}
