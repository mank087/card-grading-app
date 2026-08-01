-- Canary A/B tracking: record which model graded each card.
--
-- Without this the experiment is unmeasurable. api_usage_log records the model
-- per API call but its card_id is null on the grading path, so there is no way
-- to join a finished grade back to the model that produced it. Comparing a
-- "luna week" against a "gpt-5.1 week" would confound the model change with
-- whatever cards happened to be submitted -- which is exactly the flaw a
-- same-population split exists to avoid.
--
-- Nullable with no default on purpose: rows graded before this shipped are
-- genuinely unknown, and backfilling them to 'gpt-5.1' would invent data.
-- Filter on `grading_model IS NOT NULL` when analysing the canary.

ALTER TABLE cards ADD COLUMN IF NOT EXISTS grading_model TEXT;

COMMENT ON COLUMN cards.grading_model IS
  'OpenAI model that produced this grade (e.g. gpt-5.1, gpt-5.6-luna). NULL = graded before Aug 2026 canary tracking. Set by the grading routes via modelRouter.';

-- Analysis queries all filter model + time, and the canary is a small slice of
-- a large table, so a partial index keeps it cheap.
CREATE INDEX IF NOT EXISTS idx_cards_grading_model_created
  ON cards (grading_model, created_at DESC)
  WHERE grading_model IS NOT NULL;
