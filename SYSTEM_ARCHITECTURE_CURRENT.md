# Current System Architecture

**Last Updated:** October 28, 2025
**Version:** v3.8 ENHANCED (Conversational AI + Weakest Link Scoring)
**Status:** Active Production System

---

## 🎯 EXECUTIVE SUMMARY

This document describes the **ACTIVE** grading system architecture as of October 28, 2025.

**Primary Grading System:** Conversational AI v3.5 PATCHED v2 (single-stage)
**Scoring Method:** v3.8 Weakest Link Scoring (minimum of weighted category scores)
**Status:** DVG v2 disabled, OpenCV Stage 0 disabled, Stage 2 disabled

---

## 📊 GRADING FLOW (Current Active System)

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER UPLOADS CARD IMAGES                      │
│                    (Front + Back Photos)                         │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                  GET /api/vision-grade/[id]                      │
│                                                                   │
│  1. Check if already graded (return cached if exists)            │
│  2. Create signed URLs for images                                │
│  3. Call gradeCardConversational()                               │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│          CONVERSATIONAL AI GRADING (Primary System)              │
│                                                                   │
│  Function: gradeCardConversational(frontUrl, backUrl)            │
│  Location: src/lib/visionGrader.ts                               │
│  Model: GPT-4o                                                   │
│  Prompt: prompts/conversational_grading_v3_5_PATCHED.txt         │
│                                                                   │
│  Process:                                                         │
│  - Single GPT-4o vision API call with both images                │
│  - Analyzes centering, corners, edges, surface                   │
│  - Calculates weighted scores (Front 55% + Back 45%)             │
│  - Determines limiting factor (lowest weighted score)            │
│  - Applies v3.8 weakest link scoring                             │
│  - Returns markdown report                                       │
│                                                                   │
│  Output: Markdown report with:                                   │
│  - Final grade (1.0-10.0 scale)                                  │
│  - Sub-scores for each category                                  │
│  - Weighted scores                                               │
│  - Limiting factor                                               │
│  - Detailed observations                                         │
│  - Case detection                                                │
│  - Card info                                                     │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    MARKDOWN PARSING                              │
│                                                                   │
│  Parser: parseConversationalV3_5()                               │
│  Location: src/lib/conversationalParserV3_5.ts                   │
│                                                                   │
│  Extracts:                                                        │
│  - decimal_grade, whole_grade, grade_uncertainty                 │
│  - condition_label, image_confidence                             │
│  - sub_scores (centering, corners, edges, surface)               │
│  - centering_ratios (front/back L-R and T-B)                     │
│  - card_info (name, player, set, year, etc.)                     │
│  - case_detection (type, visibility, impact)                     │
│  - validation_checklist                                          │
│  - front_summary, back_summary                                   │
│  - meta (prompt version, timestamp)                              │
│                                                                   │
│  Fallback: parseConversationalGradingV3()                        │
│  (For old cached cards graded with v3.2 or earlier)              │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│               JSON EXTRACTION (Enhanced Data)                    │
│                                                                   │
│  Multiple lightweight GPT-4o calls for structured data:          │
│                                                                   │
│  1. Card Info Extraction (JSON)                                  │
│     - Extracts card metadata in structured JSON                  │
│     - Handles null values properly                               │
│     - Detects subsets, memorabilia, autographs                   │
│                                                                   │
│  2. Case Detection Extraction (Regex)                            │
│     - Extracts from markdown: Case Type, Visibility, Impact      │
│     - Handles markdown bold formatting                           │
│                                                                   │
│  3. Grade Extraction (JSON)                                      │
│     - Extracts main grading data                                 │
│     - 🆕 v3.8: Extracts weighted_sub_scores                      │
│     - 🆕 v3.8: Extracts limiting_factor                          │
│     - 🆕 v3.8: Extracts preliminary_grade                        │
│                                                                   │
│  4. Corners/Edges/Surface Details (JSON)                         │
│     - Extracts detailed analysis for each corner/edge            │
│     - Stores in conversational_corners_edges_surface (JSONB)     │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│              PROFESSIONAL GRADE ESTIMATION                       │
│                                                                   │
│  Function: estimateProfessionalGradesWithDeterministicMapper()   │
│  Location: src/lib/visionGrader.ts                               │
│                                                                   │
│  Maps DCM grade to professional grading services:                │
│  - PSA (1-10 scale)                                              │
│  - BGS (0.5-10.0 scale with subgrades)                           │
│  - SGC (1-10 scale)                                              │
│  - CGC (1-10 scale)                                              │
│                                                                   │
│  Uses deterministic mapping based on:                            │
│  - Final DCM grade                                               │
│  - Centering ratios                                              │
│  - Sub-scores                                                    │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE STORAGE                              │
│                                                                   │
│  Table: cards                                                    │
│                                                                   │
│  Conversational AI Fields (PRIMARY):                             │
│  - conversational_grading (TEXT) - Full markdown report          │
│  - conversational_decimal_grade (NUMERIC)                        │
│  - conversational_whole_grade (INTEGER)                          │
│  - conversational_grade_uncertainty (TEXT)                       │
│  - conversational_condition_label (TEXT)                         │
│  - conversational_image_confidence (TEXT)                        │
│  - conversational_sub_scores (JSONB)                             │
│  - conversational_centering_ratios (JSONB) - DEPRECATED          │
│  - conversational_case_detection (JSONB)                         │
│  - 🆕 conversational_weighted_sub_scores (JSONB) - v3.8          │
│  - 🆕 conversational_limiting_factor (TEXT) - v3.8               │
│  - 🆕 conversational_preliminary_grade (NUMERIC) - v3.8          │
│  - conversational_validation_checklist (JSONB)                   │
│  - conversational_front_summary (TEXT)                           │
│  - conversational_back_summary (TEXT)                            │
│  - conversational_card_info (JSONB)                              │
│  - conversational_corners_edges_surface (JSONB)                  │
│  - conversational_prompt_version (TEXT)                          │
│  - conversational_evaluated_at (TIMESTAMP)                       │
│  - conversational_defects_front (JSONB) - v3.3                   │
│  - conversational_defects_back (JSONB) - v3.3                    │
│  - conversational_centering (JSONB) - v3.3                       │
│  - conversational_metadata (JSONB) - v3.3                        │
│                                                                   │
│  Professional Grades:                                            │
│  - estimated_professional_grades (JSONB)                         │
│                                                                   │
│  Legacy Fields (maintained for compatibility):                   │
│  - dvg_grading (JSONB) - Stub data only                          │
│  - dvg_decimal_grade (NUMERIC)                                   │
│  - dvg_whole_grade (INTEGER)                                     │
│  - ai_grading (JSONB) - Legacy frontend format                   │
│  - raw_decimal_grade (NUMERIC)                                   │
│  - dcm_grade_whole (INTEGER)                                     │
│                                                                   │
│  Slab Detection Fields:                                          │
│  - slab_detected (BOOLEAN)                                       │
│  - slab_company, slab_grade, slab_cert_number, etc.              │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                       FRONTEND DISPLAY                           │
│                                                                   │
│  Component: CardDetailClient.tsx                                 │
│  Location: src/app/sports/[id]/CardDetailClient.tsx              │
│                                                                   │
│  Displays:                                                        │
│  - Final grade with condition label                              │
│  - Sub-scores (Front 55% + Back 45% = Weighted)                  │
│  - 🆕 v3.8: Limiting factor with red ring highlight              │
│  - 🆕 v3.8: Weighted scores display                              │
│  - 🆕 v3.8: Explanation callout for weakest link                 │
│  - Centering ratios                                              │
│  - Professional grade estimates                                  │
│  - Card information                                              │
│  - Case detection                                                │
│  - Detailed observations (if available)                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 ACTIVE CODE FILES

