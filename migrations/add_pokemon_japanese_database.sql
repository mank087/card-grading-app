-- ============================================================================
-- Japanese Pokemon Cards Database (TCGdex)
-- ============================================================================
-- This migration creates SEPARATE tables for Japanese Pokemon TCG cards.
--
-- SAFETY: These tables are completely independent from the existing
-- pokemon_sets and pokemon_cards tables. No existing functionality is affected.
--
-- Data Source: TCGdex API (https://tcgdex.dev)
-- ============================================================================

-- ============================================================================
-- 1. JAPANESE POKEMON SETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pokemon_sets_ja (
  id TEXT PRIMARY KEY,                    -- TCGdex set ID: "SV4M", "S12a"
  name TEXT NOT NULL,                     -- Japanese set name
  name_english TEXT,                      -- English name if known
  series TEXT,                            -- Series name
  printed_total INTEGER,                  -- Number of cards in set
  release_date DATE,                      -- Set release date
  symbol_url TEXT,                        -- Set symbol image URL
  logo_url TEXT,                          -- Set logo image URL

  -- Link to English equivalent set (if exists)
  english_set_id TEXT,                    -- References pokemon_sets(id) - soft link

  -- Metadata
  tcgdex_updated_at TIMESTAMPTZ,          -- Last update from TCGdex
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pokemon_sets_ja_name ON pokemon_sets_ja(name);
CREATE INDEX IF NOT EXISTS idx_pokemon_sets_ja_name_english ON pokemon_sets_ja(name_english);
CREATE INDEX IF NOT EXISTS idx_pokemon_sets_ja_series ON pokemon_sets_ja(series);
CREATE INDEX IF NOT EXISTS idx_pokemon_sets_ja_english_set_id ON pokemon_sets_ja(english_set_id);

-- ============================================================================
-- 2. JAPANESE POKEMON CARDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pokemon_cards_ja (
  id TEXT PRIMARY KEY,                    -- TCGdex card ID: "SV4M-001"
  name TEXT NOT NULL,                     -- Japanese name: "リザードン"
  name_english TEXT,                      -- English name if known: "Charizard"
  name_romanized TEXT,                    -- Romanized: "Rizaadon"
  local_id TEXT NOT NULL,                 -- Card number in set: "001"
  set_id TEXT REFERENCES pokemon_sets_ja(id),

  -- Pokemon identification (for correlation)
  dex_id INTEGER[],                       -- Pokedex number(s) for correlation

  -- Card classification
  supertype TEXT,                         -- "Pokémon", "Trainer", "Energy"
  subtypes TEXT[],                        -- ["Stage 2"], ["Supporter"]
  types TEXT[],                           -- ["Fire"], ["Water"]

  -- Pokemon-specific fields
  hp INTEGER,                             -- HP as integer
  stage TEXT,                             -- "Basic", "Stage 1", "Stage 2"
  evolves_from TEXT,                      -- Evolution source

  -- Card details
  rarity TEXT,                            -- Rarity name
  illustrator TEXT,                       -- Artist name
  description TEXT,                       -- Flavor text / description
  regulation_mark TEXT,                   -- Regulation mark (D, E, F, G, H)

  -- Variants
  is_holo BOOLEAN DEFAULT FALSE,
  is_reverse BOOLEAN DEFAULT FALSE,
  is_promo BOOLEAN DEFAULT FALSE,
  is_first_edition BOOLEAN DEFAULT FALSE,

  -- Images
  image_url TEXT,                         -- Card image from TCGdex

  -- Market links (if available)
  tcgplayer_url TEXT,
  cardmarket_url TEXT,

  -- Denormalized set data for faster queries
  set_name TEXT,
  set_name_english TEXT,
  set_series TEXT,
  set_printed_total INTEGER,
  set_release_date DATE,

  -- Link to English equivalent card (if exists)
  english_card_id TEXT,                   -- References pokemon_cards(id) - soft link

  -- Legal formats
  legal_standard BOOLEAN DEFAULT FALSE,
  legal_expanded BOOLEAN DEFAULT FALSE,

  -- Metadata
  tcgdex_updated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEXES FOR FAST LOOKUPS
-- ============================================================================

-- Primary lookup patterns
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_ja_name ON pokemon_cards_ja(name);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_ja_name_english ON pokemon_cards_ja(name_english);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_ja_local_id ON pokemon_cards_ja(local_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_ja_name_local_id ON pokemon_cards_ja(name, local_id);

-- Set-based lookups
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_ja_set_id ON pokemon_cards_ja(set_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_ja_set_name ON pokemon_cards_ja(set_name);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_ja_set_printed_total ON pokemon_cards_ja(set_printed_total);

-- Correlation lookups
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_ja_dex_id ON pokemon_cards_ja USING gin(dex_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_ja_english_card_id ON pokemon_cards_ja(english_card_id);

-- Combined lookup for AI grading results
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_ja_lookup ON pokemon_cards_ja(name, local_id, set_printed_total);

-- Rarity and type filtering
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_ja_rarity ON pokemon_cards_ja(rarity);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_ja_supertype ON pokemon_cards_ja(supertype);

-- ============================================================================
-- 4. JAPANESE IMPORT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS pokemon_import_log_ja (
  id SERIAL PRIMARY KEY,
  import_type TEXT NOT NULL,              -- "full", "incremental", "set_update"
  source TEXT DEFAULT 'tcgdex',           -- Data source
  sets_imported INTEGER DEFAULT 0,
  cards_imported INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',          -- "running", "completed", "failed"
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. CORRELATION HELPER FUNCTION
-- ============================================================================
-- Find English equivalent for a Japanese card using Pokedex ID

CREATE OR REPLACE FUNCTION find_english_equivalent(
  p_dex_id INTEGER,
  p_set_printed_total INTEGER DEFAULT NULL
)
RETURNS TABLE (
  english_card_id TEXT,
  english_name TEXT,
  english_set_name TEXT,
  match_confidence INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id,
    pc.name,
    pc.set_name,
    CASE
      WHEN pc.set_printed_total = p_set_printed_total THEN 100
      ELSE 50
    END AS match_confidence
  FROM pokemon_cards pc
  WHERE
    -- Match by name patterns (common Pokemon names)
    pc.name ILIKE '%' ||
      CASE p_dex_id
        WHEN 1 THEN 'Bulbasaur'
        WHEN 4 THEN 'Charmander'
        WHEN 6 THEN 'Charizard'
        WHEN 7 THEN 'Squirtle'
        WHEN 25 THEN 'Pikachu'
        WHEN 150 THEN 'Mewtwo'
        WHEN 151 THEN 'Mew'
        -- Add more mappings as needed
        ELSE ''
      END || '%'
    AND (p_set_printed_total IS NULL OR pc.set_printed_total = p_set_printed_total)
  ORDER BY match_confidence DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- 6. UNIFIED SEARCH FUNCTION (searches both English and Japanese)
-- ============================================================================

CREATE OR REPLACE FUNCTION search_pokemon_all_languages(
  p_name TEXT,
  p_number TEXT DEFAULT NULL,
  p_set_printed_total INTEGER DEFAULT NULL,
  p_language TEXT DEFAULT 'all'  -- 'en', 'ja', 'all'
)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  name_display TEXT,             -- Name to display (Japanese with English if available)
  number TEXT,
  set_id TEXT,
  set_name TEXT,
  set_printed_total INTEGER,
  rarity TEXT,
  image_url TEXT,
  language TEXT,
  match_score INTEGER
) AS $$
BEGIN
  -- Search English cards
  IF p_language IN ('en', 'all') THEN
    RETURN QUERY
    SELECT
      pc.id,
      pc.name,
      pc.name AS name_display,
      pc.number,
      pc.set_id,
      pc.set_name,
      pc.set_printed_total,
      pc.rarity,
      pc.image_small AS image_url,
      'en'::TEXT AS language,
      CASE
        WHEN pc.name ILIKE p_name AND pc.number = p_number THEN 100
        WHEN pc.name ILIKE p_name || '%' THEN 70
        WHEN pc.name ILIKE '%' || p_name || '%' THEN 50
        ELSE 30
      END AS match_score
    FROM pokemon_cards pc
    WHERE pc.name ILIKE '%' || p_name || '%'
      AND (p_number IS NULL OR pc.number = p_number)
      AND (p_set_printed_total IS NULL OR pc.set_printed_total = p_set_printed_total);
  END IF;

  -- Search Japanese cards
  IF p_language IN ('ja', 'all') THEN
    RETURN QUERY
    SELECT
      pj.id,
      pj.name,
      CASE
        WHEN pj.name_english IS NOT NULL THEN pj.name || ' (' || pj.name_english || ')'
        ELSE pj.name
      END AS name_display,
      pj.local_id AS number,
      pj.set_id,
      pj.set_name,
      pj.set_printed_total,
      pj.rarity,
      pj.image_url,
      'ja'::TEXT AS language,
      CASE
        WHEN pj.name ILIKE p_name OR pj.name_english ILIKE p_name THEN 100
        WHEN pj.name ILIKE p_name || '%' OR pj.name_english ILIKE p_name || '%' THEN 70
        WHEN pj.name ILIKE '%' || p_name || '%' OR pj.name_english ILIKE '%' || p_name || '%' THEN 50
        ELSE 30
      END AS match_score
    FROM pokemon_cards_ja pj
    WHERE (pj.name ILIKE '%' || p_name || '%' OR pj.name_english ILIKE '%' || p_name || '%')
      AND (p_number IS NULL OR pj.local_id = p_number)
      AND (p_set_printed_total IS NULL OR pj.set_printed_total = p_set_printed_total);
  END IF;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON TABLE pokemon_sets_ja IS 'Japanese Pokemon TCG sets from TCGdex API';
COMMENT ON TABLE pokemon_cards_ja IS 'Japanese Pokemon TCG cards from TCGdex API';
COMMENT ON TABLE pokemon_import_log_ja IS 'Tracks imports from TCGdex API';
COMMENT ON FUNCTION find_english_equivalent IS 'Find English equivalent card using Pokedex ID';
COMMENT ON FUNCTION search_pokemon_all_languages IS 'Search Pokemon cards in both English and Japanese';
