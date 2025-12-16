-- Migration: Fix function search_path security warning
-- Date: December 16, 2025
-- Purpose: Set immutable search_path on search_pokemon_card function

-- Drop and recreate with SET search_path = ''
-- This prevents search path injection attacks

CREATE OR REPLACE FUNCTION public.search_pokemon_card(
  p_name TEXT,
  p_number TEXT DEFAULT NULL,
  p_set_printed_total INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  number TEXT,
  set_id TEXT,
  set_name TEXT,
  set_series TEXT,
  set_printed_total INTEGER,
  rarity TEXT,
  image_small TEXT,
  image_large TEXT,
  tcgplayer_url TEXT,
  match_score INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''  -- Fix: Immutable search path for security
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id,
    pc.name,
    pc.number,
    pc.set_id,
    pc.set_name,
    pc.set_series,
    pc.set_printed_total,
    pc.rarity,
    pc.image_small,
    pc.image_large,
    pc.tcgplayer_url,
    -- Calculate match score (higher = better match)
    CASE
      WHEN pc.name ILIKE p_name AND pc.number = p_number AND pc.set_printed_total = p_set_printed_total THEN 100
      WHEN pc.name ILIKE p_name AND pc.number = p_number THEN 80
      WHEN pc.name ILIKE p_name || '%' AND pc.number = p_number THEN 70
      WHEN pc.name ILIKE '%' || p_name || '%' AND pc.number = p_number THEN 60
      WHEN pc.name ILIKE p_name || '%' THEN 40
      WHEN pc.name ILIKE '%' || p_name || '%' THEN 30
      ELSE 10
    END AS match_score
  FROM public.pokemon_cards pc  -- Use fully qualified table name
  WHERE
    -- Name must match (case-insensitive, partial match)
    pc.name ILIKE '%' || p_name || '%'
    -- Number filter (if provided)
    AND (p_number IS NULL OR pc.number = p_number)
    -- Set total filter (if provided)
    AND (p_set_printed_total IS NULL OR pc.set_printed_total = p_set_printed_total)
  ORDER BY match_score DESC, pc.set_release_date DESC
  LIMIT 20;
END;
$$;

COMMENT ON FUNCTION public.search_pokemon_card IS 'Search for Pokemon cards by name, number, and set total with fuzzy matching';

-- Verify the fix:
-- SELECT proname, prosecdef, proconfig FROM pg_proc WHERE proname = 'search_pokemon_card';
-- Should show proconfig containing 'search_path='
