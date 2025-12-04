-- =====================================================
-- DCM Grading Credits System - Database Schema
-- Run this in Supabase SQL Editor
-- =====================================================

-- User credits balance table
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  balance INTEGER DEFAULT 0 NOT NULL CHECK (balance >= 0),
  total_purchased INTEGER DEFAULT 0 NOT NULL,
  total_used INTEGER DEFAULT 0 NOT NULL,
  first_purchase_bonus_claimed BOOLEAN DEFAULT FALSE,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit transaction history (audit log)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'bonus', 'grade', 'regrade', 'refund', 'admin_adjustment')),
  amount INTEGER NOT NULL, -- positive for additions, negative for usage
  balance_after INTEGER NOT NULL,
  description TEXT,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_stripe_customer ON user_credits(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_stripe_session ON credit_transactions(stripe_session_id);

-- Enable Row Level Security
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_credits
-- Users can view their own credits
CREATE POLICY "Users can view own credits" ON user_credits
  FOR SELECT USING (auth.uid() = user_id);

-- Service role has full access (for webhooks and admin)
CREATE POLICY "Service role full access to credits" ON user_credits
  FOR ALL USING (true)
  WITH CHECK (true);

-- RLS Policies for credit_transactions
-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role full access to transactions" ON credit_transactions
  FOR ALL USING (true)
  WITH CHECK (true);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_user_credits_updated_at ON user_credits;
CREATE TRIGGER trigger_update_user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_user_credits_updated_at();

-- Function to initialize credits for new users (optional - creates record with 0 credits)
CREATE OR REPLACE FUNCTION initialize_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_credits (user_id, balance, total_purchased, total_used)
  VALUES (NEW.id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create credits record when user signs up
DROP TRIGGER IF EXISTS trigger_initialize_user_credits ON auth.users;
CREATE TRIGGER trigger_initialize_user_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_user_credits();

-- =====================================================
-- Verification Queries (run after creating tables)
-- =====================================================
-- SELECT * FROM user_credits LIMIT 5;
-- SELECT * FROM credit_transactions LIMIT 5;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_credits';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'credit_transactions';
