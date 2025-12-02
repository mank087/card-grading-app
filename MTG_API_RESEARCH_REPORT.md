# Magic: The Gathering API Research Report
**Date:** December 2, 2025
**Purpose:** Identify the best MTG card data API for post-grading verification in card-grading-app

---

## Executive Summary

After comprehensive research of the three major MTG data providers, **Scryfall API is the clear winner** for our use case. It offers the best combination of reliability, data completeness, active maintenance, and developer-friendly features with no authentication required and generous rate limits.

**Recommendation: Scryfall API**
- Free, no API key required
- Most comprehensive and up-to-date data
- Excellent fuzzy name search for post-grading verification
- High-quality card images included
- Daily price data from major marketplaces
- Active maintenance and strong community support
- Well-documented with multiple SDKs available

---

## Research Findings

### 1. Scryfall API
**URL:** https://scryfall.com/docs/api
**Status:** Active, well-maintained, industry standard

#### API Details

**Base URL:** `https://api.scryfall.com`

**Authentication:** None required (just need User-Agent header)

**Rate Limits:**
- 50-100ms delay between requests recommended (~10 requests/sec)
- Exceeding limits triggers HTTP 429
- Potential temporary or permanent IP ban if abused
- Bulk data downloads have no rate limits

**Key Endpoints:**

1. **Named Card Search (Perfect for our use case)**
   ```
   GET /cards/named?fuzzy={card_name}
   GET /cards/named?exact={exact_name}
   GET /cards/named?fuzzy={name}&set={set_code}
   ```
   - Fuzzy search handles misspellings and partial words
   - Example: "jac bele" matches "Jace Beleren"
   - Case-insensitive, punctuation optional
   - Returns 404 if ambiguous (multiple matches) or no matches

2. **Advanced Card Search**
   ```
   GET /cards/search?q={query}
   ```
   - Supports complex queries with advanced syntax
   - Filter by colors, types, sets, rarity, etc.

3. **Set + Collector Number (Most Reliable)**
   ```
   GET /cards/:set_code/:collector_number
   GET /cards/:set_code/:collector_number/:lang
   ```
   - Most precise lookup method
   - Handles variants and reprints perfectly

4. **Card Autocomplete**
   ```
   GET /cards/autocomplete?q={partial_name}
   ```
   - Returns matching card names as you type
   - Useful for verification UI

5. **Unique Card ID**
   ```
   GET /cards/:id
   ```
   - Direct lookup by Scryfall UUID

6. **Bulk Data**
   ```
   GET /bulk-data
   ```
   - Daily exports of entire database
   - 5 datasets available (Oracle Cards 159MB, All Cards 2.27GB, etc.)
   - Perfect for seeding local database

**Data Fields Returned:**
- **Identity:** Unique UUID, Oracle ID (links reprints), language
- **Game Rules:** Mana cost/value, color identity, type line, power/toughness, loyalty, keywords, legality
- **Printing Details:** Set name, rarity, collector number, border color, frame type, release date
- **Pricing:** Daily USD/EUR prices (foil and non-foil) from TCGPlayer and others
- **Images:** Multiple resolutions, URIs, illustration IDs
- **Multiface Cards:** Single object with `card_faces` array for DFCs, split cards, etc.

**Update Frequency:**
- Prices: Daily
- Gameplay data: Weekly or post-release (infrequent changes)

**Pros:**
- Free and no API key required
- Most comprehensive data (recognized industry standard)
- Excellent fuzzy search for name matching
- Handles all card variants (reprints, foils, special editions)
- High-quality card images hosted
- Daily pricing data included
- Strong search capabilities with advanced syntax
- Well-documented with examples
- Active community and development
- Bulk data exports for offline use
- Links to major marketplaces (TCGPlayer, Cardmarket, etc.)

