# DCM Grading: B2B Partnership Options

## Overview

This document outlines the technical and business options for a partnership where an external grading company uses DCM's grading technology and infrastructure, while displaying graded card details on their own branded website.

The core need: **Partner grades cards using DCM. Card results are accessible on DCM's site AND on the partner's own site under their branding.**

---

## Table of Contents

1. [How DCM Grading Works Today](#1-how-dcm-grading-works-today)
2. [Partnership Options](#2-partnership-options)
   - [Option A: Simple Account + Data Sync (Recommended Starting Point)](#option-a-simple-account--data-sync)
   - [Option B: API-Only Integration](#option-b-api-only-integration)
   - [Option C: White-Label Instance](#option-c-white-label-instance)
   - [Option D: Multi-Tenant Platform](#option-d-multi-tenant-platform)
3. [Data Delivery Methods](#3-data-delivery-methods)
4. [Pricing Models](#4-pricing-models)
5. [Comparison Matrix](#5-comparison-matrix)
6. [Recommended Path](#6-recommended-path)

---

## 1. How DCM Grading Works Today

### Grading Flow

1. User creates an account on dcmgrading.com
2. User purchases grading credits via Stripe
3. User uploads front and back card images
4. DCM's AI engine (GPT-4o Vision) performs a three-pass grading analysis:
   - **Pass 1**: Evaluates centering, corners, edges, and surface condition
   - **Pass 2**: Cross-verifies findings from Pass 1
   - **Pass 3**: Final assessment and grade determination
5. A decimal grade (1.0-10.0) and whole grade (1-10) are generated
6. Estimated professional grades (PSA, BGS, SGC, CGC equivalents) are calculated
7. A full condition report with sub-scores and defect analysis is stored

### Card Detail Pages

Each graded card gets a public detail page at:

```
https://dcmgrading.com/{category}/{card-id}
```

Examples:
- `dcmgrading.com/pokemon/abc-123`
- `dcmgrading.com/sports/def-456`

These pages display:
- Card images (front and back)
- Overall grade and condition label
- Sub-scores (centering, corners, edges, surface)
- Defect analysis and narrative
- Estimated professional grades
- QR code linking to the page
- Shareable links (Facebook, Twitter, direct URL)

### QR Codes & Labels

DCM generates QR codes that link to card detail pages. These can be embedded in:
- Printable grading labels (modern and traditional styles)
- PDF condition reports
- On-screen card detail views

---

## 2. Partnership Options

---

### Option A: Simple Account + Data Sync

**Summary**: Partner uses the existing DCM platform as-is. They get a regular account, grade cards through dcmgrading.com, and card detail pages live on DCM's site. Additionally, card data is made available to the partner's website through one or more data delivery methods.

#### How It Works

1. Partner creates a standard DCM account
2. Partner logs into dcmgrading.com, uploads cards, and grades them
3. Card detail pages are live on DCM's site (existing functionality)
4. Grading data is delivered to the partner's site via API, webhook, or embed (see Section 3)
5. Partner builds their own card detail page on their website using the delivered data
6. Partner generates their own QR codes pointing to their own pages

#### What DCM Builds

| Component | Description |
|-----------|-------------|
| Read-only card data API | Single endpoint returning card grade data as JSON |
| Webhook notifications | Automatic push to partner's server when grading completes |
| Partner configuration | Simple settings table for API key and webhook URL |

#### What the Partner Builds

- Their own card detail page on their website
- QR code generation pointing to their own domain
- Backend to receive webhook data (if using webhook delivery)

#### What Stays Unchanged

- The entire DCM grading platform
- Card detail pages on dcmgrading.com
- QR codes on DCM labels
- All existing user flows

#### Considerations

- All partner cards live under one user account (or a small number of accounts)
- Credits purchased through the normal Stripe checkout flow; bulk pricing can be arranged separately
- Cards must be set to "public" visibility for the API to serve them, which also makes them visible in DCM's public areas
- If multiple people at the partner company need to grade, they share login credentials or use separate accounts tracked informally

#### Best For

- Testing the partnership with minimal investment from both sides
- Partners who have their own development resources
- Getting to market quickly

---

### Option B: API-Only Integration

**Summary**: DCM exposes a dedicated grading API. The partner submits card images programmatically, receives grading results, and builds their entire user-facing experience independently. The partner does not use dcmgrading.com directly.

#### How It Works

1. Partner receives API credentials (API key + secret)
2. Partner's application submits card images via `POST /api/v1/grade`
3. DCM processes the grading asynchronously
4. Partner receives results via webhook callback or polling `GET /api/v1/grade/{id}`
5. Partner displays results on their own site with their own branding
6. Card detail pages optionally also exist on dcmgrading.com

#### What DCM Builds

| Component | Description |
|-----------|-------------|
| API key authentication | Partner API key table with rate limits and access control |
| Auth middleware | Validates API keys on `/api/v1/*` routes |
| Submit endpoint | `POST /api/v1/grade` -- accepts images, returns job ID |
| Result endpoint | `GET /api/v1/grade/{id}` -- returns full grade data as JSON |
| Status endpoint | `GET /api/v1/grade/{id}/status` -- polling for completion |
| Webhook system | Sends POST to partner's URL when grading completes |
| Partner billing | Admin panel for managing partner credits and invoicing |
| API documentation | Endpoint docs, authentication guide, example payloads |

#### What the Partner Builds

- Integration with DCM's API from their backend
- Their own card upload and grading UI
- Their own card detail pages
- Their own QR code generation
- Their own user management

#### Considerations

- Partner needs development resources to integrate
- DCM has no control over how grades are displayed
- Higher support burden (API documentation, integration debugging)
- No organic traffic to DCM's website from partner's customers
- Cleanest separation of concerns

#### Best For

- Partners with strong technical teams
- Situations where the partner wants full control over user experience
- Scaling to multiple partners using the same API

---

### Option C: White-Label Instance

**Summary**: DCM deploys a separate, fully branded instance of the grading platform for the partner. It looks and feels like the partner's product, but runs on DCM's technology. Card detail pages live on the partner's domain.

#### How It Works

1. DCM deploys a copy of the platform at partner's domain (e.g., `grading.partner.com`)
2. Branding is customized: logo, colors, company name
3. Partner's users sign up and grade cards on the partner-branded site
4. Card detail pages and QR codes point to the partner's domain
5. DCM manages the infrastructure behind the scenes

#### What DCM Builds

| Component | Description |
|-----------|-------------|
| Theming system | Environment variables or database config for logo, colors, company name |
| Deployment pipeline | Process for spinning up and maintaining partner instances |
| Custom domain setup | DNS and SSL configuration for partner domains |
| Partner-specific QR codes | QR codes pointing to partner's domain |
| Separate data storage | Dedicated Supabase project or schema isolation per partner |
| Partner admin panel | Separate admin access for the partner |

#### What the Partner Provides

- Their domain name
- Brand assets (logo, color palette)
- Any customization requirements

#### Considerations

- Operational overhead: each partner is a separate deployment to maintain
- Code updates must be rolled out across all instances
- Risk of code divergence if partners request custom features
- Infrastructure costs multiply per partner
- Partner gets a complete, working product with no dev work on their end
- Full branded experience from day one

#### Best For

- Partners who want a turnkey solution with no development effort
- Situations where the partner's brand must be front and center
- High-value partnerships that justify the operational overhead

---

### Option D: Multi-Tenant Platform

**Summary**: A single DCM deployment supports multiple organizations. Each org has its own branding, users, billing, and card namespace. Card detail pages render dynamically based on which organization owns the card.

#### How It Works

1. DCM adds an organization layer to the platform
2. Partner is set up as an organization with their branding config
3. Partner's users sign up under their organization
4. Cards are tagged with an `org_id`
5. Card detail pages detect the org and render with appropriate branding
6. Custom domain routing: `partner.com/cards/{id}` serves DCM's app with partner branding
7. Billing is managed per organization

#### What DCM Builds

| Component | Description |
|-----------|-------------|
| Organizations table | `id, slug, name, domain, logo_url, primary_color, secondary_color, billing_email` |
| Organization users | Join table linking users to orgs with roles |
| Card org tagging | `org_id` column on cards table |
| Dynamic theming | Card detail pages render branding based on card's org |
| Custom domain routing | Partner domains route to DCM app, render with partner brand |
| Org-level billing | Credits and invoicing per organization |
| Org admin dashboard | Partner manages their users, cards, and settings |
| RLS policies | Data isolation between organizations |

#### Database Additions

```
organizations
├── id (UUID)
├── slug (TEXT, unique)
├── name (TEXT)
├── domain (TEXT) -- partner's custom domain
├── logo_url (TEXT)
├── primary_color (TEXT)
├── secondary_color (TEXT)
├── billing_email (TEXT)
├── stripe_customer_id (TEXT)
├── is_active (BOOLEAN)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

organization_users
├── org_id (UUID, FK)
├── user_id (UUID, FK)
├── role (TEXT) -- admin, grader, viewer
└── created_at (TIMESTAMP)

cards.org_id (UUID, FK, nullable)
```

#### Considerations

- Most complex to build upfront
- Single codebase, single deployment -- lowest ongoing cost per partner
- Shared improvements benefit all partners
- Careful RLS policies required for data isolation
- Custom domain routing adds infrastructure complexity
- Scales to many partners without proportional infrastructure growth

#### Best For

- Long-term vision with multiple partners
- Maximizing efficiency at scale
- Partners who want their own branded experience without DCM running separate infrastructure

---

## 3. Data Delivery Methods

These methods apply primarily to Option A but can also supplement Options B-D.

### Method 1: Embed (iFrame)

Partner embeds DCM's card detail page directly on their site.

```html
<iframe
  src="https://dcmgrading.com/pokemon/abc-123"
  width="100%"
  height="800"
  frameborder="0"
></iframe>
```

| Aspect | Detail |
|--------|--------|
| **DCM effort** | None (works today), or minimal (build a clean `/embed/{id}` view without nav/footer) |
| **Partner effort** | Minimal -- just paste iframe code |
| **Branding** | Shows DCM branding inside the embed |
| **Customization** | Very limited -- partner can only control iframe dimensions |
| **User experience** | Looks like an embedded third-party widget |
| **SEO impact** | No SEO value for the partner's site (iframe content not indexed under their domain) |

### Method 2: Read-Only API

Partner fetches card data as JSON and builds their own display.

```
GET https://dcmgrading.com/api/v1/cards/{id}
Authorization: Bearer {api_key}

Response:
{
  "id": "abc-123",
  "category": "pokemon",
  "card_name": "Charizard",
  "card_set": "Base Set",
  "grade": 8.5,
  "whole_grade": 9,
  "condition_label": "Mint",
  "sub_scores": {
    "centering": 9.0,
    "corners": 8.5,
    "edges": 8.5,
    "surface": 9.0
  },
  "estimated_professional_grades": {
    "PSA": 9,
    "BGS": 8.5,
    "SGC": 9,
    "CGC": 8.5
  },
  "front_image_url": "https://...",
  "back_image_url": "https://...",
  "graded_at": "2026-01-15T12:00:00Z",
  "detail_url": "https://dcmgrading.com/pokemon/abc-123"
}
```

| Aspect | Detail |
|--------|--------|
| **DCM effort** | Small -- one new API endpoint + API key auth |
| **Partner effort** | Medium -- build their own card detail page |
| **Branding** | Fully partner-branded (they control rendering) |
| **Customization** | Complete -- partner renders data however they want |
| **User experience** | Native to partner's site |
| **SEO impact** | Full SEO value for partner's site |

### Method 3: Webhook Push

DCM automatically sends grading results to the partner's server when complete.

```
POST https://partner.com/api/webhooks/dcm-grade
Content-Type: application/json
X-DCM-Signature: {hmac_signature}

{
  "event": "grade.completed",
  "card": {
    "id": "abc-123",
    "category": "pokemon",
    "card_name": "Charizard",
    "grade": 8.5,
    ... (full card data)
  }
}
```

| Aspect | Detail |
|--------|--------|
| **DCM effort** | Small -- webhook dispatch after grading completes |
| **Partner effort** | Medium -- endpoint to receive data + storage + display |
| **Branding** | Fully partner-branded |
| **Customization** | Complete |
| **Real-time** | Data arrives automatically, no polling needed |
| **Reliability** | Needs retry logic for failed deliveries |

### Recommended Combination

**API + Webhook together** provides the best experience:
- Webhook delivers results in real-time as cards are graded
- API serves as a fallback for on-demand fetching, re-grades, or corrections
- Partner always has access to current data

---

## 4. Pricing Models

| Model | Structure | Best For |
|-------|-----------|----------|
| **Per-grade** | Partner pays a fixed fee per card graded (e.g., $0.50-$2.00/grade) | Low volume, trial phase |
| **Credit packs** | Bulk purchase at a discount (e.g., 500 grades for $X, 1000 for $Y) | Medium volume, predictable usage |
| **Monthly subscription** | Flat monthly fee includes N grades, overage charged per-grade | High volume, predictable revenue |
| **Revenue share** | DCM receives a percentage of what the partner charges their end customers | Aligned incentives, variable revenue |
| **Tiered pricing** | Volume-based discounts (1-100: $X, 101-500: $Y, 500+: $Z per grade) | Scaling partnerships |

### Credit Fulfillment Options

- **Self-service**: Partner buys credits through DCM's existing Stripe checkout
- **Manual allocation**: DCM admin adds credits to partner's account per invoice
- **Auto-replenish**: Partner's account auto-charges when credits drop below threshold
- **Monthly invoice**: Track usage, invoice partner monthly via standard billing

---

## 5. Comparison Matrix

| Factor | Option A: Account + Data Sync | Option B: API-Only | Option C: White-Label | Option D: Multi-Tenant |
|--------|------|------|------|------|
| **DCM development effort** | Low | Medium | Medium-High | High |
| **Partner development effort** | Medium | High | None | None-Low |
| **Speed to launch** | Fast | Medium | Medium | Slow |
| **Partner branding on their site** | Full (they build it) | Full (they build it) | Full (DCM configures) | Full (DCM configures) |
| **DCM branding preserved** | Yes (on DCM site) | Optional | No | Configurable |
| **Ongoing operational cost** | Low | Low | High (per instance) | Medium |
| **Scales to multiple partners** | Moderate | Good | Poor | Excellent |
| **Partner needs developers** | Yes | Yes | No | No |
| **Data lives on** | DCM + Partner | DCM + Partner | Partner instance | Shared platform |
| **QR codes point to** | Both sites possible | Partner's site | Partner's site | Partner's site |
| **Risk level** | Low | Low | Medium | Medium |

---

## 6. Recommended Path

### Phase 1: Start Simple (Option A)

Begin with Option A to validate the partnership with minimal investment:

1. Partner gets a DCM account and starts grading cards
2. DCM builds a read-only API endpoint and webhook notification
3. Partner builds their own card detail page using the API data
4. Both sites display the card data -- DCM's page and the partner's page
5. QR codes can point to either site depending on who generates them

This tests the business relationship, validates demand, and generates revenue immediately.

### Phase 2: Scale Based on Demand

Based on how Phase 1 goes:

- **If the partner wants less dev work** -> Move toward Option C (white-label) or Option D (multi-tenant)
- **If more partners sign up** -> Invest in Option D (multi-tenant) for efficiency at scale
- **If the partner is happy building their own UI** -> Stay on Option A/B and optimize the API

### Phase 3: Platform Play (If Multiple Partners)

If the B2B model proves successful with multiple partners, Option D becomes the right investment. A single multi-tenant platform with per-org branding, billing, and custom domains is the most scalable architecture long-term.

---

## Appendix: Sample API Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "category": "pokemon",
  "status": "graded",

  "card_info": {
    "name": "Charizard",
    "set": "Base Set",
    "number": "4/102",
    "year": "1999",
    "manufacturer": "Wizards of the Coast",
    "featured": "Charizard",
    "type": "Fire",
    "hp": 120
  },

  "grade": {
    "decimal": 8.5,
    "whole": 9,
    "condition_label": "Mint",
    "confidence": "A",
    "sub_scores": {
      "centering": { "score": 9.0, "notes": "Slightly off-center top to bottom" },
      "corners": { "score": 8.5, "notes": "Minor wear on bottom-left corner" },
      "edges": { "score": 8.5, "notes": "Light whitening along right edge" },
      "surface": { "score": 9.0, "notes": "Clean surface, no scratches" }
    },
    "estimated_professional": {
      "PSA": 9,
      "BGS": 8.5,
      "SGC": 9,
      "CGC": 8.5
    }
  },

  "images": {
    "front": "https://dcmgrading.com/storage/cards/.../front.jpg",
    "back": "https://dcmgrading.com/storage/cards/.../back.jpg"
  },

  "metadata": {
    "graded_at": "2026-01-15T12:00:00Z",
    "read_time_minutes": null,
    "ai_model_version": "v3.8"
  },

  "links": {
    "detail_page": "https://dcmgrading.com/pokemon/550e8400-e29b-41d4-a716-446655440000",
    "qr_code_url": "https://dcmgrading.com/api/v1/cards/550e8400/qr.png"
  }
}
```

---

*Document prepared by DCM Grading -- January 2026*
