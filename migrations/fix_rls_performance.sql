-- Fix RLS performance warnings
-- 1. Wrap auth.uid() in (select auth.uid()) to prevent per-row re-evaluation
-- 2. Consolidate multiple permissive SELECT policies into single policies

-- ============================================
-- PROFILES TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;

-- Recreate with optimized auth.uid() calls
CREATE POLICY "Read own profile" ON public.profiles
  FOR SELECT USING ((select auth.uid()) = id);

CREATE POLICY "Update own profile" ON public.profiles
  FOR UPDATE USING ((select auth.uid()) = id);

-- ============================================
-- CARDS TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Public cards are viewable by everyone" ON public.cards;
DROP POLICY IF EXISTS "Users can view own cards" ON public.cards;
DROP POLICY IF EXISTS "Users can insert own cards" ON public.cards;
DROP POLICY IF EXISTS "Users can update own cards" ON public.cards;
DROP POLICY IF EXISTS "Users can delete own cards" ON public.cards;

-- Consolidated SELECT policy: can view if public OR owner
CREATE POLICY "Users can view cards" ON public.cards
  FOR SELECT USING (
    is_public = true
    OR visibility = 'public'::text
    OR (select auth.uid()) = user_id
  );

-- INSERT policy with optimized auth.uid()
CREATE POLICY "Users can insert own cards" ON public.cards
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- UPDATE policy with optimized auth.uid()
CREATE POLICY "Users can update own cards" ON public.cards
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- DELETE policy with optimized auth.uid()
CREATE POLICY "Users can delete own cards" ON public.cards
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================
-- USERS TABLE
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can read own data" ON public.users;

-- Recreate with optimized auth.uid() call
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT USING ((select auth.uid()) = id);

-- ============================================
-- USER_CREDITS TABLE
-- ============================================

-- Drop existing policies (keep service role, fix user policy)
DROP POLICY IF EXISTS "Service role full access to credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;

-- Service role policy should only apply to service_role, not public
-- This fixes the "multiple permissive policies" warning
CREATE POLICY "Service role full access to credits" ON public.user_credits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- User policy with optimized auth.uid()
CREATE POLICY "Users can view own credits" ON public.user_credits
  FOR SELECT USING ((select auth.uid()) = user_id);

-- ============================================
-- CREDIT_TRANSACTIONS TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Service role full access to transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;

-- Service role policy should only apply to service_role, not public
CREATE POLICY "Service role full access to transactions" ON public.credit_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- User policy with optimized auth.uid()
CREATE POLICY "Users can view own transactions" ON public.credit_transactions
  FOR SELECT USING ((select auth.uid()) = user_id);
