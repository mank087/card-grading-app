# Market Pricing API Analysis & Recommendations

**Created:** January 14, 2026
**Updated:** January 14, 2026
**Status:** Research Complete - PriceCharting Recommended as Primary API
**Purpose:** Evaluate APIs for real-time and historical pricing data across all DCM card types

---

## Executive Summary

After extensive research, **PriceCharting** emerged as the best single-vendor solution for comprehensive pricing data across all card types.

### 🏆 Primary Recommendation: PriceCharting Legendary ($49/month)

PriceCharting and its sister site SportsCardsPro (same company, same subscription) provide complete coverage:

| Card Type | Coverage | Graded Pricing |
|-----------|----------|----------------|
| **Pokemon** | ✅ | ✅ PSA, BGS, SGC |
| **MTG** | ✅ | ✅ PSA, BGS, SGC |
| **Lorcana** | ✅ | ✅ |
| **Yu-Gi-Oh** | ✅ | ✅ |
| **One Piece** | ✅ | ✅ |
| **Digimon** | ✅ | ✅ |
| **Sports (All)** | ✅ | ✅ PSA, BGS, SGC |

**Key Benefits:**
- Single vendor, single API token, single subscription
- Covers ALL DCM card types (TCGs + Sports)
- Includes graded pricing (PSA, BGS, SGC) for all card types
- 24-hour data updates from eBay sold listings
- CSV bulk downloads included
- Shopify integration available

### Alternative: Multi-API Strategy

If PriceCharting doesn't meet needs, a two-API approach is available:

| Card Type | Primary API | Backup/Secondary | Coverage |
|-----------|-------------|------------------|----------|
| **Pokemon** | JustTCG or Pokemon-API.com | TCGdex (free) | Raw + Graded |
| **MTG** | JustTCG or Scryfall | MTGJSON (free, no prices) | Raw only |
| **Lorcana** | JustTCG or CardMarket-API | - | Raw only |
| **Sports** | SportsCardsPro/PriceCharting | CardHedger | Raw + Graded |
| **Other TCGs** | JustTCG | - | Raw only |

---

## Table of Contents

