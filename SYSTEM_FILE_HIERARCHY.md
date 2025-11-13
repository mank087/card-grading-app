# 🗂️ System File Hierarchy - Upload to Card Details Flow

**Date:** October 24, 2025
**Purpose:** Complete file hierarchy and data flow from card upload to finalized card details page

---

## 📊 Complete Flow Diagram

```
USER UPLOADS CARD
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. UPLOAD PAGE (Frontend)                                    │
│ ├─ src/app/upload/sports/page.tsx                           │
│ │  ├─ Handles file selection (front & back images)          │
│ │  ├─ Calls: src/lib/imageCompression.ts                    │
│ │  │  └─ Compresses images before upload                    │
│ │  └─ Submits to /api/upload                                │
│ └─ src/app/upload/sports/CardAnalysisAnimation.tsx          │
│     └─ Shows loading animation during processing             │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. UPLOAD API (Backend)                                      │
│ ├─ src/app/api/upload/route.ts                              │
│ │  ├─ Receives front & back image files                     │
│ │  ├─ Generates unique card ID (UUID)                       │
│ │  ├─ Uploads images to Supabase Storage                    │
│ │  │  └─ Calls: src/lib/supabaseServer.ts                   │
│ │  ├─ Creates database record in 'cards' table              │
│ │  └─ Triggers grading via /api/vision-grade/[id]           │
│ │     (Async - doesn't wait for response)                   │
│ └─ Returns card ID to frontend                              │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. VISION GRADING API (Backend - Main AI Processing)        │
│ ├─ src/app/api/vision-grade/[id]/route.ts                   │
│ │  ├─ Fetches card record from database                     │
│ │  ├─ Creates signed URLs for images                        │
│ │  ├─ Checks if card already graded (cache)                 │
│ │  │                                                         │
│ │  ├─ Calls: src/lib/opencvAnalyzer.ts (Optional Stage 0)   │
│ │  │  ├─ Sends images to Python OpenCV service             │
│ │  │  │  └─ opencv_service/api_server.py                   │
│ │  │  ├─ Detects centering, edges, corners                  │
│ │  │  └─ Returns structured metrics                         │
│ │  │                                                         │
│ │  ├─ Calls: src/lib/visionGrader.ts (MAIN GRADING)        │
│ │  │  │                                                      │
│ │  │  ├─ gradeCardConversational() - v3.3 System            │
│ │  │  │  ├─ Uses: prompts/card_grader_v1.txt               │
│ │  │  │  ├─ Sends to OpenAI GPT-4o Vision API              │
│ │  │  │  ├─ AI analyzes both images simultaneously         │
│ │  │  │  ├─ Returns detailed markdown report               │
│ │  │  │  └─ 18-step comprehensive analysis                 │
│ │  │  │                                                      │
│ │  │  ├─ Calls: src/lib/conversationalGradingV3_3.ts       │
│ │  │  │  ├─ parseRarityClassification()                     │
│ │  │  │  ├─ parseDefectCoordinates()                        │
│ │  │  │  ├─ parseGradingMetadata()                          │
│ │  │  │  └─ parseBackwardCompatibleData()                   │
│ │  │  │                                                      │
│ │  │  ├─ Calls: src/lib/conversationalParserV3.ts          │
│ │  │  │  └─ parseConversationalGradingV3()                  │
│ │  │  │     ├─ Extracts card info                           │
│ │  │  │     ├─ Extracts sub-scores                          │
│ │  │  │     ├─ Extracts condition label                     │
│ │  │  │     └─ Validates data structure                     │
│ │  │  │                                                      │
│ │  │  ├─ Calls: src/lib/deterministicScorer.ts             │
│ │  │  │  ├─ calculateDeterministicGrade()                   │
│ │  │  │  └─ adjustSubGradesForStructuralDamage()            │
│ │  │  │                                                      │
│ │  │  ├─ Calls: src/lib/gradeValidator.ts                   │
│ │  │  │  └─ validateGrade() - Ensures grade consistency    │
│ │  │  │                                                      │
│ │  │  └─ Calls: src/lib/professionalGradeMapper.ts         │
│ │  │     └─ estimateProfessionalGrades()                    │
│ │  │        ├─ Maps to PSA scale (1-10)                    │
│ │  │        ├─ Maps to BGS scale (1-10 with .5)            │
│ │  │        ├─ Maps to SGC scale (1-10 with .5)            │
│ │  │        └─ Maps to CGC scale (1-10 with .5)            │
│ │  │                                                         │
│ │  └─ Updates database with all grading results             │
│ │     ├─ conversational_grading (markdown)                  │
│ │     ├─ conversational_decimal_grade (numeric)             │
│ │     ├─ conversational_condition_label (text)              │
│ │     ├─ conversational_card_info (JSON)                    │
│ │     ├─ conversational_sub_scores (JSON)                   │
│ │     ├─ estimated_professional_grades (JSON)               │
│ │     └─ v3.3 enhanced fields (16 new columns)              │
│ └─ Returns complete grading result                          │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. CARD DETAILS PAGE (Frontend Display)                     │
│ ├─ src/app/sports/[id]/page.tsx (Server Component)          │
│ │  ├─ Generates SEO metadata                                │
│ │  │  └─ Uses: generateMetadata() function                  │
│ │  │     ├─ Builds dynamic title                            │
│ │  │     ├─ Builds meta description                         │
│ │  │     ├─ Generates keywords                              │
│ │  │     └─ Creates OpenGraph & Twitter cards               │
│ │  └─ Renders: CardDetailClient component                   │
│ │                                                            │
│ └─ src/app/sports/[id]/CardDetailClient.tsx (Client UI)    │
│    │                                                         │
│    ├─ Fetches card data via API                             │
│    │  └─ GET /api/sports/[id]                               │
│    │     └─ src/app/api/sports/[id]/route.ts                │
│    │                                                         │
│    ├─ parseConversationalDefects() - v3.3 Frontend Parser   │
│    │  ├─ Extracts corners data from markdown                │
│    │  ├─ Extracts edges data from markdown                  │
│    │  └─ Extracts surface defects from markdown             │
│    │                                                         │
│    ├─ extractConditionSummary() - Summary Builder           │
│    │  └─ Extracts readable summary from markdown            │
│    │                                                         │
│    └─ Displays UI Tabs:                                     │
│       ├─ Card Overview Tab                                  │
│       │  ├─ Card images with zoom                          │
│       │  │  └─ src/app/sports/[id]/ImageZoomModal.tsx      │
│       │  ├─ Card info (player, set, year, etc.)           │
│       │  ├─ Final grade display                            │
│       │  └─ Professional grades (PSA/BGS/SGC/CGC)          │
│       │                                                     │
│       ├─ Corners & Edges Tab                               │
│       │  ├─ Front corners (4 corners)                      │
│       │  ├─ Front edges (4 edges)                          │
│       │  ├─ Back corners (4 corners)                       │
│       │  └─ Back edges (4 edges)                           │
│       │                                                     │
│       ├─ Surface Tab                                        │
│       │  ├─ Front surface defects                          │
│       │  │  ├─ Scratches                                   │
│       │  │  ├─ Creases                                     │
│       │  │  ├─ Print defects                               │
│       │  │  ├─ Stains                                      │
│       │  │  └─ Other issues                                │
│       │  └─ Back surface defects                           │
│       │                                                     │
│       ├─ Centering Tab                                     │
│       │  ├─ Front centering measurements                   │
│       │  ├─ Back centering measurements                    │
│       │  └─ Visual centering diagrams                      │
│       │                                                     │
│       ├─ Professional Grades Tab                           │
│       │  ├─ PSA estimated grade                            │
│       │  ├─ BGS estimated grade                            │
│       │  ├─ SGC estimated grade                            │
│       │  └─ CGC estimated grade                            │
│       │                                                     │
│       └─ Detailed Observations Dropdown                     │
│          ├─ Professional Assessment summary                 │
│          └─ Full conversational markdown report             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Complete File Structure

### **Frontend Files**

```
src/app/
├── upload/
│   ├── page.tsx                              (General upload page)
│   └── sports/
│       ├── page.tsx                          (Sports card upload - ENTRY POINT)
│       └── CardAnalysisAnimation.tsx         (Loading animation)
│
├── sports/
│   └── [id]/
│       ├── page.tsx                          (Server component - SEO & metadata)
│       ├── CardDetailClient.tsx              (Client component - Main display)
│       └── ImageZoomModal.tsx                (Image zoom functionality)
│
└── ui/
    └── (Shared UI components)
