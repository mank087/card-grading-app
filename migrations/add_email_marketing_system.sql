-- Migration: Add Email Marketing System
-- Purpose: Support 24-hour follow-up emails and unsubscribe management
-- Date: 2025-12-13

-- ============================================
-- 1. USER EMAIL PREFERENCES (in profiles table)
-- ============================================
-- Note: Supabase uses auth.users for authentication, but we should
-- add preferences to a public profiles table or create one

-- Check if profiles table exists, if not create minimal version
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  marketing_emails_enabled BOOLEAN DEFAULT true,
  marketing_unsubscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  unsubscribe_token UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- If profiles already exists, add new columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_emails_enabled BOOLEAN DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_unsubscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unsubscribe_token UUID DEFAULT gen_random_uuid();

-- Index for fast unsubscribe token lookups
CREATE INDEX IF NOT EXISTS idx_profiles_unsubscribe_token
  ON public.profiles(unsubscribe_token);

-- ============================================
-- 2. EMAIL SCHEDULE TABLE
-- ============================================
-- Tracks scheduled emails (follow-up, reminders, etc.)

CREATE TABLE IF NOT EXISTS public.email_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  email_type VARCHAR(50) NOT NULL,  -- 'follow_up_24h', 'inactive_reminder', etc.
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'sent', 'cancelled', 'failed', 'skipped'
  error_message TEXT DEFAULT NULL,
  resend_email_id TEXT DEFAULT NULL,  -- Resend's email ID for tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for cron job to find pending emails efficiently
CREATE INDEX IF NOT EXISTS idx_email_schedule_pending
  ON public.email_schedule(scheduled_for, status)
  WHERE status = 'pending';

-- Index for user lookup (to cancel pending emails if user unsubscribes)
CREATE INDEX IF NOT EXISTS idx_email_schedule_user_id
  ON public.email_schedule(user_id);

-- Prevent duplicate scheduled emails of same type for same user
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_schedule_unique_pending
  ON public.email_schedule(user_id, email_type)
  WHERE status = 'pending';

-- ============================================
-- 3. EMAIL SEND LOG (for analytics/debugging)
-- ============================================

CREATE TABLE IF NOT EXISTS public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  email_type VARCHAR(50) NOT NULL,
  subject TEXT NOT NULL,
  resend_email_id TEXT,
  status VARCHAR(20) NOT NULL,  -- 'sent', 'failed', 'bounced', 'complained'
  error_message TEXT DEFAULT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_email_log_type_date
  ON public.email_log(email_type, sent_at DESC);

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on new tables
ALTER TABLE public.email_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Only service role can access email tables (not users)
CREATE POLICY "Service role only" ON public.email_schedule
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role only" ON public.email_log
  FOR ALL USING (auth.role() = 'service_role');

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own marketing preferences
CREATE POLICY "Users can update own marketing prefs" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- 5. HELPER FUNCTION: Schedule follow-up email
-- ============================================

CREATE OR REPLACE FUNCTION schedule_follow_up_email(
  p_user_id UUID,
  p_user_email TEXT,
  p_delay_hours INTEGER DEFAULT 24
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
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
END;
$$;

-- ============================================
-- 6. TRIGGER: Auto-create profile on user signup
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create profile with email preferences
  INSERT INTO public.profiles (id, email, marketing_emails_enabled)
  VALUES (NEW.id, NEW.email, true)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();

  -- Schedule 24-hour follow-up email
  PERFORM schedule_follow_up_email(NEW.id, NEW.email, 24);

  RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ROLLBACK COMMANDS (if needed)
-- ============================================
/*
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS schedule_follow_up_email(UUID, TEXT, INTEGER);
DROP TABLE IF EXISTS public.email_log;
DROP TABLE IF EXISTS public.email_schedule;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS marketing_emails_enabled;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS marketing_unsubscribed_at;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS unsubscribe_token;
*/
