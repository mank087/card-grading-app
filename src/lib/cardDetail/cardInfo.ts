/**
 * The legacy `cardInfo` object, lifted out of the component.
 *
 * EXTRACTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` 2568-2626
 * [sports 2540-2600]. The precedence chains are copied character for
 * character, including the two that look wrong (see the notes below); nothing
 * has been "fixed" here, because the Card Information block must keep printing
 * what the current page prints.
 *
 * The shared half of the shape is what every category fills in. The Pokemon
 * half (`pokemon_type`, `pokemon_stage`, `hp`, `card_type`, the card-text
 * blocks) is read only by `PokemonCardInfo`; sports fills a different set
 * (`team`, `parallel_type`, the relic flags) read only by `SportsCardInfo`.
 *
 * SPORTS HAS THE OPPOSITE PRECEDENCE — model JSON first, database columns
 * second — and always has. `buildSportsCardInfo` below carries that chain
 * verbatim from `src/app/sports/[id]/CardDetailClient.tsx` 2561-2652; the two
 * are not reconciled here, because both frozen pages must keep printing what
 * they print today.
 */

import { stripMarkdown } from './parsers';
import { categoryUsesRarityBuckets, pickRarity } from '@/lib/rarityBuckets';

export interface LegacyCardInfo {
  card_name: any;
  player_or_character: any;
  /** Set name with " - Subset" appended when a subset is known. */
  set_name: any;
  set_era: any;
  year: any;
  manufacturer: any;
  card_number: any;
  sport_or_category: any;
  serial_number: any;
  rookie_or_first: any;
  subset: any;
  rarity_tier: any;
  autographed: any;
  memorabilia: any;
  card_front_text: any;
  card_back_text: any;

  /* Pokemon-only. */
  pokemon_type: any;
  pokemon_stage: any;
  hp: any;
  card_type: any;

  /* Read by legacy sections that other categories populate. */
  rarity_or_variant?: any;
  authentic?: any;
  holofoil?: any;
  first_edition?: any;
  reverse_holo?: any;

  /* Sports-only (sports CardDetailClient.tsx 2561-2652). Only the sports
     adapter and `SportsCardInfo` read these; they are undefined elsewhere. */
  team?: any;
  parallel_type?: any;
  memorabilia_other?: any;
  subset_insert_name?: any;
  is_refractor?: boolean;
  is_numbered?: boolean;
  is_patch?: boolean;
  is_jersey?: boolean;
  is_game_used?: boolean;
  is_on_card_auto?: boolean;
  is_sticker_auto?: boolean;
  is_variation?: boolean;
  is_short_print?: boolean;
  is_case_hit?: boolean;
  first_print_rookie?: boolean;
  facsimile_autograph?: boolean;
  official_reprint?: boolean;
  special_features?: any;
}

/**
 * Build the object the legacy Card Information block, the price lookup and the
 * marketplace links all read.
 *
 * ONE DELIBERATE DEPARTURE from legacy (owner review 2026-09-22, item 12):
 * `rarity_tier` no longer prints the grader's classification bucket for a
 * non-sports card. See `src/lib/rarityBuckets.ts`. The frozen legacy clients
 * still show the bucket (pokemon CardDetailClient.tsx:2616, 3980).
 *
 * Two legacy quirks are preserved deliberately:
 *   - `memorabilia` is `card.memorabilia_type !== 'none' || …`, so a row whose
 *     `memorabilia_type` is NULL evaluates TRUE. See the report.
 *   - `set_name` already carries the subset, and `subset` is ALSO kept
 *     separately, so a card with a subset prints it twice (once inside Set
 *     Name, once as Subset/Variant).
 */
