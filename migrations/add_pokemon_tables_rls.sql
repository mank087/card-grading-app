-- Migration: Enable RLS on Pokemon reference tables
-- Date: December 16, 2025
-- Purpose: Fix Supabase linter security errors for pokemon_cards, pokemon_sets, pokemon_import_log

-- ============================================
-- 1. POKEMON_CARDS TABLE
-- Reference data - public read, service role write only
-- ============================================

-- Enable RLS
ALTER TABLE public.pokemon_cards ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (needed by pokemonTcgApi.ts which uses anon key)
CREATE POLICY "pokemon_cards_select_public"
ON public.pokemon_cards
FOR SELECT
TO public
USING (true);

-- Note: INSERT/UPDATE/DELETE only allowed via service role (import scripts)
-- Service role bypasses RLS, so no explicit policies needed for writes

-- ============================================
-- 2. POKEMON_SETS TABLE
-- Reference data - public read, service role write only
-- ============================================

-- Enable RLS
ALTER TABLE public.pokemon_sets ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read
CREATE POLICY "pokemon_sets_select_public"
ON public.pokemon_sets
FOR SELECT
TO public
USING (true);

-- Note: INSERT/UPDATE/DELETE only allowed via service role (import scripts)

-- ============================================
-- 3. POKEMON_IMPORT_LOG TABLE
-- Admin/system only - no public access needed
-- ============================================

-- Enable RLS
ALTER TABLE public.pokemon_import_log ENABLE ROW LEVEL SECURITY;

-- Option A: Allow authenticated users to read (useful for admin dashboard)
CREATE POLICY "pokemon_import_log_select_authenticated"
ON public.pokemon_import_log
FOR SELECT
TO authenticated
USING (true);

-- Note: INSERT/UPDATE/DELETE only allowed via service role (import scripts)
-- If you want to restrict to admins only, you can modify the policy:
-- USING (auth.jwt() ->> 'email' IN ('admin@dcmgrading.com'))

-- ============================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('pokemon_cards', 'pokemon_sets', 'pokemon_import_log');

-- Check policies exist:
-- SELECT tablename, policyname, permissive, roles, cmd, qual FROM pg_policies WHERE tablename IN ('pokemon_cards', 'pokemon_sets', 'pokemon_import_log');
