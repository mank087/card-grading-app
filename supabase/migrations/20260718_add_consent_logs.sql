-- Consent audit log (2026-07-18)
-- Durable server-side record of every cookie-consent decision on dcmgrading.com:
-- explicit banner choices and automatic Global Privacy Control opt-outs.
-- Written only by /api/consent/log via the service-role client.
-- RLS is enabled with NO policies: anon/authenticated clients can neither read
-- nor write; only the service role (which bypasses RLS) can.

create table if not exists public.consent_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  choice text not null check (choice in ('granted', 'essential')),
  source text not null check (source in ('banner', 'gpc')),
  gpc boolean not null default false,
  ip text,
  user_agent text
);

alter table public.consent_logs enable row level security;

create index if not exists consent_logs_created_at_idx
  on public.consent_logs (created_at desc);
