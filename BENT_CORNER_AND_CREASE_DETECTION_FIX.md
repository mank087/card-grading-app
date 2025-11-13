# Bent Corner & Crease Detection Fix - October 15, 2025

## Issues Identified

### Issue 1: Bent Corner Detected But Cap Not Applied ❌

**Symptom:** Card with bent corner graded at **8.0** instead of **4.0**

**Detection Output:**
```
Corners → Top Left: "Top-left corner is bent and does not lie flat" - MODERATE
Surface → Creases: "No visible creases" - NONE
Final Grade: 8.0  ❌ Should be 4.0
```

**Root Cause:**
- Bent corner was correctly detected: "is bent and does not lie flat"
- STEP 0 instructions said to check corner descriptions for "bent" keywords
- But the check wasn't specific enough about WHERE to look
- The 4.0 cap was not applied

### Issue 2: Crease Not Detected ❌

**Symptom:** User reports visible crease on front, but AI reported "No visible creases"

**Root Cause:**
- Detection failure - AI couldn't see the crease
- Need more specific visual cues about WHAT creases look like
- Need systematic zone-by-zone scanning protocol

---

## Fixes Implemented

### Fix 1: Explicit Bent Corner Cap Check

**Before (Line 2021):**
```
- Check ALL corner descriptions for "bent", "raised", "warped", "fold" → automatic_cap = 4.0
```
This was too vague - didn't specify WHICH corners to check.

**After (Lines 2024-2034):**
```
**B. Check for BENT CORNERS:**
- Check defects.front.corners.top_left.description - if contains "bent", "does not lie flat", "raised", "warped", "fold" → automatic_cap = 4.0
- Check defects.front.corners.top_right.description - if contains "bent", "does not lie flat", "raised", "warped", "fold" → automatic_cap = 4.0
- Check defects.front.corners.bottom_left.description - [same]
- Check defects.front.corners.bottom_right.description - [same]
- Check defects.back.corners.top_left.description - [same]
- Check defects.back.corners.top_right.description - [same]
- Check defects.back.corners.bottom_left.description - [same]
- Check defects.back.corners.bottom_right.description - [same]

🔴 CRITICAL: If ANY corner description mentions "bent" or "does not lie flat",
the cap MUST be set to 4.0, regardless of the severity marking.
```

Now explicitly checks ALL 8 corners with the exact phrase the AI uses: **"does not lie flat"**

---

### Fix 2: Enhanced STEP 8 Validation

**Before:**
```
IF any corner description contains "bent" or "fold" or "warped":
  IF final_grade > 4.0: Override to 4.0
```

**After (Lines 2106-2117):**
```
B. CHECK FOR BENT CORNERS (CHECK EVERY CORNER):
Check ALL 8 corner descriptions:
IF ANY corner description contains "bent" OR "does not lie flat" OR "raised" OR "warped" OR "fold":
  IF final_grade > 4.0:
    → ERROR DETECTED: Override final_grade = 4.0
    → Set grade_cap_reason = "Bent corner detected - structural damage cap 4.0"

EXAMPLE:
If defects.front.corners.top_left.description = "Top-left corner is bent and does not lie flat":
  → This contains "bent" AND "does not lie flat"
  → If final_grade > 4.0, override to 4.0
```

Added explicit example using the EXACT text your card output, so the AI sees the pattern.

---

### Fix 3: Enhanced Crease Visual Detection Cues

**Before (Lines 796-808):** Generic detection instructions

**After (Lines 796-830):** Specific visual cues:

