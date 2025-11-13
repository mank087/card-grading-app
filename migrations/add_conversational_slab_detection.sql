-- Migration: Add conversational_slab_detection column for v4.2 conversational grading
-- Date: 2025-11-12
-- Purpose: Store professional grading slab detection from conversational AI in JSONB format

-- Add conversational slab detection field
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_slab_detection JSONB;

-- Add index for querying slab detection
CREATE INDEX IF NOT EXISTS idx_cards_conversational_slab_detection
ON cards ((conversational_slab_detection->>'company'));

-- Comment
COMMENT ON COLUMN cards.conversational_slab_detection IS 'Professional grading slab detection from conversational AI v4.2: {detected, company, grade, grade_description, cert_number, subgrades}';
