-- Migration: Fix card_shows security and performance warnings
-- Date: 2026-01-11
-- Purpose: Address Supabase linter warnings for card_shows table

-- =============================================================================
-- FIX 1: Function Search Path Mutable
-- Set immutable search_path on update_card_shows_updated_at function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_card_shows_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''  -- Immutable search path prevents injection attacks
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- FIX 2: RLS Policy Always True + Multiple Permissive Policies
-- The "Service role has full access" policy is problematic because:
-- 1. It uses USING(true) which bypasses RLS for ALL roles, not just service role
-- 2. Service role already bypasses RLS by default, so this policy is redundant
-- 3. It creates overlapping permissive policies with the public read policy
--
-- Solution: Remove the overly permissive policy entirely.
-- Service role can still perform all operations as it bypasses RLS.
-- =============================================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Service role has full access to card shows" ON card_shows;

-- =============================================================================
-- FIX 3: Extension in Public Schema (pg_trgm)
-- Move pg_trgm extension to 'extensions' schema
-- Note: Must drop dependent indexes first, then recreate after moving extension
-- =============================================================================

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage to postgres and service_role
GRANT USAGE ON SCHEMA extensions TO postgres, service_role;

-- Step 1: Drop dependent indexes
DROP INDEX IF EXISTS idx_pokemon_cards_name_trgm;
DROP INDEX IF EXISTS idx_pokemon_cards_number_trgm;

-- Step 2: Drop and recreate extension in new schema
DROP EXTENSION IF EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Step 3: Recreate the indexes using the extension from the new schema
-- The operator class is now in 'extensions' schema
CREATE INDEX idx_pokemon_cards_name_trgm ON pokemon_cards USING gin (name extensions.gin_trgm_ops);
CREATE INDEX idx_pokemon_cards_number_trgm ON pokemon_cards USING gin (number extensions.gin_trgm_ops);

-- =============================================================================
-- Verification queries (run these after migration to confirm fixes)
-- =============================================================================

-- Check function search_path is set:
-- SELECT proname, proconfig FROM pg_proc WHERE proname = 'update_card_shows_updated_at';

-- Check RLS policies on card_shows:
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'card_shows';

-- Check pg_trgm extension location:
-- SELECT extname, nspname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid WHERE extname = 'pg_trgm';
