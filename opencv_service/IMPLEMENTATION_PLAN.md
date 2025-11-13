# OpenCV Stage 0 Implementation Plan

**Date:** 2025-10-16
**Status:** Phase 0 - Research & Validation

---

## Overview

Implementing OpenCV Stage 0 to provide objective, pixel-level measurements for card grading, replacing LLM-based "guessing" with quantitative data.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ NEW GRADING PIPELINE                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. User uploads card images (front + back)                 │
│    ↓                                                        │
│ 2. Next.js API receives images                             │
│    ↓                                                        │
│ 3. STAGE 0: OpenCV Analysis (NEW)                          │
│    - Python service analyzes images                         │
│    - Detects card boundaries                                │
│    - Perspective correction (deskew)                        │
│    - Measures centering (pixel-perfect)                     │
│    - Detects edge whitening (color ΔE)                      │
│    - Measures corner rounding/whitening                     │
│    - Detects surface defects (dots, scratches, creases)     │
│    - Generates glare mask                                   │
│    - Returns JSON metrics + normalized images               │
│    ↓                                                        │
│ 4. STAGE 1: LLM Interpretation (MODIFIED)                   │
│    - Receives OpenCV metrics + normalized images            │
│    - Interprets metrics using grading standards             │
│    - Applies grade caps for structural damage               │
│    - Generates professional assessment                      │
│    - Returns final DCM grade                                │
│    ↓                                                        │
│ 5. STAGE 3: Professional Estimates (UNCHANGED)              │
│    - Converts DCM grade to PSA/BGS/SGC/CGC                  │
│    ↓                                                        │
│ 6. Save to database & return to user                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### **Phase 0: Research & Validation (CURRENT - 2-3 days)**

**Goal:** Prove OpenCV can detect what we need with acceptable accuracy

**Tasks:**
- [x] Backup current system
- [x] Review ChatGPT's OpenCV implementation
- [x] Move OpenCV files to project
- [ ] Set up Python environment
- [ ] Test card detection on 10-20 sample images
- [ ] Validate centering measurement accuracy
- [ ] Validate edge whitening detection
- [ ] Validate corner analysis
- [ ] Test glare masking effectiveness
- [ ] Document accuracy metrics

**Success Criteria:**
- Card detection: >95% success rate
- Centering: ±2% accuracy vs manual measurement
- Edge whitening: Detects defects LLM currently misses
- Corner analysis: Distinguishes 9.5 vs 10.0 corners
- Glare masking: Reduces false positives

**Decision Point:** If accuracy < 90%, reassess approach before Phase 1

---

### **Phase 1: Core Integration (3-4 days)**

**Goal:** Integrate OpenCV service into Next.js backend

**Tasks:**
1. **Create Python API Service**
   - Create Flask/FastAPI wrapper around card_cv_stage1.py
   - Endpoint: POST /analyze with multipart/form-data
   - Accept front/back images
   - Return JSON metrics
   - Handle errors gracefully

2. **Create Next.js API Endpoint**
   - File: `src/app/api/opencv-analyze/route.ts`
   - Accepts image uploads
   - Saves temp files
   - Calls Python service
   - Returns OpenCV metrics

3. **Modify Vision-Grade Route**
   - File: `src/app/api/vision-grade/[id]/route.ts`
   - Call opencv-analyze endpoint first
   - Store OpenCV metrics
   - Pass metrics + images to LLM

4. **Database Schema Update**
   - Add `opencv_metrics` JSONB column to `cards` table
   - Store raw OpenCV output for debugging

**Deliverables:**
- Working Python service (standalone)
- Working Next.js endpoint (tested with Postman)
- Integrated grading pipeline (E2E test)

---

### **Phase 2: LLM Integration (2-3 days)**

**Goal:** Update Stage 1 prompt to use OpenCV metrics

**Tasks:**
1. **Simplify Stage 1 Prompt**
   - Remove defect detection instructions
   - Remove centering measurement instructions
   - Add metric interpretation instructions
   - Reduce from 4,816 lines → ~2,500 lines

2. **Update Prompt Structure**
   ```
   OLD PROMPT:
   "Examine all 8 corners for whitening. Count defects explicitly.
    Measure centering by estimating border ratios..."

   NEW PROMPT:
   "You will receive OpenCV metrics:
    - centering_front_lr: 53.2/46.8
    - corner_whitening_count: 2
    - edge_whitening_length_mm: 1.2

    Interpret these metrics using DCM grading standards.
    Apply grade caps for structural damage.
    Generate final grade."
   ```

