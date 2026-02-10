-- DCM Price Estimate Fields
-- Created: February 6, 2026
-- Purpose: Store SportsCardsPro-based DCM price estimates for sports cards

-- =============================================================================
-- Add DCM price fields to cards table
-- =============================================================================

-- DCM estimated value (the primary display value, calculated using multiplier)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dcm_price_estimate DECIMAL(10,2);

-- Raw card price from SportsCardsPro
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dcm_price_raw DECIMAL(10,2);

-- Highest graded price from SportsCardsPro (across all grading companies)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dcm_price_graded_high DECIMAL(10,2);

-- Median price across all available prices
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dcm_price_median DECIMAL(10,2);

-- Average price across all available prices
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dcm_price_average DECIMAL(10,2);

-- When the DCM price was last updated
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dcm_price_updated_at TIMESTAMPTZ;

-- Match confidence from SportsCardsPro search ('high', 'medium', 'low', 'none')
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dcm_price_match_confidence TEXT;

-- SportsCardsPro product ID (for faster refresh without re-searching)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dcm_price_product_id TEXT;

-- SportsCardsPro product name (for display/verification)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dcm_price_product_name TEXT;

-- =============================================================================
-- Create index for efficient queries on collection page
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_cards_dcm_price_estimate ON cards(dcm_price_estimate) WHERE dcm_price_estimate IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cards_dcm_price_updated_at ON cards(dcm_price_updated_at) WHERE dcm_price_updated_at IS NOT NULL;

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON COLUMN cards.dcm_price_estimate IS 'DCM estimated value calculated from SportsCardsPro data using multiplier formula';
COMMENT ON COLUMN cards.dcm_price_raw IS 'Raw/ungraded card price from SportsCardsPro';
COMMENT ON COLUMN cards.dcm_price_graded_high IS 'Highest graded price across all grading companies';
COMMENT ON COLUMN cards.dcm_price_median IS 'Median price across all available price points';
COMMENT ON COLUMN cards.dcm_price_average IS 'Average price across all available price points';
COMMENT ON COLUMN cards.dcm_price_updated_at IS 'Timestamp of last DCM price update';
COMMENT ON COLUMN cards.dcm_price_match_confidence IS 'SportsCardsPro match confidence: high, medium, low, none';
COMMENT ON COLUMN cards.dcm_price_product_id IS 'SportsCardsPro product ID for direct refresh';
COMMENT ON COLUMN cards.dcm_price_product_name IS 'Matched product name from SportsCardsPro';
