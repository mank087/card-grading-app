-- eBay Disclaimer Acceptance Tracking
-- Created: January 16, 2026
-- Purpose: Track when users accept the eBay listing disclaimer

-- Add disclaimer acceptance fields to ebay_connections
ALTER TABLE ebay_connections
ADD COLUMN IF NOT EXISTS disclaimer_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS disclaimer_version TEXT;

-- Comment on new columns
COMMENT ON COLUMN ebay_connections.disclaimer_accepted_at IS 'Timestamp when user accepted the eBay listing disclaimer';
COMMENT ON COLUMN ebay_connections.disclaimer_version IS 'Version of the disclaimer that was accepted (for re-acceptance if terms change)';