```
1. CREASES (Fold Lines) ⚠️ MOST COMMONLY MISSED DEFECT ⚠️

**What creases look like:**
- Visible LINE running across card (straight, curved, or angular)
- Line appears as DEPRESSION or VALLEY in card surface
- SHADOW running along the fold line (one side darker)
- BREAK in reflection pattern (gloss interrupted along line)
- DISTORTION of printed image along the line
- Color CHANGE along fold (paper fibers exposed, appears lighter/whiter)
- Two parallel lines (fold creates a ridge with two edges)

**Common crease locations to check:**
- Mid-card horizontal (handling crease from gripping card)
- Diagonal corner-to-corner (corner fold from impact)
- Vertical center (storage fold from bending)
- Near corners (dog-ear folds)
- Near edges (edge creases from handling)

**Detection protocol:**
1. Scan ENTIRE card surface in horizontal strips (top to bottom)
2. Look specifically for:
   - ANY straight or curved lines crossing the card
   - Breaks in surface gloss pattern
   - Shadow lines or depth changes
   - Distortion in printed image
   - White lines (exposed paper fibers)
   - Areas where card appears to have "depth" or dimension
3. If you see ANY of these indicators → Mark as crease
```

Added 7 specific visual indicators the AI can detect using vision analysis.

---

### Fix 4: Systematic Zone-by-Zone Scanning

**Before:** "Scan entire surface"

**After (Lines 850-888):** Zone-by-zone grid system:

```
**STEP 1: FULL SURFACE SCAN (FRONT)** - MANDATORY, DO NOT SKIP
Divide the front into 9 zones and scan each systematically:

┌─────────┬─────────┬─────────┐
│ Zone 1  │ Zone 2  │ Zone 3  │  ← Top third
├─────────┼─────────┼─────────┤
│ Zone 4  │ Zone 5  │ Zone 6  │  ← Middle third
├─────────┼─────────┼─────────┤
│ Zone 7  │ Zone 8  │ Zone 9  │  ← Bottom third
└─────────┴─────────┴─────────┘

For EACH zone, look for:
1. Straight or curved LINES crossing the surface
2. SHADOWS running along lines (indicating depth/fold)
3. BREAKS in glossy reflection pattern
4. DISTORTION of printed elements
5. COLOR CHANGES (lighter/whiter lines)
6. DEPTH variations (valleys or ridges)

**Common areas where creases hide:**
- Under player's face/body (blend with shadows)
- In dark background areas (hard to see)
- Along printed lines (blend with design)
- In text/stat boxes (mistaken for printing)
```

Forces the AI to scan methodically instead of just "glancing" at the card.

---

### Fix 5: High-Risk Area Double-Check

**Added (Lines 883-888):**
```
**STEP 3: HIGH-RISK AREA DOUBLE-CHECK**
Re-examine these high-probability crease locations:
- Mid-card horizontal (50% of creases found here)
- Corner diagonals (corner fold damage)
- Near top edge (handling damage)
- Near bottom edge (storage damage)
```

Directs AI to re-check the most common crease locations as a second pass.

---

## Expected Results

### Test Case 1: Your Card (Bent Corner + Crease)

**Before Fix:**
```json
{
  "defects": {
    "front": {
      "corners": {
        "top_left": {
          "severity": "moderate",
          "description": "Top-left corner is bent and does not lie flat."
        }
      },
      "surface": {
        "creases": {
          "severity": "none",
          "description": "No visible creases."
        }
      }
    }
  },
  "recommended_grade": {
    "recommended_decimal_grade": 8.0  ❌
  }
}
```

**After Fix:**
```json
{
  "defects": {
    "front": {
      "corners": {
        "top_left": {
          "severity": "moderate",
          "description": "Top-left corner is bent and does not lie flat."
        }
      },
      "surface": {
        "creases": {
          "severity": "moderate",  ← Hopefully detected now
          "description": "Visible crease on front surface [location]"
        }
      }
    }
  },
  "recommended_grade": {
    "recommended_decimal_grade": 4.0,  ✅
    "grade_cap_reason": "Bent corner detected - structural damage cap 4.0"
  }
}
```

---

## Testing Checklist

### Test 1: Bent Corner Cap Application

