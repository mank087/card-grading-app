-- =========================================================================
-- Fix VARCHAR(50) Column Size Limits
-- =========================================================================
-- Date: 2025-12-16
-- Purpose: Increase VARCHAR sizes for fields that may contain longer text
--
-- Issue: Database error "value too long for type character varying(50)"
-- Root Cause: AI may output longer descriptive text for these fields
-- =========================================================================

-- Increase conversational_prompt_version from VARCHAR(50) to VARCHAR(100)
-- Reason: May contain version strings like "DCM_Grading_v7.2_MIN_SCORING"
ALTER TABLE cards ALTER COLUMN conversational_prompt_version TYPE VARCHAR(100);

-- Increase conversational_condition_label from VARCHAR(50) to VARCHAR(100)
-- Reason: May contain descriptive labels like "Near Mint-Mint" or longer
ALTER TABLE cards ALTER COLUMN conversational_condition_label TYPE VARCHAR(100);

-- Increase front_back_verification_assessment from VARCHAR(50) to VARCHAR(200)
-- Reason: May contain detailed assessment text
ALTER TABLE cards ALTER COLUMN front_back_verification_assessment TYPE VARCHAR(200);

-- Increase rarity_tier from VARCHAR(50) to VARCHAR(100)
-- Reason: May contain descriptive text about card rarity
ALTER TABLE cards ALTER COLUMN rarity_tier TYPE VARCHAR(100);

-- Increase print_finish from VARCHAR(50) to VARCHAR(100)
-- Reason: May contain descriptive text about card finish
ALTER TABLE cards ALTER COLUMN print_finish TYPE VARCHAR(100);

-- Increase memorabilia_type from VARCHAR(50) to VARCHAR(200)
-- Reason: May contain detailed memorabilia descriptions
ALTER TABLE cards ALTER COLUMN memorabilia_type TYPE VARCHAR(200);

-- Increase slab_company from VARCHAR(50) to VARCHAR(100)
-- Reason: May contain company names with additional info
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
--     'front_back_verification_assessment',
--     'rarity_tier',
--     'print_finish',
--     'memorabilia_type',
--     'slab_company'
--   );
-- =========================================================================
