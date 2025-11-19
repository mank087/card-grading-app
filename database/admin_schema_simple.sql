-- =====================================================
-- ADMIN PANEL DATABASE SCHEMA (SIMPLIFIED)
-- Card Grading Application
-- Run this in Supabase SQL Editor
-- This version doesn't depend on existing users/cards tables
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ADMIN USERS TABLE
-- Stores admin user accounts with role-based access
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'moderator', 'support')),
  full_name TEXT,
  two_factor_secret TEXT,
  two_factor_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  last_login_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES admin_users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- =====================================================
-- ADMIN SESSIONS TABLE
-- Tracks active admin sessions for security
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user_id ON admin_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- =====================================================
-- ADMIN ACTIVITY LOG TABLE
-- Comprehensive audit log for all admin actions
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID REFERENCES admin_users(id),
  admin_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_user_id ON admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_action ON admin_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_activity_target_type ON admin_activity_log(target_type);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity_log(created_at DESC);

-- =====================================================
-- API USAGE LOG TABLE
-- Track API calls for cost monitoring
-- =====================================================
CREATE TABLE IF NOT EXISTS api_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service TEXT NOT NULL,
  endpoint TEXT,
  operation TEXT,
  user_id UUID,
  card_id UUID,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd DECIMAL(10, 6),
  duration_ms INTEGER,
  status TEXT,
  error_message TEXT,
  request_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for usage queries
CREATE INDEX IF NOT EXISTS idx_api_usage_service ON api_usage_log(service);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_status ON api_usage_log(status);

-- =====================================================
-- ERROR LOG TABLE
-- Track application errors for monitoring
-- =====================================================
CREATE TABLE IF NOT EXISTS error_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  error_type TEXT NOT NULL,
  error_message TEXT,
  stack_trace TEXT,
  user_id UUID,
  route TEXT,
  method TEXT,
  request_body JSONB,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES admin_users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for error queries
CREATE INDEX IF NOT EXISTS idx_error_log_severity ON error_log(severity);
CREATE INDEX IF NOT EXISTS idx_error_log_resolved ON error_log(resolved);
CREATE INDEX IF NOT EXISTS idx_error_log_created_at ON error_log(created_at DESC);

-- =====================================================
-- CARD FLAGS TABLE
-- Content moderation and reporting
-- =====================================================
CREATE TABLE IF NOT EXISTS card_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID,
  flagged_by_user_id UUID,
  flagged_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  flag_type TEXT CHECK (flag_type IN ('inappropriate', 'spam', 'duplicate', 'fake', 'other')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by_admin_id UUID REFERENCES admin_users(id),
  admin_notes TEXT,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- Indexes for moderation queue
CREATE INDEX IF NOT EXISTS idx_card_flags_card_id ON card_flags(card_id);
CREATE INDEX IF NOT EXISTS idx_card_flags_status ON card_flags(status);
CREATE INDEX IF NOT EXISTS idx_card_flags_created_at ON card_flags(created_at DESC);

-- =====================================================
-- SYSTEM SETTINGS TABLE
-- Configurable system settings and feature flags
-- =====================================================
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_by UUID REFERENCES admin_users(id)
);

-- Insert default settings
INSERT INTO system_settings (key, value, description, category) VALUES
  ('public_gallery_enabled', 'true', 'Enable/disable public gallery', 'feature_flags'),
  ('new_registrations_enabled', 'true', 'Allow new user registrations', 'feature_flags'),
  ('maintenance_mode', 'false', 'Put site in maintenance mode', 'feature_flags'),
  ('max_upload_size_mb', '10', 'Maximum upload file size in MB', 'limits'),
  ('rate_limit_uploads_per_hour', '10', 'Upload rate limit per hour per user', 'limits'),
  ('openai_model', '"gpt-4o"', 'OpenAI model to use for grading', 'api_config'),
  ('grading_enabled', 'true', 'Enable AI grading functionality', 'feature_flags')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policies: Service role has full access
CREATE POLICY "Service role full access admin_users" ON admin_users FOR ALL USING (true);
CREATE POLICY "Service role full access admin_sessions" ON admin_sessions FOR ALL USING (true);
CREATE POLICY "Service role full access admin_activity_log" ON admin_activity_log FOR ALL USING (true);
CREATE POLICY "Service role full access api_usage_log" ON api_usage_log FOR ALL USING (true);
CREATE POLICY "Service role full access error_log" ON error_log FOR ALL USING (true);
CREATE POLICY "Service role full access card_flags" ON card_flags FOR ALL USING (true);
CREATE POLICY "Service role full access system_settings" ON system_settings FOR ALL USING (true);

-- =====================================================
-- INITIAL ADMIN USER
-- =====================================================
-- Password: admin123
-- Hash generated with bcrypt rounds=12
INSERT INTO admin_users (email, password_hash, role, full_name, is_active)
VALUES (
  'admin@cardgrader.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5koiyUBrKK3Bi',
  'super_admin',
  'System Administrator',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  updated_at = NOW();

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to log admin activity
CREATE OR REPLACE FUNCTION log_admin_activity(
  p_admin_user_id UUID,
  p_admin_email TEXT,
  p_action TEXT,
  p_target_type TEXT,
  p_target_id TEXT,
  p_details JSONB,
  p_ip_address TEXT
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO admin_activity_log (
    admin_user_id,
    admin_email,
    action,
    target_type,
    target_id,
    details,
    ip_address
  ) VALUES (
    p_admin_user_id,
    p_admin_email,
    p_action,
    p_target_type,
    p_target_id,
    p_details,
    p_ip_address
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM admin_sessions
  WHERE expires_at < NOW();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Admin panel database schema created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Default admin credentials:';
  RAISE NOTICE 'Email: admin@cardgrader.com';
  RAISE NOTICE 'Password: admin123';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: Change this password immediately after first login!';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 You can now access the admin panel at /admin/login';
END $$;
