-- Migration: Add front/back image verification tracking fields
-- Created: 2025-11-12
-- Purpose: Track front/back image verification results for fraud detection and analytics

-- Add verification status column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS front_back_verified BOOLEAN DEFAULT NULL;

-- Add verification notes column (stores discrepancies and explanation)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS front_back_verification_notes TEXT DEFAULT NULL;

-- Add verification assessment column (MATCH_CONFIRMED, MISMATCH_DETECTED, UNCERTAIN)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS front_back_verification_assessment VARCHAR(50) DEFAULT NULL;

-- Add verification confidence column (high, medium, low)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS front_back_verification_confidence VARCHAR(20) DEFAULT NULL;

-- Add index for querying mismatched cards
CREATE INDEX IF NOT EXISTS idx_cards_front_back_verified ON cards(front_back_verified);

-- Add index for querying by assessment
CREATE INDEX IF NOT EXISTS idx_cards_verification_assessment ON cards(front_back_verification_assessment);

COMMENT ON COLUMN cards.front_back_verified IS 'Boolean indicating if front/back images were verified as matching (NULL if not checked, TRUE if match, FALSE if mismatch)';
COMMENT ON COLUMN cards.front_back_verification_notes IS 'JSON or text storing discrepancies and explanation from AI verification';
COMMENT ON COLUMN cards.front_back_verification_assessment IS 'Assessment result: MATCH_CONFIRMED, MISMATCH_DETECTED, or UNCERTAIN';
COMMENT ON COLUMN cards.front_back_verification_confidence IS 'AI confidence level: high, medium, or low';
