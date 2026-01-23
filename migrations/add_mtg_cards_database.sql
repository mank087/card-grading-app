-- Migration: Create MTG Cards Database
-- Purpose: Store Magic: The Gathering card data from Scryfall API for verified card identification
-- Date: 2026-01-23

-- =====================================================
-- MTG SETS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS mtg_sets (
  id UUID PRIMARY KEY,                    -- Scryfall set UUID
  code TEXT UNIQUE NOT NULL,              -- 3-6 letter code (e.g., "mkm", "one", "dmu")
  name TEXT NOT NULL,                     -- Full set name (e.g., "Murders at Karlov Manor")
  set_type TEXT,                          -- expansion, core, masters, draft_innovation, commander, etc.
  released_at DATE,                       -- Release date
  card_count INTEGER,                     -- Number of cards in set
  digital BOOLEAN DEFAULT false,          -- True if digital-only (Arena exclusive)
  scryfall_uri TEXT,                      -- URL to set page on Scryfall
  icon_svg_uri TEXT,                      -- Set symbol SVG URL
  search_uri TEXT,                        -- API endpoint to search cards in set
  parent_set_code TEXT,                   -- Parent set code (for tokens, promos, etc.)
  block_code TEXT,                        -- Block code (for older sets)
  block TEXT,                             -- Block name
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for set lookups
CREATE INDEX IF NOT EXISTS idx_mtg_sets_code ON mtg_sets(code);
CREATE INDEX IF NOT EXISTS idx_mtg_sets_set_type ON mtg_sets(set_type);
CREATE INDEX IF NOT EXISTS idx_mtg_sets_released_at ON mtg_sets(released_at DESC);

-- =====================================================
-- MTG CARDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS mtg_cards (
  id UUID PRIMARY KEY,                    -- Scryfall card UUID
  oracle_id UUID,                         -- Oracle ID for grouping all prints of a card
  name TEXT NOT NULL,                     -- Card name (first face for DFCs)

  -- Mana and casting
  mana_cost TEXT,                         -- Mana cost string (e.g., "{2}{U}{U}")
  cmc DECIMAL(4,1),                       -- Converted mana cost / mana value

  -- Card type and text
  type_line TEXT,                         -- Full type line (e.g., "Creature — Human Wizard")
  oracle_text TEXT,                       -- Rules text
  flavor_text TEXT,                       -- Flavor text

  -- Colors
  colors TEXT[],                          -- Card colors (e.g., ["U", "W"])
  color_identity TEXT[],                  -- Color identity for Commander
  color_indicator TEXT[],                 -- Color indicator (for cards without mana cost)

  -- Stats
  power TEXT,                             -- Power (can be "*", "1+*", etc.)
  toughness TEXT,                         -- Toughness
  loyalty TEXT,                           -- Planeswalker loyalty
  defense TEXT,                           -- Battle defense

  -- Keywords and abilities
  keywords TEXT[],                        -- Keyword abilities (Flying, Trample, etc.)
  produced_mana TEXT[],                   -- Mana this card can produce

  -- Set info (denormalized for efficient queries)
  set_id UUID REFERENCES mtg_sets(id),
  set_code TEXT NOT NULL,                 -- Set code (lowercase)
  set_name TEXT,                          -- Set name (denormalized)
  collector_number TEXT NOT NULL,         -- Collector number in set

  -- Print-specific details
  rarity TEXT,                            -- common, uncommon, rare, mythic, special, bonus
  artist TEXT,                            -- Artist name
  artist_ids UUID[],                      -- Scryfall artist UUIDs
  illustration_id UUID,                   -- Illustration ID for matching art across prints
  released_at DATE,                       -- Card release date

  -- Frame and layout
  layout TEXT,                            -- normal, split, flip, transform, meld, leveler, saga, etc.
  frame TEXT,                             -- 1993, 1997, 2003, 2015, future
  frame_effects TEXT[],                   -- showcase, extendedart, inverted, etc.
  border_color TEXT,                      -- black, white, borderless, silver, gold
  full_art BOOLEAN DEFAULT false,         -- Is full art
  textless BOOLEAN DEFAULT false,         -- Is textless

  -- Special flags
  promo BOOLEAN DEFAULT false,            -- Is promo card
  promo_types TEXT[],                     -- Promo types (prerelease, bundle, etc.)
  reprint BOOLEAN DEFAULT false,          -- Is a reprint
  variation BOOLEAN DEFAULT false,        -- Is a variation (alternate art, etc.)
  oversized BOOLEAN DEFAULT false,        -- Is oversized
  reserved BOOLEAN DEFAULT false,         -- On reserved list
  foil BOOLEAN DEFAULT false,             -- Available in foil
  nonfoil BOOLEAN DEFAULT true,           -- Available in nonfoil

  -- Double-faced card support
  card_faces JSONB,                       -- Array of card face objects for DFCs

  -- Images
  image_small TEXT,                       -- Small image URL (~146x204)
  image_normal TEXT,                      -- Normal image URL (~488x680)
  image_large TEXT,                       -- Large image URL (~672x936)
  image_png TEXT,                         -- PNG image URL (transparent)
  image_art_crop TEXT,                    -- Art crop image URL
  image_border_crop TEXT,                 -- Border crop image URL

  -- Pricing (in USD)
  price_usd DECIMAL(10,2),                -- Regular price
  price_usd_foil DECIMAL(10,2),           -- Foil price
  price_usd_etched DECIMAL(10,2),         -- Etched foil price
  price_eur DECIMAL(10,2),                -- EUR price
  price_tix DECIMAL(10,2),                -- MTGO tix price

  -- Legalities (stored as JSONB for flexibility)
  legalities JSONB,                       -- {"standard": "legal", "modern": "legal", ...}

  -- External IDs for marketplace links
  tcgplayer_id INTEGER,
  tcgplayer_etched_id INTEGER,
  cardmarket_id INTEGER,
  mtgo_id INTEGER,
  mtgo_foil_id INTEGER,
  arena_id INTEGER,
  multiverse_ids INTEGER[],

  -- Purchase URIs
  purchase_uris JSONB,                    -- {"tcgplayer": "...", "cardmarket": "...", ...}
  related_uris JSONB,                     -- {"gatherer": "...", "edhrec": "...", ...}

  -- Games availability
  games TEXT[],                           -- ["paper", "mtgo", "arena"]

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint on set + collector number
  UNIQUE(set_code, collector_number)
);

-- =====================================================
-- INDEXES FOR EFFICIENT QUERIES
-- =====================================================

-- Name search (most common query)
CREATE INDEX IF NOT EXISTS idx_mtg_cards_name ON mtg_cards(name);
CREATE INDEX IF NOT EXISTS idx_mtg_cards_name_lower ON mtg_cards(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_mtg_cards_name_trgm ON mtg_cards USING gin(name gin_trgm_ops);

-- Set and collector number lookups
CREATE INDEX IF NOT EXISTS idx_mtg_cards_set_code ON mtg_cards(set_code);
CREATE INDEX IF NOT EXISTS idx_mtg_cards_collector_number ON mtg_cards(collector_number);
CREATE INDEX IF NOT EXISTS idx_mtg_cards_set_code_number ON mtg_cards(set_code, collector_number);

-- Oracle ID for finding all prints
CREATE INDEX IF NOT EXISTS idx_mtg_cards_oracle_id ON mtg_cards(oracle_id);

-- Color filtering
CREATE INDEX IF NOT EXISTS idx_mtg_cards_colors ON mtg_cards USING GIN(colors);
CREATE INDEX IF NOT EXISTS idx_mtg_cards_color_identity ON mtg_cards USING GIN(color_identity);

-- Rarity and type filtering
CREATE INDEX IF NOT EXISTS idx_mtg_cards_rarity ON mtg_cards(rarity);
CREATE INDEX IF NOT EXISTS idx_mtg_cards_type_line ON mtg_cards(type_line);

-- Price lookups
CREATE INDEX IF NOT EXISTS idx_mtg_cards_price_usd ON mtg_cards(price_usd) WHERE price_usd IS NOT NULL;

-- Release date for sorting
CREATE INDEX IF NOT EXISTS idx_mtg_cards_released_at ON mtg_cards(released_at DESC);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to search MTG cards with fuzzy matching
CREATE OR REPLACE FUNCTION search_mtg_card(
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
) AS $$
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
      -- Exact name match
      WHEN LOWER(c.name) = LOWER(search_name) THEN 1.0
      -- Starts with search term
      WHEN LOWER(c.name) LIKE LOWER(search_name) || '%' THEN 0.9
      -- Contains search term
      WHEN LOWER(c.name) LIKE '%' || LOWER(search_name) || '%' THEN 0.7
      -- Trigram similarity
      ELSE similarity(c.name, search_name)
    END AS match_score
  FROM mtg_cards c
  WHERE
    (search_name IS NULL OR (
      LOWER(c.name) LIKE '%' || LOWER(search_name) || '%'
      OR similarity(c.name, search_name) > 0.3
    ))
    AND (search_set_code IS NULL OR c.set_code = LOWER(search_set_code))
    AND (search_collector_number IS NULL OR c.collector_number = search_collector_number)
  ORDER BY match_score DESC, c.released_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get card by set code and collector number (exact match)
CREATE OR REPLACE FUNCTION get_mtg_card_by_set_number(
  p_set_code TEXT,
  p_collector_number TEXT
)
RETURNS mtg_cards AS $$
DECLARE
  result mtg_cards;
BEGIN
  SELECT * INTO result
  FROM mtg_cards
  WHERE set_code = LOWER(p_set_code)
    AND collector_number = p_collector_number
  LIMIT 1;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- IMPORT TRACKING TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS mtg_import_log (
  id SERIAL PRIMARY KEY,
  import_type TEXT NOT NULL,              -- 'full', 'incremental', 'set'
  set_code TEXT,                          -- Set code if importing single set
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  sets_imported INTEGER DEFAULT 0,
  cards_imported INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  error_details JSONB,
  status TEXT DEFAULT 'running'           -- 'running', 'completed', 'failed'
);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE mtg_sets IS 'Magic: The Gathering set information from Scryfall API';
COMMENT ON TABLE mtg_cards IS 'Magic: The Gathering card data from Scryfall API for verified identification';
COMMENT ON TABLE mtg_import_log IS 'Tracks MTG database import operations';

COMMENT ON COLUMN mtg_cards.oracle_id IS 'Groups all prints of the same card together';
COMMENT ON COLUMN mtg_cards.card_faces IS 'Contains face data for double-faced, split, flip, and adventure cards';
COMMENT ON COLUMN mtg_cards.legalities IS 'Format legality: standard, modern, legacy, vintage, commander, etc.';
