# DCM Market Pricing System - Comprehensive Reference

> **Purpose:** This document provides a complete technical reference for the sports card market pricing system. Use this as a blueprint for implementing similar pricing systems for Pokemon, MTG, Lorcana, and other card categories.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture & Data Flow](#2-architecture--data-flow)
3. [API Client Layer](#3-api-client-layer)
4. [API Route Layer](#4-api-route-layer)
5. [UI Component Layer](#5-ui-component-layer)
6. [Database Schema](#6-database-schema)
7. [Caching System](#7-caching-system)
8. [DCM Grade Estimation Algorithm](#8-dcm-grade-estimation-algorithm)
9. [Collection Page Integration](#9-collection-page-integration)
10. [Card Detail Page Integration](#10-card-detail-page-integration)
11. [Implementation Checklist for New Card Types](#11-implementation-checklist-for-new-card-types)

---

## 1. System Overview

### Current Implementation (Sports Cards)

| Component | Technology | File Location |
|-----------|------------|---------------|
| External API | SportsCardsPro.com | `https://www.sportscardspro.com/api` |
| API Client | TypeScript | `src/lib/priceCharting.ts` |
| API Route | Next.js Route | `src/app/api/pricing/pricecharting/route.ts` |
| UI Component | React | `src/components/pricing/PriceChartingLookup.tsx` |
| Price Save API | Next.js Route | `src/app/api/pricing/dcm-save/route.ts` |
| Database | Supabase (PostgreSQL) | `cards` table |

### Environment Variables Required

```env
PRICECHARTING_API_KEY=your_api_key_here
```

The same API key works for both `sportscardspro.com` and `pricecharting.com`.

---

## 2. Architecture & Data Flow

### Flow Diagram

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Card Detail    │      │   Collection    │      │   API Route     │
│     Page        │      │     Page        │      │  /api/pricing/  │
│                 │      │                 │      │  pricecharting  │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         │  <PriceChartingLookup> │  refreshStalePrices()  │
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    POST /api/pricing/pricecharting                  │
│                                                                     │
│  1. Check cache (dcm_cached_prices, 7-day TTL)                     │
│  2. If cache miss → call external API                               │
│  3. Score & rank products by match quality                          │
│  4. Calculate DCM estimated value                                   │
│  5. Save to cache + return data                                     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         External API                                │
│                   sportscardspro.com/api                           │
│                                                                     │
│  Endpoints:                                                         │
│  - GET /api/products?t=TOKEN&q=QUERY   (search)                    │
│  - GET /api/product?t=TOKEN&id=ID      (get prices)                │
└─────────────────────────────────────────────────────────────────────┘
```

### Two-Level Caching

The system uses two separate caching mechanisms:

| Cache Type | Column(s) | Purpose | Used By |
|------------|-----------|---------|---------|
| **Full Cache** | `dcm_cached_prices` (JSONB)<br>`dcm_prices_cached_at` (timestamp) | Complete API response with all price tiers | Card Detail Page |
| **Summary Cache** | `dcm_price_estimate`, `dcm_price_raw`, etc. | Quick-access numeric values | Collection Page |

**Critical:** Both caches must be updated together to keep pages in sync.

---

## 3. API Client Layer

**File:** `src/lib/priceCharting.ts`

### Key Interfaces

```typescript
// Search parameters
interface SportsCardSearchParams {
  playerName: string;        // Required: "Patrick Mahomes"
  year?: string;             // "2020"
  setName?: string;          // "Topps Chrome"
  cardNumber?: string;       // "100" or "RC-1"
  variant?: string;          // "Gold Refractor" (parallel color)
  rookie?: boolean;          // true/false
  sport?: string;            // "Football", "Baseball", etc.
  serialNumbering?: string;  // "23/75" or "/99"
}

// Normalized price response
interface NormalizedPrices {
  raw: number | null;              // Ungraded price in dollars
  psa: Record<string, number>;     // { "7": 100, "8": 200, "9": 400, "10": 1000 }
  bgs: Record<string, number>;     // BGS prices by grade
  sgc: Record<string, number>;     // SGC prices by grade
  estimatedDcm: number | null;     // Calculated DCM value
  productId: string;               // SportsCardsPro product ID
  productName: string;             // "Patrick Mahomes #100 [Gold]"
  setName: string;                 // "Football Cards 2020 Topps Chrome"
  lastUpdated: string;             // ISO timestamp
  salesVolume: string | null;      // Sales volume indicator
  isFallback?: boolean;            // Using similar card pricing
  exactMatchName?: string;         // Original match (if fallback)
}
```

### API Price Field Mappings

The API returns prices in **pennies**. Divide by 100 for dollars.

| API Field | Grade Mapping | Description |
|-----------|---------------|-------------|
| `loose-price` | Raw/Ungraded | Card without professional grading |
| `cib-price` | Grade 7 or 7.5 | Lower graded card |
| `new-price` | Grade 8 or 8.5 | Mid-grade card |
| `graded-price` | Grade 9 | High-grade card |
| `box-only-price` | Grade 9.5 | Near-gem card |
| `manual-only-price` | PSA 10 | Gem mint (PSA) |
| `bgs-10-price` | BGS 10 | Black label (BGS) |
| `condition-17-price` | CGC 10 | Perfect (CGC) |
| `condition-18-price` | SGC 10 | Pristine (SGC) |

### Key Functions

```typescript
// 1. Build search query
function buildSportsCardQuery(params: SportsCardSearchParams): string
// Output: "Patrick Mahomes 2020 Topps Chrome #100 /99 Gold"

// 2. Search products
async function searchProducts(query: string, options?: { limit?: number }): Promise<PriceChartingProduct[]>

// 3. Get detailed prices for a product
async function getProductPrices(productId: string): Promise<SportsCardsPriceResult | null>

// 4. Normalize price response
function normalizePrices(product: SportsCardsPriceResult): NormalizedPrices

// 5. Calculate DCM estimated value
function estimateDcmValue(prices: NormalizedPrices, dcmGrade: number): number | null

// 6. Main search function (combines all above)
async function searchSportsCardPrices(params: SportsCardSearchParams): Promise<{
  prices: NormalizedPrices | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  queryUsed: string;
}>

// 7. Get all parallels for a card
async function getAvailableParallels(params: SportsCardSearchParams): Promise<AvailableParallel[]>
```

### Product Matching & Scoring Algorithm

The `scoreProductMatch()` function assigns points based on match quality:

| Criterion | Points | Required? | Notes |
|-----------|--------|-----------|-------|
| Player name match | +5 per word | Yes | All significant name parts must match |
| Sport validation | +25 | Yes* | Prevents cross-sport matches |
| Card number match | +10 | Yes* | Must contain exact card number |
| Set name overlap | +3 per word | Soft | At least 1 word or year must match |
| Variant/parallel match | +20 | Soft | Color must match if specified |
| Serial numbering match | +15 | Soft | /99, /25, etc. |
| Base card preference | +25 | Soft | When no variant, prefer non-parallel |

**Score thresholds:**
- **Score < 0:** Definite mismatch (skipped)
- **Score 0-14:** Low confidence
- **Score 15-29:** Medium confidence
- **Score 30+:** High confidence

### Variant Filtering

Generic variants are filtered out when building search queries:

```typescript
const genericVariants = [
  'insert', 'base', 'base_common', 'common', 'standard', 'regular',
  'parallel', 'modern_parallel', 'parallel_variant', 'sp', 'ssp',
  'autographed', 'autograph', 'auto', 'rookie', 'rc', 'memorabilia', 'relic', 'patch'
];
```

Only actual parallel colors (e.g., "Gold", "Green Refractor", "Silver Prizm") are included.

---

## 4. API Route Layer

**File:** `src/app/api/pricing/pricecharting/route.ts`

### POST Endpoint

```typescript
// Request body
{
  playerName: string;          // Required
  year?: string;
  setName?: string;
  cardNumber?: string;
  variant?: string;
  rookie?: boolean;
  sport?: string;
  serialNumbering?: string;
  dcmGrade?: number;           // For estimating DCM value
  selectedProductId?: string;  // Manual parallel selection
  includeParallels?: boolean;  // Request available parallels
  cardId?: string;             // For caching
  forceRefresh?: boolean;      // Bypass 7-day cache
}

// Response
{
  success: boolean;
  data?: {
    prices: NormalizedPrices;
    estimatedValue: number | null;
    matchConfidence: 'high' | 'medium' | 'low' | 'none';
    queryUsed: string;
    availableParallels?: AvailableParallel[];
  };
  error?: string;
  cached?: boolean;            // True if from cache
  cacheAge?: number;           // Days since cache
}
```

### Cache Logic Flow

```
1. If cardId provided AND NOT forceRefresh AND NOT selectedProductId:
   → Check dcm_cached_prices column
   → If cache exists AND < 7 days old:
     → Recalculate DCM estimate with current grade
     → Return cached data with cached: true

2. If selectedProductId provided:
   → Fetch prices for that specific product
   → Save to cache
   → Return with matchConfidence: 'high'

3. Otherwise:
   → Call searchSportsCardPrices()
   → Calculate DCM estimate
   → Optionally fetch available parallels
   → Save to cache if cardId provided
   → Return fresh data
```

---

## 5. UI Component Layer

**File:** `src/components/pricing/PriceChartingLookup.tsx`

### Props Interface

```typescript
interface PriceChartingLookupProps {
  card: {
    id?: string;                    // Card ID for saving selections
    player_or_character?: string;   // Player/Pokemon name
    year?: string;                  // Release year
    set_name?: string;              // Set name
    card_number?: string;           // Card number
    rarity_or_variant?: string;     // Rarity classification
    subset?: string;                // Insert name (NOT used for search)
    subset_insert_name?: string;    // Alternative insert name
    parallel_type?: string;         // Actual parallel color (USE THIS)
    rookie_or_first?: boolean;      // Rookie flag
    category?: string;              // Sport/category
    serial_numbering?: string;      // Serial number
    dcm_selected_product_id?: string;   // Saved manual selection
    dcm_selected_product_name?: string;
  };
  dcmGrade?: number;               // DCM grade for estimation
  isOwner?: boolean;               // Can user change selection?
  onPriceLoad?: (data: {           // Callback when data loads
    estimatedValue: number | null;
    matchConfidence: 'high' | 'medium' | 'low' | 'none';
    productName: string | null;
  }) => void;
}
```

### Component Sections

1. **Header** - Title, refresh button, cache indicator
2. **Matched Card Info** - Product name, set name, confidence badge
3. **Parallel Selector** - Expandable dropdown to change match
4. **DCM Estimated Value** - Large gradient card with grade badge
5. **Market Price Range** - 4-box grid (Low, Median, Average, High)
6. **Price by Grade Chart** - Horizontal bar chart (Recharts)
7. **Grading Company Prices** - PSA, BGS, SGC columns
8. **Source Attribution** - Link to SportsCardsPro

### Key UI Features

- **Confidence Badges:**
  - Green "Best Match" → High confidence
  - Yellow "Good Match" → Medium confidence
  - Orange "Partial Match" → Low confidence
  - Red "No Match" → None

- **Fallback Pricing Notice:**
  When exact card has no prices but a similar parallel does

- **Serial Numbered Warning:**
  Price shown may not reflect exact serial number

- **Parallel Selector:**
  - Shows all available variants for the card
  - Owners can manually select different parallel
  - Non-owners see read-only list

---

## 6. Database Schema

### Columns on `cards` Table

#### Summary Columns (Collection Page)

```sql
-- DCM Price Fields (from migration 20260206)
dcm_price_estimate      DECIMAL(10,2)   -- Calculated DCM value
dcm_price_raw           DECIMAL(10,2)   -- Raw/ungraded price
dcm_price_graded_high   DECIMAL(10,2)   -- Highest graded price
dcm_price_median        DECIMAL(10,2)   -- Median across all prices
dcm_price_average       DECIMAL(10,2)   -- Average across all prices
dcm_price_updated_at    TIMESTAMPTZ     -- Last update timestamp
dcm_price_match_confidence TEXT         -- 'high', 'medium', 'low', 'none'
dcm_price_product_id    TEXT            -- SportsCardsPro product ID
dcm_price_product_name  TEXT            -- Matched product name

-- Indexes
CREATE INDEX idx_cards_dcm_price_estimate ON cards(dcm_price_estimate)
  WHERE dcm_price_estimate IS NOT NULL;
CREATE INDEX idx_cards_dcm_price_updated_at ON cards(dcm_price_updated_at)
  WHERE dcm_price_updated_at IS NOT NULL;
```

#### Cache Columns (Card Detail Page)

```sql
-- DCM Pricing Cache (from migration 20260209)
dcm_cached_prices     JSONB       -- Complete API response
dcm_prices_cached_at  TIMESTAMPTZ -- Cache timestamp

-- Index
CREATE INDEX idx_cards_dcm_prices_cached_at
  ON cards(dcm_prices_cached_at)
  WHERE dcm_prices_cached_at IS NOT NULL;
```

### Manual Selection Columns

```sql
dcm_selected_product_id   TEXT  -- User-selected product ID
dcm_selected_product_name TEXT  -- User-selected product name
```

---

## 7. Caching System

### Cache Duration

- **7 days** (configured in `CACHE_DURATION_MS`)

### Cache Check Logic

```typescript
function isCacheFresh(cachedAt: string | null): boolean {
  if (!cachedAt) return false;
  const cacheTime = new Date(cachedAt).getTime();
  const now = Date.now();
  const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  return (now - cacheTime) < CACHE_DURATION_MS;
}
```

### Force Refresh

Set `forceRefresh: true` to bypass cache:
- Used by "Rescan All Prices" button
- Used after manual parallel selection

### Cache Contents (dcm_cached_prices)

```json
{
  "prices": {
    "raw": 25.50,
    "psa": { "7": 50, "8": 100, "9": 250, "10": 500 },
    "bgs": { "9": 220, "9.5": 450, "10": 800 },
    "sgc": { "9": 200, "10": 450 },
    "productId": "12345",
    "productName": "Patrick Mahomes #100",
    "setName": "Football Cards 2020 Topps Chrome",
    "lastUpdated": "2026-02-10T12:00:00.000Z",
    "salesVolume": "High"
  },
  "estimatedValue": 275.50,
  "matchConfidence": "high",
  "queryUsed": "Patrick Mahomes 2020 Topps Chrome #100",
  "availableParallels": [
    { "id": "12345", "name": "Patrick Mahomes #100", "setName": "...", "hasPrice": true },
    { "id": "12346", "name": "Patrick Mahomes #100 [Gold]", "setName": "...", "hasPrice": true }
  ]
}
```

---

## 8. DCM Grade Estimation Algorithm

**File:** `src/lib/priceCharting.ts` - `estimateDcmValue()`

### Algorithm Overview

The DCM estimated value is calculated using **linear interpolation** between available grade prices.

### Steps

1. **Collect available grades** with prices (7, 8, 9, 9.5, 10)
2. **Exact match?** Return that price
3. **Below lowest grade?** Interpolate between raw and lowest graded
4. **Above highest grade?** Return highest graded price
5. **Between grades?** Linear interpolation

### Code

```typescript
function estimateDcmValue(prices: NormalizedPrices, dcmGrade: number): number | null {
  // Get available grades with prices
  const availableGrades = ['7', '8', '9', '9.5', '10']
    .filter(g => prices.psa[g] && prices.psa[g] > 0)
    .map(g => ({ grade: parseFloat(g), price: prices.psa[g] }))
    .sort((a, b) => a.grade - b.grade);

  if (availableGrades.length === 0) {
    return prices.raw; // Fallback to raw
  }

  // Exact match
  const exactMatch = availableGrades.find(g => g.grade === dcmGrade);
  if (exactMatch) return exactMatch.price;

  // Find surrounding grades
  let lowerGrade = availableGrades[0];
  let upperGrade = availableGrades[availableGrades.length - 1];

  for (const g of availableGrades) {
    if (g.grade <= dcmGrade) lowerGrade = g;
    if (g.grade >= dcmGrade) { upperGrade = g; break; }
  }

  // Below lowest: interpolate from raw to lowest
  if (dcmGrade < lowerGrade.grade && prices.raw && dcmGrade < 7) {
    const fraction = (dcmGrade - 1) / 6;
    return prices.raw + (lowerGrade.price - prices.raw) * fraction;
  }

  // Above highest
  if (dcmGrade > upperGrade.grade) return upperGrade.price;

  // Interpolate between grades
  const fraction = (dcmGrade - lowerGrade.grade) / (upperGrade.grade - lowerGrade.grade);
  return lowerGrade.price + (upperGrade.price - lowerGrade.price) * fraction;
}
```

### UI Calculation (Component)

The component also calculates a **DCM multiplier** representing market positioning:

```typescript
// DCM is newer than PSA, so values are a percentage of PSA premium
let dcmMultiplier: number;
if (dcmGrade >= 9.5) dcmMultiplier = 0.70;      // 70% of PSA premium
else if (dcmGrade >= 9) dcmMultiplier = 0.65;   // 65%
else if (dcmGrade >= 8) dcmMultiplier = 0.55;   // 55%
else if (dcmGrade >= 7) dcmMultiplier = 0.45;   // 45%
else dcmMultiplier = 0.35;                       // 35%

// Formula: Raw + (PSA_premium × multiplier)
const psaPremium = psaEquivalentPrice - rawPrice;
const dcmValue = rawPrice + (psaPremium * dcmMultiplier);
```

---

## 9. Collection Page Integration

**File:** `src/app/collection/page.tsx`

### Price Display

```typescript
// Get price for display
const getCardPrice = (card: Card) => {
  // Sports cards: use DCM estimate
  if (isSportsCard(card)) {
    if (card.dcm_price_estimate !== null && card.dcm_price_estimate !== undefined) {
      return card.dcm_price_estimate;
    }
  }
  // Other cards: use eBay median
  return card.ebay_price_median;
};
```

### Auto-Refresh on Load

The collection page automatically refreshes stale prices:

```typescript
useEffect(() => {
  const refreshStalePrices = async () => {
    // Find cards with stale or null prices
    const staleSportsCards = sportsCards.filter(card => {
      const isStale = isPriceStale(card.dcm_price_updated_at);
      const hasNullPrice = card.dcm_price_estimate === null;
      return isStale || hasNullPrice;
    });

    // Refresh each card
    for (const card of staleSportsCards) {
      const response = await fetch('/api/pricing/pricecharting', {
        method: 'POST',
        body: JSON.stringify({
          playerName: cardInfo.player_or_character,
          year: cardInfo.year,
          setName: cardInfo.set_name,
          cardNumber: cardInfo.card_number,
          variant,
          sport: card.category,
          serialNumbering: cardInfo.serial_numbering,
          dcmGrade,
          cardId: card.id,  // CRITICAL: enables cache sync
        }),
      });

      // Save to dcm_price_* columns
      await fetch('/api/pricing/dcm-save', { ... });
    }
  };
}, [cards]);
```

### Manual Rescan All Prices

```typescript
const rescanAllSportsPrices = async () => {
  for (const card of sportsCards) {
    await fetch('/api/pricing/pricecharting', {
      method: 'POST',
      body: JSON.stringify({
        ...searchParams,
        cardId: card.id,      // Saves to dcm_cached_prices
        forceRefresh: true,   // Bypass 7-day cache
      }),
    });

    // Also save to dcm_price_* columns
    await fetch('/api/pricing/dcm-save', { ... });
  }
};
```

---

## 10. Card Detail Page Integration

**File:** `src/app/sports/[id]/CardDetailClient.tsx`

### Component Placement

```tsx
{/* Market & Pricing Section */}
<div id="market-pricing-section" className="bg-gradient-to-r from-gray-700 to-gray-900 ...">
  <h2>Market & Pricing</h2>
</div>

<PriceChartingLookup
  card={{
    id: card.id,
    player_or_character: cardInfo.player_or_character,
    year: cardInfo.year,
    set_name: cardInfo.set_name,
    card_number: cardInfo.card_number,
    serial_numbering: cardInfo.serial_numbering,
    parallel_type: cardInfo.parallel_type,
    rarity_or_variant: cardInfo.rarity_or_variant,
    subset: cardInfo.subset,
    rookie_or_first: cardInfo.rookie_or_first,
    category: card.category,
    dcm_selected_product_id: card.dcm_selected_product_id,
    dcm_selected_product_name: card.dcm_selected_product_name,
  }}
  dcmGrade={card.conversational_decimal_grade}
  isOwner={isOwner}
  onPriceLoad={(data) => {
    setDcmPriceData(data);
  }}
/>
```

### DCM Price Callout (Above Market Section)

```tsx
{dcmPriceData?.estimatedValue && (
  <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-4 shadow-lg">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-white/80 text-sm font-medium">DCM Estimated Price</p>
        <p className="text-white text-3xl font-bold">
          ${dcmPriceData.estimatedValue.toLocaleString()}
        </p>
      </div>
      <a href="#market-pricing-section">View Market Pricing →</a>
    </div>
  </div>
)}
```

---

## 11. Implementation Checklist for New Card Types

### Phase 1: API Client

- [ ] Create `src/lib/{category}Pricing.ts`
- [ ] Define search parameters interface
- [ ] Implement query building function
- [ ] Implement product matching/scoring
- [ ] Add variant handling for card type
- [ ] Implement price normalization
- [ ] Add DCM grade estimation

### Phase 2: API Route

- [ ] Create `src/app/api/pricing/{category}/route.ts`
- [ ] Implement cache check logic
- [ ] Handle manual product selection
- [ ] Integrate with API client
- [ ] Save to cache on success

### Phase 3: UI Component

- [ ] Create `src/components/pricing/{Category}PriceLookup.tsx`
- [ ] Match props interface to card type
- [ ] Implement price display sections
- [ ] Add parallel/variant selector
- [ ] Include confidence indicators
- [ ] Add source attribution

### Phase 4: Database

- [ ] Migration: Add cache columns if not exists
- [ ] Migration: Add summary columns if needed
- [ ] Create indexes for performance

### Phase 5: Integration

- [ ] Card Detail Page: Add pricing component
- [ ] Card Detail Page: Add price callout
- [ ] Collection Page: Add to `refreshStalePrices()`
- [ ] Collection Page: Add to `rescanAllPrices()`
- [ ] Collection Page: Update `getCardPrice()` logic

### Phase 6: Testing

- [ ] Test with known high-value cards
- [ ] Test variant matching accuracy
- [ ] Test cache behavior (7-day TTL)
- [ ] Test force refresh
- [ ] Test manual selection save/load
- [ ] Test collection page sync

---

## Appendix: API Response Examples

### Search Response

```json
{
  "status": "success",
  "products": [
    {
      "id": "12345",
      "product-name": "Patrick Mahomes #100",
      "console-name": "Football Cards 2020 Topps Chrome"
    },
    {
      "id": "12346",
      "product-name": "Patrick Mahomes #100 [Gold]",
      "console-name": "Football Cards 2020 Topps Chrome"
    }
  ]
}
```

### Product Price Response

```json
{
  "status": "success",
  "id": "12345",
  "product-name": "Patrick Mahomes #100",
  "console-name": "Football Cards 2020 Topps Chrome",
  "genre": "Football Card",
  "release-date": "2020-10-14",
  "sales-volume": "High",
  "loose-price": 2550,
  "cib-price": 5000,
  "new-price": 10000,
  "graded-price": 25000,
  "box-only-price": 45000,
  "manual-only-price": 50000,
  "bgs-10-price": 80000,
  "condition-17-price": 45000,
  "condition-18-price": 45000
}
```

---

## Appendix: PriceCharting Pokemon Card Notes

For Pokemon cards, the API structure is identical but:

- **Base URL:** `https://www.pricecharting.com/api` (not sportscardspro)
- **console-name:** "Pokemon Base Set", "Pokemon Jungle", etc.
- **product-name:** "Charizard #4", "Charizard [1st Edition] #4"
- **Variants in name:** `[1st Edition]`, `[Holofoil]`, `[Reverse Holo]`, `[Shadowless]`

Same price fields apply:
- `loose-price` → Raw/Ungraded
- `graded-price` → Grade 9
- `manual-only-price` → PSA 10
- etc.
