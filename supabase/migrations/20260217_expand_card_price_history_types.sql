-- Expand card_type CHECK constraint to include MTG and Lorcana
-- Previously only allowed: 'sports', 'pokemon', 'other'
-- MTG and Lorcana cards were silently failing on INSERT

ALTER TABLE card_price_history
  DROP CONSTRAINT card_price_history_card_type_check;

ALTER TABLE card_price_history
  ADD CONSTRAINT card_price_history_card_type_check
  CHECK (card_type IN ('sports', 'pokemon', 'mtg', 'lorcana', 'other'));

-- Add DCM/PriceCharting estimate column for more accurate price tracking
-- PriceCharting prices are based on actual completed sales and are more reliable
-- than eBay active listing prices for trend analysis
ALTER TABLE card_price_history
  ADD COLUMN IF NOT EXISTS dcm_price_estimate DECIMAL(10, 2);

COMMENT ON COLUMN card_price_history.dcm_price_estimate IS 'PriceCharting/DCM estimated value at time of snapshot - preferred for trend analysis';
