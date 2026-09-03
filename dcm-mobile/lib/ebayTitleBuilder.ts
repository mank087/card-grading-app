/**
 * eBay listing title builder.
 *
 * TWIN FILE of the web implementation at src/lib/ebay/titleBuilder.ts —
 * both files implement EXACTLY the same algorithm so a card listed from
 * mobile gets the same title it would get from the web listing modal.
 * If you change the algorithm here, make the identical change there.
 * `npm run check:twin-drift` compares TITLE_TOKEN_TABLE on both sides.
 *
 * Algorithm:
 * - Max 80 chars, tokens joined with a SPACE (eBay ignores punctuation; the
 *   old ' - ' separators cost ~12 characters of keyword budget).
 * - PER-CATEGORY token order — TITLE_TOKEN_TABLE gives each category its
 *   display order and the priority order optionals compete for the budget in.
 * - Required: the name (never dropped) and the grade tail `{label} {grade}`.
 *   The condition word is never emitted. The tail reads `{label} Authentic`
 *   only when the card has no numeric grade at all — a v9.23 unverified-
 *   autograph card keeps its full number.
 * - The game/sport word is always present; the language token only when the
 *   card is not English.
 * - Dedupe: data tokens by lowercase-alphanumeric substring, short literal
 *   tokens ("RC", "Auto", the game word) by whole word.
 * - No rival grading company may appear (eBay keyword-spamming policy).
 */

import { resolveListingFields } from './ebayListingFields'
import { stripBlockedGraders } from './ebayGradingCompanyBlocklist'

export const EBAY_TITLE_MAX_LENGTH = 80
const SEPARATOR = ' '
const DEFAULT_GRADE_LABEL = 'DCM'

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
  | 'language'

export interface EbayTitleInput {
  name: string
  setName?: string
  subset?: string
  cardNumber?: string
  year?: string
  serialNumbering?: string
  grade: number | string
  /** Legacy condition word. No longer emitted at all (see the header). */
  condition?: string
  category?: string
  gradeLabel?: string
  manufacturer?: string
  parallel?: string
  rarity?: string
  finish?: string
  rookie?: boolean
  autograph?: boolean
  team?: string
  sport?: string
  gameWord?: string
  language?: string
}

/**
 * Per-category token tables. `display` is emission order; `priority` is the
 * order optionals compete for the 80-char budget, highest search value first.
 * TWIN: src/lib/ebay/titleBuilder.ts TITLE_TOKEN_TABLE.
 */
export const TITLE_TOKEN_TABLE: Record<string, { display: TitleTokenKey[]; priority: TitleTokenKey[] }> = {
  // Sports: 'auto' and 'serial' outrank manufacturer and parallel. 'RC' only —
  // "RC Rookie" spent 7 characters saying the same thing twice.
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
}

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
}

/** Short fixed words — deduped by WHOLE WORD, not normalized substring. */
const LITERAL_TOKENS: Set<TitleTokenKey> = new Set([
  'rc', 'auto', 'gameWord', 'sport', 'finish', 'team', 'language',
])

/**
 * Tokens deduped on the RAW text, not the normalized form. Serial numbering
 * is "/10", and normalization strips the slash — so it collided with card
 * number "#101" and a /10 card silently lost its rarest keyword.
 */
const RAW_TOKENS: Set<TitleTokenKey> = new Set(['serial'])

