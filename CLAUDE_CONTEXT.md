# DCM Grading App - Development Context Document

**Last Updated:** December 7, 2025
**Purpose:** Quick context reference for resuming development sessions with Claude

---

## Project Overview

**DCM OPTIC** is an AI-powered trading card grading application that uses computer vision and OpenAI's GPT models to analyze and grade collectible cards. Users upload front/back images of their cards and receive detailed condition grades across multiple categories.

**Live URL:** https://dcmgrading.com
**Stack:** Next.js 15.5.7, TypeScript, Supabase (DB + Storage), OpenAI GPT-5.1, Vercel (hosting)

---

## Directory Structure

```
card-grading-app/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/                # API routes
│   │   │   ├── pokemon/[id]/   # Pokemon card grading endpoint
│   │   │   ├── mtg/[id]/       # Magic: The Gathering endpoint
│   │   │   ├── sports/[id]/    # Sports cards endpoint
│   │   │   ├── lorcana/[id]/   # Disney Lorcana endpoint
│   │   │   ├── other/[id]/     # Other cards endpoint
│   │   │   ├── stripe/         # Payment/credits endpoints
│   │   │   └── admin/          # Admin dashboard APIs
│   │   ├── pokemon/[id]/       # Pokemon card detail page
│   │   ├── mtg/[id]/           # MTG card detail page
│   │   ├── sports/[id]/        # Sports card detail page
│   │   ├── lorcana/[id]/       # Lorcana card detail page
│   │   ├── other/[id]/         # Other card detail page
│   │   ├── upload/             # Card upload page
│   │   ├── collection/         # User's card collection
│   │   ├── search/             # Public card search
│   │   └── admin/              # Admin dashboard pages
│   ├── components/             # Shared React components
│   │   ├── PersistentStatusBar.tsx  # Top notification bar for grading queue
│   │   ├── PhotoTipsPopup.tsx       # Photo tips modal
│   │   └── ClientLayout.tsx         # Client-side layout wrapper
│   ├── contexts/               # React contexts
│   │   ├── GradingQueueContext.tsx  # Queue state management
│   │   └── CreditsContext.tsx       # User credits state
│   ├── hooks/                  # Custom React hooks
│   │   └── useBackgroundGrading.ts  # Background polling for grading status
│   ├── lib/                    # Core libraries
│   │   ├── visionGrader.ts          # Main AI grading logic
│   │   ├── promptLoader_v5.ts       # Loads master + delta prompts
│   │   ├── cardGradingSchema_v5.ts  # Zod schema for grading output
│   │   └── supabase*.ts             # Supabase client configs
│   └── types/                  # TypeScript types
│       └── card.ts                  # Card-related interfaces
├── prompts/                    # AI grading prompts
│   ├── master_grading_rubric_v5.txt      # Universal grading rules (~165K chars)
│   ├── pokemon_delta_v5.txt              # Pokemon-specific extraction
│   ├── mtg_delta_v5.txt                  # MTG-specific extraction
│   ├── sports_delta_v5.txt               # Sports-specific extraction
│   ├── lorcana_delta_v5.txt              # Lorcana-specific extraction
│   ├── other_delta_v5.txt                # Other cards extraction
│   └── backups/                          # Prompt version backups
└── public/                     # Static assets
```

---

## Card Types Supported

| Type | API Route | Detail Page | Delta Prompt |
|------|-----------|-------------|--------------|
| Pokemon | `/api/pokemon/[id]` | `/pokemon/[id]` | `pokemon_delta_v5.txt` |
| MTG | `/api/mtg/[id]` | `/mtg/[id]` | `mtg_delta_v5.txt` |
| Sports | `/api/sports/[id]` | `/sports/[id]` | `sports_delta_v5.txt` |
| Lorcana | `/api/lorcana/[id]` | `/lorcana/[id]` | `lorcana_delta_v5.txt` |
| Other | `/api/other/[id]` | `/other/[id]` | `other_delta_v5.txt` |

---

## Grading System Architecture

### Prompt Architecture (v5.0)
- **Master Rubric** (`master_grading_rubric_v5.txt`): Universal grading rules, defect identification, scoring tables
- **Delta Prompts** (`[type]_delta_v5.txt`): Card-type specific extraction rules (card info, special features)
- **Bookend Structure** (v5.12): Quick Reference at top, Final Verification at bottom

### 8 Core Rules (from Quick Reference)
1. **CARD PRESENCE**: Verify images contain actual cards before grading
2. **HUMAN EYE STANDARD**: Only deduct for defects you can SEE (no speculative deductions)
3. **10.0 = ZERO DEFECTS**: Any documented defect = max 9.5 for that component
4. **WHEN IN DOUBT (visible)**: If visible spot might be whitening, it IS whitening - deduct
5. **4-ELEMENT EVIDENCE**: [Location] → [Description] → [Measurement] → [Color Context]
6. **UNIQUE DESCRIPTIONS**: Each corner/edge must have unique wording (no copy-paste)
7. **INDEPENDENT LANGUAGE**: Never reference PSA/BGS/CGC/SGC in output
8. **WEAKEST LINK**: Final grade = minimum of weighted category scores

