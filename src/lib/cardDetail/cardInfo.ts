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
 * (`team`, `parallel_type`, the relic flags) which the sports adapter will add
 * when that category lands.
 */

import { stripMarkdown } from './parsers';
import { pickRarity } from '@/lib/rarityBuckets';

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
