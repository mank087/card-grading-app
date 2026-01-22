-- ============================================================================
-- One Piece Cards Local Database
-- ============================================================================
-- This migration creates tables to store One Piece TCG card data locally,
-- eliminating dependency on external API calls for card lookups.
--
-- Data source: OPTCG API (https://optcgapi.com/)
--
-- Benefits:
-- - No API timeouts (instant lookups)
-- - No rate limits
-- - Fuzzy search capability
-- - Works offline if OPTCG API is down
-- ============================================================================

-- ============================================================================
-- 1. ONE PIECE SETS TABLE
-- ============================================================================
-- Stores all One Piece TCG sets/expansions

CREATE TABLE IF NOT EXISTS onepiece_sets (
  id TEXT PRIMARY KEY,                    -- Set ID: "OP-01", "OP-02", "ST-01", "EB-01"
  name TEXT NOT NULL,                     -- "Romance Dawn", "Paramount War", etc.
  set_type TEXT,                          -- "booster", "starter", "promo", "extra"
  total_cards INTEGER,                    -- Number of cards in set
  release_date DATE,                      -- Set release date
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for set lookups by name
CREATE INDEX IF NOT EXISTS idx_onepiece_sets_name ON onepiece_sets(name);
CREATE INDEX IF NOT EXISTS idx_onepiece_sets_type ON onepiece_sets(set_type);

-- ============================================================================
-- 2. ONE PIECE CARDS TABLE
-- ============================================================================
-- Stores all One Piece TCG cards with their metadata

CREATE TABLE IF NOT EXISTS onepiece_cards (
  id TEXT PRIMARY KEY,                    -- Card set ID: "OP01-001", "ST01-001"
  card_name TEXT NOT NULL,                -- Card name: "Roronoa Zoro", "Monkey D. Luffy"
  card_number TEXT NOT NULL,              -- Card number in set: "001", "121"
  set_id TEXT REFERENCES onepiece_sets(id), -- Foreign key to set

  -- Card classification
  card_type TEXT,                         -- "Leader", "Character", "Event", "Stage"
  card_color TEXT,                        -- "Red", "Blue", "Green", "Purple", "Black", "Yellow"
  rarity TEXT,                            -- "L", "C", "UC", "R", "SR", "SEC", "SP"

  -- Card stats
  card_cost INTEGER,                      -- Cost to play
  card_power INTEGER,                     -- Power value (e.g., 5000)
  life INTEGER,                           -- Life (for Leaders)
  counter_amount INTEGER,                 -- Counter value

  -- Card details
  attribute TEXT,                         -- "Slash", "Strike", "Ranged", "Special", "Wisdom"
  sub_types TEXT,                         -- Traits: "Straw Hat Crew", "Navy", etc.
  card_text TEXT,                         -- Card abilities/effects

  -- Images
  card_image TEXT,                        -- Card image URL
  card_image_id TEXT,                     -- Image ID for reference

  -- Pricing (from TCGPlayer via OPTCG API)
  market_price DECIMAL(10,2),             -- TCGPlayer market price
  inventory_price DECIMAL(10,2),          -- TCGPlayer inventory price
  date_scraped DATE,                      -- When price was last updated

  -- Denormalized set data for faster queries
  set_name TEXT,                          -- Denormalized from onepiece_sets

  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEXES FOR FAST LOOKUPS
-- ============================================================================

-- Primary lookup pattern: card_name + card_number (most common)
CREATE INDEX IF NOT EXISTS idx_onepiece_cards_name ON onepiece_cards(card_name);
CREATE INDEX IF NOT EXISTS idx_onepiece_cards_number ON onepiece_cards(card_number);
CREATE INDEX IF NOT EXISTS idx_onepiece_cards_name_number ON onepiece_cards(card_name, card_number);

-- Card set ID lookup (e.g., "OP01-001")
CREATE INDEX IF NOT EXISTS idx_onepiece_cards_id ON onepiece_cards(id);

-- Set-based lookups
CREATE INDEX IF NOT EXISTS idx_onepiece_cards_set_id ON onepiece_cards(set_id);
CREATE INDEX IF NOT EXISTS idx_onepiece_cards_set_name ON onepiece_cards(set_name);

-- Card type/color for filtering
CREATE INDEX IF NOT EXISTS idx_onepiece_cards_type ON onepiece_cards(card_type);
CREATE INDEX IF NOT EXISTS idx_onepiece_cards_color ON onepiece_cards(card_color);
CREATE INDEX IF NOT EXISTS idx_onepiece_cards_rarity ON onepiece_cards(rarity);

-- ============================================================================
-- 4. HELPER FUNCTION: Search cards by name and number
-- ============================================================================

CREATE OR REPLACE FUNCTION search_onepiece_card(
  p_name TEXT,
  p_card_id TEXT DEFAULT NULL,
  p_set_name TEXT DEFAULT NULL
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
    -- Calculate match score (higher = better match)
    CASE
      -- Exact card ID match (e.g., "OP01-001")
      WHEN p_card_id IS NOT NULL AND oc.id ILIKE p_card_id THEN 100
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
    (p_card_id IS NULL OR oc.id ILIKE p_card_id OR oc.id ILIKE '%' || p_card_id || '%')
    -- Name must match (case-insensitive, partial match)
    AND (p_name IS NULL OR oc.card_name ILIKE '%' || p_name || '%')
    -- Set filter (if provided)
    AND (p_set_name IS NULL OR oc.set_name ILIKE '%' || p_set_name || '%')
  ORDER BY match_score DESC, oc.set_id DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. HELPER FUNCTION: Direct card ID lookup
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
  inventory_price DECIMAL
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
    oc.inventory_price
  FROM onepiece_cards oc
  WHERE oc.id ILIKE p_card_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. IMPORT TRACKING TABLE
-- ============================================================================
-- Track when the database was last updated

CREATE TABLE IF NOT EXISTS onepiece_import_log (
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

COMMENT ON TABLE onepiece_sets IS 'Local cache of One Piece TCG sets from optcgapi.com';
COMMENT ON TABLE onepiece_cards IS 'Local cache of One Piece TCG cards from optcgapi.com';
COMMENT ON TABLE onepiece_import_log IS 'Tracks imports from OPTCG API';
COMMENT ON FUNCTION search_onepiece_card IS 'Search for One Piece cards by name, card ID, and set with fuzzy matching';
COMMENT ON FUNCTION get_onepiece_card_by_id IS 'Direct lookup of One Piece card by card ID (e.g., OP01-001)';
