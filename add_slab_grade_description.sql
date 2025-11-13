-- Add slab_grade_description column to cards table
-- This stores the grade description like "Gem Mint", "Mint", "Pristine", etc.

ALTER TABLE cards
ADD COLUMN IF NOT EXISTS slab_grade_description TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN cards.slab_grade_description IS 'Grade description from professional slab (e.g., "Gem Mint", "Mint", "Pristine")';
