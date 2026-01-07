-- Migration: Add indexes to improve query performance
-- Based on Supabase query performance analysis
-- Run this in Supabase SQL Editor

-- =====================================================
-- 1. Featured Cards Query Optimization
-- =====================================================
-- Supabase suggested: CREATE INDEX ON public.cards USING btree (created_at)
-- This optimizes the featured cards query that filters by visibility, is_featured

-- Composite index for featured cards query (most specific first)
-- Covers: WHERE visibility = 'public' AND is_featured = true AND conversational_decimal_grade IS NOT NULL ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_cards_featured_visibility_created
ON public.cards (visibility, is_featured, created_at DESC)
WHERE conversational_decimal_grade IS NOT NULL;

-- =====================================================
-- 2. Pokemon Cards Name Search (ILIKE) Optimization
-- =====================================================
-- ILIKE '%search%' queries are slow without trigram indexes
-- Enable pg_trgm extension for fuzzy text search

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram index on pokemon_cards.name for fast ILIKE searches
-- This dramatically speeds up: WHERE name ILIKE '%pikachu%'
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_name_trgm
ON public.pokemon_cards USING gin (name gin_trgm_ops);

-- =====================================================
-- 3. Pokemon Cards Number Search Optimization
-- =====================================================
-- The query searches by number with OR conditions and ILIKE

-- Trigram index for ILIKE on number
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_number_trgm
ON public.pokemon_cards USING gin (number gin_trgm_ops);

-- Btree index for exact matches
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_number
ON public.pokemon_cards (number);

-- =====================================================
-- 4. Japanese Pokemon Cards (if table exists)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pokemon_cards_japanese') THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_trgm';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pokemon_cards_jp_name_trgm ON public.pokemon_cards_japanese USING gin (name gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pokemon_cards_jp_number_trgm ON public.pokemon_cards_japanese USING gin (number gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pokemon_cards_jp_number ON public.pokemon_cards_japanese (number)';
  END IF;
END $$;

-- =====================================================
-- Update Statistics
-- =====================================================
ANALYZE public.cards;
ANALYZE public.pokemon_cards;

-- =====================================================
-- Expected Performance Improvements
-- =====================================================
-- 1. Featured cards query: ~17ms → <5ms
-- 2. Pokemon name search (ILIKE): ~125ms → <20ms
-- 3. Pokemon number search: ~342ms → <50ms
