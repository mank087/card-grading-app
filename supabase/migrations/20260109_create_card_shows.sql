-- Card Shows Table for Dynamic Landing Pages
-- Created: 2026-01-09
-- Purpose: Store card show information for dynamic Google Ads landing pages

CREATE TABLE IF NOT EXISTS card_shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- URL slug (used in /card-shows/[slug])
  slug VARCHAR(150) UNIQUE NOT NULL,

  -- Basic Info
  name VARCHAR(200) NOT NULL,
  short_name VARCHAR(100),  -- For compact displays

  -- Location
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50),
  country VARCHAR(50) DEFAULT 'USA',
  venue_name VARCHAR(200),
  venue_address VARCHAR(300),

  -- Dates
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Show Details
  show_type VARCHAR(50) DEFAULT 'Sports & TCG',  -- Sports, TCG, Mixed, Pokemon, MTG, etc.
  scope VARCHAR(50) DEFAULT 'Regional',  -- National, Regional, Local
  estimated_tables INTEGER,
  estimated_attendance VARCHAR(100),
  website_url VARCHAR(500),

  -- Content
  description TEXT,
  highlights TEXT[],  -- Array of key features/highlights

  -- Images
  hero_image_url VARCHAR(500),
  logo_url VARCHAR(500),
  thumbnail_url VARCHAR(500),

  -- Marketing
  headline VARCHAR(200),
  subheadline VARCHAR(300),
  special_offer TEXT,
  offer_code VARCHAR(50),
  offer_discount_percent INTEGER,

  -- SEO
  meta_title VARCHAR(150),
  meta_description VARCHAR(300),
  keywords TEXT[],

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_card_shows_slug ON card_shows(slug);
CREATE INDEX idx_card_shows_dates ON card_shows(start_date, end_date);
CREATE INDEX idx_card_shows_active ON card_shows(is_active, start_date);
CREATE INDEX idx_card_shows_featured ON card_shows(is_featured, start_date);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_card_shows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER card_shows_updated_at
  BEFORE UPDATE ON card_shows
  FOR EACH ROW
  EXECUTE FUNCTION update_card_shows_updated_at();

-- Enable Row Level Security
ALTER TABLE card_shows ENABLE ROW LEVEL SECURITY;

-- Public read access (for landing pages)
CREATE POLICY "Public can read active card shows"
  ON card_shows
  FOR SELECT
  USING (is_active = true);

-- Admin full access (service role)
CREATE POLICY "Service role has full access to card shows"
  ON card_shows
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE card_shows IS 'Card shows for dynamic Google Ads landing pages';
