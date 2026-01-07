-- Migration: Fix overly permissive RLS policies on admin/internal tables
-- These tables should only be accessible by the service role (backend), not regular users
-- Run this in Supabase SQL Editor

-- =====================================================
-- 1. admin_activity_log - Admin action logging
-- =====================================================
DROP POLICY IF EXISTS "Service role full access admin_activity_log" ON public.admin_activity_log;

CREATE POLICY "Service role only - admin_activity_log"
ON public.admin_activity_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure no access for authenticated users
DROP POLICY IF EXISTS "Authenticated users admin_activity_log" ON public.admin_activity_log;

-- =====================================================
-- 2. admin_sessions - Admin login sessions
-- =====================================================
DROP POLICY IF EXISTS "Service role full access admin_sessions" ON public.admin_sessions;

CREATE POLICY "Service role only - admin_sessions"
ON public.admin_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure no access for authenticated users
DROP POLICY IF EXISTS "Authenticated users admin_sessions" ON public.admin_sessions;

-- =====================================================
-- 3. admin_users - Admin credentials (HIGH PRIORITY)
-- =====================================================
DROP POLICY IF EXISTS "Service role full access admin_users" ON public.admin_users;

CREATE POLICY "Service role only - admin_users"
ON public.admin_users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure no access for authenticated users
DROP POLICY IF EXISTS "Authenticated users admin_users" ON public.admin_users;

-- =====================================================
-- 4. api_usage_log - API tracking
-- =====================================================
DROP POLICY IF EXISTS "Service role full access api_usage_log" ON public.api_usage_log;

CREATE POLICY "Service role only - api_usage_log"
ON public.api_usage_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure no access for authenticated users
DROP POLICY IF EXISTS "Authenticated users api_usage_log" ON public.api_usage_log;

-- =====================================================
-- 5. card_flags - Content moderation flags
-- =====================================================
DROP POLICY IF EXISTS "Service role full access card_flags" ON public.card_flags;

CREATE POLICY "Service role only - card_flags"
ON public.card_flags
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure no access for authenticated users
DROP POLICY IF EXISTS "Authenticated users card_flags" ON public.card_flags;

-- =====================================================
-- 6. error_log - Error tracking
-- =====================================================
DROP POLICY IF EXISTS "Service role full access error_log" ON public.error_log;

CREATE POLICY "Service role only - error_log"
ON public.error_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure no access for authenticated users
DROP POLICY IF EXISTS "Authenticated users error_log" ON public.error_log;

-- =====================================================
-- 7. system_settings - App settings
-- =====================================================
DROP POLICY IF EXISTS "Service role full access system_settings" ON public.system_settings;

CREATE POLICY "Service role only - system_settings"
ON public.system_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure no access for authenticated users
DROP POLICY IF EXISTS "Authenticated users system_settings" ON public.system_settings;

-- =====================================================
-- Verify RLS is enabled on all tables
-- =====================================================
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Summary
-- =====================================================
-- After running this migration:
-- - Only the service_role (your backend using SUPABASE_SERVICE_ROLE_KEY) can access these tables
-- - Regular authenticated users CANNOT access these tables even if they try
-- - This fixes the "RLS Policy Always True" security warnings