export function buildCardInfo(card: any, category?: string): LegacyCardInfo {
  const c = card ?? {};
  // The DCM category decides whether `rarity_tier` is a rarity or a bucket.
  // The caller may name it; otherwise the row's own column answers.
  const resolvedCategory = category ?? c.category;
  const dvgCardInfo = c.dvg_grading?.card_info;
  const conv = c.conversational_card_info;

  // `cards.category` on a sports row holds the SPORT ("Baseball"), so the
  // same alias list that decides the rarity question answers this one.
  if (categoryUsesRarityBuckets(resolvedCategory)) {
    return buildSportsCardInfo(c, conv, dvgCardInfo);
  }

  const setNameRaw = c.card_set || stripMarkdown(conv?.set_name) || dvgCardInfo?.set_name;
  const subsetRaw = stripMarkdown(conv?.subset) || c.subset || dvgCardInfo?.subset;
  const setNameWithSubset = subsetRaw ? `${setNameRaw} - ${subsetRaw}` : setNameRaw;
  const releaseYear = typeof c.release_date === 'string' ? c.release_date.slice(0, 4) : null;

  return {
    card_name: c.card_name || stripMarkdown(conv?.card_name) || dvgCardInfo?.card_name,
    player_or_character:
      c.pokemon_featured ||
      c.featured ||
      stripMarkdown(conv?.player_or_character) ||
      dvgCardInfo?.player_or_character,
    set_name: setNameWithSubset,
    set_era: stripMarkdown(conv?.set_era) || dvgCardInfo?.set_era,
    year: releaseYear || stripMarkdown(conv?.year) || dvgCardInfo?.year,
    manufacturer:
      stripMarkdown(conv?.manufacturer) || c.manufacturer_name || dvgCardInfo?.manufacturer,
    // The database column is the verified one; `card_number_raw` carries the
    // printed "94/102" and is preferred over the bare number for display.
    card_number:
      c.card_number ||
      stripMarkdown(conv?.card_number_raw) ||
      stripMarkdown(conv?.card_number) ||
      dvgCardInfo?.card_number,
    sport_or_category:
      c.category || stripMarkdown(conv?.sport_or_category) || dvgCardInfo?.sport_or_category,
    serial_number:
      c.serial_numbering || stripMarkdown(conv?.serial_number) || dvgCardInfo?.serial_number,
    rookie_or_first: c.rookie_card || conv?.rookie_or_first || dvgCardInfo?.rookie_or_first,
    subset: subsetRaw,
    // `cards.rarity_tier` is the grader's CLASSIFICATION BUCKET, and for
    // Pokemon it is almost always 'Parallel / Insert Variant' whatever the
    // card actually is (see lib/rarityBuckets.ts). Outside sports a bucket is
    // skipped so the printed rarity wins; with nothing but buckets on offer
    // this is undefined rather than wrong.
    rarity_tier:
      pickRarity(
        resolvedCategory,
        c.rarity_tier,
        c.rarity_description,
        stripMarkdown(conv?.rarity_tier),
        dvgCardInfo?.rarity_tier,
      ) ?? undefined,
    autographed:
      c.autographed === true || c.autograph_type === 'authentic' || conv?.autographed === true,
    // Legacy: `card.memorabilia_type !== 'none'`. NULL !== 'none' is true.
    memorabilia: c.memorabilia_type !== 'none' || conv?.memorabilia === true,
    card_front_text: conv?.card_front_text || dvgCardInfo?.card_front_text,
    card_back_text: conv?.card_back_text || dvgCardInfo?.card_back_text,

    pokemon_type: c.pokemon_type || stripMarkdown(conv?.pokemon_type) || null,
    pokemon_stage: c.pokemon_stage || stripMarkdown(conv?.pokemon_stage) || null,
    hp: c.hp || stripMarkdown(conv?.hp) || null,
    card_type: c.card_type || stripMarkdown(conv?.card_type) || null,

    rarity_or_variant: conv?.rarity_or_variant,
    authentic: conv?.authentic,
    holofoil: conv?.holofoil ?? c.holofoil,
    first_edition: conv?.first_edition,
    reverse_holo: conv?.reverse_holo,
  };
}

/**
 * The SPORTS half of the same object.
 *
 * EXTRACTED FROM `src/app/sports/[id]/CardDetailClient.tsx` 2561-2652.
 *
 * The precedence is the OPPOSITE of Pokemon's and that is deliberate: the
 * sports page has always read `conversational_card_info` FIRST and only then
 * fallen back to the database columns (its own comment: "v3.2: Use
 * conversational_card_info first, then database fields, then DVG fallback").
 * Phase 1 recorded this divergence; it is reproduced, not reconciled, because
 * the frozen legacy sports page must keep printing what it prints today.
 *
 * Three further sports-only departures from the Pokemon chain, all legacy's:
 *   - `year` is NOT sliced to four characters — sports prints `release_date`
 *     as the row holds it.
 *   - `sport_or_category` reads `conversational_card_info.sport` (the manual
 *     edit) before `.sport_or_category` (the model), and only then `card.sport`.
 *     It never reads `cards.category`.
 *   - `autographed` / `memorabilia` require the column to be present AND not
 *     'none'/'false', so sports does NOT carry the Pokemon page's quirk where
 *     a NULL `memorabilia_type` reads as true.
 */