3. **Test Metric Interpretation**
   - Verify LLM correctly interprets OpenCV data
   - Ensure grade caps still apply
   - Test edge cases (N/A grades, creases, etc.)

4. **Update Frontend Display**
   - Show OpenCV metrics on card detail page
   - Display defect heatmaps (overlay images)
   - Add transparency: "Grade based on: centering 56.8/43.2"

**Deliverables:**
- Simplified prompt (tested)
- Updated frontend (displays metrics)
- E2E grading test (images → OpenCV → LLM → grade)

---

### **Phase 3: Calibration & Testing (2-3 days)**

**Goal:** Validate accuracy vs known grades and tune thresholds

**Tasks:**
1. **Collect Test Dataset**
   - 50-100 cards with known PSA/BGS grades
   - Mix of grades: 10.0 (pristine), 9.5 (gem), 9.0 (mint), 8.5-8.0 (NM)
   - Include edge cases: creases, alterations, sleeves

2. **Run A/B Comparison**
   - Old system (LLM-only) vs New system (OpenCV + LLM)
   - Compare grades for same cards
   - Document discrepancies

3. **Tune OpenCV Thresholds**
   - **Centering:** Already pixel-perfect, no tuning needed
   - **Edge whitening:** Adjust `delta_e_thresh` (default: 8.0)
     - Too low → false positives (glare detected as whitening)
     - Too high → false negatives (real whitening missed)
   - **Corner rounding:** Adjust `patch_size` and radius interpretation
   - **Surface defects:** Tune `min_area`, `max_area` for white dots
   - **Glare masking:** Tune `sat_thresh` and `val_thresh`

4. **Validate Grade Distribution**
   - 10.0: <1% of all cards (1 in 100-200)
   - 9.5: 5-10% (gem mint)
   - 9.0: 20-30% (mint)
   - 8.5-8.0: 15-20% each
   - Lower: Remaining distribution

5. **Measure Accuracy**
   - Correlation with PSA/BGS: Target >85% within ±0.5 grades
   - 9.5 vs 10.0 distinction: Target >90% accuracy
   - Crease detection: 100% accuracy (hard-stop condition)

**Success Criteria:**
- Grade distribution matches statistical reality
- 10.0 grades drop from "nearly all" to <1%
- Agreement with professional grading >85%

---

## Technical Stack

### **Python Service**
- **Language:** Python 3.10+
- **Libraries:**
  - OpenCV (cv2): Image processing
  - NumPy: Numerical operations
  - Flask/FastAPI: HTTP server (to be added)

### **Next.js Integration**
- **Endpoint:** `src/app/api/opencv-analyze/route.ts`
- **Method:** POST multipart/form-data
- **Response:** JSON metrics

### **Communication**
- **Option 1:** HTTP (Python Flask/FastAPI service on localhost:5000)
- **Option 2:** Child process (spawn Python from Node.js)
- **Recommendation:** Option 1 (cleaner separation, easier debugging)

---

## File Structure

```
card-grading-app/
├── opencv_service/
│   ├── card_cv_stage1.py          # Core OpenCV logic
│   ├── api_server.py              # Flask/FastAPI wrapper (to create)
│   ├── requirements.txt           # Python dependencies
│   ├── README.md                  # Usage instructions
│   └── IMPLEMENTATION_PLAN.md     # This file
│
├── src/app/api/
│   ├── opencv-analyze/
│   │   └── route.ts               # Next.js endpoint (to create)
│   └── vision-grade/[id]/
│       └── route.ts               # Modified to call OpenCV first
│
├── prompts/
│   └── card_grader_v1_simplified.txt  # New simplified prompt (to create)
│
└── backup_before_opencv_stage0_2025-10-16_161549/
    ├── card_grader_v1.txt         # Backup of current prompt
    ├── vision-grade-route.ts      # Backup of current route
    └── README.md                  # Backup documentation
```

---

## Expected Metrics Output (Example)

