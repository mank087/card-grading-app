/**
 * Sports Card Local Database Matcher (WS2 / WS2b)
 *
 * Matches a graded card's AI-extracted identity against the local
 * sports_card_products / sports_sets tables (imported from the
 * SportsCardsPro CSV price guide by scripts/import-sports-database.js).
 *
 * Replaces the live SportsCardsPro text-search matching for sports cards:
 * - Exact card-number equality (no substring false positives: #4 vs #40)
 * - Insert/subset names participate in matching (variant_text)
 * - Serial denominator auto-disambiguation (/75 -> unique parallel)
 * - Family model: all rows sharing (set_uid, card_number) are the base card
 *   plus its parallels — powers the parallel picker and visual disambiguation
 *
 * Tiers (WS2b):
 * - exact:  a single product pinned down (serial / variant / only candidate)
 * - family: set + number + player confirmed; parallel ambiguous (base-biased)
 * - none:   no acceptable match in the local DB
 */

import { supabaseServer } from './supabaseServer';
import type { NormalizedPrices } from './priceCharting';

// ============================================================================
// Types
// ============================================================================

export interface SportsProductRow {
  id: string;
  product_name: string;
  console_name: string;
  set_uid: string | null;
  player_name: string | null;
  card_number: string | null;
  variant_text: string | null;
  serial_denominator: number | null;
  is_rookie: boolean | null;
  loose_price: number | null;
  cib_price: number | null;
  new_price: number | null;
  graded_price: number | null;
  box_only_price: number | null;
  manual_only_price: number | null;
  bgs_10_price: number | null;
  condition_17_price: number | null;
  condition_18_price: number | null;
  sales_volume: number | null;
  release_date: string | null;
}

export interface SportsSetRow {
  uid: string;
  console_name: string;
  sport: string | null;
  year: number | null;
  manufacturer: string | null;
  set_name: string | null;
}

export interface LocalSportsMatchParams {
  playerName: string;
  year?: string;
  setName?: string;
  cardNumber?: string;
  variant?: string;          // parallel color/type (e.g. "Silver Prizm")
  subset?: string;           // insert name (e.g. "Downtown", "Kaboom") — WS2.2
  serialNumbering?: string;  // "23/75" or "/99"
  rookie?: boolean;
  sport?: string;            // card category
}

export interface LocalSportsMatchResult {
  tier: 'exact' | 'family' | 'none';
  confidence: 'high' | 'medium' | 'low' | 'none';
  product: SportsProductRow | null;   // the chosen row (base-biased when ambiguous)
  family: SportsProductRow[];         // all parallels sharing set+number (incl. product)
  matchedSet: SportsSetRow | null;
  defaultedToBase: boolean;           // true when parallel was ambiguous and we chose base
  variantNotFound: boolean;           // AI named a parallel that doesn't exist in the family
  notes: string[];
}

// ============================================================================
// Availability probe (table may not be imported yet -> callers fall back to API)
// ============================================================================

let availabilityCache: { available: boolean; checkedAt: number } | null = null;
const AVAILABILITY_TTL_MS = 10 * 60 * 1000;

/**
 * Whether the local sports product table is available for matching/pricing.
 *
 * DISABLED BY DEFAULT (Jul 2026): the full SportsCardsPro mirror is 6.1M+ rows
 * (~5-7GB with trigram indexes) and blew the Supabase storage budget, so the
 * `sports_card_products` table was dropped and sports matching/pricing reverted
 * to the live SportsCardsPro API (see searchSportsCardPrices' API path).
 *
 * To re-enable a (slimmed) local DB later, set SPORTS_LOCAL_DB_ENABLED=true.
 */
