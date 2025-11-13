# Grading System Refactor - Two-Stage Pipeline

## Summary

Successfully refactored the sports card grading system from a single monolithic assistant into a clean two-stage pipeline with simplified instructions and backend safeguards.

## Files Created

### 1. `stage1_measurement_instructions.txt`
- **Purpose**: Stage 1 measurement extraction only
- **Size**: ~1,500 characters (vs. ~40,000 in original)
- **OpenAI Assistant ID**: `asst_EbYus9ZeLMrGHw9ICEfQ99vm`
- **Environment Variable**: `OPENAI_MEASUREMENT_ASSISTANT_ID`
- **Responsibilities**:
  - Measure front/back centering (x-axis and y-axis ratios)
  - Provide edge descriptions
  - Detect autograph presence and classify type
  - NO grading, NO defect detection, NO evaluation

### 2. `stage2_evaluation_instructions.txt`
- **Purpose**: Stage 2 rule-based evaluation only
- **Size**: ~800 characters (vs. ~40,000 in original)
- **OpenAI Assistant ID**: `asst_XjzIEKt9P6Gj6aXRFe91jwV3`
- **Environment Variable**: `OPENAI_EVALUATION_ASSISTANT_ID`
- **Responsibilities**:
  - Apply centering grade thresholds
  - Apply binary defect deductions
  - Calculate final grade: Starting Grade - Defect Count
  - NO image analysis, NO border measurement

## Environment Variables

Added to `.env.local`:
```bash
# Two-Stage Pipeline Assistant IDs
OPENAI_MEASUREMENT_ASSISTANT_ID=asst_EbYus9ZeLMrGHw9ICEfQ99vm  # Stage 1: Measurement
OPENAI_EVALUATION_ASSISTANT_ID=asst_XjzIEKt9P6Gj6aXRFe91jwV3   # Stage 2: Evaluation
```

The code uses these environment variables with fallback to hardcoded IDs:
- Stage 1: `process.env.OPENAI_MEASUREMENT_ASSISTANT_ID || 'asst_EbYus9ZeLMrGHw9ICEfQ99vm'`
- Stage 2: `process.env.OPENAI_EVALUATION_ASSISTANT_ID || 'asst_XjzIEKt9P6Gj6aXRFe91jwV3'`

## Backend Changes in `route.ts`

### Updated Functions

1. **`getMeasurementInstructions()`**
   - Now loads `stage1_measurement_instructions.txt`
   - Previously: `sports_measurement_instructions.txt`

2. **`getEvaluationInstructions()`**
   - Now loads `stage2_evaluation_instructions.txt`
   - Previously: `sports_evaluation_instructions.txt`

3. **`gradeSportsCardTwoStage()`** - Major Enhancements

#### Stage 1 Enhancements: Centering Retry Logic

```typescript
// SAFEGUARD: Check for suspicious 50/50 across all ratios
const allRatios50 = frontX === "50/50" && frontY === "50/50" &&
                    backX === "50/50" && backY === "50/50";

if (allRatios50 && retryCount < maxRetries - 1) {
  console.warn(`[STAGE1] SUSPICIOUS: All ratios are 50/50. Retry attempt ${retryCount + 1}/${maxRetries}`);
  retryCount++;
  continue; // Retry with higher temperature (0.2-0.3)
}
```

**Behavior**:
- If all 4 ratios = "50/50", retry up to 3 times with increasing temperature (0.0 → 0.2 → 0.3)
- After 3 attempts, flag with `centering_confidence: "Low"` and `suspicious_centering: true`
- Prevents lazy AI defaulting to perfect centering

#### Stage 2 Enhancements: Autograph Safeguards

```typescript
// BACKEND SAFEGUARD: Force altered_writing = false for factory/certified autographs
const autographType = measurementData.autograph_detection?.autograph_type;
if (autographType === "On-card autograph (factory)" ||
    autographType === "Certified autograph with authentication") {
  if (evaluationData.defects_detected?.altered_writing) {
    console.log('[SAFEGUARD] Forcing altered_writing = false for factory/certified autograph');
    evaluationData.defects_detected.altered_writing = false;

    // Recalculate grade if necessary
    const newDefectCount = Object.values(evaluationData.defects_detected).filter(v => v === true).length;
    evaluationData.total_defect_count = newDefectCount;
    evaluationData.final_grade = evaluationData.centering_starting_grade - newDefectCount;
  }
}
```

