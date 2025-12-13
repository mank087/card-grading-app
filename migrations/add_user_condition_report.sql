-- Migration: Add User Condition Report columns
-- Purpose: Allow users to optionally report card defects that may not be visible in photos
-- Date: 2024-12-13

-- Add user condition report columns to cards table
-- These store the user's optional defect reports and whether they influenced grading

-- Raw user input (preserved for audit trail)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS user_condition_report JSONB DEFAULT NULL;

-- Processed condition report (after sanitization and parsing)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS user_condition_processed JSONB DEFAULT NULL;

-- Quick boolean flag: did user provide any condition notes?
ALTER TABLE cards ADD COLUMN IF NOT EXISTS has_user_condition_report BOOLEAN DEFAULT FALSE;

-- Quick boolean flag: did user notes influence the final grade?
ALTER TABLE cards ADD COLUMN IF NOT EXISTS user_report_influenced_grade BOOLEAN DEFAULT FALSE;

-- AI's response to user hints (which were confirmed, which weren't visible)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS user_condition_ai_response JSONB DEFAULT NULL;

-- Add index for analytics queries (cards with user reports)
CREATE INDEX IF NOT EXISTS idx_cards_has_user_condition_report
ON cards (has_user_condition_report)
WHERE has_user_condition_report = TRUE;

-- Add GIN index for searching within condition report JSON
CREATE INDEX IF NOT EXISTS idx_cards_user_condition_report
ON cards USING GIN (user_condition_report)
WHERE user_condition_report IS NOT NULL;

-- Comment on columns for documentation
COMMENT ON COLUMN cards.user_condition_report IS 'Raw user-submitted condition report (checkboxes + notes) - preserved for audit trail';
COMMENT ON COLUMN cards.user_condition_processed IS 'Processed condition report after sanitization, parsing, and suspicious pattern detection';
COMMENT ON COLUMN cards.has_user_condition_report IS 'Quick flag: did user provide any condition notes for this card?';
COMMENT ON COLUMN cards.user_report_influenced_grade IS 'Did user-reported defects influence the AI grading result?';
COMMENT ON COLUMN cards.user_condition_ai_response IS 'AI response about user hints: which were confirmed, which were not visible';
