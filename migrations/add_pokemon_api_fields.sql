-- =====================================================
-- ADD POKEMON TCG API INTEGRATION FIELDS
-- Date: October 30, 2025
-- Purpose: Add columns needed for Pokemon TCG API integration
-- =====================================================

-- Step 1: Add api_card_id for storing Pokemon TCG API card ID
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS api_card_id TEXT;

-- Step 2: Add is_public as alias for visibility (for compatibility)
-- Note: This is for backward compatibility with code using is_public
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Step 3: Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_cards_api_card_id ON cards(api_card_id);
CREATE INDEX IF NOT EXISTS idx_cards_is_public ON cards(is_public);

-- Step 4: Sync is_public with visibility for existing records
UPDATE cards
SET is_public = CASE
    WHEN visibility = 'public' THEN true
    WHEN visibility = 'private' THEN false
    ELSE true
END
WHERE is_public IS NULL;

-- Step 5: Add comments to document the columns
COMMENT ON COLUMN cards.api_card_id IS 'Pokemon TCG API card ID (e.g., base1-4)';
COMMENT ON COLUMN cards.is_public IS 'Boolean visibility flag (true = public, false = private). Use alongside visibility column.';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check columns were added
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'cards'
  AND column_name IN ('api_card_id', 'is_public')
ORDER BY column_name;

-- Check indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'cards'
  AND indexname IN ('idx_cards_api_card_id', 'idx_cards_is_public');

-- =====================================================
-- NOTES
-- =====================================================
--
-- This migration adds support for Pokemon TCG API integration:
-- - api_card_id: Stores the Pokemon TCG API card identifier
-- - is_public: Boolean flag for visibility (mirrors visibility column)
--
-- Both columns work together with existing conversational_card_info
-- JSONB field to provide complete Pokemon card metadata.
--
-- =====================================================
