/**
 * Pure form logic for EditCardDetailsModal, kept out of the component so it can
 * be unit tested.
 *
 * Two rules, both from Oct 2026 production evidence:
 *   1. Prefill from the card's COLUMNS first. The columns are what owner edits
 *      write; the card-info blob the page hands us could be the grader's original
 *      read. Card 489119: the blob said featured "Lenny Grant", set "Garbage Pail
 *      Kids" long after the owner corrected both.
 *   2. Save only what the owner changed in this form. The form used to send every
 *      field, so a serial-number fix also wrote back every stale prefilled value
 *      and silently reverted the owner's earlier corrections (cards 489119,
 *      351880). The save also carries the identity revision the form was opened
 *      at, so a stale form gets a 409 instead of overwriting newer details.
 */

export const STALE_EDIT_MESSAGE = 'These details changed since you opened them. Reload to see the latest.';

export const EMPTY_EDIT_FORM = {
  // Core fields
  card_name: '',
  featured: '',
  card_set: '',
  card_number_num: '',      // Numerator part (e.g., "018")
  card_number_total: '',    // Denominator part (e.g., "091")
  release_date: '',
  manufacturer_name: '',
  serial_numbering: '',
  // Special features
  autographed: false,
  rookie_card: false,
  memorabilia_type: '',
  memorabilia_other: '',
  rarity_tier: '',
  rarity_description: '',
  // Sports-specific
  sport: '',
  team: '',
  parallel_type: '',
  first_print_rookie: false,
  is_refractor: false,
  is_numbered: false,
  is_patch: false,
  is_jersey: false,
  is_game_used: false,
  is_on_card_auto: false,
  is_sticker_auto: false,
  is_variation: false,
  is_short_print: false,
  is_case_hit: false,
  // Pokemon-specific
  holofoil: '',
  pokemon_type: '',
  pokemon_stage: '',
  hp: '',
  subset_variant: '',
  // Pokemon special features
  is_first_edition: false,
  is_shadowless: false,
  is_reverse_holo: false,
  is_full_art: false,
  is_secret_rare: false,
  is_promo: false,
  is_error_card: false,
  is_illustration_rare: false,
  is_special_art_rare: false,
  is_hyper_rare: false,
  is_gold_rare: false,
  // MTG-specific
  is_foil: false,
  foil_type: '',
  mtg_rarity: '',
  is_double_faced: false,
  mtg_set_code: '',
  // MTG extended fields
  mana_cost: '',
  mtg_card_type: '',
  creature_type: '',
  power_toughness: '',
  color_identity: '',
  artist_name: '',
  border_color: '',
  frame_version: '',
  language: '',
  is_extended_art: false,
  is_showcase: false,
  is_borderless: false,
  is_retro_frame: false,
  is_full_art_mtg: false,
};

export type EditCardFormData = typeof EMPTY_EDIT_FORM;

export const SPORTS_EDIT_CATEGORIES = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];

/** Converts a value to boolean (handles string "false", "true", etc.). */
export function toBoolean(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toLowerCase() === 'true';
  return Boolean(val);
}

/** The first value that is not null, undefined or blank, as a string. */
function firstFilled(...values: unknown[]): string {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const s = String(value);
    if (s.trim() !== '') return s;
  }
  return '';
}

/** Parses a card number into numerator and total parts. */
export function parseCardNumber(cardNum: string | null | undefined, cardNumRaw: string | null | undefined, setTotal: string | null | undefined) {
  // Try card_number_raw first (e.g., "018/091")
  const raw = cardNumRaw || cardNum || '';

  if (raw.includes('/')) {
    const parts = raw.split('/');
    return {
      num: parts[0]?.trim() || '',
      total: parts[1]?.trim() || setTotal || ''
    };
  }

  // If no slash, use card_number as num and set_total as total
  return {
    num: cardNum || raw || '',
    total: setTotal || ''
  };
}

