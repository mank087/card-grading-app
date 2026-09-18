/**
 * The single authoritative writer for owner card-identity edits (Phase 2A).
 *
 * Before this module the details PATCH route did four independent writes
 * (original snapshot, identity, label_data, custom label) with no revision
 * check, mapped the card number inconsistently, and never invalidated the
 * pricing that was bound to the OLD identity. A corrected 1960 Mantle kept the
 * 2021 reprint's price and product selection forever.
 *
 * Everything here except `saveCardIdentity` is pure so it can be unit tested
 * without a database. The database half is `save_card_identity()` in
 * supabase/migrations/20260917_identity_confirmation.sql, which commits the
 * identity, the confirmation state and the pricing invalidation in ONE
 * transaction under a row lock.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Request keys that steer the save. They are never card data. */
export const IDENTITY_CONTROL_KEYS = ['confirm', 'dismiss', 'expected_identity_revision'] as const;

/**
 * Columns whose value the owner may never reach through this service, even if
 * a mapping were added by mistake. The database function has its own hard-coded
 * allowlist; this is the belt to that braces.
 */
export const FORBIDDEN_IDENTITY_COLUMNS: readonly string[] = [
  'id', 'user_id', 'created_at', 'updated_at',
  'raw_decimal_grade', 'dcm_grade_whole', 'dvg_decimal_grade', 'dvg_whole_grade',
  'conversational_decimal_grade', 'conversational_whole_grade',
  'conversational_condition_label', 'conversational_grading',
  'conversational_sub_scores', 'conversational_weighted_sub_scores',
  'conversational_centering_ratios', 'conversational_image_confidence',
  'ai_grading', 'ai_confidence_score', 'grade_numeric', 'estimated_professional_grades',
  'front_path', 'back_path', 'front_url', 'back_url',
  'graded_at', 'grade_status', 'grading_model', 'dcm_price_at_grading', 'dcm_price_at_grading_date',
];

export interface IdentityFieldMapping {
  /** cards column this field writes, when it has one. */
  column?: string;
  /** conversational_card_info key this field writes, when it has one. */
  json?: string;
}

/**
 * Editable identity fields, moved verbatim from the details route's two
 * mappings so behaviour does not shift. A field absent from this map is
 * REJECTED; previously it was silently accepted and then silently dropped.
 */
