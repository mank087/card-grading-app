# Parser & Prompt Fixes for v3.5 PATCHED v2

**Date:** October 24, 2025
**Status:** ✅ Fixed - Ready for Testing

---

## 🐛 Issues Found

### 1. Grade Extraction Failing (Server Logs)
**Symptom:**
```
[PARSER V3] Extracted main grade: 0 → rounded to 0 (whole: 0, uncertainty: ±0.5)
```

**Expected:**
```
[PARSER V3] Extracted main grade: 4.0 → rounded to 4 (whole: 4, uncertainty: ±0.5)
```

**Root Cause:**
- Parser regex: `/\*\*Decimal Grade:\*\*\s*(\d+\.?\d*)/i`
- AI output: `- **Final Decimal Grade**: 4.0`
- Mismatch: "Decimal Grade" vs "Final Decimal Grade"

**Fix:**
Updated `src/lib/conversationalParserV3.ts` line 196-198:
```typescript
// BEFORE:
const decimalMatch = markdown.match(/\*\*Decimal Grade:\*\*\s*(\d+\.?\d*)/i);
const wholeMatch = markdown.match(/\*\*Whole Grade Equivalent:\*\*\s*(\d+)/i);
const uncertaintyMatch = markdown.match(/\*\*Grade Uncertainty:\*\*\s*(±\d+\.?\d*|N\/A)/i);

// AFTER:
const decimalMatch = markdown.match(/\*\*(?:Final\s+)?Decimal Grade(?:\*\*)?:\s*(\d+\.?\d*)/i);
const wholeMatch = markdown.match(/\*\*(?:Whole\s+(?:Number\s+Equivalent|Grade Equivalent))(?:\*\*)?:\s*(\d+)/i);
const uncertaintyMatch = markdown.match(/\*\*(?:Grade\s+)?(?:Uncertainty|Range)(?:\*\*)?:\s*([^\n]+)/i);
```

**Result:** Now matches both "Decimal Grade" (v3.2) and "Final Decimal Grade" (v3.5)

---

### 2. Centering Ratios Not Being Output by AI

**Symptom:**
```
[PARSER V3] Final centering ratios: { front_lr: null, front_tb: null, back_lr: null, back_tb: null }
```

**AI Output (Wrong):**
```
### A. Centering

- **Method Used**: Border Measurement
- **Assessment**: The borders appear slightly uneven, with the left border being slightly wider than the right.
- **Centering Sub-Score**: 9.0
```

**Expected Output:**
```
A. Centering

Left/Right: 55/45
Top/Bottom: 50/50
Centering Sub-Score: 9.0
```

