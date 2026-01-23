-- Migration: Add Lorcana card database reference columns
-- Purpose: Store reference to matched Lorcana card from internal database for verified card identification
-- Date: 2026-01-22

-- Add columns for Lorcana database reference
ALTER TABLE cards ADD COLUMN IF NOT EXISTS lorcana_card_id UUID;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS lorcana_reference_image TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS database_match_confidence VARCHAR(20);

-- Add index for faster lookups by lorcana_card_id
CREATE INDEX IF NOT EXISTS idx_cards_lorcana_card_id ON cards(lorcana_card_id) WHERE lorcana_card_id IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN cards.lorcana_card_id IS 'Reference to matched card in lorcana_cards table (verified identification)';
COMMENT ON COLUMN cards.lorcana_reference_image IS 'Official card image URL from Lorcast database';
COMMENT ON COLUMN cards.database_match_confidence IS 'Confidence level of database match: high, medium, low';
