-- Add founder fields to user_credits table
-- Founders receive 150 credits, 20% off future purchases, and a toggleable badge

-- Add founder columns
ALTER TABLE user_credits
ADD COLUMN IF NOT EXISTS is_founder BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS founder_purchased_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS show_founder_badge BOOLEAN DEFAULT TRUE;

-- Create index for faster founder lookups
CREATE INDEX IF NOT EXISTS user_credits_is_founder_idx ON user_credits(is_founder) WHERE is_founder = TRUE;

-- Comment on columns
COMMENT ON COLUMN user_credits.is_founder IS 'Whether user has purchased the Founders Package';
COMMENT ON COLUMN user_credits.founder_purchased_at IS 'Timestamp when Founders Package was purchased';
COMMENT ON COLUMN user_credits.show_founder_badge IS 'Whether to show founder badge on graded card labels';
