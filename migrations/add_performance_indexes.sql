-- Performance indexes to address slow queries
-- Run this in Supabase SQL Editor

-- ============================================
-- CARDS TABLE - CRITICAL MISSING INDEX
-- ============================================

-- This is the key missing index for your slowest queries:
-- SELECT ... FROM cards WHERE user_id = $1 ORDER BY created_at DESC
--
-- Without this, PostgreSQL must sort ALL user's cards on every query.
-- With this, it can read them pre-sorted from the index.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_user_id_created_at
ON public.cards (user_id, created_at DESC);

-- ============================================
-- VERIFY INDEX WAS CREATED
-- ============================================

-- Run this after to verify:
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE indexname = 'idx_cards_user_id_created_at';
