-- =====================================================
-- DIAGNOSE DATABASE FOR POKEMON UPLOAD ISSUES
-- Date: October 30, 2025
-- Purpose: Check what's actually in the database
-- =====================================================

-- PART 1: Check if required columns exist
-- =====================================================
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'cards'
  AND column_name IN (
    'id',
    'user_id',
    'category',
    'serial',
    'front_path',
    'back_path',
    'is_public',
    'visibility',
    'api_card_id',
    'card_name',
    'conversational_card_info',
    'conversational_grading'
  )
ORDER BY
    CASE column_name
        WHEN 'id' THEN 1
        WHEN 'user_id' THEN 2
        WHEN 'category' THEN 3
        WHEN 'serial' THEN 4
        WHEN 'front_path' THEN 5
        WHEN 'back_path' THEN 6
        WHEN 'is_public' THEN 7
        WHEN 'visibility' THEN 8
        WHEN 'api_card_id' THEN 9
        WHEN 'card_name' THEN 10
        WHEN 'conversational_card_info' THEN 11
        WHEN 'conversational_grading' THEN 12
    END;

-- PART 2: Check RLS status
-- =====================================================
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'cards';

-- PART 3: List all RLS policies
-- =====================================================
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd AS command,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE tablename = 'cards'
ORDER BY policyname;

-- PART 4: Check if any cards exist
-- =====================================================
SELECT COUNT(*) as total_cards FROM cards;

-- PART 5: Test authentication function
-- =====================================================
SELECT
    CASE
        WHEN auth.uid() IS NULL THEN 'NOT AUTHENTICATED'
        ELSE 'AUTHENTICATED: ' || auth.uid()::text
    END as auth_status;
