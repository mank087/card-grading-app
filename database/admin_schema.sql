-- =====================================================
-- ADMIN PANEL DATABASE SCHEMA
-- Card Grading Application
-- Run this in Supabase SQL Editor
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
  admin_email TEXT, -- Store email for deleted admin tracking
  action TEXT NOT NULL,
  target_type TEXT, -- 'user', 'card', 'system', 'settings', etc.
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
  service TEXT NOT NULL, -- 'openai', 'supabase', etc.
  endpoint TEXT,
  operation TEXT, -- 'grade_card', 'identify_card', etc.
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd DECIMAL(10, 6),
  duration_ms INTEGER,
  status TEXT, -- 'success', 'error'
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
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
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
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  flagged_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  flagged_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  flag_type TEXT CHECK (flag_type IN ('inappropriate', 'spam', 'duplicate', 'fake', 'other')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by_admin_id UUID REFERENCES admin_users(id),
  admin_notes TEXT,
  action_taken TEXT, -- 'deleted', 'made_private', 'no_action'
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
  category TEXT, -- 'feature_flags', 'api_config', 'limits', etc.
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
-- ADMIN VIEWS FOR EFFICIENT QUERIES
-- =====================================================

-- User statistics view
CREATE OR REPLACE VIEW admin_user_stats AS
SELECT
  u.id,
  u.email,
  u.created_at,
  COUNT(c.id) AS total_cards,
  COUNT(c.id) FILTER (WHERE c.is_public = true OR c.visibility = 'public') AS public_cards,
  COUNT(c.id) FILTER (WHERE c.is_public = false OR c.visibility = 'private') AS private_cards,
  MAX(c.created_at) AS last_upload_at,
  ROUND(AVG(c.conversational_decimal_grade), 2) AS avg_grade,
  COUNT(c.id) FILTER (WHERE c.created_at > NOW() - INTERVAL '30 days') AS recent_uploads
FROM users u
LEFT JOIN cards c ON c.user_id = u.id
GROUP BY u.id, u.email, u.created_at;

-- Platform-wide grade distribution
CREATE OR REPLACE VIEW admin_grade_distribution AS
SELECT
  ROUND(conversational_decimal_grade) AS grade,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM cards
WHERE conversational_decimal_grade IS NOT NULL
GROUP BY ROUND(conversational_decimal_grade)
ORDER BY grade DESC;

-- Grade distribution by category
CREATE OR REPLACE VIEW admin_grade_distribution_by_category AS
SELECT
  category,
  ROUND(conversational_decimal_grade) AS grade,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY category), 2) AS percentage
FROM cards
WHERE conversational_decimal_grade IS NOT NULL
GROUP BY category, ROUND(conversational_decimal_grade)
ORDER BY category, grade DESC;

-- API usage summary by day
CREATE OR REPLACE VIEW admin_api_usage_daily AS
SELECT
  DATE(created_at) AS date,
  service,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE status = 'success') AS successful_calls,
  COUNT(*) FILTER (WHERE status = 'error') AS failed_calls,
  SUM(total_tokens) AS total_tokens,
  SUM(cost_usd) AS total_cost,
  ROUND(AVG(duration_ms), 2) AS avg_duration_ms
FROM api_usage_log
GROUP BY DATE(created_at), service
ORDER BY date DESC, service;

-- Grading quality control (detect anomalies)
CREATE OR REPLACE VIEW admin_grading_quality_check AS
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS total_graded,
  COUNT(*) FILTER (WHERE conversational_decimal_grade = 10) AS perfect_tens,
  ROUND(COUNT(*) FILTER (WHERE conversational_decimal_grade = 10) * 100.0 / NULLIF(COUNT(*), 0), 2) AS perfect_ten_rate,
  ROUND(AVG(conversational_decimal_grade), 2) AS avg_grade
FROM cards
WHERE conversational_decimal_grade IS NOT NULL
  AND created_at > NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Recent activity summary
CREATE OR REPLACE VIEW admin_recent_activity AS
SELECT
  'user_registered' AS activity_type,
  u.email AS description,
  NULL::UUID AS card_id,
  u.created_at AS activity_at
FROM users u
WHERE u.created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT
  'card_graded' AS activity_type,
  CONCAT(c.card_name, ' - Grade ', c.conversational_decimal_grade) AS description,
  c.id AS card_id,
  c.created_at AS activity_at
FROM cards c
WHERE c.created_at > NOW() - INTERVAL '7 days'
  AND c.conversational_decimal_grade IS NOT NULL
ORDER BY activity_at DESC
LIMIT 50;

-- =====================================================
-- FUNCTIONS FOR COMMON OPERATIONS
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

-- Function to log API usage
CREATE OR REPLACE FUNCTION log_api_usage(
  p_service TEXT,
  p_endpoint TEXT,
  p_operation TEXT,
  p_user_id UUID,
  p_card_id UUID,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER,
  p_cost_usd DECIMAL,
  p_duration_ms INTEGER,
  p_status TEXT,
  p_error_message TEXT
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO api_usage_log (
    service,
    endpoint,
    operation,
    user_id,
    card_id,
    input_tokens,
    output_tokens,
    total_tokens,
    cost_usd,
    duration_ms,
    status,
    error_message
  ) VALUES (
    p_service,
    p_endpoint,
    p_operation,
    p_user_id,
    p_card_id,
    p_input_tokens,
    p_output_tokens,
    COALESCE(p_input_tokens, 0) + COALESCE(p_output_tokens, 0),
    p_cost_usd,
    p_duration_ms,
    p_status,
    p_error_message
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Admin tables should only be accessible via API routes
-- =====================================================

-- Enable RLS on admin tables
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policies: Only service role can access admin tables
-- (All admin operations go through API routes with service role)
CREATE POLICY "Service role full access" ON admin_users FOR ALL USING (true);
CREATE POLICY "Service role full access" ON admin_sessions FOR ALL USING (true);
CREATE POLICY "Service role full access" ON admin_activity_log FOR ALL USING (true);
CREATE POLICY "Service role full access" ON api_usage_log FOR ALL USING (true);
CREATE POLICY "Service role full access" ON error_log FOR ALL USING (true);
CREATE POLICY "Service role full access" ON card_flags FOR ALL USING (true);
CREATE POLICY "Service role full access" ON system_settings FOR ALL USING (true);

-- =====================================================
-- INITIAL ADMIN USER SETUP
-- =====================================================
-- Create a default super admin account
-- Password: admin123 (CHANGE THIS IMMEDIATELY IN PRODUCTION!)
-- Hash generated with bcrypt rounds=12

-- IMPORTANT: This is for development only!
-- In production, create admin via secure process
INSERT INTO admin_users (email, password_hash, role, full_name, is_active)
VALUES (
  'admin@cardgrader.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5koiyUBrKK3Bi', -- 'admin123'
  'super_admin',
  'System Administrator',
  true
)
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- CLEANUP: Function to delete expired sessions
-- Run this periodically via cron or scheduled job
-- =====================================================
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
-- SCHEMA SETUP COMPLETE
-- =====================================================
-- Next steps:
-- 1. Create admin authentication system
-- 2. Build admin panel UI
-- 3. Implement API routes
-- 4. CHANGE DEFAULT ADMIN PASSWORD!
-- =====================================================
