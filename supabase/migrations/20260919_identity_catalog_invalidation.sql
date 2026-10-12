-- Catalog verification describes one identity revision. An owner correction must
-- not retain the prior card's verified badge, reference, or external catalog ID.
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
    NEW.conversational_card_info := NEW.conversational_card_info - ARRAY[
      'catalog_resolution','validated_source','pokemon_api_verified','pokemon_api_id',
      'pokemon_api_data','tcgplayer_url','_database_candidate','_name_agreement',
      '_rejected_candidate','_ocr_override','set_id','set_code','set_total',
      'identification_check','identification_confidence'
    ];
    IF NEW.card_number IS DISTINCT FROM OLD.card_number THEN
      NEW.conversational_card_info := coalesce(NEW.conversational_card_info, '{}'::jsonb)
        || jsonb_build_object('card_number_raw', NEW.card_number);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS invalidate_identity_catalog_metadata ON public.cards;
CREATE TRIGGER invalidate_identity_catalog_metadata BEFORE UPDATE ON public.cards
FOR EACH ROW EXECUTE FUNCTION public.invalidate_identity_catalog_metadata();
COMMIT;
