# Insta-List 2.0 — eBay Selling Hub Plan (REVISED)

**Status:** Revised draft — pending user approval
**Last updated:** 2026-06-02
**Companion doc:** [`EBAY_INTEGRATION_PLAN.md`](./EBAY_INTEGRATION_PLAN.md) (original integration design)

> **Revision note (2026-06-02):** This document supersedes the 2026-05-18 draft.
> Key changes per user decisions:
> - URL locked to **`/instalist-marketplace`**
> - **Single-card listing flow only** — no bulk listing in v1
> - **Stats dashboard added to Phase 1** as a co-equal feature
> - **Image pipeline = same as the card-detail-page InstaList** (graded labels, mini-report, raw images, gallery additions)
> - **No referral fee** — InstaList is complementary for DCM users
> - **No raw card listings** in v1 (graded only)
> - **Web-only** for v1; mobile parity deferred

---

## TL;DR

Build `/instalist-marketplace` — a dedicated web page where DCM users can:

1. **List one of their graded cards** using the exact same image/form flow as the existing single-card InstaList modal on the card detail page, just hoisted into a dedicated page so users don't have to navigate to each card.
2. **See their eBay listing performance** — active listings, sold history, ended listings, view counts, watchers, and revenue.

Use existing infrastructure wherever it overlaps: the same `EbayListingModal` logic, the same `tradingApi.createListing` create path, the same image generation pipeline (`generateCardImages`, `generateMiniReportJpg`, and label studio outputs). Add a thin layer for the listings dashboard via the Sell API + Trading API's `GetMyeBaySelling`.

**Effort estimate (web only):** Phase 1 MVP shippable in **1.5–2 days**.

---

## Section 1 — Scope of v1

### In scope

| Feature | Source |
|---|---|
| `/instalist-marketplace` route (web) | New |
| Card picker (your graded cards) | Reuse `/collection` query |
| Single-card listing form | Refactor `EbayListingModal` into inline component |
| Image generation (front/back graded label + mini-report + raw + gallery uploads) | Reuse existing pipeline |
| Listings dashboard (Active / Sold / Ended) | Sell API + Trading API |
| Status sync via cron | New — every 15 min |
| Connection state / re-auth prompts | Reuse `/api/ebay/status` |

### Out of scope (v1)

- Bulk listing — listing one card at a time, by design
- Mobile parity — defer to v1.1 once web is validated
- Raw / ungraded card listings
- Order management (Phase 3)
- Promoted Listings UI (Phase 5)
- DCM referral fees on sales

---

## Section 2 — Page layout

