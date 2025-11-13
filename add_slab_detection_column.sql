-- Add conversational_slab_detection column for v4.0 JSON mode
-- Stores professional slab detection data (PSA, BGS, SGC, CGC)

ALTER TABLE cards
ADD COLUMN IF NOT EXISTS conversational_slab_detection JSONB;

-- Add comment for documentation
COMMENT ON COLUMN cards.conversational_slab_detection IS 'v4.0 JSON: Professional slab detection (PSA/BGS/SGC/CGC). Stores detected company, grade, cert number, and sub-grades.';

-- Verify column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cards'
AND column_name = 'conversational_slab_detection';
