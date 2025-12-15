# DCM Grading Application - Comprehensive Guide

> **Quick Reference for Claude Sessions**
> Last Updated: December 15, 2025 (v6.2 - Card Number OCR & Verification Fixes)

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

---

## 1. Project Overview

**DCM Grading** is a full-stack card grading platform that uses AI (GPT-4o vision) to grade trading cards (Pokemon, MTG, Sports, Lorcana, Other). Users upload card images, receive AI-powered condition grades, and can download professional labels/reports.

**Core Features:**
- AI-powered card grading with three-pass consensus system (v6.0)
- **v6.0: Whole number grades only (1-10, no half-points)**
- **v6.0: Tier-first grading with dominant defect control**
- Support for multiple card types (Pokemon, MTG, Sports, Lorcana, Other)
- Credit-based payment system via Stripe
- User collection management
- Public card search by serial number
- Professional label and report generation
- Admin dashboard with analytics
- Email marketing with 24-hour follow-up

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
│   ├── layout.tsx                # Root layout
│   ├── login/                    # Login/signup page
│   ├── upload/                   # Card upload flow
│   ├── collection/               # User's card collection
│   ├── account/                  # Account settings
│   ├── search/                   # Public card search
│   ├── credits/                  # Credit purchase
│   ├── pokemon/[id]/             # Pokemon card detail
│   ├── mtg/[id]/                 # MTG card detail
│   ├── sports/[id]/              # Sports card detail
│   ├── lorcana/[id]/             # Lorcana card detail
│   ├── other/[id]/               # Other card detail
│   ├── unsubscribe/              # Email unsubscribe
│   ├── admin/                    # Admin dashboard
│   └── api/                      # API routes
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
│   └── pokemonApiVerification.ts # Pokemon TCG API
│
├── components/                   # React components
│   ├── ClientLayout.tsx          # Root layout with providers
│   ├── CardSlab.tsx              # Card display component
│   ├── camera/                   # Camera & upload components
│   ├── reports/                  # Report & label components
│   ├── admin/                    # Admin components
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

### Protected Pages (Require Login)

| Route | File | Purpose |
|-------|------|---------|
| `/upload` | `app/upload/page.tsx` | Category selector for upload |
| `/upload/[category]` | `app/upload/[category]/page.tsx` | Upload images for grading |
| `/collection` | `app/collection/page.tsx` | User's graded cards |
| `/account` | `app/account/page.tsx` | Account settings |
| `/credits` | `app/credits/page.tsx` | Purchase credits |

### Card Detail Pages (Public if card is public)

| Route | File | Purpose |
|-------|------|---------|
| `/pokemon/[id]` | `app/pokemon/[id]/page.tsx` | Pokemon card details |
| `/mtg/[id]` | `app/mtg/[id]/page.tsx` | MTG card details |
| `/sports/[id]` | `app/sports/[id]/page.tsx` | Sports card details |
| `/lorcana/[id]` | `app/lorcana/[id]/page.tsx` | Lorcana card details |
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
| `/api/other/[id]` | GET/DELETE | Other card operations |

