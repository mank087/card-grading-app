-- One first-grade credit charge per card row (Jul 24 2026).
--
-- Incident: a customer's stalled uploads queued during a network outage and
-- flushed together on reconnect — 4 near-simultaneous submissions, 4 credit
-- charges for what the user intended as one grade. The deduct endpoint had no
-- idempotency.
--
-- App-side dedup now exists in deductCredit() (src/lib/credits.ts): it checks
-- for a prior 'grade' transaction on the card_id before charging. This index
-- closes the remaining check-then-insert race: if two duplicates slip through
-- the app check concurrently, the second INSERT fails with 23505 and
-- deductCredit restores the balance and reports the prior charge.
--
-- Scope deliberately excludes:
--   * type = 'regrade' — repeat charges per explicit user action are legal
--   * NULL card_id     — historical rows (deleted cards FK SET NULL, legacy
--                        charges without card refs) must not collide
--
-- Pre-flight: verify no existing duplicates would block index creation.
-- Expected offenders as of Jul 24: the Sliggoo incident cards do NOT
-- duplicate (each duplicate charge had its own card row) — this should
-- return zero rows. If it returns rows, resolve them before applying.
--
--   SELECT card_id, COUNT(*)
--   FROM credit_transactions
--   WHERE type = 'grade' AND card_id IS NOT NULL
--   GROUP BY card_id
--   HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_grade_charge_per_card
  ON public.credit_transactions (card_id)
  WHERE type = 'grade' AND card_id IS NOT NULL;
