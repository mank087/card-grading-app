-- InstaList bulk listing (Part 2, Phase 1): server-side listing drafts.
--
-- One `ebay_bulk_batches` row per "list N cards" run, one `ebay_bulk_items`
-- row per card in it. Deliberately the same shape as submissions /
-- submission_items so the Phase 2 drain can reuse that claim pattern
-- (status + attempts + locked_at), and so a batch survives a tab close.
--
-- Phase 1 stops at `ready`. Phase 2 adds the drain (queued → uploading →
-- publishing → live/failed); Phase 3 adds business policies, whose IDs live
-- in settings.policies rather than in new columns.
--
-- Idempotent. Apply manually in the Supabase SQL Editor.

-- ---------------------------------------------------------------- batches --

create table if not exists ebay_bulk_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The org that graded these cards, when the whole batch is org-scoped.
  -- Per-row branding still resolves from each CARD's org_id (cross-org guard).
  org_id uuid references organizations(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','running','paused','complete','failed','cancelled')),
  -- Batch settings panel: shipping form + returns + bestOffer + priceRule +
  -- listingFormat/duration + gradeLabel, plus placeholders for the Phase 3
  -- business-policy IDs. Free-form on purpose; the API validates it.
  settings jsonb not null default '{}'::jsonb,
  total_count integer not null default 0,
  ready_count integer not null default 0,
  live_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_error text
);

create index if not exists ebay_bulk_batches_user_status_idx
  on ebay_bulk_batches(user_id, status);
create index if not exists ebay_bulk_batches_user_created_idx
  on ebay_bulk_batches(user_id, created_at desc);

-- ------------------------------------------------------------------ items --

create table if not exists ebay_bulk_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references ebay_bulk_batches(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  position integer not null default 0,
  status text not null default 'draft'
    check (status in ('draft','ready','queued','uploading','publishing','live','failed','skipped','blocked')),
  attempts integer not null default 0,
  title text,
  price numeric(12,2),
  description_html text,
  item_specifics jsonb,
  -- Ordered list of ALREADY-UPLOADED image URLs. These are Supabase Storage
  -- public URLs in the 'ebay-listing-images' bucket, written by
  -- /api/ebay/images and validated against that bucket + this user + this
  -- card on every PATCH, so the Phase 2 drain never has to touch a canvas.
  image_urls jsonb,
  image_status text not null default 'pending'
    check (image_status in ('pending','ready','failed')),
  -- Unmet requirements, e.g. [{"code":"price_missing","label":"Needs a price"}].
  readiness jsonb,
  -- Which fields the seller hand-edited. A settings change re-seeds only the
  -- rows that are still generated, so a batch-level price rule never
  -- clobbers a price someone typed.
  price_edited boolean not null default false,
  title_edited boolean not null default false,
  description_edited boolean not null default false,
  listing_row_id uuid references ebay_listings(id) on delete set null,
  error_code text,
  error_message text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, card_id)
);

create index if not exists ebay_bulk_items_batch_status_idx
  on ebay_bulk_items(batch_id, status);
create index if not exists ebay_bulk_items_card_idx
  on ebay_bulk_items(card_id);

-- ----------------------------------------------- ebay_listings back-link --

-- Idempotency for the Phase 2 drain: a retried item that already produced a
-- listing is a no-op rather than a second eBay listing.
alter table ebay_listings add column if not exists bulk_item_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ebay_listings_bulk_item_id_fkey'
  ) then
    alter table ebay_listings
      add constraint ebay_listings_bulk_item_id_fkey
      foreign key (bulk_item_id) references ebay_bulk_items(id) on delete set null;
  end if;
end $$;

create index if not exists ebay_listings_bulk_item_idx
  on ebay_listings(bulk_item_id) where bulk_item_id is not null;

-- ------------------------------------------------------------------- RLS --

-- Same posture as listing_templates / submissions: the service-role API
-- mediates every write, and the owner-scoped policies below exist so a
-- direct anon-key read can never cross accounts.
alter table ebay_bulk_batches enable row level security;
alter table ebay_bulk_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'ebay_bulk_batches' and policyname = 'ebay_bulk_batches_owner'
  ) then
    create policy ebay_bulk_batches_owner on ebay_bulk_batches
      for all to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'ebay_bulk_items' and policyname = 'ebay_bulk_items_owner'
  ) then
    create policy ebay_bulk_items_owner on ebay_bulk_items
      for all to authenticated
      using (exists (
        select 1 from ebay_bulk_batches b
        where b.id = ebay_bulk_items.batch_id and b.user_id = auth.uid()
      ))
      with check (exists (
        select 1 from ebay_bulk_batches b
        where b.id = ebay_bulk_items.batch_id and b.user_id = auth.uid()
      ));
  end if;
end $$;