1. [PriceCharting API (RECOMMENDED)](#1-pricecharting-api-recommended)
2. [TCG APIs (Pokemon, MTG, Lorcana)](#2-tcg-apis-pokemon-mtg-lorcana)
3. [Sports Card APIs](#3-sports-card-apis)
4. [Multi-Category APIs](#4-multi-category-apis)
5. [eBay Data Access](#5-ebay-data-access)
6. [API Comparison Matrix](#6-api-comparison-matrix)
7. [Pricing Comparison](#7-pricing-comparison)
8. [Recommendations](#8-recommendations)
9. [Implementation Strategy](#9-implementation-strategy)
10. [Database Schema](#10-database-schema)
11. [Sources](#11-sources)

---

## 1. PriceCharting API (RECOMMENDED)

### ⭐ PriceCharting / SportsCardsPro - Single Vendor Solution

**Websites:**
- https://www.pricecharting.com (TCGs + Video Games)
- https://www.sportscardspro.com (Sports Cards)

**Note:** Both sites are owned by the same company and share API infrastructure. One Legendary subscription provides access to both.

**Supported TCG Categories:**
- Pokemon Cards
- Magic: The Gathering
- Yu-Gi-Oh Cards
- Disney Lorcana
- One Piece Cards
- Digimon Cards
- Dragon Ball Cards
- Other TCGs

**Supported Sports Card Categories:**
- Baseball Cards
- Basketball Cards
- Football Cards
- Hockey Cards
- Soccer Cards
- Wrestling Cards
- Racing Cards
- UFC Cards

### Pricing Tiers

| Plan | Monthly Cost | API Access | CSV Downloads | Features |
|------|--------------|------------|---------------|----------|
| Free | $0 | ❌ | ❌ | View prices on website |
| Collector | $6/month | ❌ | ❌ | Deal alerts, lot calculator, grading recommendations |
| **Legendary** | **$49/month** | ✅ | ✅ | Full API access, bulk downloads, Shopify integration |

### Graded Card Support

| Grading Company | Supported |
|-----------------|-----------|
| PSA | ✅ |
| BGS/Beckett | ✅ |
| SGC | ✅ |
| Raw/Ungraded | ✅ |

### API Features

**Prices API:**
- Current market prices for items in various grades
- Graded prices (PSA 10, PSA 9, BGS 9.5, etc.)
- Raw/ungraded prices
- Data updated every 24 hours

**Marketplace API:**
- Automate finding and selling items
- Access to marketplace listings

**CSV Downloads:**
- Bulk download all price data
- Updated daily
- Includes UPC and metadata

**Rate Limits:**
- Throttle requests to same URL: max once every 5 minutes
- Unique 40-character API token per subscription

### API Response Example

```json
{
  "status": "success",
  "product-name": "Charizard Holo 1st Edition",
  "console-name": "Pokemon Base Set",
  "loose-price": 45000,
  "cib-price": null,
  "new-price": null,
  "graded-price": null,
  "psa-10-price": 420000,
  "psa-9-price": 85000,
  "psa-8-price": 35000,
  "bgs-10-price": 500000,
  "bgs-9.5-price": 150000,
  "sgc-10-price": 180000
}
```

**Note:** Prices are typically returned in cents (divide by 100 for dollars).

### Why PriceCharting is Recommended

| Benefit | Details |
|---------|---------|
| **Complete Coverage** | Covers ALL DCM card types in one API |
| **Graded Pricing** | PSA, BGS, SGC pricing for all cards |
| **Single Vendor** | One subscription, one API token, one integration |
| **Proven Reliability** | Established platform used by major retailers |
| **Cost Effective** | $49/mo vs $40/mo for two separate APIs, with more features |
| **eBay Data** | Monitors every eBay sale with proprietary matching |
| **Shopify Integration** | Auto-update store prices (bonus feature) |

### Pros
- ✅ Covers ALL card types (TCGs + Sports)
- ✅ Single subscription for everything
- ✅ Graded pricing for PSA, BGS, SGC
- ✅ 24-hour data updates
- ✅ CSV bulk downloads included
- ✅ Shopify integration
- ✅ Established, reliable platform

### Cons
- ❌ Higher monthly cost ($49 vs $40 for alternatives)
- ❌ No historical price data via API (current prices only)
- ❌ Rate limited (5 min between same URL requests)
- ❌ No condition-specific pricing (NM, LP, MP) for TCGs

---

## 2. TCG APIs (Pokemon, MTG, Lorcana)

### JustTCG API ⭐ RECOMMENDED FOR TCGs

**Website:** https://justtcg.com/docs

**Supported Games:**
- Magic: The Gathering
- Pokemon
- Yu-Gi-Oh!
- Disney Lorcana
- One Piece TCG
- Digimon
- Union Arena
- Flesh and Blood TCG
- Grand Archive TCG
- Warhammer 40,000
- Age of Sigmar
- Hololive Official Card Game
- Dragon Ball Super: Fusion World

**Pricing Tiers:**

| Plan | Monthly Cost | Monthly Requests | Daily Limit | Rate Limit |
|------|--------------|------------------|-------------|------------|
| Free | $0 | 1,000 | 100 | 10 req/min |
| Starter | $9.99 | 10,000 | 1,000 | 50 req/min |
| Professional | $29.99 | 50,000 | 5,000 | 100 req/min |
| Enterprise | $99.99 | 500,000 | 50,000 | 500 req/min |

**Data Available:**
- Current USD pricing
- Multiple conditions (Near Mint, Lightly Played, Moderately Played, Heavily Played, Damaged)
- Foil/Normal variants
- Historical price data (7d, 30d, 90d, 180d)
- Price change percentages (24hr, 7d, 30d, 90d, 1yr)
- Statistical metrics (min/max, standard deviation, trend slopes)
- External IDs (TCGPlayer, Scryfall, MTGJSON)

**Key Endpoints:**
```
Base URL: https://api.justtcg.com/v1

GET /games              - List all supported games
GET /sets               - Retrieve sets filtered by game
GET /cards              - Card lookup with batch support
GET /cards/{id}         - Single card details with pricing
GET /cards/{id}/history - Historical price data
```

**Pros:**
- ✅ Covers Pokemon, MTG, AND Lorcana in one API
- ✅ Condition-specific pricing
- ✅ Historical data included
- ✅ Good documentation
- ✅ Reasonable pricing
- ✅ Cross-references TCGPlayer/Scryfall IDs

**Cons:**
- ❌ No sports cards
- ❌ No graded card pricing
- ❌ Relatively new service

---

### Pokemon-API.com / CardMarket-API.com

**Website:** https://pokemon-api.com / https://cardmarket-api.com

**Note:** These appear to be the same service with different branding for different card types.

**Supported Games:**
- Pokemon TCG
- Disney Lorcana
- Star Wars: Unlimited
- One Piece (coming soon)
- Riftbound/LoL (coming soon)

**Pricing Tiers:**

| Plan | Monthly Cost | Daily Requests | Rate Limit |
|------|--------------|----------------|------------|
| Basic | Free | 100 | 30 req/min |
| Pro | $9.90 | 3,000 | 300 req/min |
| Ultra | $24.90 | 15,000 | 300 req/min |
| Mega | $49.50 | 50,000 | 600 req/min |

**Data Sources:**
- TCGPlayer (US) - USD pricing
- Cardmarket (EU) - EUR pricing with country-specific data (DE, FR, ES, IT)

**Graded Card Support:** ✅ Yes
- PSA graded pricing (PSA 10, PSA 9, etc.)
- BGS/Beckett graded pricing
- CGC graded pricing

**Key Features:**
- Real-time pricing aggregation
- Graded card valuations
- Historical price trends
- Sealed product pricing (booster boxes, ETBs)
- 99.9% uptime SLA
- <200ms response times

**Pros:**
- ✅ Includes GRADED card pricing (PSA, BGS, CGC)
- ✅ Both US (TCGPlayer) and EU (Cardmarket) pricing
- ✅ Historical data
- ✅ Sealed products

**Cons:**
- ❌ Limited to Pokemon/Lorcana (no MTG)
- ❌ No sports cards
- ❌ No DCM graded pricing (would need to estimate)

---

### Scryfall API (MTG Only)

**Website:** https://scryfall.com/docs/api

**Supported Games:** Magic: The Gathering ONLY

**Pricing:** FREE (no rate limits, just be respectful)

**Data Sources:**
- TCGPlayer market price (USD)
- Cardmarket trend price (EUR)

**Key Features:**
- Comprehensive MTG card database
- High-quality card images
- Daily price updates
- Excellent documentation
- No API key required

**Endpoints:**
```
Base URL: https://api.scryfall.com

GET /cards/search?q={query}     - Search cards
GET /cards/{id}                 - Get card by Scryfall ID
GET /cards/tcgplayer/{id}       - Get card by TCGPlayer ID
GET /cards/cardmarket/{id}      - Get card by Cardmarket ID
GET /sets                       - List all sets
```

**Pricing Fields in Response:**
```json
{
  "prices": {
    "usd": "12.50",
    "usd_foil": "45.00",
    "usd_etched": "28.00",
    "eur": "10.50",
    "eur_foil": "38.00"
  }
}
```

**Pros:**
- ✅ Completely FREE
- ✅ Excellent card database and images
- ✅ Includes TCGPlayer and Cardmarket IDs
- ✅ Well-documented

**Cons:**
- ❌ MTG only (no Pokemon, Lorcana, Sports)
- ❌ No historical pricing
- ❌ No condition-specific pricing
- ❌ No graded card pricing

---

### TCGdex API (Pokemon Only)

**Website:** https://tcgdex.dev

**Supported Games:** Pokemon TCG ONLY

**Pricing:** FREE (no API key required)

**Data Available:**
- Card information and images
- Set data
- Pricing from Cardmarket and TCGPlayer (via markets endpoint)

**Note:** This is already integrated into DCM for card identification. Could be extended for pricing.

**Pros:**
- ✅ Already integrated into DCM
- ✅ Free
- ✅ Good card data

**Cons:**
- ❌ Pokemon only
- ❌ Limited pricing data
- ❌ No graded pricing
- ❌ No historical data

---

## 3. Sports Card APIs

### SportsCardsPro / PriceCharting API ⭐ RECOMMENDED FOR SPORTS

**Website:** https://www.sportscardspro.com/api-documentation

**Note:** SportsCardsPro is a sister site to PriceCharting, sharing the same API infrastructure.

**Supported Categories:**
- Baseball Cards
- Basketball Cards
- Football Cards
- Hockey Cards
- Soccer Cards
- Wrestling Cards
- Racing Cards
- Boxing Cards
- Golf Cards
- Tennis Cards
- Multi-Sport Cards
- Non-Sport Cards (some)

**Graded Card Support:** ✅ Yes
- PSA graded pricing
- BGS graded pricing
- SGC graded pricing
- Raw/ungraded pricing

**Pricing:**

| Plan | Monthly Cost | Features |
|------|--------------|----------|
| Free | $0 | View prices on website only |
| Premium | $4.99 | CSV downloads, basic API |
| Legendary | $9.99 | Full API access, bulk downloads |

**Data Available:**
- Current market prices (eBay sold data)
- Graded prices by grade (PSA 10, PSA 9, BGS 9.5, etc.)
- Raw/ungraded prices
- Price history
- Card images

**API Response Format:**
```json
{
  "status": "success",
  "product-name": "1989 Upper Deck Ken Griffey Jr. Rookie #1",
  "console-name": "1989 Upper Deck Baseball",
  "psa-10-price": 7500,
  "psa-9-price": 2500,
  "bgs-9.5-price": 3000,
  "ungraded-price": 1500,
  "price-history": [...]
}
```

**Pros:**
- ✅ Comprehensive sports card coverage
- ✅ Graded pricing by company/grade
- ✅ Historical data
- ✅ Affordable pricing
- ✅ Same API as PriceCharting (proven reliability)

**Cons:**
- ❌ No TCG cards (Pokemon, MTG, Lorcana)
- ❌ Prices are in pennies (need conversion)
- ❌ Limited real-time updates (daily)

---

### CardHedger API

**Website:** https://www.cardhedger.com/price_api_business

**Positioning:** "Enterprise-grade Sports Card & Trading Card API"

**Supported Categories:**
- Sports Cards (all major sports)
- Pokemon
- Marvel
- Other collectibles

**Target Market:** Enterprise/B2B applications, ML/AI processes

**Features:**
- Curated and well-structured data
- Custom API endpoints available
- Real-time pricing
- Graded card support

**Pricing:** Custom/Enterprise (contact for pricing)

**Pros:**
- ✅ Covers both sports AND Pokemon
- ✅ Enterprise-grade reliability
- ✅ Custom endpoints

**Cons:**
- ❌ No public pricing
- ❌ Limited documentation
- ❌ Likely expensive for enterprise tier
- ❌ No MTG/Lorcana

---

### PSA Public API

**Website:** https://www.psacard.com/publicapi

**Data Available:**
- PSA cert verification
- PSA population data
- PSA auction prices realized (limited)

**Authentication:** OAuth 2.0 with PSA account credentials

**Note:** This is primarily for cert verification, not comprehensive pricing data.

**Pros:**
- ✅ Official PSA data
- ✅ Population reports
- ✅ Cert verification

**Cons:**
- ❌ Not a pricing API
- ❌ Limited to PSA graded cards
- ❌ No real-time market prices

---

### Card Ladder

**Website:** https://www.cardladder.com

**Positioning:** Most comprehensive sports card price guide with sales dating back to 2000.

**Data Coverage:**
- Sports cards (all major sports)
- Pokemon cards
- 200+ million historical sales

**API Access:** Enterprise-level only (contact for access)

**Pros:**
- ✅ Massive historical dataset
- ✅ Covers sports AND Pokemon
- ✅ Professional-grade analytics

**Cons:**
- ❌ No public API documentation
- ❌ Enterprise pricing (likely expensive)
- ❌ No MTG/Lorcana

---

### Market Movers (Sports Card Investor)

**Website:** https://www.marketmoversapp.com

**Data Coverage:**
- 2.5+ million cards tracked
- Sports cards
- Pokemon cards
- Sealed products

**Data Sources:**
- eBay
- PWCC
- Goldin
- Heritage
- MySlabs

**Graded Support:** PSA, BGS, SGC, CGC, and raw

**API Access:** No public API - app/website only

**Pricing:**
- $9.99/mo - 25 cards, limited features
- $24.99/mo - 250 cards, limited features
- $49.99/mo - Unlimited cards, full features

**Note:** Great for manual research but no programmatic access.

---

### 130Point

**Website:** https://130point.com

**Key Feature:** Shows "Best Offer Accepted" prices from eBay (hidden by eBay itself)

**Data Sources:**
- eBay
- PWCC
- Goldin
- Heritage Auctions
- MySlabs
- Pristine Auctions

**Coverage:** 15+ million sold items

**API Access:** No public API documented

**Note:** Excellent for manual research but no programmatic access.

---

## 4. Multi-Category APIs

### Zyla Labs Sports Card and Trading Card API

**Website:** https://zylalabs.com/api-marketplace/sports/sports+card+and+trading+card+api/2511

**Supported Categories:**
- Sports cards
- Pokemon
- Marvel
- Other collectibles

**Pricing:** Pay-per-request model via RapidAPI

**Pros:**
- ✅ Covers multiple categories
- ✅ Easy integration via RapidAPI

**Cons:**
- ❌ Limited documentation
- ❌ Unknown data freshness
- ❌ No graded pricing mentioned

---

### Ximilar AI-Powered API

**Website:** https://www.ximilar.com

**Approach:** AI-powered card recognition + pricing lookup

**Data Sources:**
- eBay (US)
- Rakuten (Japan)

**Features:**
- Card image recognition
- Grade/condition detection
- Price lookup

**Note:** More focused on image recognition than pricing data.

---

## 5. eBay Data Access

### Official eBay APIs

**Marketplace Insights API:**
- Access to 90 days of sold data
- **LIMITED RELEASE** - requires special approval
- Not available to regular developers

**Browse API:**
- Active listings only
- No sold/completed data

**Terapeak (Built into Seller Hub):**
- Free for eBay sellers
- Shows actual sold prices including Best Offer
- No API access - manual only

### Third-Party eBay Data Services

| Service | Access Type | Data |
|---------|-------------|------|
| 130Point | Website/App | eBay sold + Best Offer prices |
| Market Movers | Website/App | eBay + auction houses |
| PWCC Database | Website | 200M+ eBay sales since 2004 |
| Apify Scraper | Scraping service | eBay sold listings |

**Recommendation:** For eBay data, use SportsCardsPro or PriceCharting which aggregate eBay sold data.

---

## 6. API Comparison Matrix

### TCG Coverage

| API | Pokemon | MTG | Lorcana | Yu-Gi-Oh | One Piece | Cost |
|-----|---------|-----|---------|----------|-----------|------|
| **PriceCharting** ⭐ | ✅ | ✅ | ✅ | ✅ | ✅ | $49/mo |
| JustTCG | ✅ | ✅ | ✅ | ✅ | ✅ | $0-99/mo |
| Pokemon-API | ✅ | ❌ | ✅ | ❌ | 🔜 | $0-50/mo |
| CardMarket-API | ✅ | ❌ | ✅ | ❌ | 🔜 | $0-50/mo |
| Scryfall | ❌ | ✅ | ❌ | ❌ | ❌ | Free |
| TCGdex | ✅ | ❌ | ❌ | ❌ | ❌ | Free |

### Sports Card Coverage

| API | Baseball | Basketball | Football | Hockey | Soccer | Cost |
|-----|----------|------------|----------|--------|--------|------|
| **PriceCharting** ⭐ | ✅ | ✅ | ✅ | ✅ | ✅ | $49/mo |
| SportsCardsPro | ✅ | ✅ | ✅ | ✅ | ✅ | $5-10/mo |
| CardHedger | ✅ | ✅ | ✅ | ✅ | ✅ | Enterprise |
| Card Ladder | ✅ | ✅ | ✅ | ✅ | ✅ | Enterprise |
| Zyla Labs | ✅ | ✅ | ✅ | ? | ? | Pay-per-use |

### Graded Card Support

| API | Raw Prices | PSA | BGS | SGC | CGC | All Cards |
|-----|------------|-----|-----|-----|-----|-----------|
| **PriceCharting** ⭐ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ TCG+Sports |
| JustTCG | ✅ | ❌ | ❌ | ❌ | ❌ | TCG only |
| Pokemon-API | ✅ | ✅ | ✅ | ❌ | ✅ | Pokemon only |
| SportsCardsPro | ✅ | ✅ | ✅ | ✅ | ❌ | Sports only |
| Scryfall | ✅ | ❌ | ❌ | ❌ | ❌ | MTG only |
| CardHedger | ✅ | ✅ | ✅ | ✅ | ✅ | Enterprise |

### Data Features

| API | Historical | Conditions | Foil/Variants | Images | Real-time |
|-----|------------|------------|---------------|--------|-----------|
| **PriceCharting** ⭐ | ❌ | ❌ | ✅ | ✅ | Daily |
| JustTCG | ✅ 180d | ✅ 6 levels | ✅ | ❌ | ✅ |
| Pokemon-API | ✅ | ❌ | ✅ | ❌ | ✅ |
| SportsCardsPro | ✅ | ✅ | N/A | ✅ | Daily |
| Scryfall | ❌ | ❌ | ✅ | ✅ | Daily |
| TCGdex | ❌ | ❌ | ❌ | ✅ | ? |

---

## 7. Pricing Comparison

### Monthly Cost for DCM Use Case

Assuming ~5,000 price lookups/day across all card types:

| API | Plan Needed | Monthly Cost | Notes |
|-----|-------------|--------------|-------|
| **PriceCharting** | Legendary | **$49.00** | ALL cards + Graded pricing ⭐ |
| JustTCG | Professional | $29.99 | Pokemon + MTG + Lorcana (raw only) |
| Pokemon-API | Ultra | $24.90 | Pokemon + Lorcana only |
| SportsCardsPro | Legendary | $9.99 | Sports cards only |
| Scryfall | Free | $0 | MTG only, limited pricing |
| TCGdex | Free | $0 | Pokemon only, limited pricing |

### Recommended Budget

| Option | APIs | Monthly Cost | Coverage |
|--------|------|--------------|----------|
| **Option A (Recommended)** | PriceCharting Legendary | **$49.00** | All TCGs + Sports + Graded |
| Option B (Budget) | JustTCG + SportsCardsPro | $39.98 | All TCGs + Sports (no graded TCGs) |
| Option C (TCG Only) | JustTCG Professional | $29.99 | TCGs only, no sports |

---

## 8. Recommendations

### 🏆 Primary Recommendation: PriceCharting Legendary ($49/month)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DCM Market Pricing Architecture                       │
│                     (PriceCharting Single-Vendor)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│              ┌─────────────────────────────────────────┐               │
│              │      PriceCharting / SportsCardsPro     │               │
│              │         ($49/mo Legendary)              │               │
│              ├─────────────────────────────────────────┤               │
│              │                                         │               │
│              │  TCG Cards:           Sports Cards:     │               │
│              │  ✅ Pokemon           ✅ Baseball       │               │
│              │  ✅ MTG               ✅ Basketball     │               │
│              │  ✅ Lorcana           ✅ Football       │               │
│              │  ✅ Yu-Gi-Oh          ✅ Hockey         │               │
│              │  ✅ One Piece         ✅ Soccer         │               │
│              │  ✅ Digimon           ✅ Wrestling      │               │
│              │  ✅ Dragon Ball       ✅ Racing/UFC     │               │
│              │                                         │               │
│              │  Graded Pricing: PSA, BGS, SGC          │               │
│              └─────────────────────────────────────────┘               │
│                               │                                         │
│                               ▼                                         │
│                  ┌─────────────────────────────┐                       │
│                  │   DCM Price Aggregation     │                       │
│                  │         Service             │                       │
│                  ├─────────────────────────────┤                       │
│                  │ • Unified price endpoint    │                       │
│                  │ • Caching layer (24hr TTL)  │                       │
│                  │ • Rate limit management     │                       │
│                  │ • Historical data storage   │                       │
│                  └─────────────────────────────┘                       │
│                               │                                         │
│                               ▼                                         │
│              ┌─────────────────────────────────────┐                   │
│              │        DCM Card Detail Pages        │                   │
│              │   "Market Value: $XX - $XXX"        │                   │
│              │   "PSA 10: $XXX | BGS 9.5: $XXX"    │                   │
│              └─────────────────────────────────────┘                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why PriceCharting?

| Requirement | PriceCharting | JustTCG + SportsCardsPro |
|-------------|---------------|--------------------------|
| Pokemon cards | ✅ | ✅ |
| MTG cards | ✅ | ✅ |
| Lorcana cards | ✅ | ✅ |
| Sports cards | ✅ | ✅ |
| **Graded pricing (all cards)** | ✅ | ❌ TCGs only raw |
| Historical data | ❌ | ✅ |
| Condition-specific (NM, LP) | ❌ | ✅ |
| Single vendor | ✅ | ❌ |
| **Monthly cost** | **$49** | **$40** |

### Recommendation Summary

| Option | Monthly Cost | Best For |
|--------|--------------|----------|
| **PriceCharting Legendary** | $49 | Complete solution, graded pricing for all cards |
| JustTCG + SportsCardsPro | $40 | Budget-conscious, need condition-specific pricing |
| JustTCG only | $30 | TCGs only, no sports cards needed |

**Our Recommendation:** Go with **PriceCharting Legendary at $49/month** for these reasons:
1. Single API integration = less code, less maintenance
2. Graded pricing for ALL card types (essential for a grading company)
3. Same company owns both sites = consistent data format
4. Only $9/month more than the two-API approach
5. Established platform with proven reliability

### Alternative: Two-API Strategy (Budget Option)

If PriceCharting doesn't meet specific needs (e.g., need historical trends or condition-specific pricing):

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Alternative: Two-API Strategy                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────┐    ┌─────────────────────────────┐   │
│   │        JustTCG API          │    │    SportsCardsPro API       │   │
│   │   ($29.99/mo Professional)  │    │    ($9.99/mo Legendary)     │   │
│   ├─────────────────────────────┤    ├─────────────────────────────┤   │
│   │ ✅ Pokemon                  │    │ ✅ Baseball                 │   │
│   │ ✅ MTG                      │    │ ✅ Basketball               │   │
│   │ ✅ Lorcana                  │    │ ✅ Football                 │   │
│   │ ✅ Yu-Gi-Oh                 │    │ ✅ Hockey                   │   │
│   │ ✅ One Piece                │    │ ✅ Other Sports             │   │
│   │ ✅ Other TCGs               │    │ ✅ PSA/BGS/SGC Graded       │   │
│   │ ✅ Historical (180d)        │    │                             │   │
│   │ ✅ Condition pricing        │    │                             │   │
│   └─────────────────────────────┘    └─────────────────────────────┘   │
│                                                                         │
│   Total: $39.98/month                                                   │
│   Limitation: No graded pricing for TCGs                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Implementation Strategy

### Phase 1: Foundation

**Tasks:**
1. Set up PriceCharting account
   - Subscribe to Legendary tier at https://www.pricecharting.com/pricecharting-pro
   - Retrieve 40-character API token from Subscriptions page
2. Create environment variables for API key
3. Implement base price service with caching (24-hour TTL to match data refresh)

**Database Tables:**

```sql
-- Store API configuration
CREATE TABLE price_api_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name TEXT NOT NULL UNIQUE,
  api_key TEXT, -- Encrypted
  base_url TEXT NOT NULL,
  rate_limit_per_min INTEGER,
  daily_limit INTEGER,
  requests_today INTEGER DEFAULT 0,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cache price lookups
CREATE TABLE price_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_type TEXT NOT NULL, -- 'pokemon', 'mtg', 'sports', etc.
  card_identifier TEXT NOT NULL, -- API-specific ID or search key
  price_data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(card_type, card_identifier)
);

-- Index for quick lookups
CREATE INDEX idx_price_cache_lookup ON price_cache(card_type, card_identifier);
CREATE INDEX idx_price_cache_expiry ON price_cache(expires_at);
```

### Phase 2: TCG Integration

**Tasks:**
1. Implement PriceCharting API client for TCGs
2. Create card matching logic (DCM card → PriceCharting product ID)
3. Add price display to Pokemon, MTG, Lorcana detail pages
4. Implement caching (24-hour TTL to match API refresh rate)

**Card Matching Strategy:**

```typescript
interface CardMatchResult {
  matchType: 'exact' | 'fuzzy' | 'none';
  confidence: number;
  externalId: string | null;
  priceData: PriceData | null;
}

async function matchCardToPriceCharting(card: DCMCard): Promise<CardMatchResult> {
  // PriceCharting uses product search with query string
  const searchQuery = buildSearchQuery(card);

  // Try exact match by set + card name + number
  const results = await searchPriceCharting({
    q: searchQuery,
    t: mapCardTypeToCategory(card.card_type) // 'pokemon-cards', 'magic-cards', etc.
  });

  if (results.length > 0) {
    const bestMatch = results[0];
    const isExact = bestMatch.productName.toLowerCase().includes(card.card_name?.toLowerCase() || '');

    return {
      matchType: isExact ? 'exact' : 'fuzzy',
      confidence: isExact ? 1.0 : 0.8,
      externalId: bestMatch.id,
      priceData: {
        raw: bestMatch.loosePrice,
        psa10: bestMatch.psa10Price,
        psa9: bestMatch.psa9Price,
        bgs95: bestMatch.bgs95Price,
        sgc10: bestMatch.sgc10Price
      }
    };
  }

  return { matchType: 'none', confidence: 0, externalId: null, priceData: null };
}

function mapCardTypeToCategory(cardType: string): string {
  const categoryMap: Record<string, string> = {
    'pokemon': 'pokemon-cards',
    'mtg': 'magic-cards',
    'lorcana': 'lorcana-cards',
    'yugioh': 'yugioh-cards',
    'sports': 'trading-cards', // or specific sport category
    'other': 'trading-cards'
  };
  return categoryMap[cardType] || 'trading-cards';
}
```

### Phase 3: Sports Integration

**Tasks:**
1. Extend PriceCharting client for sports cards (same API, different product categories)
2. Create sports card matching logic
3. Add graded price display (PSA, BGS, SGC values)
4. Show "estimated DCM value" based on raw price

**Graded Price Mapping:**

```typescript
interface GradedPrices {
  raw: number | null;
  psa10: number | null;
  psa9: number | null;
  psa8: number | null;
  bgs95: number | null;
  bgs9: number | null;
  sgc10: number | null;
  sgc9: number | null;
}

// Estimate DCM graded value based on available data
function estimateDCMValue(
  dcmGrade: number,
  gradedPrices: GradedPrices
): { estimate: number; confidence: 'high' | 'medium' | 'low' } {
  // DCM is a new grader, so estimate between raw and recognized graded
  const raw = gradedPrices.raw || 0;

  // For a DCM 10, estimate ~50-70% of PSA 10 value
  // For a DCM 9, estimate ~50-70% of PSA 9 value
  // This is conservative until DCM builds market recognition

  if (dcmGrade === 10 && gradedPrices.psa10) {
    return {
      estimate: Math.round(gradedPrices.psa10 * 0.6),
      confidence: 'medium'
    };
  }

  if (dcmGrade === 9 && gradedPrices.psa9) {
    return {
      estimate: Math.round(gradedPrices.psa9 * 0.6),
      confidence: 'medium'
    };
  }

  // Fallback: Raw price + 20% premium for grading
  return {
    estimate: Math.round(raw * 1.2),
    confidence: 'low'
  };
}
```

### Phase 4: UI Integration

**Tasks:**
1. Add "Market Value" section to card detail pages
2. Show raw price and graded prices (PSA 10, PSA 9, BGS 9.5, etc.)
3. Display "estimated DCM value" based on comparable graded prices
4. Integrate with eBay listing (pre-fill suggested price)

**UI Mockup:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  💰 Market Value                                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Raw/Ungraded:        $45 - $65                                         │
│  PSA 10:              $250 - $350                                       │
│  PSA 9:               $120 - $180                                       │
│  BGS 9.5:             $150 - $220                                       │
│                                                                         │
│  ────────────────────────────────────────────────────────────────────   │
│                                                                         │
│  DCM Graded 9 (Est.): $70 - $110  ⓘ                                    │
│                                                                         │
│  📈 30-Day Trend: +12%                                                  │
│                                                                         │
│  Data from TCGPlayer, Cardmarket, eBay | Last updated: 2 hours ago      │
│                                                                         │
│  [📊 View Price History]  [📦 List on eBay at $89.99]                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Database Schema

### Complete Schema for Price Integration

```sql
-- ============================================
-- Price API Configuration
-- ============================================

CREATE TABLE price_api_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name TEXT NOT NULL UNIQUE, -- 'justtcg', 'sportscardspro', etc.
  api_key TEXT, -- Encrypted at application level
  base_url TEXT NOT NULL,
  rate_limit_per_min INTEGER NOT NULL,
  daily_limit INTEGER NOT NULL,
  requests_today INTEGER DEFAULT 0,
  last_reset_at DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- External Card ID Mapping
-- ============================================

CREATE TABLE card_external_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  api_source TEXT NOT NULL, -- 'justtcg', 'sportscardspro', 'tcgplayer', etc.
  external_id TEXT NOT NULL,
  match_confidence DECIMAL(3,2), -- 0.00 to 1.00
  match_type TEXT, -- 'exact', 'fuzzy', 'manual'
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, api_source)
);

CREATE INDEX idx_card_external_ids_card ON card_external_ids(card_id);
CREATE INDEX idx_card_external_ids_external ON card_external_ids(api_source, external_id);

-- ============================================
-- Price Cache (Short-term, 1-24 hours)
-- ============================================

CREATE TABLE price_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  external_id TEXT, -- For lookups without DCM card
  api_source TEXT NOT NULL,
  price_data JSONB NOT NULL,
  /*
  price_data example:
  {
    "raw": {"low": 4500, "mid": 5500, "high": 6500, "currency": "USD"},
    "psa10": {"low": 25000, "mid": 30000, "high": 35000},
    "psa9": {"low": 12000, "mid": 15000, "high": 18000},
    "conditions": {
      "near_mint": 5500,
      "lightly_played": 4800,
      "moderately_played": 4000
    },
    "foil": {"near_mint": 12000},
    "last_sale": {"price": 5200, "date": "2026-01-10", "platform": "ebay"}
  }
  */
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(card_id, api_source)
);

CREATE INDEX idx_price_cache_expiry ON price_cache(expires_at);
CREATE INDEX idx_price_cache_card ON price_cache(card_id);

-- ============================================
-- Price History (Long-term storage)
-- ============================================

CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  external_id TEXT,
  api_source TEXT NOT NULL,
  recorded_date DATE NOT NULL,
  raw_price INTEGER, -- In cents
  psa10_price INTEGER,
  psa9_price INTEGER,
  bgs95_price INTEGER,
  foil_price INTEGER,
  price_data JSONB, -- Full price snapshot
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, api_source, recorded_date)
);

CREATE INDEX idx_price_history_card_date ON price_history(card_id, recorded_date DESC);

-- ============================================
-- Cleanup: Remove expired cache entries
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_price_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM price_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

---

## 11. Sources

### TCG APIs
- [JustTCG API Documentation](https://justtcg.com/docs)
- [Pokemon-API.com](https://pokemon-api.com/)
- [CardMarket-API.com](https://cardmarket-api.com/)
- [Scryfall API Documentation](https://scryfall.com/docs/api)
- [TCGdex API](https://tcgdex.dev)
- [TCGPlayer Developer Portal](https://developer.tcgplayer.com/)

### Sports Card APIs
- [SportsCardsPro API Documentation](https://www.sportscardspro.com/api-documentation)
- [PriceCharting API Documentation](https://www.pricecharting.com/api-documentation)
- [PSA Public API](https://www.psacard.com/publicapi)
- [CardHedger](https://www.cardhedger.com/price_api_business)

### Market Research Tools
- [130Point](https://130point.com/)
- [Market Movers](https://www.marketmoversapp.com/)
- [Card Ladder](https://www.cardladder.com/)
- [eBay Marketplace Insights API](https://developer.ebay.com/api-docs/buy/static/api-insights.html)

### Articles & Comparisons
- [JustTCG vs Alternatives](https://justtcg.com/blog/justtcg-vs-the-alternatives-choosing-the-right-tcg-pricing-api)
- [TCGPlayer API Alternative for 2025](https://justtcg.com/blog/the-definitive-tcgplayer-api-alternative-for-developers-in-2025)
- [Where Scryfall Prices Come From](https://scryfall.com/docs/faqs/where-do-scryfall-prices-come-from-7)

---

## Next Steps

1. **Decision Required:** Approve PriceCharting Legendary ($49/month) as primary API
2. **Budget Approval:** $49/month for single API subscription
3. **Sign Up:** Subscribe at https://www.pricecharting.com/pricecharting-pro
4. **Get API Token:** Retrieve 40-character token from Subscriptions page
5. **Implementation:** Follow the 4-phase plan outlined above

### Alternative Decision Path

If PriceCharting doesn't meet needs (e.g., require historical trends or condition-specific pricing):
1. Sign up for JustTCG Professional ($29.99/mo)
2. Sign up for SportsCardsPro Legendary ($9.99/mo)
3. Total: $39.98/month (saves $9, but requires two integrations)

---

*Document prepared for DCM Grading - Market Pricing Integration Project*