export const IDENTITY_FIELDS: Record<string, IdentityFieldMapping> = {
  card_name: { column: 'card_name', json: 'card_name' },
  featured: { column: 'featured', json: 'player_or_character' },
  card_set: { column: 'card_set', json: 'set_name' },
  // Defect A: the JSON kept a stale `card_number` while only `card_number_raw`
  // was rewritten, so the label and the details page disagreed. Both keys are
  // written together now (see buildJsonPatch).
  card_number: { column: 'card_number', json: 'card_number_raw' },
  release_date: { column: 'release_date', json: 'year' },
  manufacturer_name: { column: 'manufacturer_name', json: 'manufacturer' },
  serial_numbering: { column: 'serial_numbering', json: 'serial_number' },
  autographed: { column: 'autographed', json: 'autographed' },
  autograph_type: { column: 'autograph_type' },
  rookie_card: { column: 'rookie_card', json: 'rookie_or_first' },
  first_print_rookie: { column: 'first_print_rookie', json: 'first_print_rookie' },
  memorabilia_type: { column: 'memorabilia_type', json: 'memorabilia' },
  memorabilia_other: { json: 'memorabilia_other' },
  facsimile_autograph: { json: 'facsimile_autograph' },
  official_reprint: { json: 'official_reprint' },
  holofoil: { column: 'holofoil', json: 'holofoil' },
  pokemon_type: { column: 'pokemon_type', json: 'pokemon_type' },
  pokemon_stage: { column: 'pokemon_stage', json: 'pokemon_stage' },
  hp: { column: 'hp', json: 'hp' },
  card_type: { json: 'card_type' },
  subset_variant: { json: 'rarity_or_variant' },
  is_foil: { column: 'is_foil', json: 'is_foil' },
  foil_type: { column: 'foil_type', json: 'foil_type' },
  mtg_rarity: { column: 'mtg_rarity', json: 'mtg_rarity' },
  is_double_faced: { column: 'is_double_faced', json: 'is_double_faced' },
  mtg_set_code: { column: 'mtg_set_code', json: 'expansion_code' },
  rarity_tier: { column: 'rarity_tier', json: 'rarity_tier' },
  rarity_description: { column: 'rarity_description', json: 'rarity_description' },
  ink_color: { json: 'ink_color' },
  lorcana_card_type: { json: 'lorcana_card_type' },
  character_version: { json: 'character_version' },
  inkwell: { json: 'inkwell' },
  ink_cost: { json: 'ink_cost' },
  is_enchanted: { json: 'is_enchanted' },
  mana_cost: { json: 'mana_cost' },
  mtg_card_type: { json: 'mtg_card_type' },
  creature_type: { json: 'creature_type' },
  power_toughness: { json: 'power_toughness' },
  color_identity: { json: 'color_identity' },
  artist_name: { json: 'artist_name' },
  border_color: { json: 'border_color' },
  frame_version: { json: 'frame_version' },
  language: { json: 'language' },
  is_extended_art: { json: 'is_extended_art' },
  is_showcase: { json: 'is_showcase' },
  is_borderless: { json: 'is_borderless' },
  is_retro_frame: { json: 'is_retro_frame' },
  is_full_art_mtg: { json: 'is_full_art_mtg' },
  is_first_edition: { json: 'is_first_edition' },
  is_shadowless: { json: 'is_shadowless' },
  is_reverse_holo: { json: 'is_reverse_holo' },
  is_full_art: { json: 'is_full_art' },
  is_secret_rare: { json: 'is_secret_rare' },
  is_promo: { json: 'is_promo' },
  is_error_card: { json: 'is_error_card' },
  is_illustration_rare: { json: 'is_illustration_rare' },
  is_special_art_rare: { json: 'is_special_art_rare' },
  is_hyper_rare: { json: 'is_hyper_rare' },
  is_gold_rare: { json: 'is_gold_rare' },
  sport: { json: 'sport' },
  team: { json: 'team' },
  parallel_type: { json: 'parallel_type' },
  is_refractor: { json: 'is_refractor' },
  is_numbered: { json: 'is_numbered' },
  is_patch: { json: 'is_patch' },
  is_jersey: { json: 'is_jersey' },
  is_game_used: { json: 'is_game_used' },
  is_on_card_auto: { json: 'is_on_card_auto' },
  is_sticker_auto: { json: 'is_sticker_auto' },
  is_variation: { json: 'is_variation' },
  is_short_print: { json: 'is_short_print' },
  is_case_hit: { json: 'is_case_hit' },
};

/** Sent by every category's editor. */
const COMMON_FIELDS = [
  'card_name', 'featured', 'card_set', 'card_number', 'release_date', 'manufacturer_name',
  'serial_numbering', 'autographed', 'autograph_type', 'rookie_card', 'rarity_tier',
  'rarity_description', 'card_type', 'subset_variant', 'language', 'memorabilia_other',
  'facsimile_autograph', 'official_reprint',
] as const;

const POKEMON_FIELDS = [
  'holofoil', 'pokemon_type', 'pokemon_stage', 'hp', 'is_first_edition', 'is_shadowless',
  'is_reverse_holo', 'is_full_art', 'is_secret_rare', 'is_promo', 'is_error_card',
  'is_illustration_rare', 'is_special_art_rare', 'is_hyper_rare', 'is_gold_rare',
] as const;

const SPORTS_FIELDS = [
  'sport', 'team', 'parallel_type', 'memorabilia_type', 'first_print_rookie', 'is_refractor',
  'is_numbered', 'is_patch', 'is_jersey', 'is_game_used', 'is_on_card_auto', 'is_sticker_auto',
  'is_variation', 'is_short_print', 'is_case_hit',
] as const;

const MTG_FIELDS = [
  'is_foil', 'foil_type', 'mtg_rarity', 'is_double_faced', 'mtg_set_code', 'mana_cost',
  'mtg_card_type', 'creature_type', 'power_toughness', 'color_identity', 'artist_name',
  'border_color', 'frame_version', 'is_extended_art', 'is_showcase', 'is_borderless',
  'is_retro_frame', 'is_full_art_mtg', 'is_promo',
] as const;

const LORCANA_FIELDS = [
  'ink_color', 'lorcana_card_type', 'character_version', 'inkwell', 'ink_cost', 'is_enchanted',
  'is_foil', 'foil_type',
] as const;

const SPORTS_CATEGORIES = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];

