-- Phase 2A: identity confirmation and matching prices (identity/save foundation).
--
-- Adds the revision + confirmation bookkeeping the owner's "confirm card details"
-- flow needs, an append-only correction history, and ONE authoritative save
-- function so identity, confirmation state and pricing invalidation commit
-- together instead of as four independent writes that can half-apply.
--
-- Safe to apply before the matching application code ships: the new columns are
-- additive with defaults, and nothing reads them until the code lands.
BEGIN;

-- Revision bookkeeping. `identity_revision` moves only on a MATERIAL identity
-- change (name/set/number/year/language/variant/serial), so an ordinary
-- condition regrade cannot invalidate a confirmation the owner already gave.
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS identity_revision integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS identity_confirmed_revision integer,
  ADD COLUMN IF NOT EXISTS identity_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS identity_confirmed_by uuid,
  -- A dismissal ("review later") is tracked separately and is NEVER approval.
  ADD COLUMN IF NOT EXISTS identity_review_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pricing_selection_revision integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.cards.identity_confirmed_revision IS
  'The identity_revision the owner reviewed. Confirmed only when it equals identity_revision.';

-- Append-only correction trail. Server-only: no RLS policies are defined, so
-- only the service role (which bypasses RLS) can reach it. Same convention as
-- public.grade_review_notifications (20260907_manual_grade_reviews.sql).
CREATE TABLE IF NOT EXISTS public.card_identity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_role text CHECK (actor_role IN ('owner','admin','system')),
  action text CHECK (action IN ('edit','confirm','edit_and_confirm','dismiss','pricing_selection')),
  identity_revision integer NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.card_identity_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.card_identity_history FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.card_identity_history TO service_role;
CREATE INDEX IF NOT EXISTS card_identity_history_card_recent
  ON public.card_identity_history(card_id, created_at DESC);