export async function isSportsLocalDbAvailable(): Promise<boolean> {
  if (process.env.SPORTS_LOCAL_DB_ENABLED !== 'true') return false;
  const now = Date.now();
  if (availabilityCache && now - availabilityCache.checkedAt < AVAILABILITY_TTL_MS) {
    return availabilityCache.available;
  }
  try {
    const { data, error } = await supabaseServer()
      .from('sports_card_products')
      .select('id')
      .limit(1);
    const available = !error && !!data && data.length > 0;
    availabilityCache = { available, checkedAt: now };
    return available;
  } catch {
    availabilityCache = { available: false, checkedAt: now };
    return false;
  }
}

// ============================================================================
// Normalization helpers
// ============================================================================

const SPORTS = ['hockey', 'baseball', 'basketball', 'football', 'soccer', 'wrestling', 'golf', 'tennis', 'ufc', 'boxing', 'racing'];

function normalizeSport(sport: string | undefined): string | null {
  if (!sport) return null;
  const lower = sport.toLowerCase();
  if (SPORTS.includes(lower)) return lower;
  for (const s of SPORTS) {
    if (lower.includes(s)) return s; // "Sports - Basketball", "basketball card"
  }
  return null; // generic "sports" -> no sport filter
}

/** "2023-24" -> 2023; "1986" -> 1986 */
function parseYear(year: string | undefined): number | null {
  if (!year) return null;
  const m = String(year).match(/\b((?:19|20)\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

/** Match the import script: uppercase, strip #/NO. prefixes and leading zeros */
export function normalizeCardNumber(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^#/, '')
    .replace(/^NO\.?\s*/i, '')
    .replace(/^NUMBER\.?\s*/i, '')
    .replace(/^NUM\.?\s*/i, '')
    .trim()
    .toUpperCase()
    .replace(/\b0+(\d)/g, '$1');
  return cleaned || null;
}

function extractSerialDenominator(serialNumbering: string | undefined): number | null {
  if (!serialNumbering) return null;
  const m = String(serialNumbering).match(/\/\s?(\d{1,5})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(\b\w)\s+(?=\w\b)/g, '$1')
    .trim();
}

/** Words that carry no set identity */
const SET_STOPWORDS = new Set([
  'cards', 'card', 'the', 'and', '&', ...SPORTS,
]);

function setNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !SET_STOPWORDS.has(t) && !/^(19|20)\d{2}$/.test(t));
}

function variantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\bprizm\b|\brefractor\b|\bparallel\b/g, ' ') // brand noise words
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

/**
 * Player-name check mirroring the legacy scorer: significant parts of the
 * AI player name must appear in the product's player name.
 */
function playerMatches(aiPlayer: string, productPlayer: string | null, productName: string): boolean {
  const target = normalizeForComparison(productPlayer || productName);
  const parts = normalizeForComparison(aiPlayer).split(/\s+/).filter(p => p.length > 1);
  if (parts.length === 0) return false;
  const required = parts.length <= 2 ? parts.length : Math.min(3, Math.ceil(parts.length / 2));
  const matching = parts.filter(p => target.includes(p));
  return matching.length >= required;
}

// ============================================================================
// Set candidate selection
// ============================================================================

function scoreSet(set: SportsSetRow, aiTokens: string[], aiYear: number | null): number {
  let score = 0;
  const setTokens = new Set(setNameTokens(set.console_name));
  for (const t of aiTokens) {
    if (setTokens.has(t)) score += 3;
  }
  if (aiYear && set.year === aiYear) score += 5;
  else if (aiYear && set.year && Math.abs(set.year - aiYear) === 1) score += 2; // season straddle
  return score;
}

