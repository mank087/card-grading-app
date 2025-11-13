-- Add enhanced card detail columns to support new AI output structure
-- These columns will store additional card information from enhanced AI analysis

-- Add memorabilia column (whether card contains memorabilia pieces)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS memorabilia TEXT;

-- Add parallel/insert type column (specific type classification)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS parallel_insert_type TEXT;

-- Add comments for clarity
COMMENT ON COLUMN cards.memorabilia IS 'Whether the card contains memorabilia pieces: Yes/No';
COMMENT ON COLUMN cards.parallel_insert_type IS 'Specific parallel or insert type classification (e.g., Prizm Base, Gold Parallel)';

-- Verify the new columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cards'
AND column_name IN ('memorabilia', 'parallel_insert_type')
ORDER BY column_name;