-- The single authoritative identity writer.
--
-- Column safety: the function NEVER builds dynamic SQL from client-supplied
-- names. The patch is merged into the row's own jsonb (filtered to a hard-coded
-- allowlist) and written back through one static column list, so a column that
-- is not named literally below cannot be touched by any input. Grade columns,
-- image paths, credits and grade timestamps are therefore unreachable here.
CREATE OR REPLACE FUNCTION public.save_card_identity(
  p_card_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_expected_revision integer,
  p_column_patch jsonb,
  p_card_info jsonb,
  p_material_change boolean,
  p_confirm boolean,
  p_dismiss boolean,
  p_invalidate_columns text[],
  p_changed_fields text[],
  p_before jsonb,
  p_after jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  -- Editable identity columns. Mirrors the details editor's field mapping.
  c_identity constant text[] := ARRAY[
    'card_name','featured','pokemon_featured','card_set','card_number','release_date',
    'manufacturer_name','serial_numbering','autographed','autograph_type','rookie_card',
    'first_print_rookie','memorabilia_type','holofoil','is_foil','foil_type','mtg_rarity',
    'is_double_faced','mtg_set_code','rarity_tier','rarity_description','pokemon_type',
    'pokemon_stage','hp'
  ];
  -- Current/derived pricing bound to the OLD identity. Never includes
  -- dcm_price_at_grading(_date) or card_price_history: those are history.
  c_invalidatable constant text[] := ARRAY[
    'dcm_selected_product_id','dcm_selected_product_name','dcm_selected_at',
    'dcm_price_estimate','dcm_price_raw','dcm_price_graded_high','dcm_price_median',
    'dcm_price_average','dcm_price_updated_at','dcm_price_match_confidence',
    'dcm_price_product_id','dcm_price_product_name','dcm_cached_prices','dcm_prices_cached_at',
    'ebay_price_lowest','ebay_price_median','ebay_price_average','ebay_price_highest',
    'ebay_price_listing_count','ebay_price_updated_at',
    'scryfall_price_usd','scryfall_price_usd_foil'
  ];
  card public.cards%ROWTYPE;
  v_material boolean := coalesce(p_material_change, false);
  v_confirm boolean := coalesce(p_confirm, false);
  v_dismiss boolean := coalesce(p_dismiss, false);
  v_revision integer;
  v_merged jsonb;
  v_nulls jsonb := '{}'::jsonb;
  v_invalidated boolean := false;
  v_action text;
  v_key text;
BEGIN
  IF p_actor_role IS NULL OR p_actor_role NOT IN ('owner','admin','system') THEN
    RETURN jsonb_build_object('status','forbidden');
  END IF;

  -- Serializes concurrent saves for this card. Everything below reads the
  -- locked row, so ownership and the sold lock are re-checked at write time.
  SELECT * INTO card FROM public.cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','not_found');
  END IF;
  IF p_actor_role = 'owner' AND card.user_id IS DISTINCT FROM p_actor_id THEN
    RETURN jsonb_build_object('status','forbidden');
  END IF;
  -- Same rule as isRecordLocked(): a sold card's record belongs to the buyer.
  IF card.ownership_status = 'sold' THEN
    RETURN jsonb_build_object('status','locked');
  END IF;

  v_revision := coalesce(card.identity_revision, 0);
  IF p_expected_revision IS NOT NULL AND p_expected_revision IS DISTINCT FROM v_revision THEN
    RETURN jsonb_build_object('status','stale','current_revision', v_revision);
  END IF;

  IF v_material THEN
    v_revision := v_revision + 1;
  END IF;

  v_merged := to_jsonb(card);

  -- Allowlisted column patch only. Anything else in p_column_patch is dropped.
  IF p_column_patch IS NOT NULL THEN
    v_merged := v_merged || coalesce(
      (SELECT jsonb_object_agg(key, value) FROM jsonb_each(p_column_patch) WHERE key = ANY(c_identity)),
      '{}'::jsonb);
  END IF;

  IF p_card_info IS NOT NULL THEN
    v_merged := v_merged || jsonb_build_object('conversational_card_info', p_card_info);
    -- Preserve what the model originally read, once, on the first owner edit.
    IF card.original_card_info IS NULL AND card.conversational_card_info IS NOT NULL THEN
      v_merged := v_merged || jsonb_build_object('original_card_info', card.conversational_card_info);
    END IF;
  END IF;

  -- Pricing invalidation, again intersected with a hard-coded allowlist.
  IF v_material AND p_invalidate_columns IS NOT NULL THEN
    FOREACH v_key IN ARRAY p_invalidate_columns LOOP
      IF v_key = ANY(c_invalidatable) THEN
        v_nulls := v_nulls || jsonb_build_object(v_key, NULL);
        v_invalidated := true;
      END IF;
    END LOOP;
    v_merged := v_merged || v_nulls;
  END IF;

  v_merged := v_merged || jsonb_build_object('identity_revision', v_revision);

  IF v_confirm THEN
    v_merged := v_merged || jsonb_build_object(
      'identity_confirmed_revision', v_revision,
      'identity_confirmed_at', now(),
      'identity_confirmed_by', p_actor_id,
      'identity_review_dismissed_at', NULL);
  ELSIF v_material THEN
    -- The card is no longer what was reviewed, so the old approval lapses.
    v_merged := v_merged || jsonb_build_object(
      'identity_confirmed_revision', NULL,
      'identity_confirmed_at', NULL,
      'identity_confirmed_by', NULL);
  END IF;

  IF v_dismiss AND NOT v_confirm THEN
    v_merged := v_merged || jsonb_build_object('identity_review_dismissed_at', now());
  END IF;

  UPDATE public.cards SET (
    card_name, featured, pokemon_featured, card_set, card_number, release_date,
    manufacturer_name, serial_numbering, autographed, autograph_type, rookie_card,
    first_print_rookie, memorabilia_type, holofoil, is_foil, foil_type, mtg_rarity,
    is_double_faced, mtg_set_code, rarity_tier, rarity_description, pokemon_type,
    pokemon_stage, hp,
    conversational_card_info, original_card_info,
    dcm_selected_product_id, dcm_selected_product_name, dcm_selected_at,
    dcm_price_estimate, dcm_price_raw, dcm_price_graded_high, dcm_price_median,
    dcm_price_average, dcm_price_updated_at, dcm_price_match_confidence,
    dcm_price_product_id, dcm_price_product_name, dcm_cached_prices, dcm_prices_cached_at,
    ebay_price_lowest, ebay_price_median, ebay_price_average, ebay_price_highest,
    ebay_price_listing_count, ebay_price_updated_at,
    scryfall_price_usd, scryfall_price_usd_foil,
    identity_revision, identity_confirmed_revision, identity_confirmed_at,
    identity_confirmed_by, identity_review_dismissed_at
  ) = (SELECT
    card_name, featured, pokemon_featured, card_set, card_number, release_date,
    manufacturer_name, serial_numbering, autographed, autograph_type, rookie_card,
    first_print_rookie, memorabilia_type, holofoil, is_foil, foil_type, mtg_rarity,
    is_double_faced, mtg_set_code, rarity_tier, rarity_description, pokemon_type,
    pokemon_stage, hp,
    conversational_card_info, original_card_info,
    dcm_selected_product_id, dcm_selected_product_name, dcm_selected_at,
    dcm_price_estimate, dcm_price_raw, dcm_price_graded_high, dcm_price_median,
    dcm_price_average, dcm_price_updated_at, dcm_price_match_confidence,
    dcm_price_product_id, dcm_price_product_name, dcm_cached_prices, dcm_prices_cached_at,
    ebay_price_lowest, ebay_price_median, ebay_price_average, ebay_price_highest,
    ebay_price_listing_count, ebay_price_updated_at,
    scryfall_price_usd, scryfall_price_usd_foil,
    identity_revision, identity_confirmed_revision, identity_confirmed_at,
    identity_confirmed_by, identity_review_dismissed_at
    FROM jsonb_populate_record(NULL::public.cards, v_merged))
  WHERE id = p_card_id;

  v_action := CASE
    WHEN v_dismiss AND NOT v_confirm THEN 'dismiss'
    WHEN v_confirm AND coalesce(array_length(p_changed_fields, 1), 0) > 0 THEN 'edit_and_confirm'
    WHEN v_confirm THEN 'confirm'
    ELSE 'edit'
  END;

  INSERT INTO public.card_identity_history
    (card_id, actor_id, actor_role, action, identity_revision, changed_fields, before, after)
  VALUES (p_card_id, p_actor_id, p_actor_role, v_action, v_revision,
    coalesce(p_changed_fields, '{}'::text[]), p_before, p_after);

  RETURN jsonb_build_object(
    'status','saved',
    'identity_revision', v_revision,
    'confirmed', v_confirm,
    'pricing_invalidated', v_invalidated);
END;
$$;

REVOKE ALL ON FUNCTION public.save_card_identity(uuid, uuid, text, integer, jsonb, jsonb, boolean, boolean, boolean, text[], text[], jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_card_identity(uuid, uuid, text, integer, jsonb, jsonb, boolean, boolean, boolean, text[], text[], jsonb, jsonb)
  TO service_role;

COMMIT;
