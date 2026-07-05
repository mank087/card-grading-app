-- ============================================================================
-- Sports Cards Local Database
-- ============================================================================
-- Local mirror of the SportsCardsPro price guide (CSV download, Legendary
-- subscription). Unlike the TCG databases, checklist data and pricing live in
-- the same rows, so this table powers BOTH identity matching (WS2/WS2b) and
-- pricing without per-card API calls.
--
-- Import: scripts/import-sports-database.js
--   1. Discover sets from category pages (11 sports) -> sports_sets
--   2. Batch-download per-set CSVs via download-custom?console-uids=...
--   3. Parse product names into structured columns at import time
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 1. SPORTS SETS TABLE
-- ============================================================================
-- One row per SportsCardsPro "console" (set). The console UID (e.g. "G155")
-- is the key used by the CSV download endpoint.

CREATE TABLE IF NOT EXISTS sports_sets (
  uid TEXT PRIMARY KEY,                    -- SportsCardsPro console UID ("G155")
  slug TEXT UNIQUE NOT NULL,               -- URL slug ("basketball-cards-1986-fleer")
  console_name TEXT NOT NULL,              -- "Basketball Cards 1986 Fleer"
  -- Parsed from console_name: "<Sport> Cards <Year> <Manufacturer> <SetName>"
  sport TEXT,                              -- "basketball", "football", ...
  year INTEGER,                            -- 1986 (first 4-digit run)
  manufacturer TEXT,                       -- "Fleer", "Panini", "Topps", "Upper Deck", ...
  set_name TEXT,                           -- Remainder after manufacturer ("Prizm", "Chrome", "")
  product_count INTEGER DEFAULT 0,
  last_imported_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sports_sets_sport ON sports_sets(sport);
CREATE INDEX IF NOT EXISTS idx_sports_sets_year ON sports_sets(year);
CREATE INDEX IF NOT EXISTS idx_sports_sets_manufacturer ON sports_sets(manufacturer);
CREATE INDEX IF NOT EXISTS idx_sports_sets_sport_year_mfr ON sports_sets(sport, year, manufacturer);
CREATE INDEX IF NOT EXISTS idx_sports_sets_console_name_trgm ON sports_sets USING gin (console_name gin_trgm_ops);

-- ============================================================================
-- 2. SPORTS CARD PRODUCTS TABLE
-- ============================================================================
-- One row per SportsCardsPro product. Every parallel is its own product row
-- (e.g. "LeBron James #23" and "LeBron James [Silver Prizm] #23"), so a
-- "family" = all rows sharing (set_uid, card_number).

CREATE TABLE IF NOT EXISTS sports_card_products (
  id TEXT PRIMARY KEY,                     -- SportsCardsPro product id ("72548")
  product_name TEXT NOT NULL,              -- "Adrian Dantley #21", "LeBron James [Silver Prizm] #23"
  console_name TEXT NOT NULL,              -- Denormalized set string
  set_uid TEXT REFERENCES sports_sets(uid),

  -- Parsed from product_name at import time (WS1.1)
  player_name TEXT,                        -- Name minus brackets/number/serial
  card_number TEXT,                        -- "21" (leading # and zeros stripped, uppercased)
  variant_text TEXT,                       -- Bracket content: "Silver Prizm", "Cracked Ice" (NULL = base)
  serial_denominator INTEGER,              -- 75 for "/75" print runs (NULL = not serial-numbered)
  is_rookie BOOLEAN DEFAULT FALSE,         -- Product name carries RC/Rookie marker

  -- Prices in dollars (CSV ships "$6.92" strings). Grade mapping per
  -- SportsCardsPro docs: cib=7, new=8, graded=9, box_only=9.5,
  -- manual_only=PSA 10, bgs_10=BGS 10, condition_17=CGC 10, condition_18=SGC 10
  loose_price DECIMAL(12,2),
  cib_price DECIMAL(12,2),
  new_price DECIMAL(12,2),
  graded_price DECIMAL(12,2),
  box_only_price DECIMAL(12,2),
  manual_only_price DECIMAL(12,2),
  bgs_10_price DECIMAL(12,2),
  condition_17_price DECIMAL(12,2),
  condition_18_price DECIMAL(12,2),

  sales_volume INTEGER,                    -- Yearly sales count (match-confidence signal)
  genre TEXT,
  upc TEXT,
  release_date TEXT,

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family lookup: all parallels of a base card
CREATE INDEX IF NOT EXISTS idx_sports_products_set_number ON sports_card_products(set_uid, card_number);
-- Fuzzy player search
CREATE INDEX IF NOT EXISTS idx_sports_products_player_trgm ON sports_card_products USING gin (player_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sports_products_name_trgm ON sports_card_products USING gin (product_name gin_trgm_ops);
-- Serial auto-disambiguation
CREATE INDEX IF NOT EXISTS idx_sports_products_serial ON sports_card_products(set_uid, serial_denominator) WHERE serial_denominator IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sports_products_console_name ON sports_card_products(console_name);

-- ============================================================================
-- 3. IMPORT TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS sports_import_log (
  id SERIAL PRIMARY KEY,
  import_type TEXT NOT NULL,               -- "full", "incremental", "sets_only"
  sets_imported INTEGER DEFAULT 0,
  products_imported INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',           -- "running", "completed", "failed"
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================
-- Reference data: public read (powers /sports-database), service-role write.

ALTER TABLE sports_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_card_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_import_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON sports_sets;
CREATE POLICY "Public read access" ON sports_sets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access" ON sports_card_products;
CREATE POLICY "Public read access" ON sports_card_products FOR SELECT USING (true);

-- Import log is internal only (no public policy = service role only)

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE sports_sets IS 'SportsCardsPro sets (consoles), parsed sport/year/manufacturer for browse filters';
COMMENT ON TABLE sports_card_products IS 'SportsCardsPro products incl. all parallels; identity + pricing source for sports cards';
COMMENT ON TABLE sports_import_log IS 'Tracks CSV imports from SportsCardsPro';
