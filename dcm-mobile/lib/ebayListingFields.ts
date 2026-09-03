/**
 * eBay listing field resolver (mobile).
 *
 * TWIN FILE of src/lib/ebay/listingFields.ts. Metro can't reach across the
 * project boundary into src/lib, so this is a hand-maintained copy carrying
 * the subset the mobile TITLE builder consumes — the web copy additionally
 * resolves season/vintage/country and the description's detail rows, which
 * mobile never renders.
 *
 * The shared tables (GAME_WORDS, GAME_MANUFACTURERS, sport/league maps) and
 * the resolution precedence must stay identical to the web copy;
 * npm run check:twin-drift enforces the tables.
 */

export type ListingCategory =
  | 'sports'
  | 'pokemon'
  | 'mtg'
  | 'lorcana'
  | 'onepiece'
  | 'yugioh'
  | 'starwars'
  | 'other'

export interface ListingFields {
  category: ListingCategory
  name: string
  year: string
  manufacturer: string
  setName: string
  subset: string
  cardNumber: string
  parallel: string
  rarity: string
  rookie: boolean
  autograph: boolean
  autographFormat: string
  serialNumbering: string
  serialDenominator: string
  language: string
  isEnglish: boolean
  team: string
  sport: string
  league: string
  finish: string
  cardType: string
  gameWord: string
  /**
   * Grade NOTATION carried alongside the number ("Altered - Unverified
   * Autograph"). It does NOT suppress the grade — those cards keep their full
   * numeric grade on the slab and in eBay's 27502 descriptor.
   */
  designation: string | null
  grade: number | null
  conditionLabel: string
  serial: string
}

/**
 * The word buyers actually type for each category. SHORT forms on purpose —
 * "Pokemon", not "Pokemon Card": the trailing word adds nothing a buyer
 * searches for and costs characters the parallel or the serial needs.
 */
export const GAME_WORDS: Record<ListingCategory, string> = {
  sports: '',
  pokemon: 'Pokemon',
  mtg: 'MTG',
  lorcana: 'Lorcana',
  onepiece: 'One Piece',
  yugioh: 'Yu-Gi-Oh',
  // No short form exists; ranked low in the swu token table instead.
  starwars: 'Star Wars Unlimited',
  other: 'Trading Card',
}

/** Manufacturer per game. */
export const GAME_MANUFACTURERS: Record<ListingCategory, string> = {
  sports: '',
  pokemon: 'The Pokemon Company',
  mtg: 'Wizards of the Coast',
  lorcana: 'Ravensburger',
  onepiece: 'Bandai',
  yugioh: 'Konami',
  starwars: 'Fantasy Flight Games',
  other: '',
}

const SPORT_CATEGORIES = [
  'football', 'baseball', 'basketball', 'hockey', 'soccer',
  'golf', 'tennis', 'wrestling', 'boxing', 'racing', 'ufc', 'mma',
]

const LEAGUE_BY_SPORT: Record<string, string> = {
  Baseball: 'MLB',
  Football: 'NFL',
  Basketball: 'NBA',
  Hockey: 'NHL',
  Soccer: 'MLS',
}

/**
 * Values the model writes to mean "no value". "no" and "false" are NOT here:
 * they are legitimate answers to a yes/no aspect. Serials get the extra check.
 */
const EMPTY_VALUES = new Set([
  '', 'n/a', 'na', 'none', 'unknown', 'null', 'undefined', '??', '-', '--',
])

/** Extra "means none" spellings the model writes into serial_number. */
const INVALID_SERIAL_VALUES = new Set(['no', 'false', '0', 'not numbered', 'unnumbered'])

export function cleanFieldValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : ''
  const s = String(value).replace(/\s+/g, ' ').trim()
  return EMPTY_VALUES.has(s.toLowerCase()) ? '' : s
}

function firstOf(...values: unknown[]): string {
  for (const v of values) {
    const cleaned = cleanFieldValue(v)
    if (cleaned) return cleaned
  }
  return ''
}

