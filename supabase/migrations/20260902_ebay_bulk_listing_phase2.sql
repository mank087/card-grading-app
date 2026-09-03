-- InstaList bulk listing (Part 2, Phase 2): the publish drain.
--
-- Phase 1 shipped the tables; everything the drain needs is already there
-- (item.status / attempts / locked_at, batch.status / started_at /
-- completed_at / last_error, ebay_listings.bulk_item_id). This migration adds
-- only what Phase 2 itself introduced:
--
--   1. `completion_email_sent_at` — the send-once guard for the completion
--      email. Two drains can both observe a batch finishing; the email is
--      claimed with a conditional UPDATE on this column, exactly the way
--      completeSubmission claims a submission's completion on status.
--   2. Two indexes the drain's hot queries need: "which batches are running"
--      and "which items in this batch are claimable / stale-locked".
--
-- Idempotent. Apply manually in the Supabase SQL Editor.

alter table ebay_bulk_batches
  add column if not exists completion_email_sent_at timestamptz;

-- The drain's first query every minute: running batches, oldest first.
create index if not exists ebay_bulk_batches_status_started_idx
  on ebay_bulk_batches(status, started_at)
  where status in ('running', 'paused');

-- Stale-lock reaping scans on (status, locked_at). Partial so the index stays
-- tiny: only in-flight rows are ever reaped.
create index if not exists ebay_bulk_items_locked_idx
  on ebay_bulk_items(status, locked_at)
  where status in ('uploading', 'publishing');
