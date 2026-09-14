-- ============================================================================
-- DCM Grading Affiliate Program: cash commissions -> grading credit rewards
-- ============================================================================
-- Model change (2026-09-15):
--   Before: an affiliate earned a cash commission (20% of net) that accrued
--           through pending -> approved -> paid and was paid out by hand.
--   After:  an approved affiliate gets a unique promo code that gives NEW
--           customers a percentage off their FIRST purchase (default 15%), and
--           the affiliate is granted grading credits (default 20) the first
--           time a referred user makes a paid purchase. Credits land instantly
--           in the affiliate's own account, so the commission row is written
--           with commission_amount 0, reward_credits set, and status 'paid'.
--
--   The cash columns are left in place: historical commissions still need to
--   render in the admin console, and the approve / mark-paid admin flows stay
--   compiled against them. New rows simply carry commission_amount 0.
--
--   Web checkout only. iOS StoreKit purchases never reach the Stripe webhook,
--   so they cannot trigger a referral reward.
--
-- Safe to re-run. Apply by hand from the Supabase SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- affiliates: per-affiliate reward size and buyer discount
-- ----------------------------------------------------------------------------
ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS reward_credits INTEGER NOT NULL DEFAULT 20;

ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS discount_percent INTEGER NOT NULL DEFAULT 15;

COMMENT ON COLUMN affiliates.reward_credits IS
  'Grading credits granted to this affiliate the first time a referred user pays.';
COMMENT ON COLUMN affiliates.discount_percent IS
  'Percent off the referred customer gets on their first purchase via the Stripe promo code.';

-- ----------------------------------------------------------------------------
-- affiliate_commissions: what was rewarded and where the credits landed
-- referred_user_id already exists from 20260211_add_affiliate_program.sql,
-- so only the two reward columns are new.
-- ----------------------------------------------------------------------------
ALTER TABLE affiliate_commissions
  ADD COLUMN IF NOT EXISTS reward_credits INTEGER NOT NULL DEFAULT 0;

ALTER TABLE affiliate_commissions
  ADD COLUMN IF NOT EXISTS credit_transaction_id UUID;

-- Defensive: harmless no-op on a database that already has it (the 20260211
-- migration creates referred_user_id), present so a fresh environment that
-- somehow lacks the column still gets it.
ALTER TABLE affiliate_commissions
  ADD COLUMN IF NOT EXISTS referred_user_id UUID;

COMMENT ON COLUMN affiliate_commissions.reward_credits IS
  'Grading credits granted for this referral (0 for legacy cash commissions).';
COMMENT ON COLUMN affiliate_commissions.credit_transaction_id IS
  'credit_transactions.id of the reward grant, so a reversal can be traced.';

-- ----------------------------------------------------------------------------
-- credit_transactions: two new ledger types for the reward and its clawback
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname = 'credit_transactions'
    AND n.nspname = 'public'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%type%IN%'
  LIMIT 1;

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.credit_transactions DROP CONSTRAINT %I', con_name);
  END IF;

  -- NOT VALID adds the rule for new rows without scanning the table under an
  -- exclusive lock; the VALIDATE below scans with a lock that still allows
  -- reads and writes. Production holds exactly the six legacy types (checked
  -- 2026-09-14: purchase, bonus, grade, regrade, refund, admin_adjustment,
  -- 51,801 rows in total), so validation succeeds.
  ALTER TABLE public.credit_transactions
    ADD CONSTRAINT credit_transactions_type_check
    CHECK (type IN (
      'purchase',
      'bonus',
      'grade',
      'regrade',
      'refund',
      'admin_adjustment',
      'referral_reward',
      'referral_reward_reversal'
    )) NOT VALID;
END $$;

ALTER TABLE public.credit_transactions VALIDATE CONSTRAINT credit_transactions_type_check;

-- ----------------------------------------------------------------------------
-- affiliate_applications: the public "become an affiliate" form
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS affiliate_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  channel TEXT,
  channel_url TEXT,
  audience_size TEXT,
  promotion_plan TEXT,
  payout_note TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'approved', 'declined')),
  admin_notes TEXT,
  affiliate_id UUID REFERENCES affiliates(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_applications_status
  ON affiliate_applications(status, created_at DESC);

ALTER TABLE affiliate_applications ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so API routes using supabaseAdmin work
-- automatically. No user-facing RLS policies needed since all access is
-- through authenticated API routes, exactly as the 20260211 affiliate
-- migration states for affiliates / affiliate_commissions / affiliate_clicks.
