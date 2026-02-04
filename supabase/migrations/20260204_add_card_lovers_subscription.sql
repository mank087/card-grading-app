-- Card Lovers Subscription Migration
-- Created: 2026-02-04
-- Description: Add Card Lovers subscription fields to user_credits table
--              and create subscription_events audit table

-- Add Card Lovers fields to user_credits table
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS is_card_lover BOOLEAN DEFAULT FALSE;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS card_lover_subscribed_at TIMESTAMPTZ;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS card_lover_current_period_end TIMESTAMPTZ;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS card_lover_subscription_id TEXT;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS card_lover_plan TEXT; -- 'monthly' or 'annual'
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS card_lover_months_active INTEGER DEFAULT 0;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS show_card_lover_badge BOOLEAN DEFAULT TRUE;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS preferred_label_emblem TEXT DEFAULT 'auto';
-- Values for preferred_label_emblem: 'founder', 'card_lover', 'none', 'auto'

-- Create subscription_events table for audit trail
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  -- Values: 'subscribed', 'renewed', 'cancelled', 'upgraded', 'loyalty_bonus', 'payment_failed'
  plan TEXT, -- 'monthly' or 'annual'
  credits_added INTEGER DEFAULT 0,
  bonus_credits INTEGER DEFAULT 0,
  stripe_subscription_id TEXT,
  stripe_invoice_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for subscription_events
CREATE INDEX IF NOT EXISTS idx_subscription_events_user ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created ON subscription_events(created_at DESC);

-- Enable RLS on subscription_events
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own subscription events
CREATE POLICY "Users can view own subscription events"
  ON subscription_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert subscription events (for webhooks)
CREATE POLICY "Service role can manage subscription events"
  ON subscription_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE subscription_events IS 'Audit trail for Card Lovers subscription lifecycle events';
COMMENT ON COLUMN user_credits.is_card_lover IS 'Whether user has active Card Lovers subscription';
COMMENT ON COLUMN user_credits.card_lover_plan IS 'Subscription plan: monthly or annual';
COMMENT ON COLUMN user_credits.card_lover_months_active IS 'Consecutive months subscribed (for loyalty bonuses)';
COMMENT ON COLUMN user_credits.preferred_label_emblem IS 'User preference for label emblem: founder, card_lover, none, or auto';
