# eBay Listing Integration - Strategy & Implementation Plan

**Created:** January 14, 2026
**Status:** Pending eBay Developer Approval
**Author:** DCM Development Team

---

## Executive Summary

eBay provides robust REST APIs that can enable DCM users to list their graded cards directly on eBay. The integration is technically feasible and would involve OAuth authentication, image upload, inventory management, and offer publishing. eBay has **specific requirements for graded trading cards** including mandatory condition descriptors for grader and grade.

---

## Table of Contents

1. [Technical Architecture](#1-technical-architecture-overview)
2. [Required APIs](#2-ebay-apis-required)
3. [Trading Card Categories & Requirements](#3-trading-card-categories--requirements)
4. [OAuth Authentication](#4-oauth-authentication-flow)
5. [Data Mapping: DCM → eBay](#5-data-mapping-dcm--ebay)
6. [Implementation Plan](#6-implementation-plan)
7. [UI/UX Design](#7-uiux-mockup)
8. [Challenges & Considerations](#8-key-considerations--challenges)
9. [Third-Party Libraries](#9-third-party-libraries)
10. [Effort Estimates](#10-estimated-effort)
11. [Next Steps](#11-next-steps)
12. [Sources](#12-sources)

---

## 1. Technical Architecture Overview

### eBay API Flow (3-Step Process)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DCM → eBay Listing Flow                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Step 1: Upload Images                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│  │ Card Front  │     │ Card Back   │     │ Label Images│               │
│  │   Image     │ ──▶ │   Image     │ ──▶ │ (optional)  │               │
│  └─────────────┘     └─────────────┘     └─────────────┘               │
│         │                   │                   │                       │
│         ▼                   ▼                   ▼                       │
│  ┌─────────────────────────────────────────────────────┐               │
│  │           Media API: createImageFromUrl             │               │
│  │      Returns: EPS URLs for each image               │               │
│  └─────────────────────────────────────────────────────┘               │
│                              │                                          │
│  Step 2: Create Inventory Item                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────┐               │
│  │      Inventory API: createOrReplaceInventoryItem    │               │
│  │      - Title, Description, Images                   │               │
│  │      - Condition: 2750 (Graded)                     │               │
│  │      - Condition Descriptors (Grader, Grade, Cert#) │               │
│  │      - Product Aspects (Player, Team, Year, etc.)   │               │
│  └─────────────────────────────────────────────────────┘               │
│                              │                                          │
│  Step 3: Create & Publish Offer                                         │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────┐               │
│  │           Inventory API: createOffer                │               │
│  │      - Price, Quantity, Category                    │               │
│  │      - Marketplace (US, UK, etc.)                   │               │
│  │      - Payment/Return/Shipping Policies             │               │
│  └─────────────────────────────────────────────────────┘               │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────┐               │
│  │           Inventory API: publishOffer               │               │
│  │      Returns: eBay Listing ID                       │               │
│  └─────────────────────────────────────────────────────┘               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. eBay APIs Required

| API | Purpose | Auth Required | Documentation |
|-----|---------|---------------|---------------|
| Media API | Upload card images to eBay Picture Services | User OAuth Token | [Docs](https://developer.ebay.com/api-docs/commerce/media/overview.html) |
| Inventory API | Create inventory items and offers | User OAuth Token | [Docs](https://developer.ebay.com/api-docs/sell/inventory/overview.html) |
| Account API | Get/create fulfillment, payment, return policies | User OAuth Token | [Docs](https://developer.ebay.com/api-docs/sell/account/static/overview.html) |
| Taxonomy API | Get category IDs and required aspects | App Token | [Docs](https://developer.ebay.com/api-docs/commerce/taxonomy/overview.html) |
| Metadata API | Get condition descriptors for trading cards | App Token | [Docs](https://developer.ebay.com/api-docs/sell/metadata/overview.html) |

### Key API Endpoints

```
# Media API - Image Upload
POST https://apim.ebay.com/commerce/media/v1_beta/image/create_image_from_url

# Inventory API - Create Item
PUT https://api.ebay.com/sell/inventory/v1/inventory_item/{sku}

# Inventory API - Create Offer
POST https://api.ebay.com/sell/inventory/v1/offer

# Inventory API - Publish Offer
POST https://api.ebay.com/sell/inventory/v1/offer/{offerId}/publish
```

---

## 3. Trading Card Categories & Requirements

### eBay Category IDs

| Category | ID | Description | DCM Card Types |
|----------|-----|-------------|----------------|
| Sports Trading Card Singles | **261328** | Baseball, Football, Basketball, etc. | Sports |
| Non-Sport Trading Card Singles | **183050** | Entertainment, Movie cards | Other |
| CCG Individual Cards | **183454** | Pokemon, MTG, Yu-Gi-Oh, Lorcana | Pokemon, MTG, Lorcana |

### Condition IDs

| Condition | ID | Usage |
|-----------|-----|-------|
| Graded | `2750` | For all DCM graded cards |
| Ungraded | `4000` | Not applicable for DCM |

### Condition Descriptors for Graded Cards (REQUIRED)

| Descriptor | ID | Required | Description |
|------------|-----|----------|-------------|
| Professional Grader | `27501` | ✅ Yes | PSA, BGS, SGC, or Other |
| Grade | `27502` | ✅ Yes | 1-10 scale |
| Certification Number | `27503` | ❌ Optional | The cert/serial number |

### Professional Grader IDs (for Descriptor `27501`)

| Grader | ID | Notes |
|--------|-----|-------|
| PSA | `275010` | Professional Sports Authenticator |
| BGS | `275013` | Beckett Grading Services |
| SGC | `275016` | Sportscard Guaranty Corporation |
| CSG | `275014` | Certified Sports Guaranty |
| CGC | `275015` | CGC Cards |
| BVG | `275012` | Beckett Vintage Grading |
| BCCG | `275011` | Beckett Collectors Club Grading |
| HGA | `2750110` | Hybrid Grading Approach |
| GMA | `275018` | GMA Grading |
| **Other** | `2750117` | **⭐ Use this for DCM** |

### Grade Value IDs (for Descriptor `27502`)

| Grade | ID | DCM Condition |
|-------|-----|---------------|
| 10 | `275020` | GEM MINT |
| 9.5 | `275021` | - |
| 9 | `275022` | MINT |
| 8.5 | `275023` | - |
| 8 | `275024` | NM-MT |
| 7.5 | `275025` | - |
| 7 | `275026` | NM |
| 6.5 | `275027` | - |
| 6 | `275028` | EX-MT |
| 5.5 | `275029` | - |
| 5 | `2750210` | EX |
| 4 | `2750212` | VG-EX |
| 3 | `2750214` | VG |
| 2 | `2750216` | GOOD |
| 1 | `2750218` | PR-FR |
| Authentic | `2750219` | For Altered/Authentic cards |
| Authentic Altered | `2750220` | - |
| Authentic - Trimmed | `2750221` | - |

### DCM Grade to eBay ID Mapping

```typescript
const DCM_GRADE_TO_EBAY_ID: Record<number, string> = {
  10: '275020',
  9: '275022',
  8: '275024',
  7: '275026',
  6: '275028',
  5: '2750210',
  4: '2750212',
  3: '2750214',
  2: '2750216',
  1: '2750218',
};

// For Authentic cards (grade === null && isAlteredAuthentic)
const AUTHENTIC_GRADE_ID = '2750219';
```

---

## 4. OAuth Authentication Flow

### Required OAuth Scopes

```
https://api.ebay.com/oauth/api_scope/sell.inventory
https://api.ebay.com/oauth/api_scope/sell.inventory.readonly
https://api.ebay.com/oauth/api_scope/sell.account
https://api.ebay.com/oauth/api_scope/sell.account.readonly
https://api.ebay.com/oauth/api_scope/commerce.media.upload
```

### Authorization Code Grant Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    OAuth 2.0 Flow                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. User clicks "Connect eBay Account" on DCM               │
│                         │                                   │
│                         ▼                                   │
│  2. Redirect to eBay Authorization URL                      │
│     https://auth.ebay.com/oauth2/authorize                  │
│     ?client_id=YOUR_APP_ID                                  │
│     &redirect_uri=YOUR_CALLBACK_URL                         │
│     &response_type=code                                     │
│     &scope=sell.inventory+sell.account+...                  │
│                         │                                   │
│                         ▼                                   │
│  3. User logs into eBay & grants permissions                │
│                         │                                   │
│                         ▼                                   │
│  4. eBay redirects back to DCM with authorization code      │
│     https://dcmgrading.com/api/ebay/callback?code=XXX       │
│                         │                                   │
│                         ▼                                   │
│  5. DCM backend exchanges code for tokens                   │
│     POST https://api.ebay.com/identity/v1/oauth2/token      │
│                         │                                   │
│                         ▼                                   │
│  6. Store tokens securely in Supabase (encrypted)           │
│     - access_token (expires in 2 hours)                     │
│     - refresh_token (expires in 18 months)                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Token Refresh Flow

```typescript
// Tokens expire after 2 hours - auto-refresh before expiry
async function getValidAccessToken(userId: string): Promise<string> {
  const connection = await getEbayConnection(userId);

  // Check if token expires within 5 minutes
  if (connection.token_expires_at < Date.now() + 5 * 60 * 1000) {
    const newTokens = await refreshEbayToken(connection.refresh_token);
    await updateEbayConnection(userId, newTokens);
    return newTokens.access_token;
  }

  return connection.access_token;
}
```

---

## 5. Data Mapping: DCM → eBay

### Auto-Populated Fields from DCM Card Data

| DCM Field | eBay Field | Example |
|-----------|------------|---------|
| `card_name` / `pokemon_name` | `product.title` | "2023 Pokemon 151 Charizard ex #199 - DCM Graded 9" |
| `set_name` | Product Aspect: Set | "Pokemon 151" |
| `card_number` | Product Aspect: Card Number | "199/165" |
| `year` | Product Aspect: Year | "2023" |
| `conversational_whole_grade` | Condition Descriptor: Grade | Map to eBay grade ID |
| `serial` | Condition Descriptor: Cert Number | "DCM-ABC12345" |
| `front_url` | `product.imageUrls[0]` | Upload via Media API |
| `back_url` | `product.imageUrls[1]` | Upload via Media API |
| Generated slab images | `product.imageUrls[2-3]` | Front/back label images |
| `conversational_summary` | `product.description` | Condition analysis |
| `card_type` | Category selection | Pokemon→183454, Sports→261328 |

### Title Generation Template

```typescript
function generateEbayTitle(card: Card, labelData: LabelData): string {
  const parts: string[] = [];

  // Year (if available)
  if (labelData.year) parts.push(labelData.year);

  // Set name
  if (labelData.setName) parts.push(labelData.setName);

  // Card name
  parts.push(labelData.primaryName);

  // Card number
  if (labelData.cardNumber) parts.push(`#${labelData.cardNumber}`);

  // Grade
  parts.push(`- DCM Graded ${card.conversational_whole_grade}`);

  // eBay titles max 80 characters
  return parts.join(' ').substring(0, 80);
}
```

### Description Template

```typescript
function generateEbayDescription(card: Card, labelData: LabelData): string {
  return `
DCM Graded ${card.conversational_whole_grade} (${labelData.condition})
Serial Number: ${labelData.serial}

📊 SUB-GRADES:
• Centering: ${card.conversational_sub_scores?.centering?.weighted ?? 'N/A'}
• Corners: ${card.conversational_sub_scores?.corners?.weighted ?? 'N/A'}
• Edges: ${card.conversational_sub_scores?.edges?.weighted ?? 'N/A'}
• Surface: ${card.conversational_sub_scores?.surface?.weighted ?? 'N/A'}

📝 CONDITION SUMMARY:
${card.conversational_summary || 'Professional AI grading analysis available on DCM website.'}

🔍 VERIFY THIS CARD:
Scan the QR code on the label or visit: https://dcmgrading.com/${card.card_type}/${card.id}

✅ ABOUT DCM GRADING:
DCM (Digital Card Museum) uses advanced AI technology to provide accurate,
consistent card grading. Each card receives a comprehensive analysis of
centering, corners, edges, and surface condition.

📦 SHIPPING:
Card will be shipped in protective packaging suitable for graded cards.
  `.trim();
}
```

### User-Provided Fields (Listing Form)

| Field | Required | Options/Notes |
|-------|----------|---------------|
| Price | ✅ | Fixed price or auction starting bid |
| Listing Format | ✅ | `FIXED_PRICE` or `AUCTION` |
| Quantity | ✅ | Usually 1 for graded cards |
| Duration | ✅ | `DAYS_3`, `DAYS_5`, `DAYS_7`, `DAYS_10`, `DAYS_30`, `GTC` |
| Shipping Policy | ✅ | Use saved eBay policy or create new |
| Return Policy | ✅ | Use saved eBay policy or create new |
| Payment Policy | ✅ | Usually "eBay Managed Payments" |

---

## 6. Implementation Plan

### Phase 1: Foundation (3-4 days)

**Objective:** Set up eBay developer credentials and OAuth authentication

**Tasks:**
1. ✅ Register for eBay Developer Program (DONE - pending approval)
2. Create Sandbox & Production keysets in eBay Developer Portal
3. Add environment variables:
   ```env
   EBAY_APP_ID=your_app_id
   EBAY_CERT_ID=your_cert_id
   EBAY_DEV_ID=your_dev_id
   EBAY_REDIRECT_URI=https://dcmgrading.com/api/ebay/callback
   EBAY_SANDBOX=false
   ```
4. Create database tables for eBay connections
5. Implement OAuth flow:
   - `/api/ebay/auth` - Initiate OAuth redirect
   - `/api/ebay/callback` - Handle OAuth callback
   - `/api/ebay/disconnect` - Revoke connection
6. Implement token refresh mechanism

**Database Schema:**

```sql
-- Store eBay OAuth connections
CREATE TABLE ebay_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ebay_user_id TEXT NOT NULL,
  ebay_username TEXT,
  access_token TEXT NOT NULL,  -- Encrypt at application level
  refresh_token TEXT NOT NULL, -- Encrypt at application level
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL,
  marketplace_id TEXT DEFAULT 'EBAY_US',
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

-- Index for quick lookups
CREATE INDEX idx_ebay_connections_user_id ON ebay_connections(user_id);
```

**Files to Create:**
- `src/lib/ebayApi.ts` - eBay API client wrapper
- `src/lib/ebayAuth.ts` - OAuth utilities
- `src/app/api/ebay/auth/route.ts` - OAuth initiation
- `src/app/api/ebay/callback/route.ts` - OAuth callback
- `src/app/api/ebay/disconnect/route.ts` - Disconnect account

---

### Phase 2: Image Upload & Inventory (4-5 days)

**Objective:** Implement image upload and inventory item creation

**Tasks:**
1. Implement Media API integration
   - `uploadImageFromUrl()` - Upload image from Supabase URL
   - Handle rate limits (50 requests per 5 seconds)
   - Generate and upload slab images (front/back with labels)
2. Implement Inventory API
   - `createInventoryItem()` - Create/update inventory item
   - Map DCM card data to eBay inventory format
   - Handle condition descriptors for graded cards
3. Implement inventory location management
   - `createInventoryLocation()` - Required once per user
   - `getInventoryLocations()` - Check existing locations

**Database Schema:**

```sql
-- Store inventory locations (required by eBay)
CREATE TABLE ebay_inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL, -- eBay merchant location key
  name TEXT NOT NULL,
  address_line1 TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, location_id)
);
```

**Files to Create:**
- `src/lib/ebayMedia.ts` - Media API functions
- `src/lib/ebayInventory.ts` - Inventory API functions
- `src/app/api/ebay/upload-image/route.ts` - Image upload endpoint
- `src/app/api/ebay/inventory/route.ts` - Inventory management

---

### Phase 3: Offer Creation & Publishing (3-4 days)

**Objective:** Implement offer creation and listing publication

**Tasks:**
1. Implement policy management
   - `getPaymentPolicies()` - Fetch user's payment policies
   - `getFulfillmentPolicies()` - Fetch shipping policies
   - `getReturnPolicies()` - Fetch return policies
   - Create default DCM policies if user has none
2. Implement offer flow
   - `createOffer()` - Create offer with all required fields
   - `updateOffer()` - Update offer details
   - `publishOffer()` - Publish to eBay marketplace
   - `withdrawOffer()` - Remove unpublished offer
3. Store listing references and track status

**Database Schema:**

```sql
-- Store eBay listings linked to DCM cards
CREATE TABLE ebay_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- eBay identifiers
  sku TEXT NOT NULL,
  offer_id TEXT,
  listing_id TEXT, -- Set after publishing

  -- Listing details
  title TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  quantity INTEGER DEFAULT 1,
  listing_format TEXT NOT NULL, -- 'FIXED_PRICE' or 'AUCTION'
  duration TEXT, -- 'DAYS_7', 'GTC', etc.
  category_id TEXT NOT NULL,

  -- Status tracking
  status TEXT DEFAULT 'draft', -- 'draft', 'active', 'ended', 'sold', 'error'
  listing_url TEXT,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(card_id, user_id),
  UNIQUE(sku)
);

-- Index for status queries
CREATE INDEX idx_ebay_listings_status ON ebay_listings(user_id, status);
CREATE INDEX idx_ebay_listings_card ON ebay_listings(card_id);
```

**Files to Create:**
- `src/lib/ebayPolicies.ts` - Policy management
- `src/lib/ebayOffer.ts` - Offer creation/publishing
- `src/app/api/ebay/policies/route.ts` - Get user policies
- `src/app/api/ebay/offer/route.ts` - Create/update offer
- `src/app/api/ebay/publish/route.ts` - Publish listing

---

### Phase 4: UI/UX (4-5 days)

**Objective:** Build user-facing interface for eBay listing

**Tasks:**
1. Add eBay connection management to Account page
   - Connect/disconnect eBay account
   - Show connection status
   - Display eBay username
2. Create "List on eBay" button on card detail pages
   - Only show for graded cards owned by user
   - Check if eBay is connected
3. Build listing wizard modal
   - Step 1: Review auto-populated details (title, description, images)
   - Step 2: Set price, format, duration
   - Step 3: Select shipping/return/payment policies
   - Step 4: Preview and confirm
4. Create "My eBay Listings" dashboard
   - View all listings with status
   - Link to eBay listing page
   - Quick actions (end listing, relist)

**Files to Create:**
- `src/components/ebay/EbayConnectButton.tsx`
- `src/components/ebay/EbayListingModal.tsx`
- `src/components/ebay/EbayListingWizard.tsx`
- `src/components/ebay/EbayListingCard.tsx`
- `src/app/account/ebay/page.tsx` - eBay settings page
- `src/app/ebay-listings/page.tsx` - Listings dashboard

---

### Phase 5: Testing & Launch (3-4 days)

**Objective:** Test in sandbox and deploy to production

**Tasks:**
1. Sandbox testing
   - Create test eBay sandbox accounts
   - Test full listing flow
   - Test error scenarios
2. Error handling improvements
   - User-friendly error messages
   - Retry logic for transient failures
   - Logging for debugging
3. Documentation
   - Help article: "How to list your DCM card on eBay"
   - FAQ section for common issues
4. Production deployment
   - Switch from sandbox to production
   - Monitor initial listings
   - Gather user feedback

---

## 7. UI/UX Mockup

### Account Page - eBay Connection

```
┌─────────────────────────────────────────────────────────────────────────┐
│  eBay Integration                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🔗 eBay Account                                                │   │
│  │                                                                 │   │
│  │  Status: ✅ Connected                                           │   │
│  │  Username: card_seller_2025                                     │   │
│  │  Connected: January 14, 2026                                    │   │
│  │                                                                 │   │
│  │  [Disconnect eBay Account]                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  OR (if not connected):                                                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🔗 eBay Account                                                │   │
│  │                                                                 │   │
│  │  Connect your eBay account to list your graded cards            │   │
│  │  directly on eBay with one click.                               │   │
│  │                                                                 │   │
│  │  [Connect eBay Account]                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Card Detail Page - "List on eBay" Button

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Card Actions                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [📥 Download Images]  [🏷️ Print Label]  [📦 List on eBay]             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### eBay Listing Modal

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     📦 List on eBay                              [X]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Step 1 of 4: Review Details                    ● ○ ○ ○                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  📸 Images (4 will be uploaded)                                 │   │
│  │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                       │   │
│  │  │ Front │ │ Back  │ │ Front │ │ Back  │                       │   │
│  │  │ Card  │ │ Card  │ │ Slab  │ │ Slab  │                       │   │
│  │  └───────┘ └───────┘ └───────┘ └───────┘                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  📝 Listing Title                                               │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │ 2023 Pokemon 151 Charizard ex #199 - DCM Graded 9       │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │  64/80 characters                                    [Edit]    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🏷️ Card Details (Auto-filled)                                 │   │
│  │                                                                 │   │
│  │  Category:    CCG Individual Cards                              │   │
│  │  Condition:   Graded                                            │   │
│  │  Grader:      Other (DCM Grading)                               │   │
│  │  Grade:       9                                                 │   │
│  │  Cert Number: DCM-ABC12345                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  📝 Description                                        [Edit]   │   │
│  │  ───────────────────────────────────────────────────────────   │   │
│  │  DCM Graded 9 (MINT) - Serial: DCM-ABC12345                     │   │
│  │                                                                 │   │
│  │  📊 SUB-GRADES:                                                 │   │
│  │  • Centering: 9 • Corners: 9 • Edges: 9 • Surface: 9            │   │
│  │  ...                                                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                                                                         │
│           [Cancel]                              [Next: Set Price →]     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Step 2: Pricing

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     📦 List on eBay                              [X]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Step 2 of 4: Set Price                         ● ● ○ ○                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  💰 Listing Format                                              │   │
│  │                                                                 │   │
│  │  ● Fixed Price                                                  │   │
│  │  ○ Auction                                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  💵 Price                                                       │   │
│  │                                                                 │   │
│  │  $ [_________]  USD                                             │   │
│  │                                                                 │   │
│  │  💡 Similar cards sell for $150 - $300                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ⏱️ Duration                                                    │   │
│  │                                                                 │   │
│  │  [Good 'Til Cancelled (GTC) ▼]                                  │   │
│  │                                                                 │   │
│  │  Options: 3 days, 5 days, 7 days, 10 days, 30 days, GTC         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  📦 Quantity                                                    │   │
│  │                                                                 │   │
│  │  [1]  (Graded cards are typically unique items)                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                                                                         │
│      [← Back]                               [Next: Shipping →]          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Step 3: Policies

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     📦 List on eBay                              [X]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Step 3 of 4: Shipping & Returns                ● ● ● ○                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🚚 Shipping Policy                                             │   │
│  │                                                                 │   │
│  │  [My Standard Shipping - Free Shipping ▼]                       │   │
│  │                                                                 │   │
│  │  Or: [+ Create New Shipping Policy]                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ↩️ Return Policy                                               │   │
│  │                                                                 │   │
│  │  [30 Day Returns - Buyer Pays Return Shipping ▼]                │   │
│  │                                                                 │   │
│  │  Or: [+ Create New Return Policy]                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  💳 Payment Policy                                              │   │
│  │                                                                 │   │
│  │  [eBay Managed Payments ▼]                                      │   │
│  │                                                                 │   │
│  │  ℹ️ eBay handles all payment processing                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                                                                         │
│      [← Back]                               [Next: Review →]            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Step 4: Review & Publish

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     📦 List on eBay                              [X]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Step 4 of 4: Review & Publish                  ● ● ● ●                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  📋 Listing Summary                                             │   │
│  │  ───────────────────────────────────────────────────────────   │   │
│  │                                                                 │   │
│  │  Title:     2023 Pokemon 151 Charizard ex #199 - DCM Graded 9   │   │
│  │  Price:     $199.99 USD                                         │   │
│  │  Format:    Fixed Price                                         │   │
│  │  Duration:  Good 'Til Cancelled                                 │   │
│  │  Category:  CCG Individual Cards                                │   │
│  │                                                                 │   │
│  │  Grader:    Other (DCM)                                         │   │
│  │  Grade:     9                                                   │   │
│  │  Cert #:    DCM-ABC12345                                        │   │
│  │                                                                 │   │
│  │  Shipping:  My Standard Shipping - Free Shipping                │   │
│  │  Returns:   30 Day Returns - Buyer Pays Return Shipping         │   │
│  │  Payment:   eBay Managed Payments                               │   │
│  │                                                                 │   │
│  │  Images:    4 images will be uploaded                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  💰 eBay Fees (Estimated)                                       │   │
│  │                                                                 │   │
│  │  Final Value Fee:  ~$25.79 (12.9% + $0.30)                      │   │
│  │  Your Payout:      ~$174.20                                     │   │
│  │                                                                 │   │
│  │  ℹ️ Fees are calculated when item sells                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ☐ I understand that eBay fees apply when my item sells               │
│                                                                         │
│      [← Back]                         [🚀 Publish to eBay]              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Key Considerations & Challenges

### Technical Challenges

| Challenge | Solution |
|-----------|----------|
| **DCM not a recognized grader** | Use "Other" grader ID (`2750117`) with DCM serial in certification field |
| **Token expiration** | Implement automatic token refresh (access tokens last 2 hours, refresh tokens 18 months) |
| **Image rate limits** | Queue uploads with delay, respect 50 requests per 5 seconds limit |
| **Listing revisions** | Limited to 250 revisions per day per listing - cache changes |
| **Large images** | Compress images before upload if > 12MB |

### Business Considerations

| Consideration | Notes |
|---------------|-------|
| **eBay Fees** | Users pay standard eBay selling fees (~12.9% + $0.30) - we should clearly communicate this |
| **Authenticity Guarantee** | Only PSA/BGS/SGC/CGC cards qualify for eBay's Authenticity Guarantee badge - DCM cards won't have this |
| **Trust Building** | DCM is a new grader - buyers may be skeptical initially |
| **Support Burden** | Will need FAQ/help docs for eBay integration issues |
| **Pricing Model** | Decide: Free feature for all users? Premium only? Credit-based? |

### Legal/Compliance

| Item | Requirement |
|------|-------------|
| **Developer Agreement** | Must comply with eBay API License Agreement |
| **Data Deletion Notifications** | Must handle eBay account closure notifications (required for production keys) |
| **Privacy** | Store OAuth tokens securely (encrypted at rest) |
| **Liability** | Disclaim responsibility for eBay transactions in ToS |

---

## 9. Third-Party Libraries

### Recommended: ebay-api (Node.js/TypeScript)

**Repository:** https://github.com/hendt/ebay-api

**Features:**
- Full TypeScript support
- Handles OAuth automatically
- Supports all eBay REST APIs
- Auto token refresh
- Digital signature support

**Installation:**
```bash
npm install ebay-api
```

**Usage Example:**

```typescript
import eBayApi from 'ebay-api';

// Initialize client
const eBay = new eBayApi({
  appId: process.env.EBAY_APP_ID!,
  certId: process.env.EBAY_CERT_ID!,
  devId: process.env.EBAY_DEV_ID!,
  sandbox: process.env.EBAY_SANDBOX === 'true',
  siteId: eBayApi.SiteId.EBAY_US,
});

// Set user token (after OAuth)
eBay.OAuth2.setCredentials({
  access_token: userAccessToken,
  refresh_token: userRefreshToken,
  expires_in: 7200,
});

// Upload image
const imageResponse = await eBay.commerce.media.createImageFromUrl({
  imageUrl: 'https://your-supabase-url.com/card-front.jpg',
});

// Create inventory item
await eBay.sell.inventory.createOrReplaceInventoryItem('DCM-ABC12345', {
  product: {
    title: '2023 Pokemon 151 Charizard ex #199 - DCM Graded 9',
    description: 'DCM Graded card...',
    imageUrls: [imageResponse.imageUrl],
    aspects: {
      'Card Name': ['Charizard ex'],
      'Set': ['Pokemon 151'],
      'Card Number': ['199'],
      'Year Manufactured': ['2023'],
    },
  },
  condition: 'LIKE_NEW',
  conditionDescriptors: [
    { name: '27501', values: ['2750117'] },     // Grader: Other
    { name: '27502', values: ['275022'] },      // Grade: 9
    { name: '27503', values: ['DCM-ABC12345'] } // Cert #
  ],
  availability: {
    shipToLocationAvailability: {
      quantity: 1,
    },
  },
});

// Create offer
const offerResponse = await eBay.sell.inventory.createOffer({
  sku: 'DCM-ABC12345',
  marketplaceId: 'EBAY_US',
  format: 'FIXED_PRICE',
  listingDuration: 'GTC',
  pricingSummary: {
    price: {
      value: '199.99',
      currency: 'USD',
    },
  },
  listingPolicies: {
    fulfillmentPolicyId: 'user-shipping-policy-id',
    paymentPolicyId: 'user-payment-policy-id',
    returnPolicyId: 'user-return-policy-id',
  },
  categoryId: '183454', // CCG Individual Cards
});

// Publish offer
const publishResponse = await eBay.sell.inventory.publishOffer(offerResponse.offerId);
console.log('Listing ID:', publishResponse.listingId);
console.log('Listing URL:', `https://www.ebay.com/itm/${publishResponse.listingId}`);
```

---

## 10. Estimated Effort

| Phase | Tasks | Effort | Dependencies |
|-------|-------|--------|--------------|
| **Phase 1** | OAuth Foundation | 3-4 days | eBay Developer Account Approval |
| **Phase 2** | Image & Inventory APIs | 4-5 days | Phase 1 complete |
| **Phase 3** | Offer & Publishing | 3-4 days | Phase 2 complete |
| **Phase 4** | UI/UX | 4-5 days | Phase 3 complete |
| **Phase 5** | Testing & Launch | 3-4 days | All phases complete |
| **Total** | | **~17-22 days** | |

---

## 11. Next Steps

### Immediate (Waiting for Approval)
1. ✅ Register for eBay Developer Program (DONE)
2. ⏳ Wait for eBay developer account approval (1-2 days)

### After Approval
3. Create Sandbox keyset for development/testing
4. Create Production keyset
5. Set up redirect URI in eBay Developer Portal
6. Configure account deletion notifications (required for production)

### Design Decisions Needed
1. **Scope**: Start with one card type (Pokemon?) or all card types?
2. **Pricing model**: Free feature? Premium only? Credit-based?
3. **UI approach**: Modal wizard vs. dedicated page?
4. **Policy creation**: Help users create policies or require existing ones?

### Questions to Answer
1. Should we show estimated eBay fees before publishing?
2. Should we allow editing the auto-generated description?
3. Should we support auction listings or just fixed price initially?
4. Should we track listing status (active/ended/sold) via webhooks?

---

## 12. Sources

### Official eBay Documentation
- [eBay Inventory API Overview](https://developer.ebay.com/api-docs/sell/inventory/overview.html)
- [eBay Media API Overview](https://developer.ebay.com/api-docs/commerce/media/overview.html)
- [OAuth Tokens Guide](https://developer.ebay.com/api-docs/static/oauth-tokens.html)
- [From Inventory Item to eBay Offer](https://developer.ebay.com/api-docs/sell/static/inventory/inventory-item-to-offer.html)
- [Required Fields for Publishing an Offer](https://developer.ebay.com/api-docs/sell/static/inventory/publishing-offers.html)
- [Condition Descriptor IDs for Trading Cards](https://developer.ebay.com/api-docs/user-guides/static/mip-user-guide/mip-enum-condition-descriptor-ids-for-trading-cards.html)
- [Create eBay API Keysets](https://developer.ebay.com/api-docs/static/gs_create-the-ebay-api-keysets.html)
- [Managing Images](https://developer.ebay.com/api-docs/sell/static/inventory/managing-image-media.html)

### Third-Party Resources
- [ebay-api Node.js Library](https://github.com/hendt/ebay-api)
- [eBay Connect 2023 - Condition Grading for Trading Cards (PDF)](https://developer.ebay.com/cms/files/connect-2023/condition_grading_trading_cards.pdf)

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-14 | 1.0 | Initial research and planning document |

---

*Document prepared for DCM Grading - eBay Integration Project*