/** Derives a rarity tier from a rarity description. */
export function deriveRarityTier(desc: string): string {
  const lower = (desc || '').toLowerCase();
  if (lower.includes('hyper rare') || lower.includes('rainbow')) return 'hyper_rare';
  if (lower.includes('special art rare') || lower.includes('sar')) return 'special_art_rare';
  if (lower.includes('illustration rare')) return 'illustration_rare';
  if (lower.includes('secret rare')) return 'secret_rare';
  if (lower.includes('ultra rare')) return 'ultra_rare';
  if (lower.includes('holo rare')) return 'holo_rare';
  if (lower.includes('rare')) return 'rare';
  if (lower.includes('uncommon')) return 'uncommon';
  if (lower.includes('common')) return 'common';
  if (lower.includes('promo')) return 'promo';
  return '';
}

/**
 * The year to prefill. The column wins when it is a year the form can save; an
 * older row can hold a full date or a season there, and the form only accepts
 * four digits, so the card-info year is used instead when it is one.
 */
function prefillYear(column: unknown, infoYear: unknown): string {
  const col = firstFilled(column).trim();
  if (/^\d{4}$/.test(col)) return col;
  const year = firstFilled(infoYear).trim();
  if (/^\d{4}$/.test(year)) return year;
  return col || year;
}

