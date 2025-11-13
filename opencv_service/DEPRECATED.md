# OpenCV Stage 0 Service (DEPRECATED)

**Status:** ⏸️ DISABLED since October 19, 2025
**Replaced By:** GPT-4o Vision for all visual analysis

---

## ⚠️ DO NOT USE THIS SERVICE

This OpenCV-based computer vision service has been disabled due to unreliable results. GPT-4o Vision now handles all visual analysis tasks.

---

## Overview

OpenCV Stage 0 was a Python-based computer vision service that attempted to:
- Detect card boundaries
- Measure centering ratios
- Detect edge defects (whitening)
- Detect corner wear
- Identify if card was in a slab

---

## Why It Was Disabled

### 1. Unreliable Boundary Detection
**Problem:** Boundary detection failed on both raw cards and slabbed cards

**Examples:**
- Slabbed cards: Detected 97% card coverage → treated entire image as card (included slab borders)
- Raw cards: Detected 44% card coverage → thought card was too small
- Failed to distinguish card edge from holder edge

**Impact:** All subsequent measurements (centering, edges, corners) were invalid when boundaries wrong

### 2. False Slab Detection
**Problem:** Detected slabs when there were none, or missed real slabs

**Examples:**
- One-touch magnetic holders detected as "slab"
- PSA slabs sometimes detected as "no slab"
- Inconsistent results on same card

### 3. Inaccurate Centering Measurements
**Problem:** Reported centering ratios that contradicted visual inspection

**Examples:**
- Card with good centering: 25.3/74.7 (way off center)
- Card with poor centering: 50.0/50.0 (perfect)
- Measurements changed when same card re-uploaded

**Root Cause:** Boundary detection errors propagated to centering calculations

### 4. Edge/Corner Measurements Invalid
**Problem:** Edge whitening and corner wear measurements were unreliable

**Why:** Measurements depended on correct boundary detection, which was failing

