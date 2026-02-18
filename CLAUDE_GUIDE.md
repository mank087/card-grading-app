# DCM Grading Application - Comprehensive Guide

> **Quick Reference for Claude Sessions**
> Last Updated: February 17, 2026 (v8.3 - Market Pricing dashboard, price history improvements, /founders redirect)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Directory Structure](#3-directory-structure)
4. [Pages & Routes](#4-pages--routes)
5. [API Endpoints](#5-api-endpoints)
6. [Library Files](#6-library-files)
7. [Components](#7-components)
8. [Database Schema](#8-database-schema)
9. [Authentication System](#9-authentication-system)
10. [Card Grading Flow](#10-card-grading-flow)
11. [Credit & Payment System](#11-credit--payment-system)
12. [Email Marketing System](#12-email-marketing-system)
13. [External API Integrations](#13-external-api-integrations)
14. [Admin Dashboard](#14-admin-dashboard)
15. [Environment Variables](#15-environment-variables)
16. [Key Data Flows](#16-key-data-flows)
17. [Version History](#version-history)

---

## 1. Project Overview

**DCM Grading** is a full-stack card grading platform that uses AI (GPT-4o vision) to grade trading cards (Pokemon, MTG, Sports, Lorcana, One Piece, Other). Users upload card images, receive AI-powered condition grades, and can download professional labels/reports.

**Core Features:**
- AI-powered card grading with three-pass consensus system
- **v8.3: Market Pricing dashboard (Card Lovers exclusive), price history with DCM/PriceCharting tracking, /founders→/card-lovers redirect**
- **v8.2: Affiliate/Partner Program with referral tracking, commissions, admin dashboard, Stripe promo codes**
- **v8.1: VIP Package ($99/150 credits), Card Lovers subscription, SEO metadata, database optimizations**
- **v8.0: Blog CMS, eBay auction listings (AddItem/Chinese), global scroll-to-top**
- **v7.9: Three-pass reorder (passes-first), SEO & CLS fixes, Google Ads conversion tracking**
- **v7.8: One Piece TCG support with variant-aware eBay search (parallel, manga, alt art, SP)**
- **v7.7: eBay price caching with auto-refresh, collection value tracking, price charts**
- **v7.6: Founders Package with lifetime benefits (150 credits, 20% discount, founder emblem)**
- **v7.3: Unified cap system, execution flowchart, prompt consistency**
- **v7.2: Visual Defect Identification Guide with defect hunting protocol**
- **v7.1: Transparent subgrade-to-overall caps with 1:1 mapping**
- **v7.0: Whole number grades only (1-10, no half-points)**
- Support for multiple card types (Pokemon, MTG, Sports, Lorcana, One Piece, Other)
- Credit-based payment system via Stripe
- User collection management
- Public card search by serial number
- Professional label and report generation
- Admin dashboard with analytics
- Email marketing with 24-hour follow-up
- **v7.1: DCM Optic™ version tracking per card**

**Live URL:** https://www.dcmgrading.com

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| Auth | Supabase Auth (email/password + Google/Facebook OAuth) |
| AI | OpenAI GPT-5.1 (vision) |
| Payments | Stripe Checkout |
| Email | Resend |
| Hosting | Vercel |
| Cron Jobs | Vercel Cron |

---

## 3. Directory Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Homepage
│   ├── layout.tsx                # Root layout (tracking pixels)
│   ├── login/                    # Login/signup page
│   │   └── layout.tsx            # SEO metadata
│   ├── upload/                   # Card upload flow
│   │   └── layout.tsx            # SEO metadata
│   ├── collection/               # User's card collection
│   │   └── layout.tsx            # SEO metadata
│   ├── account/                  # Account settings
│   │   └── layout.tsx            # SEO metadata
│   ├── search/                   # Public card search
│   ├── credits/                  # Credit purchase
│   │   └── layout.tsx            # SEO metadata
│   ├── vip/                      # VIP package (v8.1)
│   │   ├── page.tsx
│   │   └── layout.tsx            # SEO metadata
│   ├── card-lovers/              # Card Lovers subscription (v8.1)
│   │   ├── page.tsx
│   │   ├── success/page.tsx
│   │   └── layout.tsx            # SEO metadata
│   ├── market-pricing/            # Market Pricing dashboard (v8.3, Card Lovers exclusive)
│   │   ├── page.tsx
│   │   └── layout.tsx            # SEO metadata
│   ├── affiliates/               # Affiliate program info page (v8.2)
│   │   └── page.tsx
│   ├── founders/                 # Founders package
│   │   └── layout.tsx            # SEO metadata
│   ├── pokemon/[id]/             # Pokemon card detail
│   ├── mtg/[id]/                 # MTG card detail
│   ├── sports/[id]/              # Sports card detail
│   ├── lorcana/[id]/             # Lorcana card detail
│   ├── onepiece/[id]/            # One Piece card detail
│   ├── other/[id]/               # Other card detail
│   ├── pokemon-database/         # Pokemon database
│   │   └── layout.tsx            # SEO metadata
│   ├── mtg-database/             # MTG database
│   │   └── layout.tsx            # SEO metadata
│   ├── lorcana-database/         # Lorcana database
│   │   └── layout.tsx            # SEO metadata
│   ├── onepiece-database/        # One Piece database
│   │   └── layout.tsx            # SEO metadata
│   ├── pokemon-grading/          # Pokemon landing page
│   │   └── layout.tsx            # SEO metadata
│   ├── sports-grading/           # Sports landing page
│   │   └── layout.tsx            # SEO metadata
│   ├── card-grading/             # General landing page
│   │   └── layout.tsx            # SEO metadata
│   ├── unsubscribe/              # Email unsubscribe
│   ├── admin/                    # Admin dashboard
│   │   └── (dashboard)/
│   │       └── affiliates/       # Affiliate management (v8.2)
│   └── api/                      # API routes
│       ├── market-pricing/       # Market Pricing APIs (v8.3)
│       │   ├── portfolio/route.ts
│       │   └── listings/route.ts
│       ├── affiliate/            # Public affiliate endpoints (v8.2)
│       │   ├── click/route.ts
│       │   └── validate/route.ts
│       └── admin/affiliates/     # Admin affiliate endpoints (v8.2)
│           ├── route.ts
│           ├── [id]/route.ts
│           ├── commissions/route.ts
│           └── approve-commissions/route.ts
│
├── lib/                          # Business logic & utilities
│   ├── directAuth.ts             # Client-side auth
│   ├── serverAuth.ts             # Server-side auth verification
│   ├── supabaseClient.ts         # Client Supabase instance
│   ├── supabaseServer.ts         # Server Supabase instance
│   ├── supabaseAdmin.ts          # Admin Supabase instance
│   ├── visionGrader.ts           # PRIMARY: AI grading with master rubric + deltas (v6.0)
│   ├── visionGrader_v5.ts        # Alternate three-pass implementation
│   ├── promptLoader_v5.ts        # Loads master rubric + card-type deltas
│   ├── professionalGradeMapper.ts # Map to PSA/BGS/SGC/CGC grades
│   ├── labelDataGenerator.ts     # Generate label data
│   ├── emailScheduler.ts         # Email scheduling
│   ├── emailTemplates.ts         # Email HTML templates
│   ├── stripe.ts                 # Stripe configuration
│   ├── credits.ts                # Credit management
│   ├── affiliates.ts             # Affiliate program business logic (v8.2)
│   └── pokemonApiVerification.ts # Pokemon TCG API
│
├── components/                   # React components
│   ├── ClientLayout.tsx          # Root layout with providers (includes ReferralTracker)
│   ├── ReferralTracker.tsx       # Captures ?ref=CODE for affiliate attribution (v8.2)
│   ├── CardSlab.tsx              # Card display component
│   ├── camera/                   # Camera & upload components
│   ├── reports/                  # Report & label components
│   ├── market-pricing/            # Market Pricing components (v8.3)
│   │   ├── MarketPricingGate.tsx  # Card Lovers subscription gate
│   │   ├── CategoryBreakdownChart.tsx # Recharts bar chart by category
│   │   ├── TopCardsTable.tsx      # Top 10 most valuable cards
│   │   ├── MoversTable.tsx        # Price gainers/losers
│   │   └── MyEbayListings.tsx     # eBay listings management
│   ├── admin/                    # Admin components (AdminSidebar includes Affiliates link)
│   └── ui/                       # Shared UI components
│
├── contexts/                     # React contexts
│   ├── CreditsContext.tsx        # Credit balance state
│   └── GradingQueueContext.tsx   # Grading job tracking
│
└── hooks/                        # Custom React hooks
```

---

## 4. Pages & Routes

### Public Pages

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Homepage with featured cards, hero section |
| `/login` | `app/login/page.tsx` | Email/password + OAuth signup/login |
| `/search` | `app/search/page.tsx` | Public search by serial number |
| `/about` | `app/about/page.tsx` | About DCM |
| `/faq` | `app/faq/page.tsx` | FAQ |
| `/grading-rubric` | `app/grading-rubric/page.tsx` | Grading methodology |
| `/contact` | `app/contact/page.tsx` | Contact form |
| `/terms` | `app/terms/page.tsx` | Terms of service |
| `/privacy` | `app/privacy/page.tsx` | Privacy policy |
| `/unsubscribe` | `app/unsubscribe/page.tsx` | Email unsubscribe |
| `/pokemon-database` | `app/pokemon-database/page.tsx` | Pokemon card database search (EN/JA) |
| `/pokemon-grading` | `app/pokemon-grading/page.tsx` | Pokemon-focused landing page |
| `/sports-grading` | `app/sports-grading/page.tsx` | Sports-focused landing page (v7.5) |
| `/card-grading` | `app/card-grading/page.tsx` | General card grading landing page |
| `/get-started` | `app/get-started/page.tsx` | Getting started guide |
| `/grade-your-first-card` | `app/grade-your-first-card/page.tsx` | First card grading walkthrough |
| `/grading-limitations` | `app/grading-limitations/page.tsx` | Known grading limitations |
| `/reports-and-labels` | `app/reports-and-labels/page.tsx` | Reports and labels info |
| `/card-shows` | `app/card-shows/page.tsx` | Card shows directory |
| `/card-shows/[slug]` | `app/card-shows/[slug]/page.tsx` | Individual card show page |
| `/founders` | `app/founders/page.tsx` | Redirects to `/card-lovers` (v8.3, promotion ended) |
| `/vip` | `app/vip/page.tsx` | VIP Package landing page (v8.1) |
| `/card-lovers` | `app/card-lovers/page.tsx` | Card Lovers subscription page (v8.1) |
| `/card-lovers/success` | `app/card-lovers/success/page.tsx` | Card Lovers subscription success page |
| `/affiliates` | `app/affiliates/page.tsx` | Affiliate program info page (v8.2) |
| `/mtg-database` | `app/mtg-database/page.tsx` | MTG card database search |
| `/lorcana-database` | `app/lorcana-database/page.tsx` | Lorcana card database search |
| `/onepiece-database` | `app/onepiece-database/page.tsx` | One Piece card database search |
| `/blog` | `app/blog/page.tsx` | Blog listing page with categories (v8.0) |
| `/blog/[slug]` | `app/blog/[slug]/page.tsx` | Individual blog post page (v8.0) |
| `/blog/category/[category]` | `app/blog/category/[category]/page.tsx` | Blog posts filtered by category (v8.0) |

### Protected Pages (Require Login)

| Route | File | Purpose |
|-------|------|---------|
| `/upload` | `app/upload/page.tsx` | Category selector for upload |
| `/upload/[category]` | `app/upload/[category]/page.tsx` | Upload images for grading |
| `/collection` | `app/collection/page.tsx` | User's graded cards |
| `/account` | `app/account/page.tsx` | Account settings |
| `/credits` | `app/credits/page.tsx` | Purchase credits |
| `/market-pricing` | `app/market-pricing/page.tsx` | Market Pricing dashboard (Card Lovers exclusive, v8.3) |

### Card Detail Pages (Public if card is public)

| Route | File | Purpose |
|-------|------|---------|
| `/pokemon/[id]` | `app/pokemon/[id]/page.tsx` | Pokemon card details |
| `/mtg/[id]` | `app/mtg/[id]/page.tsx` | MTG card details |
| `/sports/[id]` | `app/sports/[id]/page.tsx` | Sports card details |
| `/lorcana/[id]` | `app/lorcana/[id]/page.tsx` | Lorcana card details |
| `/onepiece/[id]` | `app/onepiece/[id]/page.tsx` | One Piece card details |
| `/other/[id]` | `app/other/[id]/page.tsx` | Other card details |

### Admin Pages

| Route | File | Purpose |
|-------|------|---------|
| `/admin/login` | `app/admin/login/page.tsx` | Admin login |
| `/admin/dashboard` | `app/admin/(dashboard)/dashboard/page.tsx` | Admin dashboard |
| `/admin/users` | `app/admin/(dashboard)/users/page.tsx` | User management |
| `/admin/cards` | `app/admin/(dashboard)/cards/page.tsx` | Card management |
| `/admin/analytics` | `app/admin/(dashboard)/analytics/page.tsx` | Analytics |
| `/admin/monitoring` | `app/admin/(dashboard)/monitoring/page.tsx` | API monitoring |
| `/admin/blog` | `app/admin/(dashboard)/blog/page.tsx` | Blog post management (v8.0) |
| `/admin/blog/new` | `app/admin/(dashboard)/blog/new/page.tsx` | Create new blog post (v8.0) |
| `/admin/blog/[id]/edit` | `app/admin/(dashboard)/blog/[id]/edit/page.tsx` | Edit blog post (v8.0) |
| `/admin/affiliates` | `app/admin/(dashboard)/affiliates/page.tsx` | Affiliate management (v8.2) |

---

## 5. API Endpoints

### Authentication

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/verify` | POST | Verify JWT token |
| `/api/admin/auth/login` | POST | Admin login |
| `/api/admin/auth/logout` | POST | Admin logout |
| `/api/admin/auth/verify` | POST | Verify admin session |

### Card Grading

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/grade/[id]` | GET | Get card data + signed URLs |
| `/api/vision-grade/[id]` | POST | **PRIMARY**: AI grading |
| `/api/pokemon/verify` | POST | Pokemon TCG API verification |
| `/api/mtg/verify` | POST | MTG Scryfall verification |

### Card Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cards/my-collection` | GET | User's cards with signed URLs |
| `/api/cards/search` | GET | Public search by serial |
| `/api/cards/featured` | GET | Featured cards for homepage |
| `/api/cards/[id]` | GET/DELETE | Get or delete card |
| `/api/cards/[id]/visibility` | PUT | Toggle public/private |

### Card Type APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/pokemon/[id]` | GET/DELETE | Pokemon card operations |
| `/api/mtg/[id]` | GET/DELETE | MTG card operations |
| `/api/sports/[id]` | GET/DELETE | Sports card operations |
| `/api/lorcana/[id]` | GET/DELETE | Lorcana card operations |
| `/api/onepiece/[id]` | GET/DELETE | One Piece card operations |
| `/api/other/[id]` | GET/DELETE | Other card operations |

### Pokemon Database (v7.4)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/pokemon-database/search` | GET | Search Pokemon cards (EN/JA/All) |
| `/api/pokemon-database/sets` | GET | Get sets list by language |

### Market Pricing (v8.3)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/market-pricing/portfolio` | GET | Portfolio value, category breakdown, top cards, movers (Card Lovers only) |
| `/api/market-pricing/listings` | GET | User's eBay listings with card info (Card Lovers only) |

### eBay Price Caching (v7.7)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ebay/prices` | POST | Live eBay price search with listings |
| `/api/ebay/cached-price` | GET | Get cached prices for a card (auto-refreshes if stale) |
| `/api/ebay/batch-refresh-prices` | POST | Batch refresh prices for multiple cards |
| `/api/ebay/price-history` | GET | Get historical price data for charts |
| `/api/cron/update-card-prices` | GET | Weekly cron job for price history tracking |

### Blog System (v8.0)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/blog/posts` | GET | List published blog posts (with pagination, category filter) |
| `/api/blog/posts/[slug]` | GET | Get single blog post by slug |
| `/api/blog/categories` | GET | List blog categories |
| `/api/admin/blog/posts` | GET/POST | Admin: list all posts / create new post |
| `/api/admin/blog/posts/[id]` | GET/PUT/DELETE | Admin: get/update/delete blog post |
| `/api/admin/blog/categories` | GET/POST | Admin: manage blog categories |
| `/api/admin/blog/upload-image` | POST | Admin: upload blog post images |

### eBay Listing & Connection

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ebay/auth` | GET | Initiate eBay OAuth connection |
| `/api/ebay/callback` | GET | eBay OAuth callback handler |
| `/api/ebay/status` | GET | Check eBay connection status |
| `/api/ebay/disconnect` | POST | Disconnect eBay account |
| `/api/ebay/listing` | POST | Create eBay listing (Fixed Price or Auction) |
| `/api/ebay/listing/check` | GET | Check if card has existing active listing |
| `/api/ebay/images` | POST | Upload images to eBay hosting |
| `/api/ebay/document` | POST | Upload regulatory documents (Certificate of Analysis) |
| `/api/ebay/aspects` | GET | Get eBay category item aspects |
| `/api/ebay/policies` | GET | Get seller's eBay business policies |
| `/api/ebay/opt-in` | POST | eBay seller opt-in |
| `/api/ebay/disclaimer` | GET/POST | eBay listing disclaimer status |

### Payments & Credits

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/stripe/checkout` | POST | Create Stripe checkout session (includes founders tier, passes ref_code for affiliate attribution) |
| `/api/stripe/webhook` | POST | Stripe webhook handler (handles founder/VIP status, affiliate commissions, refund reversals) |
| `/api/stripe/credits` | GET | Get user credit balance |
| `/api/stripe/deduct` | POST | Deduct credit for grading |

### Founders Program (v7.6)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/founders/status` | GET | Check if user is a founder, get badge preference |
| `/api/founders/toggle-badge` | POST | Toggle founder emblem display on card labels |

### VIP & Card Lovers Programs (v8.1)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/stripe/checkout` | POST | Create checkout session (supports `vip` tier) |
| `/api/stripe/subscribe` | POST | Create Card Lovers subscription checkout |
| `/api/subscription/status` | GET | Check Card Lovers subscription status |
| `/api/user/label-emblem-preference` | GET/POST | Get/set emblem preference (founder/card_lover/vip/none/auto) |
| `/api/stripe/cancel-subscription` | POST | Cancel Card Lovers subscription |
| `/api/stripe/upgrade-subscription` | POST | Upgrade from monthly to annual |

### Affiliate Program (v8.2)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/affiliate/validate` | GET | Validate referral code (public, no auth) |
| `/api/affiliate/click` | POST | Record referral click (public, fire-and-forget) |
| `/api/admin/affiliates` | GET/POST | List all affiliates / Create new affiliate (auto-creates Stripe promo code) |
| `/api/admin/affiliates/[id]` | GET/PUT/DELETE | Get details+stats / Update settings / Deactivate affiliate |
| `/api/admin/affiliates/commissions` | GET/POST | List commissions (filterable) / Mark commissions as paid |
| `/api/admin/affiliates/approve-commissions` | POST | Batch approve pending commissions past 14-day hold |

### Email System

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/email/welcome` | POST | Send welcome email |
| `/api/email/test-followup` | POST | Test follow-up email |
| `/api/cron/send-scheduled-emails` | GET | Vercel Cron (hourly) |
| `/api/unsubscribe/[token]` | GET | One-click unsubscribe |
| `/api/unsubscribe/action` | POST | Manual unsubscribe |

### Admin

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/stats/dashboard` | GET | Dashboard statistics |
| `/api/admin/analytics/*` | GET | Various analytics |
| `/api/admin/cards/[id]` | GET/DELETE | Admin card management |
| `/api/admin/users/[id]` | GET/PUT | User management |
| `/api/admin/backfill-labels` | POST | Regenerate all labels |

---

## 6. Library Files

### Authentication

| File | Purpose |
|------|---------|
| `lib/directAuth.ts` | Client-side Supabase auth (email/password + OAuth) |
| `lib/serverAuth.ts` | Server-side JWT verification |
| `lib/admin/adminAuth.ts` | Admin authentication with bcrypt |

### Database

| File | Purpose |
|------|---------|
| `lib/supabaseClient.ts` | Client-side Supabase instance |
| `lib/supabaseServer.ts` | Server-side Supabase (service role) |
| `lib/supabaseAdmin.ts` | Admin operations Supabase |

### Card Grading (Core)

| File | Purpose |
|------|---------|
| `lib/visionGrader.ts` | **PRIMARY**: Master rubric + delta grading (v7.1 three-pass) |
| `lib/promptLoader_v5.ts` | Loads master_grading_rubric_v5.txt + card-type deltas |
| `lib/conversationalParserV3_5.ts` | Parse grading markdown reports |
| `lib/professionalGradeMapper.ts` | Map to PSA/BGS/SGC/CGC grades |
| `lib/conditionAssessment.ts` | Numeric grade to condition label |
| `lib/cardGradingSchema_v5.ts` | Zod validation for grading responses (v7.9: passes-first field ordering) |

### v6.0 Grading System Updates (December 2025)

**Key Changes:**
1. **Whole Number Grades Only**: Final grades are integers 1-10 (no 8.5, 9.5, etc.)
2. **Tier-First Grading**: Identify condition tier BEFORE calculating numeric scores
3. **Dominant Defect Control**: Worst category controls grade, not average
4. **Stricter Scratch Penalties**: Visible scratch = max grade 8; deep scratch = max 6
5. **Mandatory Low Grade Triggers**: Creases = max 4, tears = max 3

**Condition Tiers:**
| Tier | Grade Range | Examples |
|------|-------------|----------|
| A | N/A | Altered, markings, trimmed |
| B | 1-4 | Creases, tears, structural damage |
| C | 5-6 | Deep scratches, heavy damage |
| D | 7 | Visible scratches, fuzzy corners |
| E | 8 | Light scratches, moderate wear |
| F | 9 | Minor defects only |
| G | 10 | Zero defects (very rare) |

**Rubric File:** `prompts/master_grading_rubric_v5.txt` (currently v7.1)

### v7.1 Database Validation & Version Tracking (December 2025)

**Key Updates:**

1. **DCM Optic™ Version Tracking**
   - Each graded card stores the prompt version used at grading time
   - Displayed at bottom of card detail page: "DCM Optic™ Version: V7.1"
   - Version is static per card - won't change when prompt updates
   - Legacy cards show their original version or "Legacy" if none stored
   - **Files changed:** `lib/visionGrader.ts` (lines 1651-1652, 1703-1704)
   - **Frontend helpers:** `extractDCMOpticVersion()`, `getDCMOpticVersion()` in all CardDetailClient.tsx files

2. **Pokemon Card Database Validation** (`api/pokemon/[id]/route.ts`)
   - After AI grading, validates card info against local `pokemon_cards` database
   - Database is source of truth for: `set_name`, `set_total`, `card_number_raw`, `year`
   - Fixes AI "corrections" that change card numbers based on set knowledge
   - Query: `pokemon_cards WHERE name ILIKE '%{name}%' AND number = '{card_number}'`
   - Orders by `set_release_date DESC` (newest sets first)
   - Extracts year from `set_release_date` column
   - **Updates both:** `conversationalGradingData.card_info` AND raw `conversationalGradingResult` JSON

3. **Transparent Subgrade Caps** (Master Rubric v7.1)
   - Direct 1:1 cap mapping from subgrades to overall grade
   - No hidden surface caps - all penalties visible in subgrade scores
   - Subgrade ≤4 caps overall at 4, ≤5 caps at 5, etc.

4. **Version String Updates** (`lib/visionGrader.ts`)
   ```
   meta.version: 'conversational-v7.1-json' or 'conversational-v7.1-markdown'
   meta.prompt_version: 'Conversational_Grading_v7.1_THREE_PASS'
   ```

**How Version Tracking Works:**
```
1. At Grading Time:
   - visionGrader.ts sets prompt_version in meta object
   - Stored in conversational_grading JSON column

2. At Display Time:
   - Frontend reads conversational_grading JSON
   - extractDCMOpticVersion() parses "v7.1" from prompt_version string
   - Displays as "V7.1" in UI

3. For Future Updates:
   - Change prompt_version in visionGrader.ts when rubric updates
   - Old cards keep their original version
   - New cards get new version
```

### v7.6 Founders Package (December 22, 2025)

**Key Features:**

1. **Founders Package** ($99 one-time)
   - 150 grading credits
   - 20% lifetime discount on future purchases
   - Founder badge on collection page
   - Founder emblem on card labels (toggleable)
   - Available until February 1, 2026

2. **Founders Landing Page** (`/founders`)
   - Countdown timer to offer expiration
   - Package details and value comparison table
   - FAQ section
   - Direct Stripe checkout integration

3. **Founder Status APIs**
   - `GET /api/founders/status` - Check founder status and badge preference
   - `POST /api/founders/toggle-badge` - Toggle emblem display on labels

4. **Founder Emblem on Card Labels**
   - Gold star emblem appears on back labels (near QR code)
   - Toggleable via Account Settings page
   - Works on card detail pages and downloadable images
   - `lib/cardImageGenerator.ts` - Draws emblem on generated images

5. **Navigation Updates**
   - Shimmering gold "✨ Founders" link added to desktop and mobile nav
   - CSS shimmer animation in `globals.css`

6. **Credits Page Updates**
   - Fourth pricing card for Founders Package
   - Direct Stripe checkout (not linking to /founders page)
   - Card only shows if user is not already a founder
   - Grid adjusts from 4 to 3 columns for founders

**Files Changed:**
| File | Changes |
|------|---------|
| `app/founders/page.tsx` | New founders landing page with countdown |
| `app/founders/success/page.tsx` | Founders purchase success page |
| `app/api/founders/status/route.ts` | Founder status API |
| `app/api/founders/toggle-badge/route.ts` | Toggle badge API |
| `app/api/stripe/checkout/route.ts` | Added founders tier, founder discount |
| `app/api/stripe/webhook/route.ts` | Handle founder status on purchase |
| `app/credits/page.tsx` | Founders card, direct checkout |
| `app/collection/page.tsx` | Founder badge display |
| `app/account/page.tsx` | Founder emblem toggle setting |
| `app/ui/Navigation.tsx` | Shimmering Founders link |
| `app/globals.css` | Shimmer animation keyframes |
| `app/*/[id]/CardDetailClient.tsx` | Founder emblem on back labels (all 5 card types) |
| `lib/cardImageGenerator.ts` | Draw founder emblem on downloadable images |
| `lib/credits.ts` | `isFounder()`, `getFounderDiscountMultiplier()` helpers |
| `lib/stripe.ts` | Added founders price tier |
| `components/reports/DownloadReportButton.tsx` | Pass showFounderEmblem prop |
| `migrations/add_founder_fields.sql` | Database migration for founder fields |

**Database Migration:**
```sql
-- Add founder fields to user_credits table
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS is_founder BOOLEAN DEFAULT false;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS founder_since TIMESTAMPTZ;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS show_founder_badge BOOLEAN DEFAULT true;
```

### v8.3 Market Pricing Dashboard & Price History Improvements (February 17, 2026)

**Key Features:**

1. **Market Pricing Dashboard** (`/market-pricing`) — Card Lovers Exclusive
   - Portfolio value summary with total value, cards with pricing, refresh button
   - 3 tabs: Overview, My eBay Listings, Market Insights
   - **Overview tab:** Category breakdown bar chart (Recharts), Top 10 most valuable cards, Price Movers (gainers/losers)
   - **My eBay Listings tab:** eBay connection status, listing table with status badges, direct eBay links
   - **Market Insights tab:** Trending cards, category performance comparison, Price Alerts (coming soon placeholder)
   - Gated by `MarketPricingGate` component (checks Card Lovers subscription, shows upsell for non-subscribers)
   - Navigation link added (emerald `$` icon) in desktop and mobile menus
   - Added to sitemap

2. **Price History Improvements**
   - **DCM/PriceCharting tracking:** Added `dcm_price_estimate` column to `card_price_history` table for more accurate trend analysis
   - **Expanded card types:** CHECK constraint updated from `(sports, pokemon, other)` to `(sports, pokemon, mtg, lorcana, other)` — MTG and Lorcana cards no longer silently fail
   - **Removed 200-card limit:** Cron now processes up to 10,000 cards per run with a 4.5-minute time budget (graceful stop before Vercel 5-min timeout)
   - **Initial snapshot on grading:** `fetchAndCacheCardPrice()` now also writes to `card_price_history` so new cards have data immediately
   - **Portfolio movers use DCM prices:** Falls back to eBay median for older snapshots without DCM data
   - **Chunked queries:** Portfolio API chunks `.in()` queries to avoid PostgREST URL length limits

3. **Founders Page Redirect**
   - `/founders` now server-side redirects to `/card-lovers` (promotion ended)
   - Sitemap updated

**Files Created:**
| File | Purpose |
|------|---------|
| `src/app/market-pricing/page.tsx` | Main market pricing dashboard with 3 tabs |
| `src/app/market-pricing/layout.tsx` | SEO metadata |
| `src/app/api/market-pricing/portfolio/route.ts` | Portfolio aggregation API (auth + Card Lovers gated) |
| `src/app/api/market-pricing/listings/route.ts` | eBay listings API (auth + Card Lovers gated) |
| `src/components/market-pricing/MarketPricingGate.tsx` | Subscription gate with upsell |
| `src/components/market-pricing/CategoryBreakdownChart.tsx` | Horizontal bar chart (Recharts) with per-category colors |
| `src/components/market-pricing/TopCardsTable.tsx` | Top 10 cards with thumbnails, grades, values |
| `src/components/market-pricing/MoversTable.tsx` | Gainers/losers with % change indicators |
| `src/components/market-pricing/MyEbayListings.tsx` | eBay listings table with status badges |
| `supabase/migrations/20260217_expand_card_price_history_types.sql` | Expand card_type CHECK, add dcm_price_estimate column |

**Files Modified:**
| File | Changes |
|------|---------|
| `src/app/ui/Navigation.tsx` | Added "$ Market Pricing" link (emerald) in desktop + mobile nav |
| `src/app/sitemap.ts` | Added `/market-pricing`, changed `/founders` to `/card-lovers` |
| `src/app/founders/page.tsx` | Replaced with server-side redirect to `/card-lovers` |
| `src/lib/ebay/priceTracker.ts` | DCM tracking in snapshots, time budget, MTG/Lorcana types, initial snapshot on grading |
| `src/app/api/cron/update-card-prices/route.ts` | Limit 10,000, all 5 card types, 4.5 min time budget |

**Database Migration:**
```sql
-- Expand card_type to include MTG and Lorcana
ALTER TABLE card_price_history DROP CONSTRAINT card_price_history_card_type_check;
ALTER TABLE card_price_history ADD CONSTRAINT card_price_history_card_type_check
  CHECK (card_type IN ('sports', 'pokemon', 'mtg', 'lorcana', 'other'));

-- Add PriceCharting estimate column for trend analysis
ALTER TABLE card_price_history ADD COLUMN IF NOT EXISTS dcm_price_estimate DECIMAL(10, 2);
```

**Category Colors (CategoryBreakdownChart):**
| Category | Color | Hex |
|----------|-------|-----|
| Pokemon | Red | `#EF4444` |
| Football | Blue | `#3B82F6` |
| Baseball | Green | `#10B981` |
| Basketball | Orange | `#F97316` |
| Hockey | Cyan | `#06B6D4` |
| Soccer | Emerald | `#22C55E` |
| Wrestling | Purple | `#A855F7` |
| MTG | Violet | `#8B5CF6` |
| Lorcana | Indigo | `#6366F1` |
| One Piece | Rose | `#E11D48` |
| Other | Gray | `#6B7280` |

**Portfolio API Value Priority:** `dcm_price_estimate` > `ebay_price_median` > `scryfall_price_usd` > 0

**Price History Data Flow:**
```
1. Card Graded → vision-grade route → fetchAndCacheCardPrice()
   └── Saves eBay cache to cards table
   └── NEW: Also saves initial snapshot to card_price_history (with DCM estimate)

2. Weekly Cron (Sunday 3 AM UTC) → /api/cron/update-card-prices
   └── Processes ALL graded cards (up to 10,000, time budget 4.5 min)
   └── Fetches eBay prices + reads current DCM estimate from cards table
   └── Saves snapshot to card_price_history

3. Market Pricing page → /api/market-pricing/portfolio
   └── Reads card_price_history (chunked queries)
   └── Compares latest 2 snapshots per card for movers
   └── Prefers dcm_price_estimate, falls back to eBay median_price
```

### v8.2 Affiliate/Partner Program (February 11, 2026)

**Key Features:**

1. **Full Affiliate Program**
   - Affiliates earn cash commissions (default 20%) on sales they drive
   - Buyers get 10% off first purchase via affiliate's Stripe promo code
   - Dual attribution: referral links (`?ref=CODE`) and Stripe promo codes
   - 14-day hold period before commissions are payable
   - Automatic reversal on refund (`charge.refunded` webhook)

2. **Referral Attribution Flow**
   - `ReferralTracker` component in `ClientLayout.tsx` captures `?ref=CODE` on any page
   - Validates code, stores in localStorage with 30-day expiry
   - Records click (hashed IP, user agent, landing page)
   - Credits, VIP, and Card Lovers pages pass `ref_code` to checkout/subscribe APIs
   - Webhook creates commission from session metadata OR Stripe promotion code mapping

3. **Admin Dashboard** (`/admin/affiliates`)
   - Table of all affiliates with stats (referrals, earned, paid, pending)
   - Click row for detail view with commission history
   - Add Affiliate modal (auto-creates Stripe coupon + promotion code)
   - Pause/Activate toggle, Approve Pending batch action
   - Payout workflow: select approved commissions, enter reference, mark as paid

4. **Fraud Prevention**
   - Self-referral blocking (affiliate.user_id === referred_user_id)
   - Duplicate attribution (first purchase only per user per affiliate)
   - IP hashing (SHA-256, never raw IPs)
   - 14-day hold period (refund buffer)
   - Automatic reversal on refund
   - 30-day attribution window expiry

5. **Public Affiliate Page** (`/affiliates`)
   - Info page explaining the program
   - "Apply to Partner" email CTA

**Files Created:**
| File | Purpose |
|------|---------|
| `src/lib/affiliates.ts` | Core business logic (lookups, clicks, commissions, stats, payouts) |
| `src/components/ReferralTracker.tsx` | Captures `?ref=CODE` on page load, stores in localStorage |
| `src/app/api/affiliate/click/route.ts` | Record clicks (public, no auth) |
| `src/app/api/affiliate/validate/route.ts` | Validate referral codes (public, no auth) |
| `src/app/api/admin/affiliates/route.ts` | List/create affiliates (admin) |
| `src/app/api/admin/affiliates/[id]/route.ts` | Get/update/deactivate affiliate (admin) |
| `src/app/api/admin/affiliates/commissions/route.ts` | List/pay commissions (admin) |
| `src/app/api/admin/affiliates/approve-commissions/route.ts` | Batch approve (admin) |
| `src/app/admin/(dashboard)/affiliates/page.tsx` | Admin dashboard UI |
| `src/app/affiliates/page.tsx` | Public info page |
| `supabase/migrations/20260211_add_affiliate_program.sql` | Database schema (3 tables) |

**Files Modified:**
| File | Changes |
|------|---------|
| `src/components/ClientLayout.tsx` | Added `<ReferralTracker />` |
| `src/components/admin/AdminSidebar.tsx` | Added "Affiliates" nav item |
| `src/app/api/stripe/checkout/route.ts` | Reads `ref_code`, validates affiliate, passes to Stripe metadata |
| `src/app/api/stripe/subscribe/route.ts` | Same: reads `ref_code`, passes to session + subscription metadata |
| `src/app/api/stripe/webhook/route.ts` | Commission creation on checkout, reversal on `charge.refunded` |
| `src/app/credits/page.tsx` | Passes `ref_code` from localStorage to checkout |
| `src/app/vip/page.tsx` | Passes `ref_code` from localStorage to checkout |
| `src/app/card-lovers/page.tsx` | Passes `ref_code` from localStorage to subscribe |

**Database Migration:**
```sql
-- 3 new tables: affiliates, affiliate_commissions, affiliate_clicks
-- See supabase/migrations/20260211_add_affiliate_program.sql
-- Indexes on: code, user_id, status, affiliate_id, stripe_session_id, hold status
-- RLS enabled on all tables (service role bypasses)
```

**Affiliate Attribution Data Flow:**
```
1. Visitor clicks dcmgrading.com/?ref=DOUG
   └── ReferralTracker validates + stores in localStorage + records click

2. Visitor purchases (credits/VIP/Card Lovers)
   └── Frontend reads localStorage dcm_ref_code
   └── Passes ref_code in checkout/subscribe request body
   └── API validates affiliate, adds ref_code to Stripe session metadata

3. Stripe webhook fires (checkout.session.completed)
   └── Reads ref_code from metadata OR promotion_code from session
   └── Maps to affiliate → createCommission() (pending, 14-day hold)
   └── Updates affiliate totals

4. After 14 days → admin approves → admin marks paid with payout reference

5. On refund (charge.refunded) → commission auto-reversed
```

### v8.1 VIP Package, Card Lovers Subscription, SEO & Database Optimizations (February 5, 2026)

**Key Changes:**

1. **VIP Package** ($99 one-time, purchasable multiple times)
   - 150 grading credits
   - VIP diamond emblem (◆) on card labels
   - Best cost per grade for one-time purchases ($0.66/grade)
   - Landing page: `/vip`

2. **Card Lovers Subscription**
   - Monthly plan: $49.99/month (70 credits)
   - Annual plan: $449/year (900 credits upfront, includes 60 bonus)
   - 20% discount on additional credit purchases
   - Card Lover heart emblem (♥) on labels
   - Loyalty bonuses: +5 at month 3, +10 at month 6, +15 at month 9, +20 at month 12
   - Credits roll over indefinitely
   - Landing page: `/card-lovers`

3. **Unified Emblem System**
   - Users can choose which emblem to display: Founder (★), Card Lover (♥), VIP (◆), or auto
   - Account settings page allows emblem preference selection
   - Labels show up to 2 emblems (order: Founder → Card Lover → VIP)

4. **SEO Metadata Improvements**
   - Added `layout.tsx` files with metadata for all main pages
   - Pages: credits, vip, card-lovers, founders, collection, account, login, upload
   - Grading pages: pokemon-grading, sports-grading, card-grading
   - Database pages: pokemon-database, mtg-database, lorcana-database, onepiece-database

5. **Database Performance Optimizations**
   - Fixed RLS policies for `subscription_events` (auth_rls_initplan warning)
   - Added composite indexes for query optimization:
     - `idx_cards_user_id_created_at` - User collection queries
     - `idx_cards_visibility_created_at` - Public card queries
     - `idx_cards_featured_lookup` - Featured cards partial index
     - `idx_cards_serial` - Serial lookup
     - `idx_cards_category_created_at` - Category filtered lists

6. **Conversion Tracking**
   - Added Google Ads conversion tracking to Card Lovers success page
   - All success pages now have: Meta, GA4, Google Ads, Reddit tracking

7. **UI Label Improvements**
   - Front/back labels now have consistent fixed heights
   - Dynamic font sizing for long card names
   - Text wraps instead of truncating (matches downloadable labels)

**Files Changed:**
| File | Changes |
|------|---------|
| `app/vip/page.tsx` | New VIP package landing page |
| `app/vip/layout.tsx` | VIP page SEO metadata |
| `app/card-lovers/page.tsx` | Updated Card Lovers subscription page |
| `app/card-lovers/success/page.tsx` | Added Google Ads tracking |
| `app/card-lovers/layout.tsx` | Card Lovers page SEO metadata |
| `app/api/stripe/checkout/route.ts` | VIP tier, founder discount logic |
| `app/api/stripe/webhook/route.ts` | VIP purchase handling |
| `app/api/user/label-emblem-preference/route.ts` | Unified emblem preference API |
| `app/ui/Navigation.tsx` | VIP and Card Lovers nav links |
| `app/account/page.tsx` | Emblem preference selector |
| `lib/credits.ts` | VIP status functions, hasFounderDiscount() |
| `lib/stripe.ts` | VIP price configuration |
| `components/labels/ModernFrontLabel.tsx` | Fixed heights, dynamic font sizing |
| `components/labels/ModernBackLabel.tsx` | VIP emblem rendering |
| `lib/cardImageGenerator.ts` | VIP emblem in downloadable images |
| Multiple `layout.tsx` files | SEO metadata for all main pages |

**Database Migrations:**
```sql
-- Card Lovers fields (already exists)
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS is_card_lover BOOLEAN DEFAULT FALSE;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS card_lover_plan TEXT;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS show_card_lover_badge BOOLEAN DEFAULT TRUE;

-- VIP fields
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS show_vip_badge BOOLEAN DEFAULT TRUE;

-- Unified emblem preference
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS preferred_label_emblem TEXT DEFAULT 'auto';

-- Performance indexes
CREATE INDEX idx_cards_user_id_created_at ON cards (user_id, created_at DESC);
CREATE INDEX idx_cards_visibility_created_at ON cards (visibility, created_at DESC);
CREATE INDEX idx_cards_featured_lookup ON cards (visibility, is_featured, created_at DESC)
  WHERE conversational_decimal_grade IS NOT NULL;
```

### v8.0 Blog CMS, eBay Auction Listings, Scroll-to-Top (February 2, 2026)

**Key Changes:**

1. **Blog System with Admin CMS**
   - Full blog with public listing, individual post, and category pages
   - Admin CMS for creating/editing/deleting posts with rich text editor
   - Image upload support for blog post content
   - SEO-optimized blog pages with meta tags and structured data
   - Blog link added to all navigation contexts (desktop, mobile, logged in/out)
   - Routes: `/blog`, `/blog/[slug]`, `/blog/category/[category]`
   - Admin routes: `/admin/blog`, `/admin/blog/new`, `/admin/blog/[id]/edit`

2. **eBay Auction Listing Support**
   - Previously, selecting "Auction" in the UI still posted as Buy It Now
   - Root cause: `listingFormat` was never sent in the API request body, API route hardcoded `'FIXED_PRICE'`, Trading API only had `addFixedPriceItem()`
   - Fix: Three files changed:
     - `EbayListingModal.tsx`: Added `listingFormat` to fetch body
     - `route.ts`: Added `listingFormat` to request interface, conditionally calls `addAuctionItem()` or `addFixedPriceItem()`, stores dynamic `listing_format` in DB
     - `tradingApi.ts`: Added `buildAddItemXml()` and `addAuctionItem()` export
   - Auctions use eBay Trading API `AddItem` call with `<ListingType>Chinese</ListingType>`
   - Auctions force `Quantity=1` (eBay requirement)
   - Best Offer not supported on auctions (UI already handles this)
   - Added `DAYS_1` to `mapListingDuration()` for 1-day auctions
   - Valid auction durations: Days_1, Days_3, Days_5, Days_7, Days_10

3. **Global Scroll-to-Top on Navigation**
   - Added `ScrollToTop` component to `ClientLayout.tsx`
   - Uses `usePathname()` from `next/navigation` to detect route changes
   - Calls `window.scrollTo(0, 0)` on every pathname change
   - Fixes issue where navigating to card detail pages (or other pages) loaded the user mid-scroll

4. **Page Tour Restart Button**
   - Added restart button to all card detail pages for the onboarding tour
   - Users can re-trigger the guided tour from any card detail page

5. **eBay Valuation Fixes**
   - Fixed eBay valuation for vintage sports cards
   - Fixed eBay search for letter-based card numbers (e.g., ttp-hgn)

**Files Changed:**
| File | Changes |
|------|---------|
| `src/components/ebay/EbayListingModal.tsx` | Added `listingFormat` to fetch body |
| `src/app/api/ebay/listing/route.ts` | Auction support: `listingFormat` field, conditional API call, dynamic DB record |
| `src/lib/ebay/tradingApi.ts` | Added `buildAddItemXml()`, `addAuctionItem()` export, `listingFormat` to `ListingDetails` |
| `src/components/ClientLayout.tsx` | Added `ScrollToTop` component with `usePathname()` |
| `src/app/blog/page.tsx` | Blog listing page |
| `src/app/blog/[slug]/page.tsx` | Blog post page |
| `src/app/blog/category/[category]/page.tsx` | Blog category page |
| `src/app/admin/(dashboard)/blog/page.tsx` | Admin blog management |
| `src/app/admin/(dashboard)/blog/new/page.tsx` | Admin new blog post |
| `src/app/admin/(dashboard)/blog/[id]/edit/page.tsx` | Admin edit blog post |
| `src/app/api/blog/posts/route.ts` | Public blog posts API |
| `src/app/api/blog/posts/[slug]/route.ts` | Single blog post API |
| `src/app/api/blog/categories/route.ts` | Blog categories API |
| `src/app/api/admin/blog/posts/route.ts` | Admin blog posts CRUD API |
| `src/app/api/admin/blog/posts/[id]/route.ts` | Admin single post API |
| `src/app/api/admin/blog/categories/route.ts` | Admin categories API |
| `src/app/api/admin/blog/upload-image/route.ts` | Blog image upload API |
| `src/app/ui/Navigation.tsx` | Added Blog link to all nav contexts |

**eBay Auction vs Fixed Price - Key Differences:**
| | Fixed Price (Buy It Now) | Auction |
|---|---|---|
| Trading API Call | `AddFixedPriceItem` | `AddItem` |
| XML ListingType | `FixedPriceItem` | `Chinese` |
| Quantity | Any (default 1) | Must be 1 |
| Price field | Buy It Now price | Starting bid |
| Best Offer | Supported | Not supported |
| Default duration | GTC | 7 days |
| Valid durations | GTC, 3/5/7/10/30 days | 1/3/5/7/10 days |

### v7.9 Three-Pass Reorder, SEO & CLS Fixes, Conversion Tracking (January 27, 2026)

**Key Changes:**

1. **Three-Pass Grading Reorder (Passes-First)**
   - Moved `grading_passes` field in `cardGradingSchema_v5.ts` to generate BEFORE detailed narrative sections
   - Previously, grading passes were the last field in the schema, causing the AI to write detailed narratives first and then backfill "independent" passes that were just copies
   - New order: `grading_passes` → `centering` → `defects` → `raw_sub_scores` → `weighted_scores` → `final_grade`
   - Updated `prompts/master_grading_rubric_v5.txt` and `prompts/master_grading_rubric_v5_optimized.txt` with passes-first instructions
   - Updated `src/lib/visionGrader_v5.ts` user message to reinforce generation order
   - No downstream changes needed — all consumers access `grading_passes` by field name, not position

2. **SEO & Sitemap Fixes**
   - Added `sitemap.ts` with dynamic card and card show pages
   - Added `robots.txt` with crawl rules (block `/api/`, `/admin/`, auth pages)
   - Added missing public pages to sitemap: `/card-grading`, `/get-started`, `/grade-your-first-card`, `/grading-limitations`, `/reports-and-labels`, `/card-shows`
   - Added card database pages to sitemap: `/pokemon-database`, `/mtg-database`, `/lorcana-database`, `/onepiece-database`

3. **CLS (Cumulative Layout Shift) Fixes**
   - **Homepage hero buttons**: Added `authChecked` state with skeleton placeholder during auth fetch, preventing content swap
   - **Featured cards section**: Added `featuredCardsLoading` state with skeleton grid (5 placeholder cards) during async fetch
   - **Navigation**: Updated desktop skeleton widths to match logged-out link count (4 items) and auth button dimensions
   - Files: `src/app/page.tsx`, `src/app/ui/Navigation.tsx`

4. **Google Ads Conversion Value Fix**
   - `ads_conversion_PURCHASE_1` event was missing `value` and `currency` parameters
   - Google Ads defaulted all conversions to $1 regardless of actual purchase amount
   - Fixed in both `/credits/success/page.tsx` (dynamic value from Stripe session) and `/founders/success/page.tsx` (hardcoded $99)
   - Added `currency: 'USD'` to all conversion events

5. **Version String Fix**
   - Updated all 6 card-type API routes to use `V7.1` version string instead of legacy `V6.0`
   - Affected: `sports/[id]`, `pokemon/[id]`, `mtg/[id]`, `lorcana/[id]`, `onepiece/[id]`, `other/[id]`

6. **Founders Deadline Extension**
   - Extended from January 1, 2026 to February 1, 2026 in checkout route

7. **Avery Label Improvements**
   - Fixed Avery 6871 left margin to match official template
   - Removed purple border from 8167 front and back labels
   - Added Avery 8167 toploader label support with multi-page printing

**Files Changed:**
| File | Changes |
|------|---------|
| `src/lib/cardGradingSchema_v5.ts` | Moved `grading_passes` field before narrative sections |
| `prompts/master_grading_rubric_v5.txt` | Passes-first instructions, updated flowchart and JSON examples |
| `prompts/master_grading_rubric_v5_optimized.txt` | Passes-first instructions, updated JSON example |
| `src/lib/visionGrader_v5.ts` | Updated user message with generation order instructions |
| `src/app/page.tsx` | CLS fixes: auth skeleton, featured cards skeleton |
| `src/app/ui/Navigation.tsx` | CLS fix: updated skeleton widths |
| `src/app/credits/success/page.tsx` | Google Ads conversion value + currency |
| `src/app/founders/success/page.tsx` | Google Ads conversion value ($99) + currency |
| `src/app/api/sports/[id]/route.ts` | Version string V7.1 |
| `src/app/api/pokemon/[id]/route.ts` | Version string V7.1 |
| `src/app/api/mtg/[id]/route.ts` | Version string V7.1 |
| `src/app/api/lorcana/[id]/route.ts` | Version string V7.1 |
| `src/app/api/onepiece/[id]/route.ts` | Version string V7.1 |
| `src/app/api/other/[id]/route.ts` | Version string V7.1 |
| `src/app/sitemap.ts` | Dynamic sitemap with public cards and card shows |
| `public/robots.txt` | Crawl rules for search engines |
| `src/app/api/stripe/checkout/route.ts` | Founders deadline extended to Feb 1, 2026 |

### v7.8 One Piece TCG Support (January 23, 2026)

**Key Features:**

1. **Full One Piece Card Grading Support**
   - One Piece grading API route (`/api/onepiece/[id]`)
   - One Piece card detail page (`/onepiece/[id]`)
   - Upload pages for One Piece cards (`/upload/onepiece`, `/onepiece/upload`)
   - Added to "Grade a Card" navigation dropdown
   - Background grading polling support (`useBackgroundGrading.ts`)
   - Grading prompt: `prompts/onepiece_delta_v5.txt`

2. **One Piece-Specific eBay Integration**
   - Variant-aware search: parallel, manga, alternate_art, sp, sec, promo
   - `buildOnePieceCardQueries()` in `lib/ebay/browseApi.ts`
   - `getOnePieceVariantSearchTerm()` maps variants to eBay search terms:
     - `parallel`, `parallel_manga` → "parallel"
     - `alternate_art`, `alt_art` → "alt art"
     - `manga` → "manga art"
     - `sp`, `special_parallel` → "SP"
     - `sec`, `secret` → "secret rare"
   - Progressive fallback query strategies (specific → moderate → broad)
   - eBay category: `261330` (One Piece Card Game)

3. **One Piece eBay Search URL Generation**
   - `generateOnePieceEbaySearchUrl()` in `lib/ebayUtils.ts`
   - Uses card name, card number, set name
   - Proper category filtering for One Piece TCG

4. **Label Data Generation**
   - `getOnePieceName()`, `getOnePieceSetInfo()`, `getOnePieceFeatures()` in `labelDataGenerator.ts`
   - Handles variant display (Parallel, Manga, Alt Art, SP, SEC)

5. **Onboarding Tour Update**
   - Added "Live Market Pricing" step to onboarding tour
   - Description: "Live pricing from active online listings help provide a sense for card value. Historical pricing is updated weekly to provide a sense of on-going card fluctuations."
   - Added `id="tour-live-market-pricing"` to all card detail pages (Sports, Pokemon, MTG, Lorcana, One Piece, Other)

**Files Created:**

| File | Purpose |
|------|---------|
| `app/api/onepiece/[id]/route.ts` | One Piece grading API (GET/DELETE) |
| `app/onepiece/[id]/page.tsx` | One Piece card detail server component |
| `app/onepiece/[id]/CardDetailClient.tsx` | One Piece card detail client component |
| `app/onepiece/[id]/ImageZoomModal.tsx` | Image zoom modal for One Piece |
| `app/onepiece/upload/page.tsx` | One Piece upload redirect |
| `app/upload/onepiece/page.tsx` | One Piece upload page |
| `prompts/onepiece_delta_v5.txt` | One Piece grading prompt delta |
| `migrations/add_onepiece_card_reference_columns.sql` | Database migration |

**Files Modified:**

| File | Changes |
|------|---------|
| `app/ui/Navigation.tsx` | Added One Piece to Grade a Card dropdown |
| `app/ui/Footer.tsx` | Added One Piece card grading link |
| `app/upload/page.tsx` | Added One Piece category option |
| `hooks/useBackgroundGrading.ts` | Added 'One Piece' to CARD_TYPES_CONFIG |
| `lib/promptLoader_v5.ts` | Added 'onepiece' card type |
| `lib/cardGradingSchema_v5.ts` | Added 'onepiece' to card type enum |
| `lib/labelDataGenerator.ts` | Added One Piece label data functions |
| `lib/ebay/browseApi.ts` | Added One Piece search functions with variant handling |
| `lib/ebay/constants.ts` | Added 'One Piece' to DCM_TO_EBAY_CATEGORY |
| `lib/ebayUtils.ts` | Added `generateOnePieceEbaySearchUrl()` |
| `components/ebay/EbayPriceLookup.tsx` | Added 'onepiece' game_type, variant_type prop |
| `components/ebay/EbayListingButton.tsx` | Added 'onepiece' cardType |
| `components/ebay/EbayListingModal.tsx` | Added 'onepiece' cardType |
| `app/api/ebay/prices/route.ts` | Added One Piece handler with variant support |
| `components/onboarding/OnboardingTour.tsx` | Added Live Market Pricing tour step |
| `app/*/[id]/CardDetailClient.tsx` | Added tour-live-market-pricing ID (all 6 card types) |

**One Piece Variant Types:**
- `parallel` - Foil/holo versions (most common variant)
- `parallel_manga` - Manga art with parallel treatment
- `manga` - Manga art style (non-foil)
- `alternate_art` / `alt_art` - Different artwork from standard
- `sp` / `special_parallel` - Premium special parallel
- `sec` / `secret` - Secret rare variants
- `promo` - Promotional cards
- `don` / `leader` - DON!! cards and Leader cards

**Database Migration:**
```sql
-- Add One Piece reference columns to cards table
ALTER TABLE cards ADD COLUMN IF NOT EXISTS onepiece_card_id TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS op_variant_type TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS onepiece_reference_image TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS onepiece_database_match_confidence VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_cards_onepiece_card_id ON cards(onepiece_card_id) WHERE onepiece_card_id IS NOT NULL;
```

### v7.7 eBay Price Caching System (January 20, 2026)

**Key Features:**

1. **Automatic Price Caching**
   - Prices are cached when a card is first graded (fire-and-forget in vision-grade route)
   - Cached prices refresh automatically after 7 days
   - Collection page triggers background refresh for stale cards on load

2. **Collection Page Price Display**
   - **Desktop List View**: "Value" column showing median price + listing count
   - **Mobile List View**: Price badge next to grade
   - **Grid View**: Price badge in top-right corner (opposite visibility badge)
   - **Collection Total**: Summary badge showing total estimated value
   - **Sort by Value**: New sorting option in all views

3. **Card Detail Page (EbayPriceLookup Component)**
   - Shows cached prices on initial load (fast)
   - "Refresh" button fetches live data with actual listings
   - Price distribution histogram chart
   - Price history line chart (collapsible)
   - Clickable listing links to eBay

4. **Background Batch Refresh**
   - Collection page automatically refreshes stale prices in background
   - Rate limited: 10 cards per batch, 500ms between eBay API calls
   - Visual indicator: "Updating X prices..." with spinner
   - Updates UI in real-time as prices come back

**Files Created/Modified:**

| File | Purpose |
|------|---------|
| `api/ebay/cached-price/route.ts` | Get/refresh cached prices for a card |
| `api/ebay/batch-refresh-prices/route.ts` | Batch refresh multiple cards |
| `lib/ebay/priceTracker.ts` | Price caching utilities and batch job logic |
| `lib/ebay/browseApi.ts` | eBay Browse API with fallback search strategies |
| `components/ebay/EbayPriceLookup.tsx` | Card detail page price component |
| `components/ebay/charts/PriceDistributionChart.tsx` | Histogram chart |
| `components/ebay/charts/PriceHistoryChart.tsx` | Trend line chart |
| `app/collection/page.tsx` | Added price display, sorting, batch refresh |
| `api/cards/my-collection/route.ts` | Added eBay price fields to query |
| `api/vision-grade/[id]/route.ts` | Added price caching after grading |

**Price Caching Flow:**

```
1. Card Graded → vision-grade API fires fetchAndCacheCardPrice() (async, non-blocking)
   └── Searches eBay → Caches lowest/median/average/highest to cards table

2. Collection Page Loads → Fetches cards with cached prices
   └── 2 seconds later → Background refresh starts for stale cards (>7 days)
   └── Batch refresh API processes 10 cards at a time
   └── UI updates in real-time as prices return

3. Card Detail Page → EbayPriceLookup component
   └── Initial: Uses cached prices (fast load)
   └── Refresh button: Fetches live eBay data with listings, charts, links
   └── Also updates cache in background
```

**Field Mapping (conversational_card_info → eBay Search):**

The `fetchAndCacheCardPrice()` function maps fields from the database to eBay search:
```typescript
// Database field → eBay search field
player_or_character → featured
set_name → card_set
year → release_date
card_number_raw/card_number → card_number
serial_number → serial_numbering
rookie_or_first → rookie_card
```

**Fallback Data Sources (batch-refresh-prices API):**

1. `conversational_card_info` (direct field from DB)
2. `conversational_grading` JSON → `card_info` (parsed)
3. Legacy direct fields: `featured`, `card_name`, `card_set`, etc.

**Database Migration:**
```sql
-- Add eBay price cache columns to cards table
ALTER TABLE cards ADD COLUMN IF NOT EXISTS ebay_price_lowest DECIMAL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS ebay_price_median DECIMAL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS ebay_price_average DECIMAL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS ebay_price_highest DECIMAL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS ebay_price_listing_count INTEGER;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS ebay_price_updated_at TIMESTAMPTZ;

-- Price history table for tracking trends
CREATE TABLE IF NOT EXISTS card_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES cards(id),
  card_type TEXT,
  lowest_price DECIMAL,
  median_price DECIMAL,
  highest_price DECIMAL,
  average_price DECIMAL,
  listing_count INTEGER,
  query_used TEXT,
  query_strategy TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### v7.5 Upload Wizard, Reddit Pixel, Landing Pages (December 19, 2025)

**Key Updates:**

1. **3-Step Upload Wizard Flow**
   - All uploads now go through a confirmation wizard before submission
   - **Step 1: Confirm Category** - Verify card type is correct
   - **Step 2: Review Photos** - Preview front/back with retake option
   - **Step 3: Condition Report** - Optional defect hints, must acknowledge "No defects" OR report defects
   - Works for both camera and gallery modes on mobile
   - Desktop also uses wizard via "Review & Submit" button
   - Component: `components/WizardProgressIndicator.tsx`
   - File changed: `app/upload/page.tsx`

2. **Reddit Pixel Conversion Tracking**
   - Pixel ID: `a2_i6zsi175k40r`
   - Base pixel in `app/layout.tsx` tracks PageVisit on all pages
   - Events tracked with unique conversion IDs for deduplication:
     - **Lead**: Landing page CTA clicks (`lead_{page}_{timestamp}_{location}`)
     - **SignUp**: Account creation (`signup_{timestamp}_{email_prefix}`)
     - **Purchase**: Credit purchase (`{stripe_session_id}`)
   - Files changed: `layout.tsx`, `login/page.tsx`, `credits/success/page.tsx`, `pokemon-grading/page.tsx`, `sports-grading/page.tsx`

3. **Sports Card Landing Page** (`/sports-grading`)
   - New landing page targeting sports card collectors
   - Green/emerald color theme
   - Floating card animations with real sports card images
   - Supported leagues: NFL, NBA, MLB, NHL, UFC, WWE, Soccer
   - Card brands: Panini, Topps, Upper Deck, Bowman, Donruss, Fleer
   - 3-column layout: Card image (left), features (center), grading report (right)
   - Eye-catching "Launch Special" banner with pulsing glow and sparkle animations

4. **Pokemon Landing Page Updates** (`/pokemon-grading`)
   - Updated to 3-column layout matching sports page
   - Eye-catching "Launch Special" banner added
   - Removed duplicate footer

5. **Grading Rubric v7.4 Whole Number Scoring**
   - Updated uncertainty ranges to whole numbers:
     - A = ±0 (was ±0.25)
     - B = ±1 (was ±0.5)
     - C = ±2 (was ±1.0)
     - D = ±3 (was ±1.5)
   - Added "New Photos Recommended" badge for C and D grades
   - Grade scale now shows whole numbers only (10, 9, 8, 7, 6, 5-1)
   - File: `app/grading-rubric/page.tsx`

6. **Multi-Select Bulk Delete on Collection Page**
   - Checkbox column in list view for selecting multiple cards
   - "Select All" / "Deselect All" functionality
   - Bulk delete with confirmation dialog
   - File: `app/collection/page.tsx`

7. **Terms & Conditions Updates**
   - Section 5.3: Third-Party Trademarks (expanded with manufacturer list)
   - Section 5.4: DCM Grading Outputs and Ownership (grades, analyses, certificates)
   - Section 5.5: Marketing and Promotional Materials (public cards may be used)
   - File: `app/terms/page.tsx`

**Files Changed:**
| File | Changes |
|------|---------|
| `app/layout.tsx` | Reddit Pixel base code |
| `app/upload/page.tsx` | 3-step wizard flow, gallery mode wizard fix |
| `components/WizardProgressIndicator.tsx` | New wizard stepper component |
| `app/login/page.tsx` | Reddit SignUp tracking |
| `app/credits/success/page.tsx` | Reddit Purchase tracking |
| `app/sports-grading/page.tsx` | New sports landing page |
| `app/pokemon-grading/page.tsx` | 3-column layout, Launch Special, Lead tracking |
| `app/grading-rubric/page.tsx` | Whole number scoring, updated uncertainty |
| `app/collection/page.tsx` | Multi-select bulk delete |
| `app/terms/page.tsx` | IP and ownership sections |
| `public/Sports/` | Sports card images |
| `public/Pokemon/` | Pokemon card images for landing page |

### v7.2 Unified Label System & Promo Support (December 2025)

**Key Updates:**

1. **Unified Card Label System**
   - Labels now show consistent data across all pages (collection, search, detail, homepage)
   - `lib/useLabelData.ts` - Always generates fresh label data via `getCardLabelData()`
   - `lib/labelDataGenerator.ts` - Central label data generation with card-type-specific handling
   - `components/CardLabel.tsx` - Unified label display component

2. **Sports Card Category Fix** (`lib/labelDataGenerator.ts`)
   - Sports cards have specific categories: 'Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling'
   - Fixed switch statements that only checked `case 'Sports':`
   - Added `isSportsCard` check to handle all sport category types:
   ```typescript
   const isSportsCard = ['Sports', 'Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling'].includes(category);
   if (isSportsCard) {
     rawPrimaryName = getSportsName(cardInfo, card);
   }
   ```

3. **API JSON Parsing for Labels**
   - Collection, search, and featured APIs now parse `conversational_grading` JSON when direct columns are NULL
   - Extracts: `card_info`, `decimal_grade`, `condition_label` from nested JSON
   - Files modified:
     - `src/app/api/cards/my-collection/route.ts` - Added JSON parsing for label data
     - `src/app/api/cards/search/route.ts` - Added JSON parsing for label data
     - `src/app/api/cards/featured/route.ts` - Added JSON parsing for label data
   - Pattern used in all APIs:
   ```typescript
   if (!card.conversational_card_info && card.conversational_grading) {
     try {
       const parsed = typeof card.conversational_grading === 'string'
         ? JSON.parse(card.conversational_grading) : card.conversational_grading;
       if (parsed.card_info) {
         enrichedCard.conversational_card_info = parsed.card_info;
         // Extract featured, card_name, card_set, card_number, release_date
       }
       // Extract grade from grading_passes or final_grade
       // Remove large JSON from response after parsing
     } catch (e) { /* continue with original */ }
   }
   ```

4. **SM/XY Promo Card Support** (`lib/pokemonTcgApi.ts`)
   - Added Sun & Moon promo format: `sm_promo` (e.g., SM228, SM226)
   - Added XY promo format: `xy_promo` (e.g., XY01, XY124)
   - Detection in `detectCardNumberFormat()`:
   ```typescript
   if (/^SM\d+$/i.test(raw)) return 'sm_promo';
   if (/^XY\d+$/i.test(raw)) return 'xy_promo';
   ```
   - Set IDs in `getPromoSetId()`:
   ```typescript
   case 'sm_promo': return 'smp';  // Sun & Moon Promos
   case 'xy_promo': return 'xyp';  // XY Promos
   ```
   - Promo cards correctly route to promo set lookup instead of standard sets

5. **TCGPlayer URL from Database** (`src/app/pokemon/[id]/CardDetailClient.tsx`)
   - Pokemon card detail page now uses `tcgplayer_url` from database when available
   - Falls back to generated search URL if not in database
   ```typescript
   const tcgplayerUrl = card.tcgplayer_url || generateTCGPlayerSetSearchUrl(cardData) || generateTCGPlayerSearchUrl(cardData);
   ```

**Files Changed:**
| File | Changes |
|------|---------|
| `lib/useLabelData.ts` | Always generates fresh label data from card fields |
| `lib/labelDataGenerator.ts` | Fixed sports card category handling in switch statements |
| `lib/pokemonTcgApi.ts` | Added SM/XY promo format detection and set IDs |
| `api/cards/my-collection/route.ts` | Added conversational_grading JSON parsing |
| `api/cards/search/route.ts` | Added conversational_grading JSON parsing |
| `api/cards/featured/route.ts` | Added conversational_grading JSON parsing |
| `pokemon/[id]/CardDetailClient.tsx` | Use tcgplayer_url from database |

**Troubleshooting Labels:**
- If sports cards show "N/A" labels: Check that API is returning `conversational_grading` and parsing it
- If Pokemon promos fail lookup: Check card number format matches expected promo pattern
- If TCGPlayer link wrong: Verify `tcgplayer_url` column populated for card in database

### v6.2 Card Number OCR & Verification Fixes (December 2025)

**Problem Solved:** AI was using Pokemon set knowledge to "correct" card numbers instead of reading them from the image (e.g., card shows 179/132 but AI outputs 113/111).

**Changes:**

1. **Card Number OCR Breakdown Field** (`card_number_ocr_breakdown`)
   - Forces AI to spell out each digit position-by-position
   - Must be filled BEFORE setting `card_number` or `card_number_raw`
   - Example: `"Position 1: 1, Position 2: 7, Position 3: 9, Position 4: /, Position 5: 1, Position 6: 3, Position 7: 2"`

2. **Strengthened Prompts** (`prompts/pokemon_delta_v5.txt`)
   - Added **FORBIDDEN BEHAVIOR** section
   - Explicit: "DO NOT use knowledge of Pokemon sets to correct numbers"
   - Explicit: "If card shows 125/094, report 125/094 even if you know the set has more cards"
   - **Mega Evolution X/Y handling**: Explicit instructions to include X or Y designation

3. **Pokemon Identify Endpoint** (`api/pokemon/identify/route.ts`)
   - Lightweight AI call for card name + number identification
   - Strict OCR instructions: "Read EXACTLY as printed"
   - Critical warnings against "correcting" card numbers

4. **Verification Validation** (`lib/pokemonApiVerification.ts`)
   - **Year validation**: Rejects matches >3 years different (prevents 2014 card matching to 2025)
   - **Name validation**: Rejects completely mismatched card names
   - **Confidence-based corrections**: Only high/medium confidence matches can override card info
   - **Card number protection**: Only HIGH confidence matches can change `card_number`

5. **Force Regrade Improvements** (`api/pokemon/[id]/route.ts`)
   - Now clears ALL cached `pokemon_api_*` fields
   - Clears `card_number`, `card_set`, `release_date`, `label_data`
   - Ensures completely fresh grading without cached verification data

6. **Condition Label Uniformity** (`lib/labelDataGenerator.ts`)
   - Always uses deterministic `getConditionFromGrade()` mapping
   - Same grade always produces same condition label (no AI variation)

7. **Label Display Fixes** (`lib/labelDataGenerator.ts`)
   - Pokemon cards show full card number (232/182 not just 232)
   - Promo formats (SM226, SWSH039) display without "#" prefix
   - Uses `card_number_raw` for accurate display

### External APIs

| File | Purpose |
|------|---------|
| `lib/pokemonTcgApi.ts` | **Pokemon TCG API client (v6.1: local DB first, API fallback)** |
| `lib/pokemonApiVerification.ts` | Pokemon TCG API verification |
| `lib/mtgApiVerification.ts` | MTG Scryfall integration |
| `lib/scryfallApi.ts` | Scryfall API client |

#### Pokemon Local Database (v6.1)

The `pokemonTcgApi.ts` file now searches the local Supabase database first:
- `searchLocalDatabase()` - General name/set/number search
- `searchLocalByNameNumberTotal()` - Optimized for printedTotal matching
- `searchLocalByNameNumberSetId()` - For promo cards by set ID
- Falls back to external Pokemon TCG API if not found locally

### Payments

| File | Purpose |
|------|---------|
| `lib/stripe.ts` | Stripe client & price tiers |
| `lib/credits.ts` | Credit balance management |
| `lib/affiliates.ts` | Affiliate program: lookups, click tracking, commission CRUD, stats, payouts (v8.2) |

### Email

| File | Purpose |
|------|---------|
| `lib/emailScheduler.ts` | Schedule & manage pending emails |
| `lib/emailTemplates.ts` | HTML email templates |

### Labels & Reports

| File | Purpose |
|------|---------|
| `lib/labelDataGenerator.ts` | **Core**: Generate standardized label data for all card types |
| `lib/useLabelData.ts` | **Helper**: Always generates fresh label data via `getCardLabelData()` |
| `components/CardLabel.tsx` | Unified label display component |
| `lib/averyLabelGenerator.ts` | Generate Avery label PDFs |
| `lib/foldableLabelGenerator.ts` | Generate foldable labels |
| `lib/miniReportJpgGenerator.ts` | Generate mini report images |

#### Label Data Flow (v7.2)

```
1. API fetches card from database
2. If conversational_card_info is NULL, parse conversational_grading JSON
3. Return enriched card data with extracted fields
4. Frontend calls getCardLabelData(card) from useLabelData.ts
5. generateLabelData() routes to category-specific handler:
   - Pokemon: getPokemonName(), getPokemonSetInfo(), getPokemonFeatures()
   - Sports: getSportsName(), getSportsSetInfo(), getSportsFeatures()
   - MTG: getMTGName(), getMTGSetInfo(), getMTGFeatures()
   - etc.
6. Returns LabelData: { primaryName, setInfo, cardNumber, grade, condition, features }
7. CardLabel.tsx renders the label
```

**Label Data Structure:**
```typescript
interface LabelData {
  primaryName: string;      // Card name or player name
  setInfo: string;          // Set name and year
  cardNumber: string;       // Card number with proper formatting
  grade: number;            // Decimal grade (e.g., 9.2)
  wholeGrade: number;       // Integer grade (e.g., 9)
  condition: string;        // Condition label (e.g., "Mint")
  features: string[];       // Special features (RC, Auto, etc.)
}
```

### eBay Integration (v7.7 pricing, v8.0 auction listings)

| File | Purpose |
|------|---------|
| `lib/ebay/browseApi.ts` | eBay Browse API client with fallback search strategies |
| `lib/ebay/tradingApi.ts` | eBay Trading API: `addFixedPriceItem()`, `addAuctionItem()`, `getItemStatus()` |
| `lib/ebay/auth.ts` | eBay OAuth connection management and token refresh |
| `lib/ebay/constants.ts` | eBay category IDs, condition IDs, grader IDs |
| `lib/ebay/types.ts` | TypeScript types for `EbayListing` (supports `listing_format: 'FIXED_PRICE' | 'AUCTION'`) |
| `lib/ebay/priceTracker.ts` | Price caching and batch job logic |
| `components/ebay/EbayListingModal.tsx` | Full eBay listing creation modal (images, details, shipping, returns) |
| `components/ebay/EbayListingButton.tsx` | "List on eBay" button on card detail pages |
| `components/ebay/EbayPriceLookup.tsx` | Card detail page price display component |
| `components/ebay/charts/PriceDistributionChart.tsx` | Histogram showing listing price distribution |
| `components/ebay/charts/PriceHistoryChart.tsx` | Line chart showing price trends over time |

### Utilities

| File | Purpose |
|------|---------|
| `lib/imageCompression.ts` | Compress images for upload |
| `lib/serialGenerator.ts` | Generate DCM serial numbers |
| `lib/ebayUtils.ts` | Generate eBay search URLs |
| `lib/tcgplayerUtils.ts` | Generate TCGPlayer URLs |

---

## 7. Components

### Core Components

| Component | Purpose |
|-----------|---------|
| `components/ClientLayout.tsx` | Root layout with providers, ScrollToTop, session refresh |
| `components/CardSlab.tsx` | Card slab display (front/back + grade) |
| `components/CardLabel.tsx` | Card label display |
| `components/PersistentStatusBar.tsx` | Status notifications |
| `components/UserConditionReport.tsx` | User-submitted condition report |

### Camera & Upload

| Component | Purpose |
|-----------|---------|
| `components/camera/MobileCamera.tsx` | Mobile camera capture |
| `components/camera/CameraGuideOverlay.tsx` | Card positioning guides |
| `components/camera/ImagePreview.tsx` | Preview captured images |
| `components/camera/UploadMethodSelector.tsx` | Camera vs file upload |

### Reports

| Component | Purpose |
|-----------|---------|
| `components/reports/CardGradingReport.tsx` | Full grading report |
| `components/reports/DownloadReportButton.tsx` | Download buttons |
| `components/reports/ThreePassSummary.tsx` | Three-pass grading summary |

### UI

| Component | Purpose |
|-----------|---------|
| `components/ui/Navigation.tsx` | Top navigation bar |
| `components/ui/Footer.tsx` | Site footer |
| `components/ui/GradeBadge.tsx` | Grade display badge |

### Contexts

| Context | Purpose |
|---------|---------|
| `contexts/CreditsContext.tsx` | User credit balance state |
| `contexts/GradingQueueContext.tsx` | Active grading job tracking |

---

## 8. Database Schema

### Core Tables

```sql
-- Users table (for admin panel - synced from auth.users via trigger)
users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- User profiles (extends auth.users)
profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  display_name TEXT,
  marketing_emails_enabled BOOLEAN DEFAULT true,
  marketing_unsubscribed_at TIMESTAMP,
  unsubscribe_token UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Main cards table
cards (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  serial VARCHAR UNIQUE,                    -- DCM serial number
  category VARCHAR,                         -- Pokemon, MTG, Sports, Lorcana, Other

  -- Image paths
  front_path TEXT,
  back_path TEXT,

  -- AI Grading Results
  conversational_decimal_grade DECIMAL,     -- e.g., 9.2
  conversational_whole_grade INT,           -- e.g., 9
  conversational_condition_label VARCHAR,   -- e.g., "Mint"
  conversational_image_confidence VARCHAR,  -- A, B, C, D
  conversational_card_info JSONB,           -- AI-extracted card data
  conversational_grading TEXT,              -- Full grading report JSON

  -- Card Info
  card_name VARCHAR,
  card_set VARCHAR,
  card_number VARCHAR,
  featured VARCHAR,                         -- Player/character name

  -- Label Data
  label_data JSONB,                         -- Pre-generated label info

  -- Settings
  visibility VARCHAR DEFAULT 'private',     -- public/private
  is_featured BOOLEAN DEFAULT false,

  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Credit transactions
user_credits (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  balance INT DEFAULT 0,
  first_purchase_bonus_used BOOLEAN DEFAULT false
)

credit_transactions (
  id UUID PRIMARY KEY,
  user_id UUID,
  amount INT,
  type VARCHAR,                             -- purchase, deduction, bonus
  description TEXT,
  created_at TIMESTAMP
)

-- Email system
email_schedule (
  id UUID PRIMARY KEY,
  user_id UUID,
  user_email TEXT,
  email_type VARCHAR,                       -- follow_up_24h
  scheduled_for TIMESTAMP,
  status VARCHAR,                           -- pending, sent, failed, skipped
  sent_at TIMESTAMP,
  error_message TEXT,
  resend_email_id TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

email_log (
  id UUID PRIMARY KEY,
  user_id UUID,
  user_email TEXT,
  email_type VARCHAR,
  subject TEXT,
  resend_email_id TEXT,
  status VARCHAR,                           -- sent, failed, bounced, complained
  error_message TEXT,
  sent_at TIMESTAMP
)

-- Admin
admin_users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE,
  password_hash VARCHAR,
  role VARCHAR
)

admin_sessions (
  id UUID PRIMARY KEY,
  admin_id UUID,
  token VARCHAR,
  expires_at TIMESTAMP
)

-- Pokemon Local Database (v6.1)
pokemon_sets (
  id TEXT PRIMARY KEY,                    -- API set ID: "base1", "sv1"
  name TEXT NOT NULL,                     -- "Base", "Scarlet & Violet"
  series TEXT,                            -- "Base", "Scarlet & Violet"
  printed_total INTEGER,                  -- Number on cards (e.g., 102)
  total INTEGER,                          -- Actual total including secrets
  release_date DATE,                      -- Set release date
  symbol_url TEXT,                        -- Set symbol image URL
  logo_url TEXT,                          -- Set logo image URL
  ptcgo_code TEXT,                        -- Pokemon TCG Online code
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

pokemon_cards (
  id TEXT PRIMARY KEY,                    -- API card ID: "base1-4", "sv1-185"
  name TEXT NOT NULL,                     -- "Charizard", "Professor's Research"
  number TEXT NOT NULL,                   -- "4", "185", "TG10"
  set_id TEXT REFERENCES pokemon_sets(id),
  supertype TEXT,                         -- "Pokémon", "Trainer", "Energy"
  subtypes TEXT[],                        -- ["Stage 2"], ["Supporter"]
  types TEXT[],                           -- ["Fire"], ["Water", "Psychic"]
  hp TEXT,                                -- "120", "340"
  evolves_from TEXT,                      -- "Charmeleon"
  evolves_to TEXT[],
  rarity TEXT,                            -- "Rare Holo", "Illustration Rare"
  artist TEXT,
  flavor_text TEXT,
  image_small TEXT,                       -- Low-res image URL
  image_large TEXT,                       -- High-res image URL
  tcgplayer_url TEXT,
  cardmarket_url TEXT,
  -- Denormalized set data for fast queries
  set_name TEXT,
  set_series TEXT,
  set_printed_total INTEGER,
  set_release_date DATE,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

pokemon_import_log (
  id SERIAL PRIMARY KEY,
  import_type TEXT NOT NULL,              -- "full", "incremental"
  sets_imported INTEGER DEFAULT 0,
  cards_imported INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',          -- "running", "completed", "failed"
  error_message TEXT,
  created_at TIMESTAMPTZ
)

-- eBay Price Caching (v7.7 - added to cards table)
-- These columns store cached eBay prices on the cards table
cards.ebay_price_lowest DECIMAL,          -- Lowest listing price
cards.ebay_price_median DECIMAL,          -- Median listing price (primary display)
cards.ebay_price_average DECIMAL,         -- Average listing price
cards.ebay_price_highest DECIMAL,         -- Highest listing price
cards.ebay_price_listing_count INTEGER,   -- Number of active listings
cards.ebay_price_updated_at TIMESTAMPTZ   -- When prices were last cached

-- eBay Price History (v7.7 - for tracking trends)
card_price_history (
  id UUID PRIMARY KEY,
  card_id UUID REFERENCES cards(id),
  card_type TEXT,                         -- 'sports', 'pokemon', 'other'
  lowest_price DECIMAL,
  median_price DECIMAL,
  highest_price DECIMAL,
  average_price DECIMAL,
  listing_count INTEGER,
  query_used TEXT,                        -- Search query that was used
  query_strategy TEXT,                    -- 'specific', 'moderate', 'broad', 'minimal'
  recorded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

-- Japanese Pokemon Database (v7.4 - TCGdex)
pokemon_sets_ja (
  id TEXT PRIMARY KEY,                    -- TCGdex set ID: "sv1", "base1"
  name TEXT NOT NULL,                     -- Japanese set name
  logo TEXT,                              -- Set logo URL
  symbol TEXT,                            -- Set symbol URL
  series_id TEXT,                         -- Series identifier
  series_name TEXT,                       -- Series name in Japanese
  tcg_online TEXT,                        -- PTCGO code
  release_date DATE,
  legal_standard BOOLEAN,
  legal_expanded BOOLEAN,
  card_count_total INTEGER,
  card_count_official INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

pokemon_cards_ja (
  id TEXT PRIMARY KEY,                    -- TCGdex card ID: "sv1-1", "base1-4"
  local_id TEXT,                          -- Card number within set
  name TEXT NOT NULL,                     -- Japanese card name
  image_url TEXT,                         -- High-res image URL from TCGdex
  set_id TEXT REFERENCES pokemon_sets_ja(id),
  set_name TEXT,                          -- Denormalized set name
  category TEXT,                          -- "Pokemon", "Trainer", "Energy"
  illustrator TEXT,
  rarity TEXT,
  hp INTEGER,
  types TEXT[],                           -- ["Fire"], ["Water", "Psychic"]
  evolve_from TEXT,                       -- Evolution source
  description TEXT,                       -- Flavor text
  stage TEXT,                             -- "Basic", "Stage 1", "Stage 2"
  suffix TEXT,                            -- "EX", "V", "VMAX", etc.
  regulation_mark TEXT,                   -- "G", "H", etc.
  legal_standard BOOLEAN,
  legal_expanded BOOLEAN,
  release_date DATE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Affiliate Program (v8.2)
affiliates (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),    -- linked DCM account (nullable)
  name TEXT NOT NULL,                          -- display name
  email TEXT NOT NULL,                         -- contact/payout email
  code TEXT NOT NULL UNIQUE,                   -- referral code (e.g., "DOUG")
  stripe_promotion_code_id TEXT,               -- Stripe promo code ID (10% discount)
  stripe_coupon_id TEXT,                       -- Stripe coupon ID
  commission_rate DECIMAL DEFAULT 0.20,        -- 20% default
  commission_type TEXT DEFAULT 'percentage',    -- 'percentage' or 'flat'
  flat_commission_amount DECIMAL,
  status TEXT DEFAULT 'active',                -- 'active', 'paused', 'deactivated'
  payout_method TEXT DEFAULT 'manual',
  payout_details TEXT,                         -- PayPal email, Venmo handle, etc.
  minimum_payout DECIMAL DEFAULT 20.00,
  attribution_window_days INTEGER DEFAULT 30,
  total_referrals INTEGER DEFAULT 0,
  total_commission_earned DECIMAL DEFAULT 0,
  total_commission_paid DECIMAL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

affiliate_commissions (
  id UUID PRIMARY KEY,
  affiliate_id UUID REFERENCES affiliates(id),
  referred_user_id UUID REFERENCES auth.users(id),
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  order_amount DECIMAL NOT NULL,
  net_amount DECIMAL NOT NULL,
  commission_rate DECIMAL NOT NULL,
  commission_amount DECIMAL NOT NULL,
  status TEXT DEFAULT 'pending',               -- 'pending' → 'approved' → 'paid' | 'reversed'
  hold_until TIMESTAMPTZ,                      -- 14-day hold before payable
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payout_reference TEXT,                       -- PayPal transaction ID, etc.
  reversal_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

affiliate_clicks (
  id UUID PRIMARY KEY,
  affiliate_id UUID REFERENCES affiliates(id),
  ip_hash TEXT,                                -- SHA-256 hashed IP (not raw)
  user_agent TEXT,
  landing_page TEXT,
  created_at TIMESTAMPTZ
)
```

### Storage Buckets

```
cards/
  └── {userId}/
      └── {cardId}/
          ├── front.jpg
          └── back.jpg
```

---

## 9. Authentication System

### User Authentication Flow

```
1. Signup/Login (src/lib/directAuth.ts)
   ├── Email/Password → Supabase /auth/v1/signup or /auth/v1/token
   └── OAuth (Google/Facebook) → Supabase OAuth flow

2. Database Triggers (on auth.users INSERT)
   ├── handle_new_user() → Inserts into users, profiles, schedules 24h follow-up
   └── initialize_user_credits() → Creates user_credits record with 0 balance

3. Store Tokens
   └── localStorage['supabase.auth.token'] = { access_token, refresh_token }

4. API Requests
   └── Authorization: Bearer {access_token}

5. Server Verification (src/lib/serverAuth.ts)
   └── supabase.auth.getUser(token) → { userId, email }
```

### New User Detection (auth callback)

```
OAuth users: created_at within 60 seconds
Email/Password users: email_confirmed_at within 60 seconds
→ Both trigger welcome email and redirect to /credits?welcome=true
```

### Admin Authentication Flow

```
1. Login → /api/admin/auth/login
   └── bcrypt.compare(password, hash)

2. Create Session
   └── Store in admin_sessions with 1-hour expiry

3. Verify → /api/admin/auth/verify
   └── Check token + expiry + IP
```

---

## 10. Card Grading Flow

### Upload Phase

```
1. User selects category (Pokemon, MTG, Sports, etc.)
2. Upload front & back images
   └── Compress with imageCompression.ts
   └── Upload to Supabase storage
3. Deduct 1 credit
4. Create card record (status: pending)
```

### Grading Phase

```
1. GET card paths from database
2. Create signed URLs for images (1 hour expiry)
3. LOAD PROMPT (promptLoader_v5.ts):
   ├── master_grading_rubric_v5.txt (universal rules, v7.1, ~50k tokens)
   └── {card_type}_delta_v5.txt (card-specific rules)
4. THREE-PASS CONSENSUS GRADING (visionGrader.ts):
   ├── Pass 1 → GPT-5.1 evaluates independently
   ├── Pass 2 → GPT-5.1 (fresh evaluation, same prompt)
   └── Pass 3 → GPT-5.1 (fresh evaluation)
   └── Average scores, apply dominant defect control
   └── Final grade = whole number (v7.0: floor rounding)
   └── Version stored: "Conversational_Grading_v7.1_THREE_PASS"
5. Parse response, extract grading_passes
6. DATABASE VALIDATION (v7.1 - Pokemon only):
   └── Query local pokemon_cards by name + number
   └── Override AI's set_name, set_total, year with DB values
   └── Update both card_info object AND raw JSON string
7. Generate label_data
8. Update card record with grades
```

### Grading Rules (v7.1)

- **Whole numbers only** (v7.0): Final grades are 1-10 integers (no 8.5, 9.5)
- **Transparent subgrade caps** (v7.1): Direct 1:1 cap mapping, no hidden penalties
- **Tier-first** (v6.0): Identify condition tier before calculating scores
- **Dominant defect control**: Worst category caps the grade
- **Three-pass consensus**: 2+/3 passes must agree on defects
- **Floor rounding**: Always round down (8.7 → 8)
- **Version tracking** (v7.1): Each card stores prompt version used at grading time

### Post-Grading Verification

```
Pokemon cards → pokemonApiVerification.ts → Pokemon TCG API
MTG cards → mtgApiVerification.ts → Scryfall API
```

### Japanese Card Detection (v7.4)

The grading system now automatically detects Japanese cards and validates against the Japanese database:

```typescript
// Japanese text detection (api/pokemon/[id]/route.ts)
const hasJapaneseText = (text: string | null | undefined): boolean => {
  if (!text) return false;
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
};

// Detection checks multiple fields
const isJapaneseCard = hasJapaneseText(cardInfo?.card_name) ||
                       hasJapaneseText(cardInfo?.player_or_character) ||
                       hasJapaneseText(cardInfo?.set_name) ||
                       cardInfo?.language === 'ja' ||
                       cardInfo?.language === 'japanese';
```

**Japanese Card Grading Flow:**
1. AI grades card normally (all languages supported)
2. After grading, system detects if card has Japanese text
3. If Japanese, query `pokemon_cards_ja` by name and number
4. Enrich card_info with: `set_name`, `set_id`, `set_total`, `year`, `language`, `tcgdex_id`, `tcgdex_image_url`, `name_english`, `rarity_or_variant`, `illustrator`
5. Skip English Pokemon TCG API lookup for Japanese cards
6. Update both `card_info` object and raw JSON in database

---

## 11. Credit & Payment System

### Credit Tiers (One-Time Purchases)

| Tier | Price | Credits | Per Grade | First Purchase Bonus |
|------|-------|---------|-----------|---------------------|
| Basic | $2.99 | 1 | $2.99 | +1 |
| Pro | $9.99 | 5 | $2.00 | +3 |
| Elite | $19.99 | 20 | $1.00 | +5 |
| **VIP** | $99 | 150 | $0.66 | N/A (purchasable multiple times) |
| **Founders** | $99 | 150 | $0.66 | N/A (one-time, legacy) |

### Card Lovers Subscription (v8.1)

| Plan | Price | Credits | Per Grade | Notes |
|------|-------|---------|-----------|-------|
| Monthly | $49.99/mo | 70/mo | $0.71 | +loyalty bonuses at 3,6,9,12 months |
| Annual | $449/yr | 900 upfront | $0.50 | Includes 60 bonus credits |

**Subscription Benefits:**
- 20% discount on additional credit purchases
- Card Lover heart emblem (♥) on labels
- Credits roll over indefinitely (never expire)
- Loyalty bonuses (monthly only): +5 at 3mo, +10 at 6mo, +15 at 9mo, +20 at 12mo

### VIP Package (v8.1)

- **150 credits** at $0.66/grade (best one-time value)
- **VIP diamond emblem (◆)** on labels
- **Purchasable multiple times** (unlike Founders)
- Landing page: `/vip`

### Founders Program (v7.6 - Legacy)

Limited-time package (no longer sold, existing founders keep benefits):
- **150 grading credits** ($0.66 per grade)
- **20% lifetime discount** on future credit purchases
- **Founder star emblem (★)** on labels

### Unified Emblem System (v8.1)

Users can have multiple statuses and choose which emblem to display:
- **preferred_label_emblem**: `'auto'` | `'founder'` | `'card_lover'` | `'vip'` | `'none'`
- Auto mode displays based on priority: Founder → Card Lover → VIP
- Up to 2 emblems can show on card labels

**Database Fields (user_credits table):**
```sql
-- Founder fields
is_founder BOOLEAN DEFAULT false
founder_since TIMESTAMPTZ
show_founder_badge BOOLEAN DEFAULT true

-- Card Lovers fields
is_card_lover BOOLEAN DEFAULT false
card_lover_plan TEXT  -- 'monthly' or 'annual'
card_lover_months_active INTEGER DEFAULT 0
show_card_lover_badge BOOLEAN DEFAULT true

-- VIP fields
is_vip BOOLEAN DEFAULT false
show_vip_badge BOOLEAN DEFAULT true

-- Unified preference
preferred_label_emblem TEXT DEFAULT 'auto'
```

### Discount Logic

- **Card Lovers (active)**: 20% off credit purchases
- **Founders**: 20% off credit purchases
- **Note**: Discounts do NOT stack. Card Lover takes precedence if user has both.
- Implemented in `lib/credits.ts`: `hasFounderDiscount()`, `isActiveCardLover()`

### Payment Flow

```
1. User clicks "Buy Credits"
2. Frontend reads dcm_ref_code from localStorage (if affiliate referral)
3. POST /api/stripe/checkout (with ref_code) → Create Stripe session
4. Redirect to Stripe checkout (allow_promotion_codes: true)
5. Payment complete → Stripe webhook
6. POST /api/stripe/webhook → addCredits()
7. Update user_credits.balance
8. If affiliate attribution found → createCommission() (pending, 14-day hold)
```

### Affiliate Program (v8.2)

- Affiliates earn **20% commission** (configurable) on referred sales
- Buyers get **10% off** first purchase via affiliate Stripe promo code
- **Dual attribution**: referral links (`?ref=CODE`) + Stripe promo codes
- Commission lifecycle: `pending` (14-day hold) → `approved` → `paid`
- Auto-reversal on refund (`charge.refunded` webhook)
- Self-referral and duplicate attribution blocked
- Admin dashboard at `/admin/affiliates` for management and payouts
- Core logic in `lib/affiliates.ts`, tracking in `components/ReferralTracker.tsx`
- See `docs/Affiliate-Program-Setup.md` for full setup & testing guide

### Credit Deduction

```
1. User uploads card
2. POST /api/stripe/deduct
3. Check balance >= 1
4. Deduct 1 credit
5. Log transaction
```

---

## 12. Email Marketing System

### Database Tables

```sql
profiles.marketing_emails_enabled  -- User preference
profiles.unsubscribe_token         -- For unsubscribe links

email_schedule (
  user_id, user_email, email_type,
  scheduled_for, status, sent_at
)
```

### Email Types

| Type | Trigger | Delay |
|------|---------|-------|
| Welcome | OAuth: immediate / Email: after confirmation | Immediate |
| Follow-up 24h | Account creation (DB trigger) | 24 hours |

### Cron Job (Hourly)

```
/api/cron/send-scheduled-emails
1. Query pending emails where scheduled_for <= now
2. Check user.marketing_emails_enabled
3. Get unsubscribe token
4. Send via Resend
5. Mark sent/failed/skipped
```

### Key Files

```
lib/emailScheduler.ts    - Schedule & manage emails
lib/emailTemplates.ts    - HTML templates
api/cron/send-scheduled-emails/route.ts - Vercel Cron
api/unsubscribe/[token]/route.ts - One-click unsubscribe
app/unsubscribe/page.tsx - Unsubscribe page
vercel.json              - Cron configuration
```

---

## 13. External API Integrations

### OpenAI (GPT-5.1)

```
Purpose: AI card grading with vision
Model: gpt-5.1 (released November 2025)
Usage: Three-pass consensus grading with master rubric + deltas
File: lib/visionGrader.ts → promptLoader_v5.ts
```

### Pokemon TCG API (with Local Database)

```
Base URL: https://api.pokemontcg.io/v2
Purpose: Verify Pokemon card info
Files:
  - lib/pokemonTcgApi.ts        # Main API client (local DB first, API fallback)
  - lib/pokemonApiVerification.ts

LOCAL DATABASE (v6.1):
  The system now queries a local Supabase database first, eliminating
  API timeouts and rate limits. Falls back to external API for new releases.

  Tables:
  - pokemon_sets (170 sets)
  - pokemon_cards (~17,500+ cards)
  - pokemon_import_log (import tracking)

  Import Script: scripts/import-pokemon-database.js
  Migration: migrations/add_pokemon_cards_database.sql

  Usage:
    node scripts/import-pokemon-database.js --full        # Full import
    node scripts/import-pokemon-database.js --incremental # Last 90 days only

PROMO CARD SUPPORT (v7.2):
  Supported promo formats and their set IDs:
  - SWSH promos: SWSH039, SWSH123 → set ID: swshp
  - SV promos: SVP EN 085, SVP 021 → set ID: svp
  - SM promos: SM228, SM001 → set ID: smp
  - XY promos: XY124, XY01 → set ID: xyp

  Detection flow (pokemonTcgApi.ts):
  1. detectCardNumberFormat() identifies promo format
  2. getPromoSetId() returns correct set ID
  3. lookupSetByCardNumber() queries with set constraint
```

### Scryfall API (MTG Database)

```
Base URL: https://api.scryfall.com
Purpose: Verify MTG card info and populate local database
Files:
  - lib/mtgApiVerification.ts     # MTG API verification
  - lib/mtgCardMatcher.ts         # Database lookup + fuzzy matching
  - scripts/import-mtg-database.js # Import script from Scryfall

MTG LOCAL DATABASE:
  Tables:
  - mtg_sets (~700+ sets)
  - mtg_cards (~80,000+ unique cards including all printings)

  Import Script: scripts/import-mtg-database.js
  Migration: migrations/add_mtg_cards_database.sql

  Usage:
    node scripts/import-mtg-database.js --full      # Full import
    node scripts/import-mtg-database.js --sets-only # Only sets
    node scripts/import-mtg-database.js --set MKM   # Single set

DATABASE PAGE: /mtg-database
  - Browse all MTG cards with search and filters
  - Filter by set, colors, rarity, card type
  - View card details and market links
```

### Lorcana Database (Lorcanito API)

```
Purpose: Disney Lorcana card database for validation
Files:
  - lib/lorcanaCardMatcher.ts         # Database lookup
  - scripts/import-lorcana-database.js # Import script

LORCANA LOCAL DATABASE:
  Tables:
  - lorcana_sets
  - lorcana_cards

  Import Script: scripts/import-lorcana-database.js
  Migration: migrations/add_lorcana_cards_database.sql

DATABASE PAGE: /lorcana-database
  - Browse Lorcana cards with search and filters
  - Filter by set, ink color, rarity
  - View card details and market links
```

### One Piece Database (Future)

```
NOTE: One Piece TCG does not currently have a local database.
      Cards are identified by AI grading only.

POTENTIAL DATA SOURCES:
  - One Piece TCG API (unofficial community APIs)
  - Manual data entry
  - Web scraping from official Bandai site

When implementing, follow the pattern of:
  - migrations/add_onepiece_cards_database.sql
  - scripts/import-onepiece-database.js
  - lib/onepieceCardMatcher.ts
  - /onepiece-database page
```

### TCGdex API (Japanese Cards - v7.4)

```
Base URL: https://api.tcgdex.net/v2/ja
Purpose: Japanese Pokemon card data
Files:
  - scripts/import-pokemon-tcgdex.js    # Import script
  - scripts/backfill-japanese-images.js # Image backfill

JAPANESE DATABASE:
  The system maintains a separate Japanese Pokemon database sourced from TCGdex.
  Used for Japanese card detection and validation during grading.

  Tables:
  - pokemon_sets_ja (171 sets)
  - pokemon_cards_ja (~5,500+ cards)

  Import Script: scripts/import-pokemon-tcgdex.js
  Migration: migrations/add_japanese_pokemon_tables.sql

  Usage:
    node scripts/import-pokemon-tcgdex.js  # Full import (~17 minutes)

IMAGE NOTES:
  - Modern sets (SV, S series) have images from TCGdex
  - Old sets (1996-2000s) may have null images (no scans available)
  - Images hosted at: https://assets.tcgdex.net/ja/{series}/{set}/{localId}/high.webp
```

### Stripe

```
Purpose: Payment processing
Features: Checkout sessions, webhooks, credit system
File: lib/stripe.ts
```

### Resend

```
Purpose: Transactional & marketing emails
Features: Welcome emails, follow-up campaigns
File: lib/emailTemplates.ts
```

---

## Conversion & Analytics Tracking

### Tracking Pixels & Tags

| Platform | ID | Implementation |
|----------|-----|----------------|
| Google Analytics 4 | `G-YLC2FKKBGC` | `gtag.js` in `layout.tsx` |
| Google Ads | `AW-17817758517` | `gtag.js` in `layout.tsx` |
| Reddit Pixel | `a2_i6zsi175k40r` | `rdt('init', ...)` in `layout.tsx` |
| Meta/Facebook Pixel | `2308558869571917` | `fbq('init', ...)` in `layout.tsx` |

### Conversion Events

| Event | Where Fired | Parameters |
|-------|-------------|------------|
| `ads_conversion_PURCHASE_1` | `/credits/success`, `/founders/success`, `/card-lovers/success` | `transaction_id`, `value`, `currency: 'USD'` |
| `purchase` (GA4) | `/credits/success`, `/founders/success`, `/card-lovers/success` | `transaction_id`, `value`, `currency`, `items` |
| Reddit `Purchase` | `/credits/success`, `/card-lovers/success` | `transactionId`, `value`, `currency` |
| Reddit `Lead` | Landing page CTAs | `conversionId` with page/location/timestamp |
| Reddit `SignUp` | `/login` (on account creation) | `conversionId` with timestamp/email |
| Meta `Purchase` | `/credits/success`, `/card-lovers/success` | `value`, `currency` |
| Meta `Subscribe` | `/card-lovers/success` | `value`, `currency`, `content_ids` |
| `begin_checkout` (GA4) | `/vip`, `/card-lovers`, `/credits` | `value`, `currency`, `items` |
| Meta `InitiateCheckout` | `/vip`, `/card-lovers`, `/credits` | `value`, `currency`, `content_ids` |

### Google Ads Conversion Notes (v7.9)
- The `ads_conversion_PURCHASE_1` event **must** include `value` and `currency` parameters
- Without these, Google Ads defaults all conversions to $1 regardless of actual purchase amount
- Credits success page uses dynamic value from Stripe session metadata
- Founders success page uses hardcoded `value: 99`
- `transaction_id` is used for deduplication (Stripe session ID or `founders_{sessionId}`)

---

## 14. Admin Dashboard

### Routes

| Route | Purpose |
|-------|---------|
| `/admin/dashboard` | Overview stats |
| `/admin/users` | User management |
| `/admin/cards` | Card review & management |
| `/admin/analytics` | Charts & metrics |
| `/admin/monitoring` | API usage & errors |
| `/admin/blog` | Blog post management (v8.0) |
| `/admin/affiliates` | Affiliate management, commissions, payouts (v8.2) |

### Admin APIs

```
/api/admin/stats/dashboard      - Dashboard stats
/api/admin/analytics/users      - User analytics
/api/admin/analytics/cards      - Card analytics
/api/admin/cards/[id]           - Card management
/api/admin/users/[id]           - User management
/api/admin/backfill-labels      - Batch regenerate labels
/api/admin/affiliates           - List/create affiliates (v8.2)
/api/admin/affiliates/[id]      - Get/update/deactivate affiliate (v8.2)
/api/admin/affiliates/commissions        - List/pay commissions (v8.2)
/api/admin/affiliates/approve-commissions - Batch approve pending (v8.2)
```

---

## 15. Environment Variables

### Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_BASIC=price_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_ELITE=price_xxx
STRIPE_PRICE_FOUNDERS=price_xxx
STRIPE_PRICE_VIP=price_xxx
STRIPE_PRICE_CARD_LOVERS_MONTHLY=price_xxx
STRIPE_PRICE_CARD_LOVERS_ANNUAL=price_xxx

# Resend
RESEND_API_KEY=

# Cron Security
CRON_SECRET=

# Pokemon TCG (optional)
POKEMON_TCG_API_KEY=
```

### Optional

```env
USE_V5_ARCHITECTURE=true    # Enable v5 grading
NEXT_PUBLIC_BASE_URL=https://www.dcmgrading.com
```

---

## 16. Key Data Flows

### User Signup → First Card Grade

```
Email/Password Flow:
1. /login → directAuth.signUp() → Supabase creates user
2. DB triggers fire: insert users, profiles, schedule 24h follow-up, init credits
3. User receives Supabase confirmation email
4. User clicks confirmation link → /auth/callback
5. Callback detects new user (email_confirmed_at < 60s) → sends welcome email
6. Redirect to /credits?welcome=true

OAuth Flow:
1. /login → Google OAuth → /auth/callback
2. DB triggers fire: insert users, profiles, schedule 24h follow-up, init credits
3. Callback detects new user (created_at < 60s) → sends welcome email
4. Redirect to /credits?welcome=true

First Card Grade:
5. /upload → Select category
6. /upload/[category] → Capture/upload images
7. Deduct credit → Create card record
8. /api/vision-grade/[id] → AI grading
9. /api/pokemon/verify → API verification (if Pokemon)
10. Redirect to /pokemon/[id] → View results
```

### Homepage Featured Cards

```
1. /api/cards/featured → Query cards WHERE is_featured=true
2. Create signed URLs for images
3. Homepage carousel displays cards
4. Click → Navigate to /{category}/[id]
```

### Email Unsubscribe

```
1. User clicks unsubscribe link in email
2. /api/unsubscribe/[token] → Verify token
3. Redirect to /unsubscribe?token=xxx
4. User confirms → POST /api/unsubscribe/action
5. Set marketing_emails_enabled = false
6. Show success message
```

### Affiliate Referral → Commission (v8.2)

```
1. Visitor clicks dcmgrading.com/?ref=DOUG
   └── ReferralTracker validates code via /api/affiliate/validate
   └── Stores in localStorage: dcm_ref_code + dcm_ref_timestamp
   └── Records click via POST /api/affiliate/click (hashed IP)

2. Visitor makes purchase (credits/VIP/Card Lovers)
   └── Frontend reads dcm_ref_code from localStorage
   └── Passes ref_code in checkout/subscribe API body
   └── Checkout route validates affiliate, adds to Stripe metadata

3. Stripe webhook (checkout.session.completed)
   └── Reads ref_code from metadata OR promotion_code → affiliate mapping
   └── Fraud checks: self-referral block, duplicate attribution block
   └── Creates affiliate_commissions record (pending, hold_until = +14 days)
   └── Updates affiliate totals

4. Admin approves (after 14 days) via /admin/affiliates
   └── Batch approve all pending past hold period
   └── Commission status: pending → approved

5. Admin processes payout
   └── Selects approved commissions, enters PayPal reference
   └── Commission status: approved → paid

6. On refund (charge.refunded webhook)
   └── Reverses commission (status → reversed)
   └── Deducts from affiliate totals
```

---

## Quick Reference Commands

### Development

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Run ESLint
```

### Database

```bash
# Run migrations via Supabase Dashboard SQL Editor
# or use supabase CLI
```

### Testing

```bash
# Send test email
node scripts/send-test-email.js admin@dcmgrading.com

# Backfill follow-up emails
node scripts/backfill-followup-emails.js
```

### Pokemon Database Maintenance

```bash
# Full import of all English Pokemon cards (~20k cards, takes ~60-90 min)
node scripts/import-pokemon-database.js --full

# Incremental import (cards from last 90 days only)
node scripts/import-pokemon-database.js --incremental

# Re-run import to fill gaps (uses upsert, safe to re-run)
node scripts/import-pokemon-database.js --full
```

### Japanese Pokemon Database Maintenance (v7.4)

```bash
# Full import of Japanese cards from TCGdex (~171 sets, ~5,500 cards, ~17 min)
node scripts/import-pokemon-tcgdex.js

# Backfill missing image URLs for Japanese cards
node scripts/backfill-japanese-images.js
```

### Analytics Scripts

```bash
# Free credit conversion funnel analysis (v7.9)
# Analyzes signup → free grade → purchase pipeline
npx tsx scripts/free-credit-analysis.ts
```

### Email Advertising Audience Export

```bash
# Export full user list as CSV for email advertising (EmailOctopus, etc.)
npx tsx scripts/export-users-email-list.ts
```

**Output:** Creates `user-export-YYYY-MM-DD.csv` in the project root with these columns:

| Column | Description |
|--------|-------------|
| Email | User's email address |
| Credits Purchased | Total credits purchased (`user_credits.total_purchased`) |
| Credit Balance | Current credit balance (`user_credits.balance`) |
| Paying Customer | "Yes" if `total_purchased > 0`, otherwise "No" |
| User Status | Segment classification (see below) |
| Signup Date | Account creation date |

**User Status Segments:**

| Status | Definition |
|--------|------------|
| Paying Customer | `total_purchased > 0` — has made at least one credit purchase |
| Free Grader | `total_purchased = 0` AND has `grade`/`regrade` transactions — used free signup credit but never paid |
| Signed Up Only | `total_purchased = 0` AND no grade transactions — created account but never graded a card |

**Data Sources:**
- `users` table — email addresses and signup dates
- `user_credits` table — balance, total_purchased, total_used
- `credit_transactions` table — transaction types (`grade`, `regrade`) to identify who has graded

**Email Platform:** EmailOctopus (https://emailoctopus.com)
- Import the CSV as an audience list
- Email templates are stored in `emails/` directory
- Templates use EmailOctopus merge tags: `{{PreviewText}}`, `{{SenderInfo}}`, `{{UnsubscribeURL}}`, `{{RewardsURL}}`
- UTM parameters follow pattern: `utm_source=emailoctopus&utm_medium=email&utm_campaign={campaign-name}&utm_content={element}`

---

## Common Issues & Solutions

### Auth Issues
- Check `localStorage['supabase.auth.token']` exists
- Verify JWT not expired
- Check Authorization header format: `Bearer {token}`

### Grading Fails
- Check OpenAI API key valid
- Verify image URLs accessible (signed URLs not expired)
- Check card exists in database

### Credits Not Updating
- Verify Stripe webhook secret correct
- Check webhook logs in Stripe Dashboard
- Verify STRIPE_WEBHOOK_SECRET env var

### Emails Not Sending
- Check RESEND_API_KEY valid
- Verify CRON_SECRET matches Vercel env
- Check email_schedule table for pending records

### New Users Not Appearing in Admin
- Check `handle_new_user()` trigger exists on auth.users
- Verify users and profiles tables have required columns
- Run backfill: `INSERT INTO users SELECT id, email, created_at FROM auth.users ON CONFLICT DO NOTHING`

### Signup Fails with "server_error"
- Database trigger is failing - check handle_new_user() function
- Ensure all tables exist: users, profiles, email_schedule
- Triggers should use exception handlers to fail gracefully

### Pokemon Card Lookup Fails
- Check if card exists in local database: `SELECT * FROM pokemon_cards WHERE name ILIKE '%Charizard%' LIMIT 5`
- Re-run import if cards missing: `node scripts/import-pokemon-database.js --full`
- Check import logs: `SELECT * FROM pokemon_import_log ORDER BY created_at DESC LIMIT 5`
- Verify Supabase env vars are set for server-side code

### Pokemon Card Number Wrong After Grading
- AI may be using set knowledge instead of reading the image
- Check `card_number_ocr_breakdown` field in grading response
- Force regrade clears all cached verification data
- If verification matched wrong card, check year validation in logs:
  - `[Pokemon API Verification] REJECTED: Year mismatch too large (2014 vs 2025)`
- Check name validation:
  - `[Pokemon API Verification] REJECTED: Name mismatch (CardA vs CardB)`

### Force Regrade Not Working
- Verify the force_regrade=true parameter is being passed
- Check logs for: `🧹 Clearing cached pokemon_api_* fields for fresh re-grade`
- If still showing old data, check if browser is caching the response
- Database should show nulled fields: `pokemon_api_id`, `pokemon_api_data`, `card_number`

### Condition Labels Inconsistent
- v6.2 fix: Labels now always use deterministic `getConditionFromGrade()` mapping
- Same numeric grade = same condition label (no AI variation)
- Run `/api/admin/backfill-labels` to regenerate all existing card labels

### Sports Cards Show "N/A" Labels on Collection/Search
- v7.2 fix: APIs now parse `conversational_grading` JSON when direct columns are NULL
- Sports cards have specific categories: 'Football', 'Baseball', 'Basketball', etc.
- Check `labelDataGenerator.ts` handles the specific sport category
- Verify API is selecting `conversational_grading` column
- Check API response includes enriched `conversational_card_info` field
- Debug: Add `console.log` in `getSportsName()` to verify card info is passed

### Pokemon Promo Card Lookup Fails
- v7.2 fix: Added SM promo (SM228) and XY promo (XY124) format support
- Check card number format is detected correctly in `detectCardNumberFormat()`
- Verify promo set ID returned by `getPromoSetId()` (smp, xyp, swshp, svp)
- Check promo set exists in local database: `SELECT * FROM pokemon_sets WHERE id IN ('smp', 'xyp')`
- Fallback: External API lookup if not in local database

### DCM Optic Version Not Showing
- Version is stored in `conversational_grading` JSON under `meta.prompt_version`
- Frontend helper `getDCMOpticVersion()` parses this from the stored JSON
- If version is null/missing, card was graded before version tracking was implemented
- **To update version string:** Edit `lib/visionGrader.ts` lines 1651-1652 and 1703-1704
- Legacy cards won't show version - must force regrade to get version stored

### Pokemon Card Info Shows Wrong Set/Year
- v7.1 fix: Database validation now overrides AI-identified set info
- Local `pokemon_cards` database is source of truth
- Query uses `name ILIKE '%{name}%' AND number = '{card_number}'`
- Orders by `set_release_date DESC` (newest sets first)
- Extracts year from `set_release_date` column
- Both Card Information panel AND label should show same correct data
- If still wrong: check if card exists in local database with correct set info

### Card Information Panel vs Label Show Different Data
- v7.1 fix: Both now use same corrected data from database validation
- Database validation updates BOTH:
  - `conversationalGradingData.card_info` (object)
  - `conversationalGradingResult` (raw JSON string)
- If mismatch persists: force regrade with `?force_regrade=true`

### Japanese Pokemon Cards Not Detected
- v7.4 fix: System detects Japanese text using Unicode ranges (Hiragana, Katakana, Kanji)
- Check if card_name, player_or_character, or set_name contains Japanese text
- Also checks language field for 'ja' or 'japanese'
- Debug: Log `isJapaneseCard` value in `api/pokemon/[id]/route.ts`

### Japanese Card Not Enriched with Set Data
- Verify card exists in `pokemon_cards_ja` table: `SELECT * FROM pokemon_cards_ja WHERE name ILIKE '%カード名%' LIMIT 5`
- Re-run import if cards missing: `node scripts/import-pokemon-tcgdex.js`
- Check that card number matches: query uses `local_id = '{card_number}'`

### Japanese Card Images Not Displaying
- v7.4: Added `assets.tcgdex.net` to Next.js image whitelist in `next.config.ts`
- Old sets (1996-2000s) may have null images - this is a TCGdex data limitation
- Modern sets (SV, S series) should have images
- Check image_url column: `SELECT id, name, image_url FROM pokemon_cards_ja WHERE image_url IS NULL LIMIT 10`

### Pokemon Database Page Search Issues
- v7.4: Search API fixed - helper functions should NOT be async
- If "query.order is not a function" error: check helper functions return Supabase query builder directly
- Sets dropdown updates based on language selection
- Clear selected set when language changes

### One Piece Card Grading Not Working
- v7.8: Ensure 'One Piece' (with space) is used as category, not 'OnePiece'
- Check `useBackgroundGrading.ts` has 'One Piece' in CARD_TYPES_CONFIG
- Verify `prompts/onepiece_delta_v5.txt` exists
- Check `lib/promptLoader_v5.ts` has 'onepiece' case in switch statement
- Run migration: `migrations/add_onepiece_card_reference_columns.sql`

### One Piece eBay Search Returns Wrong Card Version
- v7.8: Variant type must be passed through the chain:
  - `CardDetailClient.tsx` → `EbayPriceLookup` (variant_type prop)
  - `EbayPriceLookup` → `/api/ebay/prices` (variant_type in request body)
  - API → `searchOnePiecePricesWithFallback()` (variant_type in options)
- Check `getOnePieceVariantSearchTerm()` maps the variant correctly
- Common variants: parallel, manga, alternate_art, sp, sec
- Debug: Server logs show `[eBay One Piece] Building queries - variant_type: "..."`

### One Piece Card Label Shows Wrong Data
- Check `labelDataGenerator.ts` has One Piece handlers:
  - `getOnePieceName()` - card name extraction
  - `getOnePieceSetInfo()` - set name and year
  - `getOnePieceFeatures()` - variant badges
- Verify `conversational_card_info` has correct fields from grading

### eBay Prices Not Showing on Collection Page
- v7.7: Prices are cached to `ebay_price_*` columns on cards table
- If prices show null: check `conversational_card_info` has required fields
- Batch refresh uses 3 fallback sources: `conversational_card_info`, `conversational_grading` JSON, legacy direct fields
- Check server logs for: `[PriceTracker] Skipping card - insufficient info`
- Required fields: `player_or_character` OR `card_name` (at minimum)

### eBay Prices Show "null" After Batch Refresh
- Field name mapping may be wrong - check `fetchAndCacheCardPrice()` in `lib/ebay/priceTracker.ts`
- Database uses: `player_or_character`, `set_name`, `year`
- eBay search expects: `featured`, `card_set`, `release_date`
- Mapping happens in priceTracker.ts - verify the mapping is correct

### Card Detail Page Shows Empty Search Query
- v7.7: When using cached prices, search query is not stored (only aggregate stats)
- UI now shows "Using cached prices • Click Refresh for live data" instead of empty query
- Click Refresh to get live eBay data with actual search query and listings

### Card Detail Page Charts/Listings Missing
- Charts and listings require live eBay data (not cached data)
- Cached data only stores: lowest, median, average, highest, listing_count
- Click "Refresh" button to fetch live data with individual listings
- Fixed in v7.7: Refresh now always fetches live data, not cached

### Background Price Refresh Not Working
- Check browser console for errors on collection page
- Look for network request to `/api/ebay/batch-refresh-prices`
- Check server logs for `[PriceTracker]` or `[Batch Refresh]` messages
- Refresh only triggers for cards where `ebay_price_updated_at` is null or >7 days old

### eBay Auction Listing Posts as Buy It Now
- v8.0 fix: Ensure `listingFormat` is sent in the request body from the modal
- If browser serves cached JS, `listingFormat` won't be in the body → server defaults to `'FIXED_PRICE'`
- Fix: Hard-refresh the browser (Ctrl+Shift+R) to load updated JavaScript bundle
- Debug: Server logs show `[eBay Listing] listingFormat received: AUCTION | raw body listingFormat: AUCTION`
- If raw body shows `undefined`, the old client JS is cached
- Verify: Auction listings should use `AddItem` call with `<ListingType>Chinese</ListingType>`
- Verify: Fixed price listings should use `AddFixedPriceItem` with `<ListingType>FixedPriceItem</ListingType>`

### Pages Load Mid-Scroll
- v8.0 fix: `ScrollToTop` component in `ClientLayout.tsx` scrolls to top on every route change
- Uses `usePathname()` hook to detect navigation
- If still happening: verify `ClientLayout.tsx` includes `<ScrollToTop />` before other children
- The component calls `window.scrollTo(0, 0)` in a `useEffect` keyed on `pathname`

### eBay API Rate Limits
- Default eBay API limit: 5,000 calls/day
- Batch refresh uses 500ms delay between calls
- Collection page processes 10 cards per batch with 1 second between batches
- For 1,000 cards/day pricing: well within limits

---

## File Naming Conventions

- Pages: `page.tsx` (Next.js App Router)
- API Routes: `route.ts`
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Contexts: `PascalCaseContext.tsx`
- Hooks: `useCamelCase.ts`

---

*This guide covers active, working code as of February 2026 (v8.2). Deprecated files are not included.*

---

## Version History

| Version | Date | Key Changes |
|---------|------|-------------|
| v8.3 | Feb 17, 2026 | Market Pricing dashboard (Card Lovers exclusive): portfolio value, category bar chart, top 10 cards, price movers, eBay listings tab, market insights. Price history: DCM/PriceCharting tracking, MTG/Lorcana card types, 10k card limit with time budget, initial snapshot on grading. /founders→/card-lovers redirect |
| v8.2 | Feb 11, 2026 | Affiliate/Partner Program: referral tracking (`?ref=CODE`), commission management (20% default), Stripe promo codes (10% buyer discount), admin dashboard, fraud prevention (self-referral/duplicate/14-day hold/auto-reversal), public info page |
| v8.1 | Feb 5, 2026 | VIP Package ($99/150 credits), Card Lovers subscription (monthly/annual), unified emblem system, SEO metadata for all pages, database performance indexes, conversion tracking fixes |
| v8.0 | Feb 2, 2026 | Blog CMS with admin, eBay auction listings (AddItem/Chinese), global scroll-to-top, page tour restart, eBay vintage sports & letter-based card number fixes |
| v7.9 | Jan 27, 2026 | Three-pass reorder (passes-first), SEO sitemap/robots.txt, CLS fixes (homepage skeletons), Google Ads conversion value fix, version string fix, Avery label improvements |
| v7.8 | Jan 23, 2026 | One Piece TCG support, variant-aware eBay search, onboarding tour Live Market Pricing step |
| v7.7 | Jan 20, 2026 | eBay price caching system, collection page pricing, batch refresh, price charts |
| v7.6 | Dec 22, 2025 | Founders Package ($99, 150 credits, 20% lifetime discount, founder emblem on labels) |
| v7.5 | Dec 19, 2025 | 3-step upload wizard, Reddit Pixel tracking, sports landing page, multi-select bulk delete, terms updates |
| v7.4 | Dec 18, 2025 | Japanese Pokemon database (TCGdex), Pokemon Database page with language toggle, Japanese card grading detection |
| v7.3 | Dec 17, 2025 | Prompt consistency overhaul: unified cap system, execution flowchart, whole numbers only, fixed contradictions |
| v7.2 | Dec 17, 2025 | Visual Defect Identification Guide, Defect Hunting Protocol, Facebook OAuth |
| v7.1.1 | Dec 16, 2025 | Unified label system, sports card category fix, SM/XY promo support |
| v7.1 | Dec 16, 2025 | Database validation, DCM Optic version tracking, transparent subgrade caps |
| v7.0 | Dec 2025 | Whole number grades only, removed half-points |
| v6.2 | Dec 15, 2025 | Card number OCR fixes, verification validation, Mega Evolution X/Y |
| v6.1 | Dec 2025 | Local Pokemon database, API fallback |
| v6.0 | Dec 2025 | Tier-first grading, dominant defect control |
| v5.5 | Nov 2025 | Three-pass consensus grading |
