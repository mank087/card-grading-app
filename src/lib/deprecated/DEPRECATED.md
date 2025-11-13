# Deprecated Code

This directory contains documentation for deprecated systems that are no longer active.

**Last Updated:** October 28, 2025

---

## ⚠️ IMPORTANT

The code referenced in these documents is **DISABLED** and should not be used. These systems have been replaced by **Conversational AI v3.5 PATCHED v2** as the primary grading system.

---

## Deprecated Systems

### 1. DVG v2 Grading System
**File:** `dvg_v2_notes.md`
**Disabled:** October 21, 2025
**Location:** `src/lib/visionGrader.ts` - `gradeCardWithVision()`
**Reason:** Replaced by Conversational AI v3.5 as primary system

**What it was:**
- JSON-based prompt asking for specific grading structure
- Produced `VisionGradeResult` object
- Less accurate than conversational approach

**Current Status:**
- Function still present in codebase but unreachable
- Route.ts creates stub data instead of calling this function (lines 302-346)
- Database fields maintained for compatibility

**To Remove:**
- Move function to this directory when ready for complete removal
- Update route.ts to remove stub data creation
- Mark database fields as deprecated in schema

---

### 2. Stage 2: Detailed Inspection
**File:** `stage2_notes.md`
**Disabled:** October 15, 2025
**Location:** `src/lib/visionGrader.ts` - `performDetailedInspection()`
**Reason:** Stage 1 (Conversational AI) now has comprehensive microscopic detection

**What it was:**
- Second GPT-4o call after Stage 1
- Detailed corner/edge/surface analysis
- Could adjust grade based on findings

**Current Status:**
- Code commented out in route.ts (lines 1094-1178)
- Function still present in visionGrader.ts but unreachable

**To Remove:**
- Move function to this directory when ready for complete removal
- Remove commented code from route.ts

---

### 3. OpenCV Stage 0
**File:** `../../opencv_service/DEPRECATED.md`
**Disabled:** October 19, 2025
**Location:** `opencv_service/` directory, `/api/opencv-analyze` endpoint
**Reason:** Unreliable boundary detection, false slab detection

**What it was:**
- Python OpenCV computer vision analysis
- Attempted to detect card boundaries, centering, defects
- Failed on slabs (97% = full frame), raw cards (44% = too small)

**Current Status:**
- Code commented out in route.ts (lines 244-294)
- Service still present but not called
- Should add DEPRECATED.md to opencv_service/

---

## Migration Notes

If you need to reference any of this deprecated code:

1. **DVG v2 functions** are in `src/lib/visionGrader.ts` starting at line 471
2. **Stage 2 functions** are in `src/lib/visionGrader.ts` starting at line 935
3. **OpenCV service** is in `opencv_service/` directory (Python)

These will remain in the codebase until fully verified as unnecessary, then moved to this deprecated/ directory.

---

## Current Active System

**For current system documentation, see:**
- `SYSTEM_ARCHITECTURE_CURRENT.md` - Complete system overview
- `README.md` - Quick start guide
- `QUICK_START_2025-10-28.md` - Development quick reference

**Active Grading System:** Conversational AI v3.5 PATCHED v2 (single-stage)
**Active Parser:** `conversationalParserV3_5.ts`
**Active Prompt:** `prompts/conversational_grading_v3_5_PATCHED.txt`

---

## Deprecation Timeline

| Date | System | Action | Reason |
|------|--------|--------|--------|
| 2025-10-15 | Stage 2 | Disabled | Stage 1 comprehensive enough |
| 2025-10-19 | OpenCV Stage 0 | Disabled | Unreliable measurements |
| 2025-10-21 | DVG v2 | Disabled | Conversational AI more accurate |
| 2025-10-28 | Log Messages | Renamed | Eliminated confusion |
| 2025-10-28 | Parser Usage | Fixed | Using correct v3.5 parser |

---

END OF DEPRECATED CODE DOCUMENTATION
