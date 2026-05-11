-- Welcome tour tracking
--
-- Tracks whether the user has completed (or explicitly skipped) the
-- post-signup welcome tour shown in the mobile app. Defaults to false
-- for new users; existing users with 1+ graded cards are filtered out
-- at runtime by the eligibility check in dcm-mobile's WelcomeTourContext
-- so we don't ambush returning users with a brand-new-user tour.
--
-- Setting to false (the default for new users + new column on existing
-- rows) does NOT auto-trigger the tour — the mobile app checks both
-- this flag AND zero-graded-cards before starting. Resetting to false
-- via the Account → "Replay welcome tour" button DOES re-trigger.

ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS welcome_tour_completed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN user_credits.welcome_tour_completed IS
  'True once the user has finished or skipped the mobile-app welcome tour. Tour can be replayed from Account → Replay welcome tour, which sets this back to false.';
