-- Migration: Capture signup_platform from auth metadata into users.signup_source
-- Purpose: Mobile app passes options.data.signup_platform on supabase.auth.signUp;
--          this trigger reads it and writes the value to public.users so the admin
--          panel can report new-user counts by platform.
-- Date: 2026-05-19
-- Depends on: add_platform_attribution.sql

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signup_source TEXT;
BEGIN
  -- Resolve signup source: explicit metadata from the client wins, otherwise
  -- default to 'web'. Mobile app passes 'ios_app' or 'android_app'.
  v_signup_source := COALESCE(NEW.raw_user_meta_data->>'signup_platform', 'web');

  -- Create entry in public.users table (for admin panel)
  BEGIN
    INSERT INTO public.users (id, email, created_at, signup_source)
    VALUES (NEW.id, NEW.email, NEW.created_at, v_signup_source)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      -- Only set signup_source on first row creation; never overwrite an
      -- existing value (e.g., a user who re-confirms email shouldn't have
      -- their source clobbered by a stale insert).
      signup_source = COALESCE(public.users.signup_source, EXCLUDED.signup_source),
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create users entry for user %: %', NEW.id, SQLERRM;
  END;

  -- Create profile with email preferences (unchanged)
  BEGIN
    INSERT INTO public.profiles (id, email, marketing_emails_enabled)
    VALUES (NEW.id, NEW.email, true)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;

  -- Schedule 24-hour follow-up email (unchanged)
  BEGIN
    PERFORM schedule_follow_up_email(NEW.id, NEW.email, 24);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to schedule follow-up email for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Trigger itself doesn't need to be re-created — it was already wired in
-- fix_handle_new_user_trigger.sql and points at handle_new_user() by name.
