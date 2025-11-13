# ⚠️ CRITICAL: Update OpenAI Assistants

## Why Cards Are Getting 10/B

Your assistants are still using old instructions that don't include defect detection. You must update both assistants in the OpenAI dashboard.

## Step-by-Step Instructions

### Step 1: Update Stage 1 Assistant (Measurement)

1. **Open OpenAI Platform**: https://platform.openai.com/assistants
2. **Find Assistant**: `asst_EbYus9ZeLMrGHw9ICEfQ99vm`
3. **Click "Edit"**
4. **Replace Instructions** with the contents of: `stage1_measurement_instructions.txt`
5. **Save the assistant**

**File to copy**: `C:\Users\benja\card-grading-app\stage1_measurement_instructions.txt`

**What this assistant does**:
- Measures centering (front/back, x/y ratios)
- Extracts card information (name, player, set, manufacturer, year, card number, serial)
- Detects autographs and classifies type
- **Inspects all 38 visual defects** (corners, edges, surface, print, alterations)
- Returns JSON with measurements, card info, and defect observations

### Step 2: Update Stage 2 Assistant (Evaluation)

1. **Open OpenAI Platform**: https://platform.openai.com/assistants
2. **Find Assistant**: `asst_XjzIEKt9P6Gj6aXRFe91jwV3`
3. **Click "Edit"**
4. **Replace Instructions** with the contents of: `stage2_evaluation_instructions.txt`
5. **Save the assistant**

**File to copy**: `C:\Users\benja\card-grading-app\stage2_evaluation_instructions.txt`

**What this assistant does**:
- Receives JSON from Stage 1 (measurements + defects)
- Determines centering starting grade (using worst ratio)
- Applies autograph safeguard (forces altered_writing = false for factory/certified)
- Counts all defects (each true = -1 point)
- Calculates final grade: Starting Grade - Defect Count
- Returns evaluation JSON with grading results

## Verification

After updating both assistants, test with a new card upload:

### Expected Console Output

```
[STAGE1] Measurement data extracted successfully
[STAGE2] Evaluation data extracted successfully
[SIMPLIFIED DEDUCTION] Centering Starting Grade: <grade>, Total Defect Count: <count>, Final Grade: <final>
```

### Expected Card Results Page

**Card Information**:
- ✅ Card Name: (extracted from card)
- ✅ Player Name: (extracted from card)
- ✅ Card Set: (extracted from card)
- ✅ Manufacturer: (extracted from card)
- ✅ Year: (extracted from card)
- ✅ Card Number: (extracted from card, NOT "N/A")

**Grading**:
- ✅ Centering Starting Grade: 5-10 (based on worst ratio)
- ✅ Total Defect Count: 0-38 (actual defects found)
- ✅ Final Grade: Starting Grade - Defect Count

**Confidence**:
- ✅ AI Confidence: "A" or "B" (consistent with Final DCM Grade)
- ✅ Confidence Level matches across all sections

**Major Company Estimates**:
- ✅ PSA: Actual grade estimate (not "N/A")
- ✅ BGS: Actual grade estimate (not "N/A")
- ✅ SGC: Actual grade estimate (not "N/A")

## Common Issues

### Issue 1: Still getting all 10/B grades
**Cause**: Assistants not updated in OpenAI dashboard
**Solution**: Verify you updated BOTH assistants with the new instruction files

### Issue 2: Card details still showing "N/A"
**Cause**: Stage 1 assistant not extracting card information
**Solution**: Ensure Stage 1 instructions include "TASK 2: CARD INFORMATION EXTRACTION"

### Issue 3: All defects showing false
**Cause**: Stage 1 assistant not performing visual inspection
**Solution**: Ensure Stage 1 instructions include "TASK 4: VISUAL DEFECT INSPECTION" with all 38 defects

### Issue 4: Confidence mismatch (shows "A" but gets "B")
**Cause**: Backend code fixed - should now match
**Solution**: Delete and re-upload test card to see fix

## Quick Test Cards

**Test 1: Well-Centered Card**
- Expected: Grade 9-10
- Expected: 0-2 defects
- Expected: Confidence "A"

**Test 2: Off-Center Card**
- Expected: Grade 5-8
- Expected: Starting grade < 10
- Expected: Centering ratio worse than 60/40

**Test 3: Factory Autograph Card**
- Expected: Autographed = "Yes"
- Expected: Autograph Type = "On-card autograph (factory)"
- Expected: altered_writing = false
- Expected: Grade based on condition, not penalized for autograph

## Files Updated in This Session

✅ `stage1_measurement_instructions.txt` - Now includes card info extraction + all defects
✅ `stage2_evaluation_instructions.txt` - Now includes full defect counting + grading
✅ `src/app/api/sports/[id]/route.ts` - Now extracts card info correctly, confidence matching
✅ `.env.local` - Already has correct assistant IDs

## Next Actions

1. [ ] Update Stage 1 assistant in OpenAI dashboard
2. [ ] Update Stage 2 assistant in OpenAI dashboard
3. [ ] Delete existing test card from database
4. [ ] Upload fresh test card
5. [ ] Verify card details populate correctly
6. [ ] Verify defects are detected
7. [ ] Verify confidence levels match
8. [ ] Verify major company estimates show actual grades

---

**IMPORTANT**: The backend code is already updated and ready. The ONLY thing preventing proper grading is the OpenAI assistant instructions need to be updated in the OpenAI dashboard.