**Behavior**:
- Factory and certified autographs NEVER trigger `altered_writing = true`
- Only "Uncertified/added signature" should flag alterations
- Backend enforcement prevents AI errors in Stage 2

## Standard Centering Ratios

Both stages now use only these approved ratios:
```
50/50, 52/48, 54/46, 55/45, 56/44, 58/42, 60/40, 62/38, 65/35,
68/32, 70/30, 72/28, 75/25, 78/22, 80/20, 82/18, 85/15, 88/12, 90/10
```

## Centering Grade Thresholds (Stage 2)

| Ratio Range | Starting Grade |
|-------------|----------------|
| 50/50 - 60/40 | 10 |
| 65/35 | 9 |
| 70/30 | 8 |
| 75/25 | 7 |
| 80/20 | 6 |
| 85/15+ | 5 |

**Note**: Worst ratio (front or back, x or y) determines the starting grade.

## Output JSON Schema (Preserved)

Frontend `page.tsx` remains **unchanged**. The merged output matches the existing schema:

```json
{
  "Grading (DCM Master Scale)": {
    "Centering Starting Grade": <from Stage 2>,
    "Defect Deductions": <from Stage 2>,
    "Total Defect Count": <from Stage 2>,
    "Final Grade (After Deductions)": <from Stage 2>,
    "Visual_Inspection_Results": <from Stage 2>,
    "Centering_Measurements": {
      "front_x_axis_ratio": <from Stage 1>,
      "front_y_axis_ratio": <from Stage 1>,
      "front_edge_description": <from Stage 1>,
      "back_x_axis_ratio": <from Stage 1>,
      "back_y_axis_ratio": <from Stage 1>,
      "back_edge_description": <from Stage 1>
    }
  },
  "Card Details": {
    "Autographed": <from Stage 1>,
    "Autograph Type": <from Stage 1>
  }
}
```

## Benefits of This Refactor

1. **Shorter Instructions**: 2,300 chars total vs. 40,000+ chars previously
2. **Clearer Separation of Concerns**: Measurement vs. Evaluation
3. **Better Repeatability**: Simpler prompts = more consistent results
4. **Backend Safeguards**: Business logic enforced in code, not prompts
5. **Realistic Centering**: Retry logic prevents lazy 50/50 defaults
6. **Autograph Accuracy**: Factory autographs never flagged as alterations
7. **Same Frontend**: No breaking changes to card results page

## Migration Path

### Old System (Still Available as Fallback)
- `sports_assistant_instructions.txt` (40,000+ chars)
- Single-stage combined measurement + evaluation
- Still accessible via `gradeSportsCardWithAI()` function

### New System (Now Primary)
- `stage1_measurement_instructions.txt` (1,500 chars)
- `stage2_evaluation_instructions.txt` (800 chars)
- Two-stage pipeline with safeguards
- Primary method: `gradeSportsCardTwoStage()` with fallback to legacy

## Testing Recommendations

1. **Test Centering Detection**:
   - Upload cards with obvious off-centering
   - Verify ratios like 65/35, 70/30, 80/20 are reported
   - Confirm no lazy 50/50 defaults

2. **Test Autograph Handling**:
   - Factory autograph cards (Prizm, Chrome) → `altered_writing = false`
   - Certified autos with holograms → `altered_writing = false`
   - Random signature added later → `altered_writing = true`

3. **Test Grade Calculation**:
   - Verify: Final Grade = Starting Grade - Defect Count
   - Check that autograph safeguard recalculates grades if needed

4. **Test Frontend Display**:
   - Confirm card results page displays correctly
   - Verify all JSON keys map to existing UI fields
   - Check that centering measurements appear properly

## Future Enhancements

- Add Stage 1 text extraction (card name, set, player)
- Expand Stage 2 defect detection beyond centering/autographs
- Add confidence scoring for measurement quality
- Implement parallel defect detection for speed

## Rollback Plan

If issues arise, the legacy single-stage system is still in place:
- `sports_assistant_instructions.txt` (unchanged)
- `gradeSportsCardWithAI()` function (unchanged)
- Fallback already configured in route.ts (lines 1037-1050)
