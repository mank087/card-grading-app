-- 2026-09-11: queue of purchases to report server-side to Google Ads and
-- Microsoft Advertising using the first-party click ID stored on the
-- buyer's profile (profiles.ad_click_ids). Rows are only ever created for
-- users whose stored consent is 'granted' and are re-checked at send time.
create table if not exists public.ad_conversion_uploads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null,
  platform text not null check (platform in ('google', 'microsoft')),
  source text not null check (source in ('stripe', 'apple', 'google_play')),
  event_id text not null,
  click_id text not null,
  click_id_kind text not null check (click_id_kind in ('gclid', 'gbraid', 'wbraid', 'msclkid')),
  value numeric(10,2) not null,
  currency text not null default 'USD',
  occurred_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  attempts int not null default 0,
  error text,
  sent_at timestamptz
);

create unique index if not exists ad_conversion_uploads_platform_event_idx
  on public.ad_conversion_uploads (platform, event_id);
create index if not exists ad_conversion_uploads_status_idx
  on public.ad_conversion_uploads (status, occurred_at);

alter table public.ad_conversion_uploads enable row level security;
-- Service role only; no user-facing policies.
