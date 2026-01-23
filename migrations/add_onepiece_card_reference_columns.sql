-- ============================================================================
-- One Piece Card Reference Columns for Graded Cards
-- ============================================================================
-- This migration adds columns to the cards table for storing verified One Piece
-- card data from our internal database after AI grading and database lookup.
-- ============================================================================

-- One Piece card database ID (links to onepiece_cards.id)
-- Format: "OP01-001" or "OP01-001_parallel" for variants
ALTER TABLE cards ADD COLUMN IF NOT EXISTS onepiece_card_id TEXT;

-- Reference image URL from database (clean image for comparison)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS onepiece_reference_image TEXT;

-- Match confidence level from database lookup
-- Values: 'high', 'medium', 'low'
ALTER TABLE cards ADD COLUMN IF NOT EXISTS onepiece_database_match_confidence VARCHAR(20);

-- ============================================================================
-- One Piece Specific Card Attributes
-- These are extracted from AI grading and verified against our database
-- ============================================================================

-- Card type: Leader, Character, Event, Stage
ALTER TABLE cards ADD COLUMN IF NOT EXISTS op_card_type VARCHAR(20);

-- Card color(s): Red, Blue, Green, Purple, Black, Yellow (or multi-color like "Red/Green")
ALTER TABLE cards ADD COLUMN IF NOT EXISTS op_card_color VARCHAR(50);

-- Power value (Characters and Leaders)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS op_card_power INTEGER;

-- DON!! cost to play
ALTER TABLE cards ADD COLUMN IF NOT EXISTS op_card_cost INTEGER;

-- Life value (Leaders only)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS op_life INTEGER;

-- Counter value: 1000, 2000, or NULL
ALTER TABLE cards ADD COLUMN IF NOT EXISTS op_counter INTEGER;

-- Combat attribute: Slash, Strike, Ranged, Special, Wisdom
ALTER TABLE cards ADD COLUMN IF NOT EXISTS op_attribute VARCHAR(50);

-- Character traits/affiliations (e.g., "Straw Hat Crew", "Supernovas")
ALTER TABLE cards ADD COLUMN IF NOT EXISTS op_sub_types TEXT;

-- Variant type: parallel, manga, parallel_manga, sp, alternate_art, etc.
-- NULL = base/standard version
ALTER TABLE cards ADD COLUMN IF NOT EXISTS op_variant_type VARCHAR(50);

-- ============================================================================
-- Indexes for Efficient Queries
-- ============================================================================

-- Index for looking up by One Piece card reference
CREATE INDEX IF NOT EXISTS idx_cards_onepiece_card_id
ON cards(onepiece_card_id)
WHERE onepiece_card_id IS NOT NULL;

-- Index for filtering by variant type
CREATE INDEX IF NOT EXISTS idx_cards_op_variant_type
ON cards(op_variant_type)
WHERE op_variant_type IS NOT NULL;

-- Index for filtering by card color
CREATE INDEX IF NOT EXISTS idx_cards_op_card_color
ON cards(op_card_color)
WHERE op_card_color IS NOT NULL;

-- Index for filtering by card type
CREATE INDEX IF NOT EXISTS idx_cards_op_card_type
ON cards(op_card_type)
WHERE op_card_type IS NOT NULL;

-- ============================================================================
-- Column Comments
-- ============================================================================

COMMENT ON COLUMN cards.onepiece_card_id IS 'Reference to onepiece_cards.id for verified card data';
COMMENT ON COLUMN cards.onepiece_reference_image IS 'Clean reference image URL from database for comparison';
COMMENT ON COLUMN cards.onepiece_database_match_confidence IS 'Confidence level of database match: high, medium, low';
COMMENT ON COLUMN cards.op_card_type IS 'One Piece card type: Leader, Character, Event, Stage';
COMMENT ON COLUMN cards.op_card_color IS 'Card color(s): Red, Blue, Green, Purple, Black, Yellow';
COMMENT ON COLUMN cards.op_card_power IS 'Power value for Characters and Leaders';
COMMENT ON COLUMN cards.op_card_cost IS 'DON!! cost to play the card';
COMMENT ON COLUMN cards.op_life IS 'Life value (Leaders only)';
COMMENT ON COLUMN cards.op_counter IS 'Counter value: 1000, 2000, or NULL';
COMMENT ON COLUMN cards.op_attribute IS 'Combat attribute: Slash, Strike, Ranged, Special, Wisdom';
COMMENT ON COLUMN cards.op_sub_types IS 'Character traits/affiliations';
COMMENT ON COLUMN cards.op_variant_type IS 'Variant type: parallel, manga, sp, alternate_art, etc. NULL = base';
