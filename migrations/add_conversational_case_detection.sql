-- Migration: Add conversational_case_detection column to cards table
-- Date: 2025-10-27
-- Purpose: Store protective case detection info from conversational AI v3.5 PATCHED

-- Add the case detection column (stores JSON object)
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS conversational_case_detection JSONB;

-- Add comment explaining the column
COMMENT ON COLUMN cards.conversational_case_detection IS 'Protective case detection from conversational AI v3.5: {case_type, case_visibility, impact_level, notes}';

-- Create index for faster queries on case_type
CREATE INDEX IF NOT EXISTS idx_cards_case_detection_type
ON cards ((conversational_case_detection->>'case_type'));