```
┌────────────────────────────────────────────────────────────────────┐
│  Header  │ "InstaList Marketplace" · [✓ Connected as @user]       │
├──────────┴─────────────────────────────────────────────────────────┤
│                                                                     │
│  Stats strip (top of page, always visible)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │  ACTIVE  │ │   SOLD   │ │  ENDED   │ │ REVENUE  │              │
│  │    12    │ │    47    │ │    3     │ │ $2,340   │              │
│  │ listings │ │  lifetime│ │  unsold  │ │  net     │              │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
│                                                                     │
│  Tabs: [ List a Card ] [ My Listings ] [ Sold ] [ Ended ]          │
│  ────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Tab content:                                                       │
│                                                                     │
│  ┌─ LIST A CARD TAB ─────────────────────────────────────────────┐ │
│  │ Left rail:                  Main area:                         │ │
│  │  • Search / filter           ┌───────────────────────────────┐ │ │
│  │  • Card type tabs            │ Selected card preview         │ │ │
│  │  • Recently graded           │ Same form as the existing     │ │ │
│  │  • Not yet listed (default)  │ InstaList modal:              │ │ │
│  │                              │  - Title (auto-suggested)     │ │ │
│  │  Card thumbnail list         │  - Price (pre-fill: median)   │ │ │
│  │  Click to select →           │  - Format / duration           │ │ │
│  │                              │  - Images (auto-generated +   │ │ │
│  │                              │    gallery upload)             │ │ │
│  │                              │  - Policies (payment/ship/ret)│ │ │
│  │                              │  - [Preview] [List on eBay]    │ │ │
│  │                              └───────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ MY LISTINGS TAB ─────────────────────────────────────────────┐ │
│  │ Grid: thumbnail · title · price · views · watchers · time     │ │
│  │ Click a row → side panel with live state + actions:            │ │
│  │   [End listing] [Revise price] [View on eBay] [Promote]        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ SOLD TAB ────────────────────────────────────────────────────┐ │
│  │ Table: thumbnail · title · sale price · fees · net · sold date │ │
│  │ Per-row: [Relist similar]                                       │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ ENDED TAB ───────────────────────────────────────────────────┐ │
│  │ Listings that ended without selling. [Relist] action on each.  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

---

## Section 3 — Phased implementation

### Phase 1 — MVP (~1.5–2 days)

**Goal:** Users can list one card at a time from a dedicated page and see their full listings dashboard.

| Task | File |
|---|---|
| New page | `src/app/instalist-marketplace/page.tsx` |
| Client component | `src/app/instalist-marketplace/MarketplaceClient.tsx` |
| Refactor existing modal into shared component | `src/components/ebay/InlineListingForm.tsx` (extracted from `EbayListingModal.tsx`) |
| Listings dashboard query API | `src/app/api/ebay/my-listings/route.ts` |
| Status sync cron | `src/app/api/cron/ebay-sync/route.ts` |
| Sell API client wrapper | `src/lib/ebay/sellApi.ts` |
| Add cron entry | `vercel.json` |

**Status sync logic:**
- Cron runs every 15 minutes
- For each user with `ebay_listings.status='active'`, call `GetMyeBaySelling`
- Update `ebay_listings.status` / `ended_at` / `sold_at` based on response
- Cache view counts and watcher counts on `ebay_listings`

### Phase 2 — Listing management actions (~½–1 day)

| Action | API |
|---|---|
| End listing | Trading API `EndItem` |
| Revise price / title / description | `ReviseFixedPriceItem` |
| Relist sold/ended | `RelistFixedPriceItem` |
| Best Offer accept / decline / counter | `RespondToBestOffer` |

### Phase 3 — Order management (~1 day)

| Capability | Notes |
|---|---|
| List paid orders awaiting shipment | Fulfillment API `getOrders` |
| Mark shipped with tracking | `CompleteSale` or `createShippingFulfillment` |
| Handle returns | Fulfillment API `getReturns` |
| New `ebay_orders` table | order_id, listing_id, buyer ref, sale price, fees, status, tracking |

### Phase 4 — Analytics dashboard (~½ day)

| Metric | Source |
|---|---|
| Total active listing value | `ebay_listings` aggregate |
| Lifetime gross / net | `ebay_orders` |
| Avg time to sale | Computed from `created_at` → `sold_at` |
| Sales velocity (last 7/30/90 days) | `ebay_orders.sold_at` window |
| Per-card-type breakdown | Join `cards.category` |
| Price trend vs. market median | Cross-ref `cards.ebay_price_median` |

### Phase 5 — Promotion + dynamic pricing (~½ day)

| Capability | Notes |
|---|---|
| Promoted Listings campaign auto-enroll | Reuse `marketingApi.ts` |
| Suggested ad rate inline on each listing | API: `getAdsByInventoryReference` |
| Dynamic re-pricing | Optional — rules engine |

**Total effort (all phases):** ~3.5–5 days. Phase 1 alone ships meaningful value.

---

## Section 4 — Image pipeline (locked: same as card-detail InstaList)

For each listing, generate the same image set the existing modal produces:

1. **Front graded label image** (`cardImageGenerator.ts` → modern or traditional overlay)
2. **Back graded label image** (same)
3. **Mini grading report** (`miniReportJpgGenerator.ts`)
4. **Raw front photo** (`cards.front_url`)
5. **Raw back photo** (`cards.back_url`)
6. **User-uploaded gallery images** (existing flow — user can add up to 24 total per eBay rules)

eBay's PictureDetails / Sell API picture uploads accept up to 24 images. Reuse the existing upload flow on the card detail page — same UI, same backend.

---

## Section 5 — Architectural decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| URL path | `/instalist-marketplace` | User-locked |
| API strategy | Hybrid: Trading API for create, Sell API + Fulfillment API for read/monitor | Sell API JSON > Trading XML for dashboards; create path already proven |
| Status sync | Polling cron (15 min) | Simple, no extra eBay developer console config |
| Bulk listing | Not in v1 | User-locked: one card at a time |
| Raw cards | Not in v1 | User-locked: graded only |
| Mobile | Web-only v1 | User-locked: validate web first |
| Referral fee | None | User-locked: complementary service |

---

## Section 6 — What else is possible through the eBay API

You asked for the full menu. Here's everything that's *reachable* given your existing scopes (`sell.inventory`, `sell.account`, `sell.fulfillment`, `sell.marketing`, `commerce.identity.readonly`) plus the Trading API connection.

### Already used by DCM today

| Capability | API |
|---|---|
| OAuth + token refresh | Trading + Sell |
| Create listing (fixed price + auction) | Trading `AddFixedPriceItem` / `AddItem` |
| Price intelligence on cards | Browse API (client credentials) |
| Promoted Listings (half-built) | Sell Marketing API |

### Read & monitor (cheap to add — Phase 1)

| Capability | API | Why it matters |
|---|---|---|
| List your active eBay listings | Trading `GetMyeBaySelling` or Sell Inventory `getOffers` | Powers the dashboard |
| Per-listing view count + watchers | Trading `GetItem.HitCount` + `WatchCount` | Drives user engagement insight |
| Sold listings history | `GetMyeBaySelling` (Sold container) | Revenue tracking |
| Unsold / ended listings | `GetMyeBaySelling` (Unsold) | Relist prompts |
| Buyer Best Offers received | `GetBestOffers` | Negotiation surface |
| Seller's account settings & policies | Sell Account API | Pre-fill listing form with saved policies |

### Write & manage (Phase 2)

| Capability | API |
|---|---|
| End listing early | Trading `EndItem` |
| Revise price / title / description / item specifics | Trading `ReviseFixedPriceItem` |
| Relist a sold or ended item (one click) | Trading `RelistFixedPriceItem` |
| Respond to Best Offer (accept / decline / counter) | Trading `RespondToBestOffer` |
| Bulk price adjustments via inventory groups | Sell Inventory `createOrReplaceInventoryItemGroup` |

### Orders & shipping (Phase 3)

| Capability | API |
|---|---|
| Paid orders awaiting shipment | Fulfillment `getOrders` |
| Mark shipped with tracking | Trading `CompleteSale` or Fulfillment `createShippingFulfillment` |
| Get tracking carriers list | Trading `GeteBayDetails` |
| Cancel an order (pre-shipment) | Fulfillment `issueRefund` |
| Process buyer returns | Fulfillment `getReturns` + `acceptReturn` / `declineReturn` |
| Payment payouts to seller | Sell Finances API `getPayouts` |
| Transaction-level fees breakdown | Sell Finances `getTransactions` |

### Promotion & marketing (Phase 5)

| Capability | API |
|---|---|
| Promoted Listings Standard — campaign mgmt | Sell Marketing `createCampaign` |
| Promoted Listings Standard — ad rates per item | `createAdsByListingId` / `bulkCreateAdsByListingId` |
| Suggested ad rates | `getAdRates` |
| Markdown sales / promo events | Sell Marketing `createItemPriceMarkdownPromotion` |
| Volume pricing | `createItemPromotion` |
| Coupons | `createCodedCoupon` |
| Best-selling item highlights | Sell Marketing — eligibility-based |

### Analytics (Phase 4)

| Capability | API |
|---|---|
| Traffic report (impressions, clicks, CTR) | Sell Analytics API `getTrafficReport` |
| Listing performance (views by listing) | Sell Analytics `getCustomerServiceMetric` |
| Search keywords surfacing your listings | Sell Analytics (limited) |
| Conversion rate per listing | Computed: views / sales |
| Seller standards / defect rate | Sell Analytics `getSellerStandardsProfile` |
| Late shipment rate | Same |

### Buyer interaction

| Capability | API | Status |
|---|---|---|
| Read buyer messages | Trading `GetMemberMessages` | Working but limited |
| Reply to buyer Q&A | Trading `AddMemberMessageAAQToPartner` | Working |
| Real-time message webhooks | Notifications API | Requires eBay dev console config |

### Real-time event notifications (alternative to polling)

| Event | Notification type |
|---|---|
| Item sold | `ItemSold` |
| Item ended | `ItemClosed` |
| New Best Offer | `BestOfferPlaced` |
| Buyer message | `MyMessages*` |
| Auction outbid | `AuctionCheckoutComplete` |

Requires registering a `/api/ebay/webhook` endpoint and verifying payload signatures. Worth upgrading from polling once user volume justifies the dev work.

### Cross-border / international (out of v1 scope but worth knowing)

| Capability | API |
|---|---|
| List in non-US eBay sites | Trading `AddItem` with SiteCodeType |
| Currency conversion at checkout | Handled by eBay automatically |
| International shipping policies | Sell Account API |
| GSP (Global Shipping Program) opt-in | Trading `ShippingDetails.InternationalShippingOption` |

### Things that are NOT possible through the API

Worth knowing so we don't promise them:

- **Direct printing of eBay shipping labels** — there's no API for native label purchase; users must go to eBay's web UI for that, or integrate a 3P like Shippo / EasyPost.
- **Pulling a buyer's real email address pre-shipment** — eBay anonymizes buyer contact info.
- **Setting auction reserve prices on Fixed Price listings** — eBay doesn't allow it.
- **Editing a listing after first bid** (auction only) — Trading API blocks most revisions.

---

## Section 7 — Open implementation details to confirm before coding

These are smaller than the architectural decisions but worth flagging:

1. **Default tab on page load** — "List a Card" (action-oriented) or "My Listings" (dashboard-first)? Recommend "My Listings" once a user has any active listings, "List a Card" if they have none yet.
2. **Card eligibility filter** — show all graded cards, or hide cards that already have an active listing? Recommend hide (with a small "X cards already listed" indicator).
3. **Connection prompt** — what happens if user is not connected to eBay? Inline embed of `EbayConnectButton` at the top of the page, blocking the tabs until connected.
4. **Stats refresh cadence** — refresh on tab focus, on demand via a refresh button, or every 60s while page is open? Recommend on focus + manual refresh button. The cron handles the heavy lifting.
5. **Empty states** — "List a Card" with zero unlisted cards: "You've listed all your graded cards. Grade more →". "My Listings" with zero active: "No active listings yet — list your first →". Worth writing these now.
6. **Sold tab — net payout vs. gross** — show eBay's `FinalValueFee` + `TransactionFee` deducted to give actual net, or just gross sale price? Need Sell Finances API to get accurate net. Recommend gross in v1, accurate net in Phase 4.

---

## Section 8 — File map (Phase 1)

```
src/app/instalist-marketplace/
  page.tsx                          (server entry)
  MarketplaceClient.tsx             (client root with tabs + stats strip)
  components/
    StatsStrip.tsx                  (active/sold/ended/revenue tiles)
    ListNewTab.tsx                  (left rail + form area)
    MyListingsTab.tsx               (grid of active listings)
    SoldTab.tsx                     (table of sold items)
    EndedTab.tsx                    (table of unsold ended items)
    CardPicker.tsx                  (left rail card selector)
    InlineListingForm.tsx           (extracted from EbayListingModal)
    ListingDetailPanel.tsx          (side panel with revise/end/promote)

