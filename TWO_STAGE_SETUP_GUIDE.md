# Two-Stage Grading System - Setup Guide

## Quick Start

The two-stage grading system is now configured and ready to use. Here's what was set up:

## ✅ Completed Setup Steps

### 1. Instruction Files Created
- ✅ `stage1_measurement_instructions.txt` - Measurement extraction only
- ✅ `stage2_evaluation_instructions.txt` - Rule-based evaluation only

### 2. OpenAI Assistants Configured
- ✅ **Stage 1 (Measurement)**: `asst_EbYus9ZeLMrGHw9ICEfQ99vm`
- ✅ **Stage 2 (Evaluation)**: `asst_XjzIEKt9P6Gj6aXRFe91jwV3`

### 3. Environment Variables Added
- ✅ `OPENAI_MEASUREMENT_ASSISTANT_ID` → Stage 1 assistant
- ✅ `OPENAI_EVALUATION_ASSISTANT_ID` → Stage 2 assistant
- ✅ Added to `.env.local` file

### 4. Backend Code Updated
- ✅ `route.ts` now uses separate assistants for each stage
- ✅ Centering retry logic implemented (3 attempts)
- ✅ Autograph safeguards implemented
- ✅ Fallback to legacy single-stage system available

## How the System Works

### Stage 1: Measurement Extraction
**Assistant**: `asst_EbYus9ZeLMrGHw9ICEfQ99vm`

1. Receives front and back card images
2. Measures centering ratios (x-axis and y-axis for both sides)
3. Detects autographs and classifies type:
   - "On-card autograph (factory)"
   - "Certified autograph with authentication"
   - "Uncertified/added signature"
4. Returns JSON with measurements only

**Retry Logic**: If all 4 ratios = "50/50", automatically retries up to 3 times with higher temperature.

### Stage 2: Evaluation
**Assistant**: `asst_XjzIEKt9P6Gj6aXRFe91jwV3`

1. Receives measurement JSON from Stage 1
2. Applies centering grade thresholds
3. Applies binary defect rules
4. Calculates: Final Grade = Starting Grade - Defect Count
5. Returns evaluation JSON

**Safeguard**: Factory/certified autographs force `altered_writing = false` in backend code.

## Testing the System

### 1. Start Development Server
```bash
npm run dev
```

### 2. Upload a Sports Card
Navigate to the sports card upload page and upload front/back images.

### 3. Monitor Console Logs
Watch for these log messages:
```
[TWO-STAGE] Starting Stage 1: Measurement Extraction
[STAGE1] Created measurement thread (attempt 1/3)
[STAGE1] Measurement data extracted successfully
[TWO-STAGE] Starting Stage 2: Defect Evaluation
[STAGE2] Evaluation data extracted successfully
```

### 4. Check for Safeguards
**Centering Retry**:
```
[STAGE1] SUSPICIOUS: All ratios are 50/50. Retry attempt 1/3
[STAGE1] Using temperature: 0.2
```

**Autograph Safeguard**:
```
[SAFEGUARD] Forcing altered_writing = false for factory/certified autograph
[SAFEGUARD] Recalculating grade: 10 - 0
```

## What to Test

### Test Case 1: Off-Center Card
**Expected**:
- Ratios like `65/35`, `70/30`, or worse
- Starting grade < 10
- No "50/50" defaults

### Test Case 2: Factory Autograph Card
**Examples**: Panini Prizm, Topps Chrome autographs
**Expected**:
- `autograph_detection.autographed = "Yes"`
- `autograph_detection.autograph_type = "On-card autograph (factory)"`
- `altered_writing = false`

### Test Case 3: Uncertified Autograph
**Example**: Card with signature added after production
**Expected**:
- `autograph_type = "Uncertified/added signature"`
- `altered_writing = true`

### Test Case 4: Well-Centered Card
**Expected**:
- Ratios like `55/45`, `58/42`, `60/40`
- Starting grade = 10
- Realistic measurements (not all identical)

## Troubleshooting

### Issue: All ratios still showing 50/50
**Solution**: Check console for retry attempts. System retries 3 times automatically.

### Issue: Factory autograph flagged as alteration
**Solution**: Backend safeguard should prevent this. Check logs for `[SAFEGUARD]` message.

### Issue: Stage 1 or Stage 2 timeout
**Solution**: Increase timeout in route.ts (currently 3 minutes per stage).

### Issue: Assistant ID not found
**Solution**: Verify environment variables in `.env.local`:
```bash
OPENAI_MEASUREMENT_ASSISTANT_ID=asst_EbYus9ZeLMrGHw9ICEfQ99vm
OPENAI_EVALUATION_ASSISTANT_ID=asst_XjzIEKt9P6Gj6aXRFe91jwV3
```

### Issue: JSON parsing error
**Solution**: Check that assistants have the correct instruction files attached in OpenAI dashboard.

## Fallback System

If two-stage pipeline fails, the system automatically falls back to the legacy single-stage approach:
- Uses `sports_assistant_instructions.txt`
- Single assistant performs both measurement and evaluation
- Still functional but less optimized

## Performance Notes

**Expected Processing Time**:
- Stage 1 (Measurement): ~20-40 seconds
- Stage 2 (Evaluation): ~10-20 seconds
- **Total**: ~30-60 seconds per card

**Retry Impact**:
- If centering retry triggers: Add ~30-60 seconds per retry
- Maximum 3 retries = up to 3 minutes total

## Next Steps

1. ✅ System is configured and ready to test
2. Upload test cards to verify functionality
3. Monitor console logs for safeguard activations
4. Report any issues with specific card types
5. Consider expanding Stage 2 defect detection (future enhancement)

## Files Modified

- ✅ `src/app/api/sports/[id]/route.ts` - Backend logic
- ✅ `.env.local` - Environment variables
- ✅ `stage1_measurement_instructions.txt` - New Stage 1 prompt
- ✅ `stage2_evaluation_instructions.txt` - New Stage 2 prompt
- ✅ `REFACTOR_SUMMARY.md` - Technical documentation

## Support

If issues arise:
1. Check console logs for error messages
2. Verify assistant IDs in OpenAI dashboard
3. Test with legacy single-stage fallback
4. Review `REFACTOR_SUMMARY.md` for detailed implementation

---

**Status**: ✅ Ready for Testing
**Date**: 2025-10-02
**Version**: Two-Stage Pipeline v1.0
