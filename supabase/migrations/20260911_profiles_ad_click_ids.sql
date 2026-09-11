-- 2026-09-11: first-party ad click IDs for server-side conversion reporting.
-- Written only by /api/account/click-ids (service role); the JSON holds
-- gclid / gbraid / wbraid / msclkid plus landing path, capture time, the
-- visitor's consent choice and region bucket at capture time.
alter table public.profiles
  add column if not exists ad_click_ids jsonb,
  add column if not exists ad_click_captured_at timestamptz;

comment on column public.profiles.ad_click_ids is
  'First-party ad click IDs (gclid/gbraid/wbraid/msclkid) with consent + region at capture; consumed by the server-side conversion upload.';
