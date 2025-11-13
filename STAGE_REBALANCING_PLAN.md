# Stage Rebalancing Plan - October 15, 2025

## Problem Statement

### Current State (Broken)

**Stage 1:** 2,509 lines, 123 KB ⚠️ TOO LARGE
- Trying to do everything: detection, validation, calculation
- AI gets overwhelmed and skips critical checks
- Card with clear edge defects → **10.0 grade** ❌

**Stage 2:** 1,397 lines, ~70 KB
- Under-utilized
- Should be the "defect hunter" but isn't comprehensive enough

### Root Causes

1. **Prompt Bloat**: Stage 1 has grown too large trying to catch every edge case
2. **Divided Focus**: AI has too many instructions and can't follow them all
3. **Detection Failures**: More instructions ≠ better detection (actually worse)
4. **Wrong Architecture**: Stage 1 doing detailed work that Stage 2 should do

---

## Solution: Stage Rebalancing

### Design Philosophy

**Stage 1 = "Quick Triage"**
- Fast preliminary assessment (30-45 seconds)
- Flag obvious issues
- Rough grade estimate
- **Does NOT need to be perfect** - Stage 2 will catch everything

**Stage 2 = "Comprehensive Defect Hunter"**
- Systematic inspection (60-90 seconds)
- Catches everything Stage 1 missed
- **Final authoritative grade**
- This is where accuracy matters

---

## Stage 1: Simplified (Target: ~1000 lines, ~50 KB)

### What Stage 1 SHOULD Do

#### **1. Card Identification (Keep)**
- Card name, player, set, year, manufacturer
- Sport/category
- Rarity features (autograph, serial, memorabilia)
- Slab detection

#### **2. Automatic Caps ONLY (Keep)**
- Unverified autograph → N/A
- Handwritten markings → N/A
- Crease detected → 4.0 cap
- Bent corner detected → 4.0 cap

#### **3. Rough Preliminary Assessment (Simplified)**
- Corners: Quick glance, flag if obvious damage
- Edges: Quick scan, flag if obvious whitening
- Surface: Quick check, flag if obvious scratches/creases
- Centering: Measure and cap if needed

#### **4. Suspected Defect Flagging (NEW)**
- List areas that need Stage 2 investigation
- Example: "Bottom edge appears to have possible whitening - Stage 2 should examine"
- Example: "Top left corner may have minor wear - Stage 2 should verify"

#### **5. Preliminary Grade Estimate**
- Rough calculation based on what was found
- **Accept that this may be inaccurate** - Stage 2 will correct

### What Stage 1 Should NOT Do (Remove)

❌ Detailed 9-zone surface scanning
❌ Detailed 5-segment edge scanning
❌ Microscopic defect classification
❌ Extensive artifact detection protocols
❌ Long validation checklists
❌ Grade 10.0 paranoia sections

**Philosophy:** If Stage 1 assigns 10.0 but should be 8.0, that's OK - Stage 2 will catch it and adjust.

---

## Stage 2: Enhanced (Target: ~2000 lines, ~100 KB)

### What Stage 2 SHOULD Do

#### **1. Validate Stage 1 Findings**
- Check suspected defects Stage 1 flagged
- Confirm or reject Stage 1's preliminary assessment

#### **2. Systematic Edge Inspection (ENHANCED)**

**Current (Insufficient):**
- Basic instructions to check edges

