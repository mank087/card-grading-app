-- Blog System Tables Migration
-- Run this in Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Blog Categories
CREATE TABLE IF NOT EXISTS blog_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#7c3aed',
  sort_order INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO blog_categories (slug, name, description, sort_order) VALUES
  ('grading-guides', 'Grading Guides', 'How-to content for card grading', 1),
  ('market-insights', 'Market Insights', 'Price trends and investment analysis', 2),
  ('card-spotlights', 'Card Spotlights', 'Deep dives on specific cards and sets', 3),
  ('news', 'News', 'Industry updates and announcements', 4),
  ('tips-tricks', 'Tips & Tricks', 'Photography, condition assessment, and more', 5)
ON CONFLICT (slug) DO NOTHING;

-- Blog Posts
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image_path TEXT,
  featured_image_alt TEXT,
  category_id UUID REFERENCES blog_categories(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  meta_title TEXT,
  meta_description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'scheduled', 'archived')),
  published_at TIMESTAMPTZ,
  author_name TEXT DEFAULT 'DCM Team',
  view_count INTEGER DEFAULT 0,
  read_time_minutes INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Indexes for blog_posts
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published ON blog_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category_id);

-- Auto-calculate read time trigger
CREATE OR REPLACE FUNCTION set_blog_read_time()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate read time based on word count (average 200 words per minute)
  NEW.read_time_minutes := GREATEST(1, ROUND(array_length(regexp_split_to_array(COALESCE(NEW.content, ''), '\s+'), 1) / 200.0));
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_blog_read_time ON blog_posts;
CREATE TRIGGER trigger_blog_read_time
BEFORE INSERT OR UPDATE OF content ON blog_posts
FOR EACH ROW EXECUTE FUNCTION set_blog_read_time();

-- Function to update category post counts
CREATE OR REPLACE FUNCTION update_blog_category_post_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update old category count if category changed
  IF TG_OP = 'UPDATE' AND OLD.category_id IS DISTINCT FROM NEW.category_id THEN
    IF OLD.category_id IS NOT NULL THEN
      UPDATE blog_categories
      SET post_count = (
        SELECT COUNT(*) FROM blog_posts
        WHERE category_id = OLD.category_id
        AND status = 'published'
      )
      WHERE id = OLD.category_id;
    END IF;
  END IF;

  -- Update new category count
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.category_id IS NOT NULL THEN
    UPDATE blog_categories
    SET post_count = (
      SELECT COUNT(*) FROM blog_posts
      WHERE category_id = NEW.category_id
      AND status = 'published'
    )
    WHERE id = NEW.category_id;
  END IF;

  -- Handle delete
  IF TG_OP = 'DELETE' AND OLD.category_id IS NOT NULL THEN
    UPDATE blog_categories
    SET post_count = (
      SELECT COUNT(*) FROM blog_posts
      WHERE category_id = OLD.category_id
      AND status = 'published'
    )
    WHERE id = OLD.category_id;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_update_category_post_count ON blog_posts;
CREATE TRIGGER trigger_update_category_post_count
AFTER INSERT OR UPDATE OF status, category_id OR DELETE ON blog_posts
FOR EACH ROW EXECUTE FUNCTION update_blog_category_post_count();

-- Row Level Security for blog tables
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Public read access for categories (everyone can read)
CREATE POLICY "blog_categories_public_read" ON blog_categories
  FOR SELECT USING (true);

-- Public read access for published posts only
CREATE POLICY "blog_posts_public_read" ON blog_posts
  FOR SELECT USING (status = 'published' AND published_at <= NOW());

-- Service role can do everything (for admin API)
CREATE POLICY "blog_categories_service_all" ON blog_categories
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "blog_posts_service_all" ON blog_posts
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON blog_categories TO anon, authenticated;
GRANT SELECT ON blog_posts TO anon, authenticated;
GRANT ALL ON blog_categories TO service_role;
GRANT ALL ON blog_posts TO service_role;
