-- Migration: admin_settings key/value store
-- Purpose: Tiny generic K/V table for one-off admin config values that don't
--          warrant their own schema. v1 use: cash_on_hand for the runway widget.
-- Date: 2026-05-19

CREATE TABLE IF NOT EXISTS public.admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_admin_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_admin_settings_updated_at ON public.admin_settings;
CREATE TRIGGER trg_admin_settings_updated_at
  BEFORE UPDATE ON public.admin_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_admin_settings_updated_at();

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only" ON public.admin_settings;
CREATE POLICY "Service role only" ON public.admin_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
