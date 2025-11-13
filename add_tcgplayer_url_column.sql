-- Add TCGPlayer URL column to cards table
ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgplayer_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN cards.tcgplayer_url IS 'Direct link to card on TCGPlayer website';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cards'
AND column_name = 'tcgplayer_url';