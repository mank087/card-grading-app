/**
 * eBay listing field resolver — one card row in, one normalized field set out.
 *
 * Titles, item specifics and the description all used to read the card row
 * themselves, with slightly different precedence in each place, so a card
 * could show "Silver Prizm" in its specifics and nothing in its title. This is
 * now the single reader: everything downstream consumes ListingFields.
 *
 * Precedence follows what itemSpecifics.ts already did — conversational_card_info
 * (the model's structured read of the card) first, then the flat columns the
 * card-ID pipeline writes.
 *
 * Nothing here invents a column. Fields with no flat column on `cards` (team,
 * parallel, card type, stage) come from conversational_card_info only.
 *
 * TWIN: dcm-mobile/lib/ebayListingFields.ts carries the subset the mobile
 * title builder needs. Keep the shared tables (GAME_WORDS, sport/league maps)
 * identical — npm run check:twin-drift enforces it.
 */

import {
  hasUnverifiedAutographDesignation,
  UNVERIFIED_AUTOGRAPH_DESIGNATION,
} from '@/lib/grading/autographPolicy';

export type ListingCategory =
  | 'sports'
  | 'pokemon'
  | 'mtg'
  | 'lorcana'
  | 'onepiece'
  | 'yugioh'
  | 'starwars'
  | 'other';

export interface ListingFields {
  /** Normalized DCM category, the key every per-category table is keyed by. */
  category: ListingCategory;
  /** Player / character / card name — the title's anchor, never dropped. */
  name: string;
  year: string;
  manufacturer: string;
  setName: string;
  /** Insert / subset name (sports) — "Downtown", "Kaboom". */
  subset: string;
  /** Bare card number, no leading '#'. */
  cardNumber: string;
  /** Parallel / variety / variant — the biggest missing sports keyword. */
  parallel: string;
  rarity: string;
  rookie: boolean;
  autograph: boolean;
  /** "Hard Signed" | "Sticker" | '' — eBay's Autograph Format values. */
  autographFormat: string;
  /** Full serial numbering as printed, e.g. "12/99". */
  serialNumbering: string;
  /** Denominator only, e.g. "/99" — the compact title form. */
  serialDenominator: string;
  language: string;
  /** English cards omit the language token from the title. */
  isEnglish: boolean;
  team: string;
  sport: string;
  league: string;
  /** "2023" or "2023-24" for NBA/NHL. */
  season: string;
  /** Holo | Reverse Holo | Foil | Enchanted | Regular | '' */
  finish: string;
  /** Pokemon/Lorcana/SWU "Card Type" or evolution stage. */
  cardType: string;
  /** Game or sport word buyers type: "Pokemon Card", "MTG", "Football". */
  gameWord: string;
  /**
   * Grade NOTATION carried alongside the number, e.g. v9.23's
   * "Altered - Unverified Autograph". It does NOT suppress the grade: those
   * cards keep their full numeric grade on the slab, on the label and in
   * eBay's 27502 condition descriptor, so the listing must say the same
   * number. null when the card carries no notation.
   */
  designation: string | null;
  /** null only when the card genuinely has no numeric grade. */
  grade: number | null;
  conditionLabel: string;
  /** Display serial: org serial for enterprise cards, DCM serial otherwise. */
  serial: string;
  /** eBay's own Vintage filter cutoff. */
  vintage: boolean;
  countryOfManufacture: string;
}

/* ------------------------------------------------------------------ */
/* Shared tables (twinned with mobile)                                 */
/* ------------------------------------------------------------------ */

/**
 * The word buyers actually type for each category. Always present in a title:
 * it disambiguates the category to eBay's search engine.
 *
 * SHORT forms on purpose — "Pokemon", not "Pokemon Card". The trailing
 * "Card"/"Card Game" adds nothing a buyer searches for and costs characters
 * the parallel or the serial numbering needs.
 */
