-- Market Price Database Migration
-- Add market price fields to the cards table

-- Market price fields
ALTER TABLE cards ADD COLUMN IF NOT EXISTS market_price DECIMAL(10,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS market_price_low DECIMAL(10,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS market_price_high DECIMAL(10,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS market_price_source TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS market_price_updated TIMESTAMP;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS market_price_confidence TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgplayer_url TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS ebay_url TEXT;

-- Add comments for clarity
COMMENT ON COLUMN cards.market_price IS 'Current market price for the card in USD';
COMMENT ON COLUMN cards.market_price_low IS 'Low market price range in USD';
COMMENT ON COLUMN cards.market_price_high IS 'High market price range in USD';
COMMENT ON COLUMN cards.market_price_source IS 'Source of price data: tcgplayer, cardmarket, estimated';
COMMENT ON COLUMN cards.market_price_updated IS 'Timestamp when price data was last updated';
COMMENT ON COLUMN cards.market_price_confidence IS 'Confidence level: high, medium, low';
COMMENT ON COLUMN cards.tcgplayer_url IS 'Direct link to card on TCGPlayer website';
COMMENT ON COLUMN cards.ebay_url IS 'Direct search link for card on eBay marketplace';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cards_market_price ON cards(market_price);
CREATE INDEX IF NOT EXISTS idx_cards_market_price_source ON cards(market_price_source);
CREATE INDEX IF NOT EXISTS idx_cards_market_price_updated ON cards(market_price_updated);

-- Verify the new columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cards'
AND column_name IN (
  'market_price', 'market_price_low', 'market_price_high',
  'market_price_source', 'market_price_updated', 'market_price_confidence',
  'tcgplayer_url', 'ebay_url'
)
ORDER BY column_name;