### Primary Grading System

#### `src/app/api/vision-grade/[id]/route.ts`
**Purpose:** Main API endpoint for card grading
**Status:** ✅ ACTIVE
**Key Functions:**
- `GET /api/vision-grade/[id]` - Grade a card or return cached result
- Handles image URL generation
- Orchestrates grading flow
- Stores results in database

**Critical Sections:**
- Lines 181-198: Cached card parsing with v3.5 parser + v3 fallback
- Lines 380-404: New card parsing with v3.5 parser
- Lines 696-705: v3.8 weighted scores extraction
- Lines 966-1082: Database update with all conversational AI fields

#### `src/lib/visionGrader.ts`
**Purpose:** Core grading functions
**Status:** ✅ ACTIVE (Conversational AI), ⏸️ DISABLED (DVG v2, Stage 2)

**Active Functions:**
- `gradeCardConversational()` - PRIMARY grading system
- `estimateProfessionalGradesWithDeterministicMapper()` - Professional grade estimation

**Disabled Functions (DO NOT USE):**
- `gradeCardWithVision()` - DVG v2, disabled since Oct 21, 2025
- `performDetailedInspection()` - Stage 2, disabled since Oct 15, 2025

#### `prompts/conversational_grading_v3_5_PATCHED.txt`
**Purpose:** AI grading instructions (v3.5 PATCHED v2)
**Status:** ✅ ACTIVE
**Version:** v3.8 ENHANCED with perfect card handling