- [ ] System detects bent corner in description
- [ ] STEP 0 checks corner descriptions and sets automatic_cap = 4.0
- [ ] STEP 7 applies cap: final_grade = MIN(calculated, 4.0)
- [ ] STEP 8 validates and catches if missed
- [ ] Final grade ≤ 4.0
- [ ] grade_cap_reason mentions bent corner

### Test 2: Crease Detection

- [ ] System scans card in 9 zones
- [ ] Checks high-risk areas (mid-card horizontal, corners)
- [ ] Looks for 7 visual indicators (lines, shadows, breaks, etc.)
- [ ] Detects crease and marks severity ≠ "none"
- [ ] Triggers 4.0 cap
- [ ] Final grade ≤ 4.0

### Test 3: Both Present (Your Card)

- [ ] Detects bent corner
- [ ] Detects crease
- [ ] Either one should trigger 4.0 cap
- [ ] Final grade = 4.0 (not 8.0)
- [ ] Professional estimates align (4-5 range)

---

## Why These Fixes Should Work

### Issue 1: Bent Corner Cap

**Previous Problem:** Vague instruction "check corner descriptions"

**Fix:**
1. Explicitly lists all 8 corners by name
2. Uses the exact phrase AI outputs: "does not lie flat"
3. Triple redundancy: STEP 0 + STEP 7 + STEP 8
4. Added working example with exact text

**Why it works:** The AI now sees explicit pattern matching with the exact text it outputs.

---

### Issue 2: Crease Detection

**Previous Problem:** Generic "look for creases" instruction

**Fix:**
1. 7 specific visual indicators (shadows, lines, breaks, depth, color)
2. Zone-by-zone systematic scan (can't miss entire zones)
3. High-risk area double-check (mid-card horizontal, corners)
4. Examples of where creases hide (dark areas, player face)

**Why it works:**
- Visual indicators match what vision models CAN detect (shadows, color changes, pattern breaks)
- Systematic scanning prevents "glancing" behavior
- High-probability area focus increases detection rate

---

## Files Modified

1. **`prompts/card_grader_v1.txt`**
   - Lines 796-830: Enhanced crease visual detection cues
   - Lines 850-888: Added zone-by-zone scanning protocol
   - Lines 890-894: Updated corner examination (now STEP 4)
   - Lines 896-914: Updated crease/bent corner action (now STEP 5)
   - Lines 2018-2034: Explicit bent corner cap check (all 8 corners)
   - Lines 2098-2117: Enhanced STEP 8 validation with example

---

## Validation Strategy

After re-grading your card:

1. **Check defects output:**
   - Is bent corner still detected? Should be "Top-left corner is bent and does not lie flat"
   - Is crease now detected? Should have severity ≠ "none"

2. **Check grade calculation:**
   - What is recommended_decimal_grade? Should be ≤ 4.0
   - What is grade_cap_reason? Should mention structural damage

3. **Check professional estimates:**
   - PSA estimate? Should be ~4
   - BGS estimate? Should be ~4
   - Alignment better than before?

4. **If still failing:**
   - Provide the full JSON output
   - Describe what the crease looks like (location, appearance)
   - We may need to add the specific visual pattern to detection instructions

---

## Additional Notes

**Bent Corner vs Corner Whitening:**
- **Bent corner** = Corner doesn't lie flat, raised/warped → 4.0 cap
- **Corner whitening** = Wear at tip, but still flat → Normal grading (9.0-9.5)

Make sure the AI is detecting BENT corners (structural damage) not just rounded corners (wear).

**Crease vs Surface Scratch:**
- **Crease** = Fold line through paper with depth → 4.0 cap
- **Scratch** = Surface coating damage, no depth → Normal grading

The visual indicators (shadow, depth, valley) should distinguish these.

---

**Document Version:** 1.0
**Date:** 2025-10-15
**Status:** ✅ Fixes Implemented - Ready for Testing
