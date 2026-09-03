/**
 * eBay Title Builder
 *
 * Deterministic construction of eBay listing titles within the 80-character
 * limit, with a PER-CATEGORY token order. Shared algorithm with the mobile app
 * (dcm-mobile/lib/ebayTitleBuilder.ts) — keep changes in sync;
 * `npm run check:twin-drift` compares the token tables.
 *
 * Why it looks the way it does:
 * - eBay's search engine ignores punctuation, so segments are joined with a
 *   SPACE. The old ' - ' separators cost ~12 characters of keyword budget.
 * - Buyers search per category, in a category-specific order (a sports buyer
 *   types "2023 Prizm Stroud rookie", a Pokemon buyer types "Charizard
 *   Obsidian Flames 125/197"). TITLE_TOKEN_TABLE encodes that order.
 * - The game/sport word is always present: it disambiguates the category to
 *   eBay's search engine and buyers type it.
 * - The condition word ("Mint") is never emitted — "DCM 9" already says it and
 *   nobody searches "Mint". The tail reads "{label} Authentic" only when the
 *   card has no numeric grade at all. A v9.23 unverified-autograph card is NOT
 *   such a card: it keeps its full number, and the notation lives in the
 *   description.
 * - No rival grading company may ever appear (eBay keyword-spamming policy);
 *   a token naming one is dropped before assembly.
 *
 * Assembly:
 * - Required: the name (never dropped, truncated at a word boundary only as a
 *   last resort) and the grade tail `{label} {grade}` (never dropped).
 * - Optionals are ADDED in each category's PRIORITY order while the title
 *   stays <= 80 chars, and EMITTED in that category's DISPLAY order, so the
 *   lowest-value tokens (team, year, holo) are the ones that fall off.
 * - Duplicate-ish tokens are skipped: data tokens by lowercase-alphanumeric
 *   substring (stops "Pikachu Pikachu Promo"), short literal tokens by whole
 *   word (so "RC" isn't eaten by a player named "Marcus").
 */

import { stripBlockedGraders } from './gradingCompanyBlocklist';

/** Every token a title can carry. Keyed by TITLE_TOKEN_TABLE below. */
export type TitleTokenKey =
  | 'year'
  | 'manufacturer'
  | 'setName'
  | 'subset'
  | 'sport'
  | 'cardNumber'
  | 'parallel'
  | 'rarity'
  | 'finish'
  | 'rc'
  | 'auto'
  | 'serial'
  | 'team'
  | 'gameWord'
  | 'language';

export interface EbayTitleInput {
  name: string;
  setName?: string;
  subset?: string;
  /** Pre-formatted, including any leading '#'. */
  cardNumber?: string;
  year?: string;
  /** Compact form, e.g. "/99". */
  serialNumbering?: string;
  grade: number | string;
  /** Legacy condition word. No longer emitted at all (see the header). */
  condition?: string;
  /** DCM category; picks the token table. Defaults to the generic 'other'. */
  category?: string;
  /** Grade brand for the tail — an org's storefront name, else 'DCM'. */
  gradeLabel?: string;
  manufacturer?: string;
  parallel?: string;
  rarity?: string;
  finish?: string;
  rookie?: boolean;
  autograph?: boolean;
  team?: string;
  sport?: string;
  gameWord?: string;
  /** Emitted only when it is not English. */
  language?: string;
}

const MAX_TITLE_LENGTH = 80;
const SEPARATOR = ' ';
const DEFAULT_GRADE_LABEL = 'DCM';

/**
 * Per-category token tables. `display` is emission order (what a buyer reads);
 * `priority` is the order optionals compete for the 80-char budget, highest
 * search value first — so the tail of each priority array is what gets cut.
 *
 * TWIN: the same table exists in dcm-mobile/lib/ebayTitleBuilder.ts.
 */