**Key Sections:**
- STEP 1: Image Analysis & Quality Assessment
- STEP 2: Case Detection (protective holder identification)
- STEP 3: Front Side Detailed Inspection
- STEP 4: Back Side Detailed Inspection
- STEP 5: Centering Measurements
- STEP 6: Sub-Score Calculation (Front 55% + Back 45%)
- STEP 7: Limitation Caps (surface alteration, image quality)
- STEP 8: FINAL GRADE DETERMINATION (v3.8 weakest link scoring)
- STEP 8C: Perfect card handling (10.0 edge case)
- STEP 9: Condition Label Assignment
- STEP 10: Uncertainty Assessment
- STEP 11: Validation Checklist
- STEP 12: Card Information Extraction
- STEP 13: Enhanced Validation (format compliance)

**Critical Updates (v3.8):**
- Lines 1027-1032: Perfect card handling (never use "None" for limiting factor)
- Lines 1045-1049: Mandatory output requirements (always output weighted scores)
- Lines 1225-1231: Enhanced validation checkpoints

### Parsers

#### `src/lib/conversationalParserV3_5.ts`
**Purpose:** Parse v3.5 PATCHED v2 markdown reports
**Status:** ✅ ACTIVE (PRIMARY)

**Exported Interface:** `ConversationalGradingV3_5`
**Exported Function:** `parseConversationalV3_5(markdown: string)`

**Parses:**
- Final grade and condition label
- Sub-scores with front/back breakdown
- Centering ratios
- Card information
- Case detection
- Validation checklist
- Front/back summaries
- Meta information

#### `src/lib/conversationalParserV3.ts`
**Purpose:** Parse v3.2 and earlier markdown reports
**Status:** ✅ ACTIVE (FALLBACK ONLY)

**Use Case:** Old cached cards graded before v3.5 PATCHED

**Exported Function:** `parseConversationalGradingV3(markdown: string)`

#### `src/lib/conversationalDefectParser.ts`
**Purpose:** Parse defects into structured JSONB (v3.3 migration)
**Status:** ✅ ACTIVE

**Exported Functions:**
- `parseConversationalDefects()` - Extract front/back defects
- `parseCenteringMeasurements()` - Extract centering data
- `parseGradingMetadata()` - Extract grading metadata

### TypeScript Types

#### `src/types/card.ts`
**Purpose:** TypeScript interface for Card object
**Status:** ✅ ACTIVE

**Key Interfaces:**
- `Card` - Main card interface with all database fields
- Includes v3.8 fields:
  - `conversational_weighted_sub_scores`
  - `conversational_limiting_factor`
  - `conversational_preliminary_grade`

### Frontend Components

#### `src/app/sports/[id]/CardDetailClient.tsx`
**Purpose:** Card detail page with grading display
**Status:** ✅ ACTIVE

**Key Features:**
- Displays conversational AI grading (primary)
- v3.8 limiting factor highlighting (lines 2318-2410)
- Professional grade estimates
- Case detection display
- Centering ratios
- Detailed observations

---

## 🗄️ DATABASE SCHEMA (Current Fields Only)

### `cards` Table

#### Primary Key
- `id` (UUID, PRIMARY KEY)