src/app/api/ebay/
  my-listings/route.ts              (read: active/sold/unsold, returns to dashboard)
  stats/route.ts                    (aggregated metrics for the stats strip)

src/app/api/cron/
  ebay-sync/route.ts                (15-min poller)

src/lib/ebay/
  sellApi.ts                        (Sell + Fulfillment API wrappers)

vercel.json                         (add cron entry)
```

Phase 2–5 additions per Section 3.

---

## Section 9 — Test plan (localhost)

Per user instruction: build locally and validate before any production push.

1. Run `npm run dev`, open `http://localhost:3000/instalist-marketplace`
2. Verify eBay connection state shows correctly (connected vs. not)
3. List a card from sandbox eBay account — confirm appears in `ebay_listings` and in `MyListingsTab` after sync
4. Trigger the cron manually (curl + `CRON_SECRET`) to test status sync
5. Manually end a sandbox listing in eBay UI — confirm `MyListingsTab` reflects ended status after next sync
6. Verify image pipeline matches what card-detail page produces (visual diff)
7. Stats strip shows accurate counts pulled from DB

No `git push` until explicit approval. All testing on localhost.

---

## Appendix A — Original 2026-05-18 draft

Preserved for historical reference at the bottom of this section if needed. Key differences from this revision:
- Original assumed bulk listing as Phase 1 core; revised is single-card per user direction
- Original didn't include a stats dashboard in Phase 1
- Original was URL-path-agnostic (open question); revised locks `/instalist-marketplace`
- Original considered mobile parity from day one; revised defers mobile until web v1 validation

## Appendix B — eBay API documentation links

- Trading API: https://developer.ebay.com/devzone/xml/docs/reference/ebay/index.html
- Sell Inventory API: https://developer.ebay.com/api-docs/sell/inventory/overview.html
- Sell Fulfillment API: https://developer.ebay.com/api-docs/sell/fulfillment/overview.html
- Sell Account API: https://developer.ebay.com/api-docs/sell/account/overview.html
- Sell Marketing API: https://developer.ebay.com/api-docs/sell/marketing/overview.html
- Sell Analytics API: https://developer.ebay.com/api-docs/sell/analytics/overview.html
- Sell Finances API: https://developer.ebay.com/api-docs/sell/finances/overview.html
- Browse API: https://developer.ebay.com/api-docs/buy/browse/overview.html
- Notifications API: https://developer.ebay.com/api-docs/commerce/notification/overview.html
