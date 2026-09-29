-- Volume-grading speed-ups (Sept 28 2026, dealer request).
--
-- 1. Saved card-notes profiles ("Topps Chrome Refractor" -> note text), one
--    jsonb array per user, next to custom_label_styles. Read/written only by
--    /api/user/notes-profiles with the service role after JWT verification.
-- 2. Card notes chosen for a bulk submission. Copied onto every card the
--    submission creates as the same user_condition_* fields a single upload
--    writes, so the grader sees them identically.
--
-- Both columns are additive and nullable/defaulted; the code tolerates them
-- being absent, but bulk card notes and saved profiles only work once applied.

ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS grading_notes_profiles JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN user_credits.grading_notes_profiles IS
  'Saved card-notes profiles: [{id, name, text, updated_at}], max 25, text max 500 chars';

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS card_notes TEXT;

COMMENT ON COLUMN submissions.card_notes IS
  'Card notes applied to every card in the submission (cards.user_condition_report.cardDescription)';
