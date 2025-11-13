-- Add conversational grading field to cards table
-- Date: 2025-10-20
-- Purpose: Store experimental markdown-formatted grading reports alongside JSON grading

-- Add conversational_grading column to store markdown reports
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS conversational_grading TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN cards.conversational_grading IS 'Experimental: Markdown-formatted conversational grading report (parallel to dvg_grading JSON)';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cards' AND column_name = 'conversational_grading';
