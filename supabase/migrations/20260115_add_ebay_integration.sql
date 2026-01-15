-- eBay Integration Tables
-- Created: January 15, 2026
-- Purpose: Store eBay OAuth connections, inventory locations, and listings

-- =============================================================================
-- Table: ebay_connections
-- Purpose: Store eBay OAuth tokens for each user
-- =============================================================================
CREATE TABLE IF NOT EXISTS ebay_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- eBay user info
  ebay_user_id TEXT NOT NULL,
  ebay_username TEXT,

  -- OAuth tokens (encrypted at application level before storage)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ,

  -- Scopes granted by user
  scopes TEXT[] NOT NULL DEFAULT '{}',

  -- Environment
  marketplace_id TEXT DEFAULT 'EBAY_US',
  is_sandbox BOOLEAN DEFAULT FALSE,

  -- Timestamps
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  last_token_refresh_at TIMESTAMPTZ,

  -- Ensure one connection per user
  UNIQUE(user_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_ebay_connections_user_id ON ebay_connections(user_id);

-- RLS Policies
ALTER TABLE ebay_connections ENABLE ROW LEVEL SECURITY;

-- Users can only see their own connection
CREATE POLICY "Users can view own eBay connection"
  ON ebay_connections FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own connection
CREATE POLICY "Users can insert own eBay connection"
  ON ebay_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own connection
CREATE POLICY "Users can update own eBay connection"
  ON ebay_connections FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own connection
CREATE POLICY "Users can delete own eBay connection"
  ON ebay_connections FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- Table: ebay_inventory_locations
-- Purpose: Store merchant inventory locations (required by eBay for listings)
-- =============================================================================
CREATE TABLE IF NOT EXISTS ebay_inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- eBay merchant location key (user-defined, must be unique per user)
  location_id TEXT NOT NULL,
  name TEXT NOT NULL,

  -- Address (optional but recommended)
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',

  -- Status
  is_default BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, location_id)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_ebay_inventory_locations_user_id ON ebay_inventory_locations(user_id);

-- RLS Policies
ALTER TABLE ebay_inventory_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own inventory locations"
  ON ebay_inventory_locations FOR ALL
  USING (auth.uid() = user_id);

-- =============================================================================
-- Table: ebay_listings
-- Purpose: Store eBay listings linked to DCM cards
-- =============================================================================
CREATE TABLE IF NOT EXISTS ebay_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- eBay identifiers
  sku TEXT NOT NULL,
  inventory_item_group_key TEXT,
  offer_id TEXT,
  listing_id TEXT, -- Set after publishing

  -- Listing details
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  quantity INTEGER DEFAULT 1,

  -- Listing type
  listing_format TEXT NOT NULL CHECK (listing_format IN ('FIXED_PRICE', 'AUCTION')),
  duration TEXT, -- 'DAYS_3', 'DAYS_5', 'DAYS_7', 'DAYS_10', 'DAYS_30', 'GTC'

  -- eBay category
  category_id TEXT NOT NULL,

  -- Policy IDs (from user's eBay account)
  fulfillment_policy_id TEXT,
  payment_policy_id TEXT,
  return_policy_id TEXT,

  -- Image URLs on eBay (after upload)
  ebay_image_urls TEXT[] DEFAULT '{}',

  -- Status tracking
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'ended', 'sold', 'cancelled', 'error')),
  listing_url TEXT,
  error_message TEXT,
  error_code TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(card_id, user_id), -- One listing per card per user
  UNIQUE(sku)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ebay_listings_user_status ON ebay_listings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ebay_listings_card_id ON ebay_listings(card_id);
CREATE INDEX IF NOT EXISTS idx_ebay_listings_listing_id ON ebay_listings(listing_id) WHERE listing_id IS NOT NULL;

-- RLS Policies
ALTER TABLE ebay_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own eBay listings"
  ON ebay_listings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own eBay listings"
  ON ebay_listings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own eBay listings"
  ON ebay_listings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own eBay listings"
  ON ebay_listings FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- Table: ebay_user_policies
-- Purpose: Cache user's eBay policies (shipping, returns, payment)
-- =============================================================================
CREATE TABLE IF NOT EXISTS ebay_user_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Policy type
  policy_type TEXT NOT NULL CHECK (policy_type IN ('fulfillment', 'payment', 'return')),

  -- eBay policy info
  policy_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Cached data (JSON blob of full policy details)
  policy_data JSONB,

  -- Is this the default for this type?
  is_default BOOLEAN DEFAULT FALSE,

  -- Timestamps
  cached_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, policy_type, policy_id)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_ebay_user_policies_user_type ON ebay_user_policies(user_id, policy_type);

-- RLS Policies
ALTER TABLE ebay_user_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own eBay policies"
  ON ebay_user_policies FOR ALL
  USING (auth.uid() = user_id);

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON TABLE ebay_connections IS 'Stores eBay OAuth connections for users';
COMMENT ON TABLE ebay_inventory_locations IS 'Stores merchant inventory locations required by eBay';
COMMENT ON TABLE ebay_listings IS 'Tracks eBay listings linked to DCM graded cards';
COMMENT ON TABLE ebay_user_policies IS 'Caches user eBay policies for shipping, returns, and payment';

COMMENT ON COLUMN ebay_connections.access_token IS 'OAuth access token - encrypted at application level';
COMMENT ON COLUMN ebay_connections.refresh_token IS 'OAuth refresh token - encrypted at application level';
COMMENT ON COLUMN ebay_listings.sku IS 'SKU format: DCM-{card_serial} for uniqueness';
COMMENT ON COLUMN ebay_listings.status IS 'draft=not yet submitted, pending=processing, active=live on eBay, ended=listing ended, sold=item sold, cancelled=user cancelled, error=failed';
