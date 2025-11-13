-- =====================================================
-- COMPLETE FIX FOR POKEMON CARD UPLOADS
-- Date: October 30, 2025
-- Purpose: Add missing columns and fix RLS policies
-- =====================================================

-- PART 1: ADD MISSING COLUMNS
-- =====================================================

-- Add api_card_id for Pokemon TCG API card ID
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS api_card_id TEXT;

-- Add is_public for visibility compatibility
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Add conversational_card_info if it doesn't exist (from v3.2 migration)
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS conversational_card_info JSONB;

-- Add other conversational fields if they don't exist
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_grading TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_decimal_grade DECIMAL(4,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_whole_grade INTEGER;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_condition_label TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_grade_uncertainty TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_image_confidence TEXT;

-- Add visibility column if it doesn't exist
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private'));

-- PART 2: CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_cards_api_card_id ON cards(api_card_id);
CREATE INDEX IF NOT EXISTS idx_cards_is_public ON cards(is_public);
CREATE INDEX IF NOT EXISTS idx_cards_visibility ON cards(visibility);
CREATE INDEX IF NOT EXISTS idx_cards_conversational_card_info ON cards USING GIN (conversational_card_info);

-- PART 3: SYNC DATA
-- =====================================================

-- Sync is_public with visibility
UPDATE cards
SET is_public = CASE
    WHEN visibility = 'public' THEN true
    WHEN visibility = 'private' THEN false
    ELSE true
END
WHERE is_public IS NULL OR is_public != (visibility = 'public');

-- Set visibility from is_public if visibility is null
UPDATE cards
SET visibility = CASE
    WHEN is_public = true THEN 'public'
    WHEN is_public = false THEN 'private'
    ELSE 'public'
END
WHERE visibility IS NULL;

-- PART 4: FIX RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own cards" ON cards;
DROP POLICY IF EXISTS "Users can insert own cards" ON cards;
DROP POLICY IF EXISTS "Users can update own cards" ON cards;
DROP POLICY IF EXISTS "Users can delete own cards" ON cards;
DROP POLICY IF EXISTS "Public cards are viewable by everyone" ON cards;

-- Recreate policies with correct logic

-- Policy: Users can view their own cards
CREATE POLICY "Users can view own cards"
    ON cards FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Anyone can view public cards
CREATE POLICY "Public cards are viewable by everyone"
    ON cards FOR SELECT
    USING (is_public = true OR visibility = 'public');

-- Policy: Authenticated users can insert cards for themselves
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

-- PART 5: VERIFICATION
-- =====================================================

-- Check all required columns exist
DO $$
DECLARE
    missing_columns text[];
    col text;
BEGIN
    SELECT array_agg(column_name)
    INTO missing_columns
    FROM (
        VALUES
            ('api_card_id'),
            ('is_public'),
            ('visibility'),
            ('conversational_card_info'),
            ('conversational_grading'),
            ('front_path'),
            ('back_path'),
            ('category'),
            ('serial'),
            ('card_name')
    ) AS required(column_name)
    WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'cards'
        AND columns.column_name = required.column_name
    );

    IF missing_columns IS NOT NULL THEN
        RAISE WARNING 'Missing columns: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE 'All required columns exist!';
    END IF;
END $$;

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'cards';
-- Expected: rowsecurity = true

-- Check policies exist
SELECT policyname
FROM pg_policies
WHERE tablename = 'cards'
ORDER BY policyname;
-- Expected: 5 policies

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Pokemon database setup complete!';
    RAISE NOTICE 'You can now upload Pokemon cards.';
    RAISE NOTICE 'Required columns: ✓';
    RAISE NOTICE 'RLS policies: ✓';
    RAISE NOTICE 'Indexes: ✓';
END $$;