### Payments & Credits

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/stripe/checkout` | POST | Create Stripe checkout session |
| `/api/stripe/webhook` | POST | Stripe webhook handler |
| `/api/stripe/credits` | GET | Get user credit balance |
| `/api/stripe/deduct` | POST | Deduct credit for grading |

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
| `lib/visionGrader.ts` | **PRIMARY**: Master rubric + delta grading (v6.0 three-pass) |
| `lib/promptLoader_v5.ts` | Loads master_grading_rubric_v5.txt + card-type deltas |
| `lib/conversationalParserV3_5.ts` | Parse grading markdown reports |
| `lib/professionalGradeMapper.ts` | Map to PSA/BGS/SGC/CGC grades |
| `lib/conditionAssessment.ts` | Numeric grade to condition label |
| `lib/promptLoader_v5.ts` | Load card-type specific prompts |
| `lib/cardGradingSchema_v5.ts` | Zod validation for grading responses |

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

**Rubric File:** `prompts/master_grading_rubric_v5.txt` (updated to v6.0)

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

3. **Verification Validation** (`lib/pokemonApiVerification.ts`)
   - **Year validation**: Rejects matches >3 years different (prevents 2014 card matching to 2025)
   - **Name validation**: Rejects completely mismatched card names
   - **Confidence-based corrections**: Only high/medium confidence matches can override card info
   - **Card number protection**: Only HIGH confidence matches can change `card_number`

4. **Force Regrade Improvements** (`api/pokemon/[id]/route.ts`)
   - Now clears ALL cached `pokemon_api_*` fields
   - Clears `card_number`, `card_set`, `release_date`, `label_data`
   - Ensures completely fresh grading without cached verification data

5. **Condition Label Uniformity** (`lib/labelDataGenerator.ts`)
   - Always uses deterministic `getConditionFromGrade()` mapping
   - Same grade always produces same condition label (no AI variation)

6. **Label Display Fixes** (`lib/labelDataGenerator.ts`)
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

### Email

| File | Purpose |
|------|---------|
| `lib/emailScheduler.ts` | Schedule & manage pending emails |
| `lib/emailTemplates.ts` | HTML email templates |

### Labels & Reports

| File | Purpose |
|------|---------|
| `lib/labelDataGenerator.ts` | Generate standardized label data |
| `lib/useLabelData.ts` | Retrieve/format label data |
| `lib/averyLabelGenerator.ts` | Generate Avery label PDFs |
| `lib/foldableLabelGenerator.ts` | Generate foldable labels |
| `lib/miniReportJpgGenerator.ts` | Generate mini report images |

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
| `components/ClientLayout.tsx` | Root layout with Auth, Credits, GradingQueue providers |
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
   ├── master_grading_rubric_v5.txt (universal rules, ~50k tokens)
   └── {card_type}_delta_v5.txt (card-specific rules)
4. THREE-PASS CONSENSUS GRADING (visionGrader.ts):
   ├── Pass 1 → GPT-4o evaluates independently
   ├── Pass 2 → GPT-4o (fresh evaluation, same prompt)
   └── Pass 3 → GPT-4o (fresh evaluation)
   └── Average scores, apply dominant defect control
   └── Final grade = whole number (v6.0: floor rounding)
5. Parse response, extract grading_passes
6. Generate label_data
7. Update card record with grades
```

### v6.0 Grading Rules

- **Whole numbers only**: Final grades are 1-10 integers (no 8.5, 9.5)
- **Tier-first**: Identify condition tier before calculating scores
- **Dominant defect control**: Worst category caps the grade
- **Three-pass consensus**: 2+/3 passes must agree on defects
- **Floor rounding**: Always round down (8.7 → 8)

### Post-Grading Verification

```
Pokemon cards → pokemonApiVerification.ts → Pokemon TCG API
MTG cards → mtgApiVerification.ts → Scryfall API
```

---

## 11. Credit & Payment System

### Credit Tiers

| Tier | Price | Credits | First Purchase Bonus |
|------|-------|---------|---------------------|
| Basic | $2.99 | 2 | +1 |
| Pro | $9.99 | 7 | +2 |
| Elite | $19.99 | 25 | +5 |

### Payment Flow

```
1. User clicks "Buy Credits"
2. POST /api/stripe/checkout → Create Stripe session
3. Redirect to Stripe checkout
4. Payment complete → Stripe webhook
5. POST /api/stripe/webhook → addCredits()
6. Update user_credits.balance
```

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
```

### Scryfall API

```
Base URL: https://api.scryfall.com
Purpose: Verify MTG card info
File: lib/mtgApiVerification.ts
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

## 14. Admin Dashboard

### Routes

| Route | Purpose |
|-------|---------|
| `/admin/dashboard` | Overview stats |
| `/admin/users` | User management |
| `/admin/cards` | Card review & management |
| `/admin/analytics` | Charts & metrics |
| `/admin/monitoring` | API usage & errors |

### Admin APIs

```
/api/admin/stats/dashboard      - Dashboard stats
/api/admin/analytics/users      - User analytics
/api/admin/analytics/cards      - Card analytics
/api/admin/cards/[id]           - Card management
/api/admin/users/[id]           - User management
/api/admin/backfill-labels      - Batch regenerate labels
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
# Full import of all Pokemon cards (~20k cards, takes ~60-90 min)
node scripts/import-pokemon-database.js --full

# Incremental import (cards from last 90 days only)
node scripts/import-pokemon-database.js --incremental

# Re-run import to fill gaps (uses upsert, safe to re-run)
node scripts/import-pokemon-database.js --full
```

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

---

## File Naming Conventions

- Pages: `page.tsx` (Next.js App Router)
- API Routes: `route.ts`
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Contexts: `PascalCaseContext.tsx`
- Hooks: `useCamelCase.ts`

---

*This guide covers active, working code as of December 2025. Deprecated files are not included.*
