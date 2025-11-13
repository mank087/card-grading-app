# DCM Grading System v3.4.1 - Complete Architecture Backup
**Date**: October 7, 2025
**Status**: Production-ready three-stage hybrid system
**Purpose**: Full system documentation and restoration guide

---

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [File Inventory](#file-inventory)
4. [Key Features](#key-features)
5. [Configuration](#configuration)
6. [Restoration Steps](#restoration-steps)
7. [Known Issues & Limitations](#known-issues--limitations)

---

## System Overview

### Three-Stage Grading Pipeline

**Stage 0: OpenCV Card Detection (v3.4.1)**
- Language: Python (Flask service)
- Port: 5001
- Purpose: Geometric card detection, centering measurement, image quality assessment
- Processor: Hybrid adaptive edge detection with borderless card support

**Stage 1: AI Observation (v3.3)**
- Provider: OpenAI Assistants API
- Model: GPT-4 Vision
- Purpose: Visual defect detection, corner/edge/surface inspection, autograph verification
- Temperature: 0.4 (allows variance for texture detection)

**Stage 2: AI Scoring (v3.3)**
- Provider: OpenAI Assistants API
- Model: GPT-4
- Purpose: Deterministic numeric grading using Stage 0 + Stage 1 data
- Temperature: 0.3 (slight variance for realistic scoring)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Uploads Card                        │
│                   (Front + Back Images)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 0: OpenCV Detection (Python Flask - Port 5001)       │
├─────────────────────────────────────────────────────────────┤
│  File: card_detection_service/stage0_card_detector_v3_4.py  │
│                                                               │
│  ✓ Hybrid edge detection (adaptive + standard Canny)        │
│  ✓ 4-8 point polygon contour filtering                      │
│  ✓ Area ratio check (30-95% of frame)                       │
│  ✓ Background masking (3% margin)                           │
│  ✓ Border width measurement with sanity checks              │
│  ✓ Image quality grading (A-D)                              │
│  ✓ Numeric centering ratios (0.50 format)                   │
│                                                               │
│  Output: {                                                   │
│    detected: true,                                           │
│    edge_detection_mode: "standard",                          │
│    confidence: "high",                                       │
│    centering_lr_numeric: 0.50,                              │
│    centering_tb_numeric: 0.50,                              │
│    centering_estimate_type: "design-anchor",                │
│    image_quality_grade: "B",                                 │
│    border_measurements: {...}                                │
│  }                                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 1: AI Observation (OpenAI Assistant)                 │
├─────────────────────────────────────────────────────────────┤
│  File: ai_prompts/stage1_instructions_v3_1.txt (v3.3)       │
│  Assistant ID: asst_OPvbB4t6JqE93d8KcvgAYUR5                │
│  Temperature: 0.4                                            │
│                                                               │
│  ✓ Hard defect enforcement (≥16 observations)               │
│  ✓ Minimum 1 defect unless explicitly verified pristine     │
│  ✓ Corner-by-corner inspection (8 corners)                  │
│  ✓ Edge-by-edge inspection (8 edges)                        │
│  ✓ Surface defect detection                                 │
│  ✓ Autograph verification (handwriting detection)           │
│  ✓ Authentication marker check                              │
│  ✓ Image quality override capability                        │
│                                                               │
│  Output: {                                                   │
│    stage: "observation",                                     │
│    version: "3.3",                                           │
│    observations: [...16+ items],                            │
│    defects: [...],                                          │
│    autograph: {...},                                         │
│    defect_confidence_summary: {                             │
│      defects_found: int                                     │
│    },                                                        │
│    confidence: "high|medium|low"                            │
│  }                                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 2: AI Scoring (OpenAI Assistant)                     │
├─────────────────────────────────────────────────────────────┤
│  File: ai_prompts/stage2_instructions_v3_1.txt (v3.3)       │
│  Assistant ID: asst_y40OPW6EmLEYupot4ltRwZMT                │
│  Temperature: 0.3                                            │
│                                                               │
│  ✓ Uses Stage 0 numeric centering (direct consumption)      │
│  ✓ REALISM OVERRIDE: Auto-deduct if defects_found = 0       │
│  ✓ Category scoring with defect penalties                   │
│  ✓ Image quality caps (C→9.5, D→9.0)                        │
│  ✓ Centering thresholds (55/45→10, 60/40→9.5)              │
│  ✓ Autograph alteration logic enforcement                   │
│                                                               │
│  Scoring Weights:                                            │
│    - Structural Integrity: 30%                              │
│    - Surface Condition: 25%                                 │
│    - Centering Quality: 20%                                 │
│    - Print Quality: 15%                                     │
│    - Authenticity: 10%                                      │
│                                                               │
│  Output: {                                                   │
│    stage: "scoring",                                         │
│    version: "3.3",                                           │
│    category_scores: {...},                                  │
│    weighted_composite_score: float,                         │
│    final_grade: {                                           │
│      decimal_final_grade: float,                           │
│      whole_number_grade: int,                              │
│      grade_uncertainty: "±0.0"                             │
│    },                                                        │
│    limiting_factors: [...]                                  │
│  }                                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND VALIDATION & REALISM GUARD                         │
├─────────────────────────────────────────────────────────────┤
│  File: src/app/api/sports/[id]/route.ts                    │
│                                                               │
│  ✓ Observation count validation (≥16 required)              │
│  ✓ Autograph flag override (Stage 1 takes precedence)       │
│  ✓ Realism deduction trigger (if all pristine detected)     │
│  ✓ Score recalculation with applied deductions              │
│                                                               │
│  Triple Safety Net:                                          │
│    1. Stage 1 instructions enforce defect detection         │
│    2. Stage 2 instructions apply realism override           │
│    3. Backend validates and force-applies if needed         │
└─────────────────────────────────────────────────────────────┘
```

---

## File Inventory

### Core Backend Files

**1. Main API Route**
- **Path**: `src/app/api/sports/[id]/route.ts`
- **Version**: v3.3 integration
- **Size**: ~2000 lines
- **Purpose**: Orchestrates three-stage pipeline, validation, database operations
- **Key Changes**:
  - Stage 0 numeric centering field integration (lines 320-326)
  - Stage 1 temperature: 0.4 (line 395)
  - Stage 2 temperature: 0.3 (line 542)
  - Stage 2 prompt with numeric centering (lines 498-531)
  - Realism guard trigger (lines 599-628)
  - Observation count validation (lines 470-480)
  - Autograph override logic (lines 634-650)

**2. Stage 0 OpenCV Service - Main Processor**
- **Path**: `card_detection_service/stage0_card_detector_v3_4.py`
- **Version**: v3.4.1
- **Size**: ~430 lines
- **Purpose**: Adaptive hybrid card detection
- **Key Features**:
  - Hybrid edge detection (adaptive + standard Canny)
  - 4-8 point polygon contour selection
  - Area ratio: 30-95% (accepts product photos)
  - Border measurement with 20% sanity checks
  - Numeric centering ratios (0.XXX format)
  - Image quality grading (A-D scale)
  - Debug overlay export (env: STAGE0_DEBUG=true)

**3. Stage 0 OpenCV Service - Flask App**
- **Path**: `card_detection_service/app.py`
- **Version**: v3.4.1
- **Size**: ~270 lines
- **Purpose**: Flask REST API wrapper for card detection
- **Endpoints**:
  - `GET /health` - Service health check
  - `POST /detect-card` - Process front/back card images
  - `POST /detect-card-batch` - Batch processing

**4. Legacy Card Detector (Fallback)**
- **Path**: `card_detection_service/card_detector.py`
- **Status**: Legacy fallback
- **Purpose**: Original OpenCV detection (pre-v3.4)

**5. Old v3.1 Processor (Deprecated)**
- **Path**: `card_detection_service/card_processor_v3_1.py`
- **Version**: v3.3 (superseded by v3.4.1)
- **Status**: Replaced by stage0_card_detector_v3_4.py

### AI Prompt Files

**1. Stage 1 Observation Instructions**
- **Path**: `ai_prompts/stage1_instructions_v3_1.txt`
- **Version**: v3.3
- **Size**: 112 lines
- **Purpose**: AI observation and defect detection rules
- **Key Sections**:
  - Hard defect enforcement (lines 32-56)
  - Autograph verification rules (lines 57-69)
  - Image quality override (lines 70-76)
  - Validation requirements (lines 92-99)
  - defect_confidence_summary output (lines 106-111)

**2. Stage 2 Scoring Instructions**
- **Path**: `ai_prompts/stage2_instructions_v3_1.txt`
- **Version**: v3.3
- **Size**: 103 lines
- **Purpose**: Deterministic scoring rules
- **Key Sections**:
  - Scoring weights (lines 12-18)
  - Centering rules (lines 20-28)
  - Defect deductions (lines 30-38)
  - REALISM OVERRIDE (lines 39-46)
  - Image quality impact (lines 48-54)
  - Autograph logic enforcement (lines 56-64)
  - Uncertainty adjustment (lines 66-69)

### Frontend Files

**1. Sports Card Detail Page**
- **Path**: `src/app/sports/[id]/page.tsx`
- **Purpose**: Card detail display and grading trigger
- **Integration**: Calls `/api/sports/[id]` endpoint

**2. Upload Page**
- **Path**: `src/app/upload/sports/page.tsx`
- **Purpose**: Image upload interface
- **Features**: Front/back image upload, Supabase storage

### Configuration Files

**1. Environment Variables**
- **Path**: `.env.local`
- **Required Variables**:
  ```
  SUPABASE_URL=
  SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  OPENAI_API_KEY=
  OPENAI_STAGE1_OBSERVATION_ASSISTANT_ID=asst_OPvbB4t6JqE93d8KcvgAYUR5
  OPENAI_STAGE2_SCORING_ASSISTANT_ID=asst_y40OPW6EmLEYupot4ltRwZMT
  USE_OPENCV_V3_4=true
  STAGE0_DEBUG=false
  ```

**2. Python Requirements**
- **Path**: `card_detection_service/requirements.txt`
- **Key Dependencies**:
  - opencv-python
  - numpy
  - flask
  - flask-cors
  - requests
  - pillow

**3. Next.js Configuration**
- **Path**: `next.config.ts`
- **Relevant Settings**: API routes, image domains

### Database Schema Files

**1. Enhanced Card Fields Migration**
- **Path**: `add_enhanced_card_fields.sql`
- **Purpose**: Add Stage 0 geometry fields to database

**2. Multi-Evaluation System**
- **Path**: `add_multi_evaluation_system.sql`
- **Purpose**: Support multiple grading attempts

---

## Key Features

### Stage 0 (OpenCV v3.4.1) Improvements

1. **Hybrid Edge Detection**
   - Combines adaptive thresholding + standard Canny
   - Better detection for white-border and borderless cards
   - Union of edge maps for comprehensive coverage

2. **Flexible Contour Filtering**
   - Accepts 4-8 point polygons (not just quadrilaterals)
   - Area ratio: 30-95% (handles tight product photos)
   - Aspect ratio: 0.60-0.80 (various card types)

3. **Border Measurement Validation**
   - Sanity checks: borders must be <20% of card dimension
   - White pixel threshold validation
   - Returns N/A for borderless cards (correct behavior)

4. **Background Masking**
   - Limits detection to central 94% of frame
   - Prevents frame edges from false detection

5. **Numeric Centering Ratios**
   - Direct float values (0.50, 0.53, etc.)
   - No text parsing required by Stage 2
   - Backward compatible with text format

6. **Image Quality Grading**
   - Combines focus, edge density, brightness
   - A/B/C/D scale with reshoot flags
   - Caps final grade appropriately

### Stage 1 (AI v3.3) Improvements

1. **Hard Defect Enforcement**
   - Minimum 16 observations required
   - At least 1 defect unless all verified pristine
   - Corner-by-corner, edge-by-edge inspection

2. **Autograph Verification Logic**
   - Only marks present if handwriting detected
   - Logos/holograms do NOT count as autographs
   - Authentication marker requirement

3. **defect_confidence_summary**
   - Tracks defects_found count
   - Used by Stage 2 and backend for realism guard

4. **Temperature 0.4**
   - Allows variance for texture detection
   - Prevents over-deterministic pristine assumptions

### Stage 2 (AI v3.3) Improvements

1. **Direct Stage 0 Numeric Consumption**
   - Uses float values directly from Stage 0
   - No text parsing errors
   - Accurate centering math

2. **REALISM OVERRIDE**
   - Auto-deducts if defects_found = 0
   - Structural: -0.3, Surface: -0.3, Centering: -0.2
   - Ensures physical variance reflection

3. **Scoring Weights**
   - Structural Integrity: 30%
   - Surface Condition: 25%
   - Centering Quality: 20%
   - Print Quality: 15%
   - Authenticity: 10%

4. **Image Quality Caps**
   - Grade A: cap 10, ±0.0 uncertainty
   - Grade B: cap 9.8, ±0.0 uncertainty
   - Grade C: cap 9.5, ±0.5 uncertainty
   - Grade D: cap 9.0, ±1.0 uncertainty

5. **Temperature 0.3**
   - Slight variance for realistic scoring
   - Prevents perfect 10s without justification

### Backend (route.ts v3.3) Improvements

1. **Observation Count Validation**
   - Returns 422 error if <16 observations
   - Forces Stage 1 compliance

2. **Autograph Override Logic**
   - Stage 1 takes precedence over Stage 2
   - Prevents false alteration flags

3. **Realism Guard Trigger**
   - Backend enforces realism deductions
   - Triple safety net with AI stages
   - Keyword detection + defects_found check

4. **Score Recalculation**
   - Applies deductions post-Stage 2
   - Updates composite score
   - Maintains consistency

---

## Configuration

### OpenAI Assistant Setup

**Stage 1 Observation Assistant**
- **ID**: `asst_OPvbB4t6JqE93d8KcvgAYUR5`
- **Name**: DCM Stage 1 - Observation v3.3
- **Model**: gpt-4-vision-preview (or latest)
- **Instructions**: Copy from `ai_prompts/stage1_instructions_v3_1.txt`
- **Temperature**: Set via API call (0.4)
- **Tools**: Vision enabled

**Stage 2 Scoring Assistant**
- **ID**: `asst_y40OPW6EmLEYupot4ltRwZMT`
- **Name**: DCM Stage 2 - Scoring v3.3
- **Model**: gpt-4-turbo (or latest)
- **Instructions**: Copy from `ai_prompts/stage2_instructions_v3_1.txt`
- **Temperature**: Set via API call (0.3)
- **Tools**: None required

### OpenCV Service Setup

**Python Environment**
```bash
cd card_detection_service
"C:\Users\benja\AppData\Local\Programs\Python\Python313\python.exe" -m pip install -r requirements.txt
```

**Start Service**
```bash
cd card_detection_service
"C:\Users\benja\AppData\Local\Programs\Python\Python313\python.exe" app.py
```

**Service runs on**: http://localhost:5001

**Health Check**: `curl http://localhost:5001/health`

### Next.js Application Setup

**Install Dependencies**
```bash
npm install
```

**Run Development Server**
```bash
npm run dev
```

**Application runs on**: http://localhost:3000

---

## Restoration Steps

### Full System Restoration from Backup

If you need to revert to this v3.4.1 system:

#### Step 1: Restore Core Files

```bash
# Restore Stage 0 OpenCV files
cp BACKUP/card_detection_service/stage0_card_detector_v3_4.py card_detection_service/
cp BACKUP/card_detection_service/app.py card_detection_service/

# Restore AI prompt files
cp BACKUP/ai_prompts/stage1_instructions_v3_1.txt ai_prompts/
cp BACKUP/ai_prompts/stage2_instructions_v3_1.txt ai_prompts/

# Restore API route
cp BACKUP/src/app/api/sports/[id]/route.ts src/app/api/sports/[id]/
```

#### Step 2: Restore OpenAI Assistants

**Update Stage 1 Assistant**
```bash
# Use OpenAI API or dashboard
# Assistant ID: asst_OPvbB4t6JqE93d8KcvgAYUR5
# Instructions: Copy from ai_prompts/stage1_instructions_v3_1.txt (v3.3)
```

**Update Stage 2 Assistant**
```bash
# Use OpenAI API or dashboard
# Assistant ID: asst_y40OPW6EmLEYupot4ltRwZMT
# Instructions: Copy from ai_prompts/stage2_instructions_v3_1.txt (v3.3)
```

#### Step 3: Verify Configuration

**.env.local**
```
USE_OPENCV_V3_4=true
OPENAI_STAGE1_OBSERVATION_ASSISTANT_ID=asst_OPvbB4t6JqE93d8KcvgAYUR5
OPENAI_STAGE2_SCORING_ASSISTANT_ID=asst_y40OPW6EmLEYupot4ltRwZMT
```

#### Step 4: Restart Services

**Terminal 1: OpenCV Service**
```bash
cd card_detection_service
"C:\Users\benja\AppData\Local\Programs\Python\Python313\python.exe" app.py
```

**Terminal 2: Next.js Application**
```bash
npm run dev
```

#### Step 5: Verify System Health

**OpenCV Service**
```bash
curl http://localhost:5001/health
# Expected: {"version": "3.4.1", "processor": "v3.4.1 adaptive hybrid", ...}
```

**Test Card Grading**
1. Navigate to http://localhost:3000/upload/sports
2. Upload front/back images
3. Trigger grading
4. Check console logs for:
   - `[v3.4.1] SUCCESS: Selected contour`
   - `[TWO-STAGE-v3.1] ✅ Using v3.1 hybrid detection`
   - Stage 1 version: "3.3"
   - Stage 2 version: "3.3"

---

## Known Issues & Limitations

### Stage 0 (OpenCV)

1. **Borderless Cards**
   - Modern full-bleed cards have no white borders
   - Border measurements return N/A (expected)
   - Centering uses "design-anchor" type
   - AI stages handle centering via visual cues

2. **Tight Product Photos**
   - Cards filling >95% of frame may be rejected
   - Adjust MAX_RATIO if needed (currently 95%)
   - Professional product photos work well at 88-92%

3. **Unicode Logging Issues**
   - Windows console doesn't support emoji
   - All emojis removed from logging
   - Use ASCII-only messages

4. **Image Quality**
   - C/D grades cap final score
   - Reshoot recommendations for C/D
   - Low lighting causes dark images (brightness <10)

### Stage 1 (AI Observation)

1. **Temperature 0.4**
   - Allows variance (good for defect detection)
   - May produce slightly different observations per run
   - Defect count usually consistent

2. **Observation Count**
   - Hard requirement: ≥16 observations
   - Backend validates and rejects if insufficient
   - Rarely an issue with v3.3 instructions

3. **Autograph Detection**
   - Conservative (requires visible handwriting)
   - May miss faded autographs
   - Logos/holograms correctly excluded

### Stage 2 (AI Scoring)

1. **Realism Guard**
   - Triple enforcement may be overly aggressive
   - Always deducts if defects_found = 0
   - Physical cards truly can be near-perfect

2. **Numeric Centering**
   - Requires Stage 0 numeric fields
   - Falls back to 0.50 if unavailable
   - Design-anchor cards default to 50/50

3. **Temperature 0.3**
   - Low variance for consistency
   - Grades usually within ±0.1 on re-run
   - Some randomness remains

### Backend (route.ts)

1. **Error Handling**
   - OpenCV service failures fall back to design-anchor
   - AI failures return generic error messages
   - Retry logic: 2 attempts per stage

2. **Performance**
   - Full grading takes 30-60 seconds
   - OpenCV: 2-3 seconds
   - Stage 1: 15-30 seconds
   - Stage 2: 10-20 seconds

3. **Caching**
   - Signed URLs cached in memory
   - Results not cached (always fresh grade)

---

## Version History

### v3.4.1 (October 7, 2025) - Current
- Fixed Unicode console errors (removed emojis)
- Raised MAX_RATIO to 95% (accept product photos)
- Enhanced debug logging
- Border sanity checks (20% limit)
- Background masking (3% margin)

### v3.4 (October 7, 2025)
- Initial adaptive hybrid processor
- Quadrilateral detection (4-point only)
- Border measurement with mm conversion
- Debug overlay export

### v3.3 (October 3, 2025)
- AI prompt updates (Stage 1 & 2)
- Hard defect enforcement
- REALISM OVERRIDE
- Temperature tuning (0.4/0.3)
- defect_confidence_summary
- Backend realism guard trigger

### v3.2 (October 2, 2025)
- Numeric centering ratios
- Reshoot detection
- Stage 2 numeric consumption

### v3.1 (September 25, 2025)
- Hybrid OpenCV processor
- Design-anchor centering
- Image quality grading
- CLAHE enhancement

---

## Backup Checklist

Before starting new development, ensure you have:

- ✅ This documentation file saved
- ✅ Copy of `stage0_card_detector_v3_4.py`
- ✅ Copy of `app.py` (v3.4.1)
- ✅ Copy of `route.ts` with v3.3 integration
- ✅ Copy of `stage1_instructions_v3_1.txt` (v3.3)
- ✅ Copy of `stage2_instructions_v3_1.txt` (v3.3)
- ✅ Screenshot of OpenAI assistant configurations
- ✅ Copy of `.env.local` with working assistant IDs
- ✅ Database schema backup (if modified)
- ✅ Git commit of current working state

---

## Support & Troubleshooting

### Common Issues

**OpenCV Service Won't Start**
- Check Python path: `where python`
- Install requirements: `pip install -r requirements.txt`
- Check port 5001 availability: `netstat -ano | findstr :5001`

**Card Detection Failing**
- Check service health: `curl http://localhost:5001/health`
- Review logs for contour rejection reasons
- Verify image URLs are accessible
- Check MAX_RATIO setting (should be 95%)

**AI Stages Returning Errors**
- Verify assistant IDs in `.env.local`
- Check OpenAI API key validity
- Review temperature settings (0.4, 0.3)
- Ensure instructions match v3.3 format

**Grades Always 10/10**
- Check defect_confidence_summary in Stage 1 output
- Verify REALISM OVERRIDE in Stage 2 instructions
- Check backend realism guard trigger logs
- Temperature may be too low (should be 0.4/0.3)

**Backend Validation Errors**
- Check observation count (should be ≥16)
- Verify Stage 1 output includes all required fields
- Check autograph override logic execution

---

## Contact & Notes

**System Architect**: Claude (Anthropic)
**Implementation Period**: September-October 2025
**Platform**: Next.js 14 + Python Flask + OpenAI Assistants API
**Status**: Production-ready, fully tested

**Final Notes**:
- This system represents 3+ weeks of iterative development
- All major edge cases addressed (borderless cards, product photos, etc.)
- Triple safety net ensures realistic grading (no automatic 10s)
- Designed for modern sports cards with full-bleed designs
- Extensible architecture for future card types (Pokemon, Magic, etc.)

---

**End of Backup Documentation**
