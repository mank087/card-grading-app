-- =====================================================
-- DCM Grading - Add eBay listings sync columns
-- Powers the /instalist-marketplace dashboard.
-- Run this in Supabase SQL Editor (local dev only — not yet pushed to prod).
-- =====================================================

-- view_count: HitCount from GetMyeBaySelling. Cached so the dashboard
--   doesn't have to hit eBay on every render.
-- watch_count: WatchCount from GetMyeBaySelling. Same caching rationale.
-- quantity_sold: For fixed-price listings with quantity > 1, tracks units sold.
-- last_synced_at: When the cron last refreshed this row from eBay. Lets the
--   UI show "synced X minutes ago" and helps debug stale data.

ALTER TABLE ebay_listings
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS watch_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_sold INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Index to find listings that need re-syncing (oldest sync first).
-- The cron will scan WHERE status='active' ORDER BY last_synced_at NULLS FIRST.
CREATE INDEX IF NOT EXISTS idx_ebay_listings_sync_priority
  ON ebay_listings (status, last_synced_at NULLS FIRST)
  WHERE status = 'active';

-- =====================================================
-- Verification
-- =====================================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'ebay_listings'
--   AND column_name IN ('view_count', 'watch_count', 'quantity_sold', 'last_synced_at');