async function findCandidateSets(
  params: LocalSportsMatchParams,
  notes: string[]
): Promise<Array<SportsSetRow & { score: number }>> {
  const sport = normalizeSport(params.sport);
  const year = parseYear(params.year);
  const aiTokens = params.setName ? setNameTokens(params.setName) : [];

  let query = supabaseServer()
    .from('sports_sets')
    .select('uid, console_name, sport, year, manufacturer, set_name');
  if (sport) query = query.eq('sport', sport);
  if (year) query = query.gte('year', year - 1).lte('year', year + 1);

  const { data, error } = await query.limit(2000);
  if (error || !data) {
    notes.push(`sets query failed: ${error?.message}`);
    return [];
  }

  const scored = (data as SportsSetRow[])
    .map(s => ({ ...s, score: scoreSet(s, aiTokens, year) }))
    .filter(s => (aiTokens.length > 0 ? s.score > 3 : true)) // require real set-name overlap when AI named a set
    .sort((a, b) => b.score - a.score);

  // Without a set name we can't rank meaningfully — allow sport+year cohort
  // (player+number will disambiguate), but cap it.
  const cap = aiTokens.length > 0 ? 8 : 40;
  return scored.slice(0, cap);
}

// ============================================================================
// Family disambiguation
// ============================================================================

function pickWithinFamily(
  family: SportsProductRow[],
  params: LocalSportsMatchParams,
  notes: string[]
): { product: SportsProductRow | null; tier: 'exact' | 'family'; confidence: 'high' | 'medium' | 'low'; defaultedToBase: boolean; variantNotFound: boolean } {
  const serial = extractSerialDenominator(params.serialNumbering);
  const baseRow = family.find(f => !f.variant_text) || null;

  // 1. Serial denominator: strongest signal — print runs are unique per parallel
  if (serial) {
    const serialMatches = family.filter(f => f.serial_denominator === serial);
    if (serialMatches.length === 1) {
      notes.push(`serial /${serial} pinned parallel`);
      return { product: serialMatches[0], tier: 'exact', confidence: 'high', defaultedToBase: false, variantNotFound: false };
    }
    if (serialMatches.length > 1) {
      notes.push(`serial /${serial} matches ${serialMatches.length} rows`);
      return { product: serialMatches[0], tier: 'family', confidence: 'medium', defaultedToBase: false, variantNotFound: false };
    }
    notes.push(`serial /${serial} not found in family`);
  }

  // 2. Variant/subset text: exact then token-overlap match against variant_text
  const wanted = [params.subset, params.variant].filter(Boolean).join(' ').trim();
  if (wanted) {
    const wantedNorm = wanted.toLowerCase().replace(/\s+/g, ' ').trim();
    const exact = family.filter(f => f.variant_text && f.variant_text.toLowerCase().trim() === wantedNorm);
    if (exact.length === 1) {
      return { product: exact[0], tier: 'exact', confidence: 'high', defaultedToBase: false, variantNotFound: false };
    }
    const wantedTokens = variantTokens(wanted);
    if (wantedTokens.length > 0) {
      const scoredVariants = family
        .filter(f => f.variant_text)
        .map(f => {
          const rowTokens = new Set(variantTokens(f.variant_text!));
          const hits = wantedTokens.filter(t => rowTokens.has(t)).length;
          return { row: f, hits, extra: rowTokens.size - hits };
        })
        .filter(v => v.hits > 0)
        .sort((a, b) => b.hits - a.hits || a.extra - b.extra);
      if (scoredVariants.length > 0) {
        const best = scoredVariants[0];
        const tie = scoredVariants.filter(v => v.hits === best.hits && v.extra === best.extra);
        if (tie.length === 1 && best.hits === wantedTokens.length) {
          return { product: best.row, tier: 'exact', confidence: 'high', defaultedToBase: false, variantNotFound: false };
        }
        notes.push(`variant "${wanted}" ambiguous across ${scoredVariants.length} parallels`);
        return { product: best.row, tier: 'family', confidence: 'medium', defaultedToBase: false, variantNotFound: false };
      }
    }
    // AI named a parallel that doesn't exist in this family: base-biased,
    // flagged — never silently claim a premium parallel (WS2c.3 principle).
    notes.push(`variant "${wanted}" not found in family — defaulting to base`);
    return { product: baseRow || family[0], tier: 'family', confidence: 'low', defaultedToBase: true, variantNotFound: true };
  }

  // 3. No variant info: base-biased default
  if (family.length === 1) {
    return { product: family[0], tier: 'exact', confidence: 'high', defaultedToBase: false, variantNotFound: false };
  }
  if (baseRow) {
    return { product: baseRow, tier: 'family', confidence: family.length > 1 ? 'medium' : 'high', defaultedToBase: true, variantNotFound: false };
  }
  return { product: family[0], tier: 'family', confidence: 'low', defaultedToBase: true, variantNotFound: false };
}

