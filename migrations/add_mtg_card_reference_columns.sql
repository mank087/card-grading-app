-- Migration: Add MTG card database reference columns
-- Purpose: Store reference to matched MTG card from internal database for verified card identification
-- Date: 2026-01-23

-- Add columns for MTG database reference
ALTER TABLE cards ADD COLUMN IF NOT EXISTS mtg_card_id UUID;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS mtg_reference_image TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS mtg_database_match_confidence VARCHAR(20);

-- Add index for faster lookups by mtg_card_id
CREATE INDEX IF NOT EXISTS idx_cards_mtg_card_id ON cards(mtg_card_id) WHERE mtg_card_id IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN cards.mtg_card_id IS 'Reference to matched card in mtg_cards table (Scryfall UUID)';
COMMENT ON COLUMN cards.mtg_reference_image IS 'Official card image URL from Scryfall database';
COMMENT ON COLUMN cards.mtg_database_match_confidence IS 'Confidence level of database match: high, medium, low';
