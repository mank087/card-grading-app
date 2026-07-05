-- ============================================================================
-- Drop sports_card_products to reclaim Supabase storage (Jul 4, 2026)
-- ============================================================================
-- The full SportsCardsPro product mirror grew to 6.1M+ rows (~5-7GB with the
-- two gin_trgm indexes) and exceeded the Supabase database-size budget. Sports
-- card MATCHING and PRICING have been reverted to the live SportsCardsPro API
-- (see src/lib/priceCharting.ts searchSportsCardPrices API path; the local path
-- is now gated behind SPORTS_LOCAL_DB_ENABLED, default off).
--
-- KEPT: sports_sets (2,951 rows, ~1MB) still powers the /sports-database
-- sets browser. Card-level listings link out to SportsCardsPro.
--
-- ⚠️ RUN THIS IN THE SUPABASE SQL EDITOR. DROP TABLE cannot run via the JS
-- client. This is the step that actually frees the disk.
-- ============================================================================

DROP TABLE IF EXISTS sports_card_products CASCADE;

-- Optional: also drop the import log if you don't want the history
-- DROP TABLE IF EXISTS sports_import_log CASCADE;

-- Note: pg_trgm extension and the small trigram index on sports_sets.console_name
-- are left in place (negligible size). Postgres reclaims the dropped table's
-- pages automatically; no VACUUM FULL needed for a DROP.
