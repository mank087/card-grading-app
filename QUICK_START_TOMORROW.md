# Quick Start Guide - Two-Stage V2 Testing

## System Status
✅ **Two-Stage V2 Implementation Complete**
✅ **Ready for Testing**

---

## What Was Built Today

1. **Stage 1 Observation Assistant** - Observes cards without scoring
2. **Stage 2 Scoring Assistant** - Applies deduction tables deterministically
3. **Backend Integration** - route.ts updated with two-stage pipeline
4. **Validation Layer** - Backend enforces alteration rules
5. **Fallback System** - Auto-falls back to single-stage if needed

---

## First Steps Tomorrow

### 1. Start Development Server
```bash
npm run dev
```

### 2. Open Console
- Keep browser DevTools console open
- Monitor for `[STAGE 1]`, `[STAGE 2]`, `[VALIDATION]` logs

### 3. Test Card Upload
Navigate to sports card upload page and test these scenarios:

---

## Test Cases (In Order)

### Test 1: Pristine Card ✅
**Goal:** Verify no fabricated defects

1. Upload a near-mint card (clean corners, good centering)
2. **Check console for:**
   - `[STAGE 1] ✅ Observation complete`
   - `[STAGE 2] ✅ Scoring complete`
   - `[TWO-STAGE-V2] ✅ Grading complete`
3. **Check frontend:**
   - Grade should be 9.5-10
   - Defects should be minimal or none
   - No fabricated defects (compare with actual card)
4. **Check descriptions:**
   - Should be unique to THIS card
   - No templated phrases like "approximately 0.5mm"

**Success:** Grade 9-10, no fake defects, unique descriptions

---

### Test 2: Multiple Cards (Uniqueness) ✅
**Goal:** Verify no templating

1. Upload 3-5 different cards
2. **Compare defect descriptions:**
   - Should all be different
   - No identical centering ratios across cards
   - No identical phrases
3. **Check for forbidden phrases:**
   - ❌ "White paper core visible at the very tip"
   - ❌ "clearly contrasting with the dark border"
   - ❌ "Microscopic scratch visible under direct light"

**Success:** Every card has unique descriptions, different centering

---

### Test 3: Uncertified Autograph ⚠️ CRITICAL
**Goal:** Verify NA grade for altered cards

1. Upload card with hand-written signature (no hologram/authentication)
2. **Check console for:**
   ```
   [STAGE 1 AUTOGRAPH] {
     "has_handwriting": true,
     "authentication_markers_found": [
       "NO hologram sticker found on back",
       "NO AUTHENTIC text found"
     ]
   }
   [VALIDATION] ⚠️ CARD IS ALTERED - Enforcing NA grade
   ```
3. **Check frontend:**
   - Final grade should be **"NA"**
   - Authenticity score should be **0**
   - Analysis summary should mention alteration

**Success:** Grade = NA, authenticity = 0

---

### Test 4: Card with Minor Defects
**Goal:** Verify accurate scoring

1. Upload card with visible corner wear or scratch
2. **Check Stage 1 observations:**
   - Should list the defect with MM estimate
   - Should describe specific location on THIS card
3. **Check Stage 2 scoring:**
   - Should apply correct deduction from table
   - Grade should be 8-9 range (not 10)
4. **Frontend display:**
   - Category breakdown should show the deduction
   - Evidence should match Stage 1 description

**Success:** Defect detected accurately, appropriate deduction applied

---

### Test 5: Poor Image Quality
**Goal:** Verify uncertainty handling

1. Upload blurry/dark/angled photo
2. **Check image quality assessment:**
   - overall_score should be < 7.0
   - confidence_tier should be "medium" or "low"
3. **Check final grade:**
   - Should have uncertainty ±1.0 or ±1.5
   - Analysis should mention image quality impact

**Success:** Lower confidence tier, higher uncertainty

---

## Console Logs to Watch For

### Good Signs ✅
```
[STAGE 1] Creating observation thread...
[STAGE 1] Thread created: thread_xxxxx
[STAGE 1] ✅ Observation complete
[STAGE 1 AUTOGRAPH] { has_handwriting: false }
[STAGE 2] Creating scoring thread...
[STAGE 2] ✅ Scoring complete
[VALIDATION] Checking Stage 2 output...
[TWO-STAGE-V2] ✅ Grading complete
```

### Warning Signs ⚠️
```
[TWO-STAGE-V2] Error: No JSON found in Stage 1 response
[VALIDATION] ⚠️ CARD IS ALTERED (for cards that SHOULD be altered - this is good)
Falling back to single-stage V4.0 (means two-stage failed - investigate)
```

---

## Troubleshooting

### Issue: "Assistant not found" error
**Fix:** Check `.env.local` has correct assistant IDs
```bash
OPENAI_STAGE1_OBSERVATION_ASSISTANT_ID=asst_u68rCmtC22WPqdJ6aa3OjG4D
OPENAI_STAGE2_SCORING_ASSISTANT_ID=asst_LGc5phkq8r2a75kTwZzR0Bll
```

### Issue: Frontend not displaying category scores
**Check:** Console for Stage 2 output structure
**Fix:** Verify `stage2Data.structural_integrity` etc. exist

### Issue: All cards still getting grade 10
**Check:** Stage 2 deduction table application
**Action:** Look at console for Stage 2 calculation proof

### Issue: Two-stage keeps falling back to single-stage
**Check:** Console for specific error message
**Common causes:**
- OpenAI API rate limit
- Invalid JSON from Stage 1 or Stage 2
- Assistant ID mismatch

---

## If Something Goes Wrong

### Emergency Rollback to Single-Stage
1. Open `src/app/api/sports/[id]/route.ts`
2. Find line ~2057: `const { gradingResult: aiResult } = await gradeSportsCardTwoStageV2(...)`
3. Comment it out
4. Uncomment the single-stage call below it
5. Restart server

### Check Assistant Status
```bash
node create_stage1_assistant.js
node create_stage2_assistant.js
```
Should show both assistants exist

---

## Success Metrics

After testing 5-10 cards, you should see:

✅ **No fabricated defects** - Every defect in Stage 2 traces to Stage 1
✅ **Unique descriptions** - No two cards have identical text
✅ **Uncertified autographs = NA** - Altered cards get NA grade
✅ **Grades not all 10s** - See variety (8s, 9s, 9.5s, 10s)
✅ **Frontend displays correctly** - All 5 categories, defects, pristine elements

---

## Next Steps After Testing

1. **Document results** in `CLAUDE_PROJECT_NOTES.md`
2. **Tune deduction bands** if grades still too high/low
3. **Adjust forbidden phrases** if seeing new templated text
4. **Consider production deployment** if all tests pass

---

## Quick Reference

**Stage 1 Instructions:** `stage1_observation_instructions_v2.txt`
**Stage 2 Instructions:** `stage2_scoring_instructions_v2.txt`
**Route Function:** `gradeSportsCardTwoStageV2()` in `route.ts` line 181
**Full Docs:** `TWO_STAGE_V2_IMPLEMENTATION.md`
**Project Notes:** `CLAUDE_PROJECT_NOTES.md`

---

**Good luck testing! 🚀**
