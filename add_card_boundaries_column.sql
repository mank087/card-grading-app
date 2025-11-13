-- Add card_boundaries column to store user-defined corner coordinates
-- This enables precise card boundary detection for accurate centering analysis

ALTER TABLE cards
ADD COLUMN card_boundaries JSONB;

-- Add comment to document the column purpose
COMMENT ON COLUMN cards.card_boundaries IS 'User-defined card boundary corner coordinates for precise centering analysis. Format: {"front": {"corners": [{"x": number, "y": number}, ...], "imageWidth": number, "imageHeight": number, "timestamp": string}, "back": {...}}';

-- Create index for efficient querying (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_cards_card_boundaries ON cards USING GIN (card_boundaries);