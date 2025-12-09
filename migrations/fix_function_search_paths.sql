-- Fix function search path security warnings
-- This sets an explicit search_path on all functions to prevent search_path manipulation attacks

-- Fix update_user_credits_updated_at
ALTER FUNCTION public.update_user_credits_updated_at() SET search_path = public;

-- Fix set_user_email_from_auth
ALTER FUNCTION public.set_user_email_from_auth() SET search_path = public, auth;

-- Fix log_admin_activity
ALTER FUNCTION public.log_admin_activity(p_admin_user_id uuid, p_admin_email text, p_action text, p_target_type text, p_target_id text, p_details jsonb, p_ip_address text) SET search_path = public;

-- Fix cleanup_expired_sessions
ALTER FUNCTION public.cleanup_expired_sessions() SET search_path = public;
