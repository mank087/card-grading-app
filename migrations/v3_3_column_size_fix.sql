-- =========================================================================
-- Conversational Grading v3.3 - Column Size Fix
-- =========================================================================
-- Date: 2025-10-24
-- Purpose: Increase VARCHAR sizes for fields that may contain longer text
--
-- Issue: Database error "value too long for type character varying(50)"
-- Root Cause: Some v3.3 fields contain descriptive text longer than 50 chars
-- =========================================================================

-- Increase autograph_type from VARCHAR(50) to VARCHAR(200)
-- Reason: May contain descriptive text like "Authenticated on-card autograph"
ALTER TABLE cards ALTER COLUMN autograph_type TYPE VARCHAR(200);

-- Increase serial_number_fraction from VARCHAR(50) to VARCHAR(100)
-- Reason: May contain text like "12345/99999 (Gold Parallel)"
ALTER TABLE cards ALTER COLUMN serial_number_fraction TYPE VARCHAR(100);

-- Increase cross_side_verification_result from VARCHAR(50) to VARCHAR(200)
-- Reason: May contain descriptive results like "Confirmed Structural Crease - visible on both front and back"
ALTER TABLE cards ALTER COLUMN cross_side_verification_result TYPE VARCHAR(200);

-- =========================================================================
-- Verification Query (Run after migration)
-- =========================================================================
-- SELECT column_name, data_type, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'cards'
--   AND column_name IN ('autograph_type', 'serial_number_fraction', 'cross_side_verification_result');
-- =========================================================================
