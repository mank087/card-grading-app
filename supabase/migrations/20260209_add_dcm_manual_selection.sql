-- Add manual parallel selection fields for sports card pricing
-- Allows users to override auto-matched parallel with their own selection

-- Add columns for storing user's manual parallel selection
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS dcm_selected_product_id TEXT,
  ADD COLUMN IF NOT EXISTS dcm_selected_product_name TEXT,
  ADD COLUMN IF NOT EXISTS dcm_selected_at TIMESTAMPTZ;

-- Add comment explaining the fields
COMMENT ON COLUMN cards.dcm_selected_product_id IS 'SportsCardsPro product ID manually selected by user';
COMMENT ON COLUMN cards.dcm_selected_product_name IS 'Product name of manually selected parallel for display';
COMMENT ON COLUMN cards.dcm_selected_at IS 'Timestamp when user made the manual selection';

-- Index for quick lookup of cards with manual selections
CREATE INDEX IF NOT EXISTS idx_cards_dcm_selected_product_id
  ON cards(dcm_selected_product_id)
  WHERE dcm_selected_product_id IS NOT NULL;
