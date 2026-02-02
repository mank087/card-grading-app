-- Fix Blog RLS Policies
-- Resolves auth_rls_initplan and multiple_permissive_policies warnings
--
-- Note: service_role key bypasses RLS entirely in Supabase, so we don't need
-- explicit service_role policies. We only need public read policies.

-- Drop the problematic service_all policies (service_role bypasses RLS anyway)
DROP POLICY IF EXISTS "blog_categories_service_all" ON blog_categories;
DROP POLICY IF EXISTS "blog_posts_service_all" ON blog_posts;

-- The public_read policies remain and are sufficient:
-- - blog_categories_public_read: allows everyone to read categories
-- - blog_posts_public_read: allows everyone to read published posts
--
-- Admin operations use supabaseAdmin (service_role key) which bypasses RLS
