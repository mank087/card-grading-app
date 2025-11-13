-- Add structured conversational AI grading fields
-- Purpose: Store parsed conversational AI data for use as primary grading source
-- Date: October 21, 2025

-- Conversational AI grade values
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_decimal_grade DECIMAL(4,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_whole_grade INTEGER;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_grade_uncertainty TEXT;

-- Conversational AI sub-scores (JSONB for flexibility)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_sub_scores JSONB;
-- Structure: { centering: {front: 9.5, back: 9.3, weighted: 9.4}, corners: {...}, edges: {...}, surface: {...} }

-- Conversational AI weighted summary (JSONB)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_weighted_summary JSONB;
-- Structure: { front_weight: 0.55, back_weight: 0.45, weighted_total: 9.3, grade_cap_reason: null }

-- Add comments for clarity
COMMENT ON COLUMN cards.conversational_decimal_grade IS 'Conversational AI decimal grade (1.0-10.0) - PRIMARY GRADE';
COMMENT ON COLUMN cards.conversational_whole_grade IS 'Conversational AI whole number grade (1-10)';
COMMENT ON COLUMN cards.conversational_grade_uncertainty IS 'Grade uncertainty: ±0.1, ±0.5, etc.';
COMMENT ON COLUMN cards.conversational_sub_scores IS 'Conversational AI sub-scores: centering, corners, edges, surface (front, back, weighted)';
COMMENT ON COLUMN cards.conversational_weighted_summary IS 'Conversational AI weighted summary data';

-- Create indexes for sorting/filtering
CREATE INDEX IF NOT EXISTS idx_cards_conversational_decimal_grade ON cards(conversational_decimal_grade);
CREATE INDEX IF NOT EXISTS idx_cards_conversational_sub_scores ON cards USING GIN (conversational_sub_scores);

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cards'
  AND column_name IN (
    'conversational_decimal_grade',
    'conversational_whole_grade',
    'conversational_grade_uncertainty',
    'conversational_sub_scores',
    'conversational_weighted_summary'
  )
ORDER BY column_name;