### Grading Categories
| Category | Weight | Description |
|----------|--------|-------------|
| Centering | 10% | Border alignment front/back |
| Corners | 25% | All 8 corners (4 front, 4 back) |
| Edges | 25% | All 8 edges (4 front, 4 back) |
| Surface | 40% | Scratches, print defects, staining |

### Grade Scale
- **10.0**: GEM MINT - Zero defects
- **9.5**: Near perfect - Extremely minor imperfections
- **9.0**: MINT - Minor imperfections
- **8.5-8.0**: NM-MT to NM
- **7.0-7.5**: EX-MT to NM-
- **Below 7.0**: Various conditions down to Poor

---

## Key Files to Know

### Core Grading Logic
- **`src/lib/visionGrader.ts`**: Main `gradeCardConversational()` function that calls OpenAI
- **`src/lib/promptLoader_v5.ts`**: Loads and combines master + delta prompts
- **`src/lib/cardGradingSchema_v5.ts`**: Zod schema defining expected JSON output structure

### API Routes (all follow same pattern)
- **`src/app/api/pokemon/[id]/route.ts`**: Handles GET requests, triggers grading, returns results
- Uses `status_only=true` query param for lightweight polling checks

### Frontend Components
- **`src/app/pokemon/[id]/CardDetailClient.tsx`**: Main card detail page component
- **`src/components/PersistentStatusBar.tsx`**: Top status bar showing grading queue
- **`src/hooks/useBackgroundGrading.ts`**: Polls API for grading completion

### Contexts
- **`src/contexts/GradingQueueContext.tsx`**: Manages queue of cards being graded
- **`src/contexts/CreditsContext.tsx`**: Manages user credit balance

---

## Database Schema (Supabase)

### `cards` table (key columns)
```sql
id                          UUID PRIMARY KEY
user_id                     UUID (references auth.users)
serial                      TEXT (unique serial number)
category                    TEXT ('Pokemon', 'MTG', 'Sports', 'Lorcana', 'Other')
front_path                  TEXT (Supabase storage path)
back_path                   TEXT (Supabase storage path)
conversational_grading      JSONB (full grading result)
conversational_decimal_grade DECIMAL (final grade 0-10)
conversational_card_info    JSONB (extracted card info)
visibility                  TEXT ('public' or 'private')
is_public                   BOOLEAN
created_at                  TIMESTAMP
```

---

## Recent Changes (December 7, 2025)

### Polling & Status Bar Fixes
1. **Fixed polling not stopping** after grading completes
   - Added `queueRef` in `useBackgroundGrading.ts` to avoid stale closures
   - Polling now correctly stops when all cards are marked complete

2. **Fixed progress bar stuck at 98%**
   - Changed to use `isAnyProcessing` flag
   - Progress bar hides immediately when no cards processing

3. **Fixed broken thumbnails** in status bar
   - Blob URLs don't persist across page refresh
   - Now generates Supabase signed URL after upload
   - Added fallback placeholder icon for broken images

### Prompt Updates (v5.12)
- Added **Quick Reference** (8 Core Rules) at top of master rubric
- Added **Final Verification** checklist at bottom
- Implements "bookend" structure for better AI compliance

---

## Development Workflow

### Running Locally
```bash
npm run dev          # Start dev server on localhost:3000
npm run build        # Production build
```

### Deploying
```bash
git add .
git commit -m "Description"
git push             # Auto-deploys to Vercel
```

### Testing Grading
1. Go to `/upload`
2. Select card type (Pokemon, MTG, etc.)
3. Upload front/back images
4. Watch status bar for progress
5. View results on card detail page

---

## Environment Variables Required

```env
OPENAI_API_KEY=           # OpenAI API key for GPT-5.1
NEXT_PUBLIC_SUPABASE_URL= # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=     # Supabase service role (server-side)
STRIPE_SECRET_KEY=        # Stripe for payments
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

---

## Token Usage & Costs

### Per Grading Call (estimated)
- **Input tokens**: ~52,000 (prompt + images)
- **Output tokens**: ~5,000 (JSON response)
- **Cost**: ~$0.20 per grading (GPT-5.1/GPT-4o pricing)

### Rate Limits
- Tier 2 (450K TPM): ~7.8 gradings/minute max
- Tier 3 (800K TPM): ~13.8 gradings/minute max

---

## Known Issues / Future Work

1. **Prompt size**: ~49K tokens for system prompt - could be optimized
2. **Centering detection**: Sometimes inconsistent on borderless cards
3. **WebSockets**: Could replace polling for better UX at scale

---

## Quick Resume Checklist

When starting a new session, mention:
1. "Working on DCM card grading app"
2. Reference this file: `CLAUDE_CONTEXT.md`
3. Specify what you want to work on (grading accuracy, UI, new features, etc.)

---

## Contact & Repository

- **GitHub**: https://github.com/mank087/card-grading-app
- **Production**: https://dcmgrading.com