**Enhanced (Comprehensive):**
```
EDGE INSPECTION PROTOCOL:

For EACH of 4 edges (top, bottom, left, right) on front AND back:

Divide edge into 5 equal segments:
  Top Edge: T1 [left] | T2 | T3 [center] | T4 | T5 [right]
  Bottom Edge: B1 [left] | B2 | B3 [center] | B4 | B5 [right]
  Left Edge: L1 [top] | L2 | L3 [middle] | L4 | L5 [bottom]
  Right Edge: R1 [top] | R2 | R3 [middle] | R4 | R5 [bottom]

For EACH segment:
1. Zoom to Level 2 (medium magnification)
2. Scan LEFT TO RIGHT (or TOP TO BOTTOM for vertical edges)
3. Look for:
   - White dots (0.1-0.5mm isolated spots)
   - Continuous whitening (linear bands)
   - Edge chipping (material loss)
   - Roughness (uneven texture)
4. Document:
   - Count of white dots per segment
   - Length of continuous whitening (if any)
   - Severity: none, minor (<3 dots), moderate (3-5 dots), heavy (>5 dots or chipping)

OUTPUT SCHEMA:
{
  "edges_detailed": {
    "front_top": {
      "segments": {
        "T1": { "white_dot_count": 2, "whitening_length_mm": 0, "severity": "minor" },
        "T2": { "white_dot_count": 0, "whitening_length_mm": 0, "severity": "none" },
        "T3": { "white_dot_count": 1, "whitening_length_mm": 0, "severity": "minor" },
        "T4": { "white_dot_count": 0, "whitening_length_mm": 0, "severity": "none" },
        "T5": { "white_dot_count": 0, "whitening_length_mm": 0, "severity": "none" }
      },
      "total_defect_count": 3,
      "worst_segment": "T1",
      "overall_condition": "minor_defect"
    }
  }
}

BOTTOM EDGE PRIORITY:
- Bottom edge is MOST commonly damaged (60-70% of edge defects)
- If you find ZERO defects on bottom edge, RECHECK - you likely missed something
- Common bottom edge locations: B2, B3, B4 (center segments)
```

#### **3. Systematic Corner Inspection (ENHANCED)**

**Enhanced Protocol:**
```
CORNER INSPECTION PROTOCOL:

For EACH of 8 corners (4 front + 4 back):

1. Zoom to Level 3 (maximum magnification)
2. Examine corner TIP (90° point)
3. Examine corner EDGES (2mm radius around tip)
4. Look for:
   - Whitening at tip (exposed white cardstock)
   - Rounding (loss of sharp 90° angle)
   - Bent/raised corner (doesn't lie flat)
   - Creases radiating from corner
5. Measure:
   - Whitening size (mm)
   - Rounding radius (mm)
6. Document:
   - Defect type, size, severity
   - Compare to Stage 1 findings

BOTTOM CORNERS PRIORITY:
- Bottom corners are MOST commonly damaged
- Bottom-left and bottom-right should be examined with extra scrutiny
```

#### **4. Systematic Surface Inspection (ENHANCED)**

**Enhanced Protocol:**
```
SURFACE INSPECTION PROTOCOL:

Divide surface into 9 zones (3x3 grid):

Front:
┌─────────┬─────────┬─────────┐
│ Zone 1  │ Zone 2  │ Zone 3  │  Top third
├─────────┼─────────┼─────────┤
│ Zone 4  │ Zone 5  │ Zone 6  │  Middle third
├─────────┼─────────┼─────────┤
│ Zone 7  │ Zone 8  │ Zone 9  │  Bottom third
└─────────┴─────────┴─────────┘

For EACH zone:
1. Zoom to Level 2
2. Scan zone for:
   - Scratches (lines)
   - Print defects (dots, hickeys, misregistration)
   - Stains/discoloration
   - Creases (fold lines)
   - Surface damage (dents, indentations)
3. Document each defect found with:
   - Type, location within zone, size, severity

CREASE DETECTION (CRITICAL):
- Creases are MOST COMMONLY MISSED defect
- Look for: lines, shadows, depth changes, gloss breaks
- Common locations: Zone 5 (mid-card horizontal), diagonal across zones
- ANY crease found → automatic 4.0 cap

HIGH-RISK ZONES:
- Zone 7, 8, 9 (bottom third) - most commonly damaged
- If these show ZERO defects, recheck - you likely missed something
```

#### **5. Cross-Stage Validation**

```
VALIDATION PROTOCOL:

For EACH suspected defect from Stage 1:
1. Locate the exact area mentioned
2. Zoom in appropriately
3. Verify:
   ✅ CONFIRMED: Defect exists as Stage 1 suspected
   ⚠️ DIFFERENT: Defect exists but different severity than Stage 1
   ❌ NOT FOUND: No defect visible (Stage 1 false positive)

For EACH area Stage 1 marked "no defects":
1. Still examine it systematically
2. Document if you find defects Stage 1 missed

OUTPUT:
{
  "stage_consistency_check": {
    "corners_match": true/false,
    "corners_inconsistencies": ["Stage 1 suspected whitening at top_left - confirmed 0.15mm"],
    "edges_match": true/false,
    "edges_inconsistencies": ["Stage 1 missed white dots on bottom edge - found 4 dots in B3 segment"],
    "overall_consistency": "consistent" | "minor_discrepancies" | "major_discrepancies"
  }
}
```

