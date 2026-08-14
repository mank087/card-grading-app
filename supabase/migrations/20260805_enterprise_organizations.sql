-- Enterprise Phase 1: organizations, members, leads, org credit pool
-- Apply manually in the Supabase SQL Editor (repo convention).
-- Additive only — no existing behavior changes until app code ships.

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_user_id uuid not null references auth.users(id),
  status text not null default 'active' check (status in ('active','suspended','cancelled')),
  -- branding
  logo_path text,
  logo_white_path text,
  logo_black_path text,
  brand_color text default '#7C3AED',
  -- billing: two-bucket model —
  --   monthly_credits: SET to monthly_allotment on every paid invoice (no rollover)
  --   overage_credits: one-time pack purchases + refunds + admin grants; rolls over
  --   grade_credits:   generated total, read-only convenience for display surfaces
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text, -- 'dealer' | 'enterprise' | custom label (e.g. pilot deals)
  monthly_credits int not null default 0 check (monthly_credits >= 0),
  overage_credits int not null default 0 check (overage_credits >= 0),
  grade_credits int generated always as (monthly_credits + overage_credits) stored,
  monthly_allotment int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organization_members (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
-- v1: a user belongs to at most one org
create unique index if not exists organization_members_user_uniq on organization_members(user_id);

create table if not exists enterprise_leads (
  id uuid primary key default gen_random_uuid(),
  store_name text not null,
  contact_name text,
  email text not null,
  monthly_volume text,
  message text,
  status text not null default 'new' check (status in ('new','contacted','converted','closed')),
  created_at timestamptz not null default now()
);

alter table cards add column if not exists org_id uuid references organizations(id);
alter table credit_transactions add column if not exists org_id uuid references organizations(id);

create index if not exists cards_org_id_idx on cards(org_id) where org_id is not null;
create index if not exists credit_transactions_org_id_idx on credit_transactions(org_id) where org_id is not null;

-- Upgrade path: if the ORIGINAL single-pool version of this migration was
-- already applied, "create table if not exists" above was a no-op and the
-- org rows still have a plain grade_credits column. Convert in place: the
-- prior balance was paid for, so it lands in the durable overage bucket.
-- Fresh installs already have the two-bucket columns — this block is a no-op.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organizations' and column_name = 'monthly_credits'
  ) then
    alter table organizations add column monthly_credits int not null default 0 check (monthly_credits >= 0);
    alter table organizations add column overage_credits int not null default 0 check (overage_credits >= 0);
    update organizations set overage_credits = grade_credits;
    alter table organizations drop column grade_credits;
    alter table organizations add column grade_credits int generated always as (monthly_credits + overage_credits) stored;
  end if;
end $$;

-- The old function signatures returned int / took 2 args — drop them so the
-- new definitions below can't collide (42P13) or leave ambiguous overloads.
drop function if exists org_deduct_credit(uuid);
drop function if exists org_add_credits(uuid, int);

-- Atomic pool operations (supabase-js has no compare-and-swap update;
-- the RPC makes "take the last credit" race-safe).

-- Take 1 credit: monthly bucket first, then overage. Returns which bucket paid
-- plus both remaining balances; zero rows when both buckets are empty or the
-- org is not active. Race-safe: a blocked concurrent UPDATE re-evaluates its
-- WHERE clause after the row lock releases, so the last credit is never taken
-- twice.
create or replace function org_deduct_credit(p_org_id uuid)
returns table (bucket text, monthly_credits int, overage_credits int)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update organizations o
      set monthly_credits = o.monthly_credits - 1, updated_at = now()
      where o.id = p_org_id and o.status = 'active' and o.monthly_credits > 0
      returning 'monthly'::text, o.monthly_credits, o.overage_credits;
  if found then return; end if;
  return query
    update organizations o
      set overage_credits = o.overage_credits - 1, updated_at = now()
      where o.id = p_org_id and o.status = 'active' and o.overage_credits > 0
      returning 'overage'::text, o.monthly_credits, o.overage_credits;
end;
$$;

-- Add credits to a chosen bucket (default overage: top-up packs, refunds,
-- admin grants — the durable bucket). Returns the new TOTAL for audit rows.
create or replace function org_add_credits(p_org_id uuid, p_amount int, p_bucket text default 'overage')
returns int
language sql
security definer
set search_path = public
as $$
  update organizations
  set monthly_credits = monthly_credits + case when p_bucket = 'monthly' then p_amount else 0 end,
      overage_credits = overage_credits + case when p_bucket = 'overage' then p_amount else 0 end,
      updated_at = now()
  where id = p_org_id
  returning monthly_credits + overage_credits;
$$;

-- Billing-cycle reset: SET the monthly bucket to the allotment (never touches
-- overage). The app also dedupes on invoice id so a late webhook replay can't
-- re-fill a partially-used cycle.
create or replace function org_reset_monthly_credits(p_org_id uuid, p_amount int)
returns int
language sql
security definer
set search_path = public
as $$
  update organizations
  set monthly_credits = greatest(p_amount, 0), updated_at = now()
  where id = p_org_id
  returning monthly_credits + overage_credits;
$$;

revoke execute on function org_deduct_credit(uuid) from public, anon, authenticated;
revoke execute on function org_add_credits(uuid, int, text) from public, anon, authenticated;
revoke execute on function org_reset_monthly_credits(uuid, int) from public, anon, authenticated;

-- RLS: service role (API routes) bypasses; members may read their own org.
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table enterprise_leads enable row level security;

drop policy if exists org_member_read on organizations;
create policy org_member_read on organizations for select
  using (id in (select org_id from organization_members where user_id = auth.uid()));
drop policy if exists org_membership_read_own on organization_members;
create policy org_membership_read_own on organization_members for select
  using (user_id = auth.uid());
-- enterprise_leads: no client policies — service role only.

-- Private bucket for org logos (original + derived white/black variants).
insert into storage.buckets (id, name, public)
values ('org-assets', 'org-assets', false)
on conflict (id) do nothing;