export const TITLE_TOKEN_TABLE: Record<string, { display: TitleTokenKey[]; priority: TitleTokenKey[] }> = {
  // Sports: 'auto' and 'serial' outrank manufacturer and parallel — an
  // autographed or /10 card is a different item to a buyer, where "Panini" is
  // usually already inside the set name. 'RC' only: emitting "RC Rookie" spent
  // 7 characters to say the same thing twice.
  sports: {
    display: ['year', 'manufacturer', 'setName', 'subset', 'sport', 'cardNumber', 'parallel', 'rc', 'auto', 'serial', 'team'],
    priority: ['setName', 'cardNumber', 'auto', 'serial', 'parallel', 'year', 'rc', 'sport', 'manufacturer', 'subset', 'team'],
  },
  pokemon: {
    display: ['setName', 'cardNumber', 'rarity', 'finish', 'auto', 'serial', 'year', 'gameWord', 'language'],
    priority: ['setName', 'cardNumber', 'gameWord', 'rarity', 'language', 'finish', 'auto', 'serial', 'year'],
  },
  mtg: {
    display: ['setName', 'finish', 'cardNumber', 'rarity', 'serial', 'year', 'language', 'gameWord'],
    priority: ['setName', 'gameWord', 'cardNumber', 'finish', 'rarity', 'language', 'serial', 'year'],
  },
  lorcana: {
    display: ['setName', 'cardNumber', 'rarity', 'finish', 'serial', 'year', 'gameWord', 'language'],
    priority: ['setName', 'gameWord', 'cardNumber', 'rarity', 'finish', 'language', 'serial', 'year'],
  },
  ccg: {
    display: ['setName', 'cardNumber', 'rarity', 'parallel', 'finish', 'auto', 'serial', 'year', 'language', 'gameWord'],
    priority: ['setName', 'gameWord', 'cardNumber', 'rarity', 'parallel', 'language', 'finish', 'auto', 'serial', 'year'],
  },
  // Star Wars Unlimited has no short game word, so 22 characters of it rank
  // BELOW the card's own attributes rather than above them.
  swu: {
    display: ['setName', 'cardNumber', 'rarity', 'parallel', 'finish', 'auto', 'serial', 'year', 'language', 'gameWord'],
    priority: ['setName', 'cardNumber', 'rarity', 'parallel', 'language', 'finish', 'auto', 'serial', 'gameWord', 'year'],
  },
  other: {
    display: ['subset', 'setName', 'cardNumber', 'year', 'serial', 'auto', 'gameWord', 'language'],
    priority: ['setName', 'cardNumber', 'year', 'subset', 'gameWord', 'language', 'auto', 'serial'],
  },
};

/** One Piece / Yu-Gi-Oh share the generic CCG token order; SWU has its own. */
const CATEGORY_TO_TABLE: Record<string, string> = {
  sports: 'sports',
  pokemon: 'pokemon',
  mtg: 'mtg',
  lorcana: 'lorcana',
  onepiece: 'ccg',
  yugioh: 'ccg',
  starwars: 'swu',
  other: 'other',
};

/**
 * Short fixed words. These dedupe by WHOLE WORD, not by normalized substring:
 * "RC" is a substring of "Marcus" but not a word in it, and losing the rookie
 * keyword to a player's name is a real search cost.
 */
const LITERAL_TOKENS: Set<TitleTokenKey> = new Set([
  'rc', 'auto', 'gameWord', 'sport', 'finish', 'team', 'language',
]);

/**
 * Tokens deduped on the RAW text, not the normalized form. Serial numbering
 * is "/10", and normalization strips the slash — so it collided with card
 * number "#101" ("10" is a substring of "101") and a /10 card silently lost
 * its rarest keyword. The slash is exactly what distinguishes them.
 */
const RAW_TOKENS: Set<TitleTokenKey> = new Set(['serial']);

