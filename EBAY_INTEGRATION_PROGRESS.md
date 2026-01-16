# eBay Integration Progress

**Last Updated:** January 15, 2026
**Status:** Phase 2 In Progress (Policy Creation Debugging)

---

## Overview

Building eBay listing integration for DCM (Digital CardMania) card grading app. Users can list their graded cards directly to eBay from the card details page.

---

## Completed Features

### Phase 1: OAuth Connection (COMPLETE)
- eBay OAuth 2.0 flow with sandbox/production support
- Token storage in Supabase (`ebay_connections` table)
- Automatic token refresh
- Connection status UI in settings

**Key Files:**
- `/src/lib/ebay/auth.ts` - Token management, refresh logic
- `/src/app/api/ebay/auth/route.ts` - OAuth initiation
- `/src/app/api/ebay/callback/route.ts` - OAuth callback handler
- `/src/lib/ebay/constants.ts` - API URLs, scopes, category mappings

### Phase 2: Listing Modal (IN PROGRESS)

#### Completed Steps:

1. **Images Step** - Select front, back, and mini-report images with DCM labels
2. **Details Step** - Title, description, price, format (Buy It Now/Auction), Best Offer toggle
3. **Item Specifics Step** - Pre-filled from card data, fetches additional aspects from eBay Taxonomy API
4. **Policies Step** - Inline policy creation form OR select existing policies
5. **Review Step** - Summary before publishing

**Key Files:**
- `/src/components/ebay/EbayListingModal.tsx` - Main 5-step wizard modal
- `/src/lib/ebay/itemSpecifics.ts` - Maps card data to eBay item specifics
- `/src/app/api/ebay/listing/route.ts` - Creates inventory item, offer, publishes
- `/src/app/api/ebay/images/route.ts` - Uploads images to Supabase storage
- `/src/app/api/ebay/aspects/route.ts` - Fetches eBay category aspects
- `/src/app/api/ebay/policies/route.ts` - GET existing policies
- `/src/app/api/ebay/policies/create/route.ts` - POST create new policies

---

## Current Blocker: Policy Creation

### Problem
When users try to create shipping/payment/return policies via the API, eBay sandbox returns "Invalid request" errors.

### Error Example
```
Failed to create some policies
Shipping: Invalid request.
Payment: Invalid .
Returns: Invalid .
```

### Attempted Fixes
1. Simplified policy structures to match eBay documentation
2. Changed shipping service from `USPSFirstClass` to `USPSPriority`
3. Removed invalid `buyerResponsibleForShipping` field
4. Added `sortOrder` to shipping services
5. Simplified payment policy (removed `paymentMethods`, using just `immediatePay: false`)
6. Added better error parsing to extract detailed eBay error messages

### Workaround Implemented
- Added helpful UI guidance when policy creation fails
- Link to create policies directly on eBay
- "Refresh Policies" button to reload after manual creation
- Users can create policies on eBay, then return to app and use them

### Likely Root Cause
- eBay sandbox account may not have business policies enabled
- Sandbox has different requirements than production
- Account-level setup may be required before API can create policies

---

## Database Tables

### `ebay_connections`
Stores OAuth tokens per user:
- `user_id`, `access_token`, `refresh_token`, `expires_at`, `is_sandbox`, `ebay_username`

### `ebay_listings`
Tracks listings created through the app:
- `card_id`, `user_id`, `sku`, `offer_id`, `listing_id`, `title`, `price`, `status`, etc.

### `ebay_user_policies` (optional cache)
Caches user's eBay policies for 24 hours:
- `user_id`, `policy_type`, `policy_id`, `name`, `description`, `cached_at`

---

## Key Implementation Details

### Title Format
```
{Character} - {Subset} - {Card Number} - {/X} - DCM Grade {Grade} - {Condition Label}
```
Example: "Pikachu - Base Set - 58/102 - /500 - DCM Grade 9 - Gem Mint"

### Condition Descriptors (for graded cards)
eBay requires these for condition ID `2750` (Graded):
- Professional Grader: `2750117` (Other - for DCM)
- Grade: Maps 1-10 to eBay grade IDs
- Certification Number: Card serial number

### Category Mapping
```typescript
Pokemon/MTG/Lorcana -> 183454 (CCG Individual Cards)
Sports cards -> 261328 (Sports Trading Card Singles)
Other -> 183050 (Non-Sport Trading Card Singles)
```

### HTML Description
Rich HTML template with:
- Card details table
- DCM grade display with color coding
- Sub-grades (Centering, Corners, Edges, Surface)
- AI-generated overview
- DCM branding footer

---

## Item Specifics Helpers

Located in `/src/lib/ebay/itemSpecifics.ts`:

```typescript
// Check if card has autograph
hasAutograph(card) // Checks multiple data sources

// Get serial numbering (e.g., "123/500")
getSerialNumbering(card)

// Get denominator for title (e.g., "/500")
getSerialDenominator(serialNumber)

// Map card to eBay item specifics
mapCardToItemSpecifics(card, category)
```

---

## UI Features

### Description Editor
- Shows rendered HTML preview by default
- Toggle to view/edit raw HTML code
- Button: "Preview HTML Code" / "Hide Code"

### Item Specifics
- Pre-filled fields from card data (shown with green "From Card Data" badge)
- Required fields marked with amber "eBay Recommended" badge
- Additional fields in 2-column grid
- Fetches available aspects from eBay Taxonomy API

### Policy Creator
- Shipping options: Free, Flat Rate, Calculated
- Handling time: 1-5 business days
- Returns: Accept/Don't accept, return window, who pays shipping
- Defaults: Calculated shipping, No returns

---

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
EBAY_REDIRECT_URI=
```

---

## Next Steps

1. **Debug policy creation** - Check eBay sandbox account settings, try with production account
2. **Test full listing flow** - End-to-end test creating a listing
3. **Add listing management** - View/edit/end listings
4. **Production deployment** - Switch from sandbox to production eBay API

---

## Useful Commands

```bash
# Type check
npx tsc --noEmit

# Dev server
npm run dev

# Check eBay-related errors only
npx tsc --noEmit 2>&1 | grep -E "(ebay|EbayListing)"
```

---

## Reference Links

- [eBay Account API - createFulfillmentPolicy](https://developer.ebay.com/api-docs/sell/account/resources/fulfillment_policy/methods/createFulfillmentPolicy)
- [eBay Inventory API](https://developer.ebay.com/api-docs/sell/inventory/overview.html)
- [eBay Condition Descriptors](https://developer.ebay.com/api-docs/sell/static/metadata/condition-id-values.html)
- [eBay Taxonomy API - Item Aspects](https://developer.ebay.com/api-docs/commerce/taxonomy/resources/category_tree/methods/getItemAspectsForCategory)
