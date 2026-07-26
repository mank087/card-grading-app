-- ============================================================================
-- Generic TCG Card Database (Other-category identification)
-- ============================================================================
-- One table for the TCG franchises that customers grade under "Other" but
-- that have no dedicated category: Digimon, Dragon Ball Fusion World,
-- Union Arena, Gundam, Riftbound. Sourced from the apitcg open-data GitHub
-- repos (github.com/apitcg/<game>-tcg-data — plain JSON, no API key).
--
-- Card codes are printed on the cards (BT2-001, FB01-001, UA01BT-001,
-- GD01-001), so number-first matching identifies these reliably, same as
-- the Kayou Naruto database.
--
-- Import: scripts/import-tcg-database.js
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS tcg_cards (
  game TEXT NOT NULL,                      -- 'digimon' | 'dragon-ball-fusion' | 'union-arena' | 'gundam' | 'riftbound'
  code TEXT NOT NULL,                      -- printed card code, uppercased ("BT2-001")
  name TEXT,                               -- card name
  set_id TEXT,
  set_name TEXT,
  rarity TEXT,
  card_type TEXT,
  image_small TEXT,
  image_large TEXT,
  raw JSONB,                               -- full source record (fields vary per game)
  source TEXT DEFAULT 'apitcg-github',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (game, code)
);

CREATE INDEX IF NOT EXISTS idx_tcg_cards_code ON tcg_cards(code);
CREATE INDEX IF NOT EXISTS idx_tcg_cards_game_set ON tcg_cards(game, set_id);
CREATE INDEX IF NOT EXISTS idx_tcg_cards_name_trgm ON tcg_cards USING gin (name gin_trgm_ops);

ALTER TABLE tcg_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcg_cards_public_read" ON tcg_cards FOR SELECT USING (true);
