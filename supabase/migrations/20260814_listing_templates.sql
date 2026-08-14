-- eBay listing templates & defaults (customer-requested):
--   - shipping/returns defaults saved once, applied to every listing
--   - description template with {mergeField} tokens
--   - optional branded "why buy" trust slide in the photo set
-- One row per personal user (org_id null) and one per org (owner-managed;
-- used when listing org-graded cards). Service-role only; the API mediates.
-- Apply manually in the Supabase SQL Editor.

create table if not exists listing_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  description_template text,          -- null = standard generated layout
  shipping_defaults jsonb,            -- shipping/returns form values
  include_trust_slide boolean not null default false,
  updated_at timestamptz not null default now(),
  check (user_id is not null or org_id is not null)
);

create unique index if not exists listing_templates_user_uniq
  on listing_templates(user_id) where org_id is null;
create unique index if not exists listing_templates_org_uniq
  on listing_templates(org_id) where org_id is not null;

alter table listing_templates enable row level security;
-- No client policies: all access goes through the service-role API.
