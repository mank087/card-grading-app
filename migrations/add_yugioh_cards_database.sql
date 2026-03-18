-- ============================================================================
-- Yu-Gi-Oh! Cards Local Database
-- ============================================================================
-- This migration creates tables to store Yu-Gi-Oh! TCG card data locally,
-- eliminating dependency on external API calls for card lookups.
--
-- Data source: YGOPRODeck API v7 (https://ygoprodeck.com/api-guide/)
--
-- Benefits:
-- - No API timeouts (instant lookups)
-- - No rate limits
-- - Fuzzy search capability
-- - Works offline if YGOPRODeck API is down
-- ============================================================================

-- ============================================================================
-- 1. YU-GI-OH SETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS yugioh_sets (
  set_code TEXT PRIMARY KEY,                -- Set code: "LOB", "SDK", "DUEA"
  set_name TEXT NOT NULL,                   -- "Legend of Blue Eyes White Dragon"
  num_of_cards INTEGER,                     -- Number of cards in set
  tcg_date DATE,                            -- TCG release date
  set_image TEXT,                           -- Set image URL (self-hosted)
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yugioh_sets_name ON yugioh_sets(set_name);

-- ============================================================================
-- 2. YU-GI-OH CARDS TABLE
-- ============================================================================
-- Stores unique Yu-Gi-Oh! cards (one row per card, not per printing)

CREATE TABLE IF NOT EXISTS yugioh_cards (
  id BIGINT PRIMARY KEY,                    -- YGOPRODeck card ID (e.g., 46986414)
  name TEXT NOT NULL,                       -- "Dark Magician", "Blue-Eyes White Dragon"
  type TEXT,                                -- "Normal Monster", "Effect Monster", "Spell Card", "Trap Card"
  human_readable_card_type TEXT,            -- "Normal Monster", "Fusion Monster", etc.
  frame_type TEXT,                          -- "normal", "effect", "ritual", "fusion", "synchro", "xyz", "link", "spell", "trap"
  card_desc TEXT,                                -- Card effect/flavor text
  race TEXT,                                -- Monster type: "Spellcaster", "Dragon", "Warrior" (or spell/trap type: "Normal", "Continuous")
  attribute TEXT,                           -- "DARK", "LIGHT", "FIRE", "WATER", "EARTH", "WIND", "DIVINE"
  archetype TEXT,                           -- "Dark Magician", "Blue-Eyes", "HERO"

  -- Monster stats
  atk INTEGER,                              -- Attack points (NULL for Spell/Trap)
  def INTEGER,                              -- Defense points (NULL for Spell/Trap/Link)
  level INTEGER,                            -- Level/Rank (NULL for Spell/Trap/Link)
  scale INTEGER,                            -- Pendulum scale (NULL if not Pendulum)
  linkval INTEGER,                          -- Link rating (NULL if not Link)
  linkmarkers TEXT[],                       -- Link arrows: ["Top", "Bottom-Left", "Bottom-Right"]

  -- Typeline
  typeline TEXT[],                          -- ["Spellcaster", "Normal"], ["Machine", "Effect"]

  -- Images (self-hosted URLs after download)
  image_url TEXT,                           -- Full card image
  image_url_small TEXT,                     -- Small card image
  image_url_cropped TEXT,                   -- Cropped art image

  -- Pricing
  tcgplayer_price DECIMAL(10,2),            -- TCGPlayer price
  cardmarket_price DECIMAL(10,2),           -- Cardmarket price
  ebay_price DECIMAL(10,2),                 -- eBay price
  amazon_price DECIMAL(10,2),               -- Amazon price

  -- External reference
  ygoprodeck_url TEXT,                      -- Link to YGOPRODeck page

  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. YU-GI-OH CARD PRINTINGS TABLE
-- ============================================================================
-- Stores every printing of each card (a card can appear in many sets)
-- This is the key table for grading identification: set_code uniquely identifies a printing

CREATE TABLE IF NOT EXISTS yugioh_card_printings (
  id SERIAL PRIMARY KEY,
  card_id BIGINT NOT NULL REFERENCES yugioh_cards(id),
  set_code TEXT NOT NULL,                   -- Full set code: "LOB-005", "CT13-EN003"
  set_name TEXT NOT NULL,                   -- "Legend of Blue Eyes White Dragon"
  set_rarity TEXT,                          -- "Ultra Rare", "Common", "Secret Rare"
  set_rarity_code TEXT,                     -- "(UR)", "(C)", "(ScR)"
  set_price DECIMAL(10,2),                  -- Price for this specific printing

  -- Denormalized card name for fast lookups
  card_name TEXT NOT NULL,

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(card_id, set_code)
);

-- ============================================================================
-- 4. INDEXES FOR FAST LOOKUPS
-- ============================================================================

-- Card lookups
CREATE INDEX IF NOT EXISTS idx_yugioh_cards_name ON yugioh_cards(name);
CREATE INDEX IF NOT EXISTS idx_yugioh_cards_name_lower ON yugioh_cards(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_yugioh_cards_type ON yugioh_cards(type);
CREATE INDEX IF NOT EXISTS idx_yugioh_cards_frame_type ON yugioh_cards(frame_type);
CREATE INDEX IF NOT EXISTS idx_yugioh_cards_attribute ON yugioh_cards(attribute);
CREATE INDEX IF NOT EXISTS idx_yugioh_cards_race ON yugioh_cards(race);
CREATE INDEX IF NOT EXISTS idx_yugioh_cards_archetype ON yugioh_cards(archetype);

-- Printing lookups (critical for grading — need to find card by set code)
CREATE INDEX IF NOT EXISTS idx_yugioh_printings_card_id ON yugioh_card_printings(card_id);
CREATE INDEX IF NOT EXISTS idx_yugioh_printings_set_code ON yugioh_card_printings(set_code);
CREATE INDEX IF NOT EXISTS idx_yugioh_printings_set_name ON yugioh_card_printings(set_name);
CREATE INDEX IF NOT EXISTS idx_yugioh_printings_card_name ON yugioh_card_printings(card_name);
CREATE INDEX IF NOT EXISTS idx_yugioh_printings_card_name_lower ON yugioh_card_printings(LOWER(card_name));
CREATE INDEX IF NOT EXISTS idx_yugioh_printings_rarity ON yugioh_card_printings(set_rarity);

-- Combined lookup for grading: card name + set code
CREATE INDEX IF NOT EXISTS idx_yugioh_printings_name_set ON yugioh_card_printings(card_name, set_code);

-- ============================================================================
-- 5. HELPER FUNCTION: Search cards by name, set code, rarity
-- ============================================================================

CREATE OR REPLACE FUNCTION search_yugioh_card(
  p_name TEXT,
  p_set_code TEXT DEFAULT NULL,
  p_set_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  card_id BIGINT,
  name TEXT,
  type TEXT,
  frame_type TEXT,
  attribute TEXT,
  race TEXT,
  atk INTEGER,
  def INTEGER,
  level INTEGER,
  set_code TEXT,
  set_name TEXT,
  set_rarity TEXT,
  set_price DECIMAL,
  image_url TEXT,
  image_url_small TEXT,
  match_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    yc.id AS card_id,
    yc.name,
    yc.type,
    yc.frame_type,
    yc.attribute,
    yc.race,
    yc.atk,
    yc.def,
    yc.level,
    yp.set_code,
    yp.set_name,
    yp.set_rarity,
    yp.set_price,
    yc.image_url,
    yc.image_url_small,
    CASE
      -- Exact set code match (e.g., "LOB-005")
      WHEN p_set_code IS NOT NULL AND yp.set_code ILIKE p_set_code THEN 100
      -- Exact name + set name match
      WHEN yc.name ILIKE p_name AND p_set_name IS NOT NULL AND yp.set_name ILIKE '%' || p_set_name || '%' THEN 95
      -- Exact name match
      WHEN yc.name ILIKE p_name THEN 85
      -- Name starts with
      WHEN yc.name ILIKE p_name || '%' THEN 70
      -- Name contains
      WHEN yc.name ILIKE '%' || p_name || '%' THEN 60
      -- Printing card_name match (covers slight variations)
      WHEN yp.card_name ILIKE '%' || p_name || '%' THEN 50
      ELSE 30
    END AS match_score
  FROM yugioh_cards yc
  JOIN yugioh_card_printings yp ON yc.id = yp.card_id
  WHERE
    (p_set_code IS NULL OR yp.set_code ILIKE p_set_code OR yp.set_code ILIKE p_set_code || '%')
    AND (p_name IS NULL OR yc.name ILIKE '%' || p_name || '%' OR yp.card_name ILIKE '%' || p_name || '%')
    AND (p_set_name IS NULL OR yp.set_name ILIKE '%' || p_set_name || '%')
  ORDER BY match_score DESC, yp.set_name ASC, yp.set_code ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. HELPER FUNCTION: Direct lookup by set code (e.g., "LOB-005")
-- ============================================================================

CREATE OR REPLACE FUNCTION get_yugioh_card_by_set_code(
  p_set_code TEXT
)
RETURNS TABLE (
  card_id BIGINT,
  name TEXT,
  type TEXT,
  frame_type TEXT,
  card_desc TEXT,
  race TEXT,
  attribute TEXT,
  archetype TEXT,
  atk INTEGER,
  def INTEGER,
  level INTEGER,
  scale INTEGER,
  linkval INTEGER,
  linkmarkers TEXT[],
  image_url TEXT,
  image_url_small TEXT,
  image_url_cropped TEXT,
  set_code TEXT,
  set_name TEXT,
  set_rarity TEXT,
  set_price DECIMAL,
  tcgplayer_price DECIMAL,
  cardmarket_price DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    yc.id AS card_id,
    yc.name,
    yc.type,
    yc.frame_type,
    yc.card_desc,
    yc.race,
    yc.attribute,
    yc.archetype,
    yc.atk,
    yc.def,
    yc.level,
    yc.scale,
    yc.linkval,
    yc.linkmarkers,
    yc.image_url,
    yc.image_url_small,
    yc.image_url_cropped,
    yp.set_code,
    yp.set_name,
    yp.set_rarity,
    yp.set_price,
    yc.tcgplayer_price,
    yc.cardmarket_price
  FROM yugioh_cards yc
  JOIN yugioh_card_printings yp ON yc.id = yp.card_id
  WHERE yp.set_code ILIKE p_set_code
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. IMPORT TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS yugioh_import_log (
  id SERIAL PRIMARY KEY,
  import_type TEXT NOT NULL,              -- "full", "incremental"
  sets_imported INTEGER DEFAULT 0,
  cards_imported INTEGER DEFAULT 0,
  printings_imported INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',          -- "running", "completed", "failed"
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 8. COMMENTS
-- ============================================================================

COMMENT ON TABLE yugioh_sets IS 'Local cache of Yu-Gi-Oh! TCG sets from YGOPRODeck API';
COMMENT ON TABLE yugioh_cards IS 'Local cache of Yu-Gi-Oh! TCG cards (one row per unique card)';
COMMENT ON TABLE yugioh_card_printings IS 'Every printing of each card across all sets (key for grading identification)';
COMMENT ON TABLE yugioh_import_log IS 'Tracks imports from YGOPRODeck API';
COMMENT ON FUNCTION search_yugioh_card IS 'Search Yu-Gi-Oh! cards by name, set code, and set name with fuzzy matching';
COMMENT ON FUNCTION get_yugioh_card_by_set_code IS 'Direct lookup of Yu-Gi-Oh! card by full set code (e.g., LOB-005)';
