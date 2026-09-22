/**
 * The six remaining categories' `cardInfo` precedence chains.
 *
 * A sibling of ./cardInfo.ts, which owns the shape, the Pokemon chain, the
 * sports chain and the dispatch. This file exists only so neither grows past
 * the size the redesign plan allows; nothing else imports it.
 *
 * Every chain below is copied character for character from the frozen legacy
 * client named above it. Nothing is reconciled and nothing is "fixed": the
 * legacy page and the V2 page must print the same fields from the same
 * sources. The one exception is `rarity_tier`, which runs through `pickRarity`
 * in every non-sports branch — the V2-wide departure made for Pokemon, so a
 * grader CLASSIFICATION BUCKET is skipped instead of being printed as the
 * card's rarity (see @/lib/rarityBuckets).
 */

import { stripMarkdown } from './parsers';
import { pickRarity } from '@/lib/rarityBuckets';
import type { LegacyCardInfo } from './cardInfo';

/* ────────────────────────────────────────────────────────────────────────────
 * The six remaining categories.
 *
 * Three precedence families, and the family a category belongs to is legacy's
 * choice, not a new one:
 *
 *   DATABASE-COLUMN FIRST   pokemon (above), lorcana
 *   MODEL-JSON FIRST        sports (above), mtg, onepiece, yugioh, starwars,
 *                           other
 *
 * The four JSON-first TCGs (mtg, onepiece, yugioh, starwars) are the SAME
 * chain character for character — the four legacy files were copied from one
 * another, comments and all (yugioh and starwars still carry One Piece's
 * "🏴‍☠️ ONE PIECE CARD INFO" heading). Only the manufacturer default and the
 * category-specific field block differ, so they share one builder here.
 * `other` is close but not identical and keeps its own.
 * ──────────────────────────────────────────────────────────────────────────── */