**Cons:**
- Rate limiting requires 50-100ms delays (not a major issue for our use case)
- Bulk downloads are large (2.27GB for all cards)
- Price data "dangerously stale after 24 hours" - shouldn't power commercial pricing
- Cannot paywall the data or use for non-Magic games
- Must respect artist attribution in images

**Best For:**
- Card identification and verification (our use case)
- Applications needing card images
- Real-time card lookups
- Fuzzy name matching
- Variant and reprint handling

---

### 2. MTGJSON
**URL:** https://mtgjson.com/
**Status:** Active, open-source, community-driven

#### API Details

**Access Methods:**
- Direct file downloads (JSON, CSV, SQL formats)
- HTTP API at `https://mtgjson.com/api/v5/`
- GraphQL API (beta, Patreon subscribers only)

**Authentication:** None for file downloads

**Rate Limits:** Not specified for file downloads (bulk download model)

**Data Available:**
- Card details (atomic, set-specific, deck, token variants)
- Set and sealed product information
- Limited pricing history from partners
- Legalities, rulings, translations
- Keywords, identifiers, related cards

**Update Frequency:** Daily builds (1:00 AM EST, live 9:00 AM EST)

**Data Structure:**
- "Card (Atomic)" - Base card data
- "Card (Set)" - Set-specific printings
- "Card (Token)" - Token variants
- Comprehensive data models with TypeScript types

**Pros:**
- Completely free and open-source (MIT License)
- Daily updates
- Multiple format options (JSON, CSV, SQL)
- Comprehensive historical data
- No rate limits on downloads
- Aggregates data from multiple sources (Gatherer, Scryfall, TCGPlayer)
- Perfect for bulk operations and data analysis
- TypeScript type definitions included
- No authentication needed
- Can be used offline

**Cons:**
- Not a real-time API (download-and-use model)
- Limited pricing history (not comprehensive)
- GraphQL API restricted to paid subscribers
- Requires local database/file management
- No hosted card images (recommends using Scryfall)
- Must download entire datasets (can be large)
- More complex integration (need to manage data updates)

**Best For:**
- Seeding databases with bulk data
- Offline applications
- Data analysis and research
- Applications that need comprehensive historical data
- When you want full data control

---

### 3. Magic: The Gathering API (magicthegathering.io)
**URL:** https://docs.magicthegathering.io/
**Status:** Active but less maintained than Scryfall

#### API Details

**Base URL:** `https://api.magicthegathering.io/v1`

**Authentication:** None required

**Rate Limits:**
- 5,000 requests per hour per IP
- Returns HTTP 403 with "Rate Limit Exceeded" when hit
- Headers: `Ratelimit-Limit`, `Ratelimit-Remaining`

**Key Endpoints:**

1. **Cards**
   ```
   GET /v1/cards
   GET /v1/cards/:id
   ```

2. **Sets**
   ```
   GET /v1/sets
   GET /v1/sets/:id
   GET /v1/sets/:id/booster (random booster generation)
   ```

3. **Metadata**
   ```
   GET /v1/types
   GET /v1/subtypes
   GET /v1/supertypes
   GET /v1/formats
   ```

**Search/Filtering:**
- Extensive query parameters (name, colors, type, rarity, set, artist, etc.)
- Partial name matching: `name=avacyn`
- Exact matching with quotes: `name="Archangel Avacyn"`
- Foreign language search: `name=X&language=Y`
- Logical operators: AND (comma), OR (pipe)

**Pagination:**
- Default: 100 cards per page
- Parameters: `page`, `pageSize`
- Headers: `Link` (next/prev/first/last), `Total-Count`

**Data Fields:**
- Mana cost, colors, card type, power/toughness
- Rulings, foreign language variants
- Printings across sets
- Format legality
- Image URLs (only for cards with Gatherer multiverse IDs)

**Data Sources:** MTGJson and Wizards' Gatherer

**SDKs Available:** Ruby, Python, JavaScript, .NET, Java, PHP, Kotlin, Go, Swift, TypeScript

