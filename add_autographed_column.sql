-- Add autographed column to cards table
-- This column will store whether a card is autographed (Yes/No)

ALTER TABLE cards ADD COLUMN IF NOT EXISTS autographed TEXT;

-- Add comment for clarity
COMMENT ON COLUMN cards.autographed IS 'Whether the card is autographed: Yes/No';

-- Verify the new column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cards'
AND column_name = 'autographed';