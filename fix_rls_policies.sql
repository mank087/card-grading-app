-- =====================================================
-- FIX RLS POLICIES FOR POKEMON CARD UPLOADS
-- Date: October 30, 2025
-- Purpose: Ensure RLS policies allow card inserts
-- =====================================================

-- First, let's check if visibility or is_public column exists
-- and add it if needed
DO $$
BEGIN
    -- Add is_public column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'cards' AND column_name = 'is_public') THEN
        ALTER TABLE cards ADD COLUMN is_public BOOLEAN DEFAULT true;
    END IF;

    -- Add visibility column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'cards' AND column_name = 'visibility') THEN
        ALTER TABLE cards ADD COLUMN visibility TEXT DEFAULT 'public';
    END IF;
END $$;

-- Create index on is_public if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_cards_is_public ON cards(is_public);

-- Create index on visibility if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_cards_visibility ON cards(visibility);

-- =====================================================
-- UPDATE RLS POLICIES
-- =====================================================

-- Drop existing policies to recreate them with correct logic
DROP POLICY IF EXISTS "Users can view own cards" ON cards;
DROP POLICY IF EXISTS "Users can insert own cards" ON cards;
DROP POLICY IF EXISTS "Users can update own cards" ON cards;
DROP POLICY IF EXISTS "Users can delete own cards" ON cards;
DROP POLICY IF EXISTS "Public cards are viewable by everyone" ON cards;

-- Policy: Users can view their own cards
CREATE POLICY "Users can view own cards"
    ON cards FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Anyone can view public cards
CREATE POLICY "Public cards are viewable by everyone"
    ON cards FOR SELECT
    USING (
        is_public = true
        OR visibility = 'public'
    );

-- Policy: Users can insert their own cards
CREATE POLICY "Users can insert own cards"
    ON cards FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own cards
CREATE POLICY "Users can update own cards"
    ON cards FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own cards
CREATE POLICY "Users can delete own cards"
    ON cards FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if columns exist
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'cards'
-- AND column_name IN ('is_public', 'visibility');

-- Check policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'cards'
-- ORDER BY policyname;

-- Test if a user can insert (run as authenticated user)
-- INSERT INTO cards (user_id, category, serial, is_public)
-- VALUES (auth.uid(), 'Pokemon', 'TEST-123', true);

-- =====================================================
-- NOTES
-- =====================================================
--
-- After running this script:
-- 1. Try uploading a Pokemon card again
-- 2. If you still get RLS errors, check that you're logged in
-- 3. Verify auth.uid() matches the user_id you're inserting
-- 4. Check browser console for authentication errors
--
-- =====================================================
