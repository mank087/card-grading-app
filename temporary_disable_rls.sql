-- =====================================================
-- TEMPORARY FIX: DISABLE RLS FOR TESTING
-- Date: October 30, 2025
-- Purpose: Temporarily disable RLS to test Pokemon upload
-- WARNING: This makes all cards accessible. Re-enable after testing!
-- =====================================================

-- First, add the missing columns if they don't exist
ALTER TABLE cards ADD COLUMN IF NOT EXISTS api_card_id TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_card_info JSONB;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';

-- Temporarily disable RLS
ALTER TABLE cards DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'cards';
-- Expected: rls_enabled = false

-- =====================================================
-- TO RE-ENABLE RLS AFTER TESTING (IMPORTANT!)
-- =====================================================
-- Run this after you've tested and we've figured out the issue:
-- ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
-- =====================================================

SELECT 'RLS TEMPORARILY DISABLED - You can now test Pokemon upload!' as status;