export const GAME_WORDS: Record<ListingCategory, string> = {
  sports: '',            // replaced by the detected sport (Football, Baseball…)
  pokemon: 'Pokemon',
  mtg: 'MTG',
  lorcana: 'Lorcana',
  onepiece: 'One Piece',
  yugioh: 'Yu-Gi-Oh',
  // No short form exists; ranked low in the swu token table instead.
  starwars: 'Star Wars Unlimited',
  other: 'Trading Card',
};

/** Manufacturer per game — eBay's Manufacturer aspect and the details table. */
export const GAME_MANUFACTURERS: Record<ListingCategory, string> = {
  sports: '',
  pokemon: 'The Pokemon Company',
  mtg: 'Wizards of the Coast',
  lorcana: 'Ravensburger',
  onepiece: 'Bandai',
  yugioh: 'Konami',
  starwars: 'Fantasy Flight Games',
  other: '',
};

const SPORT_CATEGORIES = [
  'football', 'baseball', 'basketball', 'hockey', 'soccer',
  'golf', 'tennis', 'wrestling', 'boxing', 'racing', 'ufc', 'mma',
];

const LEAGUE_BY_SPORT: Record<string, string> = {
  Baseball: 'MLB',
  Football: 'NFL',
  Basketball: 'NBA',
  Hockey: 'NHL',
  Soccer: 'MLS',
};

/** Sports whose season spans two calendar years ("2023-24"). */
const SPLIT_SEASON_SPORTS = ['Basketball', 'Hockey'];

/* ------------------------------------------------------------------ */
/* Value helpers (shared with itemSpecifics.ts, which re-exports them)  */
/* ------------------------------------------------------------------ */

/**
 * Values the model writes to mean "no value" — never send these to eBay.
 * "no" and "false" are NOT here: they are legitimate answers to a yes/no
 * aspect like Autographed. Serial numbers get the extra check below.
 */
const EMPTY_VALUES = new Set([
  '', 'n/a', 'na', 'none', 'unknown', 'null', 'undefined', '??', '-', '--',
]);

/** Extra "means none" spellings the model writes into serial_number. */
const INVALID_SERIAL_VALUES = new Set(['no', 'false', '0', 'not numbered', 'unnumbered']);

/** Trim, collapse whitespace, and map the model's "no value" spellings to ''. */
export function cleanFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : '';
  const s = String(value).replace(/\s+/g, ' ').trim();
  return EMPTY_VALUES.has(s.toLowerCase()) ? '' : s;
}

/** Is this a value worth sending to eBay at all? */
export function isMeaningfulValue(value: unknown): boolean {
  return cleanFieldValue(value).length > 0;
}

/** First meaningful value in the list, or ''. */
function firstOf(...values: unknown[]): string {
  for (const v of values) {
    const cleaned = cleanFieldValue(v);
    if (cleaned) return cleaned;
  }
  return '';
}

function truthyFlag(...values: unknown[]): boolean {
  for (const v of values) {
    if (v === true) return true;
    if (typeof v === 'string' && ['yes', 'true', '1'].includes(v.trim().toLowerCase())) return true;
  }
  return false;
}

/** Extract a 4-digit year from a date string, or pass it through unchanged. */
export function extractYear(dateString: string): string {
  if (!dateString) return '';
  const yearMatch = dateString.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) return yearMatch[0];
  if (/^\d{4}$/.test(dateString.trim())) return dateString.trim();
  return dateString;
}

/**
 * Detect the language for the eBay Language item specific.
 *
 * Prefers an explicit language field (the same sources the card detail pages
 * use). Otherwise falls back to script detection — Hiragana, Katakana or CJK
 * ideographs in the card/set name mean Japanese. Defaults to English.
 */
