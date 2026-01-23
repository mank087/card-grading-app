-- ============================================================================
-- One Piece Card Variants Support
-- ============================================================================
-- This migration adds support for card variants (Parallel, Manga, Alternate Art, etc.)
--
-- Problem: The OPTCG API returns multiple variants with the same card_set_id
-- (e.g., OP01-120 for both regular Shanks and Parallel Shanks)
--
-- Solution:
-- 1. Add variant_type column to track variant type
-- 2. Change primary key to include variant suffix (e.g., OP01-120_parallel)
-- 3. Add base_card_id to link variants to their base card
-- ============================================================================

-- ============================================================================
-- 0. DROP EXISTING FUNCTIONS (required to change return types)
-- ============================================================================

DROP FUNCTION IF EXISTS search_onepiece_card(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS search_onepiece_card(TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS get_onepiece_card_by_id(TEXT);
DROP FUNCTION IF EXISTS get_onepiece_card_variants(TEXT);

-- ============================================================================
-- 1. ADD VARIANT COLUMNS
-- ============================================================================

-- Add variant_type column (null = regular/base version)
ALTER TABLE onepiece_cards
ADD COLUMN IF NOT EXISTS variant_type TEXT;

-- Add base_card_id to link variants to their base card
ALTER TABLE onepiece_cards
ADD COLUMN IF NOT EXISTS base_card_id TEXT;

-- Add original_name to preserve full API name with variant indicators
ALTER TABLE onepiece_cards
ADD COLUMN IF NOT EXISTS original_name TEXT;

-- ============================================================================
-- 2. ADD INDEXES FOR VARIANT QUERIES
-- ============================================================================

-- Index for finding all variants of a base card
CREATE INDEX IF NOT EXISTS idx_onepiece_cards_base_card_id
ON onepiece_cards(base_card_id);

-- Index for filtering by variant type
CREATE INDEX IF NOT EXISTS idx_onepiece_cards_variant_type
ON onepiece_cards(variant_type);

-- Composite index for base card + variant lookup
CREATE INDEX IF NOT EXISTS idx_onepiece_cards_base_variant
ON onepiece_cards(base_card_id, variant_type);

-- ============================================================================
-- 3. UPDATE HELPER FUNCTION: Search cards with variant support
-- ============================================================================

CREATE OR REPLACE FUNCTION search_onepiece_card(
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
) AS $$
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
    -- Calculate match score (higher = better match)
    CASE
      -- Exact card ID match (e.g., "OP01-001" or "OP01-001_parallel")
      WHEN p_card_id IS NOT NULL AND oc.id ILIKE p_card_id THEN 100
      -- Base card ID match (finds base + all variants)
      WHEN p_card_id IS NOT NULL AND oc.base_card_id ILIKE p_card_id THEN 95
      -- Name + set match
      WHEN oc.card_name ILIKE p_name AND p_set_name IS NOT NULL AND oc.set_name ILIKE '%' || p_set_name || '%' THEN 90
      -- Exact name match
      WHEN oc.card_name ILIKE p_name THEN 80
      -- Name starts with
      WHEN oc.card_name ILIKE p_name || '%' THEN 70
      -- Name contains
      WHEN oc.card_name ILIKE '%' || p_name || '%' THEN 60
      -- Partial match
      ELSE 30
    END AS match_score
  FROM onepiece_cards oc
  WHERE
    -- Card ID filter (if provided) - highest priority
    (p_card_id IS NULL OR oc.id ILIKE p_card_id OR oc.id ILIKE '%' || p_card_id || '%' OR oc.base_card_id ILIKE p_card_id)
    -- Name must match (case-insensitive, partial match)
    AND (p_name IS NULL OR oc.card_name ILIKE '%' || p_name || '%')
    -- Set filter (if provided)
    AND (p_set_name IS NULL OR oc.set_name ILIKE '%' || p_set_name || '%')
    -- Variant filter (optionally exclude variants to get base cards only)
    AND (p_include_variants = true OR oc.variant_type IS NULL)
  ORDER BY match_score DESC, oc.variant_type NULLS FIRST, oc.set_id DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. NEW FUNCTION: Get all variants of a card
-- ============================================================================

CREATE OR REPLACE FUNCTION get_onepiece_card_variants(
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
) AS $$
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
  FROM onepiece_cards oc
  WHERE oc.base_card_id = p_base_card_id
     OR oc.id = p_base_card_id
  ORDER BY
    CASE
      WHEN oc.variant_type IS NULL THEN 0  -- Base card first
      ELSE 1
    END,
    oc.market_price DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. UPDATE get_onepiece_card_by_id TO INCLUDE VARIANT INFO
-- ============================================================================

CREATE OR REPLACE FUNCTION get_onepiece_card_by_id(
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
) AS $$
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
  FROM onepiece_cards oc
  WHERE oc.id ILIKE p_card_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================

COMMENT ON COLUMN onepiece_cards.variant_type IS 'Variant type: parallel, manga, alternate_art, sp, box_topper, reprint, foil, etc. NULL = base/regular version';
COMMENT ON COLUMN onepiece_cards.base_card_id IS 'Links to the base card ID (e.g., OP01-120) for grouping variants';
COMMENT ON COLUMN onepiece_cards.original_name IS 'Original card name from API including variant indicators (e.g., "Shanks (Parallel) (Manga)")';
COMMENT ON FUNCTION get_onepiece_card_variants IS 'Get all variants of a One Piece card by base card ID';