/** `'Yu-Gi-Oh!'` → `'yugioh'`. Matches `categoryUsesRarityBuckets`'s rule. */
export function normalizeCategoryKey(category: unknown): string {
  if (typeof category !== 'string') return '';
  return category.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The manufacturer each JSON-first TCG legacy client falls back to when the
 * record carries none (mtg 2653, onepiece 2604, yugioh 2641, starwars 2617).
 * Membership in this map is also what selects the shared builder.
 */
export const TCG_DEFAULT_MANUFACTURER: Record<string, string> = {
  mtg: 'Wizards of the Coast',
  onepiece: 'Bandai',
  yugioh: 'Konami',
  starwars: 'Topps',
};

/**
 * Frame TREATMENTS are not subsets, so the four JSON-first TCG clients refuse
 * to append one to the set name (mtg 2635-2643 and its three copies).
 */
const FRAME_TREATMENTS = [
  'showcase',
  'borderless',
  'extended art',
  'full art',
  'etched',
  'retro',
  'anime',
];

export function isFrameTreatment(subset: unknown): boolean {
  if (typeof subset !== 'string' || !subset) return false;
  const lower = subset.toLowerCase();
  return FRAME_TREATMENTS.some((t) => lower.includes(t));
}

/**
 * MTG / One Piece / Yu-Gi-Oh / Star Wars.
 *
 * EXTRACTED FROM `src/app/mtg/[id]/CardDetailClient.tsx` 2628-2698, with
 * onepiece 2578-2650, yugioh 2615-2687 and starwars 2591-2662 diffed against
 * it line for line; the shared half is identical in all four.
 *
 * ONE DELIBERATE DEPARTURE, the V2-wide one already made for Pokemon:
 * `rarity_tier` runs through `pickRarity`, so a grader CLASSIFICATION BUCKET
 * is skipped rather than printed as the card's rarity. The frozen legacy
 * clients still print the bucket.
 */
export function buildTcgCardInfo(
  c: any,
  conv: any,
  dvgCardInfo: any,
  key: string,
): LegacyCardInfo {
  const setNameRaw = stripMarkdown(conv?.set_name) || c.card_set || dvgCardInfo?.set_name;
  const subsetRaw = stripMarkdown(conv?.subset) || c.subset || dvgCardInfo?.subset;
  const setNameWithSubset =
    setNameRaw && subsetRaw && !isFrameTreatment(subsetRaw)
      ? `${setNameRaw} - ${subsetRaw}`
      : setNameRaw || null;

  const shared: LegacyCardInfo = {
    card_name: stripMarkdown(conv?.card_name) || c.card_name || dvgCardInfo?.card_name,
    player_or_character:
      stripMarkdown(conv?.player_or_character) ||
      c.pokemon_featured ||
      c.featured ||
      dvgCardInfo?.player_or_character,
    set_name: setNameWithSubset,
    set_era: stripMarkdown(conv?.set_era) || dvgCardInfo?.set_era,
    // NOT sliced to four characters: these four print `release_date` raw.
    year: stripMarkdown(conv?.year) || c.release_date || dvgCardInfo?.year,
    manufacturer:
      stripMarkdown(conv?.manufacturer) || c.manufacturer_name || TCG_DEFAULT_MANUFACTURER[key],
    card_number:
      stripMarkdown(conv?.card_number) ||
      stripMarkdown(conv?.collector_number) ||
      c.card_number ||
      dvgCardInfo?.card_number,
    sport_or_category:
      stripMarkdown(conv?.sport_or_category) || c.category || dvgCardInfo?.sport_or_category,
    serial_number:
      stripMarkdown(conv?.serial_number) || c.serial_numbering || dvgCardInfo?.serial_number,
    rookie_or_first: conv?.rookie_or_first || c.rookie_card || dvgCardInfo?.rookie_or_first,
    subset: subsetRaw,
    rarity_tier:
      pickRarity(
        key,
        stripMarkdown(conv?.rarity_tier),
        c.rarity_tier,
        c.rarity_description,
        dvgCardInfo?.rarity_tier,
      ) ?? undefined,
    autographed:
      conv?.autographed === true || c.autographed === true || c.autograph_type === 'authentic',
    // Legacy's quirk, kept: NULL !== 'none' is true.
    memorabilia: conv?.memorabilia === true || c.memorabilia_type !== 'none',
    card_front_text: conv?.card_front_text || dvgCardInfo?.card_front_text,
    card_back_text: conv?.card_back_text || dvgCardInfo?.card_back_text,

    pokemon_type: stripMarkdown(conv?.pokemon_type) || c.pokemon_type || null,
    pokemon_stage: stripMarkdown(conv?.pokemon_stage) || c.pokemon_stage || null,
    hp: stripMarkdown(conv?.hp) || c.hp || null,
    card_type: stripMarkdown(conv?.card_type) || c.card_type || null,

    expansion_code: stripMarkdown(conv?.expansion_code) || c.expansion_code || null,
    collector_number:
      stripMarkdown(conv?.collector_number) ||
      stripMarkdown(conv?.card_number) ||
      c.card_number ||
      null,
    artist_name: stripMarkdown(conv?.artist_name) || c.artist_name || null,
    rarity_or_variant: stripMarkdown(conv?.rarity_or_variant) || c.rarity_description || null,
    authentic: conv?.authentic,
    is_foil: conv?.is_foil ?? c.is_foil ?? false,
    is_promo: conv?.is_promo ?? c.is_promo ?? false,
    border_color: stripMarkdown(conv?.border_color) || c.border_color || null,
    language: stripMarkdown(conv?.language) || c.card_language || 'English',
    keywords: conv?.keywords || c.keywords || null,
    foil_type: stripMarkdown(conv?.foil_type) || c.foil_type || null,
    scryfall_price_usd: conv?.scryfall_price_usd || c.scryfall_price_usd || null,
    scryfall_price_usd_foil: conv?.scryfall_price_usd_foil || c.scryfall_price_usd_foil || null,
  };

  if (key === 'mtg') {
    // mtg 2646, 2670-2692. `flavor_name` is the Universes Beyond / Secret Lair
    // crossover name the legacy page prints above the canonical one.
    return {
      ...shared,
      flavor_name: stripMarkdown(conv?.flavor_name) || null,
      mana_cost: stripMarkdown(conv?.mana_cost) || c.mana_cost || null,
      color_identity: stripMarkdown(conv?.color_identity) || c.color_identity || null,
      mtg_card_type: stripMarkdown(conv?.mtg_card_type) || c.mtg_card_type || null,
      creature_type: stripMarkdown(conv?.creature_type) || c.creature_type || null,
      power_toughness: stripMarkdown(conv?.power_toughness) || c.power_toughness || null,
      frame_version: stripMarkdown(conv?.frame_version) || c.frame_version || null,
      is_double_faced: conv?.is_double_faced ?? c.is_double_faced ?? false,
      is_extended_art: conv?.is_extended_art ?? c.is_extended_art ?? false,
      is_showcase: conv?.is_showcase ?? c.is_showcase ?? false,
      is_borderless: conv?.is_borderless ?? c.is_borderless ?? false,
      is_retro_frame: conv?.is_retro_frame ?? c.is_retro_frame ?? false,
      is_full_art_mtg: conv?.is_full_art_mtg ?? c.is_full_art_mtg ?? false,
    };
  }

  if (key === 'onepiece') {
    // onepiece 2620-2643. Note the legacy chain reads the GENERIC json keys
    // (card_color, card_power, card_cost, life, counter_amount, attribute,
    // sub_types, variant_type) and only the COLUMNS are op_-prefixed.
    return {
      ...shared,
      op_card_type: stripMarkdown(conv?.op_card_type) || c.op_card_type || null,
      op_card_color: stripMarkdown(conv?.card_color) || c.op_card_color || null,
      op_card_power: conv?.card_power ?? c.op_card_power ?? null,
      op_card_cost: conv?.card_cost ?? c.op_card_cost ?? null,
      op_life: conv?.life ?? c.op_life ?? null,
      op_counter: conv?.counter_amount ?? c.op_counter ?? null,
      op_attribute: stripMarkdown(conv?.attribute) || c.op_attribute || null,
      op_sub_types: stripMarkdown(conv?.sub_types) || c.op_sub_types || null,
      op_variant_type: stripMarkdown(conv?.variant_type) || c.op_variant_type || null,
      is_parallel: conv?.is_parallel ?? (c.op_variant_type?.includes('parallel') ?? false),
      is_manga_art: conv?.is_manga_art ?? (c.op_variant_type?.includes('manga') ?? false),
      is_alternate_art: conv?.is_alternate_art ?? (c.op_variant_type === 'alternate_art' || false),
      is_sp: conv?.is_sp ?? (c.op_variant_type === 'sp' || false),
    };
  }

  if (key === 'yugioh') {
    // yugioh 2657-2680. The same generic json keys as One Piece, mapped onto
    // the ygo_ columns — which is why ATK reads `card_power` and DEF reads
    // `card_cost`. Copied, not corrected.
    return {
      ...shared,
      ygo_card_type: stripMarkdown(conv?.ygo_card_type) || c.ygo_card_type || null,
      ygo_attribute: stripMarkdown(conv?.card_color) || c.ygo_attribute || null,
      ygo_atk: conv?.card_power ?? c.ygo_atk ?? null,
      ygo_def: conv?.card_cost ?? c.ygo_def ?? null,
      ygo_level: conv?.life ?? c.ygo_level ?? null,
      ygo_scale: conv?.counter_amount ?? c.ygo_scale ?? null,
      ygo_race: stripMarkdown(conv?.attribute) || c.ygo_race || null,
      ygo_archetype: stripMarkdown(conv?.sub_types) || c.ygo_archetype || null,
      ygo_frame_type: stripMarkdown(conv?.variant_type) || c.ygo_frame_type || null,
      is_parallel: conv?.is_parallel ?? (c.ygo_frame_type?.includes('parallel') ?? false),
      is_manga_art: conv?.is_manga_art ?? (c.ygo_frame_type?.includes('manga') ?? false),
      is_alternate_art: conv?.is_alternate_art ?? (c.ygo_frame_type === 'alternate_art'),
      is_sp: conv?.is_sp ?? (c.ygo_frame_type === 'sp'),
    };
  }

  // STARWARS IS CURRENTLY UNREACHABLE FROM A ROUTE. `/starwars/[id]` has
  // redirected to `/other/[id]` since March 2026 (commit d41b72f8) and every
  // Star Wars row carries `category='Other', sub_category='Star Wars'`, so a
  // Star Wars card is built by `buildOtherCardInfo`. This branch is kept
  // because `buildCardInfo` is a public function that still accepts the
  // category, and because it records the chain the frozen (also unreachable)
  // starwars client uses. Nothing in the app reaches it today.
  //
  // starwars 2634-2656. The legacy file's own comment records that duplicate
  // object keys were removed and the LAST value won, so there is no sw_ field
  // for cost/power at all — `sw_faction` really does read `card_cost`.
  return {
    ...shared,
    sw_faction: conv?.card_cost ?? c.sw_faction ?? null,
    sw_era: stripMarkdown(conv?.attribute) || c.sw_era || null,
    sw_rarity: stripMarkdown(conv?.sub_types) || c.sw_rarity || null,
    sw_card_type: stripMarkdown(conv?.variant_type) || c.sw_card_type || null,
    is_parallel: conv?.is_parallel ?? (c.sw_card_type?.includes('parallel') ?? false),
    is_manga_art: conv?.is_manga_art ?? (c.sw_card_type?.includes('manga') ?? false),
    is_alternate_art: conv?.is_alternate_art ?? (c.sw_card_type === 'alternate_art'),
    is_sp: conv?.is_sp ?? (c.sw_card_type === 'sp'),
  };
}

/**
 * Lorcana — DATABASE COLUMNS FIRST, like Pokemon.
 *
 * EXTRACTED FROM `src/app/lorcana/[id]/CardDetailClient.tsx` 2606-2680.
 *
 * The legacy comment explains why: "the grading route enhances card_info with
 * verified database data … so we prioritize individual columns over the JSONB
 * field which may contain original AI values". Three rules are Lorcana's alone:
 *
 *   - the set name is taken from `cards.card_set` only when it passes
 *     `isValidLorcanaSetName` (2611-2621), and the last resort is the literal
 *     string 'Unknown Set';
 *   - the subset is appended only when the set name does not already contain
 *     it (2627);
 *   - `year` is `cards.release_date` RAW, not sliced to four characters.
 */
function isValidLorcanaSetName(value: any): boolean {
  if (!value || typeof value !== 'string') return false;
  const cleaned = value.trim().toLowerCase();
  if (cleaned === '') return false;
  if (cleaned === 'unknown') return false;
  if (cleaned.includes('unknown lorcana')) return false;
  if (cleaned === 'n/a') return false;
  return true;
}

export function buildLorcanaCardInfo(c: any, conv: any, dvgCardInfo: any): LegacyCardInfo {
  const setNameRaw = isValidLorcanaSetName(c.card_set)
    ? c.card_set
    : isValidLorcanaSetName(conv?.set_name)
      ? stripMarkdown(conv?.set_name)
      : dvgCardInfo?.set_name || 'Unknown Set';
  const subsetRaw = stripMarkdown(conv?.subset) || c.subset || dvgCardInfo?.subset;
  const setNameWithSubset =
    subsetRaw && !String(setNameRaw).toLowerCase().includes(String(subsetRaw).toLowerCase())
      ? `${setNameRaw} - ${subsetRaw}`
      : setNameRaw;

  return {
    card_name: stripMarkdown(conv?.card_name) || c.card_name || dvgCardInfo?.card_name,
    player_or_character:
      stripMarkdown(conv?.player_or_character) ||
      c.pokemon_featured ||
      c.featured ||
      dvgCardInfo?.player_or_character,
    set_name: setNameWithSubset,
    set_era: stripMarkdown(conv?.set_era) || dvgCardInfo?.set_era,
    year: c.release_date || stripMarkdown(conv?.year) || dvgCardInfo?.year,
    manufacturer:
      stripMarkdown(conv?.manufacturer) || c.manufacturer_name || dvgCardInfo?.manufacturer,
    card_number:
      c.card_number ||
      stripMarkdown(conv?.card_number_raw) ||
      stripMarkdown(conv?.card_number) ||
      dvgCardInfo?.card_number,
    sport_or_category:
      stripMarkdown(conv?.sport_or_category) || c.category || dvgCardInfo?.sport_or_category,
    serial_number:
      stripMarkdown(conv?.serial_number) || c.serial_numbering || dvgCardInfo?.serial_number,
    rookie_or_first: conv?.rookie_or_first || c.rookie_card || dvgCardInfo?.rookie_or_first,
    subset: subsetRaw,
    rarity_tier:
      pickRarity(
        'lorcana',
        stripMarkdown(conv?.rarity_tier),
        c.rarity_tier,
        c.rarity_description,
        dvgCardInfo?.rarity_tier,
      ) ?? undefined,
    autographed:
      conv?.autographed === true || c.autographed === true || c.autograph_type === 'authentic',
    memorabilia: conv?.memorabilia === true || c.memorabilia_type !== 'none',
    card_front_text: conv?.card_front_text || dvgCardInfo?.card_front_text,
    card_back_text: conv?.card_back_text || dvgCardInfo?.card_back_text,

    pokemon_type: stripMarkdown(conv?.pokemon_type) || c.pokemon_type || null,
    pokemon_stage: stripMarkdown(conv?.pokemon_stage) || c.pokemon_stage || null,
    hp: stripMarkdown(conv?.hp) || c.hp || null,
    card_type: stripMarkdown(conv?.card_type) || c.card_type || null,

    // Lorcana's own block (2660-2680) — columns first here too.
    ink_color: c.ink_color || stripMarkdown(conv?.ink_color) || null,
    lorcana_card_type: c.lorcana_card_type || stripMarkdown(conv?.lorcana_card_type) || null,
    character_version: c.character_version || stripMarkdown(conv?.character_version) || null,
    inkwell: c.inkwell !== undefined ? c.inkwell : (conv?.inkwell || false),
    ink_cost: c.ink_cost || stripMarkdown(conv?.ink_cost) || null,
    strength: c.strength || stripMarkdown(conv?.strength) || null,
    willpower: c.willpower || stripMarkdown(conv?.willpower) || null,
    lore_value: c.lore_value || stripMarkdown(conv?.lore_value) || null,
    move_cost: c.move_cost || stripMarkdown(conv?.move_cost) || null,
    quest_value: c.quest_value || stripMarkdown(conv?.quest_value) || null,
    classifications: c.classifications || conv?.classifications || null,
    abilities: c.abilities || conv?.abilities || null,
    flavor_text: c.flavor_text || stripMarkdown(conv?.flavor_text) || null,
    is_enchanted: c.is_enchanted !== undefined ? c.is_enchanted : (conv?.is_enchanted || false),
    is_foil: c.is_foil !== undefined ? c.is_foil : (conv?.is_foil || false),
    expansion_code: c.expansion_code || stripMarkdown(conv?.expansion_code) || null,
    artist_name: c.artist_name || stripMarkdown(conv?.artist_name) || null,
    language: c.language || stripMarkdown(conv?.language) || 'English',
    franchise: c.franchise || stripMarkdown(conv?.franchise) || 'Disney',
    rarity_or_variant: c.rarity_description || stripMarkdown(conv?.rarity_or_variant) || null,
    authentic: conv?.authentic,
  };
}

/**
 * Other — MODEL JSON FIRST, and the loosest chain of the eight.
 *
 * EXTRACTED FROM `src/app/other/[id]/CardDetailClient.tsx` 2577-2632.
 *
 * Four things are 'other' alone, and all four are legacy's:
 *   - the subset is appended with NO frame-treatment filter;
 *   - `manufacturer` reads `cards.manufacturer`, not `manufacturer_name`;
 *   - `year` is `release_date` raw;
 *   - `autographed` / `memorabilia` are decided by the model JSON ONLY — the
 *     `autograph_type` / `memorabilia_type` columns are never consulted, so
 *     'other' does NOT carry the NULL-memorabilia quirk. (The legacy object
 *     literal declares each key twice and the later one wins; only the later,
 *     JSON-only pair is reproduced here.)
 */
export function buildOtherCardInfo(c: any, conv: any, dvgCardInfo: any): LegacyCardInfo {
  const setNameRaw = stripMarkdown(conv?.set_name) || c.card_set || dvgCardInfo?.set_name;
  const subsetRaw = stripMarkdown(conv?.subset) || c.subset || dvgCardInfo?.subset;
  const setNameWithSubset = subsetRaw ? `${setNameRaw} - ${subsetRaw}` : setNameRaw;

  const jsonSaysYes = (value: any) => value === true || value === 'Yes' || value === 'yes';

  return {
    card_name: stripMarkdown(conv?.card_name) || c.card_name || dvgCardInfo?.card_name,
    player_or_character:
      stripMarkdown(conv?.player_or_character) ||
      c.pokemon_featured ||
      c.featured ||
      dvgCardInfo?.player_or_character,
    set_name: setNameWithSubset,
    set_era: stripMarkdown(conv?.set_era) || dvgCardInfo?.set_era,
    year: stripMarkdown(conv?.year) || c.release_date || dvgCardInfo?.year,
    manufacturer: stripMarkdown(conv?.manufacturer) || c.manufacturer || null,
    card_number:
      stripMarkdown(conv?.card_number_raw) ||
      stripMarkdown(conv?.card_number) ||
      c.card_number ||
      dvgCardInfo?.card_number,
    sport_or_category:
      stripMarkdown(conv?.sport_or_category) || c.category || dvgCardInfo?.sport_or_category,
    serial_number:
      stripMarkdown(conv?.serial_number) || c.serial_numbering || dvgCardInfo?.serial_number,
    rookie_or_first: conv?.rookie_or_first || c.rookie_card || dvgCardInfo?.rookie_or_first,
    subset: subsetRaw,
    rarity_tier:
      pickRarity(
        'other',
        stripMarkdown(conv?.rarity_tier),
        c.rarity_tier,
        c.rarity_description,
        dvgCardInfo?.rarity_tier,
      ) ?? undefined,
    autographed: jsonSaysYes(conv?.autographed),
    memorabilia: jsonSaysYes(conv?.memorabilia),
    card_front_text: conv?.card_front_text || dvgCardInfo?.card_front_text,
    card_back_text: conv?.card_back_text || dvgCardInfo?.card_back_text,

    pokemon_type: stripMarkdown(conv?.pokemon_type) || c.pokemon_type || null,
    pokemon_stage: stripMarkdown(conv?.pokemon_stage) || c.pokemon_stage || null,
    hp: stripMarkdown(conv?.hp) || c.hp || null,
    card_type: stripMarkdown(conv?.card_type) || c.card_type || null,

    card_date: stripMarkdown(conv?.card_date) || c.card_date || null,
    special_features: stripMarkdown(conv?.special_features) || c.special_features || null,
    front_text: conv?.front_text || c.front_text || null,
    back_text: conv?.back_text || c.back_text || null,
    facsimile_autograph: conv?.facsimile_autograph || false,
    official_reprint: conv?.official_reprint || false,
  };
}