#### Basic Card Information
- `card_name` (TEXT)
- `card_type` (TEXT) - 'sports', 'pokemon', etc.
- `card_set` (TEXT)
- `card_number` (TEXT)
- `featured` (TEXT) - Player or character name
- `manufacturer_name` (TEXT)
- `release_date` (TEXT)
- `rarity_tier` (TEXT)
- `rookie_card` (BOOLEAN)
- `autograph_type` (TEXT) - 'on-card', 'sticker', 'none'
- `memorabilia_type` (TEXT) - 'jersey', 'fabric', 'none'

#### Image Storage
- `front_path` (TEXT) - Supabase storage path
- `back_path` (TEXT) - Supabase storage path

#### Conversational AI Grading (PRIMARY SYSTEM) ✅
- `conversational_grading` (TEXT) - Full markdown report
- `conversational_decimal_grade` (NUMERIC) - 1.0-10.0 scale
- `conversational_whole_grade` (INTEGER) - 1-10 scale
- `conversational_grade_uncertainty` (TEXT) - e.g., "±0.5"
- `conversational_condition_label` (TEXT) - e.g., "Mint (M)"
- `conversational_image_confidence` (TEXT) - A, B, C, or D
- `conversational_sub_scores` (JSONB) - Front/back/weighted for each category
- `conversational_case_detection` (JSONB) - Protective holder info
- `conversational_weighted_sub_scores` (JSONB) - **v3.8 NEW** - Weighted scores per category
- `conversational_limiting_factor` (TEXT) - **v3.8 NEW** - Category determining final grade
- `conversational_preliminary_grade` (NUMERIC) - **v3.8 NEW** - Grade before caps
- `conversational_validation_checklist` (JSONB)
- `conversational_front_summary` (TEXT)
- `conversational_back_summary` (TEXT)
- `conversational_card_info` (JSONB) - Structured card metadata
- `conversational_corners_edges_surface` (JSONB) - Detailed corner/edge analysis
- `conversational_prompt_version` (TEXT)
- `conversational_evaluated_at` (TIMESTAMP)
- `conversational_defects_front` (JSONB) - v3.3 structured defects
- `conversational_defects_back` (JSONB) - v3.3 structured defects
- `conversational_centering` (JSONB) - v3.3 structured centering
- `conversational_metadata` (JSONB) - v3.3 grading metadata

#### Professional Grade Estimates ✅
- `estimated_professional_grades` (JSONB) - PSA, BGS, SGC, CGC estimates

#### Slab Detection ✅
- `slab_detected` (BOOLEAN)
- `slab_company` (TEXT) - 'PSA', 'BGS', etc.
- `slab_grade` (TEXT)
- `slab_cert_number` (TEXT)
- `slab_serial` (TEXT)
- `slab_subgrades` (JSONB)
- `slab_metadata` (JSONB)
- `ai_vs_slab_comparison` (TEXT)

#### Legacy Fields (Maintained for Compatibility)
- `dvg_grading` (JSONB) - Stub data only (DVG v2 disabled)
- `dvg_decimal_grade` (NUMERIC)
- `dvg_whole_grade` (INTEGER)
- `dvg_grade_uncertainty` (TEXT)
- `ai_grading` (JSONB) - Legacy frontend format
- `raw_decimal_grade` (NUMERIC)
- `dcm_grade_whole` (INTEGER)
- `opencv_metrics` (JSONB) - NULL (OpenCV disabled)

#### User & Visibility
- `user_id` (UUID) - Owner of the card
- `visibility` (TEXT) - 'public' or 'private'

#### Timestamps
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Indexes

#### Active Indexes
- `idx_cards_user_id` - For user's collection queries
- `idx_cards_visibility` - For public/private filtering
- `idx_conversational_decimal_grade` - For grade range queries
- `idx_conversational_limiting_factor` - **v3.8 NEW** - For limiting factor analysis
- `idx_gin_conversational_weighted_sub_scores` - **v3.8 NEW** - GIN index for JSONB queries

---

## 📊 DATA FLOW EXAMPLE

### Example: Grading a Card with v3.8 Weakest Link Scoring

#### 1. User uploads images
```
Front: /cards/user123/card456_front.jpg
Back: /cards/user123/card456_back.jpg
```

#### 2. API call
```http
GET /api/vision-grade/card456?force_regrade=false
```

#### 3. Conversational AI Grading
```typescript
const result = await gradeCardConversational(frontUrl, backUrl);
// Returns markdown report
```

