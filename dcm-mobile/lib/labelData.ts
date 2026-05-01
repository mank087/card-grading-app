// Shared display-name + features extraction for cards.
// Mirrors web's labelDataGenerator.ts for the fields we need on mobile thumbnails.

interface CardInfoLike {
  card_name?: string | null
  player_or_character?: string | null
  set_name?: string | null
  set_era?: string | null
  subset?: string | null
  card_number?: string | null
  card_number_raw?: string | null
  collector_number?: string | null
  year?: string | null
  set_year?: string | null
  flavor_name?: string | null
  rarity_tier?: string | null
  special_features?: string | null
  rookie_or_first?: boolean | string | null
  autographed?: boolean | null
  memorabilia?: boolean | null
  facsimile_autograph?: boolean | null
  serial_number?: string | null
  pokemon_type?: string | null
  is_foil?: boolean | null
  foil_type?: string | null
}

interface CardLike {
  serial?: string | null
  category?: string | null
  sub_category?: string | null
  card_name?: string | null
  card_set?: string | null
  card_number?: string | null
  release_date?: string | null
  featured?: string | null
  pokemon_featured?: string | null
  rookie_card?: boolean | null
  autographed?: boolean | null
  serial_numbering?: string | null
  conversational_card_info?: CardInfoLike | null
}

const stripMarkdown = (v?: string | null): string | null => {
  if (!v) return null
  const cleaned = String(v).replace(/\*\*/g, '').trim()
  if (!cleaned) return null
  const lower = cleaned.toLowerCase()
  if (lower === 'unknown' || lower === 'n/a' || lower === '??') return null
  return cleaned
}

const isValid = (v?: string | null): boolean => {
  if (!v) return false
  const lower = v.toLowerCase()
  return lower !== 'unknown' && lower !== 'n/a' && lower !== '??'
}

const SPORTS_CATEGORIES = new Set(['Sports', 'Baseball', 'Basketball', 'Football', 'Hockey', 'Soccer'])

/**
 * Get the primary display name for a card (e.g., player or character name).
 * Critical: for sports cards, player_or_character WINS over card_name —
 * card_name often contains the insert/parallel set name (e.g., "Power Players").
 */
export function getDisplayName(card: CardLike): string {
  const ci = card.conversational_card_info || {}
  const category = card.category || 'Other'
  const isSports = SPORTS_CATEGORIES.has(category) || card.sub_category === 'Sports'

  if (isSports) {
    const player = stripMarkdown(ci.player_or_character)
    if (player && isValid(player)) return player
    if (isValid(card.featured)) return card.featured!
    if (isValid(card.card_name)) return card.card_name!
    return `Card #${card.serial || ''}`.trim()
  }

  // Pokemon: prefer Pokemon name (player_or_character) unless card_name has a variant suffix
  if (category === 'Pokemon') {
    const cardName = stripMarkdown(ci.card_name)
    const pokemonName = stripMarkdown(ci.player_or_character) || card.pokemon_featured || card.featured
    const variantPattern = /\b(VMAX|VSTAR|V|GX|EX|ex|Prime|LV\.X|LEGEND|BREAK|Star|Shining|Crystal|Radiant)\b/i
    if (cardName && pokemonName && cardName !== pokemonName && variantPattern.test(cardName)) return cardName
    if (pokemonName && isValid(pokemonName)) return pokemonName
    if (cardName) return cardName
  }

  // MTG: flavor_name > card_name > player_or_character
  if (category === 'MTG') {
    const flavor = stripMarkdown(ci.flavor_name)
    if (flavor) return flavor
    const cardName = stripMarkdown(ci.card_name)
    if (cardName) return cardName
    const character = stripMarkdown(ci.player_or_character)
    if (character) return character
  }

  // Default: card.card_name > ci.card_name > player_or_character > featured
  return (
    stripMarkdown(card.card_name) ||
    stripMarkdown(ci.card_name) ||
    stripMarkdown(ci.player_or_character) ||
    stripMarkdown(card.featured) ||
    `Card #${card.serial || ''}`.trim()
  )
}

