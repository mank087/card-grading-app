-- =====================================================
-- SUBMISSIONS (bulk scanner-driven grading) MIGRATION
-- Date: 2026-08-31
-- Spec:  docs/SOW_submissions_bulk_grading_2026-08-31.md (WS1)
-- Purpose: queue tables for multi-card submissions + one nullable FK on cards
--
-- SEQUENCING: run this AFTER the pending 20260817 enterprise migrations
-- (billing index first). It touches no enterprise object, but the SOW pins
-- the order explicitly so the two sets never race.
--
-- Idempotent: safe to re-run. Apply by hand in the Supabase SQL editor.
-- =====================================================

-- -----------------------------------------------------
-- Step 1: submissions
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  name          TEXT,
  category      TEXT NOT NULL,
  sub_category  TEXT,
  binder_id     UUID,
  status        TEXT NOT NULL DEFAULT 'draft',
  source        TEXT DEFAULT 'upload',
  card_count    INT,
  -- Per-submission model-routing pin: a future canary split must not grade
  -- one submission with two different models (SOW "Model routing").
  routing_key   UUID DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  committed_at  TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

-- Status vocabulary. Added as a named constraint so it can be replaced later
-- without rewriting the table definition.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'submissions_status_check'
  ) THEN
    ALTER TABLE submissions
      ADD CONSTRAINT submissions_status_check CHECK (status IN (
        'draft',
        'ready',
        'running',
        'blocked_insufficient_credits',
        'paused',
        'complete',
        'failed',
        'cancelled'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_submissions_user_created
  ON submissions(user_id, created_at DESC);

-- The drain's outer loop: "which submissions are running right now".
CREATE INDEX IF NOT EXISTS idx_submissions_status_running
  ON submissions(status, committed_at)
  WHERE status = 'running';

COMMENT ON TABLE submissions IS
  'Bulk grading submissions. Internal naming only - no user-facing product name (SOW Aug 31).';
COMMENT ON COLUMN submissions.routing_key IS
  'Per-submission model-routing pin so a canary split cannot mix models within one submission.';
COMMENT ON COLUMN submissions.source IS
  'upload | scanner | mobile. Anticipates a per-source centering confidence policy.';

-- -----------------------------------------------------
-- Step 2: submission_items (the queue)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS submission_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  card_id        UUID,
  position       INT NOT NULL,
  front_path     TEXT,
  back_path      TEXT,
  -- Content hashes for resume/dedupe: skip re-transfer of an already
  -- uploaded file (external review, incorporated).
  front_hash     TEXT,
  back_hash      TEXT,
  status         TEXT NOT NULL DEFAULT 'queued',
  claimed_at     TIMESTAMPTZ,
  attempts       INT NOT NULL DEFAULT 0,
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'submission_items_status_check'
  ) THEN
    ALTER TABLE submission_items
      ADD CONSTRAINT submission_items_status_check CHECK (status IN (
        'queued',
        'dispatched',
        'grading',
        'graded',
        'failed',
        'skipped'
      ));
  END IF;
END $$;

-- Drain claim scan + in-flight counting.
CREATE INDEX IF NOT EXISTS idx_submission_items_submission_status
  ON submission_items(submission_id, status);

-- Stable grid order + the progress endpoint's sort.
CREATE INDEX IF NOT EXISTS idx_submission_items_submission_position
  ON submission_items(submission_id, position);

-- Reconcile joins items back from card rows.
CREATE INDEX IF NOT EXISTS idx_submission_items_card
  ON submission_items(card_id)
  WHERE card_id IS NOT NULL;

-- One item per slot in a submission: makes item creation idempotent and
-- makes a double-POST of the same intake harmless.
CREATE UNIQUE INDEX IF NOT EXISTS idx_submission_items_unique_position
  ON submission_items(submission_id, position);

COMMENT ON COLUMN submission_items.claimed_at IS
  'Claim lease. A drain claims only status=queued rows; claimed_at dates the lease so a dead drain can be reclaimed.';

-- -----------------------------------------------------
-- Step 3: the one nullable FK on cards
-- (cards is already ~290 columns wide - nothing else is added there)
-- -----------------------------------------------------
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS submission_id UUID;

CREATE INDEX IF NOT EXISTS idx_cards_submission
  ON cards(submission_id)
  WHERE submission_id IS NOT NULL;

COMMENT ON COLUMN cards.submission_id IS
  'Nullable back-reference to the bulk submission that created this card. NULL for single uploads.';

-- -----------------------------------------------------
-- Step 4: RLS
-- Every read and write goes through server routes on the service-role key
-- (which bypasses RLS), and each route does its own owner check. So RLS is
-- enabled with NO policies: deny-all for anon and authenticated. That closes
-- the PostgREST surface rather than leaving these tables world-readable.
-- If a client ever needs direct access, add a policy then - not now.
-- -----------------------------------------------------
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- VERIFICATION (see scripts/_tmp-verify-submissions-schema.ts)
-- =====================================================
-- SELECT table_name FROM information_schema.tables
--  WHERE table_name IN ('submissions','submission_items');
--
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'submissions' ORDER BY ordinal_position;
--
-- SELECT indexname FROM pg_indexes
--  WHERE tablename IN ('submissions','submission_items')
--     OR indexname = 'idx_cards_submission';

-- =====================================================
-- ROLLBACK
-- =====================================================
-- DROP INDEX IF EXISTS idx_cards_submission;
-- ALTER TABLE cards DROP COLUMN IF EXISTS submission_id;
-- DROP TABLE IF EXISTS submission_items;
-- DROP TABLE IF EXISTS submissions;
