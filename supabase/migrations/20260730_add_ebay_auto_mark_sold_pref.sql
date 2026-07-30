-- ============================================================================
-- "Move my eBay sales to Sold automatically?" — asked once, then remembered
-- ============================================================================
-- The eBay sync can tell when a listing sells, so it CAN move the card to the
-- Sold category on the owner's behalf. But moving someone's cards around
-- without asking is presumptuous the first time it happens, so we ask once and
-- remember the answer.
--
--   NULL   not asked yet — the sync leaves the card alone and the collection
--          shows a prompt ("3 cards sold on eBay. Move them to Sold?")
--   TRUE   move eBay-sold cards to Sold automatically, from now on
--   FALSE  never move automatically; the owner uses Mark as Sold by hand
--
-- Deliberately nullable with no default: "haven't asked" and "said no" are
-- different states and the sync has to distinguish them.
--
-- This only governs the AUTOMATIC eBay path. Sales made anywhere else — a card
-- show, a private trade, Whatnot — are always marked by hand via
-- PATCH /api/cards/[id]/ownership, which is unaffected by this preference.
-- ============================================================================

ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS ebay_auto_mark_sold BOOLEAN;

COMMENT ON COLUMN user_credits.ebay_auto_mark_sold IS
  'NULL = never asked (sync waits, UI prompts); TRUE = auto-move eBay-sold cards to Sold; FALSE = manual only. Does not affect off-eBay sales.';