/**
 * Build the context line: "Set • #Num • Year" (or with subset for sports inserts).
 * For sports cards, if card_name differs from player name, treat card_name as the subset/insert.
 */
export function getContextLine(card: CardLike): string {
  const ci = card.conversational_card_info || {}
  const category = card.category || 'Other'
  const isSports = SPORTS_CATEGORIES.has(category) || card.sub_category === 'Sports'

  const setName = stripMarkdown(ci.set_name) || stripMarkdown(ci.set_era) || stripMarkdown(card.card_set) || ''
  let subset = stripMarkdown(ci.subset) || ''
  if (isSports) {
    const player = stripMarkdown(ci.player_or_character) || ''
    const aiCardName = stripMarkdown(ci.card_name) || stripMarkdown(card.card_name) || ''
    if (aiCardName && player && aiCardName.toLowerCase() !== player.toLowerCase()) {
      subset = aiCardName
    }
  }
  const cardNumber =
    stripMarkdown(ci.card_number_raw) ||
    stripMarkdown(ci.card_number) ||
    stripMarkdown(ci.collector_number) ||
    stripMarkdown(card.card_number) ||
    ''
  const year = stripMarkdown(ci.year) || stripMarkdown(ci.set_year) || stripMarkdown(card.release_date) || ''

  const parts: string[] = []
  if (setName) parts.push(setName)
  if (subset && subset !== setName) parts.push(subset)
  if (cardNumber) parts.push(`#${cardNumber.replace(/^#/, '')}`)
  if (year) parts.push(year)

  return parts.join(' • ')
}

// Matches isValidSerialNumber in src/lib/labelDataGenerator.ts — keep filters
// identical so mobile and web emit the same features list.
function isValidSerialNumber(s?: string | null): boolean {
  if (!s) return false
  const v = String(s).trim()
  if (!v) return false
  const lower = v.toLowerCase()
  if (['unknown', 'n/a', '??', 'none', 'no', 'false'].includes(lower)) return false
  return true
}

// Per-category feature builders — direct ports of the matching functions in
// src/lib/labelDataGenerator.ts. Comments cite the source line numbers so the
// two stay in lockstep when web changes; do not add fields here that aren't
// in the web equivalent.
function getSportsFeatures(ci: any, card: any): string[] {
  const f: string[] = []
  if (ci.rookie_or_first === true || ci.rookie_or_first === 'true' || card.rookie_card === true) f.push('RC')
  if (ci.autographed === true || card.autographed === true || card.autograph_type === 'authentic') f.push('Auto')
  if (ci.facsimile_autograph === true) f.push('Facsimile')
  if (ci.memorabilia === true || (card.memorabilia_type && card.memorabilia_type !== 'none')) f.push('Mem')
  if (ci.official_reprint === true) f.push('Reprint')
  const sn = stripMarkdown(ci.serial_number) || stripMarkdown(card.serial_numbering)
  if (isValidSerialNumber(sn)) f.push(sn!)
  return f
}

function getPokemonFeatures(ci: any, card: any): string[] {
  const f: string[] = []
  if (ci.rookie_or_first === true || ci.rookie_or_first === 'true' || card.first_print_rookie === 'true') f.push('1st Ed')
  if (ci.autographed === true) f.push('Auto')
  const sn = stripMarkdown(ci.serial_number) || stripMarkdown(card.serial_numbering)
  if (isValidSerialNumber(sn)) f.push(sn!)
  return f
}

function getMTGFeatures(ci: any, card: any): string[] {
  const f: string[] = []
  if (ci.is_promo === true) f.push('Promo')
  if (ci.is_double_faced === true || card.is_double_faced === true) f.push('DFC')
  if (card.mtg_rarity === 'mythic') f.push('Mythic')
  const sn = stripMarkdown(ci.serial_number)
  if (isValidSerialNumber(sn)) f.push(sn!)
  return f
}

