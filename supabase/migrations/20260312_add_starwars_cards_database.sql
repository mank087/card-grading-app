-- ============================================================================
-- Star Wars Cards Local Database
-- ============================================================================
-- This migration creates tables to store Star Wars trading card data locally,
-- eliminating dependency on external API calls for card lookups.
--
-- Data source: PriceCharting / SportsCardsPro API
--
-- Benefits:
-- - No API timeouts (instant lookups)
-- - No rate limits
-- - Fuzzy search capability
-- - Works offline if PriceCharting API is down
-- ============================================================================

-- ============================================================================
-- 1. STAR WARS SETS TABLE
-- ============================================================================
-- Stores all Star Wars card sets/expansions

CREATE TABLE IF NOT EXISTS starwars_sets (
  id TEXT PRIMARY KEY,                    -- Set slug: "star-wars-topps-1977", "star-wars-galaxy"
  name TEXT NOT NULL,                     -- "Star Wars Topps 1977", "Star Wars Galaxy", etc.
  set_type TEXT,                          -- "base", "chase", "promo", "insert", etc.
  total_cards INTEGER DEFAULT 0,          -- Number of cards in set
  release_date TEXT,                      -- Release year or date from PriceCharting
  genre TEXT,                             -- Genre from PriceCharting (e.g., "Star Wars Card")
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for set lookups by name
CREATE INDEX IF NOT EXISTS idx_starwars_sets_name ON starwars_sets(name);
CREATE INDEX IF NOT EXISTS idx_starwars_sets_type ON starwars_sets(set_type);

-- ============================================================================
-- 2. STAR WARS CARDS TABLE
-- ============================================================================
-- Stores all Star Wars cards with their metadata and pricing

CREATE TABLE IF NOT EXISTS starwars_cards (
  id TEXT PRIMARY KEY,                    -- PriceCharting product ID
  card_name TEXT NOT NULL,                -- Card name from product-name
  card_number TEXT,                       -- Extracted card number (e.g., "#1", "A1")
  set_id TEXT REFERENCES starwars_sets(id), -- Foreign key to set

  -- Card classification
  console_name TEXT,                      -- "console-name" from API (set name)
  genre TEXT,                             -- "Star Wars Card" typically
  release_date TEXT,                      -- Release date from API

  -- Pricing (in dollars, converted from pennies)
  loose_price DECIMAL(10,2),              -- Ungraded price
  cib_price DECIMAL(10,2),               -- Graded 7/7.5
  new_price DECIMAL(10,2),               -- Graded 8/8.5
  graded_price DECIMAL(10,2),            -- Graded 9
  box_only_price DECIMAL(10,2),          -- Graded 9.5
  manual_only_price DECIMAL(10,2),       -- PSA 10
  bgs_10_price DECIMAL(10,2),            -- BGS 10

  -- Additional pricing fields
  psa_1_price DECIMAL(10,2),
  psa_2_price DECIMAL(10,2),
  psa_3_price DECIMAL(10,2),
  psa_4_price DECIMAL(10,2),
  psa_5_price DECIMAL(10,2),
  psa_6_price DECIMAL(10,2),
  psa_7_price DECIMAL(10,2),
  psa_8_price DECIMAL(10,2),
  psa_9_price DECIMAL(10,2),
  psa_10_price DECIMAL(10,2),

  -- Sales data
  sales_volume TEXT,                      -- Sales volume indicator

  -- Denormalized set data for faster queries
  set_name TEXT,                          -- Denormalized from starwars_sets

  -- Metadata
  pricecharting_id TEXT,                  -- Original PriceCharting product ID
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEXES FOR FAST LOOKUPS
-- ============================================================================

-- Primary lookup pattern: card_name (most common)
CREATE INDEX IF NOT EXISTS idx_starwars_cards_name ON starwars_cards(card_name);
CREATE INDEX IF NOT EXISTS idx_starwars_cards_name_lower ON starwars_cards(LOWER(card_name));

-- Card number lookup
CREATE INDEX IF NOT EXISTS idx_starwars_cards_number ON starwars_cards(card_number);

-- Set-based lookups
CREATE INDEX IF NOT EXISTS idx_starwars_cards_set_id ON starwars_cards(set_id);
CREATE INDEX IF NOT EXISTS idx_starwars_cards_set_name ON starwars_cards(set_name);
CREATE INDEX IF NOT EXISTS idx_starwars_cards_console_name ON starwars_cards(console_name);

-- Genre lookup
CREATE INDEX IF NOT EXISTS idx_starwars_cards_genre ON starwars_cards(genre);

-- PriceCharting ID lookup
CREATE INDEX IF NOT EXISTS idx_starwars_cards_pc_id ON starwars_cards(pricecharting_id);

-- ============================================================================
-- 4. HELPER FUNCTION: Search cards by name and number
-- ============================================================================

CREATE OR REPLACE FUNCTION search_starwars_card(
  p_name TEXT,
  p_card_number TEXT DEFAULT NULL,
  p_set_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  card_name TEXT,
  card_number TEXT,
  set_id TEXT,
  set_name TEXT,
  console_name TEXT,
  genre TEXT,
  loose_price DECIMAL,
  graded_price DECIMAL,
  manual_only_price DECIMAL,
  match_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.card_name,
    sc.card_number,
    sc.set_id,
    sc.set_name,
    sc.console_name,
    sc.genre,
    sc.loose_price,
    sc.graded_price,
    sc.manual_only_price,
    -- Calculate match score (higher = better match)
    CASE
      -- Exact card number match + name match
      WHEN p_card_number IS NOT NULL AND sc.card_number = p_card_number AND sc.card_name ILIKE '%' || p_name || '%' THEN 100
      -- Name + set match
      WHEN sc.card_name ILIKE p_name AND p_set_name IS NOT NULL AND sc.set_name ILIKE '%' || p_set_name || '%' THEN 90
      -- Exact name match
      WHEN sc.card_name ILIKE p_name THEN 80
      -- Name starts with
      WHEN sc.card_name ILIKE p_name || '%' THEN 70
      -- Name contains
      WHEN sc.card_name ILIKE '%' || p_name || '%' THEN 60
      -- Partial match
      ELSE 30
    END AS match_score
  FROM starwars_cards sc
  WHERE
    -- Name must match (case-insensitive, partial match)
    (p_name IS NULL OR sc.card_name ILIKE '%' || p_name || '%')
    -- Card number filter (if provided)
    AND (p_card_number IS NULL OR sc.card_number = p_card_number)
    -- Set filter (if provided)
    AND (p_set_name IS NULL OR sc.set_name ILIKE '%' || p_set_name || '%' OR sc.console_name ILIKE '%' || p_set_name || '%')
  ORDER BY match_score DESC, sc.set_name ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. HELPER FUNCTION: Direct card ID lookup
-- ============================================================================

CREATE OR REPLACE FUNCTION get_starwars_card_by_id(
  p_card_id TEXT
)
RETURNS TABLE (
  id TEXT,
  card_name TEXT,
  card_number TEXT,
  set_id TEXT,
  set_name TEXT,
  console_name TEXT,
  genre TEXT,
  release_date TEXT,
  loose_price DECIMAL,
  cib_price DECIMAL,
  new_price DECIMAL,
  graded_price DECIMAL,
  box_only_price DECIMAL,
  manual_only_price DECIMAL,
  bgs_10_price DECIMAL,
  sales_volume TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.card_name,
    sc.card_number,
    sc.set_id,
    sc.set_name,
    sc.console_name,
    sc.genre,
    sc.release_date,
    sc.loose_price,
    sc.cib_price,
    sc.new_price,
    sc.graded_price,
    sc.box_only_price,
    sc.manual_only_price,
    sc.bgs_10_price,
    sc.sales_volume
  FROM starwars_cards sc
  WHERE sc.id = p_card_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. IMPORT TRACKING TABLE
-- ============================================================================
-- Track when the database was last updated

CREATE TABLE IF NOT EXISTS starwars_import_log (
  id SERIAL PRIMARY KEY,
  import_type TEXT NOT NULL,              -- "full", "incremental", "set_update"
  sets_imported INTEGER DEFAULT 0,
  cards_imported INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',          -- "running", "completed", "failed"
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON TABLE starwars_sets IS 'Local cache of Star Wars card sets from PriceCharting';
COMMENT ON TABLE starwars_cards IS 'Local cache of Star Wars cards from PriceCharting';
COMMENT ON TABLE starwars_import_log IS 'Tracks imports from PriceCharting API';
COMMENT ON FUNCTION search_starwars_card IS 'Search for Star Wars cards by name, card number, and set with fuzzy matching';
COMMENT ON FUNCTION get_starwars_card_by_id IS 'Direct lookup of Star Wars card by ID';