/** The form as it should open for this card. Columns first, card-info blob as fallback. */
export function buildEditFormData(card: Record<string, any>): EditCardFormData {
  const info: Record<string, any> = card.conversational_card_info && typeof card.conversational_card_info === 'object'
    ? card.conversational_card_info
    : {};
  const rarityDesc = firstFilled(card.rarity_description, info.rarity_description, info.rarity_or_variant);

  // Parse card number into parts
  // The card_number column is the corrected value; the card-info keys can hold
  // the pre-correction read. A stored set_total is only a fallback denominator
  // when there is no column value: re-saving a corrected bare promo number
  // ("173") must not turn it into "173/215" (Sept 29).
  const cardNumParts = card.card_number
    ? parseCardNumber(card.card_number, card.card_number, null)
    : parseCardNumber(info.card_number, info.card_number_raw, info.set_total);

  // Get holofoil value, checking multiple sources
  const holofoilValue = firstFilled(card.holofoil, info.holofoil);

  // Detect reverse holo from holofoil field (legitimate stored data)
  const isReverseHolo =
    holofoilValue.toLowerCase() === 'reverse' ||
    holofoilValue.toLowerCase() === 'reverse holo';

  return {
    // Identity fields with a column: the column, then the card-info blob
    card_name: firstFilled(card.card_name, info.card_name),
    featured: firstFilled(card.featured, info.player_or_character),
    card_set: firstFilled(card.card_set, info.set_name),
    // Card number split into parts
    card_number_num: cardNumParts.num,
    card_number_total: cardNumParts.total,
    release_date: prefillYear(card.release_date, info.year),
    manufacturer_name: firstFilled(card.manufacturer_name, info.manufacturer),
    serial_numbering: firstFilled(card.serial_numbering, info.serial_number),
    autographed: toBoolean(info.autographed) || toBoolean(card.autographed),
    rookie_card: toBoolean(info.rookie_or_first) || toBoolean(card.rookie_card),
    memorabilia_type: firstFilled(card.memorabilia_type, info.memorabilia),
    memorabilia_other: firstFilled(info.memorabilia_other),
    // Rarity: stored tier first, then derive from rarity description
    rarity_tier: firstFilled(card.rarity_tier, info.rarity_tier) || deriveRarityTier(rarityDesc),
    rarity_description: rarityDesc,
    // Sports-specific fields
    sport: firstFilled(info.sport, card.sport),
    team: firstFilled(info.team, card.team),
    parallel_type: firstFilled(info.parallel_type, info.rarity_or_variant),
    first_print_rookie: toBoolean(info.first_print_rookie) || toBoolean(card.first_print_rookie),
    is_refractor: toBoolean(info.is_refractor) || toBoolean(card.is_refractor),
    is_numbered: toBoolean(info.is_numbered) || toBoolean(card.is_numbered),
    is_patch: toBoolean(info.is_patch) || toBoolean(card.is_patch),
    is_jersey: toBoolean(info.is_jersey) || toBoolean(card.is_jersey),
    is_game_used: toBoolean(info.is_game_used) || toBoolean(card.is_game_used),
    is_on_card_auto: toBoolean(info.is_on_card_auto) || toBoolean(card.is_on_card_auto),
    is_sticker_auto: toBoolean(info.is_sticker_auto) || toBoolean(card.is_sticker_auto),
    is_variation: toBoolean(info.is_variation) || toBoolean(card.is_variation),
    is_short_print: toBoolean(info.is_short_print) || toBoolean(card.is_short_print),
    is_case_hit: toBoolean(info.is_case_hit) || toBoolean(card.is_case_hit),
    // Pokemon-specific fields
    holofoil: holofoilValue,
    pokemon_type: firstFilled(card.pokemon_type, info.pokemon_type),
    pokemon_stage: firstFilled(card.pokemon_stage, info.pokemon_stage),
    hp: firstFilled(card.hp, info.hp),
    subset_variant: firstFilled(info.subset, info.rarity_or_variant, info.subset_insert_name),
    // Pokemon special features (detected or stored)
    is_first_edition: toBoolean(info.is_first_edition) || toBoolean(card.is_first_edition),
    is_shadowless: toBoolean(info.is_shadowless) || toBoolean(card.is_shadowless),
    is_reverse_holo: toBoolean(info.is_reverse_holo) || toBoolean(card.is_reverse_holo) || isReverseHolo,
    is_full_art: toBoolean(info.is_full_art) || toBoolean(card.is_full_art),
    is_secret_rare: toBoolean(info.is_secret_rare) || toBoolean(card.is_secret_rare),
    is_promo: toBoolean(info.is_promo) || toBoolean(card.is_promo),
    is_error_card: toBoolean(info.is_error_card) || toBoolean(card.is_error_card),
    is_illustration_rare: toBoolean(info.is_illustration_rare) || toBoolean(card.is_illustration_rare),
    is_special_art_rare: toBoolean(info.is_special_art_rare) || toBoolean(card.is_special_art_rare),
    is_hyper_rare: toBoolean(info.is_hyper_rare) || toBoolean(card.is_hyper_rare),
    is_gold_rare: toBoolean(info.is_gold_rare) || toBoolean(card.is_gold_rare),
    // MTG-specific
    is_foil: toBoolean(info.is_foil) || toBoolean(card.is_foil),
    foil_type: firstFilled(card.foil_type, info.foil_type),
    mtg_rarity: firstFilled(card.mtg_rarity, info.mtg_rarity),
    is_double_faced: toBoolean(info.is_double_faced) || toBoolean(card.is_double_faced),
    mtg_set_code: firstFilled(card.mtg_set_code, info.expansion_code),
    // MTG extended fields
    mana_cost: firstFilled(info.mana_cost, card.mana_cost),
    mtg_card_type: firstFilled(info.mtg_card_type, card.mtg_card_type),
    creature_type: firstFilled(info.creature_type, card.creature_type),
    power_toughness: firstFilled(info.power_toughness, card.power_toughness),
    color_identity: firstFilled(info.color_identity, card.color_identity),
    artist_name: firstFilled(info.artist_name, card.artist_name),
    border_color: firstFilled(info.border_color, card.border_color),
    frame_version: firstFilled(info.frame_version, card.frame_version),
    language: firstFilled(info.language, card.card_language) || 'English',
    is_extended_art: toBoolean(info.is_extended_art) || toBoolean(card.is_extended_art),
    is_showcase: toBoolean(info.is_showcase) || toBoolean(card.is_showcase),
    is_borderless: toBoolean(info.is_borderless) || toBoolean(card.is_borderless),
    is_retro_frame: toBoolean(info.is_retro_frame) || toBoolean(card.is_retro_frame),
    is_full_art_mtg: toBoolean(info.is_full_art_mtg) || toBoolean(card.is_full_art_mtg),
  };
}