#### 4. Markdown Output (AI Response)
```markdown
## STEP 8: FINAL GRADE DETERMINATION

### v3.8 WEAKEST LINK SCORING

- **Centering Weighted:** 9.5
- **Corners Weighted:** 9.0
- **Edges Weighted:** 9.0
- **Surface Weighted:** 9.5

**Limiting Factor:** Corners
**Preliminary Grade (before caps):** 9.0

### FINAL GRADE
**Decimal Grade:** 9.0
**Whole Number Equivalent:** 9
**Condition Label:** Mint (M)
```

#### 5. Parser Extraction
```typescript
const parsed = parseConversationalV3_5(markdownReport);
// Result:
{
  decimal_grade: 9.0,
  whole_grade: 9,
  condition_label: "Mint (M)",
  sub_scores: {
    centering: { front: 10.0, back: 9.0, weighted: 9.5 },
    corners: { front: 9.0, back: 9.0, weighted: 9.0 },
    edges: { front: 9.0, back: 9.0, weighted: 9.0 },
    surface: { front: 10.0, back: 9.0, weighted: 9.5 }
  }
}
```

#### 6. JSON Extraction (v3.8 Weighted Scores)
```typescript
const gradeJson = await extractGradeJSON(markdownReport);
// Result:
{
  decimal_grade: 9.0,
  whole_grade: 9,
  centering_weighted: 9.5,
  corners_weighted: 9.0,
  edges_weighted: 9.0,
  surface_weighted: 9.5,
  limiting_factor: "corners",  // lowercase
  preliminary_grade: 9.0
}
```

#### 7. Database Storage
```sql
UPDATE cards SET
  conversational_decimal_grade = 9.0,
  conversational_whole_grade = 9,
  conversational_condition_label = 'Mint (M)',
  conversational_sub_scores = '{"centering": {...}, "corners": {...}, ...}'::JSONB,
  conversational_weighted_sub_scores = '{"centering": 9.5, "corners": 9.0, "edges": 9.0, "surface": 9.5}'::JSONB,
  conversational_limiting_factor = 'corners',
  conversational_preliminary_grade = 9.0
WHERE id = 'card456';
```

#### 8. Frontend Display
```tsx
<div className="sub-scores">
  <ScoreBox
    label="Centering"
    score={9.5}
    // No red ring - not limiting factor
  />
  <ScoreBox
    label="Corners"
    score={9.0}
    className="ring-4 ring-red-500 bg-red-50"  // ← Limiting factor highlighted
    badge="⚠️ Limiting Factor"
  />
  <ScoreBox
    label="Edges"
    score={9.0}
  />
  <ScoreBox
    label="Surface"
    score={9.5}
  />
</div>

<Callout type="info">
  This card's final grade is determined by its <strong>corners</strong>,
  which received the lowest weighted score (9.0).
</Callout>
```

---

## ⏸️ DISABLED SYSTEMS (DO NOT USE)

### DVG v2 Grading (Disabled 2025-10-21)
**Location:** `src/lib/visionGrader.ts` - `gradeCardWithVision()`
**Status:** ⏸️ DISABLED - Stub data only
**Reason:** Replaced by Conversational AI as primary system

**What it did:**
- Complex JSON prompt asking for specific grading structure
- Produced `VisionGradeResult` object
- Less accurate than conversational approach

**Migration Status:**
- Code still present but unreachable (function not called)
- Database fields maintained for compatibility
- Should be moved to `src/lib/deprecated/dvg_v2.ts` (Phase 2.1)

### Stage 2: Detailed Inspection (Disabled 2025-10-15)
**Location:** `src/lib/visionGrader.ts` - `performDetailedInspection()`
**Status:** ⏸️ DISABLED
**Reason:** Stage 1 (Conversational AI) now has comprehensive microscopic detection

**What it did:**
- Second GPT-4o call after Stage 1
- Detailed corner/edge/surface analysis
- Could adjust grade based on findings

**Migration Status:**
- Code commented out in route.ts (lines 1094-1178)
- Should be moved to `src/lib/deprecated/stage2.ts` (Phase 2.1)

### OpenCV Stage 0 (Disabled 2025-10-19)
**Location:** `opencv_service/` directory, `/api/opencv-analyze` endpoint
**Status:** ⏸️ DISABLED
**Reason:** Unreliable boundary detection, false slab detection

