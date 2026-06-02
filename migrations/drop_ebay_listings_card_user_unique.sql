-- =====================================================
-- DCM Grading — Drop ebay_listings (card_id, user_id) unique
-- =====================================================
--
-- The original migration constrained (card_id, user_id) UNIQUE so the
-- existing InstaList modal could fail fast if a user tried to list the
-- same card twice. In practice that's enforced by /api/ebay/listing's
-- in-code check (lines ~312-332) which 409s on duplicate ACTIVE listings.
--
-- Keeping the DB constraint also forbids ALL re-listings — a card that
-- was listed, ended, then relisted can't be tracked as two rows. This
-- blocks the bulk importer from capturing a user's full history and
-- forces the dashboard to show only one row per card forever.
--
-- Drop the constraint; rely on:
--   - listing_id remains UNIQUE on its own (one eBay item → one DB row)
--   - The application-level active-duplicate check in /api/ebay/listing
--
-- Safe to run on prod. No data is changed, only the constraint definition.
-- =====================================================

ALTER TABLE ebay_listings
  DROP CONSTRAINT IF EXISTS ebay_listings_card_id_user_id_key;

-- Make sure listing_id stays unique (it should already; this is defensive)
-- so we never get two DB rows pointing at the same eBay ItemID.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'ebay_listings'::regclass
      AND conname = 'ebay_listings_listing_id_key'
  ) THEN
    ALTER TABLE ebay_listings
      ADD CONSTRAINT ebay_listings_listing_id_key UNIQUE (listing_id);
  END IF;
END $$;

-- =====================================================
-- Verification
-- =====================================================
-- The card_id+user_id pair should NO LONGER be in the unique list.
-- The listing_id should be unique on its own.
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'ebay_listings'::regclass AND contype = 'u';
