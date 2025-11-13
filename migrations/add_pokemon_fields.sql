-- Migration: Add Pokemon-specific fields to cards table
-- Date: 2025-11-04
-- Purpose: Enable Pokemon card grading with conversational v4.2 system

-- Pokemon-specific card information fields
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pokemon_type TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pokemon_stage TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS hp TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_type TEXT;

-- Comments for documentation
COMMENT ON COLUMN cards.pokemon_type IS 'Pokemon type(s) - e.g., Fire, Water, Fire/Flying';
COMMENT ON COLUMN cards.pokemon_stage IS 'Pokemon stage - e.g., Basic, Stage 1, VMAX, GX';
COMMENT ON COLUMN cards.hp IS 'Pokemon hit points - e.g., 120';
COMMENT ON COLUMN cards.card_type IS 'Card type - Pokemon, Trainer, Supporter, or Energy';

-- Ensure conversational grading fields exist (may already exist from sports migration)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_grading TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS rarity_tier TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS serial_number_fraction TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS autograph_type TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS memorabilia_type TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS finish_material TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS rookie_flag BOOLEAN;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS subset_insert_name TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS special_attributes TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS rarity_notes TEXT;

-- Grading metadata fields
ALTER TABLE cards ADD COLUMN IF NOT EXISTS weighted_total_pre_cap NUMERIC;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS capped_grade_reason TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conservative_rounding_applied BOOLEAN DEFAULT FALSE;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS lighting_conditions_notes TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS cross_side_verification_result TEXT;

-- Defect coordinates (JSONB for structured data)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS defect_coordinates_front JSONB DEFAULT '[]'::jsonb;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS defect_coordinates_back JSONB DEFAULT '[]'::jsonb;

-- Create indexes for Pokemon-specific fields (for search/filter performance)
CREATE INDEX IF NOT EXISTS idx_cards_pokemon_type ON cards(pokemon_type);
CREATE INDEX IF NOT EXISTS idx_cards_pokemon_stage ON cards(pokemon_stage);
CREATE INDEX IF NOT EXISTS idx_cards_card_type ON cards(card_type);
CREATE INDEX IF NOT EXISTS idx_cards_rarity_tier ON cards(rarity_tier);

-- Update stats
ANALYZE cards;
