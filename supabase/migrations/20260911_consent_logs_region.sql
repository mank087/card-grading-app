-- 2026-09-11: record which consent regime produced each decision.
-- region: eu | us | other | unknown (bucket stamped by middleware, never the raw country)
-- mode:   strict | us-optout
alter table public.consent_logs
  add column if not exists region text,
  add column if not exists mode text;
