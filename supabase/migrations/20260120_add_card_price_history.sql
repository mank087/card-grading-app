-- Card Price History Table
-- Stores weekly snapshots of eBay active listing prices for cards
-- Used for tracking price trends over time

CREATE TABLE IF NOT EXISTS card_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to the card (supports both sports and pokemon cards)
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,

  -- Card type for easier querying
  card_type TEXT NOT NULL CHECK (card_type IN ('sports', 'pokemon', 'other')),

  -- Timestamp of when this price snapshot was recorded
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Price statistics from eBay active listings
  lowest_price DECIMAL(10, 2),
  median_price DECIMAL(10, 2),
  highest_price DECIMAL(10, 2),
  average_price DECIMAL(10, 2),

  -- Number of active listings found
  listing_count INTEGER NOT NULL DEFAULT 0,

  -- The search query and strategy used
  query_used TEXT,
  query_strategy TEXT CHECK (query_strategy IN ('specific', 'moderate', 'broad', 'minimal', 'custom')),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Index for efficient lookups by card and time
  CONSTRAINT unique_card_weekly_snapshot UNIQUE (card_id, recorded_at)
);

-- Index for querying price history by card
CREATE INDEX idx_card_price_history_card_id ON card_price_history(card_id);

-- Index for querying by recorded date (for batch job tracking)
CREATE INDEX idx_card_price_history_recorded_at ON card_price_history(recorded_at);

-- Index for querying by card type
CREATE INDEX idx_card_price_history_card_type ON card_price_history(card_type);

-- Composite index for common query pattern: get latest prices for a card
CREATE INDEX idx_card_price_history_card_latest ON card_price_history(card_id, recorded_at DESC);

-- RLS Policies
ALTER TABLE card_price_history ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read price history (public data)
CREATE POLICY "Anyone can read price history"
  ON card_price_history
  FOR SELECT
  USING (true);

-- Only service role can insert/update price history (batch job)
CREATE POLICY "Service role can insert price history"
  ON card_price_history
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update price history"
  ON card_price_history
  FOR UPDATE
  USING (true);

-- Comment on table
COMMENT ON TABLE card_price_history IS 'Weekly snapshots of eBay active listing prices for cards, used for tracking market trends';
COMMENT ON COLUMN card_price_history.median_price IS 'Median price is more reliable than average as it is resistant to outliers';
COMMENT ON COLUMN card_price_history.listing_count IS 'Number of active listings found - useful for confidence scoring';
