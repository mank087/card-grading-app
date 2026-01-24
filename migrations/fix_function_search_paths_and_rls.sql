-- Migration: Fix function search_path warnings and RLS policy issues
-- Date: January 23, 2026
-- Purpose: Address Supabase linter warnings for security

-- ============================================================================
-- 1. FIX ONE PIECE FUNCTIONS - Add SET search_path = ''
-- ============================================================================

-- Drop and recreate search_onepiece_card with secure search_path
CREATE OR REPLACE FUNCTION public.search_onepiece_card(
  p_name TEXT,
  p_card_id TEXT DEFAULT NULL,
  p_set_name TEXT DEFAULT NULL,
  p_include_variants BOOLEAN DEFAULT true
)
RETURNS TABLE (
  id TEXT,
  card_name TEXT,
  card_number TEXT,
  set_id TEXT,
  set_name TEXT,
  card_type TEXT,
  card_color TEXT,
  rarity TEXT,
  card_power INTEGER,
  card_image TEXT,
  market_price DECIMAL,
  variant_type TEXT,
  base_card_id TEXT,
  match_score INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oc.id,
    oc.card_name,
    oc.card_number,
    oc.set_id,
    oc.set_name,
    oc.card_type,
    oc.card_color,
    oc.rarity,
    oc.card_power,
    oc.card_image,
    oc.market_price,
    oc.variant_type,
    oc.base_card_id,
    CASE
      WHEN p_card_id IS NOT NULL AND oc.id ILIKE p_card_id THEN 100
      WHEN p_card_id IS NOT NULL AND oc.base_card_id ILIKE p_card_id THEN 95
      WHEN oc.card_name ILIKE p_name AND p_set_name IS NOT NULL AND oc.set_name ILIKE '%' || p_set_name || '%' THEN 90
      WHEN oc.card_name ILIKE p_name THEN 80
      WHEN oc.card_name ILIKE p_name || '%' THEN 70
      WHEN oc.card_name ILIKE '%' || p_name || '%' THEN 60
      ELSE 30
    END AS match_score
  FROM public.onepiece_cards oc
  WHERE
    (p_card_id IS NULL OR oc.id ILIKE p_card_id OR oc.id ILIKE '%' || p_card_id || '%' OR oc.base_card_id ILIKE p_card_id)
    AND (p_name IS NULL OR oc.card_name ILIKE '%' || p_name || '%')
    AND (p_set_name IS NULL OR oc.set_name ILIKE '%' || p_set_name || '%')
    AND (p_include_variants = true OR oc.variant_type IS NULL)
  ORDER BY match_score DESC, oc.variant_type NULLS FIRST, oc.set_id DESC
  LIMIT 20;
END;
$$;

-- Drop and recreate get_onepiece_card_by_id with secure search_path
CREATE OR REPLACE FUNCTION public.get_onepiece_card_by_id(
  p_card_id TEXT
)
RETURNS TABLE (
  id TEXT,
  card_name TEXT,
  card_number TEXT,
  set_id TEXT,
  set_name TEXT,
  card_type TEXT,
  card_color TEXT,
  rarity TEXT,
  card_cost INTEGER,
  card_power INTEGER,
  life INTEGER,
  counter_amount INTEGER,
  attribute TEXT,
  sub_types TEXT,
  card_text TEXT,
  card_image TEXT,
  market_price DECIMAL,
  inventory_price DECIMAL,
  variant_type TEXT,
  base_card_id TEXT,
  original_name TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oc.id,
    oc.card_name,
    oc.card_number,
    oc.set_id,
    oc.set_name,
    oc.card_type,
    oc.card_color,
    oc.rarity,
    oc.card_cost,
    oc.card_power,
    oc.life,
    oc.counter_amount,
    oc.attribute,
    oc.sub_types,
    oc.card_text,
    oc.card_image,
    oc.market_price,
    oc.inventory_price,
    oc.variant_type,
    oc.base_card_id,
    oc.original_name
  FROM public.onepiece_cards oc
  WHERE oc.id ILIKE p_card_id
  LIMIT 1;
END;
$$;

-- Drop and recreate get_onepiece_card_variants with secure search_path
CREATE OR REPLACE FUNCTION public.get_onepiece_card_variants(
  p_base_card_id TEXT
)
RETURNS TABLE (
  id TEXT,
  card_name TEXT,
  card_number TEXT,
  set_id TEXT,
  set_name TEXT,
  card_type TEXT,
  card_color TEXT,
  rarity TEXT,
  card_power INTEGER,
  card_image TEXT,
  market_price DECIMAL,
  variant_type TEXT,
  original_name TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oc.id,
    oc.card_name,
    oc.card_number,
    oc.set_id,
    oc.set_name,
    oc.card_type,
    oc.card_color,
    oc.rarity,
    oc.card_power,
    oc.card_image,
    oc.market_price,
    oc.variant_type,
    oc.original_name
  FROM public.onepiece_cards oc
  WHERE oc.base_card_id = p_base_card_id
     OR oc.id = p_base_card_id
  ORDER BY
    CASE
      WHEN oc.variant_type IS NULL THEN 0
      ELSE 1
    END,
    oc.market_price DESC NULLS LAST;
END;
$$;

-- ============================================================================
-- 2. FIX LORCANA FUNCTIONS - Add SET search_path = ''
-- ============================================================================

-- Drop and recreate search_lorcana_card with secure search_path
CREATE OR REPLACE FUNCTION public.search_lorcana_card(
  p_name TEXT,
  p_collector_number TEXT DEFAULT NULL,
  p_set_code TEXT DEFAULT NULL,
  p_set_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  version TEXT,
  full_name TEXT,
  collector_number TEXT,
  set_code TEXT,
  set_name TEXT,
  ink TEXT,
  card_type TEXT[],
  rarity TEXT,
  cost INTEGER,
  strength INTEGER,
  willpower INTEGER,
  lore INTEGER,
  image_normal TEXT,
  price_usd DECIMAL,
  match_score INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lc.id,
    lc.name,
    lc.version,
    lc.full_name,
    lc.collector_number,
    lc.set_code,
    lc.set_name,
    lc.ink,
    lc.card_type,
    lc.rarity,
    lc.cost,
    lc.strength,
    lc.willpower,
    lc.lore,
    lc.image_normal,
    lc.price_usd,
    CASE
      WHEN p_set_code IS NOT NULL AND p_collector_number IS NOT NULL
           AND lc.set_code = p_set_code AND lc.collector_number = p_collector_number THEN 100
      WHEN lc.full_name ILIKE p_name THEN 95
      WHEN lc.name ILIKE p_name AND p_set_name IS NOT NULL AND lc.set_name ILIKE '%' || p_set_name || '%' THEN 90
      WHEN lc.name ILIKE p_name THEN 80
      WHEN lc.name ILIKE p_name || '%' OR lc.full_name ILIKE p_name || '%' THEN 70
      WHEN lc.name ILIKE '%' || p_name || '%' OR lc.full_name ILIKE '%' || p_name || '%' THEN 60
      ELSE 30
    END AS match_score
  FROM public.lorcana_cards lc
  WHERE
    (p_set_code IS NULL OR lc.set_code = p_set_code)
    AND (p_collector_number IS NULL OR lc.collector_number = p_collector_number)
    AND (p_name IS NULL OR lc.name ILIKE '%' || p_name || '%' OR lc.full_name ILIKE '%' || p_name || '%')
    AND (p_set_name IS NULL OR lc.set_name ILIKE '%' || p_set_name || '%')
  ORDER BY match_score DESC, lc.set_code DESC, lc.collector_number ASC
  LIMIT 20;
END;
$$;

-- Drop and recreate get_lorcana_card_by_set_number with secure search_path
CREATE OR REPLACE FUNCTION public.get_lorcana_card_by_set_number(
  p_set_code TEXT,
  p_collector_number TEXT
)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  version TEXT,
  full_name TEXT,
  collector_number TEXT,
  set_id TEXT,
  set_code TEXT,
  set_name TEXT,
  ink TEXT,
  inkwell BOOLEAN,
  card_type TEXT[],
  classifications TEXT[],
  cost INTEGER,
  strength INTEGER,
  willpower INTEGER,
  lore INTEGER,
  card_text TEXT,
  flavor_text TEXT,
  keywords TEXT[],
  rarity TEXT,
  image_small TEXT,
  image_normal TEXT,
  image_large TEXT,
  illustrators TEXT[],
  price_usd DECIMAL,
  price_usd_foil DECIMAL
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lc.id,
    lc.name,
    lc.version,
    lc.full_name,
    lc.collector_number,
    lc.set_id,
    lc.set_code,
    lc.set_name,
    lc.ink,
    lc.inkwell,
    lc.card_type,
    lc.classifications,
    lc.cost,
    lc.strength,
    lc.willpower,
    lc.lore,
    lc.card_text,
    lc.flavor_text,
    lc.keywords,
    lc.rarity,
    lc.image_small,
    lc.image_normal,
    lc.image_large,
    lc.illustrators,
    lc.price_usd,
    lc.price_usd_foil
  FROM public.lorcana_cards lc
  WHERE lc.set_code = p_set_code AND lc.collector_number = p_collector_number
  LIMIT 1;
END;
$$;

-- ============================================================================
-- 3. FIX MTG FUNCTIONS - Add SET search_path = ''
-- ============================================================================

-- Drop and recreate search_mtg_card with secure search_path
CREATE OR REPLACE FUNCTION public.search_mtg_card(
  search_name TEXT,
  search_set_code TEXT DEFAULT NULL,
  search_collector_number TEXT DEFAULT NULL,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  set_code TEXT,
  set_name TEXT,
  collector_number TEXT,
  mana_cost TEXT,
  type_line TEXT,
  rarity TEXT,
  image_normal TEXT,
  price_usd DECIMAL,
  match_score REAL
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.set_code,
    c.set_name,
    c.collector_number,
    c.mana_cost,
    c.type_line,
    c.rarity,
    c.image_normal,
    c.price_usd,
    CASE
      WHEN LOWER(c.name) = LOWER(search_name) THEN 1.0
      WHEN LOWER(c.name) LIKE LOWER(search_name) || '%' THEN 0.9
      WHEN LOWER(c.name) LIKE '%' || LOWER(search_name) || '%' THEN 0.7
      ELSE public.similarity(c.name, search_name)
    END AS match_score
  FROM public.mtg_cards c
  WHERE
    (search_name IS NULL OR (
      LOWER(c.name) LIKE '%' || LOWER(search_name) || '%'
      OR public.similarity(c.name, search_name) > 0.3
    ))
    AND (search_set_code IS NULL OR c.set_code = LOWER(search_set_code))
    AND (search_collector_number IS NULL OR c.collector_number = search_collector_number)
  ORDER BY match_score DESC, c.released_at DESC
  LIMIT result_limit;
END;
$$;

-- Drop and recreate get_mtg_card_by_set_number with secure search_path
CREATE OR REPLACE FUNCTION public.get_mtg_card_by_set_number(
  p_set_code TEXT,
  p_collector_number TEXT
)
RETURNS public.mtg_cards
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  result public.mtg_cards;
BEGIN
  SELECT * INTO result
  FROM public.mtg_cards
  WHERE set_code = LOWER(p_set_code)
    AND collector_number = p_collector_number
  LIMIT 1;

  RETURN result;
END;
$$;

-- ============================================================================
-- 4. FIX CARD_PRICE_HISTORY RLS POLICIES
-- The current policies allow unrestricted INSERT/UPDATE which is too permissive.
-- Only authenticated users should be able to read, and writes should be service role only.
-- ============================================================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Service role can insert price history" ON public.card_price_history;
DROP POLICY IF EXISTS "Service role can update price history" ON public.card_price_history;

-- Note: Service role bypasses RLS entirely, so no INSERT/UPDATE policies are needed.
-- The table should only be writable by the service role (used by price tracking cron).
-- If no INSERT/UPDATE policies exist, only service role can write (which is correct).

-- Ensure SELECT policy exists for users to view price history
-- (This may already exist, but CREATE OR REPLACE ensures it's correct)
DROP POLICY IF EXISTS "Anyone can read price history" ON public.card_price_history;

CREATE POLICY "Anyone can read price history"
ON public.card_price_history
FOR SELECT
TO public
USING (true);

-- ============================================================================
-- 5. VECTOR EXTENSION WARNING
-- Moving the vector extension requires careful planning as it may break
-- existing queries. For now, we acknowledge the warning.
-- To fix properly, you would need to:
-- 1. CREATE SCHEMA IF NOT EXISTS extensions;
-- 2. ALTER EXTENSION vector SET SCHEMA extensions;
-- 3. Update all queries to use extensions.vector_column syntax
-- This is a low-priority change that requires testing.
-- ============================================================================

-- Uncomment these lines only if you want to move the vector extension:
-- CREATE SCHEMA IF NOT EXISTS extensions;
-- ALTER EXTENSION vector SET SCHEMA extensions;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check function search_path is set:
-- SELECT proname, proconfig
-- FROM pg_proc
-- WHERE proname IN (
--   'search_onepiece_card', 'get_onepiece_card_by_id', 'get_onepiece_card_variants',
--   'search_lorcana_card', 'get_lorcana_card_by_set_number',
--   'search_mtg_card', 'get_mtg_card_by_set_number'
-- );

-- Check card_price_history policies:
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'card_price_history';
