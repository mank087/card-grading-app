-- Keep the grader's identification evidence through owner corrections (Oct 12 2026).
--
-- NOT APPLIED AUTOMATICALLY. The owner must run this file in the Supabase SQL
-- editor (production). It only replaces a trigger function; no data changes,
-- safe to re-run.
--
-- 20260919_identity_catalog_invalidation.sql (live in production) strips the
-- prior card's catalog link from conversational_card_info whenever
-- identity_revision moves, which is right: a corrected card must not keep the
-- old card's verified badge, reference image or catalog IDs.
--
-- It ALSO stripped 'identification_check' and 'identification_confidence'.
-- Those are not catalog facts. They are the grading run's own record of what it
-- read off the photo and how sure it was, i.e. the evidence an owner
-- correction is measured against. Deleting them on every correction erased
-- exactly the cards that show where identification goes wrong: an accuracy
-- review of card_identity_history could see THAT a card was corrected but no
-- longer what the grader had claimed or how confident it was.
--
-- This redefines the function identically except those two keys are kept.
-- The catalog keys are still stripped, the catalog columns are still reset,
-- and card_number_raw still follows a changed card_number.
--
-- Known side effect: GET /api/cards/[id]/grade-review returns
-- identification_confidence, and the web GradeReviewButton / mobile GradeReview
-- steer a 'low' card toward a details dispute. After this, a card the owner has
-- already corrected keeps that 'low' nudge (previously it vanished with the key).
-- If unwanted, gate it on identity_confirmed_revision in that route.
BEGIN;
CREATE OR REPLACE FUNCTION public.invalidate_identity_catalog_metadata()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.identity_revision IS DISTINCT FROM OLD.identity_revision THEN
    -- jsonb_populate_record ignores keys absent in older schemas. This migration
    -- can run across category deployments without requiring every optional column.
    NEW := jsonb_populate_record(NEW, jsonb_build_object(
      'validated_source', NULL, 'validation_tier', NULL, 'validation_confidence', NULL,
      'pokemon_api_verified', false, 'pokemon_api_id', NULL, 'pokemon_api_data', NULL,
      'pokemon_api_verified_at', NULL, 'pokemon_api_confidence', NULL, 'pokemon_api_method', NULL,
      'mtg_api_verified', false, 'mtg_api_id', NULL, 'mtg_api_data', NULL,
      'mtg_card_id', NULL, 'mtg_reference_image', NULL, 'scryfall_id', NULL,
      'lorcana_card_id', NULL, 'lorcana_reference_image', NULL,
      'onepiece_card_id', NULL, 'onepiece_reference_image', NULL,
      'yugioh_card_id', NULL, 'yugioh_reference_image', NULL,
      'starwars_card_id', NULL, 'starwars_reference_image', NULL
    ));
    -- 'identification_check' and 'identification_confidence' are deliberately
    -- NOT in this list any more (see the header).
    NEW.conversational_card_info := NEW.conversational_card_info - ARRAY[
      'catalog_resolution','validated_source','pokemon_api_verified','pokemon_api_id',
      'pokemon_api_data','tcgplayer_url','_database_candidate','_name_agreement',
      '_rejected_candidate','_ocr_override','set_id','set_code','set_total'
    ];
    IF NEW.card_number IS DISTINCT FROM OLD.card_number THEN
      NEW.conversational_card_info := coalesce(NEW.conversational_card_info, '{}'::jsonb)
        || jsonb_build_object('card_number_raw', NEW.card_number);
    END IF;
  END IF;
  RETURN NEW;
END $$;
-- The trigger itself (from 20260919) already points at this function by name;
-- CREATE OR REPLACE swaps the body in place, so it is not recreated here.
COMMIT;
