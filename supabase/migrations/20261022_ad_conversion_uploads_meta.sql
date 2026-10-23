-- 2026-10-22: Meta Conversions API on the server-side conversion queue.
--   - platform 'meta'; click_id_kind 'fbc' | 'fbp'
--   - source 'web' (registrations are not purchases from a store)
--   - event_name: 'purchase' (all existing rows) | 'registration'
-- Apply BEFORE deploying: the cron reads event_name and errors without it
-- (rows stay pending, nothing is lost), and Meta / registration rows fail
-- their insert. Google/Microsoft purchase enqueues work either way.

alter table public.ad_conversion_uploads
  drop constraint if exists ad_conversion_uploads_platform_check;
alter table public.ad_conversion_uploads
  add constraint ad_conversion_uploads_platform_check
  check (platform in ('google', 'microsoft', 'meta'));

alter table public.ad_conversion_uploads
  drop constraint if exists ad_conversion_uploads_source_check;
alter table public.ad_conversion_uploads
  add constraint ad_conversion_uploads_source_check
  check (source in ('stripe', 'apple', 'google_play', 'web'));

alter table public.ad_conversion_uploads
  drop constraint if exists ad_conversion_uploads_click_id_kind_check;
alter table public.ad_conversion_uploads
  add constraint ad_conversion_uploads_click_id_kind_check
  check (click_id_kind in ('gclid', 'gbraid', 'wbraid', 'msclkid', 'fbc', 'fbp'));

alter table public.ad_conversion_uploads
  add column if not exists event_name text not null default 'purchase';
alter table public.ad_conversion_uploads
  drop constraint if exists ad_conversion_uploads_event_name_check;
alter table public.ad_conversion_uploads
  add constraint ad_conversion_uploads_event_name_check
  check (event_name in ('purchase', 'registration'));
