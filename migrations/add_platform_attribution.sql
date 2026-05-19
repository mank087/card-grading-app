-- Migration: Platform attribution for users and cards
-- Purpose: Distinguish web vs iOS app vs Android app sign-ups and gradings so
--          the admin revenue/analytics dashboards can show platform breakdowns.
-- Date: 2026-05-19
--
-- Source values: 'web', 'ios_app', 'android_app'. Older rows backfilled to 'web'
-- since the mobile app only launched on 2026-05-19. Trigger update lives in a
-- separate migration (update_handle_new_user_signup_source.sql).

-- ============================================
-- 1. public.users.signup_source
-- ============================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS signup_source TEXT;

CREATE INDEX IF NOT EXISTS idx_users_signup_source
  ON public.users(signup_source);

-- Backfill: every existing user signed up on web.
UPDATE public.users
SET signup_source = 'web'
WHERE signup_source IS NULL;

-- ============================================
-- 2. public.cards.graded_from
-- ============================================
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS graded_from TEXT;

CREATE INDEX IF NOT EXISTS idx_cards_graded_from
  ON public.cards(graded_from);

-- Backfill: every existing card was graded from web.
UPDATE public.cards
SET graded_from = 'web'
WHERE graded_from IS NULL;
