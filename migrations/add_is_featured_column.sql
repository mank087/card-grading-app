-- Add is_featured column to cards table
-- This column will be used to mark cards for display on the home page

ALTER TABLE cards
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- Add index for better query performance when fetching featured cards
CREATE INDEX IF NOT EXISTS idx_cards_is_featured
ON cards(is_featured)
WHERE is_featured = TRUE;

-- Add comment to document the column purpose
COMMENT ON COLUMN cards.is_featured IS 'Marks cards to be displayed in the Featured Cards section on the home page';