**What it did:**
- Python OpenCV computer vision analysis
- Attempted to detect card boundaries, centering, defects
- Failed on slabs (97% = full frame), raw cards (44% = too small)

**Migration Status:**
- Code commented out in route.ts (lines 244-294)
- Service still present but not called
- Should add `DEPRECATED.md` to `opencv_service/` (Phase 2.1)

---

## 🚀 ADDING NEW FEATURES

### To Add a New Field to Conversational AI Output

1. **Update Prompt** (`prompts/conversational_grading_v3_5_PATCHED.txt`)
   - Add field to appropriate STEP section
   - Define output format clearly
   - Add to META changelog

2. **Update Parser** (`src/lib/conversationalParserV3_5.ts`)
   - Add field to `ConversationalGradingV3_5` interface
   - Add regex or parsing logic to extract field
   - Test with sample markdown

3. **Update Database**
   - Create migration: `migrations/add_new_field_YYYY-MM-DD.sql`
   - Add column: `ALTER TABLE cards ADD COLUMN new_field TYPE;`
   - Run migration in Supabase

4. **Update Route** (`src/app/api/vision-grade/[id]/route.ts`)
   - Add field to database UPDATE statement
   - Add field to GET response
   - Add field to cached card response

5. **Update Types** (`src/types/card.ts`)
   - Add field to `Card` interface
   - Add proper TypeScript type

6. **Update Frontend** (`src/app/sports/[id]/CardDetailClient.tsx`)
   - Add UI to display new field
   - Handle null/undefined states

7. **Test End-to-End**
   - Grade a card
   - Verify field appears in logs
   - Verify field saved to database
   - Verify field displays on frontend

### To Modify Grading Logic

1. **Update Prompt** - Change scoring instructions
2. **Test with Sample Card** - Verify output format unchanged
3. **Update Documentation** - Add changelog entry
4. **Update META** - Bump prompt version

---

## 🧪 TESTING CHECKLIST

### Before Deployment

- [ ] Grade a new card (no cache)
- [ ] Verify all conversational AI fields populated
- [ ] Verify v3.8 weighted scores extracted
- [ ] Verify limiting factor extracted
- [ ] Check frontend displays correctly
- [ ] Test cached card retrieval
- [ ] Test with slabbed card (slab detection)
- [ ] Test with card in protective case (case detection)
- [ ] Test with perfect 10.0 card (perfect card handling)
- [ ] Check professional grade estimates
- [ ] Verify no TypeScript errors

---

## 📝 MAINTENANCE NOTES

### Regular Tasks

1. **Monitor OpenAI API Performance**
   - Check logs for timeouts
   - Monitor processing times
   - Review error rates

2. **Database Maintenance**
   - Monitor table size
   - Review index performance
   - Clean up old cached URLs

3. **Prompt Tuning**
   - Review grading accuracy
   - Compare AI grades to professional grades (slabs)
   - Adjust prompt if systematic biases found

4. **Frontend Performance**
   - Monitor load times
   - Optimize image loading
   - Review bundle size

### Known Issues

1. **Supabase Image Download Timeouts** (HIGH PRIORITY)
   - Intermittent 400 errors downloading images from Supabase
   - Impact: Blocks grading for some cards
   - Fix: Investigate bucket settings, CORS, CDN

2. **Database Save Failures** (MEDIUM PRIORITY)
   - Intermittent fetch errors
   - Impact: Grading completes but doesn't save
   - Likely related to Supabase timeout issues

---

## 🔗 RELATED DOCUMENTATION

- `QUICK_START_2025-10-28.md` - Quick reference for resuming development
- `SESSION_SUMMARY_2025-10-28.md` - Detailed v3.8 implementation notes
- `V3_8_IMPLEMENTATION_COMPLETE.md` - v3.8 weakest link scoring implementation
- `CODEBASE_CLEANUP_ANALYSIS.md` - Full codebase audit and cleanup plan
- `migrations/add_v3_8_weakest_link_fields.sql` - v3.8 database migration

---

**Document Version:** 1.0
**Last Reviewed:** October 28, 2025
**Next Review:** When adding new features or making architectural changes

---

END OF CURRENT SYSTEM ARCHITECTURE
