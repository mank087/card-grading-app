# DVG v2 Grading System (DEPRECATED)

**Status:** ⏸️ DISABLED since October 21, 2025
**Replaced By:** Conversational AI v3.5 PATCHED v2

---

## Overview

DVG v2 (Direct Vision Grader v2) was a JSON-based grading system that used a structured prompt to extract specific grading data.

**Key Characteristics:**
- Single GPT-4o Vision API call
- Structured JSON response format
- Produced `VisionGradeResult` object
- Less accurate than conversational approach

---

## Why It Was Disabled

### 1. Accuracy Issues
- JSON format constrained AI's ability to explain reasoning
- Missed nuanced defects that conversational format catches
- Less reliable sub-score calculations

### 2. Conversational AI Superior Performance
- Natural language format allows better reasoning
- More detailed observations
- Higher accuracy on grade determination
- Better detection of edge cases (surface alteration, image quality issues)

### 3. Maintenance Burden
- Two grading systems created confusion
- JSON schema had to be kept in sync with prompt
- Parsing errors when AI deviated from schema

---

## Technical Details

### Function Signature
```typescript
export async function gradeCardWithVision(
  frontUrl: string,
  backUrl: string,
  options?: {
    model?: string;
    temperature?: number;
    includeOpenCV?: boolean;
    opencvMetrics?: any;
  }
): Promise<VisionGradeResult>
```

### Location
- **File:** `src/lib/visionGrader.ts`
- **Line:** 471 (as of Oct 28, 2025)

### Dependencies
- OpenAI GPT-4o Vision API
- `VisionGradeResult` type (exported from same file)

### Output Structure
```typescript
interface VisionGradeResult {
  recommended_grade: {
    recommended_decimal_grade: number | null;
    recommended_whole_grade: number | null;
    grade_uncertainty: string;
    grading_notes: string;
  };
  card_info: CardInfo;
  centering: CenteringRatios;
  defects: DefectsList;
  sub_scores: SubScores;
  image_quality: ImageQuality;
  analysis_summary: AnalysisSummary;
  autograph: AutographDetection;
  slab_detection: SlabDetection;
  rarity_features: RarityFeatures;
  card_text_blocks: CardTextBlock[];
  grading_status: string;
  meta: MetaInfo;
}
```

---

## Current Status

### In Route.ts
**Lines 296-346:** Creates stub `VisionGradeResult` instead of calling `gradeCardWithVision()`

```typescript
// ⏸️ TEMPORARILY DISABLED (2025-10-21): DVG v2 grading disabled for testing
console.log(`[CONVERSATIONAL AI] ⏸️ DVG v2 grading DISABLED - using conversational AI only`);

// Create stub visionResult to maintain code flow
const visionResult: VisionGradeResult = {
  recommended_grade: {
    recommended_decimal_grade: null,
    recommended_whole_grade: null,
    grade_uncertainty: "N/A",
    grading_notes: "DVG v2 disabled - conversational AI only"
  },
  // ... stub data
};
```

### In Database
DVG v2 fields are still present but populated with stub/null data:
- `dvg_grading` (JSONB) - Stub data only
- `dvg_decimal_grade` (NUMERIC) - Copied from conversational AI
- `dvg_whole_grade` (INTEGER) - Copied from conversational AI
- `dvg_grade_uncertainty` (TEXT) - Copied from conversational AI

### In Frontend
Frontend still reads DVG v2 fields for backward compatibility with old cards, but displays conversational AI data as primary.

---

## Migration Path

### Short Term (Current)
- ✅ Function disabled but present in codebase
- ✅ Stub data maintains compatibility
- ✅ Log messages updated to reflect disabled status

### Medium Term (When Conversational AI Fully Validated)
1. Mark DVG v2 database fields as deprecated in schema comments
2. Add database migration to mark fields as nullable
3. Update frontend to stop reading DVG v2 fields

### Long Term (Future Cleanup)
1. Move `gradeCardWithVision()` function to this directory
2. Remove stub data creation from route.ts
3. Add database migration to drop DVG v2 columns
4. Remove `VisionGradeResult` type definition (if not used elsewhere)

---

## For Reference: DVG v2 Database Fields

```sql
-- DVG v2 specific fields (DEPRECATED)
dvg_grading JSONB,
dvg_decimal_grade NUMERIC(3,1),
dvg_whole_grade INTEGER,
dvg_grade_uncertainty TEXT,
dvg_image_quality TEXT,
dvg_reshoot_required BOOLEAN,
dvg_centering_front_lr TEXT,
dvg_centering_front_tb TEXT,
dvg_centering_back_lr TEXT,
dvg_centering_back_tb TEXT,
dvg_positives TEXT[],
dvg_negatives TEXT[],
dvg_model TEXT,
dvg_version TEXT
```

**Note:** These fields are still written to maintain compatibility, but values are copied from conversational AI results or set to stub data.

---

## Lessons Learned

1. **Structured JSON limits AI reasoning** - Natural language allows better explanations
2. **Single source of truth is better** - Multiple grading systems create confusion
3. **Conversational format more robust** - Easier to extend, harder to break
4. **Prompt design matters more than response format** - Good instructions > rigid schema

---

## Related Documentation

- `SYSTEM_ARCHITECTURE_CURRENT.md` - Current active system
- `stage2_notes.md` - Stage 2 detailed inspection (also deprecated)
- `../../opencv_service/DEPRECATED.md` - OpenCV Stage 0 (also deprecated)

---

**Last Updated:** October 28, 2025
**Review Status:** Ready for long-term removal (after 3-6 months validation)

---

END OF DVG v2 NOTES