/** Collapse whitespace runs and trim. */
function clean(value?: string | number | null): string {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

/** Lowercase-alphanumeric normalization used for the dedupe check. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsWord(haystack: string, token: string): boolean {
  return new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i').test(haystack)
}

/** Clean a token AND drop any rival grading company name inside it. */
function tokenValue(value?: string | number | null): string {
  return clean(stripBlockedGraders(clean(value)))
}

export function buildEbayTitle(input: EbayTitleInput): string {
  const name = tokenValue(input.name)

  // "Authentic" ONLY when there is no number at all: a v9.23 unverified-
  // autograph card keeps its full numeric grade, and the notation belongs in
  // the description, not in place of the grade.
  const gradeLabel = tokenValue(input.gradeLabel) || DEFAULT_GRADE_LABEL
  const gradeText = clean(input.grade) || 'Authentic'
  const gradeSegment = `${gradeLabel} ${gradeText}`

  const table = TITLE_TOKEN_TABLE[CATEGORY_TO_TABLE[normalize(input.category || 'other')] || 'other']

  const language = tokenValue(input.language)
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
    language: language && language.toLowerCase() !== 'english' ? language : '',
  }

  const included = new Set<TitleTokenKey>()

  /** Sports lead with year/set and put the player mid-title; others lead with the name. */
  const nameAfter: TitleTokenKey | null = table === TITLE_TOKEN_TABLE.sports ? 'sport' : null

  const assemble = (): string[] => {
    const parts: string[] = []
    if (!nameAfter) parts.push(name)
    for (const key of table.display) {
      if (included.has(key)) {
        const value = values[key]
        if (value) parts.push(value)
      }
      if (key === nameAfter) parts.push(name)
    }
    parts.push(gradeSegment)
    return parts.filter(Boolean)
  }

  // Required-only overflow: truncate the NAME at a word boundary, no ellipsis.
  const requiredOnly = assemble().join(SEPARATOR)
  if (requiredOnly.length > EBAY_TITLE_MAX_LENGTH) {
    const available = EBAY_TITLE_MAX_LENGTH - gradeSegment.length - SEPARATOR.length
    if (available < 1) return gradeSegment.slice(0, EBAY_TITLE_MAX_LENGTH).trim()
    let truncatedName = name.slice(0, available)
    if (name.charAt(available) !== ' ') {
      const lastSpace = truncatedName.lastIndexOf(' ')
      if (lastSpace > 0) truncatedName = truncatedName.slice(0, lastSpace)
    }
    return [truncatedName.trim(), gradeSegment].filter(Boolean).join(SEPARATOR)
  }

  // The generic dedupe only compares against ALREADY-included tokens, so a
  // high-priority year would slip in before the richer set name "2024 Bowman
  // Chrome" is considered. Pre-drop the year when a later token carries it.
  const yearIsRedundant =
    !!values.year &&
    [values.setName, values.subset, name].some(v => normalize(v || '').includes(normalize(values.year!)))

  for (const key of table.priority) {
    if (key === 'year' && yearIsRedundant) continue
    const value = values[key]
    if (!value) continue

    const current = assemble().join(SEPARATOR)
    if (LITERAL_TOKENS.has(key)) {
      if (containsWord(current, value)) continue
    } else if (RAW_TOKENS.has(key)) {
      if (current.includes(value)) continue
    } else {
      const normalized = normalize(value)
      if (!normalized || normalize(current).includes(normalized)) continue
    }

    included.add(key)
    if (assemble().join(SEPARATOR).length > EBAY_TITLE_MAX_LENGTH) included.delete(key)
  }

  return assemble().join(SEPARATOR)
}

/**
 * Map a raw `cards` row to buildEbayTitle input and produce the default
 * listing title.
 *
 * Everything the title needs now comes from the shared field resolver
 * (ebayListingFields.ts), the same one the web modal uses, so mobile and web
 * read the card row with identical precedence.
 *
 * `gradeLabel` comes from the seller's saved listing defaults (an enterprise
 * store's brand name); omit it and the tail is "DCM {grade}".
 */
export function buildEbayTitleFromCard(card: any, gradeLabel?: string): string {
  const f = resolveListingFields(card)

  return buildEbayTitle({
    name: f.name,
    setName: f.setName,
    subset: f.subset,
    cardNumber: f.cardNumber ? `#${f.cardNumber}` : '',
    year: f.year,
    serialNumbering: f.serialDenominator,
    grade: f.grade ?? '',
    condition: f.conditionLabel,
    category: f.category,
    gradeLabel,
    manufacturer: f.manufacturer,
    parallel: f.parallel,
    rarity: f.rarity,
    finish: f.finish,
    rookie: f.rookie,
    autograph: f.autograph,
    team: f.team,
    sport: f.sport,
    gameWord: f.gameWord,
    language: f.language,
  })
}