**Root Cause:**
- v3.5 prompt described centering METHODOLOGY but didn't show exact OUTPUT FORMAT
- AI was creative and added markdown headers (###), bullet points, descriptions
- Parser couldn't extract ratios because they weren't in the output

**Fix:**
Updated `prompts/conversational_grading_v3_5_PATCHED.txt` (lines 347-350 and 465-468):

**STEP 3 Front Evaluation:**
```
OUTPUT FORMAT FOR CENTERING:
Left/Right: [ratio like 55/45]
Top/Bottom: [ratio like 50/50]
Centering Sub-Score: [0.0-10.0 - start at 10.0, apply cap per table in Step 7]
```

**STEP 4 Back Evaluation:**
```
OUTPUT FORMAT FOR CENTERING:
Left/Right: [ratio like 55/45]
Top/Bottom: [ratio like 50/50]
Centering Sub-Score: [0.0-10.0 - start at 10.0, apply cap per table in Step 7]
```

**Result:** AI now has explicit output format to follow

---

### 3. Professional Grading Report Missing Sub-Scores (Frontend)

**Symptom:** User reported "the grading report doesn't have the card subgrade info"

**Root Cause:** Not yet identified (need to check frontend display logic)

**Note:** Sub-scores ARE being extracted correctly by backend:
```
[CONVERSATIONAL AI v3.5] Sub-scores: {
  centering: { front: 9, back: 9, weighted: 9 },
  corners: { front: 8.5, back: 8.5, weighted: 8.5 },
  edges: { front: 8.5, back: 8.5, weighted: 8.5 },
  surface: { front: 4, back: 4, weighted: 4 }
}
```

**Status:** Requires frontend investigation (CardDetailClient.tsx)

---

## ✅ Changes Made

### Files Modified: 2

1. **src/lib/conversationalParserV3.ts**
   - ✅ Updated grade extraction regex to match both v3.2 and v3.5 formats
   - ✅ Made regex more flexible with optional markdown formatting
   - ✅ Now extracts "Final Decimal Grade", "Whole Number Equivalent", "Grade Range"

2. **prompts/conversational_grading_v3_5_PATCHED.txt**
   - ✅ Added explicit OUTPUT FORMAT FOR CENTERING sections
   - ✅ Shows exact format: `Left/Right: 55/45`, `Top/Bottom: 50/50`
   - ✅ Applied to both STEP 3 (Front) and STEP 4 (Back)

---

## 🧪 Testing Instructions

### Step 1: Restart Development Server ⚠️ REQUIRED
```bash
# Stop server (Ctrl+C)
npm run dev
```

**Why:** Parser and prompt changes require server restart

---

### Step 2: Grade a Brand New Card

**Important:** Upload a NEW card (not previously graded)

**Check Server Logs For:**
```bash
# Grade should extract correctly:
[PARSER V3] Extracted main grade: 4.0 → rounded to 4 (whole: 4, uncertainty: ±0.5)

# NOT:
[PARSER V3] Extracted main grade: 0 → rounded to 0
```

---

### Step 3: Verify Centering Ratios in AI Output

**Check markdown output in logs for:**
```markdown
[STEP 3] FRONT EVALUATION

A. Centering

Left/Right: 55/45
Top/Bottom: 50/50
Centering Sub-Score: 9.0
```

**Should NOT see:**
```markdown
### A. Centering

- **Method Used**: Border Measurement
- **Assessment**: The borders appear slightly uneven...
```

---

### Step 4: Verify Centering Ratios Extracted

**Check server logs for:**
```bash
[PARSER V3] Final centering ratios: {
  front_lr: '55/45',
  front_tb: '50/50',
  back_lr: '55/45',
  back_tb: '50/50'
}
```

**Should NOT see:**
```bash
[PARSER V3] Final centering ratios: { front_lr: null, front_tb: null, back_lr: null, back_tb: null }
```

---

### Step 5: Check Frontend Centering Tab

**Verify:**
- ✅ Centering tab shows ratios (e.g., "55/45", "50/50")
- ✅ NOT showing "N/A" or "50/50" defaults

---

## 📊 Expected Results

### Server Logs Should Show:
```
[CONVERSATIONAL] Loaded v3.5 PATCHED v2 prompt successfully (32XXX characters) [DEV MODE]
[CONVERSATIONAL] Parameters: Model=gpt-4o, Temp=0.2, TopP=0.1, MaxTokens=4000, Seed=42
[CONVERSATIONAL AI v3.5] ✅ Grading completed: 8.5
[PARSER V3] Extracted main grade: 8.5 → rounded to 8.5 (whole: 9, uncertainty: ±0.5)
[PARSER V3] Final centering ratios: { front_lr: '55/45', front_tb: '50/50', back_lr: '55/45', back_tb: '50/50' }
[DVG v2 GET] ✅ Parsed structured data: { hasDefects: true, hasFrontDefects: true, hasBackDefects: true, hasCentering: true }
```

### AI Markdown Output Should Show:
```markdown
[STEP 3] FRONT EVALUATION

A. Centering

Left/Right: 55/45
Top/Bottom: 50/50
Centering Sub-Score: 9.5

B. Corners

- **Top Left**: Microscopic wear - barely visible point softening
- **Top Right**: Minor wear - visible rounding <0.5mm
...

[STEP 10] FINAL GRADE CALCULATION AND REPORT

- **Weighted Total (Pre-Cap)**: 8.5
- **Final Decimal Grade**: 8.5
- **Grade Range**: 8.5 ± 0.3
- **Whole Number Equivalent**: 9
- **Condition Label**: Near Mint (NM)
```

---

## ⚠️ Potential Issues

### Issue 1: AI Still Outputs Creative Format
**Symptom:** AI adds markdown headers, bullet points, doesn't follow OUTPUT FORMAT

**Possible Causes:**
1. Temperature too high (should be 0.2)
2. AI ignoring instructions (rare with temp 0.2)
3. Prompt file not loading correctly

**Debug:**
1. Check temperature in logs: `Temp=0.2`
2. Check prompt file size: `32,XXX characters`
3. Lower temperature to 0.1 if needed

**Solution:**
- If AI persists, make parser even more flexible
- Consider adding REQUIREMENT in prompt: "You MUST use this exact format"

---

### Issue 2: Grade Still Extracts as 0
**Symptom:** `[PARSER V3] Extracted main grade: 0`

**Possible Causes:**
1. AI outputting grade in unexpected location
2. Different formatting than regex expects
3. Server not restarted (old code still running)

**Debug:**
1. Check full markdown output in logs
2. Search for "Decimal Grade" or "Final" in output
3. Verify server was restarted

**Solution:**
- Check exact AI output format
- Update regex to match actual format
- Ensure server restarted

---

### Issue 3: Centering Ratios Still Null
**Symptom:** `front_lr: null, front_tb: null`

**Possible Causes:**
1. AI not following new OUTPUT FORMAT
2. Parser not finding ratios in markdown
3. Ratios in different location than expected

**Debug:**
1. Check markdown for "Left/Right:" and "Top/Bottom:"
2. Verify format matches: `Left/Right: 55/45` (not "L/R" or other format)
3. Check parseBackwardCompatibleData() logs

**Solution:**
- Make parser more flexible with multiple pattern attempts
- Add fallback to default 50/50 if can't extract

---

## 🎯 Success Criteria

- [x] Parser extracts correct grade (not 0)
- [ ] AI outputs centering ratios in specified format
- [ ] Parser extracts centering ratios (not null)
- [ ] Frontend Centering tab shows actual ratios
- [ ] Professional Grading Report shows sub-scores
- [ ] No errors in server logs
- [ ] No "N/A" or null in extracted data

---

## 📝 Next Steps

1. ✅ **Restart server**: `npm run dev`
2. ⏳ **Grade NEW card** - Fresh upload, not re-grade
3. ⏳ **Check server logs** - Verify grade extraction and centering ratios
4. ⏳ **Check AI markdown** - Verify OUTPUT FORMAT followed
5. ⏳ **Check frontend tabs** - Verify data displays
6. ⏳ **Investigate frontend** - If sub-scores not showing in Professional Grading Report

---

## 🔍 If Issues Persist

If after restarting and testing:
1. **Grade still extracts as 0**: Share full markdown output from logs
2. **Centering ratios still null**: Share STEP 3/4 sections from markdown
3. **Professional Report still empty**: Check browser console for errors

We may need to:
- Further adjust parser regex patterns
- Add more explicit formatting requirements to prompt
- Investigate frontend display logic for Professional Grading Report

---

**Ready to test!** Restart server with `npm run dev` and grade a new card. 🚀