/**
 * Per-category editable field allowlist. Mirrors the payload branches in
 * EditCardDetailsModal so no shipped client starts getting 400s.
 */
export function allowedFieldsForCategory(category?: string | null): Set<string> {
  const extra =
    category === 'Pokemon' ? POKEMON_FIELDS
    : category === 'MTG' ? MTG_FIELDS
    : category === 'Lorcana' ? LORCANA_FIELDS
    : SPORTS_CATEGORIES.includes(category || '') ? SPORTS_FIELDS
    : [];
  return new Set<string>([...COMMON_FIELDS, ...extra]);
}

/**
 * The fields that make a card a DIFFERENT card: name/player, set, subset or
 * insert, printed number, year, language, parallel/variant, serial numbering.
 * Only a change to one of these moves identity_revision and invalidates
 * pricing. Editing a cosmetic flag (rarity_description, HP, artist) does not.
 */
export const MATERIAL_IDENTITY_FIELDS: readonly string[] = [
  'card_name', 'featured', 'card_set', 'mtg_set_code', 'subset_variant', 'card_number',
  'release_date', 'manufacturer_name', 'language', 'parallel_type', 'holofoil', 'is_foil',
  'foil_type', 'is_reverse_holo', 'is_first_edition', 'serial_numbering',
];

/**
 * Pricing bound to the OLD identity. Nulled on a material identity change so a
 * corrected card cannot keep the previous card's money value.
 *
 * NOT here on purpose: `dcm_price_at_grading` / `dcm_price_at_grading_date` and
 * the `card_price_history` rows. Those record what the card was worth at a past
 * moment; they are history, not a current price, and the portfolio's movers
 * chart reads them as a baseline.
 */
export const PRICING_INVALIDATION_COLUMNS: readonly string[] = [
  // Owner's manual product selection. src/app/api/pricing/dcm-select/route.ts:73-75.
  'dcm_selected_product_id', 'dcm_selected_product_name', 'dcm_selected_at',
  // Current DCM estimate shown on the details and collection pages, plus the
  // product match it came from. src/app/api/pricing/dcm-save/route.ts:86-94,
  // src/lib/pricing/resolveCardValue.ts:65. `dcm_price_updated_at` is nulled
  // too so the staleness-ordered crons pick the card up first
  // (src/app/api/cron/update-card-prices/route.ts:60).
  'dcm_price_estimate', 'dcm_price_raw', 'dcm_price_graded_high', 'dcm_price_median',
  'dcm_price_average', 'dcm_price_updated_at', 'dcm_price_match_confidence',
  'dcm_price_product_id', 'dcm_price_product_name',
  // Full cached provider payload behind the estimate.
  // src/lib/pricing/batchPriceRefresh.ts:119-120, resolveCardValue.ts:72.
  'dcm_cached_prices', 'dcm_prices_cached_at',
  // eBay sold comps for the old identity's search terms.
  // src/lib/ebay/priceTracker.ts:591-596, resolveCardValue.ts:88.
  'ebay_price_lowest', 'ebay_price_median', 'ebay_price_average', 'ebay_price_highest',
  'ebay_price_listing_count', 'ebay_price_updated_at',
  // Scryfall prices are per printing, so a set/collector-number correction
  // invalidates them. src/app/api/mtg/[id]/route.ts:1105-1106,
  // resolveCardValue.ts:79-83.
  'scryfall_price_usd', 'scryfall_price_usd_foil',
];

/** Trim, case-fold, and treat '' as null so "  Topps " and "topps" are equal. */
export function normalizeIdentityValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed.toLowerCase();
  }
  return String(value).toLowerCase();
}

function asRecord(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, any>;
    } catch { /* not JSON */ }
  }
  return {};
}

/** The value a field currently has: column first, then the card-info JSON. */
export function currentIdentityValue(card: Record<string, any>, field: string): unknown {
  const mapping = IDENTITY_FIELDS[field];
  if (!mapping) return undefined;
  if (mapping.column && card[mapping.column] !== undefined && card[mapping.column] !== null) {
    return card[mapping.column];
  }
  const info = asRecord(card.conversational_card_info);
  if (mapping.json && mapping.json in info) return info[mapping.json];
  if (mapping.column) return card[mapping.column] ?? null;
  return null;
}

