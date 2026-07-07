/**
 * eBay listing title builder.
 *
 * TWIN FILE of the web implementation at src/lib/ebay/titleBuilder.ts —
 * both files implement EXACTLY the same algorithm so a card listed from
 * mobile gets the same title it would get from the web listing modal.
 * If you change the algorithm here, make the identical change there.
 *
 * Algorithm:
 * - Max 80 chars, segments joined with ' - '.
 * - Required segments: name, `DCM ${grade}`, condition (skipped if empty).
 * - Optional segments are added in PRIORITY order (setName, cardNumber,
 *   year, subset, serialNumbering) while the assembled title stays ≤ 80.
 * - Final DISPLAY order: name, subset, setName, cardNumber, year,
 *   serialNumbering, `DCM ${grade}`, condition.
 * - Dedupe: an optional is skipped when its lowercase-alphanumeric
 *   normalization is already a substring of the included segments'
 *   normalization (e.g. "#25" when the name already contains "25").
 * - If the required segments alone overflow 80 chars, the NAME is
 *   truncated at a word boundary (no ellipsis).
 * - Whitespace is collapsed and empty segments are skipped.
 */

import { ConditionLabels } from './constants'

export const EBAY_TITLE_MAX_LENGTH = 80
const SEPARATOR = ' - '

export interface EbayTitleInput {
  name: string
  setName?: string
  subset?: string
  cardNumber?: string
  year?: string
  serialNumbering?: string
  grade: number | string
  condition?: string
}

type OptionalKey = 'setName' | 'cardNumber' | 'year' | 'subset' | 'serialNumbering'

/** Order in which optionals compete for the remaining title budget. */
const PRIORITY_ORDER: OptionalKey[] = ['setName', 'cardNumber', 'year', 'subset', 'serialNumbering']

/** Collapse whitespace runs and trim. */
function clean(value?: string | number | null): string {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

/** Lowercase-alphanumeric normalization used for the dedupe check. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function buildEbayTitle(input: EbayTitleInput): string {
  const name = clean(input.name)
  const gradeText = clean(input.grade)
  const gradeSegment = gradeText ? `DCM ${gradeText}` : ''
  const condition = clean(input.condition)

  const optionals: Record<OptionalKey, string> = {
    setName: clean(input.setName),
    cardNumber: clean(input.cardNumber),
    year: clean(input.year),
    subset: clean(input.subset),
    serialNumbering: clean(input.serialNumbering),
  }

  /** Assemble the title in final display order from the included optionals. */
  const assemble = (include: Set<OptionalKey>): string =>
    [
      name,
      include.has('subset') ? optionals.subset : '',
      include.has('setName') ? optionals.setName : '',
      include.has('cardNumber') ? optionals.cardNumber : '',
      include.has('year') ? optionals.year : '',
      include.has('serialNumbering') ? optionals.serialNumbering : '',
      gradeSegment,
      condition,
    ].filter(Boolean).join(SEPARATOR)

  // Required-only overflow: truncate the NAME at a word boundary, no ellipsis.
  const requiredOnly = assemble(new Set())
  if (requiredOnly.length > EBAY_TITLE_MAX_LENGTH) {
    const overhead = requiredOnly.length - name.length
    const available = Math.max(0, EBAY_TITLE_MAX_LENGTH - overhead)
    let truncatedName = name.slice(0, available)
    const lastSpace = truncatedName.lastIndexOf(' ')
    if (lastSpace > 0) truncatedName = truncatedName.slice(0, lastSpace)
    truncatedName = truncatedName.trim()
    return [truncatedName, gradeSegment, condition].filter(Boolean).join(SEPARATOR)
  }

  // Greedily include optionals by priority while the title stays within budget.
  const included = new Set<OptionalKey>()
  for (const key of PRIORITY_ORDER) {
    const value = optionals[key]
    if (!value) continue
    // Dedupe against everything already included (required + accepted optionals).
    const candidateNorm = normalize(value)
    if (!candidateNorm || normalize(assemble(included)).includes(candidateNorm)) continue
    const withCandidate = new Set(included)
    withCandidate.add(key)
    if (assemble(withCandidate).length <= EBAY_TITLE_MAX_LENGTH) included.add(key)
  }

  return assemble(included)
}

/** Values the AI sometimes writes into serial_number that mean "none". */
const INVALID_SERIAL_VALUES = new Set(['unknown', 'n/a', '??', 'none', 'no', 'false'])

/**
 * Map a raw `cards` row to buildEbayTitle input and produce the default
 * listing title.
 *
 * - Name priority: featured → pokemon_featured → card_name (mobile's closest
 *   equivalent to web labelData.primaryName), with conversational_card_info
 *   fallbacks for legacy rows whose columns are null.
 * - Condition is DERIVED from the whole grade via ConditionLabels — never the
 *   stored conversational_condition_label, which predates the grade-derived
 *   condition unification and can be stale.
 */
export function buildEbayTitleFromCard(card: any): string {
  const ci = card?.conversational_card_info || {}

  const name =
    card?.featured || card?.pokemon_featured || card?.card_name ||
    ci.card_name || ci.player_or_character || ''

  const rawNumber = card?.card_number || ci.card_number || ''
  const cardNumber = rawNumber ? `#${String(rawNumber).replace(/^#/, '')}` : ''

  const releaseYear = card?.release_date ? String(card.release_date).slice(0, 4) : ''

  const gradeValue = card?.conversational_whole_grade
  const grade = gradeValue != null ? Math.round(Number(gradeValue)) : ''
  const condition = typeof grade === 'number' ? ConditionLabels[grade] || '' : ''

  const rawSerialNumbering = ci.serial_number || card?.serial_numbering || ''
  const serialNumbering = INVALID_SERIAL_VALUES.has(String(rawSerialNumbering).trim().toLowerCase())
    ? ''
    : String(rawSerialNumbering)

  return buildEbayTitle({
    name,
    setName: card?.card_set || ci.set_name || '',
    subset: ci.subset || '',
    cardNumber,
    year: ci.year || ci.set_year || releaseYear,
    serialNumbering,
    grade,
    condition,
  })
}