### 5. GPT-4o Vision Superior
**Reality:** GPT-4o Vision can:
- Accurately assess centering visually (no pixel counting needed)
- Detect card boundaries regardless of holder type
- Identify slabs, one-touch cases, top-loaders correctly
- Measure defects in context (AI understands what's significant)

---

## Technical Details

### Service Location
- **Directory:** `opencv_service/`
- **Main Script:** `opencv_service/app.py` (Flask API server)
- **Dependencies:** OpenCV (cv2), NumPy, Flask

### API Endpoint
- **URL:** `/api/opencv-analyze` (Next.js API route)
- **Location:** `src/app/api/opencv-analyze/route.ts` (if exists)
- **Status:** ⏸️ Should be commented out or removed

### Function in Route.ts
**Lines 244-294:** OpenCV Stage 0 block commented out

```typescript
// DISABLED 2025-10-19: OpenCV boundary detection unreliable
// OpenCV was causing more problems than it solved:
// - False slab detection on raw cards
// - Wrong boundary detection (97% = full frame, 44% = too small)
// - Inaccurate centering measurements (25.3/74.7 on good cards)
// - Edge/corner/surface measurements invalid when boundaries wrong
// Decision: Use GPT-4o Vision only - it can assess everything visually and reliably
/*
console.log(`[OpenCV Stage 0] Starting OpenCV analysis...`);
let opencvMetrics: any = null;

try {
  const opencvResponse = await fetch(`${request.nextUrl.origin}/api/opencv-analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frontUrl, backUrl })
  });
  // ... rest of OpenCV logic
} catch (opencvError: any) {
  console.warn(`[OpenCV Stage 0] Analysis failed, continuing with LLM-only grading:`, opencvError.message);
}
*/
```

### Database Field
- `opencv_metrics` (JSONB) - Set to NULL for all new cards

---

## What OpenCV Stage 0 Did (When It Worked)

### 1. Boundary Detection
Attempted to find card edges using:
- Canny edge detection
- Contour finding
- Rectangle fitting

### 2. Centering Measurement
Calculated pixel ratios:
- Left-Right: left_border_width / right_border_width
- Top-Bottom: top_border_height / bottom_border_height

### 3. Slab Detection
Looked for:
- Large rectangular contours outside card boundary
- Text patterns (PSA, BGS, etc.)
- Specific color profiles

### 4. Edge Defect Detection
Scanned edge pixels for:
- Whitening (brightness increase)
- Roughness (edge irregularity)

### 5. Corner Wear Detection
Analyzed corner regions for:
- Rounding (deviation from 90° angle)
- Whitening
- Fraying

---

## Current Status

### In Route.ts
- ✅ OpenCV Stage 0 code commented out (lines 244-294)
- ✅ Database field `opencv_metrics` set to NULL

### In Service Directory
- ⏸️ Service code still present in `opencv_service/` directory
- ⏸️ Flask server not running (not called)
- 📝 **TO DO:** Add this DEPRECATED.md file to directory (✅ DONE)

### In Database
- `opencv_metrics` (JSONB) - NULL for all new cards
- Old cards may still have OpenCV data (ignored by frontend)

---

## Migration Path

### Short Term (Current)
- ✅ Code commented out in route.ts
- ✅ Service not called
- ✅ DEPRECATED.md added to opencv_service/

### Medium Term
1. Monitor for 3-6 months to ensure no one needs OpenCV data
2. Verify GPT-4o Vision provides sufficient boundary/centering analysis

### Long Term (Future Cleanup)
1. Delete `opencv_service/` directory entirely
2. Remove `/api/opencv-analyze` endpoint (if it exists)
3. Add database migration to drop `opencv_metrics` column
4. Remove OpenCV-related dependencies from package.json (if any)

---

## Alternative: If OpenCV Needed in Future

If boundary detection is truly needed (e.g., for automated cropping):

### Option 1: Improve OpenCV Algorithm
- Use ML-based boundary detection (YOLO, Detectron2)
- Train custom model on card images
- Handle various card holders (one-touch, slab, top-loader)

### Option 2: Use GPT-4o Vision for Boundaries
- Ask AI to describe card boundaries
- Extract bounding box coordinates from description
- More reliable than traditional computer vision

### Option 3: Hybrid Approach
- GPT-4o Vision validates OpenCV boundaries
- Only use OpenCV if AI confirms accuracy
- Fallback to AI-only if boundaries look wrong

**Current Decision:** GPT-4o Vision alone is sufficient for grading purposes.

---

## Lessons Learned

1. **Computer vision is hard** - Especially with variable lighting and holders
2. **AI vision > traditional CV for complex tasks** - GPT-4o understands context
3. **Pixel-perfect measurements not needed for grading** - Visual assessment sufficient
4. **Simpler is better** - One API call (GPT-4o) > complex pipeline (OpenCV + GPT-4o)

---

## For Reference: OpenCV Service Files

```
opencv_service/
├── app.py                  # Flask API server
├── card_cv.py              # Main OpenCV logic
├── requirements.txt        # Python dependencies
├── DEPRECATED.md           # This file
└── README.md               # Original setup instructions (outdated)
```

**Dependencies:**
- opencv-python (cv2)
- numpy
- flask
- flask-cors
- pillow

**API Format:**
```json
// Request
{
  "frontUrl": "https://...",
  "backUrl": "https://..."
}

// Response
{
  "front": {
    "boundary": { "x": 0, "y": 0, "width": 0, "height": 0, "card_coverage_pct": 0 },
    "centering": { "lr_ratio": "50.0/50.0", "tb_ratio": "50.0/50.0" },
    "edge_segments": {...},
    "corner_wear": {...}
  },
  "back": {...},
  "slab_detected": false
}
```

---

## Related Documentation

- `SYSTEM_ARCHITECTURE_CURRENT.md` - Current active system (no OpenCV)
- `../src/lib/deprecated/dvg_v2_notes.md` - DVG v2 grading system (also deprecated)
- `../src/lib/deprecated/stage2_notes.md` - Stage 2 detailed inspection (also deprecated)

---

**Last Updated:** October 28, 2025
**Review Status:** Ready for deletion after 3-6 months validation period

---

END OF OPENCV STAGE 0 DEPRECATION NOTICE
