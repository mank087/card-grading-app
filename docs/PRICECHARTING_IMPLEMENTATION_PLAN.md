# PriceCharting Integration - Implementation Plan

**Created:** January 14, 2026
**Status:** Ready for Review
**Estimated Effort:** 3-4 development phases
**Monthly Cost:** $49 (Legendary subscription)

---

## Executive Summary

This document outlines the complete implementation plan for integrating PriceCharting's market pricing API into the DCM Grading platform. The integration will provide real-time and graded card pricing across all card categories (Pokemon, MTG, Sports, Lorcana, Other).

### Key Decisions

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| **Where to display pricing** | Card Detail Pages + Standalone Market Page | Best UX - pricing on detail pages, market research on dedicated page |
| **Storage approach** | Database caching with 24hr TTL | Matches API refresh rate, reduces costs |
| **Matching strategy** | Fuzzy search with manual override | Cards have inconsistent naming across platforms |

---

## Table of Contents

1. [PriceCharting API Overview](#1-pricecharting-api-overview)
2. [Architecture Design](#2-architecture-design)
3. [Database Migrations](#3-database-migrations)
4. [API Implementation](#4-api-implementation)
5. [UI Integration](#5-ui-integration)
6. [Card Matching Strategy](#6-card-matching-strategy)
7. [Pages to Create/Modify](#7-pages-to-createmodify)
8. [Implementation Phases](#8-implementation-phases)
9. [Environment Variables](#9-environment-variables)
10. [Testing Strategy](#10-testing-strategy)
11. [Cost & Rate Limit Management](#11-cost--rate-limit-management)

---

## 1. PriceCharting API Overview

### Authentication
- **Method:** API token as query parameter `t`
- **Token:** 40-character string from Subscription page
- **Example:** `https://www.pricecharting.com/api/product?t=YOUR_TOKEN&q=charizard`

### Base URLs
```
TCG Cards:    https://www.pricecharting.com/api/
Sports Cards: https://www.sportscardspro.com/api/
```

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/product` | GET | Single product lookup by ID, UPC, or search query |
| `/api/products` | GET | Search up to 20 products |
| `/api/offers` | GET | Marketplace listings (rate limited) |

### Response Format
- All prices in **pennies** (divide by 100 for dollars)
- Dates in `YYYY-MM-DD` format
- Status: `success` or `error`

### Price Fields Available

| Field | Description |
|-------|-------------|
| `loose-price` | Raw/ungraded card price |
| `cib-price` | Complete in box (not applicable for cards) |
| `new-price` | Factory sealed (not applicable for cards) |
| `graded-price` | Generic graded price |
| `psa-10-price` | PSA Gem Mint 10 |
| `psa-9-price` | PSA Mint 9 |
| `psa-8-price` | PSA NM-MT 8 |
| `bgs-10-price` | BGS Pristine 10 |
| `bgs-9.5-price` | BGS Gem Mint 9.5 |
| `bgs-9-price` | BGS Mint 9 |
| `sgc-10-price` | SGC Pristine 10 |
| `sgc-9.5-price` | SGC Mint+ 9.5 |
| `sgc-9-price` | SGC Mint 9 |

### Rate Limits
- **General:** No documented limit, but be respectful
- **Offers endpoint:** Max once per 5 minutes for same URL
- **Recommendation:** 100ms delay between requests (like Scryfall pattern)

---

## 2. Architecture Design

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         DCM + PriceCharting Architecture                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐        │
│  │   Card Detail    │     │   Market Page    │     │   Collection     │        │
│  │      Pages       │     │   (Standalone)   │     │      Page        │        │
│  └────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘        │
│           │                        │                        │                   │
│           └────────────────────────┼────────────────────────┘                   │
│                                    │                                            │
│                                    ▼                                            │
│                    ┌───────────────────────────────┐                           │
│                    │     Price Service Layer       │                           │
│                    │   src/lib/priceCharting.ts    │                           │
│                    ├───────────────────────────────┤                           │
│                    │ • searchProduct()             │                           │
│                    │ • getProductById()            │                           │
│                    │ • getPriceForCard()           │                           │
│                    │ • matchCardToProduct()        │                           │
│                    │ • formatPriceDisplay()        │                           │
│                    └───────────────────────────────┘                           │
│                                    │                                            │
│                    ┌───────────────┴───────────────┐                           │
│                    │                               │                            │
│                    ▼                               ▼                            │
│     ┌─────────────────────────┐    ┌─────────────────────────┐                │
│     │    Price Cache (DB)     │    │   PriceCharting API     │                │
│     │  (24hr TTL per card)    │    │  www.pricecharting.com  │                │
│     └─────────────────────────┘    │  www.sportscardspro.com │                │
│                                    └─────────────────────────┘                │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User views Card Detail Page
   │
   ▼
2. Check price_cache table for card_id
   │
   ├── Cache HIT (< 24hrs old) → Return cached price data
   │
   └── Cache MISS or EXPIRED
       │
       ▼
3. Check price_card_mapping for pricecharting_id
   │
   ├── Mapping EXISTS → Fetch by pricecharting_id
   │
   └── Mapping NOT FOUND
       │
       ▼
4. Search PriceCharting API with card name/set
   │
   ▼
5. Match results to card (fuzzy matching)
   │
   ▼
6. Store mapping in price_card_mapping
   │
   ▼
7. Store price data in price_cache
   │
   ▼
8. Return price data to UI
```

---

## 3. Database Migrations

### Migration 1: Price Configuration Table

**File:** `supabase/migrations/20260114_create_price_config.sql`

```sql
-- ============================================
-- Price API Configuration
-- ============================================

CREATE TABLE price_api_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name TEXT NOT NULL UNIQUE,
  api_key_encrypted TEXT,  -- Encrypted with Supabase vault or app-level encryption
  base_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  daily_request_count INTEGER DEFAULT 0,
  last_request_reset DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert PriceCharting config (key stored in env vars, not here)
INSERT INTO price_api_config (api_name, base_url, is_active)
VALUES
  ('pricecharting', 'https://www.pricecharting.com/api', true),
  ('sportscardspro', 'https://www.sportscardspro.com/api', true);

-- Enable RLS
ALTER TABLE price_api_config ENABLE ROW LEVEL SECURITY;

-- Only service role can access
CREATE POLICY "Service role only" ON price_api_config
  FOR ALL USING (auth.role() = 'service_role');
```

### Migration 2: Card-to-Product Mapping Table

**File:** `supabase/migrations/20260114_create_price_card_mapping.sql`

```sql
-- ============================================
-- Card to PriceCharting Product Mapping
-- ============================================
-- Links DCM cards to PriceCharting product IDs
-- Persists across price cache refreshes

CREATE TABLE price_card_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- DCM card reference
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,

  -- PriceCharting product reference
  pricecharting_id TEXT NOT NULL,
  pricecharting_url TEXT,
  product_name TEXT NOT NULL,
  console_name TEXT,  -- PriceCharting's category (e.g., "Pokemon Base Set")

  -- Match quality
  match_type TEXT NOT NULL DEFAULT 'auto',  -- 'auto', 'manual', 'verified'
  match_confidence DECIMAL(3,2) DEFAULT 0.80,  -- 0.00 to 1.00

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(card_id)  -- One mapping per card
);

-- Indexes
CREATE INDEX idx_price_mapping_card ON price_card_mapping(card_id);
CREATE INDEX idx_price_mapping_pc_id ON price_card_mapping(pricecharting_id);
CREATE INDEX idx_price_mapping_match_type ON price_card_mapping(match_type);

-- Enable RLS
ALTER TABLE price_card_mapping ENABLE ROW LEVEL SECURITY;

-- Anyone can read mappings
CREATE POLICY "Public read" ON price_card_mapping
  FOR SELECT USING (true);

-- Only authenticated users can create mappings
CREATE POLICY "Authenticated create" ON price_card_mapping
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Only admins can update/delete
CREATE POLICY "Admin update" ON price_card_mapping
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );
```

### Migration 3: Price Cache Table

**File:** `supabase/migrations/20260114_create_price_cache.sql`

```sql
-- ============================================
-- Price Cache
-- ============================================
-- Caches price lookups with 24hr TTL

CREATE TABLE price_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Card reference (nullable for standalone lookups)
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,

  -- PriceCharting product reference
  pricecharting_id TEXT NOT NULL,

  -- Raw prices (in cents, matching API format)
  raw_price INTEGER,  -- Ungraded/loose price

  -- Graded prices (in cents)
  psa_10_price INTEGER,
  psa_9_price INTEGER,
  psa_8_price INTEGER,
  bgs_10_price INTEGER,
  bgs_95_price INTEGER,
  bgs_9_price INTEGER,
  sgc_10_price INTEGER,
  sgc_95_price INTEGER,
  sgc_9_price INTEGER,

  -- Full API response for any other fields
  full_response JSONB,

  -- Cache metadata
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Constraints
  UNIQUE(card_id),
  UNIQUE(pricecharting_id)
);

-- Indexes
CREATE INDEX idx_price_cache_card ON price_cache(card_id);
CREATE INDEX idx_price_cache_expires ON price_cache(expires_at);
CREATE INDEX idx_price_cache_pc_id ON price_cache(pricecharting_id);

-- Enable RLS
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read" ON price_cache
  FOR SELECT USING (true);

-- Service role for writes
CREATE POLICY "Service write" ON price_cache
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Cleanup Function
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_price_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM price_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create a cron job to run cleanup daily
-- (Requires pg_cron extension or external scheduler)
```

### Migration 4: Add Pricing Fields to Cards Table

**File:** `supabase/migrations/20260114_add_pricing_to_cards.sql`

```sql
-- ============================================
-- Add Pricing Fields to Cards Table
-- ============================================
-- Quick-access pricing fields for common display cases

ALTER TABLE cards ADD COLUMN IF NOT EXISTS market_price_raw INTEGER;  -- In cents
ALTER TABLE cards ADD COLUMN IF NOT EXISTS market_price_graded INTEGER;  -- Estimated for DCM grade, in cents
ALTER TABLE cards ADD COLUMN IF NOT EXISTS market_price_psa_10 INTEGER;  -- In cents
ALTER TABLE cards ADD COLUMN IF NOT EXISTS market_price_updated_at TIMESTAMPTZ;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pricecharting_id TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pricecharting_url TEXT;

-- Index for pricing queries
CREATE INDEX IF NOT EXISTS idx_cards_pricecharting ON cards(pricecharting_id);
CREATE INDEX IF NOT EXISTS idx_cards_market_price ON cards(market_price_raw);

-- Comment
COMMENT ON COLUMN cards.market_price_raw IS 'Raw/ungraded market price in cents from PriceCharting';
COMMENT ON COLUMN cards.market_price_graded IS 'Estimated DCM graded value in cents';
COMMENT ON COLUMN cards.market_price_psa_10 IS 'PSA 10 market price in cents for reference';
```

### Migration 5: Price History Table (Optional - Phase 2)

**File:** `supabase/migrations/20260114_create_price_history.sql`

```sql
-- ============================================
-- Price History (for tracking trends)
-- ============================================

CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricecharting_id TEXT NOT NULL,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Prices in cents
  raw_price INTEGER,
  psa_10_price INTEGER,
  psa_9_price INTEGER,
  bgs_95_price INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One record per product per day
  UNIQUE(pricecharting_id, recorded_date)
);

-- Index for trend queries
CREATE INDEX idx_price_history_product_date
  ON price_history(pricecharting_id, recorded_date DESC);

-- Enable RLS
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON price_history
  FOR SELECT USING (true);
```

---

## 4. API Implementation

### File: `src/lib/priceCharting.ts`

```typescript
/**
 * PriceCharting API Client
 *
 * Provides market pricing data for trading cards and sports cards
 * API Documentation: https://www.pricecharting.com/api-documentation
 */

// ============================================
// Types
// ============================================

export interface PriceChartingProduct {
  status: 'success' | 'error';
  id: string;
  'product-name': string;
  'console-name': string;  // Category/Set name
  'release-date'?: string;

  // Prices in pennies
  'loose-price'?: number;
  'cib-price'?: number;
  'new-price'?: number;
  'graded-price'?: number;

  // Graded prices in pennies
  'psa-10-price'?: number;
  'psa-9-price'?: number;
  'psa-8-price'?: number;
  'bgs-10-price'?: number;
  'bgs-9.5-price'?: number;
  'bgs-9-price'?: number;
  'sgc-10-price'?: number;
  'sgc-9.5-price'?: number;
  'sgc-9-price'?: number;
}

export interface PriceChartingSearchResult {
  status: 'success' | 'error';
  products: Array<{
    id: string;
    'product-name': string;
    'console-name': string;
  }>;
}

export interface CardPriceData {
  raw: number | null;           // In dollars
  psa10: number | null;
  psa9: number | null;
  psa8: number | null;
  bgs10: number | null;
  bgs95: number | null;
  bgs9: number | null;
  sgc10: number | null;
  sgc95: number | null;
  sgc9: number | null;
  estimatedDcmValue: number | null;  // Calculated based on DCM grade
  priceChartingId: string;
  priceChartingUrl: string;
  productName: string;
  consoleName: string;
  lastUpdated: string;
}

export interface MatchResult {
  matched: boolean;
  confidence: number;
  priceChartingId: string | null;
  productName: string | null;
  consoleName: string | null;
  priceChartingUrl: string | null;
}

// ============================================
// Configuration
// ============================================

const BASE_URL_TCG = 'https://www.pricecharting.com/api';
const BASE_URL_SPORTS = 'https://www.sportscardspro.com/api';

// Rate limiting - be respectful
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100;  // 100ms between requests

// ============================================
// Helper Functions
// ============================================

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getApiToken(): string {
  const token = process.env.PRICECHARTING_API_KEY;
  if (!token) {
    throw new Error('PRICECHARTING_API_KEY environment variable not set');
  }
  return token;
}

function getBaseUrl(category: string): string {
  const sportsCategories = ['sports', 'baseball', 'basketball', 'football', 'hockey', 'soccer'];
  return sportsCategories.includes(category.toLowerCase()) ? BASE_URL_SPORTS : BASE_URL_TCG;
}

function penniesToDollars(pennies: number | undefined): number | null {
  if (pennies === undefined || pennies === null) return null;
  return pennies / 100;
}

// ============================================
// API Functions
// ============================================

/**
 * Make a rate-limited request to PriceCharting API
 */
async function priceChartingFetch<T>(url: string): Promise<T | null> {
  // Enforce rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DCMCardGrading/1.0'
      }
    });

    if (!response.ok) {
      console.error('PriceCharting API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json() as T;

    // Check for API-level errors
    if ((data as any).status === 'error') {
      console.error('PriceCharting API returned error:', data);
      return null;
    }

    return data;
  } catch (error) {
    console.error('PriceCharting fetch error:', error);
    return null;
  }
}

/**
 * Get product by PriceCharting ID
 */
export async function getProductById(
  productId: string,
  category: string = 'pokemon'
): Promise<PriceChartingProduct | null> {
  const baseUrl = getBaseUrl(category);
  const token = getApiToken();
  const url = `${baseUrl}/product?t=${token}&id=${productId}`;

  return priceChartingFetch<PriceChartingProduct>(url);
}

/**
 * Search for products by query
 */
export async function searchProducts(
  query: string,
  category: string = 'pokemon'
): Promise<PriceChartingSearchResult | null> {
  const baseUrl = getBaseUrl(category);
  const token = getApiToken();
  const url = `${baseUrl}/products?t=${token}&q=${encodeURIComponent(query)}`;

  return priceChartingFetch<PriceChartingSearchResult>(url);
}

/**
 * Get product by search query (returns first match with full pricing)
 */
export async function getProductByQuery(
  query: string,
  category: string = 'pokemon'
): Promise<PriceChartingProduct | null> {
  const baseUrl = getBaseUrl(category);
  const token = getApiToken();
  const url = `${baseUrl}/product?t=${token}&q=${encodeURIComponent(query)}`;

  return priceChartingFetch<PriceChartingProduct>(url);
}

/**
 * Convert API response to CardPriceData format
 */
export function formatPriceData(
  product: PriceChartingProduct,
  dcmGrade?: number
): CardPriceData {
  const raw = penniesToDollars(product['loose-price']);
  const psa10 = penniesToDollars(product['psa-10-price']);
  const psa9 = penniesToDollars(product['psa-9-price']);

  // Estimate DCM value based on grade
  let estimatedDcmValue: number | null = null;
  if (dcmGrade !== undefined && dcmGrade !== null) {
    estimatedDcmValue = estimateDcmValue(dcmGrade, {
      raw,
      psa10,
      psa9,
      psa8: penniesToDollars(product['psa-8-price']),
      bgs95: penniesToDollars(product['bgs-9.5-price']),
    });
  }

  return {
    raw,
    psa10,
    psa9,
    psa8: penniesToDollars(product['psa-8-price']),
    bgs10: penniesToDollars(product['bgs-10-price']),
    bgs95: penniesToDollars(product['bgs-9.5-price']),
    bgs9: penniesToDollars(product['bgs-9-price']),
    sgc10: penniesToDollars(product['sgc-10-price']),
    sgc95: penniesToDollars(product['sgc-9.5-price']),
    sgc9: penniesToDollars(product['sgc-9-price']),
    estimatedDcmValue,
    priceChartingId: product.id,
    priceChartingUrl: `https://www.pricecharting.com/game/${product['console-name']?.toLowerCase().replace(/\s+/g, '-')}/${product['product-name']?.toLowerCase().replace(/\s+/g, '-')}`,
    productName: product['product-name'],
    consoleName: product['console-name'],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Estimate DCM graded value based on comparable graded prices
 *
 * Since DCM is a newer grading company, we estimate value at a discount
 * to established graders (PSA, BGS, SGC) until market recognition builds.
 */
export function estimateDcmValue(
  dcmGrade: number,
  prices: {
    raw: number | null;
    psa10: number | null;
    psa9: number | null;
    psa8: number | null;
    bgs95: number | null;
  }
): number | null {
  // DCM value multiplier (conservative 50-70% of PSA equivalent)
  // This can be adjusted as DCM builds market recognition
  const DCM_MULTIPLIER = 0.60;

  const { raw, psa10, psa9, psa8, bgs95 } = prices;

  // DCM 10 → Compare to PSA 10
  if (dcmGrade >= 9.5 && psa10) {
    return Math.round(psa10 * DCM_MULTIPLIER * 100) / 100;
  }

  // DCM 9-9.4 → Compare to PSA 9 or BGS 9.5
  if (dcmGrade >= 9 && dcmGrade < 9.5) {
    const reference = psa9 || bgs95;
    if (reference) {
      return Math.round(reference * DCM_MULTIPLIER * 100) / 100;
    }
  }

  // DCM 8-8.9 → Compare to PSA 8
  if (dcmGrade >= 8 && dcmGrade < 9 && psa8) {
    return Math.round(psa8 * DCM_MULTIPLIER * 100) / 100;
  }

  // DCM 7 or below → Raw price + small premium
  if (raw) {
    const premium = dcmGrade >= 7 ? 1.15 : 1.05;  // 15% or 5% premium for grading
    return Math.round(raw * premium * 100) / 100;
  }

  return null;
}

/**
 * Build search query from card data
 */
export function buildSearchQuery(card: {
  card_name?: string | null;
  card_set?: string | null;
  card_number?: string | null;
  manufacturer_name?: string | null;
  release_date?: string | null;
  sport?: string | null;
  conversational_card_info?: { card_name?: string; set_name?: string; year?: string } | null;
}): string {
  const parts: string[] = [];

  // Card name (prefer AI-extracted, fall back to manual)
  const cardName = card.card_name || card.conversational_card_info?.card_name;
  if (cardName) {
    parts.push(cardName);
  }

  // Set name
  const setName = card.card_set || card.conversational_card_info?.set_name;
  if (setName) {
    parts.push(setName);
  }

  // Card number (helps with exact matching)
  if (card.card_number) {
    parts.push(`#${card.card_number}`);
  }

  // Year (if no set name)
  if (!setName) {
    const year = card.release_date || card.conversational_card_info?.year;
    if (year) {
      parts.push(year);
    }
  }

  return parts.join(' ').trim();
}

/**
 * Match DCM card to PriceCharting product
 */
export async function matchCardToProduct(card: {
  id: string;
  category?: string | null;
  card_name?: string | null;
  card_set?: string | null;
  card_number?: string | null;
  manufacturer_name?: string | null;
  release_date?: string | null;
  sport?: string | null;
  conversational_card_info?: any;
}): Promise<MatchResult> {
  const category = card.category || 'pokemon';
  const query = buildSearchQuery(card);

  if (!query) {
    return {
      matched: false,
      confidence: 0,
      priceChartingId: null,
      productName: null,
      consoleName: null,
      priceChartingUrl: null,
    };
  }

  // Try direct product search first
  const product = await getProductByQuery(query, category);

  if (product && product.status === 'success') {
    // Calculate match confidence based on name similarity
    const confidence = calculateMatchConfidence(
      query,
      product['product-name'],
      product['console-name']
    );

    return {
      matched: confidence >= 0.6,
      confidence,
      priceChartingId: product.id,
      productName: product['product-name'],
      consoleName: product['console-name'],
      priceChartingUrl: `https://www.pricecharting.com/game/${product['console-name']?.toLowerCase().replace(/\s+/g, '-')}/${product['product-name']?.toLowerCase().replace(/\s+/g, '-')}`,
    };
  }

  return {
    matched: false,
    confidence: 0,
    priceChartingId: null,
    productName: null,
    consoleName: null,
    priceChartingUrl: null,
  };
}

/**
 * Calculate match confidence between search query and result
 */
function calculateMatchConfidence(
  query: string,
  productName: string,
  consoleName: string
): number {
  const queryLower = query.toLowerCase();
  const productLower = productName.toLowerCase();
  const consoleLower = consoleName.toLowerCase();

  // Extract key terms from query
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

  // Count matching terms
  let matchedTerms = 0;
  for (const term of queryTerms) {
    if (productLower.includes(term) || consoleLower.includes(term)) {
      matchedTerms++;
    }
  }

  // Calculate base confidence
  const termConfidence = queryTerms.length > 0 ? matchedTerms / queryTerms.length : 0;

  // Boost for exact product name match
  if (productLower.includes(queryLower) || queryLower.includes(productLower)) {
    return Math.min(termConfidence + 0.3, 1.0);
  }

  return termConfidence;
}

/**
 * Format price for display
 */
export function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

/**
 * Format price range for display
 */
export function formatPriceRange(low: number | null, high: number | null): string {
  if (low === null && high === null) return 'N/A';
  if (low === null) return formatPrice(high);
  if (high === null) return formatPrice(low);
  if (low === high) return formatPrice(low);
  return `${formatPrice(low)} - ${formatPrice(high)}`;
}
```

### File: `src/app/api/prices/[cardId]/route.ts`

```typescript
/**
 * GET /api/prices/[cardId]
 *
 * Fetches market pricing for a specific card
 * Uses caching to minimize API calls
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getProductById,
  matchCardToProduct,
  formatPriceData,
  CardPriceData
} from '@/lib/priceCharting';

export async function GET(
  request: NextRequest,
  { params }: { params: { cardId: string } }
) {
  try {
    const supabase = createClient();
    const cardId = params.cardId;

    // 1. Get card data
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    // 2. Check cache
    const { data: cachedPrice } = await supabase
      .from('price_cache')
      .select('*')
      .eq('card_id', cardId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cachedPrice) {
      return NextResponse.json({
        source: 'cache',
        data: formatCachedPrice(cachedPrice, card.conversational_decimal_grade),
      });
    }

    // 3. Check for existing mapping
    const { data: mapping } = await supabase
      .from('price_card_mapping')
      .select('*')
      .eq('card_id', cardId)
      .single();

    let priceChartingId = mapping?.pricecharting_id;
    let productName = mapping?.product_name;
    let consoleName = mapping?.console_name;

    // 4. If no mapping, try to match
    if (!priceChartingId) {
      const matchResult = await matchCardToProduct(card);

      if (matchResult.matched && matchResult.priceChartingId) {
        priceChartingId = matchResult.priceChartingId;
        productName = matchResult.productName;
        consoleName = matchResult.consoleName;

        // Save mapping for future lookups
        await supabase
          .from('price_card_mapping')
          .upsert({
            card_id: cardId,
            pricecharting_id: priceChartingId,
            product_name: productName,
            console_name: consoleName,
            pricecharting_url: matchResult.priceChartingUrl,
            match_type: 'auto',
            match_confidence: matchResult.confidence,
          });
      } else {
        // No match found
        return NextResponse.json({
          source: 'no_match',
          data: null,
          message: 'Could not find matching product in PriceCharting database',
        });
      }
    }

    // 5. Fetch fresh price data
    const product = await getProductById(priceChartingId, card.category || 'pokemon');

    if (!product) {
      return NextResponse.json(
        { error: 'Failed to fetch price data' },
        { status: 500 }
      );
    }

    // 6. Format and cache
    const priceData = formatPriceData(product, card.conversational_decimal_grade);

    // Save to cache
    await supabase
      .from('price_cache')
      .upsert({
        card_id: cardId,
        pricecharting_id: priceChartingId,
        raw_price: product['loose-price'],
        psa_10_price: product['psa-10-price'],
        psa_9_price: product['psa-9-price'],
        psa_8_price: product['psa-8-price'],
        bgs_10_price: product['bgs-10-price'],
        bgs_95_price: product['bgs-9.5-price'],
        bgs_9_price: product['bgs-9-price'],
        sgc_10_price: product['sgc-10-price'],
        sgc_95_price: product['sgc-9.5-price'],
        sgc_9_price: product['sgc-9-price'],
        full_response: product,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

    // Update card with quick-access pricing
    await supabase
      .from('cards')
      .update({
        market_price_raw: product['loose-price'],
        market_price_psa_10: product['psa-10-price'],
        market_price_graded: priceData.estimatedDcmValue ? Math.round(priceData.estimatedDcmValue * 100) : null,
        market_price_updated_at: new Date().toISOString(),
        pricecharting_id: priceChartingId,
        pricecharting_url: priceData.priceChartingUrl,
      })
      .eq('id', cardId);

    return NextResponse.json({
      source: 'api',
      data: priceData,
    });

  } catch (error) {
    console.error('Price fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function formatCachedPrice(cache: any, dcmGrade?: number): CardPriceData {
  const raw = cache.raw_price ? cache.raw_price / 100 : null;
  const psa10 = cache.psa_10_price ? cache.psa_10_price / 100 : null;
  const psa9 = cache.psa_9_price ? cache.psa_9_price / 100 : null;

  return {
    raw,
    psa10,
    psa9,
    psa8: cache.psa_8_price ? cache.psa_8_price / 100 : null,
    bgs10: cache.bgs_10_price ? cache.bgs_10_price / 100 : null,
    bgs95: cache.bgs_95_price ? cache.bgs_95_price / 100 : null,
    bgs9: cache.bgs_9_price ? cache.bgs_9_price / 100 : null,
    sgc10: cache.sgc_10_price ? cache.sgc_10_price / 100 : null,
    sgc95: cache.sgc_95_price ? cache.sgc_95_price / 100 : null,
    sgc9: cache.sgc_9_price ? cache.sgc_9_price / 100 : null,
    estimatedDcmValue: dcmGrade ? estimateDcmValueFromCache(dcmGrade, { raw, psa10, psa9 }) : null,
    priceChartingId: cache.pricecharting_id,
    priceChartingUrl: cache.full_response?.priceChartingUrl || '',
    productName: cache.full_response?.['product-name'] || '',
    consoleName: cache.full_response?.['console-name'] || '',
    lastUpdated: cache.fetched_at,
  };
}
```

---

## 5. UI Integration

### Approach: Card Detail Pages + Standalone Market Page

**Recommendation:** Display pricing in BOTH locations:

1. **Card Detail Pages** - Show pricing inline with card data
2. **Standalone Market Page** - For research, comparisons, and bulk lookups

### Component: `src/components/pricing/MarketPriceCard.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { CardPriceData, formatPrice } from '@/lib/priceCharting';

interface MarketPriceCardProps {
  cardId: string;
  dcmGrade?: number;
  compact?: boolean;  // For inline display
}

export function MarketPriceCard({ cardId, dcmGrade, compact = false }: MarketPriceCardProps) {
  const [priceData, setPriceData] = useState<CardPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPrice() {
      try {
        setLoading(true);
        const response = await fetch(`/api/prices/${cardId}`);
        const result = await response.json();

        if (result.error) {
          setError(result.error);
        } else if (result.data) {
          setPriceData(result.data);
        } else {
          setError('No pricing data available');
        }
      } catch (err) {
        setError('Failed to fetch pricing');
      } finally {
        setLoading(false);
      }
    }

    fetchPrice();
  }, [cardId]);

  if (loading) {
    return (
      <div className={`animate-pulse ${compact ? 'h-8' : 'h-32'} bg-gray-100 rounded`} />
    );
  }

  if (error || !priceData) {
    return compact ? null : (
      <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded">
        Market pricing unavailable
      </div>
    );
  }

  // Compact display for card detail pages
  if (compact) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="text-gray-500">Raw:</span>{' '}
          <span className="font-semibold">{formatPrice(priceData.raw)}</span>
        </div>
        {dcmGrade && dcmGrade >= 8 && priceData.estimatedDcmValue && (
          <div>
            <span className="text-gray-500">DCM {dcmGrade}:</span>{' '}
            <span className="font-semibold text-green-600">
              ~{formatPrice(priceData.estimatedDcmValue)}
            </span>
          </div>
        )}
        <a
          href={priceData.priceChartingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-xs"
        >
          View on PriceCharting →
        </a>
      </div>
    );
  }

  // Full display
  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-lg">Market Value</h3>
        <a
          href={priceData.priceChartingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          View on PriceCharting →
        </a>
      </div>

      {/* DCM Estimated Value */}
      {dcmGrade && priceData.estimatedDcmValue && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
          <div className="text-sm text-green-700">DCM {dcmGrade} Estimated Value</div>
          <div className="text-2xl font-bold text-green-600">
            {formatPrice(priceData.estimatedDcmValue)}
          </div>
          <div className="text-xs text-green-600 mt-1">
            Based on comparable graded card sales
          </div>
        </div>
      )}

      {/* Raw Price */}
      <div className="mb-4">
        <div className="text-sm text-gray-500">Raw / Ungraded</div>
        <div className="text-xl font-semibold">{formatPrice(priceData.raw)}</div>
      </div>

      {/* Graded Prices Grid */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        {/* PSA */}
        <div className="space-y-1">
          <div className="font-medium text-red-600">PSA</div>
          <div className="flex justify-between">
            <span className="text-gray-500">10:</span>
            <span>{formatPrice(priceData.psa10)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">9:</span>
            <span>{formatPrice(priceData.psa9)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">8:</span>
            <span>{formatPrice(priceData.psa8)}</span>
          </div>
        </div>

        {/* BGS */}
        <div className="space-y-1">
          <div className="font-medium text-blue-600">BGS</div>
          <div className="flex justify-between">
            <span className="text-gray-500">10:</span>
            <span>{formatPrice(priceData.bgs10)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">9.5:</span>
            <span>{formatPrice(priceData.bgs95)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">9:</span>
            <span>{formatPrice(priceData.bgs9)}</span>
          </div>
        </div>

        {/* SGC */}
        <div className="space-y-1">
          <div className="font-medium text-amber-600">SGC</div>
          <div className="flex justify-between">
            <span className="text-gray-500">10:</span>
            <span>{formatPrice(priceData.sgc10)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">9.5:</span>
            <span>{formatPrice(priceData.sgc95)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">9:</span>
            <span>{formatPrice(priceData.sgc9)}</span>
          </div>
        </div>
      </div>

      {/* Data Source */}
      <div className="mt-4 pt-3 border-t text-xs text-gray-400">
        Data from PriceCharting • Updated {new Date(priceData.lastUpdated).toLocaleDateString()}
      </div>
    </div>
  );
}
```

---

## 6. Card Matching Strategy

### Challenge
Card names vary across platforms:
- DCM: "Charizard Holo #4"
- PriceCharting: "Charizard #4 Holo 1999 Base Set"
- TCGPlayer: "Charizard (Base Set 4/102) Holo"

### Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Card Matching Strategy                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. AUTO-MATCH (First Pass)                                            │
│     └── Build query: card_name + set_name + card_number                │
│     └── Search PriceCharting API                                        │
│     └── Calculate confidence score (term matching)                      │
│     └── Accept if confidence >= 0.6                                     │
│                                                                         │
│  2. FUZZY MATCH (Second Pass - if auto fails)                          │
│     └── Try variations: just name, name + year, name + manufacturer    │
│     └── Use product search (returns up to 20 results)                  │
│     └── Rank by similarity score                                        │
│     └── Accept best match if confidence >= 0.5                         │
│                                                                         │
│  3. MANUAL OVERRIDE (Admin/User)                                       │
│     └── UI to search PriceCharting manually                            │
│     └── Select correct product from results                            │
│     └── Save mapping with match_type='manual'                          │
│     └── High confidence (1.0) for manual matches                       │
│                                                                         │
│  4. VERIFIED (Admin Review)                                            │
│     └── Admin can review auto-matched cards                            │
│     └── Mark as verified or correct mapping                            │
│     └── match_type='verified' for confirmed matches                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Admin Interface for Manual Matching

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Manual Price Mapping                                         [Admin]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Card: Charizard Holo #4                                               │
│  Category: Pokemon                                                      │
│  Current Match: None (or Low Confidence: 45%)                          │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Search PriceCharting: [Charizard Base Set_________] [Search]   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Results:                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ○ Charizard #4 Holo - Pokemon Base Set         Raw: $450       │   │
│  │ ○ Charizard #4 1st Edition - Pokemon Base Set  Raw: $5,500     │   │
│  │ ○ Charizard Shadowless - Pokemon Base Set      Raw: $1,200     │   │
│  │ ○ Charizard - Pokemon Base Set 2               Raw: $120       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  [Cancel]                              [Save Selected Match]            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Pages to Create/Modify

### New Pages

| Page | Path | Purpose |
|------|------|---------|
| Market Research | `/market` | Standalone pricing lookup tool |
| Market Search Results | `/market/search` | Search results display |
| Admin Price Mappings | `/admin/price-mappings` | Manage card-to-product mappings |

### Modified Pages

| Page | Path | Changes |
|------|------|---------|
| Pokemon Card Detail | `/pokemon/[id]` | Add MarketPriceCard component |
| MTG Card Detail | `/mtg/[id]` | Add MarketPriceCard component |
| Sports Card Detail | `/sports/[id]` | Add MarketPriceCard component |
| Lorcana Card Detail | `/lorcana/[id]` | Add MarketPriceCard component |
| Other Card Detail | `/other/[id]` | Add MarketPriceCard component |
| Collection Page | `/collection` | Add market value column/summary |
| Admin Card Edit | `/admin/cards/[id]` | Add manual price mapping UI |

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/prices/[cardId]` | GET | Get pricing for specific card |
| `/api/prices/search` | GET | Search PriceCharting products |
| `/api/prices/mapping` | POST | Create manual mapping |
| `/api/prices/mapping/[cardId]` | PUT | Update mapping |
| `/api/prices/mapping/[cardId]` | DELETE | Remove mapping |
| `/api/prices/bulk-refresh` | POST | Refresh prices for multiple cards |

---

## 8. Implementation Phases

### Phase 1: Foundation (Days 1-2)

**Goal:** Set up API client and database infrastructure

**Tasks:**
- [ ] Subscribe to PriceCharting Legendary ($49/month)
- [ ] Retrieve API token from Subscription page
- [ ] Add `PRICECHARTING_API_KEY` to environment variables
- [ ] Create `src/lib/priceCharting.ts` API client
- [ ] Run database migrations (config, mapping, cache tables)
- [ ] Add pricing fields to cards table
- [ ] Write unit tests for API client

**Deliverables:**
- Working API client with rate limiting
- Database tables created
- Basic tests passing

### Phase 2: Core Pricing API (Days 3-4)

**Goal:** Build price lookup and caching system

**Tasks:**
- [ ] Create `/api/prices/[cardId]` endpoint
- [ ] Implement card-to-product matching logic
- [ ] Build caching layer with 24hr TTL
- [ ] Create `/api/prices/search` endpoint
- [ ] Add mapping storage and retrieval
- [ ] Test with sample cards from each category

**Deliverables:**
- Working price API endpoints
- Caching functional
- Matching working for common cards

### Phase 3: UI Components (Days 5-7)

**Goal:** Build user-facing price displays

**Tasks:**
- [ ] Create `MarketPriceCard` component (compact + full)
- [ ] Add to Pokemon CardDetailClient.tsx
- [ ] Add to MTG CardDetailClient.tsx
- [ ] Add to Sports CardDetailClient.tsx
- [ ] Add to Lorcana CardDetailClient.tsx
- [ ] Add to Other CardDetailClient.tsx
- [ ] Create standalone `/market` page
- [ ] Add market value to collection page

**Deliverables:**
- Pricing visible on all card detail pages
- Standalone market research page
- Collection page shows values

### Phase 4: Admin & Polish (Days 8-10)

**Goal:** Admin tools and refinements

**Tasks:**
- [ ] Create admin price mapping interface
- [ ] Add bulk refresh functionality
- [ ] Implement manual matching UI
- [ ] Add price history tracking (optional)
- [ ] Error handling and edge cases
- [ ] Performance optimization
- [ ] Documentation

**Deliverables:**
- Admin can manually map cards
- Bulk operations functional
- Production-ready system

---

## 9. Environment Variables

Add to `.env.local` and Vercel:

```bash
# PriceCharting API
PRICECHARTING_API_KEY=your_40_character_token_here

# Optional: Separate token for sports (if needed)
# SPORTSCARDSPRO_API_KEY=your_40_character_token_here
```

### Vercel Environment Variables

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add `PRICECHARTING_API_KEY` with your token
3. Set for Production, Preview, and Development

---

## 10. Testing Strategy

### Unit Tests

```typescript
// src/lib/__tests__/priceCharting.test.ts

import {
  buildSearchQuery,
  calculateMatchConfidence,
  estimateDcmValue,
  formatPrice
} from '../priceCharting';

describe('PriceCharting Utils', () => {
  describe('buildSearchQuery', () => {
    it('builds query from card name and set', () => {
      const query = buildSearchQuery({
        card_name: 'Charizard',
        card_set: 'Base Set',
        card_number: '4'
      });
      expect(query).toBe('Charizard Base Set #4');
    });

    it('uses AI-extracted info as fallback', () => {
      const query = buildSearchQuery({
        conversational_card_info: {
          card_name: 'Pikachu',
          set_name: 'Jungle'
        }
      });
      expect(query).toBe('Pikachu Jungle');
    });
  });

  describe('estimateDcmValue', () => {
    it('estimates DCM 10 at 60% of PSA 10', () => {
      const value = estimateDcmValue(10, {
        raw: 100,
        psa10: 500,
        psa9: 200,
        psa8: 150,
        bgs95: 300
      });
      expect(value).toBe(300);  // 500 * 0.6
    });

    it('returns raw + premium for low grades', () => {
      const value = estimateDcmValue(6, {
        raw: 100,
        psa10: null,
        psa9: null,
        psa8: null,
        bgs95: null
      });
      expect(value).toBe(105);  // 100 * 1.05
    });
  });
});
```

### Integration Tests

```typescript
// src/app/api/prices/__tests__/route.test.ts

describe('GET /api/prices/[cardId]', () => {
  it('returns cached price when available', async () => {
    // Setup cache...
    const response = await fetch('/api/prices/card-123');
    const data = await response.json();
    expect(data.source).toBe('cache');
  });

  it('fetches from API when cache expired', async () => {
    // Setup expired cache...
    const response = await fetch('/api/prices/card-123');
    const data = await response.json();
    expect(data.source).toBe('api');
  });
});
```

---

## 11. Cost & Rate Limit Management

### Cost Management

| Item | Cost | Notes |
|------|------|-------|
| PriceCharting Legendary | $49/month | Single subscription for all cards |
| API requests | Included | No per-request charges |
| CSV downloads | Included | Bulk data available |

### Rate Limit Strategy

```typescript
// Implemented in priceCharting.ts

// 1. Request throttling (100ms between requests)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100;

// 2. Cache-first approach (24hr TTL)
// - Check cache before API call
// - Reduces API calls by ~95%

// 3. Batch operations for bulk refresh
// - Process cards sequentially with delays
// - Avoid overwhelming the API
```

### Monitoring

```sql
-- Track daily API usage
SELECT
  DATE(created_at) as date,
  COUNT(*) as api_calls
FROM price_cache
WHERE fetched_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## Summary

### Files to Create

| File | Type | Purpose |
|------|------|---------|
| `src/lib/priceCharting.ts` | Library | API client |
| `src/app/api/prices/[cardId]/route.ts` | API | Price lookup |
| `src/app/api/prices/search/route.ts` | API | Product search |
| `src/app/api/prices/mapping/route.ts` | API | Mapping CRUD |
| `src/components/pricing/MarketPriceCard.tsx` | Component | Price display |
| `src/app/market/page.tsx` | Page | Standalone research |
| `src/app/admin/price-mappings/page.tsx` | Page | Admin mappings |

### Database Migrations

| Migration | Purpose |
|-----------|---------|
| `20260114_create_price_config.sql` | API configuration |
| `20260114_create_price_card_mapping.sql` | Card-to-product links |
| `20260114_create_price_cache.sql` | Price caching |
| `20260114_add_pricing_to_cards.sql` | Quick-access fields |
| `20260114_create_price_history.sql` | Historical tracking |

### Total Estimated Effort

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 1 | 2 days | Foundation & API client |
| Phase 2 | 2 days | Core pricing system |
| Phase 3 | 3 days | UI components |
| Phase 4 | 3 days | Admin tools & polish |
| **Total** | **10 days** | Full implementation |

---

## Next Steps

1. **Review this plan** - Provide feedback on approach
2. **Subscribe to PriceCharting** - Get Legendary tier at https://www.pricecharting.com/pricecharting-pro
3. **Retrieve API token** - From Subscription page
4. **Add to environment variables** - Both local and Vercel
5. **Begin Phase 1** - Start implementation

---

*Document prepared for DCM Grading - PriceCharting Integration*
