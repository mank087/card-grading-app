-- Heritage is the label style for new accounts (product decision 2026-08-11).
--
-- The API and client hook already treat an unset label_style as heritage, but
-- the column default added on 2026-01-13 writes 'modern' into every new
-- user_credits row, so that fallback never applied: 1,365 of ~1,390 accounts
-- created in the 30 days to 2026-09-14 were stored as 'modern'. Changing the
-- default fixes every account created after this runs, on every surface that
-- reads the setting (card pages, downloads, print, eBay listing images).
--
-- Existing rows are intentionally left alone here: the database cannot tell a
-- defaulted 'modern' from a chosen one. Any backfill is a separate, scoped step.

ALTER TABLE user_credits
ALTER COLUMN label_style SET DEFAULT 'heritage';

COMMENT ON COLUMN user_credits.label_style IS
  'User preference for card label style: heritage (default for new accounts), modern, traditional, or a saved custom-N slot';
