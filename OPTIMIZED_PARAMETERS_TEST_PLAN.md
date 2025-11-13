# AI Parameter Optimization - Test Plan
**Date**: 2025-10-20
**Status**: ✅ READY TO TEST

---

## What Changed

### AI Parameters (ChatGPT + Claude Recommendations)

| Parameter          | Before | After  | Why                                              |
|--------------------|--------|--------|--------------------------------------------------|
| temperature        | 0.2    | 0.1    | Deterministic but not frozen (still in 0.0-0.15 range)|
| top_p              | 0.2    | 0.1    | Tighter nucleus sampling                         |
| max_tokens         | 6000   | 4000   | Balanced - completes JSON, prevents verbose prose|
| seed               | (none) | 42     | Same card always gets same grade                 |
| frequency_penalty  | (none) | 0.0    | ❌ Disabled - was preventing JSON completion     |

**Lessons Learned**:
1. **max_tokens: 2000 → TOO LOW** - Truncated JSON mid-response (ChatGPT's 1200-1800 was for simpler schema)
2. **temperature: 0.0 + frequency_penalty: 0.15 → TOO RESTRICTIVE** - AI generated incomplete responses (2786 chars, missing required fields)
3. **frequency_penalty backfired** - Penalized repetitive JSON structure patterns that are necessary for the schema (e.g., `"severity": "none"` appearing in multiple places by design)
4. **Final settings**: temperature 0.1, top_p 0.1, max_tokens 4000, seed 42, NO frequency_penalty

**Key Changes from Original (0.2 temp, 6000 tokens)**:
- ✅ Lower temperature (0.2 → 0.1) - More deterministic
- ✅ Tighter sampling (top_p 0.2 → 0.1) - Less randomness
- ✅ Fixed seed (42) - Perfect reproducibility
- ✅ Lower max_tokens (6000 → 4000) - Forces conciseness

---

## Files Modified

1. ✅ `src/lib/visionGrader.ts` - Updated interface, defaults, API call, console logs
2. ✅ `src/app/api/vision-grade/[id]/route.ts` - Updated parameter passing
3. ✅ `src/lib/gradeValidator.ts` - Added optional statistical hard cap (disabled by default)

---

## Testing Instructions

### Step 1: Restart Dev Server

```bash
# Stop current server (Ctrl+C)
npm run dev
```

### Step 2: Grade Herbert Card Again

- Use the SAME Justin Herbert card images from before
- Upload and let grading complete
- **Expected**: Grading should complete successfully (no errors)

---

## What to Check

### ✅ Success Indicators

**Console Logs** - Look for:
```
[DVG v2] Parameters: Model=gpt-4o, Temp=0, TopP=0.1, MaxTokens=2000, Seed=42, FreqPenalty=0.15
[DVG v2] Grade (before validation): ?
[GRADE VALIDATOR] Starting validation for grade ?
[GRADE CAP APPLIED] AI suggested ?, capped at ?  (or "No caps applied")
```

**What We're Testing**:
1. ✅ Does AI populate defects with severity OTHER than "none"?
2. ✅ Does AI find the defects ChatGPT found (corner whitening, edge roughness, print dot)?
3. ✅ Does final grade match ChatGPT's 9.0?
4. ✅ Is grading reproducible? (grade same card twice, should be identical with seed=42)

**Defect JSON** - Check Supabase `dvg_grading`:
```json
"defects": {
  "front": {
    "corners": {
      "top_left": {"severity": "microscopic", "description": "0.15mm whitening"},  // NOT "none"
      "top_right": {"severity": "microscopic", "description": "0.10mm whitening"}
    }
  }
}
```

---

## Comparison Matrix

| Metric                           | Before (Temp 0.2, 6000 tokens) | After (Temp 0.0, 2000 tokens, freq_penalty) | Target (ChatGPT) |
|----------------------------------|--------------------------------|---------------------------------------------|------------------|
| Herbert Card Grade               | 10.0 → 9.0 (validator cap)     | ?                                           | 9.0              |
| Defects Found                    | Zero (all "none")              | ?                                           | 3 defects        |
| Corner Whitening Detected?       | ❌ No                          | ?                                           | ✅ Yes (0.15mm)  |
| Edge Roughness Detected?         | ❌ No                          | ?                                           | ✅ Yes           |
| Print Dot Detected?              | ❌ No                          | ?                                           | ✅ Yes           |
| Validator Cap Applied?           | ✅ Yes (4 categories)          | ?                                           | No (finds defects)|
| Reason for Cap                   | Structural bug                 | ?                                           | N/A              |

---

## Expected Outcomes

### 🎯 Best Case: frequency_penalty Fixes Defect Detection

**AI finds defects**:
```json
{
  "corners": {
    "top_left": {"severity": "microscopic", "description": "0.15mm whitening on tip"},
    "top_right": {"severity": "microscopic", "description": "0.10mm rounding"}
  },
  "edges": {
    "top": {"severity": "minor", "description": "Factory roughness along 2mm section"}
  },
  "surface": {
    "print_defects": {
      "severity": "microscopic",
      "description": "Single print dot 0.3mm near border"
    }
  }
}
```

**Validator**: No longer needs to apply accidental cap (AI's grade is already accurate)

**Final Grade**: 9.0-9.5 (matching ChatGPT)

---

### 😐 Middle Case: Some Improvement

**AI finds 1-2 defects** (but not all):
- Maybe detects corner whitening but misses edge roughness
- Grade: 9.5 (closer but not perfect)
- Validator still applying some caps

**Action**: Consider enabling statistical hard cap (`ENABLE_STATISTICAL_HARD_CAP = true`)

---

### ❌ Worst Case: No Change

**AI still finds zero defects**:
- All defects still marked "severity": "none"
- Validator still applying accidental cap
- Grade: 9.0 (correct final grade but for wrong reasons)

**Action**:
1. Enable statistical hard cap (always block 10.0 → 9.5)
2. Accept that post-processing validator is the solution
3. Consider Option D (switch to Claude 3.5 Sonnet) if you want true defect detection

---

## Enable Statistical Hard Cap (If Needed)

If AI still doesn't find defects, you can enable the hard cap:

**File**: `src/lib/gradeValidator.ts`

**Change line 19**:
```typescript
// Before:
export const ENABLE_STATISTICAL_HARD_CAP = false;

// After:
export const ENABLE_STATISTICAL_HARD_CAP = true;
```

**What this does**:
- Any grade of 10.0 automatically caps to 9.5
- Reason: "Statistical rarity enforcement - Grade 10.0 blocked (occurs in <1% of cards)"
- This is ChatGPT's recommendation: "Give up on AI detection, just cap programmatically"

**Restart server after changing**.

---

## Reproducibility Test (Bonus)

With `seed: 42`, grading should be perfectly reproducible:

1. Grade Herbert card → Record exact grade (e.g., 9.0)
2. Delete the card from database
3. Grade same Herbert card again → Should get EXACT same grade
4. Repeat 5 times → All 5 should be identical

**If grades vary**: Something is wrong with seed implementation

**If grades identical**: Reproducibility working perfectly ✅

---

## Next Steps After Testing

### If frequency_penalty Works (AI finds defects):
1. ✅ Test 5-10 more diverse cards
2. ✅ Monitor grade distribution (10.0 should be <1%)
3. ✅ Compare all cards to ChatGPT analysis
4. ✅ Document successful configuration
5. ✅ Proceed with Pokemon card expansion

### If No Improvement (AI still finds zero defects):
1. ✅ Enable statistical hard cap (`ENABLE_STATISTICAL_HARD_CAP = true`)
2. ✅ Accept that validator is the solution (it's working)
3. ✅ Test Pokemon expansion with working system
4. ❓ Consider Claude 3.5 Sonnet for future if you want true defect detection

---

## Rollback Plan

If new parameters break grading completely:

### Git Rollback:
```bash
git checkout src/lib/visionGrader.ts
git checkout src/app/api/vision-grade/[id]/route.ts
git checkout src/lib/gradeValidator.ts
```

### Or Manual Revert:
Change back to:
- temperature: 0.2
- top_p: 0.2
- max_tokens: 6000
- Remove seed and frequency_penalty parameters

---

## Summary

**What We're Testing**: Does `frequency_penalty: 0.15` break the "severity: none" pattern lock and force AI to find actual defects?

**Why This Might Work**: AI is currently penalized zero for repeating "severity: none" 20+ times. With frequency_penalty, each repetition gets progressively more expensive, forcing variety.

**If It Doesn't Work**: We have the statistical hard cap ready to enable (always block 10.0 → 9.5) as a fallback.

**Current Validator**: Already working (accidental cap), producing correct final grades. New parameters aim to fix the *why* (make AI actually find defects), not just the *what* (correct final grade).

---

**Status**: ✅ READY TO TEST
**Test Card**: Justin Herbert 2022 Panini Prestige Heroes
**Expected Grade**: 9.0-9.5 (matching ChatGPT analysis with actual defects found)
**Date**: 2025-10-20
