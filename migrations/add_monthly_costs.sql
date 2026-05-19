-- Migration: Fixed/recurring vendor costs tracking
-- Purpose: Manual entry of monthly subscriptions (Vercel, Supabase, Resend,
--          Sentry, Apple Developer, etc.) and one-time capital costs so the
--          /admin/costs dashboard can compute total monthly burn alongside
--          auto-pulled variable costs (OpenAI + Stripe + IAP fees).
-- Date: 2026-05-19
--
-- Rows are not deleted when a vendor's price changes — the row's
-- effective_to is set instead and a new row with effective_from is added.
-- This keeps historical months accurate.

CREATE TABLE IF NOT EXISTS public.monthly_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  vendor TEXT NOT NULL,                       -- "Vercel", "Supabase", "Resend", etc.
  category TEXT NOT NULL CHECK (category IN (
    'hosting',
    'database',
    'email',
    'monitoring',
    'dev_tools',
    'legal',
    'marketing',
    'apple_dev',
    'google_dev',
    'domain',
    'ai_apis',
    'other'
  )),

  amount_usd NUMERIC(10,2) NOT NULL,
  cost_type TEXT NOT NULL DEFAULT 'recurring' CHECK (cost_type IN ('recurring', 'one_time')),

  -- Effective range. effective_to NULL means "still active".
  -- For one-time costs, effective_to is typically the same month as effective_from.
  effective_from DATE NOT NULL,
  effective_to DATE,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lookup pattern: "what costs were active in month M?"
-- WHERE effective_from <= last_day_of_month AND (effective_to IS NULL OR effective_to >= first_day_of_month)
CREATE INDEX IF NOT EXISTS idx_monthly_costs_effective
  ON public.monthly_costs (effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_monthly_costs_vendor
  ON public.monthly_costs (vendor);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_monthly_costs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_monthly_costs_updated_at ON public.monthly_costs;
CREATE TRIGGER trg_monthly_costs_updated_at
  BEFORE UPDATE ON public.monthly_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_monthly_costs_updated_at();

-- Service role only — admin endpoints use supabaseAdmin which uses service role.
ALTER TABLE public.monthly_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.monthly_costs;
CREATE POLICY "Service role only" ON public.monthly_costs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
