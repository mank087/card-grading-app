-- MTG Scryfall API Integration Migration
-- Run each statement separately in Supabase SQL Editor if needed
-- Date: 2025-12-02

-- ═══════════════════════════════════════════════════════════════════════
-- PART 1: SCRYFALL API VERIFICATION COLUMNS
-- ═══════════════════════════════════════════════════════════════════════

-- Step 1: Add mtg_api_id column (Scryfall UUID)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS mtg_api_id TEXT;

-- Step 2: Add mtg_oracle_id column (links all printings of same card)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS mtg_oracle_id TEXT;

-- Step 3: Add mtg_api_data column (full Scryfall response as JSONB)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS mtg_api_data JSONB;

-- Step 4: Add mtg_api_verified column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS mtg_api_verified BOOLEAN DEFAULT FALSE;

-- Step 5: Add mtg_api_verified_at column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS mtg_api_verified_at TIMESTAMPTZ;

-- Step 6: Add mtg_api_confidence column (high/medium/low)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS mtg_api_confidence TEXT;

-- Step 7: Add mtg_api_method column (verification method used)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS mtg_api_method TEXT;

-- ═══════════════════════════════════════════════════════════════════════
-- PART 2: MTG-SPECIFIC DISPLAY FIELDS
-- ═══════════════════════════════════════════════════════════════════════

-- Step 8: Add is_foil column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_foil BOOLEAN DEFAULT FALSE;

-- Step 9: Add foil_type column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS foil_type TEXT;

-- Step 10: Add mtg_mana_cost column (e.g., "{2}{U}{U}")
ALTER TABLE cards ADD COLUMN IF NOT EXISTS mtg_mana_cost TEXT;

-- Step 11: Add mtg_type_line column (e.g., "Legendary Creature — Human Wizard")
ALTER TABLE cards ADD COLUMN IF NOT EXISTS mtg_type_line TEXT;

-- Step 12: Add mtg_colors column (array of color codes)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS mtg_colors TEXT[];

-- Step 13: Add mtg_rarity column (mythic, rare, uncommon, common)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS mtg_rarity TEXT;

-- Step 14: Add mtg_set_code column (3-letter set code)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS mtg_set_code TEXT;

-- Step 15: Add card_language column (English, Japanese, etc.)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_language TEXT DEFAULT 'English';

-- Step 16: Add is_double_faced column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_double_faced BOOLEAN DEFAULT FALSE;

-- ═══════════════════════════════════════════════════════════════════════
-- PART 3: MARKET PRICING FIELDS (from Scryfall daily data)
-- ═══════════════════════════════════════════════════════════════════════

-- Step 17: Add scryfall_price_usd column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS scryfall_price_usd DECIMAL(10,2);

-- Step 18: Add scryfall_price_usd_foil column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS scryfall_price_usd_foil DECIMAL(10,2);

-- Step 19: Add scryfall_price_eur column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS scryfall_price_eur DECIMAL(10,2);

-- Step 20: Add scryfall_price_updated_at column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS scryfall_price_updated_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════════════
-- PART 4: INDEXES FOR EFFICIENT QUERIES
-- ═══════════════════════════════════════════════════════════════════════

-- Index for Scryfall ID lookups
CREATE INDEX IF NOT EXISTS idx_cards_mtg_api_id ON cards(mtg_api_id) WHERE mtg_api_id IS NOT NULL;

-- Index for Oracle ID (linking reprints)
CREATE INDEX IF NOT EXISTS idx_cards_mtg_oracle_id ON cards(mtg_oracle_id) WHERE mtg_oracle_id IS NOT NULL;

-- Index for MTG verified status
CREATE INDEX IF NOT EXISTS idx_cards_mtg_verified ON cards(mtg_api_verified) WHERE category = 'MTG';

-- Index for foil cards
CREATE INDEX IF NOT EXISTS idx_cards_is_foil ON cards(is_foil) WHERE category = 'MTG' AND is_foil = TRUE;

-- Index for MTG set code
CREATE INDEX IF NOT EXISTS idx_cards_mtg_set_code ON cards(mtg_set_code) WHERE mtg_set_code IS NOT NULL;

-- Index for card language
CREATE INDEX IF NOT EXISTS idx_cards_language ON cards(card_language) WHERE card_language IS NOT NULL AND card_language != 'English';

-- ═══════════════════════════════════════════════════════════════════════
-- PART 5: COMMENTS FOR DOCUMENTATION
-- ═══════════════════════════════════════════════════════════════════════

COMMENT ON COLUMN cards.mtg_api_id IS 'Scryfall unique card ID (UUID format)';
COMMENT ON COLUMN cards.mtg_oracle_id IS 'Scryfall Oracle ID - links all printings of same card';
COMMENT ON COLUMN cards.mtg_api_data IS 'Full Scryfall API response stored as JSONB';
COMMENT ON COLUMN cards.mtg_api_verified IS 'Whether card has been verified against Scryfall API';
COMMENT ON COLUMN cards.mtg_api_verified_at IS 'Timestamp of Scryfall verification';
COMMENT ON COLUMN cards.mtg_api_confidence IS 'Verification confidence: high, medium, low';
COMMENT ON COLUMN cards.mtg_api_method IS 'Method used for verification: set_collector_number, fuzzy_name_set, fuzzy_name, advanced_search';
COMMENT ON COLUMN cards.is_foil IS 'Whether card is a foil printing';
COMMENT ON COLUMN cards.foil_type IS 'Type of foil: Traditional, Etched, Galaxy, Surge, Textured, Gilded, Confetti';
COMMENT ON COLUMN cards.mtg_mana_cost IS 'Mana cost in standard notation: {2}{U}{U}';
COMMENT ON COLUMN cards.mtg_type_line IS 'Full type line: Legendary Creature — Human Wizard';
COMMENT ON COLUMN cards.mtg_colors IS 'Array of color codes: W, U, B, R, G';
COMMENT ON COLUMN cards.mtg_rarity IS 'Card rarity: mythic, rare, uncommon, common, special';
COMMENT ON COLUMN cards.mtg_set_code IS '3-letter set code: MKM, OTJ, LEA';
COMMENT ON COLUMN cards.card_language IS 'Card language: English, Japanese, German, etc.';
COMMENT ON COLUMN cards.is_double_faced IS 'Whether card is double-faced (transform, modal DFC, etc.)';
COMMENT ON COLUMN cards.scryfall_price_usd IS 'Scryfall daily price in USD (non-foil)';
COMMENT ON COLUMN cards.scryfall_price_usd_foil IS 'Scryfall daily price in USD (foil)';
COMMENT ON COLUMN cards.scryfall_price_eur IS 'Scryfall daily price in EUR';
COMMENT ON COLUMN cards.scryfall_price_updated_at IS 'When Scryfall pricing was last updated';