**Pros:**
- Free and no authentication required
- Generous rate limits (5,000/hour)
- Multiple official SDKs
- Decent search capabilities
- Random booster pack generation (fun feature)

**Cons:**
- Less comprehensive than Scryfall
- Variant cards get separate records (harder to link reprints)
- Images only for cards with Gatherer multiverse IDs (incomplete)
- Less active development/maintenance than Scryfall
- Data structure differences from Scryfall (camelCase vs snake_case)
- No pricing data
- Community prefers Scryfall for most use cases
- Fewer features than Scryfall

**Best For:**
- Simple card lookup needs
- Legacy applications already using it
- Random card/booster generation
- When you need specific SDK support

---

## Comparison Matrix

| Feature | Scryfall | MTGJSON | magicthegathering.io |
|---------|----------|---------|----------------------|
| **Type** | REST API | Static files + API | REST API |
| **Cost** | Free | Free (MIT) | Free |
| **Authentication** | None (User-Agent) | None | None |
| **Rate Limits** | ~10 req/sec | None (downloads) | 5,000 req/hour |
| **Card Images** | Yes (high quality) | No (use Scryfall) | Limited (Gatherer only) |
| **Pricing Data** | Daily (USD/EUR) | Limited history | No |
| **Fuzzy Search** | Excellent | N/A | Basic |
| **Set/Number Lookup** | Yes | Yes | Yes |
| **Variants/Reprints** | Excellent | Excellent | Separate records |
| **Maintenance** | Very active | Active | Less active |
| **Community Support** | Strong | Strong | Moderate |
| **Data Completeness** | Most complete | Comprehensive | Basic |
| **Update Frequency** | Daily | Daily | Less frequent |
| **Bulk Downloads** | Yes (daily) | Yes (core feature) | No |
| **Documentation** | Excellent | Good | Good |
| **SDKs** | Many unofficial | Data models | Official 10+ |

---

## Implementation Strategy

### Recommended Approach: Scryfall API (Mirror Pokemon Integration)

Based on our existing Pokemon TCG API integration (`C:\Users\benja\card-grading-app\src\lib\pokemonApiVerification.ts`), we should implement a similar pattern for MTG:

#### 1. Create MTG API Verification Service
**File:** `src/lib/mtgApiVerification.ts`

**Key Features:**
- Multiple verification strategies (like Pokemon):
  1. Set code + collector number (most reliable)
  2. Card name + set name
  3. Fuzzy name search
  4. Name + year filtering
- Confidence levels: high, medium, low
- Correction tracking for AI grading errors
- Metadata extraction

#### 2. Create Verification API Route
**File:** `src/app/api/mtg/verify/route.ts`

**Endpoints:**
- `POST /api/mtg/verify` - Verify card and update database
- `GET /api/mtg/verify?card_id=xxx` - Check verification status

#### 3. Database Schema
**Add columns to `cards` table:**
```sql
ALTER TABLE cards ADD COLUMN mtg_api_id VARCHAR(255);
ALTER TABLE cards ADD COLUMN mtg_api_data JSONB;
ALTER TABLE cards ADD COLUMN mtg_api_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE cards ADD COLUMN mtg_api_verified_at TIMESTAMP;
ALTER TABLE cards ADD COLUMN mtg_api_confidence VARCHAR(20);
ALTER TABLE cards ADD COLUMN mtg_api_method VARCHAR(50);
```

#### 4. Integration Points
- Call verification API after grading completes
- Display API-verified data in card detail pages
- Show confidence badges
- Allow manual re-verification
- Log corrections for AI improvement

### Lookup Strategy Priority

1. **Set Code + Collector Number** (Highest confidence)
   ```
   GET /cards/{set_code}/{collector_number}
   Example: /cards/mkm/123
   ```

2. **Fuzzy Name Search** (Good for AI-graded cards)
   ```
   GET /cards/named?fuzzy={card_name}&set={set_code}
   Example: /cards/named?fuzzy=black lotus&set=lea
   ```