export interface IdentityPatch {
  /** cards columns to write. Only allowlisted identity columns appear. */
  columnPatch: Record<string, any>;
  /** The whole merged conversational_card_info, or null when untouched. */
  cardInfo: Record<string, any> | null;
  /** Editable fields whose value actually changed. */
  changedFields: string[];
  /** The subset of changedFields that makes this a different card. */
  materialFields: string[];
  /** True when the pricing binding must be invalidated. */
  material: boolean;
  /** Before/after snapshots of the changed fields, for the history row. */
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export class IdentityFieldError extends Error {
  constructor(message: string, readonly field: string) {
    super(message);
    this.name = 'IdentityFieldError';
  }
}

/**
 * Turn a request body into the column patch, the merged card-info JSON and the
 * change summary. Throws IdentityFieldError for a field that is not editable.
 *
 * Omitted means untouched. An empty string means the owner cleared the field
 * and is stored as null. A value equal to the current one is written but does
 * not count as a change, so it cannot bump the revision.
 */
export function buildIdentityPatch(
  body: Record<string, any>,
  card: Record<string, any>,
): IdentityPatch {
  const allowed = allowedFieldsForCategory(card.category);
  const columnPatch: Record<string, any> = {};
  const info = { ...asRecord(card.conversational_card_info) };
  const changedFields: string[] = [];
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  let touchedJson = false;

  for (const key of Object.keys(body)) {
    if ((IDENTITY_CONTROL_KEYS as readonly string[]).includes(key)) continue;
    const mapping = IDENTITY_FIELDS[key];
    // Unknown fields are rejected. A KNOWN field sent for another category is
    // dropped, not rejected: the route accepted it before, and a cached web bundle
    // or an older app build must not start getting 400s from a save that used to work.
    if (!mapping) {
      throw new IdentityFieldError(`Field '${key}' cannot be edited`, key);
    }
    if (!allowed.has(key)) continue;

    const raw = body[key];
    const value = raw === '' ? null : raw;
    const currentValue = currentIdentityValue(card, key);
    if (normalizeIdentityValue(currentValue) !== normalizeIdentityValue(value)) {
      changedFields.push(key);
      before[key] = currentValue ?? null;
      after[key] = value ?? null;
    }

    if (mapping.column) {
      if (FORBIDDEN_IDENTITY_COLUMNS.includes(mapping.column)) {
        throw new IdentityFieldError(`Field '${key}' cannot be edited`, key);
      }
      columnPatch[mapping.column] = value;
    }
    if (mapping.json) {
      info[mapping.json] = value;
      touchedJson = true;
    }
    // Defect A: keep the two card-number keys in step. Consumers read either.
    if (key === 'card_number') {
      info.card_number = value;
    }
    // The detail page reads `subset`, the editor writes `rarity_or_variant`.
    if (key === 'subset_variant') {
      info.subset = value;
    }
    // Pokemon's display name column tracks the featured name.
    if (key === 'featured' && card.category === 'Pokemon') {
      columnPatch.pokemon_featured = value;
    }
  }

  const materialFields = changedFields.filter(f => MATERIAL_IDENTITY_FIELDS.includes(f));
  return {
    columnPatch,
    cardInfo: touchedJson ? info : null,
    changedFields,
    materialFields,
    material: materialFields.length > 0,
    before,
    after,
  };
}

export type SaveIdentityStatus =
  | 'saved' | 'stale' | 'locked' | 'forbidden' | 'not_found' | 'invalid' | 'unavailable';

export interface SaveCardIdentityResult {
  status: SaveIdentityStatus;
  identityRevision?: number | null;
  currentRevision?: number;
  confirmed?: boolean;
  pricingInvalidated?: boolean;
  changedFields?: string[];
  error?: string;
  field?: string;
  /** True when the failure was the database, not the request (route returns 500). */
  serverError?: boolean;
}

export interface SaveCardIdentityInput {
  cardId: string;
  card: Record<string, any>;
  body: Record<string, any>;
  actorId: string;
  actorRole?: 'owner' | 'admin' | 'system';
  confirm?: boolean;
  dismiss?: boolean;
  expectedRevision?: number | null;
}

function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  return typeof error.message === 'string'
    && /could not find the function|function .* does not exist/i.test(error.message);
}

function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  return typeof error.message === 'string' && /column .* does not exist/i.test(error.message);
}

/**
 * Save an owner identity edit, a confirmation, a dismissal, or any combination
 * of the three. One round trip, one transaction, one history row.
 */