function buildSportsCardInfo(c: any, conv: any, dvgCardInfo: any): LegacyCardInfo {
  const setNameRaw = stripMarkdown(conv?.set_name) || c.card_set || dvgCardInfo?.set_name;
  const subsetRaw = stripMarkdown(conv?.subset) || c.subset || dvgCardInfo?.subset;
  const setNameWithSubset = subsetRaw ? `${setNameRaw} - ${subsetRaw}` : setNameRaw;

  /** Legacy's column test: present, and neither of the two "no" spellings. */
  const columnSaysYes = (value: any) =>
    !!(value && value !== 'none' && value !== 'false');
  /** Legacy's JSON test: the boolean or either capitalisation of "yes". */
  const jsonSaysYes = (value: any) => value === true || value === 'Yes' || value === 'yes';

  return {
    card_name: stripMarkdown(conv?.card_name) || c.card_name || dvgCardInfo?.card_name,
    player_or_character:
      stripMarkdown(conv?.player_or_character) || c.featured || dvgCardInfo?.player_or_character,
    set_name: setNameWithSubset,
    // Sports has no set-era concept; kept so the shape is one type.
    set_era: stripMarkdown(conv?.set_era) || dvgCardInfo?.set_era,
    year: stripMarkdown(conv?.year) || c.release_date || dvgCardInfo?.year,
    manufacturer:
      stripMarkdown(conv?.manufacturer) || c.manufacturer_name || dvgCardInfo?.manufacturer,
    card_number:
      stripMarkdown(conv?.card_number_raw) ||
      stripMarkdown(conv?.card_number) ||
      c.card_number ||
      dvgCardInfo?.card_number,
    sport_or_category:
      stripMarkdown(conv?.sport) ||
      stripMarkdown(conv?.sport_or_category) ||
      c.sport ||
      dvgCardInfo?.sport_or_category,
    serial_number:
      stripMarkdown(conv?.serial_number) || c.serial_numbering || dvgCardInfo?.serial_number,
    rookie_or_first: conv?.rookie_or_first || c.rookie_card || dvgCardInfo?.rookie_or_first,
    subset: subsetRaw,
    // For sports the grader's buckets ARE the description, so pickRarity
    // passes every candidate through untouched. See lib/rarityBuckets.ts.
    rarity_tier:
      pickRarity('sports', stripMarkdown(conv?.rarity_tier), c.rarity_tier, dvgCardInfo?.rarity_tier) ??
      undefined,
    autographed: jsonSaysYes(conv?.autographed) || columnSaysYes(c.autograph_type),
    memorabilia: jsonSaysYes(conv?.memorabilia) || columnSaysYes(c.memorabilia_type),
    card_front_text: conv?.card_front_text || dvgCardInfo?.card_front_text,
    card_back_text: conv?.card_back_text || dvgCardInfo?.card_back_text,

    /* Pokemon-only fields, absent on a sports row. */
    pokemon_type: null,
    pokemon_stage: null,
    hp: null,
    card_type: c.card_type || stripMarkdown(conv?.card_type) || null,

    // Legacy: rarity_or_variant, then the parallel colour, then the column.
    rarity_or_variant:
      stripMarkdown(conv?.rarity_or_variant) ||
      stripMarkdown(conv?.parallel_type) ||
      c.rarity_description ||
      dvgCardInfo?.rarity_or_variant,
    authentic: conv?.authentic,

    team: stripMarkdown(conv?.team) || null,
    parallel_type: stripMarkdown(conv?.parallel_type) || null,
    memorabilia_other: stripMarkdown(conv?.memorabilia_other) || null,
    subset_insert_name: stripMarkdown(conv?.subset_insert_name) || c.subset_insert_name || null,
    is_refractor: conv?.is_refractor || false,
    is_numbered: conv?.is_numbered || false,
    is_patch: conv?.is_patch || false,
    is_jersey: conv?.is_jersey || false,
    is_game_used: conv?.is_game_used || false,
    is_on_card_auto: conv?.is_on_card_auto || false,
    is_sticker_auto: conv?.is_sticker_auto || false,
    is_variation: conv?.is_variation || false,
    is_short_print: conv?.is_short_print || false,
    is_case_hit: conv?.is_case_hit || false,
    first_print_rookie: conv?.first_print_rookie || false,
    facsimile_autograph: conv?.facsimile_autograph || false,
    official_reprint: conv?.official_reprint || false,
    special_features: conv?.special_features || null,
  };
}

/**
 * Legacy's serial-number filter (4240-4246): the grader answers this field with
 * prose like "Not present" or "None visible" when there is no print run on the
 * card, and none of those may reach the badge.
 */
export function hasPrintRunSerial(serialNumber: unknown): boolean {
  if (typeof serialNumber !== 'string' || !serialNumber) return false;
  if (serialNumber === 'N/A') return false;
  const lower = serialNumber.toLowerCase();
  // `includes('none')` also catches "none visible"; legacy tests all three.
  if (lower.includes('not present')) return false;
  if (lower.includes('none visible')) return false;
  if (lower.includes('none')) return false;
  return true;
}

/** Legacy's rookie test (4258): boolean true, the string "true", or the dvg string. */
export function isRookieOrFirst(cardInfo: LegacyCardInfo, dvgGrading: any): boolean {
  return (
    cardInfo.rookie_or_first === true ||
    cardInfo.rookie_or_first === 'true' ||
    dvgGrading?.rarity_features?.rookie_or_first === 'true'
  );
}

/** Legacy's autograph test (4266-4272). */
export function hasAutograph(cardInfo: LegacyCardInfo, dvgGrading: any): boolean {
  return (
    cardInfo.autographed === true ||
    cardInfo.autographed === 'true' ||
    cardInfo.autographed === 'Yes' ||
    dvgGrading?.autograph?.present === true ||
    dvgGrading?.rarity_features?.autograph?.present === true
  );
}
