# Grading Scale Update: Whole Numbers + 9.5 Exception

**Date**: 2025-11-05
**Status**: ✅ COMPLETE - Active immediately

## Summary

Updated both Pokemon and Sports card grading prompts to enforce whole number grades with 9.5 as the only allowed half-point grade.

## Changes Made

### Valid Grade Scale (NEW)
```
10.0, 9.5, 9.0, 8.0, 7.0, 6.0, 5.0, 4.0, 3.0, 2.0, 1.0, 0.0
```

### Invalid Grades (Now Blocked)
```
9.7, 9.8, 9.9, 8.5, 7.5, 6.5, or any other decimal (except 9.5)
```

## Technical Implementation

### 1. Final Grade Rounding Rule (NEW)
Added to both prompts after weighted score calculation:

**Location**:
- Pokemon: `prompts/pokemon_conversational_grading_v4_2.txt` (Line 1586-1603)
- Sports: `prompts/conversational_grading_v4_2_ENHANCED_STRICTNESS.txt` (Line 1481-1498)

**Rule**:
```
• If grade >= 9.25 and < 9.75 → Round to 9.5 (ONLY allowed half-point grade)
• If grade >= 9.75 → Round to 10.0
• If grade >= 8.5 and < 9.25 → Round to 9.0
• If grade >= 7.5 and < 8.5 → Round to 8.0
• ... (continues for all whole numbers)
```

### 2. Conservative Rounding Rule (UPDATED)
Modified to only apply to 9.5 grade:

**Before**:
```
Condition: Grade ends in .5 (e.g., 9.5, 8.5, 7.5)
AND uncertainty exists (Confidence B/C/D)
Action: Round DOWN to next lower half-point
```

**After**:
```
Condition: Grade = 9.5 (only half-point grade in system)
AND uncertainty exists (Confidence B/C/D)
Action: Round DOWN to 9.0
```

**Location**:
- Pokemon: Line 1665-1669
- Sports: Line 1560-1564

## Why This Change?

### Previous Behavior (v4.2)
- Weighted scoring allowed 0.1 increments (9.7, 9.8, 9.9)
- Example: (0.55 × 10.0) + (0.45 × 9.5) = 9.775 → rounded to 9.8
- This followed TAG grading company standard (0.1 precision)

### Industry Standards
| Company | Scale |
|---------|-------|
| **PSA** | Whole numbers (1-10) |
| **BGS** | Half-points (9.0, 9.5, 10.0) |
| **SGC** | 1-10 or 1-100 |
| **TAG** | 0.1 increments (9.6, 9.7, 9.8) |

### New Approach
- Hybrid scale: Whole numbers + 9.5 exception
- Cleaner, more intuitive for users
- 9.5 serves as "premium near-mint" between 9.0 and 10.0
- Eliminates confusion around 9.7 vs 9.8 distinctions

## Example Grade Conversions

| Old Weighted Score | New Final Grade |
|-------------------|-----------------|
| 9.775 (previously 9.8) | **10.0** |
| 9.700 (previously 9.7) | **9.5** |
| 9.500 | **9.5** |
| 9.300 (previously 9.3) | **9.5** |
| 9.200 (previously 9.2) | **9.0** |
| 8.700 (previously 8.7) | **9.0** |
| 8.600 (previously 8.6) | **9.0** |
| 8.400 (previously 8.4) | **8.0** |

## Activation Status

✅ **ACTIVE IMMEDIATELY** - No deployment required

The system reads prompts directly from files at runtime:
- `src/lib/visionGrader.ts` lines 1244-1249
- Pokemon cards use `pokemon_conversational_grading_v4_2.txt`
- Sports cards use `conversational_grading_v4_2_ENHANCED_STRICTNESS.txt`

**Next card graded will use the new scale automatically.**

## Testing Recommendations

1. **Grade a test Pokemon card** - Verify it receives whole number or 9.5
2. **Grade a test Sports card** - Verify same behavior
3. **Check cards that previously got 9.7** - Should now get either 9.5 or 10.0
4. **Review existing cards** - Database won't auto-update, only new gradings affected

## Backward Compatibility

### Existing Cards
- Cards already graded with 9.7, 9.8, etc. remain unchanged in database
- Display logic will still show these grades correctly
- Only NEW gradings will use the updated scale

### Condition Labels
No changes needed - the existing label mapping still works:

```
9.6-10.0 = Gem Mint (GM)
9.0-9.5 = Mint (M)
```

Note: With new scale, only 9.5 and 10.0 can achieve "Gem Mint" label.

## Files Modified

1. ✅ `prompts/pokemon_conversational_grading_v4_2.txt`
   - Added final grade rounding rule (lines 1586-1603)
   - Updated conservative rounding rule (lines 1665-1669)

2. ✅ `prompts/conversational_grading_v4_2_ENHANCED_STRICTNESS.txt`
   - Added final grade rounding rule (lines 1481-1498)
   - Updated conservative rounding rule (lines 1560-1564)

## Related Documentation

- Old system: `prompts/card_grader_v1 - backup before simplification.txt` (used 0.5 increments)
- Current system architecture: `SYSTEM_ARCHITECTURE_CURRENT.md`
- v4.2 implementation: `V4_2_DEPLOYMENT_GUIDE.md`
