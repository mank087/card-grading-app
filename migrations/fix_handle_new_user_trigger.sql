-- Migration: Fix handle_new_user trigger to be fault-tolerant
-- Purpose: Prevent user signup failures when email scheduling fails
-- Date: 2025-12-15
--
-- ISSUE: The handle_new_user() trigger calls schedule_follow_up_email()
-- which can fail and cause the entire OAuth/signup flow to fail with
-- "server_error" / "unexpected_failure"
--
-- SOLUTION: Wrap email scheduling in exception handler so it fails silently
-- rather than breaking user creation

-- ============================================
-- 1. UPDATE handle_new_user() to be fault-tolerant
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create entry in public.users table (for admin panel)
  BEGIN
    INSERT INTO public.users (id, email, created_at)
    VALUES (NEW.id, NEW.email, NEW.created_at)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create users entry for user %: %', NEW.id, SQLERRM;
  END;

  -- Create profile with email preferences
  BEGIN
    INSERT INTO public.profiles (id, email, marketing_emails_enabled)
    VALUES (NEW.id, NEW.email, true)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;

  -- Schedule 24-hour follow-up email (non-critical - can fail silently)
  BEGIN
    PERFORM schedule_follow_up_email(NEW.id, NEW.email, 24);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to schedule follow-up email for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ============================================
-- 2. Ensure profiles table exists with all columns
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  marketing_emails_enabled BOOLEAN DEFAULT true,
  marketing_unsubscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  unsubscribe_token UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns if they don't exist (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_emails_enabled BOOLEAN DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_unsubscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unsubscribe_token UUID DEFAULT gen_random_uuid();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

-- ============================================
-- 3. Ensure email_schedule table exists
-- ============================================

CREATE TABLE IF NOT EXISTS public.email_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  email_type VARCHAR(50) NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT DEFAULT NULL,
  resend_email_id TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_email_schedule_pending
  ON public.email_schedule(scheduled_for, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_email_schedule_user_id
  ON public.email_schedule(user_id);

-- Unique index to prevent duplicate pending emails of same type
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_schedule_unique_pending
  ON public.email_schedule(user_id, email_type)
  WHERE status = 'pending';

-- ============================================
-- 3b. Ensure email_log table exists (for analytics)
-- ============================================

CREATE TABLE IF NOT EXISTS public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  email_type VARCHAR(50) NOT NULL,
  subject TEXT NOT NULL,
  resend_email_id TEXT,
  status VARCHAR(20) NOT NULL,
  error_message TEXT DEFAULT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_type_date
  ON public.email_log(email_type, sent_at DESC);

-- ============================================
-- 4. Ensure schedule_follow_up_email function exists
-- ============================================

CREATE OR REPLACE FUNCTION schedule_follow_up_email(
  p_user_id UUID,
  p_user_email TEXT,
  p_delay_hours INTEGER DEFAULT 24
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule_id UUID;
BEGIN
  INSERT INTO public.email_schedule (
    user_id,
    user_email,
    email_type,
    scheduled_for,
    status
  ) VALUES (
    p_user_id,
    p_user_email,
    'follow_up_24h',
    NOW() + (p_delay_hours || ' hours')::INTERVAL,
    'pending'
  )
  ON CONFLICT (user_id, email_type) WHERE status = 'pending'
  DO NOTHING
  RETURNING id INTO v_schedule_id;

  RETURN v_schedule_id;
EXCEPTION WHEN OTHERS THEN
  -- Return NULL on any error rather than raising
  RETURN NULL;
END;
$$;

-- ============================================
-- 5. Recreate trigger (just to ensure it's connected)
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 6. RLS Policies (idempotent)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own marketing prefs" ON public.profiles;
DROP POLICY IF EXISTS "Service role full access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Service role only" ON public.email_schedule;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own marketing prefs" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role full access profiles" ON public.profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Email schedule policies
CREATE POLICY "Service role only" ON public.email_schedule
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Email log policies
DROP POLICY IF EXISTS "Service role only email_log" ON public.email_log;
CREATE POLICY "Service role only email_log" ON public.email_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- 7. BACKFILL: Sync missing users from auth.users
-- ============================================
-- This ensures any users created before the fix are synced

-- Backfill public.users from auth.users
INSERT INTO public.users (id, email, created_at)
SELECT id, email, created_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = NOW();

-- Backfill public.profiles from auth.users
INSERT INTO public.profiles (id, email, marketing_emails_enabled)
SELECT id, email, true
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = NOW();

-- ============================================
-- VERIFICATION: Test the trigger doesn't fail
-- ============================================
-- After running this migration, test by creating a new user
-- via OAuth or email/password signup
