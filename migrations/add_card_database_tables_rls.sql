-- Migration: Enable RLS on card database reference tables
-- Date: January 23, 2026
-- Purpose: Fix Supabase linter security errors for One Piece, Lorcana, and MTG tables

-- ============================================
-- ONE PIECE TABLES
-- ============================================

-- 1. ONEPIECE_CARDS TABLE
-- Reference data - public read, service role write only
ALTER TABLE public.onepiece_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onepiece_cards_select_public"
ON public.onepiece_cards
FOR SELECT
TO public
USING (true);

-- 2. ONEPIECE_SETS TABLE
-- Reference data - public read, service role write only
ALTER TABLE public.onepiece_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onepiece_sets_select_public"
ON public.onepiece_sets
FOR SELECT
TO public
USING (true);

-- 3. ONEPIECE_IMPORT_LOG TABLE
-- Admin/system only - authenticated users can read for admin dashboard
ALTER TABLE public.onepiece_import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onepiece_import_log_select_authenticated"
ON public.onepiece_import_log
FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- LORCANA TABLES
-- ============================================

-- 4. LORCANA_CARDS TABLE
-- Reference data - public read, service role write only
ALTER TABLE public.lorcana_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lorcana_cards_select_public"
ON public.lorcana_cards
FOR SELECT
TO public
USING (true);

-- 5. LORCANA_SETS TABLE
-- Reference data - public read, service role write only
ALTER TABLE public.lorcana_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lorcana_sets_select_public"
ON public.lorcana_sets
FOR SELECT
TO public
USING (true);

-- 6. LORCANA_IMPORT_LOG TABLE
-- Admin/system only - authenticated users can read for admin dashboard
ALTER TABLE public.lorcana_import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lorcana_import_log_select_authenticated"
ON public.lorcana_import_log
FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- MTG TABLES
-- ============================================

-- 7. MTG_CARDS TABLE
-- Reference data - public read, service role write only
ALTER TABLE public.mtg_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mtg_cards_select_public"
ON public.mtg_cards
FOR SELECT
TO public
USING (true);

-- 8. MTG_SETS TABLE
-- Reference data - public read, service role write only
ALTER TABLE public.mtg_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mtg_sets_select_public"
ON public.mtg_sets
FOR SELECT
TO public
USING (true);

-- 9. MTG_IMPORT_LOG TABLE
-- Admin/system only - authenticated users can read for admin dashboard
ALTER TABLE public.mtg_import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mtg_import_log_select_authenticated"
ON public.mtg_import_log
FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN (
--   'onepiece_cards', 'onepiece_sets', 'onepiece_import_log',
--   'lorcana_cards', 'lorcana_sets', 'lorcana_import_log',
--   'mtg_cards', 'mtg_sets', 'mtg_import_log'
-- );

-- Check policies exist:
-- SELECT tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE tablename IN (
--   'onepiece_cards', 'onepiece_sets', 'onepiece_import_log',
--   'lorcana_cards', 'lorcana_sets', 'lorcana_import_log',
--   'mtg_cards', 'mtg_sets', 'mtg_import_log'
-- );