export async function saveCardIdentity(
  supabase: SupabaseClient<any, any, any>,
  input: SaveCardIdentityInput,
): Promise<SaveCardIdentityResult> {
  const { cardId, card, body, actorId } = input;
  const actorRole = input.actorRole || 'owner';
  const confirm = input.confirm === true;
  const dismiss = input.dismiss === true;

  let patch: IdentityPatch;
  try {
    patch = buildIdentityPatch(body, card);
  } catch (e) {
    if (e instanceof IdentityFieldError) return { status: 'invalid', error: e.message, field: e.field };
    throw e;
  }

  const hasEdit = Object.keys(patch.columnPatch).length > 0 || patch.cardInfo !== null;
  if (!hasEdit && !confirm && !dismiss) {
    return { status: 'invalid', error: 'No changes to save' };
  }

  const invalidate = patch.material ? PRICING_INVALIDATION_COLUMNS : [];

  const { data, error } = await supabase.rpc('save_card_identity', {
    p_card_id: cardId,
    p_actor_id: actorId,
    p_actor_role: actorRole,
    p_expected_revision: input.expectedRevision ?? null,
    p_column_patch: patch.columnPatch,
    p_card_info: patch.cardInfo,
    p_material_change: patch.material,
    p_confirm: confirm,
    p_dismiss: dismiss,
    p_invalidate_columns: invalidate,
    p_changed_fields: patch.changedFields,
    p_before: patch.before,
    p_after: patch.after,
  });

  if (error) {
    if (isMissingFunction(error) || isMissingColumn(error)) {
      console.warn(
        '[saveCardIdentity] save_card_identity() is not available in this database — ' +
        'falling back to the legacy multi-write path. Apply ' +
        'supabase/migrations/20260917_identity_confirmation.sql. Confirmation and ' +
        'dismissal are unavailable until then.',
        error.message,
      );
      return legacySave(supabase, cardId, card, patch, confirm, dismiss);
    }
    console.error('[saveCardIdentity] RPC failed:', error);
    return { status: 'invalid', error: error.message, serverError: true };
  }

  const result = (data || {}) as Record<string, any>;
  switch (result.status) {
    case 'saved':
      return {
        status: 'saved',
        identityRevision: result.identity_revision ?? null,
        confirmed: result.confirmed === true,
        pricingInvalidated: result.pricing_invalidated === true,
        changedFields: patch.changedFields,
      };
    case 'stale':
      return { status: 'stale', currentRevision: result.current_revision };
    case 'locked':
      return { status: 'locked' };
    case 'forbidden':
      return { status: 'forbidden' };
    case 'not_found':
      return { status: 'not_found' };
    default:
      return { status: 'invalid', error: `Unexpected save status: ${String(result.status)}` };
  }
}

/**
 * Pre-migration behaviour: the route's original separate writes, plus the two
 * fixes that do not need new columns (consistent card-number keys, pricing
 * invalidation on a material change). Deploying code before the migration is
 * therefore no worse than today.
 */
async function legacySave(
  supabase: SupabaseClient<any, any, any>,
  cardId: string,
  card: Record<string, any>,
  patch: IdentityPatch,
  confirm: boolean,
  dismiss: boolean,
): Promise<SaveCardIdentityResult> {
  if ((confirm || dismiss) && Object.keys(patch.columnPatch).length === 0 && patch.cardInfo === null) {
    return { status: 'unavailable', error: 'Confirming card details is not available yet' };
  }

  if (!card.original_card_info && card.conversational_card_info) {
    const { error } = await supabase
      .from('cards')
      .update({ original_card_info: card.conversational_card_info })
      .eq('id', cardId);
    if (error) console.warn('[saveCardIdentity] could not preserve original card info:', error.message);
  }

  const update: Record<string, any> = { ...patch.columnPatch };
  if (patch.cardInfo !== null) update.conversational_card_info = patch.cardInfo;
  if (patch.material) for (const column of PRICING_INVALIDATION_COLUMNS) update[column] = null;

  const { error } = await supabase.from('cards').update(update).eq('id', cardId);
  if (error) {
    console.error('[saveCardIdentity] legacy update failed:', error);
    return { status: 'invalid', error: error.message, serverError: true };
  }
  return {
    status: 'saved',
    identityRevision: null,
    confirmed: false,
    pricingInvalidated: patch.material,
    changedFields: patch.changedFields,
  };
}
