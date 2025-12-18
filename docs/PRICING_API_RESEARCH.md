# Card Pricing API Research

**Prepared:** December 2024
**Purpose:** Evaluate options for adding market pricing data to DCM card databases (Sports, Pokemon, MTG, Lorcana)

---

## Executive Summary

DCM needs pricing data across multiple card categories:
- **Sports Cards:** Baseball, Basketball, Football
- **Pokemon TCG**
- **Magic: The Gathering**
- **Disney Lorcana**

This document evaluates API options for fetching sold/market prices, either via real-time API calls or periodic bulk imports.

---

## The eBay Problem

**eBay's official Finding API was decommissioned on February 5, 2025.** The `findCompletedItems` endpoint that provided sold listing data is no longer available.

The replacement "Marketplace Insights API" is **restricted to approved business partners only** (like Terapeak) - not available to regular developers.

**Bottom line:** Direct eBay API access for sold data is not an option. We need third-party aggregators.

---

## Option 1: PriceCharting + SportsCardsPro

**Website:** https://www.pricecharting.com
**Sports Site:** https://www.sportscardspro.com

### Overview
PriceCharting (founded 2007) is the most established price guide for collectibles. They monitor eBay, Heritage, PWCC, and other marketplaces daily. SportsCardsPro is their sister site specifically for sports cards.

### Coverage

| Site | Categories |
|------|------------|
| **PriceCharting** | Pokemon, MTG, Yu-Gi-Oh, One Piece, Digimon, Lorcana, Video Games, Funko, Comics, LEGO, Coins |
| **SportsCardsPro** | Baseball, Basketball, Football, Hockey, Soccer, Racing, Wrestling, UFC, Pokemon, Funko |

### Data Provided
- Product name, set, release date
- **Graded prices:** PSA 10, PSA 9, BGS 10, BGS 9.5, CGC grades
- **Raw/Ungraded prices**
- UPC and ASIN identifiers
- Sales volume data
- Retail buy/sell recommendations

### API Details
- **Method:** REST API (GET/POST)
- **Response:** JSON
- **Prices:** Integer pennies (e.g., $17.32 = 1732)
- **Limitation:** Single product lookups only
- **Historical data:** Not supported via API

### Bulk CSV Downloads
- Available to "Legendary" subscribers
- Generated once every 24 hours
- More efficient for bulk database updates

### Pricing
- Paid subscription required (no free tier)
- Specific pricing not publicly listed
- Need to contact or visit subscription page

### Pros
- Most comprehensive and established data source
- Covers both TCGs and sports cards (across two sites)
- Daily updated data from multiple marketplaces
- Graded card values included
- Bulk CSV option perfect for weekly refresh

### Cons
- Requires two separate subscriptions
- No free tier to test
- Single-product API limits (CSV better for bulk)

### Links
- API Docs: https://www.pricecharting.com/api-documentation
- SportsCardsPro API: https://www.sportscardspro.com/api-documentation
- Pricing: https://www.pricecharting.com/pricecharting-pro

---

## Option 2: JustTCG

**Website:** https://justtcg.com

### Overview
Developer-focused TCG pricing API. "Built for developers, by collectors who get TCGs."

### Coverage

| Game | Card Count |
|------|------------|
| Magic: The Gathering | 100,000+ |
| Yu-Gi-Oh! | 35,000+ |
| Pokemon TCG | 20,000+ |
| One Piece TCG | 5,000+ |
| Digimon TCG | 4,000+ |
| Disney Lorcana | 1,000+ |

*Continuously expanding to additional games*

### Data Provided
- Card identification and metadata
- Condition-specific pricing (NM, LP, MP, HP, etc.)
- Foil/variant/promo tracking
- Price history and 24-hour changes
- Last update timestamps

### API Details
- **Response time:** ~50ms average
- **Update frequency:** Every 6 hours
- **Bulk operations:** Up to 100 cards per call

### Pricing Tiers

| Tier | API Calls/Day | Price |
|------|---------------|-------|
| Free | 1,000 | $0 |
| Paid tiers | More | Not specified |

*No credit card required for free tier*

### Pros
- Generous free tier (1,000 calls/day)
- Fast response times (50ms)
- Condition-specific pricing
- Bulk card lookups (100 per call)
- All major TCGs in one API
- Actively expanding coverage

### Cons
- **No sports cards** - TCGs only
- Would need separate solution for baseball/basketball/football
- Newer/smaller provider than PriceCharting

### Links
- Website: https://justtcg.com
- Comparison article: https://justtcg.medium.com/justtcg-vs-the-alternatives-choosing-the-right-tcg-pricing-api-6d5d555ac7cd

---

## Option 3: Card Hedger

**Website:** https://www.cardhedger.com/price_api_business

### Overview
API provider specifically positioning as "Sports Card and Pokemon Price API" - one of the few that explicitly combines both categories.

### Coverage
- Sports cards (specifics unclear)
- Pokemon
- TCGs (specifics unclear)

### Data Provided
- "Curated and well-structured data"
- Off-the-shelf and custom API endpoints
- Focus on "alternative assets in the trading card space"

