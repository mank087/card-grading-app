-- Migration: Add index on cards.user_id for query performance
-- Date: December 16, 2025
-- Purpose: Speed up user collection queries (WHERE user_id = ?)
--
-- Query advisor recommendation:
-- Mean query time: 569ms → should drop significantly
-- Affects: /collection page, /api/cards/my-collection, user card lookups

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON public.cards USING btree (user_id);

-- Optional: Composite index for the common query pattern (user_id + created_at DESC)
-- This helps with: SELECT * FROM cards WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_cards_user_id_created_at ON public.cards USING btree (user_id, created_at DESC);

-- Verify indexes were created:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'cards';
