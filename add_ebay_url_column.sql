-- Add eBay URL column to cards table
ALTER TABLE cards ADD COLUMN IF NOT EXISTS ebay_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN cards.ebay_url IS 'Direct link to card search results on eBay';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cards'
AND column_name = 'ebay_url';