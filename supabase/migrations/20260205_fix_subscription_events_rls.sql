-- Fix RLS Performance Issues for subscription_events
-- Created: 2026-02-05
-- Description: Fix auth_rls_initplan and multiple_permissive_policies warnings
--
-- Issues fixed:
-- 1. auth_rls_initplan: Wrap auth.uid() and auth.role() in (select ...) to prevent per-row re-evaluation
-- 2. multiple_permissive_policies: Consolidate overlapping SELECT policies into a single policy

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own subscription events" ON subscription_events;
DROP POLICY IF EXISTS "Service role can manage subscription events" ON subscription_events;

-- Create optimized policies with (select ...) wrapper for auth functions
-- This prevents the auth functions from being re-evaluated for each row

-- SELECT: Single combined policy for both users and service role
-- Users see their own records, service role sees all
-- Using (select auth.uid()) and (select auth.role()) for performance
CREATE POLICY "Select subscription events"
  ON subscription_events
  FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR (select auth.role()) = 'service_role'
  );

-- INSERT: Only service role can insert (webhooks create events)
CREATE POLICY "Service role insert subscription events"
  ON subscription_events
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- UPDATE: Only service role can update
CREATE POLICY "Service role update subscription events"
  ON subscription_events
  FOR UPDATE
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- DELETE: Only service role can delete
CREATE POLICY "Service role delete subscription events"
  ON subscription_events
  FOR DELETE
  USING ((select auth.role()) = 'service_role');
