-- Self-serve enterprise onboarding: applications create orgs in 'pending'
-- status (invisible publicly, can't grade or subscribe) until an admin
-- approves them. Apply manually in the Supabase SQL Editor.

-- Widen the status check to include 'pending'. The inline constraint from the
-- original create table is named organizations_status_check by convention.
alter table organizations drop constraint if exists organizations_status_check;
alter table organizations add constraint organizations_status_check
  check (status in ('pending', 'active', 'suspended', 'cancelled'));

-- Application answers that don't have first-class columns (estimated volume,
-- tier intent, contact phone, etc.) — kept for the admin review card.
alter table organizations add column if not exists application jsonb;

-- ToS acceptance at application time (self-serve orgs; admin-created orgs
-- accept during manual onboarding and may leave this null).
alter table organizations add column if not exists tos_accepted_at timestamptz;
