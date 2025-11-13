-- ============================================================================
-- v3.3 Structured Data Migration
-- ============================================================================
-- Purpose: Add JSONB columns for pre-parsed defect data
-- Eliminates need for frontend regex parsing
-- Date: 2025-10-24
-- ============================================================================

-- Add structured defect columns
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_defects_front JSONB DEFAULT NULL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_defects_back JSONB DEFAULT NULL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_centering JSONB DEFAULT NULL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_metadata JSONB DEFAULT NULL;

-- Add indexes for faster querying (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_cards_defects_front ON cards USING GIN (conversational_defects_front);
CREATE INDEX IF NOT EXISTS idx_cards_defects_back ON cards USING GIN (conversational_defects_back);

-- Add comments for documentation
COMMENT ON COLUMN cards.conversational_defects_front IS 'Structured front-side defect data (corners, edges, surface) - parsed from conversational_grading markdown';
COMMENT ON COLUMN cards.conversational_defects_back IS 'Structured back-side defect data (corners, edges, surface) - parsed from conversational_grading markdown';
COMMENT ON COLUMN cards.conversational_centering IS 'Structured centering measurements for front and back';
COMMENT ON COLUMN cards.conversational_metadata IS 'Additional grading metadata (cross-side verification, inspection count, etc.)';

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run after migration to verify columns exist:
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'cards'
--   AND column_name LIKE 'conversational_%';
-- ============================================================================

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================
-- To rollback this migration, run:
--
-- DROP INDEX IF EXISTS idx_cards_defects_front;
-- DROP INDEX IF EXISTS idx_cards_defects_back;
-- ALTER TABLE cards DROP COLUMN IF EXISTS conversational_defects_front;
-- ALTER TABLE cards DROP COLUMN IF EXISTS conversational_defects_back;
-- ALTER TABLE cards DROP COLUMN IF EXISTS conversational_centering;
-- ALTER TABLE cards DROP COLUMN IF EXISTS conversational_metadata;
-- ============================================================================
