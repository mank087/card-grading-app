-- Add pricing cache fields for sports cards
-- Caches SportsCardsPro pricing data to reduce API calls
-- Prices are refreshed when stale (>7 days) or on manual refresh

-- Add columns for caching pricing data
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS dcm_cached_prices JSONB,
  ADD COLUMN IF NOT EXISTS dcm_prices_cached_at TIMESTAMPTZ;

-- Add comments explaining the fields
COMMENT ON COLUMN cards.dcm_cached_prices IS 'Cached pricing response from SportsCardsPro API (JSON with prices, product info, etc.)';
COMMENT ON COLUMN cards.dcm_prices_cached_at IS 'Timestamp when pricing data was last fetched from SportsCardsPro';

-- Index for finding cards with stale pricing (for batch refresh jobs if needed)
CREATE INDEX IF NOT EXISTS idx_cards_dcm_prices_cached_at
  ON cards(dcm_prices_cached_at)
  WHERE dcm_prices_cached_at IS NOT NULL;
