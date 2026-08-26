/**
 * Regrade identity guard (Aug 25 2026).
 *
 * A `force_regrade=true` request re-runs the WHOLE pipeline, including card
 * identification. Identification is stochastic per grade (the model can misread
 * a set code, the DB matcher can land on a different printing), so a regrade
 * meant to refresh the CONDITION grade could silently rename a customer's card.
 * Observed: two "Kewl Tune Synchro" (PHRE-EN039) cards regraded for a zoom-pass
 * fix came back as "Aromalilith Magnolia" (PHNI-EN039) with rebuilt labels.
 *
 * Rule: a regrade of an already-identified card keeps its identity. Only the
 * condition side of the result (grade, subgrades, condition text, report,
 * grade fields of the label) is refreshed. Pass `?reidentify=true` to opt back
 * into re-identification (admin fix-ups, wrong-card corrections).
 *
 * Mechanism: right before the route's main `cards` UPDATE, every identity
 * column present in the update payload is overwritten with the stored value.
 * The label keeps its stored identity lines and takes the new grade fields.
 * The grading JSON's `card_info` is swapped for the stored card info so the
 * report and the row cannot disagree.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Columns that describe WHAT the card is (never its condition or price). */
export const IDENTITY_COLUMNS: readonly string[] = [
  // Core
  'card_name', 'card_set', 'card_number', 'release_date', 'manufacturer_name', 'manufacturer',
  'card_type', 'sub_category', 'franchise', 'card_date', 'language', 'card_language',
  'rarity_description', 'rarity_tier', 'rarity_score', 'rarity_notes', 'feature_tags',
  'serial_numbering', 'serial_number_fraction', 'featured', 'players_featured',
  'rookie_or_first_print', 'rookie_card', 'rookie_flag', 'first_print', 'first_print_rookie',
  'subset_insert_name', 'special_attributes', 'special_features', 'print_finish', 'finish_material',
  'autograph_type', 'autographed', 'memorabilia_type', 'artist', 'artist_name', 'hp',
  'main_text_box', 'stat_table_text', 'copyright_text', 'front_text', 'back_text',
  // Identification provenance
  'conversational_card_info', 'validated_source', 'validation_tier', 'validation_confidence',
  'database_match_confidence', 'api_card_id', 'tcgplayer_url', 'dcm_price_product_id',
  'ai_card_info_original', 'original_card_info',
  // Pokemon
  'pokemon_featured', 'pokemon_stage', 'pokemon_type', 'trainer_subtype', 'energy_subtype', 'holofoil',
  'set_series', 'set_symbol_url', 'pokemon_tcg_api_id', 'pokemon_tcg_data', 'pokemon_tcg_api_images',
  'pokemon_api_id', 'pokemon_api_data', 'pokemon_api_verified', 'pokemon_api_verified_at',
  'pokemon_api_confidence', 'pokemon_api_method',
  // MTG
  'mana_cost', 'color_identity', 'mtg_card_type', 'creature_type', 'power_toughness', 'expansion_code',
  'collector_number', 'flavor_text', 'oracle_text', 'keywords', 'is_foil', 'is_promo', 'border_color',
  'frame_version', 'is_double_faced', 'scryfall_id', 'mtg_api_id', 'mtg_oracle_id', 'mtg_api_data',
  'mtg_api_verified', 'mtg_api_verified_at', 'mtg_api_confidence', 'mtg_api_method', 'foil_type',
  'mtg_mana_cost', 'mtg_type_line', 'mtg_colors', 'mtg_rarity', 'mtg_set_code', 'mtg_card_id',
  'mtg_reference_image', 'mtg_database_match_confidence',
  // Lorcana
  'ink_color', 'lorcana_card_type', 'character_version', 'inkwell', 'strength', 'willpower', 'lore_value',
  'ink_cost', 'classifications', 'move_cost', 'quest_value', 'abilities', 'is_enchanted',
  'lorcana_card_id', 'lorcana_reference_image',
  // One Piece
  'onepiece_card_id', 'onepiece_reference_image', 'onepiece_database_match_confidence', 'op_card_type',
  'op_card_color', 'op_card_power', 'op_card_cost', 'op_life', 'op_counter', 'op_attribute',
  'op_sub_types', 'op_variant_type',
  // Yu-Gi-Oh (columns may not exist on every environment; only touched when present in the payload)
  'ygo_card_id', 'ygo_card_type', 'ygo_frame_type', 'ygo_attribute', 'ygo_race', 'ygo_archetype',
  'ygo_atk', 'ygo_def', 'ygo_level', 'ygo_scale', 'ygo_linkval', 'ygo_linkmarkers', 'ygo_card_desc',
  'ygo_rarity', 'ygo_set_code', 'ygo_image_url',
];

/** Label keys that carry the GRADE (refreshed on regrade); everything else in label_data is identity. */
const LABEL_GRADE_KEYS = ['grade', 'gradeFormatted', 'condition'] as const;

export interface PreserveIdentityOptions {
  forceRegrade: boolean;
  /** `?reidentify=true` — opt back into re-identification */
  reidentify?: boolean;
  /** Log prefix, e.g. "GET /api/yugioh/abc" */
  tag?: string;
}