// ============================================================================
// Main matcher
// ============================================================================

export async function matchSportsCardLocal(params: LocalSportsMatchParams): Promise<LocalSportsMatchResult> {
  const notes: string[] = [];
  const none: LocalSportsMatchResult = {
    tier: 'none', confidence: 'none', product: null, family: [],
    matchedSet: null, defaultedToBase: false, variantNotFound: false, notes,
  };

  if (!params.playerName) {
    notes.push('no player name');
    return none;
  }

  const sets = await findCandidateSets(params, notes);
  if (sets.length === 0) {
    notes.push('no candidate sets');
    return none;
  }
  const setUids = sets.map(s => s.uid);
  const cardNumber = normalizeCardNumber(params.cardNumber);

  // Primary: exact card-number equality within candidate sets
  let rows: SportsProductRow[] = [];
  if (cardNumber) {
    const { data, error } = await supabaseServer()
      .from('sports_card_products')
      .select('*')
      .in('set_uid', setUids)
      .eq('card_number', cardNumber)
      .limit(500);
    if (error) notes.push(`products query failed: ${error.message}`);
    rows = (data as SportsProductRow[]) || [];
  }

  // Fallback: player-name search within candidate sets (no/wrong number)
  if (rows.length === 0) {
    const lastName = normalizeForComparison(params.playerName).split(/\s+/).pop() || params.playerName;
    const { data, error } = await supabaseServer()
      .from('sports_card_products')
      .select('*')
      .in('set_uid', setUids)
      .ilike('player_name', `%${lastName}%`)
      .limit(500);
    if (error) notes.push(`player fallback query failed: ${error.message}`);
    rows = (data as SportsProductRow[]) || [];
    if (cardNumber && rows.length > 0) {
      notes.push(`card number ${cardNumber} not found; matched via player name`);
    }
  }

  // Player validation (hard filter, mirrors legacy scorer)
  const playerRows = rows.filter(r => playerMatches(params.playerName, r.player_name, r.product_name));
  if (playerRows.length === 0) {
    notes.push(`no rows passed player check (${rows.length} candidates)`);
    return none;
  }

  // Choose the best set among survivors: set score, then sales volume depth
  const bySet = new Map<string, SportsProductRow[]>();
  for (const r of playerRows) {
    if (!r.set_uid) continue;
    if (!bySet.has(r.set_uid)) bySet.set(r.set_uid, []);
    bySet.get(r.set_uid)!.push(r);
  }
  if (bySet.size === 0) return none;

  const setScoreByUid = new Map(sets.map(s => [s.uid, s.score]));
  const rankedSets = [...bySet.entries()].sort((a, b) => {
    const scoreDiff = (setScoreByUid.get(b[0]) || 0) - (setScoreByUid.get(a[0]) || 0);
    if (scoreDiff !== 0) return scoreDiff;
    const volume = (rowsArr: SportsProductRow[]) => Math.max(...rowsArr.map(r => r.sales_volume || 0));
    return volume(b[1]) - volume(a[1]);
  });
  const [chosenUid, familyRows] = rankedSets[0];
  const matchedSet = sets.find(s => s.uid === chosenUid) || null;

  // Family = same card number within the chosen set. When we matched via the
  // player fallback the rows may span several numbers — group by the modal
  // number to avoid mixing different cards.
  let family = familyRows;
  if (!cardNumber) {
    const byNumber = new Map<string, SportsProductRow[]>();
    for (const r of familyRows) {
      const key = r.card_number || '?';
      if (!byNumber.has(key)) byNumber.set(key, []);
      byNumber.get(key)!.push(r);
    }
    family = [...byNumber.values()].sort((a, b) => b.length - a.length)[0];
    if (byNumber.size > 1) notes.push(`player matched ${byNumber.size} distinct card numbers in set; using largest family`);
  }

  const picked = pickWithinFamily(family, params, notes);

  // Set-confidence guard: a weak set match caps overall confidence
  const setScore = setScoreByUid.get(chosenUid) || 0;
  let confidence = picked.confidence;
  if (params.setName && setScore < 6 && confidence === 'high') confidence = 'medium';
  if (!cardNumber && confidence === 'high') confidence = 'medium'; // number never confirmed

  return {
    tier: picked.tier,
    confidence,
    product: picked.product,
    family: family.sort((a, b) => (a.variant_text || '').localeCompare(b.variant_text || '')),
    matchedSet,
    defaultedToBase: picked.defaultedToBase,
    variantNotFound: picked.variantNotFound,
    notes,
  };
}

