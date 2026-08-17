-- Narrow what org MEMBERS can read from the organizations table.
-- DO NOT run automatically — apply manually in the Supabase SQL Editor
-- (repo convention; the user pastes migrations by hand).
--
-- Problem: the org_member_read RLS policy (20260805_enterprise_organizations.sql)
-- grants every member SELECT on the WHOLE row, including stripe_customer_id,
-- stripe_subscription_id, and the application jsonb (owner phone/email).
-- RLS is row-level, not column-level, so the narrowing is done with
-- column-level GRANTs: revoke table-wide SELECT from the client roles, then
-- grant SELECT on the safe column list only. The org_member_read policy keeps
-- filtering rows to the member's own org; server API routes use the service
-- role, which bypasses both RLS and these grants, so they are unaffected.
--
-- Safe column list = every organizations column from 20260805 + later ALTERs
-- (20260811_org_storefront, 20260812_org_serials, 20260813_org_brand_colors,
-- 20260813_org_self_serve) EXCEPT stripe_customer_id, stripe_subscription_id,
-- and application.

revoke select on table public.organizations from anon, authenticated;

-- anon gets nothing back: no RLS policy exists for anon anyway, and public
-- storefront pages read via the service role.
grant select (
  id,
  name,
  slug,
  owner_user_id,
  status,
  logo_path,
  logo_white_path,
  logo_black_path,
  brand_color,
  brand_colors,
  plan,
  monthly_credits,
  overage_credits,
  grade_credits,
  monthly_allotment,
  serial_prefix,
  org_serial_seq,
  storefront,
  storefront_enabled,
  tos_accepted_at,
  created_at,
  updated_at
) on public.organizations to authenticated;

-- Note: a client-side `select('*')` on organizations will now error with
-- "permission denied for table organizations" for members; clients must
-- name columns. Today no client-side (anon-key) code reads organizations —
-- every current reader goes through service-role API routes — so nothing
-- member-facing breaks.
