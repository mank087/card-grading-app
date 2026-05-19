-- Migration: stripe_daily_fees storage
-- Purpose: Cache actual Stripe processing fees pulled from the Balance
--          Transactions API (stripe.balanceTransactions.list). Replaces the
--          2.9% + $0.30 per charge formula in /admin/costs once populated.
-- Date: 2026-05-19

CREATE TABLE IF NOT EXISTS public.stripe_daily_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,                  -- UTC day this row covers
  fee_usd NUMERIC(10,4) NOT NULL,             -- Sum of Stripe fees for charges that day
  charge_count INTEGER NOT NULL DEFAULT 0,
  gross_revenue_usd NUMERIC(10,4),            -- Sum of charge amounts (gross, before fee)
  refund_count INTEGER NOT NULL DEFAULT 0,    -- For future net-of-refund tracking
  refund_usd NUMERIC(10,4) DEFAULT 0,

  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_daily_fees_date
  ON public.stripe_daily_fees(date DESC);

ALTER TABLE public.stripe_daily_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.stripe_daily_fees;
CREATE POLICY "Service role only" ON public.stripe_daily_fees
  FOR ALL TO service_role USING (true) WITH CHECK (true);
