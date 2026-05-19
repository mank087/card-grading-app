-- Migration: openai_daily_costs storage
-- Purpose: Cache daily OpenAI API spend pulled from the OpenAI Admin API
--          (/v1/organization/costs). Replaces the token-estimate math in
--          /admin/costs once populated by the nightly sync cron.
-- Date: 2026-05-19

CREATE TABLE IF NOT EXISTS public.openai_daily_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,                  -- UTC day this row covers
  cost_usd NUMERIC(10,4) NOT NULL,            -- Total spend that day (all line items summed)

  -- Optional token detail when the Admin Usage API returns it. Kept for
  -- "cost per token" analytics later; not used by the summary endpoint.
  input_tokens BIGINT,
  output_tokens BIGINT,
  cached_input_tokens BIGINT,

  -- Full raw response payload from the API call for debugging / line-item drill-down.
  raw_payload JSONB,

  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Date is already UNIQUE; explicit index on date for range scans.
CREATE INDEX IF NOT EXISTS idx_openai_daily_costs_date
  ON public.openai_daily_costs(date DESC);

-- Service role only — populated by the sync endpoint via supabaseAdmin.
ALTER TABLE public.openai_daily_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.openai_daily_costs;
CREATE POLICY "Service role only" ON public.openai_daily_costs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
