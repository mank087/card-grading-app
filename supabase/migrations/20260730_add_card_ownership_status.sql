-- ============================================================================
-- Card ownership lifecycle (Phase 1)
-- ============================================================================
-- Sellers need to take a card out of their working collection WITHOUT deleting
-- it. Deleting is destructive in four ways that aren't obvious from the UI:
--
--   1. The printed slab label carries a QR to /verify/<serial>. Deleting the
--      row makes that QR 404 forever — on a slab physically in a buyer's hand.
--   2. ebay_listings.card_id is ON DELETE CASCADE, so deleting the card also
--      erases its sale record, sold_at and final sale price (and shrinks the
--      seller's own revenue stats retroactively).
--   3. Pop report counts rows in `cards`. A sold card still EXISTS in the
--      world — population must not drop because it changed hands.
--   4. Card images are purged from storage on delete, unrecoverably.
--
-- So instead of deleting, a card gets a lifecycle state:
--
--   ownership_status  'owned'    still in the collection (default)
--                     'sold'     sold on; stays verifiable for the buyer,
--                                hidden from the owner's active views and
--                                from the eBay "list a card" picker
--                     'archived' no longer held but not sold (gifted, lost,
--                                traded, or a scan the owner wants out of the
--                                way) — same hiding, no sale claim
--
-- 'sold' is set two ways:
--   - automatically by the eBay sync when a listing flips to sold (the final
--     sale price is already captured there), sold_channel = 'ebay'
--   - manually for off-platform sales, sold_channel = 'manual'
-- Both are reversible — eBay sales get cancelled and returned, and manual
-- marks are self-reported. See sold_channel + the "still mine" undo.
--
-- NOTE: deliberately named ownership_status, not status — `grade_status`
-- (grading lock) and /api/cards/[id]/status (grading progress) already exist.
-- ============================================================================

ALTER TABLE cards ADD COLUMN IF NOT EXISTS ownership_status TEXT NOT NULL DEFAULT 'owned';
ALTER TABLE cards ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS sold_price NUMERIC(12,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS sold_channel TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS sold_note TEXT;

-- Set whenever the USER changes ownership by hand. The eBay reconciliation
-- only auto-marks a card sold when there is no manual override, or when a NEW
-- sale post-dates it. Without this, someone who hits "Still mine" after a
-- cancelled eBay sale would have the 15-minute cron re-mark it sold forever.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS ownership_overridden_at TIMESTAMPTZ;

-- Soft delete. Deleting used to remove the row AND purge both card images from
-- storage in the same request — unrecoverable, and it took the slab's QR target
-- and the eBay sale record with it. Now a delete just stamps deleted_at: the
-- card leaves every view, images stay put, and it can be restored. A later
-- sweep can hard-delete rows past a retention window and purge their images
-- then, when the decision has had time to be regretted.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Every read path filters `deleted_at IS NULL`; a partial index keeps that
-- free rather than making the common case pay for the rare one.
CREATE INDEX IF NOT EXISTS idx_cards_user_live
  ON cards(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Constrain to the known states. Written as a guarded DO block so re-running
-- the migration doesn't error on an existing constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cards_ownership_status_check'
  ) THEN
    ALTER TABLE cards ADD CONSTRAINT cards_ownership_status_check
      CHECK (ownership_status IN ('owned', 'sold', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cards_sold_channel_check'
  ) THEN
    ALTER TABLE cards ADD CONSTRAINT cards_sold_channel_check
      CHECK (sold_channel IS NULL OR sold_channel IN ('ebay', 'manual', 'other'));
  END IF;
END $$;

-- The collection and the eBay eligible-cards picker both filter by
-- (user_id, ownership_status) on every load — this is the hot path.
CREATE INDEX IF NOT EXISTS idx_cards_user_ownership
  ON cards(user_id, ownership_status);

-- Sold-view sorting ("most recent sale first").
CREATE INDEX IF NOT EXISTS idx_cards_sold_at
  ON cards(user_id, sold_at DESC)
  WHERE ownership_status = 'sold';

COMMENT ON COLUMN cards.ownership_status IS
  'owned = in the active collection; sold = sold on (still verifiable by the buyer); archived = no longer held, no sale claim. Never delete a graded card — the slab QR depends on the row.';
COMMENT ON COLUMN cards.sold_at IS
  'When the card sold. From ebay_listings.sold_at for eBay sales, or user-supplied for manual ones.';
COMMENT ON COLUMN cards.sold_price IS
  'Final sale price. eBay sales inherit the synced final price (winning bid / accepted Best Offer), not the original ask.';
COMMENT ON COLUMN cards.sold_channel IS
  'ebay = auto-detected by the eBay sync; manual = user marked an off-platform sale; other = reserved.';
COMMENT ON COLUMN cards.ownership_overridden_at IS
  'Last MANUAL ownership change. The eBay reconciliation defers to it unless a newer sale post-dates it, so "Still mine" is not undone by the next cron run.';
COMMENT ON COLUMN cards.deleted_at IS
  'Soft delete. NULL = live. Set = hidden everywhere but restorable; images are NOT purged until a retention sweep hard-deletes the row.';