export function detectCardLanguage(card: any): string {
  const cardInfo = card?.conversational_card_info || {};

  const explicit = cardInfo.language || card?.card_language || card?.language;
  if (typeof explicit === 'string' && explicit.trim()) {
    return explicit.trim();
  }

  const textToCheck = [card?.card_name, cardInfo.card_name, cardInfo.set_name, card?.card_set]
    .filter(Boolean)
    .join(' ');

  // Hiragana/Katakana (U+3040-U+30FF) or CJK ideographs (U+4E00-U+9FFF)
  if (/[぀-ヿ一-鿿]/.test(textToCheck)) return 'Japanese';

  return 'English';
}

/** Serial numbering as printed on the card ("12/99", "/25", "1/1"), or null. */
export function getSerialNumbering(card: any): string | null {
  const cardInfo = card?.conversational_card_info || {};
  const serialNum = firstOf(
    cardInfo.serial_number,
    cardInfo.serial_number_fraction,
    card?.serial_numbering
  );
  if (!serialNum || INVALID_SERIAL_VALUES.has(serialNum.toLowerCase())) return null;
  return serialNum;
}

/**
 * Denominator of a serial number ("12/99" -> "/99") for compact title use.
 *
 * A one-of-one is the exception: "/1" reads as a truncated typo, and the token
 * every buyer actually searches is "1/1", so the full form is returned.
 */
export function getSerialDenominator(serialNumber: string | null): string | null {
  if (!serialNumber) return null;
  const match = serialNumber.match(/\/(\d+)/);
  if (!match) return null;
  return match[1] === '1' ? '1/1' : `/${match[1]}`;
}

/**
 * Values autograph_type carries that mean "there is no hand-applied
 * signature". A facsimile / printed signature is part of the card's artwork —
 * listing it as Autographed is a misrepresentation, and "no" as a stored type
 * used to flip the flag ON purely because the string was non-empty.
 */
const NOT_AUTOGRAPHED_TYPES = new Set([
  'no', 'false', 'none', 'facsimile', 'printed', 'pre-print', 'preprint', 'n/a',
]);

/** Does the card carry a hand-applied autograph, from any known source? */
export function hasAutograph(card: any): boolean {
  const cardInfo = card?.conversational_card_info || {};
  const type = cleanFieldValue(card?.autograph_type).toLowerCase();
  if (type && NOT_AUTOGRAPHED_TYPES.has(type)) return false;
  if (truthyFlag(cardInfo.autographed, card?.autographed)) return true;
  return type.length > 0;
}

/**
 * eBay's Autograph Format values, from the stored autograph_type.
 *
 * Returns '' when the type is not actually known — an autograph flagged with
 * no type used to default to "Hard Signed", which asserts to a buyer that the
 * signature is on-card when we never determined that.
 */
function resolveAutographFormat(card: any): string {
  const type = cleanFieldValue(card?.autograph_type).toLowerCase();
  if (type.includes('sticker')) return 'Sticker';
  if (type.includes('on-card') || type.includes('on card') || type.includes('hard')) return 'Hard Signed';
  return '';
}

/** Sport name from a DCM category/sub-category string. */
export function detectSport(category: string): string {
  if (!category) return '';
  const lower = category.toLowerCase();
  if (lower.includes('baseball')) return 'Baseball';
  if (lower.includes('football')) return 'Football';
  if (lower.includes('basketball')) return 'Basketball';
  if (lower.includes('hockey')) return 'Hockey';
  if (lower.includes('soccer')) return 'Soccer';
  if (lower.includes('wrestling')) return 'Wrestling';
  if (lower.includes('golf')) return 'Golf';
  if (lower.includes('tennis')) return 'Tennis';
  if (lower.includes('racing') || lower.includes('nascar')) return 'Racing';
  if (lower.includes('boxing') || lower.includes('ufc') || lower.includes('mma')) return 'Boxing';
  return '';
}

/** League for a sport, or '' when eBay has no obvious single league. */
export function detectLeague(sport: string): string {
  return LEAGUE_BY_SPORT[sport] || '';
}

/**
 * Normalize any category spelling ('One Piece', 'onepiece', 'Yu-Gi-Oh!',
 * 'football') to the ListingCategory the token tables are keyed by.
 */
