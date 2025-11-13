-- Migration: Add v3.8 Weakest Link Scoring Fields
-- Date: 2025-10-28
-- Purpose: Add fields for weighted sub-scores, limiting factor, and preliminary grade

-- Add conversational_weighted_sub_scores JSONB column
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS conversational_weighted_sub_scores JSONB;

COMMENT ON COLUMN cards.conversational_weighted_sub_scores IS
  'v3.8: Weighted sub-scores (front 55% + back 45%) for each category: {centering, corners, edges, surface}';

CREATE INDEX IF NOT EXISTS idx_cards_weighted_sub_scores
ON cards USING GIN (conversational_weighted_sub_scores);

-- Add conversational_limiting_factor TEXT column
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS conversational_limiting_factor TEXT;

COMMENT ON COLUMN cards.conversational_limiting_factor IS
  'v3.8: Which category (centering/corners/edges/surface) determined the final grade (lowest weighted score)';

CREATE INDEX IF NOT EXISTS idx_cards_limiting_factor
ON cards (conversational_limiting_factor);

-- Add conversational_preliminary_grade NUMERIC column
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS conversational_preliminary_grade NUMERIC(3,1);

COMMENT ON COLUMN cards.conversational_preliminary_grade IS
  'v3.8: The grade before caps are applied (minimum of weighted scores)';

CREATE INDEX IF NOT EXISTS idx_cards_preliminary_grade
ON cards (conversational_preliminary_grade);

-- Verify columns were created
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'cards'
  AND column_name IN ('conversational_weighted_sub_scores', 'conversational_limiting_factor', 'conversational_preliminary_grade')
ORDER BY column_name;
