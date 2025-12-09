-- Migration: Add label_data column to cards table
-- Purpose: Store pre-generated label data for consistent display across all contexts
-- Date: 2024-12-09

-- Add label_data JSONB column to store standardized label information
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS label_data JSONB;

-- Add comment explaining the column
COMMENT ON COLUMN cards.label_data IS 'Pre-generated label data for consistent display. Contains: primaryName, setName, subset, cardNumber, year, contextLine, features, featuresLine, serial, grade, gradeFormatted, condition, category, isAlteredAuthentic';

-- Create index for potential queries on label data
CREATE INDEX IF NOT EXISTS idx_cards_label_data ON cards USING GIN (label_data);

-- Example label_data structure:
-- {
--   "primaryName": "LeBron James",
--   "setName": "Panini Prizm",
--   "subset": "Bomb Squad",
--   "cardNumber": "BS-23",
--   "year": "2023",
--   "contextLine": "Panini Prizm • Bomb Squad • #BS-23 • 2023",
--   "features": ["RC", "Auto", "/99"],
--   "featuresLine": "RC • Auto • /99",
--   "serial": "DCM-ABC12345",
--   "grade": 9.5,
--   "gradeFormatted": "9.5",
--   "condition": "Gem Mint",
--   "category": "Sports",
--   "isAlteredAuthentic": false
-- }
