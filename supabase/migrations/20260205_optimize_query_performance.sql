-- Query Performance Optimization Migration
-- Created: 2026-02-05
-- Description: Add composite indexes based on Supabase query performance analysis
--
-- Key slow queries identified:
-- 1. User collection: WHERE user_id = $1 ORDER BY created_at DESC (145-166ms)
-- 2. Public cards by visibility: WHERE visibility = $1 ORDER BY created_at DESC (117ms)
-- 3. Featured cards: WHERE visibility = $1 AND is_featured = $2 AND grade IS NOT NULL (19ms - can improve)

-- =====================================================
-- 1. User Collection Query Optimization
-- =====================================================
-- Query pattern: SELECT ... FROM cards WHERE user_id = $1 ORDER BY created_at DESC
-- This is the most frequent slow query (2000+ calls, 145-166ms mean)
-- Composite index allows index-only scan with pre-sorted results

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_user_id_created_at
ON public.cards (user_id, created_at DESC);

-- =====================================================
-- 2. Public Cards by Visibility Query Optimization
-- =====================================================
-- Query pattern: SELECT ... FROM cards WHERE visibility = $1 ORDER BY created_at DESC
-- Supabase suggested: CREATE INDEX ON public.cards USING btree (created_at)
-- Better: composite index on (visibility, created_at DESC)

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_visibility_created_at
ON public.cards (visibility, created_at DESC);

-- =====================================================
-- 3. Featured Cards Query Optimization (if not exists)
-- =====================================================
-- Query pattern: WHERE visibility = $1 AND is_featured = $2 AND conversational_decimal_grade IS NOT NULL
-- Partial index for maximum efficiency

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_featured_lookup
ON public.cards (visibility, is_featured, created_at DESC)
WHERE conversational_decimal_grade IS NOT NULL;

-- =====================================================
-- 4. Serial Lookup Optimization
-- =====================================================
-- Query pattern: SELECT serial FROM cards (high call count)
-- Covering index for serial-only queries

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_serial
ON public.cards (serial);

-- =====================================================
-- 5. Category + Created At (for category-filtered lists)
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_category_created_at
ON public.cards (category, created_at DESC);

-- =====================================================
-- Update Statistics
-- =====================================================
ANALYZE public.cards;

-- =====================================================
-- Verify Indexes Were Created
-- =====================================================
-- Run this query to verify:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'cards'
-- AND schemaname = 'public'
-- ORDER BY indexname;