function truthyFlag(...values: unknown[]): boolean {
  for (const v of values) {
    if (v === true) return true
    if (typeof v === 'string' && ['yes', 'true', '1'].includes(v.trim().toLowerCase())) return true
  }
  return false
}

export function extractYear(dateString: string): string {
  if (!dateString) return ''
  const yearMatch = dateString.match(/\b(19|20)\d{2}\b/)
  if (yearMatch) return yearMatch[0]
  if (/^\d{4}$/.test(dateString.trim())) return dateString.trim()
  return dateString
}

export function detectCardLanguage(card: any): string {
  const cardInfo = card?.conversational_card_info || {}
  const explicit = cardInfo.language || card?.card_language || card?.language
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim()
  const textToCheck = [card?.card_name, cardInfo.card_name, cardInfo.set_name, card?.card_set]
    .filter(Boolean)
    .join(' ')
  if (/[぀-ヿ一-鿿]/.test(textToCheck)) return 'Japanese'
  return 'English'
}

export function getSerialNumbering(card: any): string | null {
  const cardInfo = card?.conversational_card_info || {}
  const serialNum = firstOf(
    cardInfo.serial_number,
    cardInfo.serial_number_fraction,
    card?.serial_numbering
  )
  if (!serialNum || INVALID_SERIAL_VALUES.has(serialNum.toLowerCase())) return null
  return serialNum
}

/** "12/99" -> "/99", but a one-of-one keeps the searchable "1/1" form. */
export function getSerialDenominator(serialNumber: string | null): string | null {
  if (!serialNumber) return null
  const match = serialNumber.match(/\/(\d+)/)
  if (!match) return null
  return match[1] === '1' ? '1/1' : `/${match[1]}`
}

/** autograph_type spellings that mean there is NO hand-applied signature. */
const NOT_AUTOGRAPHED_TYPES = new Set([
  'no', 'false', 'none', 'facsimile', 'printed', 'pre-print', 'preprint', 'n/a',
])

export function hasAutograph(card: any): boolean {
  const cardInfo = card?.conversational_card_info || {}
  const type = cleanFieldValue(card?.autograph_type).toLowerCase()
  if (type && NOT_AUTOGRAPHED_TYPES.has(type)) return false
  if (truthyFlag(cardInfo.autographed, card?.autographed)) return true
  return type.length > 0
}

/** '' when the type is not actually known — never assert "Hard Signed". */
function resolveAutographFormat(card: any): string {
  const type = cleanFieldValue(card?.autograph_type).toLowerCase()
  if (type.includes('sticker')) return 'Sticker'
  if (type.includes('on-card') || type.includes('on card') || type.includes('hard')) return 'Hard Signed'
  return ''
}

export function detectSport(category: string): string {
  if (!category) return ''
  const lower = category.toLowerCase()
  if (lower.includes('baseball')) return 'Baseball'
  if (lower.includes('football')) return 'Football'
  if (lower.includes('basketball')) return 'Basketball'
  if (lower.includes('hockey')) return 'Hockey'
  if (lower.includes('soccer')) return 'Soccer'
  if (lower.includes('wrestling')) return 'Wrestling'
  if (lower.includes('golf')) return 'Golf'
  if (lower.includes('tennis')) return 'Tennis'
  if (lower.includes('racing') || lower.includes('nascar')) return 'Racing'
  if (lower.includes('boxing') || lower.includes('ufc') || lower.includes('mma')) return 'Boxing'
  return ''
}

export function detectLeague(sport: string): string {
  return LEAGUE_BY_SPORT[sport] || ''
}

