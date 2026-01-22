-- ============================================================================
-- Lorcana Cards Local Database
-- ============================================================================
-- This migration creates tables to store Disney Lorcana TCG card data locally,
-- eliminating dependency on external API calls for card lookups.
--
-- Data source: Lorcast API (https://api.lorcast.com/)
--
-- Benefits:
-- - No API timeouts (instant lookups)
-- - No rate limits
-- - Fuzzy search capability
-- - Works offline if Lorcast API is down
-- ============================================================================

-- ============================================================================
-- 1. LORCANA SETS TABLE
-- ============================================================================
-- Stores all Lorcana TCG sets/expansions

CREATE TABLE IF NOT EXISTS lorcana_sets (
  id TEXT PRIMARY KEY,                    -- Set UUID from Lorcast
  code TEXT NOT NULL,                     -- Set code: "1", "2", "P1", "D23"
  name TEXT NOT NULL,                     -- "The First Chapter", "Rise of the Floodborn", etc.
  released_at DATE,                       -- Set release date
  prereleased_at DATE,                    -- Prerelease date
  total_cards INTEGER,                    -- Number of cards in set
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for set lookups
CREATE INDEX IF NOT EXISTS idx_lorcana_sets_code ON lorcana_sets(code);
CREATE INDEX IF NOT EXISTS idx_lorcana_sets_name ON lorcana_sets(name);

-- ============================================================================
-- 2. LORCANA CARDS TABLE
-- ============================================================================
-- Stores all Lorcana TCG cards with their metadata

CREATE TABLE IF NOT EXISTS lorcana_cards (
  id TEXT PRIMARY KEY,                    -- Card UUID from Lorcast
  name TEXT NOT NULL,                     -- Card name: "Elsa", "Mickey Mouse"
  version TEXT,                           -- Card version/subtitle: "Spirit of Winter"
  full_name TEXT,                         -- Combined: "Elsa - Spirit of Winter"
  collector_number TEXT NOT NULL,         -- Collector number: "1", "207"

  -- Set reference
  set_id TEXT REFERENCES lorcana_sets(id),
  set_code TEXT,                          -- Denormalized: "1", "2", "P1"
  set_name TEXT,                          -- Denormalized: "The First Chapter"

  -- Card classification
  ink TEXT,                               -- Primary ink: "Amber", "Amethyst", "Emerald", "Ruby", "Sapphire", "Steel"
  inkwell BOOLEAN DEFAULT false,          -- Can be put in inkwell
  card_type TEXT[],                       -- ["Character"], ["Action", "Song"], ["Item"]
  classifications TEXT[],                 -- ["Storyborn", "Hero"], ["Dreamborn", "Villain"]

  -- Card stats (for characters)
  cost INTEGER,                           -- Ink cost to play
  strength INTEGER,                       -- Strength value
  willpower INTEGER,                      -- Willpower value
  lore INTEGER,                           -- Lore gained when questing
  move_cost INTEGER,                      -- Move cost (for location cards)

  -- Card details
  card_text TEXT,                         -- Ability text
  flavor_text TEXT,                       -- Flavor text
  keywords TEXT[],                        -- ["Challenger", "Evasive", "Rush"]
  rarity TEXT,                            -- "Common", "Uncommon", "Rare", "Super_rare", "Legendary", "Enchanted"

  -- Images
  image_small TEXT,                       -- Small image URL
  image_normal TEXT,                      -- Normal image URL
  image_large TEXT,                       -- Large/hires image URL

  -- Artists
  illustrators TEXT[],                    -- Artist names

  -- External references
  tcgplayer_id INTEGER,                   -- TCGPlayer product ID

  -- Pricing
  price_usd DECIMAL(10,2),                -- TCGPlayer USD price
  price_usd_foil DECIMAL(10,2),           -- TCGPlayer USD foil price

  -- Legality
  legalities JSONB,                       -- {"core": "legal"}

  -- Metadata
  released_at DATE,                       -- Card release date
  lang TEXT DEFAULT 'en',                 -- Language
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEXES FOR FAST LOOKUPS
-- ============================================================================

-- Primary lookup pattern: name + collector_number (most common for AI matching)
CREATE INDEX IF NOT EXISTS idx_lorcana_cards_name ON lorcana_cards(name);
CREATE INDEX IF NOT EXISTS idx_lorcana_cards_full_name ON lorcana_cards(full_name);
CREATE INDEX IF NOT EXISTS idx_lorcana_cards_collector_number ON lorcana_cards(collector_number);
CREATE INDEX IF NOT EXISTS idx_lorcana_cards_name_number ON lorcana_cards(name, collector_number);

-- Set-based lookups
CREATE INDEX IF NOT EXISTS idx_lorcana_cards_set_id ON lorcana_cards(set_id);
CREATE INDEX IF NOT EXISTS idx_lorcana_cards_set_code ON lorcana_cards(set_code);
CREATE INDEX IF NOT EXISTS idx_lorcana_cards_set_name ON lorcana_cards(set_name);

-- Card type/ink for filtering
CREATE INDEX IF NOT EXISTS idx_lorcana_cards_ink ON lorcana_cards(ink);
CREATE INDEX IF NOT EXISTS idx_lorcana_cards_rarity ON lorcana_cards(rarity);

-- Combined lookup for AI: set_code + collector_number (e.g., "1/207")
CREATE INDEX IF NOT EXISTS idx_lorcana_cards_set_code_number ON lorcana_cards(set_code, collector_number);

-- ============================================================================
-- 4. HELPER FUNCTION: Search cards by name and number
-- ============================================================================

CREATE OR REPLACE FUNCTION search_lorcana_card(
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
) AS $$
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
    -- Calculate match score (higher = better match)
    CASE
      -- Exact set code + collector number match (e.g., "1/207")
      WHEN p_set_code IS NOT NULL AND p_collector_number IS NOT NULL
           AND lc.set_code = p_set_code AND lc.collector_number = p_collector_number THEN 100
      -- Full name exact match
      WHEN lc.full_name ILIKE p_name THEN 95
      -- Name + version match
      WHEN lc.name ILIKE p_name AND p_set_name IS NOT NULL AND lc.set_name ILIKE '%' || p_set_name || '%' THEN 90
      -- Exact name match
      WHEN lc.name ILIKE p_name THEN 80
      -- Name starts with
      WHEN lc.name ILIKE p_name || '%' OR lc.full_name ILIKE p_name || '%' THEN 70
      -- Name contains
      WHEN lc.name ILIKE '%' || p_name || '%' OR lc.full_name ILIKE '%' || p_name || '%' THEN 60
      -- Partial match
      ELSE 30
    END AS match_score
  FROM lorcana_cards lc
  WHERE
    -- Set code + number filter (highest priority for Lorcana)
    (p_set_code IS NULL OR lc.set_code = p_set_code)
    AND (p_collector_number IS NULL OR lc.collector_number = p_collector_number)
    -- Name must match (case-insensitive, partial match)
    AND (p_name IS NULL OR lc.name ILIKE '%' || p_name || '%' OR lc.full_name ILIKE '%' || p_name || '%')
    -- Set name filter (if provided)
    AND (p_set_name IS NULL OR lc.set_name ILIKE '%' || p_set_name || '%')
  ORDER BY match_score DESC, lc.set_code DESC, lc.collector_number ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. HELPER FUNCTION: Direct card lookup by set code and number
-- ============================================================================

CREATE OR REPLACE FUNCTION get_lorcana_card_by_set_number(
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
) AS $$
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
  FROM lorcana_cards lc
  WHERE lc.set_code = p_set_code AND lc.collector_number = p_collector_number
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. IMPORT TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS lorcana_import_log (
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

COMMENT ON TABLE lorcana_sets IS 'Local cache of Lorcana TCG sets from Lorcast API';
COMMENT ON TABLE lorcana_cards IS 'Local cache of Lorcana TCG cards from Lorcast API';
COMMENT ON TABLE lorcana_import_log IS 'Tracks imports from Lorcast API';
COMMENT ON FUNCTION search_lorcana_card IS 'Search for Lorcana cards by name, collector number, and set with fuzzy matching';
COMMENT ON FUNCTION get_lorcana_card_by_set_number IS 'Direct lookup of Lorcana card by set code and collector number (e.g., 1/207)';
