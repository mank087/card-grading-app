-- =====================================================
-- PUBLIC/PRIVATE CARDS MIGRATION
-- Date: 2025-10-21
-- Purpose: Add visibility control to cards table
-- =====================================================

-- Step 1: Add visibility column with default 'public'
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private'));

-- Step 2: Set all existing cards to 'public' (shareable by default)
UPDATE cards
SET visibility = 'public'
WHERE visibility IS NULL;

-- Step 3: Create index for fast search queries (public cards only)
CREATE INDEX IF NOT EXISTS idx_cards_visibility_serial
ON cards(visibility, serial)
WHERE visibility = 'public';

-- Step 4: Create index for user's card filtering
CREATE INDEX IF NOT EXISTS idx_cards_user_visibility
ON cards(user_id, visibility);

-- Step 5: Add comment to document the column
COMMENT ON COLUMN cards.visibility IS 'Card visibility: public (shareable, searchable) or private (owner only)';

-- =====================================================
-- VERIFICATION QUERIES (run these to verify migration)
-- =====================================================

-- Check column was added
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'cards' AND column_name = 'visibility';

-- Check all cards are private
-- SELECT visibility, COUNT(*)
-- FROM cards
-- GROUP BY visibility;

-- Check indexes were created
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'cards' AND indexname LIKE 'idx_cards_visibility%';

-- =====================================================
-- ROLLBACK (if needed)
-- =====================================================

-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_cards_visibility_serial;
-- DROP INDEX IF EXISTS idx_cards_user_visibility;
-- ALTER TABLE cards DROP COLUMN IF EXISTS visibility;
