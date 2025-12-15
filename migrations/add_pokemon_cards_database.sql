-- ============================================================================
-- Pokemon Cards Local Database
-- ============================================================================
-- This migration creates tables to store Pokemon TCG card data locally,
-- eliminating dependency on external API calls for card lookups.
--
-- Benefits:
-- - No API timeouts (instant lookups)
-- - No rate limits
-- - Fuzzy search capability
-- - Works offline if Pokemon TCG API is down
-- ============================================================================

-- ============================================================================
-- 1. POKEMON SETS TABLE
-- ============================================================================
-- Stores all Pokemon TCG sets/expansions

CREATE TABLE IF NOT EXISTS pokemon_sets (
  id TEXT PRIMARY KEY,                    -- API set ID: "base1", "sv1", "swsh12pt5"
  name TEXT NOT NULL,                     -- "Base", "Scarlet & Violet", "Crown Zenith"
  series TEXT,                            -- "Base", "Scarlet & Violet", "Sword & Shield"
  printed_total INTEGER,                  -- Number on cards (e.g., 102 for Base Set)
  total INTEGER,                          -- Actual total including secrets
  release_date DATE,                      -- Set release date
  symbol_url TEXT,                        -- Set symbol image URL
  logo_url TEXT,                          -- Set logo image URL
  ptcgo_code TEXT,                        -- Pokemon TCG Online code
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for set lookups by name
CREATE INDEX IF NOT EXISTS idx_pokemon_sets_name ON pokemon_sets(name);
CREATE INDEX IF NOT EXISTS idx_pokemon_sets_series ON pokemon_sets(series);
CREATE INDEX IF NOT EXISTS idx_pokemon_sets_printed_total ON pokemon_sets(printed_total);

-- ============================================================================
-- 2. POKEMON CARDS TABLE
-- ============================================================================
-- Stores all Pokemon TCG cards with their metadata

CREATE TABLE IF NOT EXISTS pokemon_cards (
  id TEXT PRIMARY KEY,                    -- API card ID: "base1-4", "sv1-185"
  name TEXT NOT NULL,                     -- Pokemon/card name: "Charizard", "Professor's Research"
  number TEXT NOT NULL,                   -- Card number in set: "4", "185", "TG10"
  set_id TEXT REFERENCES pokemon_sets(id),-- Foreign key to set

  -- Card classification
  supertype TEXT,                         -- "Pokémon", "Trainer", "Energy"
  subtypes TEXT[],                        -- ["Stage 2"], ["Supporter"], ["Basic"]
  types TEXT[],                           -- ["Fire"], ["Water", "Psychic"]

  -- Pokemon-specific fields
  hp TEXT,                                -- "120", "340"
  evolves_from TEXT,                      -- "Charmeleon"
  evolves_to TEXT[],                      -- For basic Pokemon

  -- Card details
  rarity TEXT,                            -- "Rare Holo", "Common", "Illustration Rare"
  artist TEXT,                            -- "Mitsuhiro Arita"
  flavor_text TEXT,                       -- Pokedex entry / flavor text

  -- Images
  image_small TEXT,                       -- Low-res image URL
  image_large TEXT,                       -- High-res image URL

  -- Market links
  tcgplayer_url TEXT,                     -- TCGPlayer product URL
  cardmarket_url TEXT,                    -- Cardmarket URL

  -- Denormalized set data for faster queries
  set_name TEXT,                          -- Denormalized from pokemon_sets
  set_series TEXT,                        -- Denormalized from pokemon_sets
  set_printed_total INTEGER,              -- Denormalized from pokemon_sets
  set_release_date DATE,                  -- Denormalized from pokemon_sets

  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEXES FOR FAST LOOKUPS
-- ============================================================================

-- Primary lookup pattern: name + number (most common)
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_name ON pokemon_cards(name);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_number ON pokemon_cards(number);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_name_number ON pokemon_cards(name, number);

-- Set-based lookups
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_set_id ON pokemon_cards(set_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_set_name ON pokemon_cards(set_name);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_set_printed_total ON pokemon_cards(set_printed_total);

-- Combined lookup for AI grading results
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_lookup ON pokemon_cards(name, number, set_printed_total);

-- Supertype/rarity for filtering
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_supertype ON pokemon_cards(supertype);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_rarity ON pokemon_cards(rarity);

-- ============================================================================
-- 4. TRIGRAM INDEX FOR FUZZY SEARCH (Optional but recommended)
-- ============================================================================
-- Enable pg_trgm extension for fuzzy text matching
-- This helps when AI makes slight OCR errors in card names

-- Note: Run this separately if extension isn't already enabled:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram index for fuzzy name matching (uncomment after enabling pg_trgm)
-- CREATE INDEX IF NOT EXISTS idx_pokemon_cards_name_trgm ON pokemon_cards USING gin(name gin_trgm_ops);

-- ============================================================================
-- 5. HELPER FUNCTION: Search cards by name and number
-- ============================================================================

CREATE OR REPLACE FUNCTION search_pokemon_card(
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
) AS $$
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
  FROM pokemon_cards pc
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
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. IMPORT TRACKING TABLE
-- ============================================================================
-- Track when the database was last updated

CREATE TABLE IF NOT EXISTS pokemon_import_log (
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

COMMENT ON TABLE pokemon_sets IS 'Local cache of Pokemon TCG sets from api.pokemontcg.io';
COMMENT ON TABLE pokemon_cards IS 'Local cache of Pokemon TCG cards from api.pokemontcg.io';
COMMENT ON TABLE pokemon_import_log IS 'Tracks imports from Pokemon TCG API';
COMMENT ON FUNCTION search_pokemon_card IS 'Search for Pokemon cards by name, number, and set total with fuzzy matching';
