-- ============================================================================
-- Org billing idempotency backstop (Aug 17, 2026)
--
-- NOT RUN AUTOMATICALLY: paste this into the Supabase SQL editor manually.
-- (Migrations in this repo are applied by hand — nothing here has touched
-- the production database.)
--
-- Adds a partial unique index on credit_transactions over the org billing
-- dedupe key (metadata->>'org_dedupe_key'). The app-level dedupe in
-- depositOrgCredits / resetOrgMonthlyCredits / the upgrade grant is
-- SELECT-then-insert, which cannot stop two concurrent webhook deliveries
-- from both passing the check. This index makes the transaction insert the
-- atomic idempotency claim: the second insert fails with 23505 and the app
-- treats that as "already processed". Same pattern as the July 2026
-- duplicate-charge fix on the deduct side.
--
-- BEFORE APPLYING: verify no existing duplicates would block index creation:
--
--   SELECT metadata->>'org_dedupe_key' AS key, count(*)
--   FROM credit_transactions
--   WHERE metadata->>'org_dedupe_key' IS NOT NULL
--   GROUP BY 1 HAVING count(*) > 1;
--
-- If that returns rows, resolve them (they represent historical double
-- grants) before running the CREATE INDEX below.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_credit_transactions_org_dedupe_key
  ON credit_transactions ((metadata->>'org_dedupe_key'))
  WHERE metadata->>'org_dedupe_key' IS NOT NULL;
