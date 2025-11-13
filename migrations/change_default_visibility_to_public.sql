-- =====================================================
-- CHANGE DEFAULT VISIBILITY TO PUBLIC
-- Date: 2025-10-21
-- Purpose: Set new cards to public by default
-- =====================================================

-- Step 1: Change the default for new cards
ALTER TABLE cards
ALTER COLUMN visibility SET DEFAULT 'public';

-- Step 2: Update all existing cards to public
UPDATE cards
SET visibility = 'public'
WHERE visibility = 'private' OR visibility IS NULL;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check the new default
-- SELECT column_name, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'cards' AND column_name = 'visibility';
-- Expected: 'public'

-- Check all cards are now public
-- SELECT visibility, COUNT(*)
-- FROM cards
-- GROUP BY visibility;
-- Expected: public | [your card count]

-- =====================================================
-- ROLLBACK (if needed)
-- =====================================================

-- To change back to private as default:
-- ALTER TABLE cards ALTER COLUMN visibility SET DEFAULT 'private';
-- UPDATE cards SET visibility = 'private';
