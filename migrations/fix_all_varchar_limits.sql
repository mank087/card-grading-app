-- =========================================================================
-- Comprehensive VARCHAR Column Size Fix
-- =========================================================================
-- Date: 2025-12-16
-- Purpose: Fix ALL VARCHAR(50) columns that may receive longer AI-generated text
--
-- Issue: Database error "value too long for type character varying(50)"
-- This migration safely increases sizes for all potentially problematic columns
-- =========================================================================

-- =========================================================================
-- SECTION 1: Conversational Grading Fields
-- =========================================================================

-- conversational_prompt_version: May contain "DCM_Grading_v7.2_MIN_SCORING"
ALTER TABLE cards ALTER COLUMN conversational_prompt_version TYPE VARCHAR(100);

-- conversational_condition_label: May contain "Near Mint-Mint" or longer
ALTER TABLE cards ALTER COLUMN conversational_condition_label TYPE VARCHAR(100);

-- =========================================================================
-- SECTION 2: Rarity Classification Fields
-- =========================================================================

-- rarity_tier: May contain descriptive tier names
ALTER TABLE cards ALTER COLUMN rarity_tier TYPE VARCHAR(100);

-- print_finish: May contain "Holographic Refractor" etc
ALTER TABLE cards ALTER COLUMN print_finish TYPE VARCHAR(100);

-- memorabilia_type: May contain detailed descriptions
ALTER TABLE cards ALTER COLUMN memorabilia_type TYPE VARCHAR(200);

-- autograph_type: May contain "Authenticated on-card autograph"
ALTER TABLE cards ALTER COLUMN autograph_type TYPE VARCHAR(200);

-- serial_number_fraction: May contain "12345/99999 (Gold Parallel)"
ALTER TABLE cards ALTER COLUMN serial_number_fraction TYPE VARCHAR(100);

-- =========================================================================
-- SECTION 3: Grading Metadata Fields
-- =========================================================================

-- cross_side_verification_result: May contain detailed verification text
ALTER TABLE cards ALTER COLUMN cross_side_verification_result TYPE VARCHAR(200);

-- slab_company: May contain company names with details
ALTER TABLE cards ALTER COLUMN slab_company TYPE VARCHAR(100);

-- =========================================================================
-- Verification Query (Run after migration)
-- =========================================================================
-- SELECT column_name, data_type, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'cards'
--   AND column_name IN (
--     'conversational_prompt_version',
--     'conversational_condition_label',
--     'rarity_tier',
--     'print_finish',
--     'memorabilia_type',
--     'autograph_type',
--     'serial_number_fraction',
--     'cross_side_verification_result',
--     'slab_company'
--   );
-- =========================================================================