// ============================================================================
// Bridge to the legacy pricing shape
// ============================================================================

/**
 * Convert a local product row to the NormalizedPrices shape the rest of the
 * pricing pipeline consumes (same grade mapping as normalizePrices()).
 */
export function productToNormalizedPrices(row: SportsProductRow): NormalizedPrices {
  const psa: Record<string, number> = {};
  const bgs: Record<string, number> = {};
  const sgc: Record<string, number> = {};

  if (row.cib_price) psa['7'] = Number(row.cib_price);
  if (row.new_price) psa['8'] = Number(row.new_price);
  if (row.graded_price) psa['9'] = Number(row.graded_price);
  if (row.box_only_price) psa['9.5'] = Number(row.box_only_price);
  if (row.manual_only_price) psa['10'] = Number(row.manual_only_price);

  if (row.bgs_10_price) bgs['10'] = Number(row.bgs_10_price);
  if (row.box_only_price) bgs['9.5'] = Number(row.box_only_price);
  if (row.graded_price) bgs['9'] = Number(row.graded_price);

  if (row.condition_18_price) sgc['10'] = Number(row.condition_18_price);
  if (row.graded_price) sgc['9'] = Number(row.graded_price);

  return {
    raw: row.loose_price != null ? Number(row.loose_price) : null,
    psa,
    bgs,
    sgc,
    estimatedDcm: null,
    productId: row.id,
    productName: row.product_name,
    setName: row.console_name,
    lastUpdated: new Date().toISOString(),
    salesVolume: row.sales_volume != null ? String(row.sales_volume) : null,
  };
}

/** Fetch one product row by SportsCardsPro id (product-ID fast path / picker). */
export async function getLocalSportsProductById(productId: string): Promise<SportsProductRow | null> {
  if (process.env.SPORTS_LOCAL_DB_ENABLED !== 'true') return null;
  const { data, error } = await supabaseServer()
    .from('sports_card_products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();
  if (error || !data) return null;
  return data as SportsProductRow;
}

/** All parallels for a product's family (same set + card number). */
export async function getLocalSportsFamily(productId: string): Promise<SportsProductRow[]> {
  if (process.env.SPORTS_LOCAL_DB_ENABLED !== 'true') return [];
  const row = await getLocalSportsProductById(productId);
  if (!row || !row.set_uid || !row.card_number) return row ? [row] : [];
  const { data, error } = await supabaseServer()
    .from('sports_card_products')
    .select('*')
    .eq('set_uid', row.set_uid)
    .eq('card_number', row.card_number)
    .limit(300);
  if (error || !data) return [row];
  return (data as SportsProductRow[]).sort((a, b) => (a.variant_text || '').localeCompare(b.variant_text || ''));
}