function getLorcanaFeatures(ci: any, _card: any): string[] {
  const f: string[] = []
  const sn = stripMarkdown(ci.serial_number)
  if (isValidSerialNumber(sn)) f.push(sn!)
  return f
}

function getYugiohFeatures(ci: any, card: any): string[] {
  const f: string[] = []
  const attr = stripMarkdown(ci.ygo_attribute) || stripMarkdown(card.ygo_attribute)
  if (attr) f.push(attr)
  const race = stripMarkdown(ci.ygo_race) || stripMarkdown(card.ygo_race)
  if (race) f.push(race)
  if (ci.is_foil === true) f.push('Foil')
  const sn = stripMarkdown(ci.serial_number)
  if (isValidSerialNumber(sn)) f.push(sn!)
  return f
}

function getOnePieceFeatures(ci: any, _card: any): string[] {
  const f: string[] = []
  if (typeof ci.op_card_type === 'string' && ci.op_card_type.toLowerCase() === 'leader') f.push('Leader')
  const variant = typeof ci.op_variant_type === 'string' ? ci.op_variant_type.toLowerCase() : ''
  const isParallel = variant === 'parallel' || variant === 'parallel_manga'
  if (ci.is_foil === true && !isParallel) f.push('Foil')
  const sn = stripMarkdown(ci.serial_number)
  if (isValidSerialNumber(sn)) f.push(sn!)
  return f
}

function getStarWarsFeatures(ci: any, card: any): string[] {
  const f: string[] = []
  if (ci.is_foil || card.is_foil) f.push('Foil')
  if (ci.holofoil && isValidValue(ci.holofoil) && ci.holofoil !== 'None') f.push(ci.holofoil)
  if (ci.autographed) f.push('Auto')
  const sn = stripMarkdown(ci.serial_number) || stripMarkdown(card.serial_numbering)
  if (sn && isValidValue(sn)) f.push(sn)
  const special = stripMarkdown(ci.special_features)
  if (special && isValidValue(special)) {
    special.split(/[,;]/).forEach((s: string) => {
      const t = s.trim()
      if (t && !f.includes(t)) f.push(t)
    })
  }
  return f
}

function getOtherFeatures(ci: any, card: any): string[] {
  const f: string[] = []
  if (ci.rookie_or_first === true || ci.rookie_or_first === 'true') f.push('RC')
  if (ci.autographed === true || card.autographed === true) f.push('Auto')
  if (ci.facsimile_autograph === true) f.push('Facsimile')
  const sn = stripMarkdown(ci.serial_number) || stripMarkdown(card.serial_numbering)
  if (isValidSerialNumber(sn)) f.push(sn!)
  return f
}

/**
 * Dispatch by category — mirrors src/lib/labelDataGenerator.ts:1222–1247.
 * Star Wars is detected via card.sub_category since it was demoted from a
 * top-level category to a sub-category of Other.
 */
export function getFeatures(card: CardLike): string[] {
  const ci = card.conversational_card_info || {}
  const category = card.category || 'Other'
  const isSports = SPORTS_CATEGORIES.has(category) || card.sub_category === 'Sports'

  if (isSports) return getSportsFeatures(ci, card)
  switch (category) {
    case 'Pokemon':   return getPokemonFeatures(ci, card)
    case 'MTG':       return getMTGFeatures(ci, card)
    case 'Lorcana':   return getLorcanaFeatures(ci, card)
    case 'One Piece': return getOnePieceFeatures(ci, card)
    case 'Yu-Gi-Oh':  return getYugiohFeatures(ci, card)
    default:
      return card.sub_category === 'Star Wars'
        ? getStarWarsFeatures(ci, card)
        : getOtherFeatures(ci, card)
  }
}
