-- ============================================================================
-- DCM Grading Affiliate Program
-- Migration: Add affiliates, affiliate_commissions, and affiliate_clicks tables
-- ============================================================================

-- Affiliates table: Stores partner/affiliate information
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  stripe_promotion_code_id TEXT,
  stripe_coupon_id TEXT,
  commission_rate DECIMAL DEFAULT 0.20,
  commission_type TEXT DEFAULT 'percentage',
  flat_commission_amount DECIMAL,
  status TEXT DEFAULT 'active',
  payout_method TEXT DEFAULT 'manual',
  payout_details TEXT,
  minimum_payout DECIMAL DEFAULT 20.00,
  attribution_window_days INTEGER DEFAULT 30,
  total_referrals INTEGER DEFAULT 0,
  total_commission_earned DECIMAL DEFAULT 0,
  total_commission_paid DECIMAL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(code);
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);

-- Affiliate commissions table: Tracks each commission event
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id),
  referred_user_id UUID REFERENCES auth.users(id),
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  order_amount DECIMAL NOT NULL,
  net_amount DECIMAL NOT NULL,
  commission_rate DECIMAL NOT NULL,
  commission_amount DECIMAL NOT NULL,
  status TEXT DEFAULT 'pending',
  hold_until TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payout_reference TEXT,
  reversal_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commissions_affiliate ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON affiliate_commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_stripe_session ON affiliate_commissions(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_commissions_hold ON affiliate_commissions(status, hold_until)
  WHERE status = 'pending';

-- Affiliate clicks table: Tracks referral link clicks
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id),
  ip_hash TEXT,
  user_agent TEXT,
  landing_page TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clicks_affiliate ON affiliate_clicks(affiliate_id, created_at DESC);

-- Enable Row Level Security on all tables
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so API routes using supabaseAdmin work automatically
-- No user-facing RLS policies needed since all access is through authenticated API routes