### Pricing
- Not publicly listed
- Need to contact for details

### Pros
- Combines sports cards AND Pokemon/TCGs in one API
- Custom endpoint options
- Focused on card market specifically

### Cons
- Limited public documentation
- Smaller/newer provider
- Unclear pricing and exact coverage
- Less established track record

### Links
- API Info: https://www.cardhedger.com/price_api_business

---

## Option 4: CardMarket API

**Website:** http://cardmarket-api.com

### Overview
Global pricing API focused on TCGs with data from both US (TCGPlayer) and EU (Cardmarket) markets.

### Coverage
- Pokemon
- Disney Lorcana
- Riftbound (League of Legends)
- One Piece TCG
- *More games being added*

### Data Provided
- Real-time prices from TCGPlayer (US) and Cardmarket (EU)
- PSA, Beckett, and CGC graded valuations
- Historical price data
- Exclusive regional pricing (DE, FR, ES, IT)

### Pricing

| Tier | Requests/Day | Price |
|------|--------------|-------|
| Free | 100 | $0 |
| Paid | More | Not specified |

*No credit card required to start*

### Pros
- Free tier available (100/day)
- Graded card valuations
- Both US and EU market data
- Historical data included

### Cons
- **No sports cards**
- Limited to specific TCGs
- Smaller request limits on free tier
- EU focus may not align with DCM's US market focus

### Links
- Website: http://cardmarket-api.com

---

## Option 5: Ximilar (AI-Powered)

**Website:** https://www.ximilar.com

### Overview
AI-powered collectibles recognition and pricing platform. Unique in offering image recognition alongside pricing data.

### Coverage
- Trading cards (Pokemon, MTG, etc.)
- Sports cards
- Comic books
- Manga
- Stamps, coins, banknotes

### Data Provided
- AI image recognition (identify cards from photos)
- Pricing insights from multiple marketplaces
- Direct links to eBay, Mercari, Rakuten listings
- Complete listing details

### Unique Feature
Could potentially identify cards from uploaded images AND fetch pricing - useful for the grading workflow.

### Pricing
- Not publicly listed
- Enterprise/business focus

### Pros
- Broadest collectibles coverage
- AI identification + pricing combo
- Multiple marketplace sources
- Could enhance card identification workflow

### Cons
- More complex integration
- Likely expensive (enterprise pricing)
- May be overkill for just price data
- Less TCG-specific than alternatives

### Links
- Price Checker: https://www.ximilar.com/blog/get-an-ai-powered-trading-card-price-checker-via-api/
- Automation Guide: https://www.ximilar.com/blog/how-to-automate-pricing-of-cards-comics-via-api/

---

## Option 6: PokemonPriceTracker

**Website:** https://www.pokemonpricetracker.com/api

### Overview
Pokemon-specific pricing API with data from TCGPlayer, eBay, and CardMarket.

### Coverage
- Pokemon TCG only (23,000+ cards)
- English and Japanese cards
- PSA graded values from eBay sales

### Data Provided
- Daily-updated TCGPlayer prices
- Historical price trends
- PSA graded card values
- Card images, set info, rarity

### Pricing

| Tier | Requests/Day | Price |
|------|--------------|-------|
| Free | 100 | $0 |
| Paid | More | Not specified |

### Pros
- Includes eBay sold data (unique)
- PSA graded values
- Free tier for testing
- Pokemon-specific depth

### Cons
- Pokemon only - no sports or other TCGs
- Small free tier (100/day)

### Links
- API: https://www.pokemonpricetracker.com/api
- Price API: https://www.pokemonpricetracker.com/pokemon-card-price-api

---

## Option 7: TCGPlayer Official

**Website:** https://help.tcgplayer.com/hc/en-us/articles/201577976-How-can-I-get-access-to-your-card-pricing-data

### Overview
Official API from TCGPlayer marketplace - the dominant US marketplace for TCGs.

### Coverage
- All TCGs on TCGPlayer platform
- Pokemon, MTG, Yu-Gi-Oh, Lorcana, etc.

### Data Provided
- Live market prices
- Affiliate commission opportunities

### Access
- Pre-built APIs available
- Custom API design available
- Need to apply for access

### Pros
- Official source for TCGPlayer prices
- Commission on referred sales
- Most accurate TCGPlayer data

### Cons
- **No sports cards**
- Application/approval process
- May have usage restrictions

### Links
- Info: https://help.tcgplayer.com/hc/en-us/articles/201577976-How-can-I-get-access-to-your-card-pricing-data

---

## Comparison Matrix

| Provider | Sports | Pokemon | MTG | Lorcana | Free Tier | Graded Prices | Bulk/CSV |
|----------|--------|---------|-----|---------|-----------|---------------|----------|
| PriceCharting | Via SportsCardsPro | Yes | Yes | Yes | No | Yes | Yes |
| SportsCardsPro | Yes | Yes | No | No | No | Yes | Yes |
| JustTCG | No | Yes | Yes | Yes | 1,000/day | No | 100/call |
| Card Hedger | Yes | Yes | ? | ? | ? | ? | ? |
| CardMarket API | No | Yes | No | Yes | 100/day | Yes | No |
| Ximilar | Yes | Yes | Yes | ? | No | ? | No |
| PokemonPriceTracker | No | Yes | No | No | 100/day | Yes (PSA) | No |
| TCGPlayer | No | Yes | Yes | Yes | ? | No | ? |