#### **6. Final Grade Determination**

```
FINAL GRADE CALCULATION:

1. Calculate grade based on Stage 2 detailed findings
2. Compare to Stage 1 preliminary grade
3. If different:
   - Document reason for adjustment
   - Explain what Stage 1 missed or overcounted
4. Apply automatic caps (crease, bent corner, etc.)
5. Output final authoritative grade

Stage 2 grade is ALWAYS the final grade (not Stage 1).
```

---

## Implementation Strategy

### Phase 1: Immediate (This Week)

1. ✅ Add FINAL SAFETY CHECK to Stage 1 (done)
2. ⏳ Enhance Stage 2 edge inspection (systematic 5-segment protocol)
3. ⏳ Test with your problem cards (10.0 card, 8.0 bent corner card)

### Phase 2: Stage 1 Simplification (Next Week)

1. Remove detailed inspection protocols from Stage 1
2. Keep only caps + rough assessment + suspected defect flagging
3. Target: Reduce Stage 1 from 2500 lines to ~1000 lines

### Phase 3: Stage 2 Enhancement (Following Week)

1. Add systematic corner inspection (8 corners, Level 3 zoom)
2. Add systematic surface inspection (9 zones)
3. Add comprehensive cross-stage validation
4. Target: Expand Stage 2 from 1400 lines to ~2000 lines

### Phase 4: Testing & Validation

1. Test with diverse card types (clean, damaged, edge defects, creases)
2. Verify Stage 2 catches what Stage 1 misses
3. Validate professional grade alignment
4. Monitor for false positives/negatives

---

## Success Metrics

### Before Rebalancing

- Stage 1: 2509 lines (too large)
- Card with edge defects → 10.0 grade ❌
- Card with bent corner → 8.0 grade ❌
- Crease detection: Inconsistent
- Professional grade alignment: Poor

### After Rebalancing (Target)

- Stage 1: ~1000 lines (lean triage)
- Stage 2: ~2000 lines (comprehensive)
- Card with edge defects → Stage 1 may miss → Stage 2 catches → Correct grade ✅
- Card with bent corner → Stage 1 flags → Stage 2 confirms → 4.0 cap applied ✅
- Crease detection: Stage 2 systematic scan → High detection rate ✅
- Professional grade alignment: Stage 2 accuracy → Better alignment ✅

---

## Risk Mitigation

### Risk 1: Stage 1 becomes "too simple"

**Mitigation:** Stage 1 still does caps (crease, bent corner, alterations). These are critical and won't be missed.

### Risk 2: Stage 2 takes too long

**Mitigation:** Stage 2 already runs (currently ~60s). Enhanced inspection may add 30s, but total time still acceptable (~90s).

### Risk 3: Stage 1-2 inconsistencies

**Mitigation:** Cross-stage validation in Stage 2 explicitly documents discrepancies and explains them.

---

## Alternative Considered: Single-Stage System

**Rejected because:**
- Would require a massive 3000-4000 line prompt (too large)
- Single call would take 120-150 seconds (too slow)
- Harder to debug when issues occur
- Loss of preliminary estimate (users want quick feedback)

**Two-stage system is correct architecture** - we just need to balance it properly.

---

## Next Steps

**Immediate (Today):**
1. ✅ Added FINAL SAFETY CHECK to Stage 1
2. Test your 10.0 card again - does it now catch edge defects?

**Short Term (This Week):**
1. Enhance Stage 2 with systematic edge inspection
2. Test with your problem cards
3. Document results

**Long Term (Next 2 Weeks):**
1. Simplify Stage 1 (remove detailed protocols)
2. Fully enhance Stage 2 (corners, surface, validation)
3. Full testing suite

---

**Should we proceed with Phase 1 (Stage 2 edge enhancement) now?**

This would add the systematic 5-segment edge scanning to Stage 2, ensuring edge defects are caught even if Stage 1 misses them.

---

**Document Version:** 1.0
**Date:** 2025-10-15
**Status:** 🟡 Plan Created - Awaiting Approval
