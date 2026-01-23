-- Migration: Fix lorcana_card_id column type
-- Purpose: Lorcast card IDs have format "crd_xxx" which is not valid UUID, change to TEXT
-- Date: 2026-01-22

-- Drop the existing index first
DROP INDEX IF EXISTS idx_cards_lorcana_card_id;

-- Change column type from UUID to TEXT
ALTER TABLE cards ALTER COLUMN lorcana_card_id TYPE TEXT;

-- Recreate the index
CREATE INDEX IF NOT EXISTS idx_cards_lorcana_card_id ON cards(lorcana_card_id) WHERE lorcana_card_id IS NOT NULL;

-- Update comment
COMMENT ON COLUMN cards.lorcana_card_id IS 'Reference to matched card in lorcana_cards table (Lorcast ID format: crd_xxx)';
