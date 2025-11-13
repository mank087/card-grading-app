# CENTERING LOGIC FIX - Off-Center False Positive

## Issue Reported
Card with centering measurements **55/45 front** and **50/50 back** was incorrectly flagged as **off_center_detected = TRUE**.

## Root Cause
The evaluation instructions had ambiguous logic for determining off-center detection. The AI was misinterpreting ratio comparisons like `> 60/40`.

## Fix Applied

### **Updated: sports_evaluation_instructions.txt**

**OLD (Ambiguous)**:
```
IF front_x_axis_ratio > 60/40 OR front_y_axis_ratio > 60/40:
    off_center_detected = true
```

**NEW (Explicit)**:
```
# Off-center rule: >10% deviation on front

EXPLICIT RATIO RULES:
IF front ratio is "50/50": off_center_detected = FALSE
IF front ratio is "55/45": off_center_detected = FALSE
IF front ratio is "60/40": off_center_detected = FALSE
IF front ratio is "65/35": off_center_detected = TRUE  ← THRESHOLD
IF front ratio is "70/30": off_center_detected = TRUE
IF front ratio is "75/25": off_center_detected = TRUE
IF front ratio is "80/20": off_center_detected = TRUE
IF front ratio is "85/15": off_center_detected = TRUE
IF front ratio is "90/10": off_center_detected = TRUE
```

### **Updated: sports_assistant_instructions.txt**

**OLD (Vague)**:
```
off_center_detected: Are borders obviously uneven (one side much thicker than opposite)?
```

**NEW (Explicit)**:
```
off_center_detected: Is the card off-center beyond acceptable limits?

CRITICAL RULE: If front centering is 50/50, 55/45, or 60/40, mark NO (these are acceptable).
Only mark YES if front centering is 65/35 or worse.
```

## Centering Thresholds Clarified

### **Acceptable Centering** (NOT off-center):
- ✅ **50/50** - Perfect centering (0% deviation)
- ✅ **55/45** - Excellent centering (5% deviation)
- ✅ **60/40** - Very good centering (10% deviation)

### **Off-Center** (defect detected):
- ❌ **65/35** - Off-center starts here (15% deviation)
- ❌ **70/30** - Significantly off-center (20% deviation)
- ❌ **75/25** - Very off-center (25% deviation)
- ❌ **80/20** - Severely off-center (30% deviation)
- ❌ **85/15** - Extremely off-center (35% deviation)
- ❌ **90/10** - Miscut territory (40% deviation)

### **Miscut Threshold**:
- ❌ **90/10 or worse** - Triggers miscut_detected flag

## Grading Impact

### **Starting Grade by Centering**:
| Front Ratio | Back Ratio | Starting Grade | Off-Center Flag |
|-------------|------------|----------------|-----------------|
| 50/50 or 55/45 | ≤60/40 | **10** (Pristine) | NO ✅ |
| 60/40 | ≤80/20 | **9** (Mint) | NO ✅ |
| 65/35 | ≤85/15 | **8** (NM-MT) | YES ❌ |
| 70/30 | ≤90/10 | **7** (Near Mint) | YES ❌ |
| 75/25 | Any | **6** (EX-MT) | YES ❌ |
| 80/20 | Any | **5** (Excellent) | YES ❌ |
| 85/15 | Any | **4** (VG-EX) | YES ❌ |
| 90/10 | Any | **3** (Very Good) | YES ❌ + Miscut |

## Testing

### **Test Case: Your Card**
- **Measurements**: 55/45 front, 50/50 back
- **Expected**:
  - `off_center_detected = FALSE` ✅
  - `miscut_detected = FALSE` ✅
  - Starting Grade = **10** (Pristine centering)

### **Verification Steps**:
1. Delete the incorrectly graded card
2. Re-upload the same card images
3. Check that `off_center_detected = false` in results
4. Verify starting grade is based on centering (should be 10)

## Files Modified

1. **sports_evaluation_instructions.txt** (Tier 2 - Stage 2)
   - Added explicit ratio rules with examples
   - Clarified deviation percentage calculations

2. **sports_assistant_instructions.txt** (Legacy single-stage)
   - Added critical rule with specific ratio thresholds
   - Removed vague "obviously uneven" language

## Impact

**Before Fix**:
- ❌ 55/45 centering flagged as off-center
- ❌ Incorrect starting grade penalty
- ❌ User confusion about "good" centering being marked as defect

**After Fix**:
- ✅ 55/45 correctly recognized as excellent centering
- ✅ Proper Grade 10 starting grade for 55/45 front / ≤60/40 back
- ✅ Clear threshold at 65/35 for off-center detection

## Next Card Test

When you grade the next card:
1. Watch for `off_center_detected` flag in results
2. If centering is 50/50, 55/45, or 60/40 → should be **FALSE**
3. If centering is 65/35 or worse → should be **TRUE**

## Date Applied
2025-09-30

---

**STATUS**: ✅ FIXED - Ready for testing