```json
{
  "version": "stage1_opencv_v1.0",
  "run_id": "uuid-here",
  "front": {
    "side_label": "front",
    "width": 1066,
    "height": 1600,
    "centering": {
      "lr_ratio": [53.2, 46.8],
      "tb_ratio": [48.7, 51.3],
      "left_border_mean_px": 42.3,
      "right_border_mean_px": 37.2,
      "top_border_mean_px": 38.9,
      "bottom_border_mean_px": 40.8
    },
    "edge_segments": {
      "top": [
        {"segment_name": "top_1", "whitening_length_px": 0.0, "whitening_count": 0, "chips_count": 0, "white_dots_count": 0},
        {"segment_name": "top_2", "whitening_length_px": 0.0, "whitening_count": 0, "chips_count": 0, "white_dots_count": 0},
        {"segment_name": "top_3", "whitening_length_px": 0.0, "whitening_count": 0, "chips_count": 0, "white_dots_count": 0}
      ],
      "bottom": [
        {"segment_name": "bottom_1", "whitening_length_px": 2.4, "whitening_count": 18, "chips_count": 1, "white_dots_count": 2},
        {"segment_name": "bottom_2", "whitening_length_px": 1.8, "whitening_count": 14, "chips_count": 1, "white_dots_count": 1},
        {"segment_name": "bottom_3", "whitening_length_px": 0.0, "whitening_count": 0, "chips_count": 0, "white_dots_count": 0}
      ],
      "left": [...],
      "right": [...]
    },
    "corners": [
      {"corner_name": "tl", "rounding_radius_px": 2.1, "whitening_length_px": 0.0, "white_dots_count": 0},
      {"corner_name": "tr", "rounding_radius_px": 2.3, "whitening_length_px": 4.2, "white_dots_count": 1},
      {"corner_name": "bl", "rounding_radius_px": 2.0, "whitening_length_px": 0.0, "white_dots_count": 0},
      {"corner_name": "br", "rounding_radius_px": 2.5, "whitening_length_px": 3.8, "white_dots_count": 1}
    ],
    "surface": {
      "white_dots_count": 2,
      "scratch_count": 0,
      "crease_like_count": 0,
      "glare_coverage_percent": 7.8,
      "focus_variance": 285.6,
      "lighting_uniformity_score": 0.91,
      "color_bias_bgr": [128.4, 132.1, 130.7]
    },
    "sleeve_indicator": false,
    "top_loader_indicator": false,
    "slab_indicator": false,
    "glare_mask_percent": 7.8,
    "obstructions": [],
    "debug_assets": {
      "normalized_image": "./out/front_normalized.png",
      "glare_mask": "./out/front_glare_mask.png",
      "overlay": "./out/front_overlay.png",
      "card_mask": "./out/front_card_mask.png"
    }
  },
  "back": {
    ...
  }
}
```

---

## Risk Mitigation

### **Risk 1: OpenCV doesn't improve accuracy**
**Mitigation:** Phase 0 validation with go/no-go decision point
**Rollback:** Restore from backup_before_opencv_stage0_2025-10-16_161549/

### **Risk 2: Python integration adds complexity**
**Mitigation:** Use simple HTTP API, containerize if needed
**Fallback:** Keep LLM-only system as backup

### **Risk 3: False positives from glare**
**Mitigation:** Glare masking + threshold tuning in Phase 3
**Solution:** Exclude glare-covered areas from defect detection

### **Risk 4: Calibration takes longer than expected**
**Mitigation:** Start with conservative thresholds, tune incrementally
**Buffer:** Allow extra 2-3 days in timeline

---

## Success Metrics

### **Quantitative:**
- 10.0 grades: <1% of all cards (down from current ~80%+)
- 9.5 grades: 5-10%
- 9.0 grades: 20-30%
- Centering accuracy: ±1% vs manual measurement
- Correlation with PSA/BGS: >85% within ±0.5 grades

### **Qualitative:**
- Users see transparent, quantitative evidence
- Grades feel consistent and defensible
- System is easier to debug and improve
- Prompt is simpler and more maintainable

---

## Timeline

**Total: 10-14 days**

- **Phase 0:** 2-3 days (Research & Validation)
- **Phase 1:** 3-4 days (Core Integration)
- **Phase 2:** 2-3 days (LLM Integration)
- **Phase 3:** 2-3 days (Calibration & Testing)
- **Buffer:** 1-2 days (Unexpected issues)

---

## Next Steps (Immediate)

1. ✅ Backup current system
2. ✅ Review ChatGPT's OpenCV code
3. ✅ Move files to opencv_service/
4. ⏳ Set up Python environment
5. ⏳ Test card detection on sample images
6. ⏳ Validate OpenCV accuracy
7. ⏳ Proceed to Phase 1 if validation succeeds

---

**Document Version:** 1.0
**Last Updated:** 2025-10-16 16:15
**Status:** Phase 0 in progress