3. **Advanced Query Search** (Fallback with filters)
   ```
   GET /cards/search?q=name:{name} set:{set}
   Example: /cards/search?q=name:"Jace Beleren" set:m10
   ```

### Set Code Mapping Strategy

Build a set name to set code mapper (similar to Pokemon's `SET_NAME_TO_ID`):

```typescript
const SET_NAME_TO_CODE: Record<string, string> = {
  // Recent sets (2023-2025)
  'Murders at Karlov Manor': 'mkm',
  'Outlaws of Thunder Junction': 'otj',
  'Modern Horizons 3': 'mh3',
  'Bloomburrow': 'blb',
  'Duskmourn: House of Horror': 'dsk',

  // Classic sets
  'Alpha': 'lea',
  'Beta': 'leb',
  'Unlimited': '2ed',
  // ... etc
};
```

### Error Handling

- Graceful fallbacks when API unavailable
- Timeout protection (10s like Pokemon)
- Retry logic for transient failures
- Log failures for analysis
- Don't block grading if verification fails

### Rate Limiting Strategy

- 100ms delay between requests (safe for Scryfall)
- Queue verification requests
- Use bulk data for mass operations
- Cache common cards locally

---

## Code Implementation Examples

### Example 1: Fuzzy Name Search

```typescript
async function searchByFuzzyName(cardName: string, setCode?: string): Promise<ScryfallCard | null> {
  const baseUrl = 'https://api.scryfall.com/cards/named';
  const params = new URLSearchParams({
    fuzzy: cardName,
    ...(setCode && { set: setCode })
  });

  const response = await fetch(`${baseUrl}?${params}`, {
    headers: {
      'User-Agent': 'CardGradingApp/1.0',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      // Ambiguous or no match
      return null;
    }
    throw new Error(`Scryfall API error: ${response.status}`);
  }

  return await response.json();
}
```

### Example 2: Set + Collector Number

```typescript
async function getCardBySetAndNumber(
  setCode: string,
  collectorNumber: string
): Promise<ScryfallCard | null> {
  const url = `https://api.scryfall.com/cards/${setCode}/${collectorNumber}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'CardGradingApp/1.0',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    return null;
  }

  return await response.json();
}
```

### Example 3: Verification Flow

```typescript
export async function verifyMTGCard(cardInfo: CardInfoForVerification) {
  const result: MTGApiVerificationResult = {
    success: false,
    verified: false,
    mtg_api_id: null,
    mtg_api_data: null,
    verification_method: 'none',
    confidence: 'low',
    corrections: []
  };

  let apiCard: ScryfallCard | null = null;

  // Strategy 1: Set code + collector number
  if (cardInfo.set_code && cardInfo.collector_number) {
    apiCard = await getCardBySetAndNumber(
      cardInfo.set_code,
      cardInfo.collector_number
    );
    if (apiCard) {
      result.verification_method = 'set_collector_number';
      result.confidence = 'high';
    }
  }

  // Strategy 2: Fuzzy name + set
  if (!apiCard && cardInfo.card_name) {
    apiCard = await searchByFuzzyName(
      cardInfo.card_name,
      cardInfo.set_code
    );
    if (apiCard) {
      result.verification_method = 'fuzzy_name_set';
      result.confidence = cardInfo.set_code ? 'medium' : 'low';
    }
  }

  // Strategy 3: Advanced search with filters
  // ... additional fallback strategies

  if (apiCard) {
    result.success = true;
    result.verified = true;
    result.mtg_api_id = apiCard.id;
    result.mtg_api_data = apiCard;

    // Check for corrections
    if (cardInfo.card_name !== apiCard.name) {
      result.corrections.push({
        field: 'card_name',
        original: cardInfo.card_name,
        corrected: apiCard.name
      });
    }
    // ... more correction checks
  }

  return result;
}
```

---

## Migration from Pokemon Pattern

Our Pokemon integration demonstrates a proven pattern we can replicate:

**Pokemon Files:**
1. `src/lib/pokemonApiVerification.ts` - Verification logic
2. `src/app/api/pokemon/verify/route.ts` - API endpoint
3. `migrations/add_pokemon_api_columns.sql` - Database schema

**MTG Files (to create):**
1. `src/lib/mtgApiVerification.ts` - Mirror Pokemon logic
2. `src/app/api/mtg/verify/route.ts` - Mirror Pokemon endpoint
3. `migrations/add_mtg_api_columns.sql` - Similar schema

**Key Adaptations:**
- Change Pokemon TCG API to Scryfall API
- Update set code mappings for MTG sets
- Adjust card number normalization (MTG uses different formats)
- Modify metadata extraction for MTG-specific fields

---

## Alternative: Hybrid Approach

If we need offline capabilities or bulk operations:

1. **Use Scryfall API for real-time verification** (primary)
2. **Download MTGJSON bulk data for fallback** (backup)
3. Store MTGJSON data in local database
4. Use local data when Scryfall unavailable
5. Update local data daily from MTGJSON

**Benefits:**
- Best of both worlds
- Resilience to API downtime
- Fast bulk operations
- Always have data available

**Complexity:**
- Need to manage local database
- Sync logic required
- More storage needed

---

## Final Recommendation

**Use Scryfall API exclusively** for the following reasons:

1. **Matches our Pokemon pattern** - proven, working code we can adapt
2. **Excellent fuzzy search** - critical for AI-graded card verification
3. **No authentication complexity** - just User-Agent header
4. **Comprehensive data** - everything we need in one place
5. **Active maintenance** - industry standard, won't disappear
6. **Free and generous** - 10 req/sec sufficient for our volume
7. **High-quality images** - bonus for card display
8. **Daily pricing** - useful for users to see card value

**Implementation Timeline:**
1. Create `mtgApiVerification.ts` service (2-3 hours)
2. Create `/api/mtg/verify` endpoint (1 hour)
3. Add database columns (30 minutes)
4. Test with sample cards (1 hour)
5. Integrate with grading flow (1 hour)
6. Add UI indicators (1 hour)

**Total: ~7 hours of development work**

---

## Resources

### Scryfall Documentation
- Main API Docs: https://scryfall.com/docs/api
- Card Search: https://scryfall.com/docs/api/cards/search
- Named Search: https://scryfall.com/docs/api/cards/named
- Bulk Data: https://scryfall.com/docs/api/bulk-data
- Card Objects: https://scryfall.com/docs/api/cards

### MTGJSON Documentation
- Main Site: https://mtgjson.com/
- FAQ: https://mtgjson.com/faq/
- Data Models: https://mtgjson.com/data-models/

### magicthegathering.io Documentation
- API Docs: https://docs.magicthegathering.io/
- GitHub: https://github.com/MagicTheGathering/mtg-api

### Community Resources
- Scryfall Blog: https://scryfall.com/blog/category/api
- GitHub Topics: https://github.com/topics/scryfall-api

---

## Conclusion

Scryfall API is the clear winner for our MTG card verification needs. It provides the perfect balance of features, reliability, and ease of integration. By mirroring our existing Pokemon TCG API integration pattern, we can implement MTG verification quickly and confidently with minimal risk.

The fuzzy name search capability is particularly valuable for our use case, where AI grading might produce slight variations in card names. Scryfall's robust search will help us achieve the same "100% accurate card identification" that we achieved with Pokemon cards.

**Next Steps:**
1. Review and approve this research
2. Create implementation ticket
3. Develop MTG verification service
4. Test with sample cards
5. Deploy to production
6. Monitor verification success rates

---

**Report Prepared By:** Claude (Anthropic AI Assistant)
**Date:** December 2, 2025
**Version:** 1.0