---

## Recommended Strategies

### Strategy A: Weekly Bulk Refresh (Best for Scale)

**Best if:** You want comprehensive pricing across all card types with minimal API calls.

```
Weekly Cron Job
      │
      ├── Download PriceCharting CSV (Pokemon, MTG, Lorcana)
      │
      ├── Download SportsCardsPro CSV (Baseball, Basketball, Football)
      │
      └── Import script matches prices to DCM database
                │
                └── Store: avg_price, psa_10_price, raw_price, price_updated_at
```

**Estimated Cost:** $30-60/month (both subscriptions)
**Implementation Effort:** Medium (build import scripts once)
**Maintenance:** Low (automated weekly)

### Strategy B: Hybrid Approach (Start Free)

**Best if:** You want to test before committing to paid plans.

```
TCGs (Free)                    Sports (Paid)
     │                              │
     ├── JustTCG API               ├── SportsCardsPro API
     │   (1,000 free/day)          │   (subscription required)
     │                              │
     └── Pokemon, MTG, Lorcana     └── Baseball, Basketball, Football
```

**Estimated Cost:** $0 for TCGs, ~$20-30/month for sports
**Implementation Effort:** Low-Medium
**Limitation:** Rate limited on free tier

### Strategy C: On-Demand Only (Simplest)

**Best if:** You just want to show prices when users view cards, not store them.

```
User opens card detail
         │
         └── API call to fetch current price
                   │
                   └── Display in UI (not stored)
```

**Estimated Cost:** Depends on volume and provider
**Implementation Effort:** Low
**Limitation:** Slower UX, rate limits, no historical tracking

---

## Implementation Considerations

### Database Schema Changes

Add to card tables (`pokemon_cards`, `sports_cards`, `mtg_cards`, etc.):

```sql
ALTER TABLE pokemon_cards ADD COLUMN market_price_raw INTEGER;      -- Price in cents
ALTER TABLE pokemon_cards ADD COLUMN market_price_psa10 INTEGER;    -- PSA 10 price in cents
ALTER TABLE pokemon_cards ADD COLUMN market_price_psa9 INTEGER;     -- PSA 9 price in cents
ALTER TABLE pokemon_cards ADD COLUMN price_source VARCHAR(50);      -- 'pricecharting', 'justtcg', etc.
ALTER TABLE pokemon_cards ADD COLUMN price_updated_at TIMESTAMP;    -- Last refresh date
```

### Matching Logic

Key challenge: matching API data to your existing cards.

**Pokemon:** Match on set ID + card number (e.g., "base1-4" for Charizard)
**Sports:** Match on player name + year + set + card number
**MTG:** Match on set code + collector number

### Caching Strategy

1. **Store prices in database** - don't call API on every page view
2. **Weekly refresh** - prices don't change dramatically day-to-day
3. **Fallback gracefully** - show "Price unavailable" if no data

### Display Format

```
Market Value (as of Dec 2024)
├── Raw/Ungraded: $45.00
├── PSA 9: $120.00
└── PSA 10: $350.00

Source: PriceCharting | View on eBay →
```

---

## Next Steps

1. **Sign up for free tiers to evaluate data quality:**
   - JustTCG: https://justtcg.com
   - CardMarket API: http://cardmarket-api.com
   - PokemonPriceTracker: https://www.pokemonpricetracker.com/api

2. **Contact for pricing quotes:**
   - PriceCharting: https://www.pricecharting.com/pricecharting-pro
   - SportsCardsPro: https://www.sportscardspro.com

3. **Decide on strategy:**
   - Bulk CSV imports vs. on-demand API calls
   - Which providers for which card types

4. **Build import/matching scripts:**
   - Map API fields to DCM database schema
   - Handle edge cases (missing cards, variants, etc.)

---

## Questions to Answer

- [ ] What's the budget for pricing data subscriptions?
- [ ] How frequently should prices refresh? (Daily, weekly, monthly?)
- [ ] Should we show graded prices (PSA 10, PSA 9) or just raw?
- [ ] Do we need historical price charts, or just current prices?
- [ ] Should prices be visible to all users or just paid subscribers?

---

## References

- PriceCharting API: https://www.pricecharting.com/api-documentation
- SportsCardsPro API: https://www.sportscardspro.com/api-documentation
- JustTCG: https://justtcg.com
- Card Hedger: https://www.cardhedger.com/price_api_business
- CardMarket API: http://cardmarket-api.com
- Ximilar: https://www.ximilar.com/blog/get-an-ai-powered-trading-card-price-checker-via-api/
- PokemonPriceTracker: https://www.pokemonpricetracker.com/api
- TCGPlayer: https://help.tcgplayer.com/hc/en-us/articles/201577976-How-can-I-get-access-to-your-card-pricing-data