export interface PreserveIdentityResult {
  preserved: boolean;
  reason: string;
  /** Identity columns whose regraded value differed from the stored one (what would have changed) */
  changedColumns: string[];
  /**
   * True when the guard could not do its job and the caller MUST NOT save.
   *
   * `preserved: false` alone is ambiguous — it covers both "nothing to preserve"
   * (not a regrade, reidentify was requested, card was never identified) and
   * "I could not read the stored identity". The first three are fine to proceed
   * on. The last one is not: proceeding lets the regrade's fresh identification
   * overwrite a correct stored identity, which is the exact failure this guard
   * exists to prevent. Callers must check `abort` before writing.
   */
  abort?: boolean;
}

/**
 * Mutates `updateData` in place so an identified card keeps its identity across a
 * force-regrade. Fail-safe: any error leaves the payload untouched and is logged.
 */
export async function preserveIdentityOnRegrade(
  supabase: SupabaseClient<any, any, any>,
  cardId: string,
  updateData: Record<string, any>,
  options: PreserveIdentityOptions,
): Promise<PreserveIdentityResult> {
  const tag = options.tag || `card ${cardId}`;
  if (!options.forceRegrade) return { preserved: false, reason: 'not a regrade', changedColumns: [] };
  if (options.reidentify) {
    console.log(`[${tag}] 🪪 reidentify=true — regrade may change identification`);
    return { preserved: false, reason: 'reidentify requested', changedColumns: [] };
  }

  try {
    // Only ask for identity columns the payload is actually about to write, so a
    // column that does not exist in this environment cannot break the select.
    const payloadIdentityKeys = IDENTITY_COLUMNS.filter(k => Object.prototype.hasOwnProperty.call(updateData, k));
    const selectCols = Array.from(new Set(['card_name', 'label_data', 'conversational_card_info', ...payloadIdentityKeys]));

    let { data: existing, error } = await supabase
      .from('cards')
      .select(selectCols.join(', '))
      .eq('id', cardId)
      .maybeSingle();

    if (error && /column|does not exist|PGRST/i.test(error.message || '')) {
      // Unknown column in this environment — retry with the core set only.
      const core = ['card_name', 'card_set', 'card_number', 'release_date', 'label_data', 'conversational_card_info']
        .filter(k => k === 'card_name' || k === 'label_data' || k === 'conversational_card_info' || payloadIdentityKeys.includes(k));
      ({ data: existing, error } = await supabase.from('cards').select(core.join(', ')).eq('id', cardId).maybeSingle());
    }
    if (error || !existing) {
      // FAIL CLOSED. Previously this returned preserved:false and the caller
      // carried on, letting the regrade rename a correctly-identified card
      // whenever the read happened to fail — a transient network blip was
      // enough. Refusing the save is recoverable; a silently renamed card is
      // not, because the customer sees the wrong card and we have overwritten
      // what it used to be.
      console.error(`[${tag}] 🪪 identity guard COULD NOT READ stored identity (${error?.message || 'no row'}) — aborting save`);
      return { preserved: false, reason: 'fetch failed', changedColumns: [], abort: true };
    }

    const row = existing as Record<string, any>;
    if (!row.card_name) {
      return { preserved: false, reason: 'card was never identified', changedColumns: [] };
    }

    const changed: string[] = [];
    for (const key of payloadIdentityKeys) {
      if (!Object.prototype.hasOwnProperty.call(row, key)) continue; // column not selected (retry path)
      const before = JSON.stringify(updateData[key] ?? null);
      const stored = JSON.stringify(row[key] ?? null);
      if (before !== stored) changed.push(key);
      updateData[key] = row[key] ?? null;
    }

    // Label: stored identity lines + regraded grade fields.
    if (updateData.label_data && row.label_data && typeof row.label_data === 'object') {
      const fresh = updateData.label_data as Record<string, any>;
      const merged: Record<string, any> = { ...row.label_data };
      for (const k of LABEL_GRADE_KEYS) if (k in fresh) merged[k] = fresh[k];
      if (fresh.serial != null) merged.serial = fresh.serial;
      updateData.label_data = merged;
    }

    // Grading JSON: keep the report's card_info in step with the row.
    if (row.conversational_card_info && typeof updateData.conversational_grading === 'string') {
      try {
        const j = JSON.parse(updateData.conversational_grading);
        if (j && typeof j === 'object' && j.card_info) {
          j.card_info = row.conversational_card_info;
          updateData.conversational_grading = JSON.stringify(j);
          if (typeof updateData.ai_grading === 'string') updateData.ai_grading = updateData.conversational_grading;
        }
      } catch { /* leave JSON as-is */ }
    }

    if (changed.length > 0) {
      console.log(`[${tag}] 🪪 regrade kept stored identity "${row.card_name}" — regrade would have changed: ${changed.join(', ')}`);
    } else {
      console.log(`[${tag}] 🪪 regrade kept stored identity "${row.card_name}" (no differences)`);
    }
    return { preserved: true, reason: 'ok', changedColumns: changed };
  } catch (e: any) {
    // Same reasoning as the fetch-failure path: if the guard threw, it did not
    // run, so we cannot know whether the payload would rename the card.
    console.error(`[${tag}] 🪪 identity guard THREW (${e?.message || e}) — aborting save`);
    return { preserved: false, reason: 'error', changedColumns: [], abort: true };
  }
}
