-- Fix eBay RLS Performance Warnings
-- Created: January 17, 2026
-- Purpose: Wrap auth.uid() in subquery to prevent per-row re-evaluation
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- =============================================================================
-- Fix ebay_connections policies
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own eBay connection" ON ebay_connections;
DROP POLICY IF EXISTS "Users can insert own eBay connection" ON ebay_connections;
DROP POLICY IF EXISTS "Users can update own eBay connection" ON ebay_connections;
DROP POLICY IF EXISTS "Users can delete own eBay connection" ON ebay_connections;

CREATE POLICY "Users can view own eBay connection"
  ON ebay_connections FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own eBay connection"
  ON ebay_connections FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own eBay connection"
  ON ebay_connections FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own eBay connection"
  ON ebay_connections FOR DELETE
  USING ((select auth.uid()) = user_id);

-- =============================================================================
-- Fix ebay_inventory_locations policies
-- =============================================================================

DROP POLICY IF EXISTS "Users can manage own inventory locations" ON ebay_inventory_locations;

CREATE POLICY "Users can manage own inventory locations"
  ON ebay_inventory_locations FOR ALL
  USING ((select auth.uid()) = user_id);

-- =============================================================================
-- Fix ebay_listings policies
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own eBay listings" ON ebay_listings;
DROP POLICY IF EXISTS "Users can insert own eBay listings" ON ebay_listings;
DROP POLICY IF EXISTS "Users can update own eBay listings" ON ebay_listings;
DROP POLICY IF EXISTS "Users can delete own eBay listings" ON ebay_listings;

CREATE POLICY "Users can view own eBay listings"
  ON ebay_listings FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own eBay listings"
  ON ebay_listings FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own eBay listings"
  ON ebay_listings FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own eBay listings"
  ON ebay_listings FOR DELETE
  USING ((select auth.uid()) = user_id);

-- =============================================================================
-- Fix ebay_user_policies policies
-- =============================================================================

DROP POLICY IF EXISTS "Users can manage own eBay policies" ON ebay_user_policies;

CREATE POLICY "Users can manage own eBay policies"
  ON ebay_user_policies FOR ALL
  USING ((select auth.uid()) = user_id);
