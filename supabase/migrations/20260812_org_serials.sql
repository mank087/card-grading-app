-- Org-specific serial numbers (enterprise Phase 2A follow-up).
--
-- Every card keeps its global DCM serial (cards.serial) as the backbone for
-- pop reports, QR codes, and admin cross-reference. Org-graded cards
-- additionally get a per-org sequential serial, displayed with the org's
-- prefix (e.g. MFG-000042) on their labels and storefront pages.

alter table organizations add column if not exists serial_prefix text;
alter table organizations add column if not exists org_serial_seq integer not null default 0;

comment on column organizations.serial_prefix is
  'Short uppercase prefix for org serial display (e.g. MFG). Null = derived from the org name at display time.';

alter table cards add column if not exists org_serial integer;
alter table cards add column if not exists org_serial_display text;

comment on column cards.org_serial is
  'Per-org sequential serial number, assigned when the card is stamped as org-graded. Unique within the org.';
comment on column cards.org_serial_display is
  'Formatted org serial as shown on labels/storefront (e.g. MFG-000042). Denormalized so label generation needs no org join.';

create unique index if not exists idx_cards_org_serial
  on cards (org_id, org_serial) where org_serial is not null;

create index if not exists idx_cards_org_serial_display
  on cards (org_serial_display) where org_serial_display is not null;

-- Atomic per-org counter increment (mirrors org_deduct_credit's RPC pattern).
create or replace function org_next_serial(p_org_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update organizations
     set org_serial_seq = org_serial_seq + 1
   where id = p_org_id
  returning org_serial_seq;
$$;

revoke execute on function org_next_serial(uuid) from public, anon, authenticated;
grant execute on function org_next_serial(uuid) to service_role;