export function normalizeListingCategory(value: string | null | undefined): ListingCategory {
  const normalized = (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (
    normalized === 'pokemon' || normalized === 'mtg' || normalized === 'lorcana' ||
    normalized === 'onepiece' || normalized === 'yugioh' || normalized === 'starwars' ||
    normalized === 'sports' || normalized === 'other'
  ) {
    return normalized as ListingCategory;
  }
  if (SPORT_CATEGORIES.includes(normalized)) return 'sports';
  return 'other';
}

/* ------------------------------------------------------------------ */
/* The resolver                                                        */
/* ------------------------------------------------------------------ */

/**
 * Resolve a raw `cards` row into the normalized listing field set.
 *
 * `cardType` is the DCM category the caller already decided on (the modal's
 * prop, the image-prep page's derivation). Omit it and the card's own
 * category column is used.
 */
export function resolveListingFields(card: any, cardType?: string): ListingFields {
  const ci = card?.conversational_card_info || {};
  const category = normalizeListingCategory(cardType || card?.category);

  const name = firstOf(
    ci.player_or_character,
    card?.featured,
    card?.pokemon_featured,
    ci.card_name,
    card?.card_name
  );

  const year = extractYear(
    firstOf(ci.year, ci.set_year, ci.card_date, ci.release_date, card?.release_date)
  );
  const yearNumber = /^\d{4}$/.test(year) ? Number(year) : null;

  const sport = category === 'sports'
    ? detectSport(firstOf(card?.sub_category, card?.category, ci.category, ci.sport))
    : '';
  const league = sport ? detectLeague(sport) : '';

  // Season: eBay wants "2023-24" for the sports whose season spans two years.
  let season = '';
  if (category === 'sports' && yearNumber) {
    season = SPLIT_SEASON_SPORTS.includes(sport)
      ? `${yearNumber}-${String((yearNumber + 1) % 100).padStart(2, '0')}`
      : String(yearNumber);
  }

  const serialNumbering = getSerialNumbering(card) || '';
  const language = detectCardLanguage(card);

  // Finish: holo/reverse/foil live in different columns per game, and the
  // model also writes free text into conversational_card_info.
  const finishText = firstOf(
    ci.finish,
    ci.holofoil,
    card?.holofoil,
    card?.foil_type,
    ci.foil_type
  ).toLowerCase();
  let finish = '';
  if (finishText.includes('reverse')) finish = 'Reverse Holo';
  else if (finishText.includes('holo')) finish = 'Holo';
  else if (finishText.includes('foil')) finish = 'Foil';
  if (!finish && truthyFlag(card?.is_foil, ci.foil)) finish = 'Foil';
  if (truthyFlag(card?.is_enchanted, ci.enchanted)) finish = 'Enchanted';

  const rarity = firstOf(ci.rarity, card?.mtg_rarity, card?.rarity_tier, card?.rarity_description);

  // v9.23 designation. It is a NOTATION, never a grade suppressor: an
  // unverified-autograph card keeps its full numeric grade (Bob's card is a
  // 10), so the title still says 10 and only the description adds the wording.
  const conditionLabel = cleanFieldValue(card?.conversational_condition_label);
  const designation = hasUnverifiedAutographDesignation(card || {})
    ? UNVERIFIED_AUTOGRAPH_DESIGNATION
    : null;

  const gradeRaw = card?.conversational_whole_grade ?? card?.conversational_decimal_grade;
  const grade = Number.isFinite(Number(gradeRaw)) && Number(gradeRaw) > 0
    ? Math.round(Number(gradeRaw))
    : null;

  return {
    category,
    name,
    year,
    manufacturer: firstOf(ci.manufacturer, card?.manufacturer, GAME_MANUFACTURERS[category]),
    setName: firstOf(ci.set_name, card?.card_set),
    subset: firstOf(ci.subset, ci.insert_set),
    cardNumber: firstOf(ci.card_number, card?.card_number).replace(/^#/, ''),
    parallel: firstOf(ci.parallel, ci.variety, ci.op_variant_type, ci.variant),
    rarity,
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
    season,
    finish,
    cardType: firstOf(ci.card_type, ci.stage),
    gameWord: category === 'sports' ? sport : GAME_WORDS[category],
    designation,
    grade,
    conditionLabel,
    serial: firstOf(card?.org_serial_display, card?.serial),
    // eBay's own Vintage filter cutoff for trading cards.
    vintage: yearNumber !== null && yearNumber <= 1999,
    // Only asserted for Japanese-language cards, which are printed in Japan.
    // "United States" for everything else was a guess: Panini prints in the US
    // but Topps Chrome is Japan, and plenty of TCG stock is neither.
    countryOfManufacture: language.toLowerCase() === 'japanese' ? 'Japan' : '',
  };
}

/**
 * One natural sentence of search terms for the description footer. Only
 * attributes that are TRUE of this card (eBay's keyword-spamming policy draws
 * the line there), joined as prose rather than a keyword dump.
 */
export function buildKeywordSentence(
  fields: ListingFields,
  gradeLabel: string,
  grade: number | null
): string {
  const terms = [
    fields.name,
    fields.year,
    fields.setName,
    fields.subset,
    fields.parallel,
    fields.rookie ? 'rookie card' : '',
    fields.autograph ? 'autographed' : '',
    fields.serialNumbering ? `numbered ${fields.serialNumbering}` : '',
    fields.finish,
    fields.team,
    fields.gameWord,
    'graded',
    grade !== null ? `${gradeLabel} ${grade}` : `${gradeLabel} Authentic`,
  ].filter(Boolean);

  // De-dupe case-insensitively so "Pokemon Card" doesn't follow a set name
  // that already says it.
  const seen = new Set<string>();
  const unique = terms.filter(t => {
    const key = t.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Plain prose, no "Keywords:" label — a labelled list reads as stuffing to
  // both a buyer and a policy reviewer, and the sentence works either way.
  return `${unique.join(', ')}.`;
}

/*
 * NOTE (Sept 2): there is no per-area evidence source safe to read in bulk.
 * conversational_defects_front/_back have been null on every card graded since
 * April; the live equivalent the card detail page reads is
 * conversational_corners_edges_surface, which embeds full defect arrays (30+
 * character descriptions plus coordinate maps, up to ~24 per card) and is far
 * too heavy for the 2,000-row select the listing picker runs. So the listing
 * description carries the grade summary only, with no per-area evidence lines.
 * If a narrow evidence column ever lands, resolve it here.
 */

/**
 * The card's non-empty fields as label/value rows, in the order the
 * description's details table renders them. Empty values are already gone —
 * an empty row is worse than an absent one on both eBay and the page.
 */
export function listingDetailRows(fields: ListingFields): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [
    { label: fields.category === 'sports' ? 'Player' : 'Character / Card', value: fields.name },
    { label: 'Year', value: fields.year },
    { label: 'Manufacturer', value: fields.manufacturer },
    { label: 'Set', value: fields.setName },
    { label: 'Subset / Insert', value: fields.subset },
    { label: 'Card Number', value: fields.cardNumber ? `#${fields.cardNumber}` : '' },
    { label: 'Parallel / Variety', value: fields.parallel },
    { label: 'Rarity', value: fields.rarity },
    { label: 'Rookie Card', value: fields.rookie ? 'Yes' : '' },
    { label: 'Autograph', value: fields.autograph ? (fields.autographFormat || 'Yes') : '' },
    { label: 'Serial Numbering', value: fields.serialNumbering },
    { label: 'Language', value: fields.language },
    { label: 'Team', value: fields.team },
    { label: 'Sport', value: fields.sport },
    { label: 'League', value: fields.league },
    { label: 'Finish', value: fields.finish },
    { label: 'Card Type', value: fields.cardType },
  ];
  return rows.filter(r => isMeaningfulValue(r.value));
}