```

### **Backend API Routes**

```
src/app/api/
├── upload/
│   └── route.ts                              (POST - Upload images)
│
├── vision-grade/
│   └── [id]/
│       └── route.ts                          (GET - Trigger AI grading)
│
├── sports/
│   └── [id]/
│       └── route.ts                          (GET - Fetch card data for display)
│
├── card/
│   └── [id]/
│       └── route.ts                          (Legacy - may trigger grading)
│
├── opencv-analyze/
│   └── route.ts                              (POST - Send images to OpenCV service)
│
└── cards/
    ├── search/
    │   └── route.ts                          (Search functionality)
    └── [id]/
        └── visibility/
            └── route.ts                      (Update card visibility)
```

### **Core Library Files**

```
src/lib/
├── supabaseClient.ts                         (Client-side Supabase connection)
├── supabaseServer.ts                         (Server-side Supabase connection)
├── imageCompression.ts                       (Image compression utilities)
│
├── visionGrader.ts                           (MAIN - AI grading orchestrator)
│   ├── gradeCardConversational()             (v3.3 conversational grading)
│   ├── extractGradeMetrics()                 (Parse numeric metrics)
│   ├── performDetailedInspection()           (Detailed analysis)
│   └── estimateProfessionalGrades()          (PSA/BGS/SGC/CGC mapping)
│
├── conversationalGradingV3_3.ts              (v3.3 interfaces & parsers)
│   ├── parseRarityClassification()           (Parse rarity data)
│   ├── parseDefectCoordinates()              (Parse defect locations)
│   ├── parseGradingMetadata()                (Parse v3.3 metadata)
│   └── parseBackwardCompatibleData()         (Backward compatibility)
│
├── conversationalParserV3.ts                 (v3.2/v3.3 markdown parser)
│   ├── parseConversationalGradingV3()        (Extract structured data)
│   └── validateConversationalGradingDataV3() (Validate parsed data)
│
├── deterministicScorer.ts                    (Deterministic grade calculation)
│   ├── calculateDeterministicGrade()         (Math-based scoring)
│   └── adjustSubGradesForStructuralDamage()  (Adjust for damage)
│
├── gradeValidator.ts                         (Grade consistency validation)
│   └── validateGrade()                       (Ensure grade is valid)
│
├── professionalGradeMapper.ts                (Map to PSA/BGS/SGC/CGC scales)
│   └── estimateProfessionalGrades()          (Professional grade estimates)
│
├── opencvAnalyzer.ts                         (OpenCV integration)
│   ├── analyzeOpenCVReliability()            (Check OpenCV quality)
│   └── generateOpenCVSummaryForLLM()         (Format for AI)
│
├── boundaryCalculations.ts                   (Centering calculations)
├── conditionAssessment.ts                    (Condition logic)
├── parallelGrading.ts                        (Parallel processing)
├── schemaValidator.ts                        (JSON schema validation)
├── ebayUtils.ts                              (eBay integration)
├── ebayConditionMapper.ts                    (eBay condition mapping)
└── socialUtils.ts                            (Social sharing utilities)
```

### **AI Prompts**

```
prompts/
└── card_grader_v1.txt                        (v3.3 main grading prompt - 18 steps)
```

### **External Services**

```
opencv_service/                               (Python OpenCV service)
├── api_server.py                             (Flask API server)
├── card_cv_stage1.py                         (Stage 1 CV analysis)
└── requirements.txt                          (Python dependencies)
```

### **Database Migration Files**

```
migrations/
├── v3_3_column_size_fix.sql                  (Fix VARCHAR(50) limits)
└── (Other migration files...)
```

---

## 🔄 Data Flow Details

### **Step 1: Upload (Frontend → Backend)**

| File | Purpose | Input | Output |
|------|---------|-------|--------|
| `src/app/upload/sports/page.tsx` | User selects images | Front & back image files | Compressed images |
| `src/lib/imageCompression.ts` | Compress images | Original images | Compressed JPEGs |
| `src/app/api/upload/route.ts` | Save to storage & DB | Compressed images | Card ID (UUID) |

### **Step 2: AI Grading (Backend Processing)**

| File | Purpose | Input | Output |
|------|---------|-------|--------|
| `src/app/api/vision-grade/[id]/route.ts` | Orchestrate grading | Card ID | Complete grade data |
| `src/lib/opencvAnalyzer.ts` | Pre-analysis (optional) | Image URLs | OpenCV metrics |
| `opencv_service/api_server.py` | Computer vision | Images | Edge/corner/centering data |
| `src/lib/visionGrader.ts` | Main AI grading | Images + OpenCV data | Conversational markdown |
| `prompts/card_grader_v1.txt` | AI instructions | - | System prompt |
| OpenAI GPT-4o Vision API | AI analysis | Images + prompt | Markdown report |
| `src/lib/conversationalParserV3.ts` | Parse markdown | Markdown report | Structured JSON |
| `src/lib/conversationalGradingV3_3.ts` | Parse v3.3 data | Markdown sections | v3.3 fields |
| `src/lib/deterministicScorer.ts` | Calculate score | Sub-scores | Final decimal grade |
| `src/lib/gradeValidator.ts` | Validate grade | Grade + sub-scores | Valid grade |
| `src/lib/professionalGradeMapper.ts` | Map to PSA/BGS/SGC/CGC | DCM grade | Professional grades |

### **Step 3: Display (Frontend)**

| File | Purpose | Input | Output |
|------|---------|-------|--------|
| `src/app/api/sports/[id]/route.ts` | Fetch card data | Card ID | Complete card record |
| `src/app/sports/[id]/page.tsx` | Generate SEO | Card data | Metadata |
| `src/app/sports/[id]/CardDetailClient.tsx` | Render UI | Card data | Interactive card page |
| `parseConversationalDefects()` (in CardDetailClient) | Parse markdown | Markdown report | Corner/edge/surface data |
| `extractConditionSummary()` (in CardDetailClient) | Extract summary | Markdown report | Readable summary |

---

## 🗄️ Database Schema (Supabase)

### **Cards Table**

The `cards` table stores all card data including grading results:

**Image Storage:**
- `front_path` - Supabase storage path to front image
- `back_path` - Supabase storage path to back image
- `front_url` - Public URL (generated)
- `back_url` - Public URL (generated)

**Conversational Grading v3.3 (Current System):**
- `conversational_grading` - TEXT - Full markdown report
- `conversational_decimal_grade` - DECIMAL(3,1) - Numeric grade (0.0-10.0)
- `conversational_condition_label` - VARCHAR(50) - Condition label
- `conversational_card_info` - JSONB - Card identification
- `conversational_sub_scores` - JSONB - Sub-scores breakdown

**v3.3 Enhanced Fields (16 new columns):**
- `card_name` - VARCHAR(200)
- `featured` - VARCHAR(200)
- `card_set` - VARCHAR(200)
- `release_date` - VARCHAR(50)
- `manufacturer_name` - VARCHAR(100)
- `card_number` - VARCHAR(50)
- `sport` - VARCHAR(50)
- `serial_numbering` - VARCHAR(100)
- `rookie_card` - BOOLEAN
- `subset` - VARCHAR(200)
- `rarity_tier` - VARCHAR(100)
- `autograph_type` - VARCHAR(200)
- `memorabilia_type` - VARCHAR(200)
- `defect_coordinates` - JSONB
- `cross_side_verification_result` - VARCHAR(200)
- `microscopic_inspection_count` - INTEGER

**Professional Grades:**
- `estimated_professional_grades` - JSONB - PSA/BGS/SGC/CGC estimates

**DVG v2 (Optional - Can be disabled):**
- `dvg_grading` - JSONB - Structured grading data
- `dvg_decimal_grade` - DECIMAL(3,1)
- `dvg_grade_uncertainty` - VARCHAR(10)

**Metadata:**
- `id` - UUID (Primary Key)
- `user_id` - UUID (Foreign Key)
- `created_at` - TIMESTAMP
- `updated_at` - TIMESTAMP
- `is_public` - BOOLEAN
- `slab_detected` - BOOLEAN
- `slab_company` - VARCHAR(50)
- `slab_grade` - VARCHAR(20)

---

## 🎯 Key Integration Points

### **1. Image Upload → Storage**
- **Files:** `src/app/upload/sports/page.tsx` → `src/app/api/upload/route.ts`
- **Action:** Compressed images uploaded to Supabase Storage
- **Result:** Card record created with `front_path` and `back_path`

### **2. Storage → AI Grading**
- **Files:** `src/app/api/upload/route.ts` → `src/app/api/vision-grade/[id]/route.ts`
- **Action:** Async fetch triggers grading pipeline
- **Result:** Vision grading begins processing

### **3. AI Grading → Database**
- **Files:** `src/app/api/vision-grade/[id]/route.ts` → Supabase
- **Action:** Parsed grading results saved to `cards` table
- **Result:** All v3.3 fields populated

### **4. Database → Display**
- **Files:** `src/app/api/sports/[id]/route.ts` → `src/app/sports/[id]/CardDetailClient.tsx`
- **Action:** Frontend fetches complete card record
- **Result:** UI tabs populated with grading data

### **5. Markdown → UI Tabs**
- **Files:** `CardDetailClient.tsx` (parseConversationalDefects function)
- **Action:** Regex parsing extracts structured data from markdown
- **Result:** Corners, Edges, Surface tabs display AI analysis

---

## 🚀 Performance Optimizations

### **Image Compression**
- **File:** `src/lib/imageCompression.ts`
- **Purpose:** Reduce file size before upload (saves storage & API costs)
- **Settings:** Dynamic based on original file size

### **Signed URL Caching**
- **File:** `src/app/api/vision-grade/[id]/route.ts`
- **Purpose:** Cache signed URLs for 50 minutes
- **Result:** Faster re-fetches, reduced Supabase API calls

### **Grade Caching**
- **File:** `src/app/api/vision-grade/[id]/route.ts`
- **Purpose:** Skip re-grading if card already has results
- **Override:** `?force_regrade=true` query parameter

### **Concurrent Processing Limits**
- **File:** `src/app/api/vision-grade/[id]/route.ts`
- **Purpose:** Max 3 concurrent grading operations
- **Result:** Prevents OpenAI API rate limits

---

## 🔍 v3.3 Frontend Parsing (Current Fix)

### **Frontend Parser Location**
- **File:** `src/app/sports/[id]/CardDetailClient.tsx`
- **Lines:** 1441-1623

### **Parser Functions**

**1. parseConversationalDefects()** (Lines 1441-1583)
- Extracts from `[STEP 3] FRONT ANALYSIS` and `[STEP 4] BACK ANALYSIS`
- Regex patterns match optional hyphens: `/-?\s*Top Left:\s*([^\n]+)/i`
- Returns structured object matching DVG v2 format
- Powers: Corners & Edges tab, Surface tab

**2. extractConditionSummary()** (Lines 1600-1623)
- Extracts from `[STEP 6] VISUAL CONDITION FRAMEWORK`
- Fallback to `[STEP 10] FINAL GRADE CALCULATION`
- Returns readable summary text
- Powers: Professional Assessment section

### **Data Flow in Frontend**

```
Card.conversational_grading (markdown)
        ↓
parseConversationalDefects()
        ↓
conversationalDefects object
        ↓
dvgGrading = conversationalDefects
        ↓
UI Tabs (Corners & Edges, Surface)
```

---

## 📝 Summary

### **Total Files Involved in Upload → Display Flow**

**Frontend:** 4 files
**Backend API:** 6 files
**Core Libraries:** 13 files
**External Services:** 1 service (Python OpenCV)
**AI Prompts:** 1 file
**Database:** 1 table (`cards`)

**Total:** ~25 files in the core flow

### **Primary Technologies**

- **Frontend:** Next.js 14 (App Router), React, TypeScript
- **Backend:** Next.js API Routes (serverless)
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (S3-compatible)
- **AI:** OpenAI GPT-4o Vision API
- **Computer Vision:** Python OpenCV (optional)
- **Deployment:** Vercel (assumed)

---

**Document Created:** October 24, 2025
**System Version:** Conversational Grading v3.3
**Status:** Complete and Verified