/** Collapse internal whitespace and trim; null/undefined become ''. */
function cleanSegment(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

/** Lowercase alphanumeric normalization used for duplicate detection. */
function normalizeSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Is `token` already present in `haystack` as a whole word? */
function containsWord(haystack: string, token: string): boolean {
  return new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i').test(haystack);
}

/**
 * Clean a token AND drop it if it names a rival grading company. Stripping
 * (rather than rejecting the title) keeps a card whose set name happens to
 * contain a blocked word listable, minus that word.
 */
function tokenValue(value: string | number | null | undefined): string {
  return cleanSegment(stripBlockedGraders(cleanSegment(value)));
}

export function buildEbayTitle(input: EbayTitleInput): string {
  const name = tokenValue(input.name);

  // Grade tail. "Authentic" ONLY when there is no number at all: a v9.23
  // unverified-autograph card keeps its full numeric grade on the slab, on the
  // label and in eBay's 27502 descriptor, and the title must match — that
  // notation belongs in the description, not in place of the grade.
  const gradeLabel = tokenValue(input.gradeLabel) || DEFAULT_GRADE_LABEL;
  const gradeText = cleanSegment(input.grade) || 'Authentic';
  const gradeSegment = `${gradeLabel} ${gradeText}`;

  const table = TITLE_TOKEN_TABLE[CATEGORY_TO_TABLE[normalizeSegment(input.category || 'other')] || 'other'];

  const language = tokenValue(input.language);
  const values: Partial<Record<TitleTokenKey, string>> = {
    year: tokenValue(input.year),
    manufacturer: tokenValue(input.manufacturer),
    setName: tokenValue(input.setName),
    subset: tokenValue(input.subset),
    sport: tokenValue(input.sport),
    cardNumber: tokenValue(input.cardNumber),
    parallel: tokenValue(input.parallel),
    rarity: tokenValue(input.rarity),
    finish: tokenValue(input.finish),
    rc: input.rookie ? 'RC' : '',
    auto: input.autograph ? 'Auto' : '',
    serial: tokenValue(input.serialNumbering),
    team: tokenValue(input.team),
    gameWord: tokenValue(input.gameWord),
    // Language is a keyword only when it is NOT English.
    language: language && language.toLowerCase() !== 'english' ? language : '',
  };

  const included = new Set<TitleTokenKey>();

  /**
   * The name's slot: sports titles lead with year/set and put the player in
   * the middle ("2023 Panini Prizm Football C.J. Stroud #341 …"); every other
   * category leads with the name.
   */
  const nameAfter: TitleTokenKey | null = table === TITLE_TOKEN_TABLE.sports ? 'sport' : null;

  const assemble = (): string[] => {
    const parts: string[] = [];
    if (!nameAfter) parts.push(name);
    for (const key of table.display) {
      if (included.has(key)) {
        const value = values[key];
        if (value) parts.push(value);
      }
      if (key === nameAfter) parts.push(name);
    }
    parts.push(gradeSegment);
    return parts.filter(Boolean);
  };

  // Required-only overflow: truncate the NAME at a word boundary (no ellipsis
  // — eBay characters are precious) so the full grade tail always fits.
  const requiredOnly = assemble().join(SEPARATOR);
  if (requiredOnly.length > MAX_TITLE_LENGTH) {
    const available = MAX_TITLE_LENGTH - gradeSegment.length - SEPARATOR.length;
    if (available < 1) return gradeSegment.slice(0, MAX_TITLE_LENGTH).trim();
    let truncatedName = name.slice(0, available);
    if (name.charAt(available) !== ' ') {
      const lastSpace = truncatedName.lastIndexOf(' ');
      if (lastSpace > 0) truncatedName = truncatedName.slice(0, lastSpace);
    }
    return [truncatedName.trim(), gradeSegment].filter(Boolean).join(SEPARATOR);
  }

  // The generic dedupe below only compares against ALREADY-included tokens, so
  // a high-priority year would slip in before the richer set name "2024 Bowman
  // Chrome" is considered. Pre-drop the year when a later token carries it.
  const yearIsRedundant =
    !!values.year &&
    [values.setName, values.subset, name].some(v => normalizeSegment(v || '').includes(normalizeSegment(values.year!)));

  for (const key of table.priority) {
    if (key === 'year' && yearIsRedundant) continue;
    const value = values[key];
    if (!value) continue;

    const current = assemble().join(SEPARATOR);
    if (LITERAL_TOKENS.has(key)) {
      if (containsWord(current, value)) continue;
    } else if (RAW_TOKENS.has(key)) {
      if (current.includes(value)) continue;
    } else {
      const normalized = normalizeSegment(value);
      if (!normalized || normalizeSegment(current).includes(normalized)) continue;
    }

    // Tentatively include; roll back if the joined title no longer fits.
    included.add(key);
    if (assemble().join(SEPARATOR).length > MAX_TITLE_LENGTH) included.delete(key);
  }

  return assemble().join(SEPARATOR);
}