/** Every field this category's editor can save, as the details route expects them. */
export function buildEditPayload(formData: EditCardFormData, category?: string | null): Record<string, any> {
  const isPokemon = category === 'Pokemon';
  const isMTG = category === 'MTG';
  const isSports = SPORTS_EDIT_CATEGORIES.includes(category || '');

  // Handle card number based on category
  const cardNumber = isSports
    ? formData.card_number_num || ''
    : (formData.card_number_num && formData.card_number_total
      ? `${formData.card_number_num}/${formData.card_number_total}`
      : formData.card_number_num || '');

  const commonFields = {
    card_name: formData.card_name,
    featured: formData.featured,
    card_set: formData.card_set,
    card_number: cardNumber,
    release_date: formData.release_date,
    manufacturer_name: formData.manufacturer_name,
    serial_numbering: formData.serial_numbering,
    autographed: formData.autographed,
    rookie_card: formData.rookie_card,
    rarity_tier: formData.rarity_tier,
    rarity_description: formData.rarity_description,
  };

  if (isPokemon) {
    return {
      ...commonFields,
      holofoil: formData.holofoil,
      pokemon_type: formData.pokemon_type,
      pokemon_stage: formData.pokemon_stage,
      hp: formData.hp,
      subset_variant: formData.subset_variant,
      is_first_edition: formData.is_first_edition,
      is_shadowless: formData.is_shadowless,
      is_reverse_holo: formData.is_reverse_holo,
      is_full_art: formData.is_full_art,
      is_secret_rare: formData.is_secret_rare,
      is_promo: formData.is_promo,
      is_error_card: formData.is_error_card,
      is_illustration_rare: formData.is_illustration_rare,
      is_special_art_rare: formData.is_special_art_rare,
      is_hyper_rare: formData.is_hyper_rare,
      is_gold_rare: formData.is_gold_rare,
    };
  }
  if (isSports) {
    return {
      ...commonFields,
      sport: formData.sport,
      team: formData.team,
      parallel_type: formData.parallel_type,
      memorabilia_type: formData.memorabilia_type,
      memorabilia_other: formData.memorabilia_other,
      first_print_rookie: formData.first_print_rookie,
      is_refractor: formData.is_refractor,
      is_numbered: formData.is_numbered,
      is_patch: formData.is_patch,
      is_jersey: formData.is_jersey,
      is_game_used: formData.is_game_used,
      is_on_card_auto: formData.is_on_card_auto,
      is_sticker_auto: formData.is_sticker_auto,
      is_variation: formData.is_variation,
      is_short_print: formData.is_short_print,
      is_case_hit: formData.is_case_hit,
    };
  }
  if (isMTG) {
    return {
      ...commonFields,
      is_foil: formData.is_foil,
      foil_type: formData.foil_type,
      mtg_rarity: formData.mtg_rarity,
      is_double_faced: formData.is_double_faced,
      mtg_set_code: formData.mtg_set_code,
      mana_cost: formData.mana_cost,
      mtg_card_type: formData.mtg_card_type,
      creature_type: formData.creature_type,
      power_toughness: formData.power_toughness,
      color_identity: formData.color_identity,
      artist_name: formData.artist_name,
      border_color: formData.border_color,
      frame_version: formData.frame_version,
      language: formData.language,
      is_extended_art: formData.is_extended_art,
      is_showcase: formData.is_showcase,
      is_borderless: formData.is_borderless,
      is_retro_frame: formData.is_retro_frame,
      is_full_art_mtg: formData.is_full_art_mtg,
      is_promo: formData.is_promo,
    };
  }
  return { ...commonFields };
}

function sameEditValue(a: unknown, b: unknown): boolean {
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim();
  return a === b;
}

/**
 * The PATCH body for a save: only the fields that differ from what the form
 * opened with, plus the identity revision it opened at (when the card has one).
 * Returns null when nothing changed, so there is nothing to send.
 *
 * Case is NOT folded: correcting "pikachu" to "Pikachu" is a real edit.
 */
export function changedEditPayload(
  formData: EditCardFormData,
  initialFormData: EditCardFormData,
  category?: string | null,
  identityRevision?: unknown,
): Record<string, any> | null {
  const next = buildEditPayload(formData, category);
  const opened = buildEditPayload(initialFormData, category);
  const payload: Record<string, any> = {};
  for (const [key, value] of Object.entries(next)) {
    if (!sameEditValue(value, opened[key])) payload[key] = value;
  }
  if (Object.keys(payload).length === 0) return null;
  if (typeof identityRevision === 'number' && Number.isInteger(identityRevision)) {
    payload.expected_identity_revision = identityRevision;
  }
  return payload;
}

/** True for the details route's "someone changed this card since you opened it" answer. */
export function isIdentityConflict(status: number, body: unknown): boolean {
  return status === 409 || (!!body && typeof body === 'object' && (body as any).code === 'identity_revision_conflict');
}