export function normalizeListingCategory(value: string | null | undefined): ListingCategory {
  const normalized = (value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (
    normalized === 'pokemon' || normalized === 'mtg' || normalized === 'lorcana' ||
    normalized === 'onepiece' || normalized === 'yugioh' || normalized === 'starwars' ||
    normalized === 'sports' || normalized === 'other'
  ) {
    return normalized as ListingCategory
  }
  if (SPORT_CATEGORIES.includes(normalized)) return 'sports'
  return 'other'
}

/**
 * Does this card carry the v9.23 unverified-autograph designation? Inlined
 * copy of src/lib/grading/autographPolicy.hasUnverifiedAutographDesignation —
 * mobile has no access to the grading library.
 */
function hasUnverifiedAutographDesignation(card: any): boolean {
  if (card?.autograph_type === 'unverified') return true
  const haystack = `${card?.conversational_condition_label || ''} ${card?.conversational_final_grade_summary || ''}`.toLowerCase()
  return haystack.includes('unverified autograph')
}

export function resolveListingFields(card: any, cardType?: string): ListingFields {
  const ci = card?.conversational_card_info || {}
  const category = normalizeListingCategory(cardType || card?.category)

  const name = firstOf(
    ci.player_or_character,
    card?.featured,
    card?.pokemon_featured,
    ci.card_name,
    card?.card_name
  )

  const year = extractYear(
    firstOf(ci.year, ci.set_year, ci.card_date, ci.release_date, card?.release_date)
  )

  const sport = category === 'sports'
    ? detectSport(firstOf(card?.sub_category, card?.category, ci.category, ci.sport))
    : ''
  const league = sport ? detectLeague(sport) : ''

  const serialNumbering = getSerialNumbering(card) || ''
  const language = detectCardLanguage(card)

  const finishText = firstOf(
    ci.finish,
    ci.holofoil,
    card?.holofoil,
    card?.foil_type,
    ci.foil_type
  ).toLowerCase()
  let finish = ''
  if (finishText.includes('reverse')) finish = 'Reverse Holo'
  else if (finishText.includes('holo')) finish = 'Holo'
  else if (finishText.includes('foil')) finish = 'Foil'
  if (!finish && truthyFlag(card?.is_foil, ci.foil)) finish = 'Foil'
  if (truthyFlag(card?.is_enchanted, ci.enchanted)) finish = 'Enchanted'

  // v9.23 designation is a NOTATION, never a grade suppressor: an unverified-
  // autograph card keeps its full numeric grade, so the title still says it.
  const conditionLabel = cleanFieldValue(card?.conversational_condition_label)
  const designation = hasUnverifiedAutographDesignation(card || {})
    ? 'Altered - Unverified Autograph'
    : null

  const gradeRaw = card?.conversational_whole_grade ?? card?.conversational_decimal_grade
  const grade = Number.isFinite(Number(gradeRaw)) && Number(gradeRaw) > 0
    ? Math.round(Number(gradeRaw))
    : null

  return {
    category,
    name,
    year,
    manufacturer: firstOf(ci.manufacturer, card?.manufacturer, GAME_MANUFACTURERS[category]),
    setName: firstOf(ci.set_name, card?.card_set),
    subset: firstOf(ci.subset, ci.insert_set),
    cardNumber: firstOf(ci.card_number, card?.card_number).replace(/^#/, ''),
    parallel: firstOf(ci.parallel, ci.variety, ci.op_variant_type, ci.variant),
    rarity: firstOf(ci.rarity, card?.mtg_rarity, card?.rarity_tier, card?.rarity_description),
    rookie: truthyFlag(ci.rookie, card?.rookie_card, card?.first_print_rookie, ci.rookie_card),
    autograph: hasAutograph(card),
    autographFormat: resolveAutographFormat(card),
    serialNumbering,
    serialDenominator: getSerialDenominator(serialNumbering) || '',
    language,
    isEnglish: language.toLowerCase() === 'english',
    team: firstOf(ci.team, ci.team_name),
    sport,
    league,
    finish,
    cardType: firstOf(ci.card_type, ci.stage),
    gameWord: category === 'sports' ? sport : GAME_WORDS[category],
    designation,
    grade,
    conditionLabel,
    serial: firstOf(card?.org_serial_display, card?.serial),
  }
}
