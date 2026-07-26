-- ============================================================================
-- Naruto (Kayou) Card Database
-- ============================================================================
-- Local mirror of the Kayou Naruto trading-card checklist, sourced from the
-- community-verified narutodb.com API (https://api.narutodb.com). Covers the
-- North American release line (NRSA/NREA sets + promos); schema leaves room
-- for the Chinese-line sets (NR/NRZ/T-series) via the `source` column so a
-- future supplemental import doesn't need a new migration.
--
-- Powers card identification for Kayou Naruto cards graded under the "Other"
-- category (and a dedicated Naruto category later). Kayou card numbers are
-- highly structured — "NRSA01-SE-001L5" = set NRSA01, rarity SE, slot 001,
-- tier L5 — which makes number-first matching very reliable.
--
-- Import: scripts/import-naruto-database.js
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 1. NARUTO SETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS naruto_sets (
  id TEXT PRIMARY KEY,                     -- "NRSA01"
  name TEXT NOT NULL,                      -- "Heaven Scroll"
  subtitle TEXT,                           -- "Series 1"
  story_arc TEXT,                          -- "Land of Waves (eps 1-19)"
  parent_chinese_set TEXT,                 -- "T4W6" (Chinese-line origin set)
  release_online DATE,
  release_instore DATE,
  total_cards INTEGER DEFAULT 0,
  msrp_per_pack_cents INTEGER,
  pack_size INTEGER,
  packs_per_box INTEGER,
  cover_image_url TEXT,
  display_order INTEGER,
  source TEXT DEFAULT 'narutodb',          -- provenance ('narutodb' | future sources)
  last_imported_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. NARUTO CARDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS naruto_cards (
  card_number TEXT PRIMARY KEY,            -- "NRSA01-SE-001L5" (full printed code)
  set_id TEXT REFERENCES naruto_sets(id),
  rarity_code TEXT,                        -- "SE", "SSR", "UR", "SP", "CP", ...
  slot_number INTEGER,                     -- 1 (position within rarity run)
  l_tier TEXT,                             -- "L5" (tier suffix)
  serial_text TEXT,                        -- serialization notation, if any
  character_name TEXT,                     -- "Sasuke Uchiha"
  character_title TEXT,                    -- promo-only extended title
  featured_characters TEXT[],              -- all characters on the card
  is_promo BOOLEAN DEFAULT FALSE,
  promo_type TEXT,
  promo_distribution TEXT,
  promo_print_run TEXT,
  art_theme_notes TEXT,
  image_thumb_url TEXT,                    -- CDN reference image (thumb)
  image_front_url TEXT,                    -- full-size reference (promos)
  image_back_url TEXT,
  image_is_stand_in BOOLEAN DEFAULT FALSE, -- placeholder image, not real card art
  source TEXT DEFAULT 'narutodb',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_naruto_cards_set ON naruto_cards(set_id);
CREATE INDEX IF NOT EXISTS idx_naruto_cards_character ON naruto_cards(character_name);
CREATE INDEX IF NOT EXISTS idx_naruto_cards_rarity ON naruto_cards(rarity_code);
CREATE INDEX IF NOT EXISTS idx_naruto_cards_character_trgm ON naruto_cards USING gin (character_name gin_trgm_ops);

-- ============================================================================
-- 3. RLS — same posture as the other card databases: reference data,
-- server-side access via service role only (no public policies needed).
-- ============================================================================

ALTER TABLE naruto_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE naruto_cards ENABLE ROW LEVEL SECURITY;

-- Public read is safe (it's a checklist), and lets future client features
-- (set browser page) query directly without a server roundtrip.
CREATE POLICY "naruto_sets_public_read" ON naruto_sets FOR SELECT USING (true);
CREATE POLICY "naruto_cards_public_read" ON naruto_cards FOR SELECT USING (true);
