# Grading Instruction Hardening - Implementation Plan
**Date**: 2025-10-19
**Problem**: System giving 10/10 grades when ChatGPT correctly identifies 9.0 cards
**Root Cause**: Instructions allow AI to ASSUME perfection instead of PROVING absence of defects
**Solution**: Implement hard gates, forced micro-sweeps, and safety defaults per ChatGPT forensic analysis

---

## Executive Summary

ChatGPT's forensic review identified the core issue: **our system has a "loose proof standard"** that allows the AI to assume perfection if it doesn't explicitly see a flaw, rather than requiring proof of zero defects.

**Key Finding**: The problem is NOT temperature (low temp is actually BETTER for accuracy). The problem is that the instructions don't FORCE the AI to do systematic micro-defect sweeps and don't have hard gates blocking 10.0 grades.

---

## The 6 Critical Gaps Identified by ChatGPT

1. **Loose "zero-defect" proof standard** - AI assumes perfection unless proven otherwise
2. **Missing "Perfect-Grade Gate"** - No hard checklist blocking 10.0
3. **Under-specified micro-defect hunt** - No forced per-corner, per-edge, per-zone sweeps
4. **Glare forgiveness without cross-side proof** - Foil glare dismissed without verification
5. **Centering tolerance too wide** - Models lean to "50/50" without measurement
6. **No safety defaults** - When uncertain, doesn't default to LOWER grade

---

## Implementation Steps

### STEP 1: Revert Temperature Change ✅ URGENT

**Action**: Change temperature from 0.7 (my incorrect suggestion) back to 0.2 (stricter than original 0.3)

**File**: `src/app/api/vision-grade/[id]/route.ts` line 253

**Change**:
```typescript
temperature: 0.2 // STRICTEST - Forces deterministic, cautious grading with hard gates
// Low temperature (0.0-0.2) + strict instructions = accurate defect detection
// High temperature allows optimistic language and grade inflation
```

**Why**: ChatGPT correctly identified that low temperature is GOOD when paired with strict instructions. The issue was the instructions were too permissive, not that the temperature was too low.

---

### STEP 2: Add Perfect-Grade Gate to System Prompt

**Action**: Insert a mandatory gate that blocks 10.0 unless ALL conditions are met

**File**: `prompts/card_grader_v1.txt`

**Where to insert**: Right before the final grade calculation section (search for "recommended_decimal_grade")

**Text to add**:

```
═══════════════════════════════════════════════════════════════════════════════
PERFECT-GRADE GATE (MANDATORY - DO NOT SKIP)
═══════════════════════════════════════════════════════════════════════════════

⚠️ YOU MAY NOT OUTPUT 10.0 UNLESS ALL OF THE FOLLOWING ARE TRUE AND EXPLICITLY DOCUMENTED:

REQUIRED PROOFS FOR GRADE 10.0:

[ ] Eight-corner audit completed
    - ALL 8 corners (4 front + 4 back) individually described using Universal Severity Scale
    - ALL 8 corners recorded as "NONE" (zero defects) or at most "microscopic" (<0.1mm)
    - Any corner with "microscopic or none" MUST have measurement attempt documented
    - If measurement impossible due to image quality, AUTOMATIC CAP at 9.5

[ ] Four-edge audit completed (per side)
    - ALL 4 edges (top, right, bottom, left) on BOTH sides individually described
    - ALL 8 edge segments recorded with severity using Universal Severity Scale
    - Factory roughness explicitly checked and recorded (yes/no) for each edge
    - Any edge with chips, whitening, or roughness CAPS grade at 9.5 maximum

[ ] Two-axis centering measured and reported
    - BOTH horizontal (left/right) AND vertical (top/bottom) measured on front
    - BOTH axes measured and reported on back
    - Measurements reported in exact ratio format (e.g., "51/49" NOT "approximately centered")
    - WORST axis must be between 50/50 and 55/45 inclusive for 10.0
    - If centering unmeasurable or estimated, AUTOMATIC CAP at 9.5

[ ] Cross-side verification performed
    - Any line, band, spot, or suspected artifact on front checked at same coordinates on back
    - If present on BOTH sides → structural crease → cap at 4.0
    - If front-only and gloss intact → surface scratch → cap at 9.5
    - If back check inconclusive → SAFETY DEFAULT → cap at 9.0, uncertainty ≥ 0.3

[ ] Image quality sufficient for micro-defect detection
    - Resolution explicitly stated as "sufficient to detect <0.1mm whitening"
    - Glare explicitly assessed and stated as "minimal" or "does not obscure corners/edges"
    - If ANY area obscured by glare/blur/shadow → AUTOMATIC CAP at 9.5
    - If image quality prevents confident micro-defect detection → AUTOMATIC CAP at 9.0

═══════════════════════════════════════════════════════════════════════════════
CRITICAL: IF ANY CHECKBOX CANNOT BE PROVEN TRUE FROM THE IMAGES:
- You MUST cap final grade at 9.5 maximum
- You MUST set grade_uncertainty ≥ 0.2
- You MUST document which proof failed in the analysis
═══════════════════════════════════════════════════════════════════════════════

STATISTICAL REALITY CHECK:
Across modern card production, fewer than 1 in 100 cards should grade 10.0.
If the images are typical phone photos or contain ANY glare, the realistic rate is 0 in 100.
Your outputs MUST reflect this statistical reality.

⚠️ IF YOU FIND YOURSELF WANTING TO ASSIGN 10.0:
1. STOP immediately
2. Re-examine EVERY corner, edge, and surface zone at highest scrutiny
3. Re-read the Perfect-Grade Gate checklist
4. Ask: "Can I PROVE all 5 requirements are met beyond doubt?"
5. If ANY doubt exists → grade is 9.5 maximum
```

---

### STEP 3: Add Micro-Defect Sweep Protocol

**Action**: Force explicit, systematic corner/edge/surface inspection with required output format

**File**: `prompts/card_grader_v1.txt`

**Where to insert**: In the defect detection section (search for "corners" or "edges")

**Text to add**:

```
═══════════════════════════════════════════════════════════════════════════════
MICRO-DEFECT SWEEP PROTOCOL (MANDATORY - DO NOT SKIP)
═══════════════════════════════════════════════════════════════════════════════

You MUST perform the following systematic sweeps in this EXACT order.
Do NOT skip any step. Do NOT summarize multiple items together.

────────────────────────────────────────────────────────────────────────────
PART 1: CORNER SWEEP (8 corners total)
────────────────────────────────────────────────────────────────────────────

Inspect in this EXACT order:
  FRONT: Top-Left → Top-Right → Bottom-Right → Bottom-Left
  BACK:  Top-Left → Top-Right → Bottom-Right → Bottom-Left

For EACH corner, you MUST record ALL of the following:

{
  "corner_id": "front_top_left",
  "whitening_mm": <number|null>,      // Measure in millimeters; null if none visible
  "whitening_severity": "none"|"microscopic"|"minor"|"moderate"|"significant"|"severe",
  "rounding_visible": true|false,     // Corner tip rounded/soft instead of sharp
  "rounding_radius_mm": <number|null>, // Estimate radius if rounded
  "lift_or_bent": true|false,         // Corner lifted or bent
  "notes": "string"                   // Describe what you see
}

**CORNER RULES:**
- If whitening is SUSPECTED but unmeasurable due to glare/pixelation → classify as "minor by safety default" and reduce maximum grade to 9.5
- If corner appears perfect but image quality is insufficient to detect <0.1mm defects → classify as "microscopic by safety default" and reduce maximum grade to 9.5
- ANY visible whitening or rounding → corner category caps at 9.5 maximum
- If 2+ corners have defects → corner category caps at 9.0 maximum

────────────────────────────────────────────────────────────────────────────
PART 2: EDGE SWEEP (8 edge segments total)
────────────────────────────────────────────────────────────────────────────

Inspect in this EXACT order:
  FRONT: Top → Right → Bottom → Left
  BACK:  Top → Right → Bottom → Left

For EACH edge, you MUST record ALL of the following:

{
  "edge_id": "front_bottom",
  "chips_count": <integer>,           // Count of visible chips/nicks
  "chips_severity": "none"|"microscopic"|"minor"|"moderate"|"significant"|"severe",
  "longest_chip_mm": <number|null>,   // Size of largest chip
  "whitening_dots_count": <integer>,  // Count of white dots on edge line
  "abrasion_length_mm": <number|null>, // Length of wear/abrasion if present
  "factory_roughness": true|false,    // Rough/jagged edge (factory defect)
  "notes": "string"
}

**EDGE RULES:**
- If ANY chips, whitening dots, or factory roughness → edge category caps at 9.5 maximum
- If chips/roughness exceeds 0.2mm or affects 2+ edges → edge category caps at 9.0 maximum
- Bottom edge is MOST LIKELY location for defects (check with extra scrutiny)
- If edge appears perfect but image quality insufficient → apply safety default, cap at 9.5

────────────────────────────────────────────────────────────────────────────
PART 3: SURFACE SWEEP (18 zones total)
────────────────────────────────────────────────────────────────────────────

Mentally divide EACH side (front and back) into 3×3 grid (9 zones per side):

  Zone 1  |  Zone 2  |  Zone 3     ← Top row
  --------|----------|--------
  Zone 4  |  Zone 5  |  Zone 6     ← Middle row (Zone 5 = center)
  --------|----------|--------
  Zone 7  |  Zone 8  |  Zone 9     ← Bottom row

For EACH of the 18 zones (9 front + 9 back), you MUST record:

{
  "zone_id": "front_zone_5",
  "scratches_hairline_count": <integer>,     // Count of hairline scratches
  "longest_visible_scratch_mm": <number|null>, // Longest scratch length
  "scratch_severity": "none"|"microscopic"|"minor"|"moderate"|"significant"|"severe",
  "print_dots_count_ge_0.1mm": <integer>,    // Count of print dots ≥0.1mm visible
  "print_dot_severity": "none"|"microscopic"|"minor"|"moderate"|"significant"|"severe",
  "indentations_present": true|false,        // Dents/depressions in surface
  "stains_discoloration": true|false,
  "notes": "string"
}

**SURFACE RULES:**
- ANY visible scratch in Zone 5 (center) → surface category caps at 9.5 maximum
- ANY print dot ≥0.1mm visible → surface category caps at 9.5 maximum
- If 2+ zones have defects → surface category caps at 9.0 maximum
- Holo/foil cards: scratches MORE VISIBLE, grade MORE STRICTLY
- Do NOT dismiss lines/bands as "glare" without cross-side verification (see below)

────────────────────────────────────────────────────────────────────────────
VALIDATION CHECKPOINT
────────────────────────────────────────────────────────────────────────────

After completing all sweeps, validate:
- Did you inspect ALL 8 corners individually? (not "all corners look good")
- Did you inspect ALL 8 edge segments individually?
- Did you inspect ALL 18 surface zones?
- Did you record measurements (mm) for any defects found?
- Did you apply severity classifications using Universal Scale?

If you skipped ANY item → your analysis is INCOMPLETE → restart the sweep.
```

---

### STEP 4: Add Cross-Side Verification Rule

**Action**: Force verification of suspected defects on opposite side

**File**: `prompts/card_grader_v1.txt`

**Where to insert**: After surface defect section

**Text to add**:

```
═══════════════════════════════════════════════════════════════════════════════
CROSS-SIDE VERIFICATION RULE (MANDATORY)
═══════════════════════════════════════════════════════════════════════════════

ANY line, ridge, band, or shadow detected on the front MUST be checked at the exact coordinates on the back.

**VERIFICATION PROTOCOL:**

1. Note the suspected defect location on front (e.g., "horizontal line across center, 15mm from top")
2. Examine the SAME COORDINATES on the back image
3. Apply decision tree:

   ┌─ Present on BOTH front and back?
   │  └─ YES → Mark as "STRUCTURAL CREASE" → Cap final grade at 4.0 maximum
   │  └─ NO → Continue to step 4
   │
   ├─ Front-only AND gloss/finish intact at that location?
   │  └─ YES → Mark as "surface scratch or print line" → Cap surface at 9.5 maximum
   │  └─ NO → Continue to step 5
   │
   └─ Back check inconclusive (glare, blur, or angle prevents verification)?
      └─ Apply SAFETY DEFAULT:
         - Mark as "possible structural defect (unverified)"
         - Cap surface at 9.0 maximum
         - Increase grade_uncertainty by +0.3
         - Document: "Cross-side verification failed due to [reason]"

**FOIL/GLARE DISCIPLINE:**

Do NOT dismiss bright lines or bands on holofoil as "glare" unless you:
  a) Describe the light direction causing the glare
  b) Show the band is continuous and smooth (not jagged or interrupted)
  c) Confirm there is NO corresponding feature on the back at same coordinates

If a bright band intersects printed borders or card edges:
  → Reduce surface to ≤9.5 unless cleared by cross-side proof
  → Document: "Band crosses structural element; likely defect not glare"

**CROSS-SIDE VERIFICATION EXAMPLES:**

✅ CORRECT:
"Horizontal line visible at 12mm from top edge on front. Checked same coordinates on back: line also present. Classification: structural crease. Grade cap: 4.0."

✅ CORRECT:
"Bright diagonal band across Zone 5 on front. Checked back at same coordinates: back surface clean. Light direction consistent with foil glare. Band is smooth and continuous. Classification: glare (non-defect)."

❌ INCORRECT:
"Some bright bands visible on holofoil surface, likely glare." (No cross-side check performed)

❌ INCORRECT:
"Line visible on front, back image has glare so can't verify. Assuming surface scratch." (Should apply safety default and cap at 9.0, not assume)
```

---

### STEP 5: Add Safety Defaults (Binding)

**Action**: Force downward bias when uncertain

**File**: `prompts/card_grader_v1.txt`

**Where to insert**: In the grade calculation section

**Text to add**:

```
═══════════════════════════════════════════════════════════════════════════════
SAFETY DEFAULTS (BINDING - ALWAYS APPLY WHEN UNCERTAIN)
═══════════════════════════════════════════════════════════════════════════════

When faced with uncertainty, you MUST default to the LOWER/SAFER option.
These defaults are MANDATORY and override your judgment.

**DEFAULT RULE 1: Centering Uncertainty**
- If undecided between 50/50 and 51/49 → Record 51/49 and cap centering at ≤9.5
- If undecided between 51/49 and 52/48 → Record 52/48 and cap centering at ≤9.0
- If centering borders are unclear or partially obscured → Round AGAINST the card (wider variance)
- Never report "perfect" or "50/50" without explicit measurement proof

**DEFAULT RULE 2: Defect Severity Uncertainty**
- If undecided between "no whitening" and "microscopic whitening" → Record "microscopic whitening" and cap corners at ≤9.5
- If undecided between "no chip" and "microscopic chip" → Record "microscopic chip" and cap edges at ≤9.5
- If undecided between "clean surface" and "possible hairline" → Record "possible hairline" and cap surface at ≤9.5
- If a defect is SUSPECTED but not definitively visible → Record as "minor by safety default" and cap at ≤9.5

**DEFAULT RULE 3: Image Quality Uncertainty**
- If ANY corner, edge, or zone is obscured by glare/blur/shadow → CANNOT grade 10.0, cap at ≤9.5
- If resolution prevents confident detection of <0.1mm defects → Cap at ≤9.5
- If lighting creates high-contrast areas that hide micro-defects → Cap at ≤9.5
- If image quality varies between front/back → Use WORSE image to determine cap

**DEFAULT RULE 4: Cross-Side Verification Uncertainty**
- If suspected defect on front but back verification inconclusive → Apply safety default, cap at ≤9.0
- If line/band on holo surface and cross-side check impossible → Record as "possible defect", cap at ≤9.5
- Never clear a suspected defect without successful cross-side verification

**DEFAULT RULE 5: Grade Uncertainty Propagation**
- If ANY category has grade_uncertainty ≥ 0.2 → Final grade MUST round DOWN to lower 0.5 step
- If grade_uncertainty ≥ 0.3 → Final grade MUST cap at ≤9.5 maximum
- If grade_uncertainty ≥ 0.5 → Final grade MUST cap at ≤9.0 maximum
- Never output uncertainty < 0.1 unless you have perfect-quality images with zero obscured areas

**DEFAULT RULE 6: Multiple Minor Defects**
- If ANY defect recorded as "microscopic or none" in 1 category → Cap that category at ≤9.5
- If defects recorded in 2+ categories (even if all "microscopic") → Cap final grade at ≤9.0
- If defects recorded in 3+ categories → Cap final grade at ≤8.5
- Never ignore "microscopic" defects when tallying multi-category impact

═══════════════════════════════════════════════════════════════════════════════
REMINDER: When uncertain, ALWAYS choose the lower grade, higher severity, worse measurement.
This is not being "too harsh" - this is being APPROPRIATELY CRITICAL for accurate grading.
═══════════════════════════════════════════════════════════════════════════════
```

---

### STEP 6: Force Real Centering Measurements

**Action**: Require numeric measurements, not estimates

**File**: `prompts/card_grader_v1.txt`

**Where to insert**: In the centering measurement section (replace or enhance existing text)

**Text to add**:

```
═══════════════════════════════════════════════════════════════════════════════
CENTERING MEASUREMENT PROTOCOL (MANDATORY)
═══════════════════════════════════════════════════════════════════════════════

**FOR PORTRAIT CARDS (vertical orientation):**

You MUST measure centering using the inner art panel OR printed border where applicable.

**MEASUREMENT STEPS:**

1. HORIZONTAL (Left/Right) Centering:
   - Sample left border width at mid-height of card
   - Sample right border width at mid-height of card
   - Identify which is narrower
   - Compute ratio: (narrower / wider) × 100
   - Report as "narrower/wider" format (e.g., "46/54" means left border is narrower)

2. VERTICAL (Top/Bottom) Centering:
   - Sample top border width at mid-width of card
   - Sample bottom border width at mid-width of card
   - Identify which is narrower
   - Compute ratio: (narrower / wider) × 100
   - Report as "narrower/wider" format (e.g., "48/52" means top border is narrower)

3. REPEAT for back of card (centering can differ front vs. back)

**REPORTING FORMAT:**

{
  "centering": {
    "front_horizontal": "51/49",     // EXACT ratio, NOT "approximately even"
    "front_vertical": "50/50",       // EXACT ratio
    "back_horizontal": "52/48",
    "back_vertical": "51/49",
    "worst_axis": "back_horizontal", // Which measurement is worst (used for grade cap)
    "worst_ratio": "52/48",
    "measurement_method": "border_width_sampling",
    "measurement_confidence": "high"|"medium"|"low"
  }
}

**CENTERING RULES:**

- Use WORST axis (front or back, horizontal or vertical) to determine centering grade cap
- 50/50 or 51/49 → Centering 10.0 (perfect)
- 52/48 or 53/47 → Centering 9.5
- 54/46 or 55/45 → Centering 9.0
- 56/44 to 60/40 → Centering 8.5
- 61/39 to 65/35 → Centering 8.0
- Worse than 65/35 → Centering ≤7.5

**SAFETY DEFAULTS:**

- If borders are unclear or partially obscured → Apply safety default, round to WORSE ratio (e.g., if looks like 50/50 or 51/49, record 51/49)
- If measurement confidence is "low" → Increase uncertainty and apply safety default
- Never report "perfect" or "50/50" without explicit measurement and high confidence
- If ANY border is obscured by image edge, glare, or damage → Cannot accurately measure → Cap centering at ≤9.5

═══════════════════════════════════════════════════════════════════════════════
CRITICAL: Do NOT estimate centering as "looks centered" or "approximately 50/50"
You MUST provide numeric ratios for BOTH axes on BOTH sides (4 measurements total)
═══════════════════════════════════════════════════════════════════════════════
```

---

### STEP 7: Update JSON Output Schema

**Action**: Add required fields for perfect-gate validation and micro-findings

**File**: `prompts/card_grader_v1.txt`

**Where to insert**: In the JSON schema/output format section

**Fields to add to the schema**:

```json
{
  "perfect_gate_checks": {
    "corners8_pass": true|false,           // All 8 corners individually inspected and recorded as "none" or "microscopic"
    "edges4_pass": true|false,             // All 8 edge segments individually inspected and recorded as "none" or "microscopic"
    "centering_two_axis_pass": true|false, // Both axes measured on both sides, worst axis ≤ 55/45
    "cross_side_pass": true|false,         // All suspected defects cross-verified on opposite side
    "image_quality_sufficient": true|false // Resolution and lighting sufficient for <0.1mm defect detection
  },

  "micro_findings_summary": {
    "corner_whitening_mm_sum_front": 0.0,  // Sum of all corner whitening measurements (front)
    "corner_whitening_mm_sum_back": 0.0,   // Sum of all corner whitening measurements (back)
    "edge_chips_total": 0,                 // Total count of edge chips across all edges
    "edge_whitening_dots_total": 0,        // Total count of edge whitening dots across all edges
    "hairline_count_front": 0,             // Count of hairline scratches on front
    "hairline_count_back": 0,              // Count of hairline scratches on back
    "print_dots_count_front": 0,           // Count of visible print dots ≥0.1mm (front)
    "print_dots_count_back": 0             // Count of visible print dots ≥0.1mm (back)
  },

  "corner_detailed_findings": [
    {
      "corner_id": "front_top_left",
      "whitening_mm": null,
      "whitening_severity": "none",
      "rounding_visible": false,
      "rounding_radius_mm": null,
      "lift_or_bent": false,
      "notes": "Sharp corner, no whitening visible"
    }
    // ... repeat for all 8 corners
  ],

  "edge_detailed_findings": [
    {
      "edge_id": "front_bottom",
      "chips_count": 0,
      "chips_severity": "none",
      "longest_chip_mm": null,
      "whitening_dots_count": 0,
      "abrasion_length_mm": null,
      "factory_roughness": false,
      "notes": "Clean edge, no defects visible"
    }
    // ... repeat for all 8 edges
  ],

  "surface_detailed_findings": [
    {
      "zone_id": "front_zone_5",
      "scratches_hairline_count": 0,
      "longest_visible_scratch_mm": null,
      "scratch_severity": "none",
      "print_dots_count_ge_0.1mm": 0,
      "print_dot_severity": "none",
      "indentations_present": false,
      "stains_discoloration": false,
      "notes": "Center zone clean, no defects"
    }
    // ... repeat for all 18 zones
  ]
}
```

**VALIDATION RULE:**

If `recommended_decimal_grade >= 9.5`, the following MUST be true or the grade will be automatically reduced:
- ALL `perfect_gate_checks.*_pass` must be `true`
- ALL `micro_findings_summary` numeric sums must be `0`
- `corner_detailed_findings` must contain exactly 8 entries (all corners inspected)
- `edge_detailed_findings` must contain exactly 8 entries (all edges inspected)
- `surface_detailed_findings` must contain exactly 18 entries (all zones inspected)

---

### STEP 8: Add Post-Processing Grade Caps (Code Changes)

**Action**: Implement programmatic validation that enforces caps even if AI outputs optimistic grade

**File**: `src/lib/visionGrader.ts` (or create new file `src/lib/gradeValidator.ts`)

**New validation function**:

```typescript
/**
 * Post-processing grade caps - enforces safety rules even if AI is optimistic
 * Implements ChatGPT's recommended caps based on structured output
 */
export function enforceGradeCaps(result: VisionGradeResult): VisionGradeResult {
  let cappedGrade = result.recommended_grade.recommended_decimal_grade;
  let cappedReasons: string[] = [];

  // CAP 1: If any perfect-gate check failed, cap at 9.5
  if (result.perfect_gate_checks) {
    const checks = result.perfect_gate_checks;
    if (!checks.corners8_pass) {
      cappedGrade = Math.min(cappedGrade, 9.5);
      cappedReasons.push("8-corner audit incomplete or found defects");
    }
    if (!checks.edges4_pass) {
      cappedGrade = Math.min(cappedGrade, 9.5);
      cappedReasons.push("4-edge audit incomplete or found defects");
    }
    if (!checks.centering_two_axis_pass) {
      cappedGrade = Math.min(cappedGrade, 9.5);
      cappedReasons.push("Centering measurement incomplete or outside 50/50-55/45 range");
    }
    if (!checks.cross_side_pass) {
      cappedGrade = Math.min(cappedGrade, 9.0);
      cappedReasons.push("Cross-side verification incomplete or failed");
    }
    if (!checks.image_quality_sufficient) {
      cappedGrade = Math.min(cappedGrade, 9.5);
      cappedReasons.push("Image quality insufficient for micro-defect detection");
    }
  }

  // CAP 2: If any micro-finding has non-zero count, cap at 9.5
  if (result.micro_findings_summary) {
    const findings = result.micro_findings_summary;
    if (findings.corner_whitening_mm_sum_front > 0 || findings.corner_whitening_mm_sum_back > 0) {
      cappedGrade = Math.min(cappedGrade, 9.5);
      cappedReasons.push(`Corner whitening detected (${findings.corner_whitening_mm_sum_front + findings.corner_whitening_mm_sum_back}mm total)`);
    }
    if (findings.edge_chips_total > 0 || findings.edge_whitening_dots_total > 0) {
      cappedGrade = Math.min(cappedGrade, 9.5);
      cappedReasons.push(`Edge defects detected (${findings.edge_chips_total} chips, ${findings.edge_whitening_dots_total} white dots)`);
    }
    if (findings.hairline_count_front > 0 || findings.hairline_count_back > 0) {
      cappedGrade = Math.min(cappedGrade, 9.5);
      cappedReasons.push(`Hairline scratches detected (${findings.hairline_count_front + findings.hairline_count_back} total)`);
    }
    if (findings.print_dots_count_front > 0 || findings.print_dots_count_back > 0) {
      cappedGrade = Math.min(cappedGrade, 9.5);
      cappedReasons.push(`Print dots detected (${findings.print_dots_count_front + findings.print_dots_count_back} total)`);
    }
  }

  // CAP 3: If multiple categories have defects, further reduce
  const categoriesWithDefects = result.defects ?
    [result.defects.front?.corners, result.defects.front?.edges, result.defects.front?.surface,
     result.defects.back?.corners, result.defects.back?.edges, result.defects.back?.surface]
      .filter(cat => cat && cat.severity !== 'none').length : 0;

  if (categoriesWithDefects >= 2) {
    cappedGrade = Math.min(cappedGrade, 9.0);
    cappedReasons.push(`Multiple defect categories affected (${categoriesWithDefects} categories)`);
  }

  // CAP 4: If grade_uncertainty >= 0.3, round down
  if (result.recommended_grade.grade_uncertainty >= 0.3) {
    cappedGrade = Math.floor(cappedGrade * 2) / 2; // Round down to nearest 0.5
    cappedReasons.push(`High uncertainty (${result.recommended_grade.grade_uncertainty}) - rounded down`);
  }

  // Apply cap if it's lower than AI's grade
  if (cappedGrade < result.recommended_grade.recommended_decimal_grade) {
    console.log(`[GRADE CAP APPLIED] AI suggested ${result.recommended_grade.recommended_decimal_grade}, capped at ${cappedGrade}`);
    console.log(`[GRADE CAP REASONS] ${cappedReasons.join('; ')}`);

    result.recommended_grade.recommended_decimal_grade = cappedGrade;
    result.recommended_grade.recommended_whole_grade = Math.round(cappedGrade);
    result.recommended_grade.grade_cap_applied = true;
    result.recommended_grade.grade_cap_reasons = cappedReasons;
  }

  return result;
}
```

**Integration point**: Call `enforceGradeCaps()` in `visionGrader.ts` after receiving AI response:

```typescript
// In gradeCardWithVision() function, after parsing response:
const result = JSON.parse(responseText);

// Apply post-processing grade caps
const validatedResult = enforceGradeCaps(result);

return validatedResult;
```

---

### STEP 9: Runtime/Decoding Settings

**Action**: Optimize API parameters for cautious, consistent grading

**File**: `src/app/api/vision-grade/[id]/route.ts`

**Settings to apply**:

```typescript
visionResult = await gradeCardWithVision({
  frontImageUrl: frontUrl,
  backImageUrl: backUrl,
  model: 'gpt-4o',
  temperature: 0.2,        // CHANGED: 0.0-0.2 for caution (was 0.3, then incorrectly 0.7)
  max_tokens: 4000,        // INCREASED: Allow full micro-sweep audits (was likely default ~2000)
  top_p: 0.2,              // NEW: Low top_p for deterministic, conservative sampling
  // seed: 12345,          // OPTIONAL: Fixed seed for reproducibility (if API supports)
});
```

**Also add to the Chat Completions API call in `visionGrader.ts`**:

```typescript
const response = await openai.chat.completions.create({
  model: model,
  temperature: temperature,
  top_p: 0.2,              // Add top_p for more deterministic sampling
  max_tokens: 4000,        // Increase to allow full detailed sweeps
  response_format: { type: 'json_object' },
  messages: [ /* ... */ ]
});
```

---

### STEP 10: Testing & Validation

**Action**: Test the hardened system with the Justin Herbert card

**Test Protocol**:

1. Apply ALL changes (Steps 1-9)
2. Restart dev server
3. Re-grade the Herbert card (same card that got 10/10 before)
4. Expected results with hardened instructions:
   - Grade: **9.0 to 9.5** (matching ChatGPT's 9.0)
   - Defects found:
     * Lower-left corner whitening (<0.2mm) - documented in corner_detailed_findings
     * Left edge factory roughness - documented in edge_detailed_findings
     * Back yellow quadrant print dot - documented in surface_detailed_findings
   - perfect_gate_checks: `corners8_pass: false`, `edges4_pass: false`
   - Grade cap applied: Yes (cap reason documented)

5. If grade is STILL 10/10:
   - Review the AI's corner_detailed_findings, edge_detailed_findings, surface_detailed_findings
   - Check if AI performed the micro-sweeps (should have 8 corners, 8 edges, 18 zones documented)
   - Check if perfect_gate_checks are present in response
   - If checks are missing → schema enforcement issue
   - If checks show false but grade still 10 → post-processing cap not applied

6. If grade drops to 9.0-9.5 but defects don't match ChatGPT's:
   - Compare the specific defects found
   - Acceptable variance (different defects spotted but same grade) = SUCCESS
   - Different grade (e.g., 8.5 instead of 9.0) = Need to calibrate severity scales

---

## Implementation Timeline

**Phase 1: Emergency Temperature Revert** (5 minutes)
- Revert temperature from 0.7 back to 0.2
- This prevents further grade inflation while we implement proper fixes

**Phase 2: System Prompt Updates** (2-3 hours)
- Add Perfect-Grade Gate section
- Add Micro-Defect Sweep Protocol
- Add Cross-Side Verification Rule
- Add Safety Defaults
- Update Centering Measurement Protocol
- Update JSON schema with new required fields

**Phase 3: Code Validation Logic** (1-2 hours)
- Create enforceGradeCaps() function
- Integrate into visionGrader.ts
- Update API parameters (top_p, max_tokens)
- Add logging for grade caps

**Phase 4: Testing** (1-2 hours)
- Test Herbert card (should grade 9.0-9.5)
- Test 3-5 additional cards
- Compare results to ChatGPT analysis
- Validate that perfect-gate checks are enforced
- Verify micro-sweep data is populated

**Phase 5: Documentation** (30 minutes)
- Update ENHANCED_DEFECT_DETECTION_SUMMARY.md with postmortem
- Document the real root cause (loose proof standard, not temperature)
- Create grading accuracy test suite for future regression testing

**Total Estimated Time**: 5-8 hours for complete implementation

---

## Success Criteria

The hardened system is successful when:

✅ **Herbert card grades 9.0-9.5** (matching ChatGPT's analysis)
✅ **Defects are documented** in corner_detailed_findings, edge_detailed_findings, surface_detailed_findings
✅ **perfect_gate_checks enforced** - all checks must pass for 10.0, otherwise cap applied
✅ **Grade 10.0 frequency drops** to <1% of cards (realistic rate)
✅ **Detailed micro-sweeps performed** - 8 corners, 8 edges, 18 zones documented for every card
✅ **Safety defaults applied** - when uncertain, grades default DOWNWARD
✅ **Cross-side verification performed** - suspected defects checked on opposite side

---

## Rollback Plan

If hardened instructions cause problems (over-grading in opposite direction, too strict):

**Quick Rollback**:
1. Revert temperature to 0.3 (original)
2. Revert `card_grader_v1.txt` from git history
3. Remove enforceGradeCaps() call

**Partial Rollback** (keep some improvements):
- Keep Perfect-Grade Gate but loosen conditions
- Keep Micro-Sweep Protocol but make measurements optional
- Keep Safety Defaults but reduce their impact
- Adjust temperature up to 0.3-0.5 if AI becomes too cautious

---

## Expected Impact

**Before Hardening**:
- Grade 10.0 frequency: ~10-20% of cards (unrealistic)
- Herbert card: 10/10, zero defects found
- Defect detection: Vague ("looks perfect")
- Cross-side verification: Not performed
- Safety defaults: Not applied

**After Hardening**:
- Grade 10.0 frequency: <1% of cards (realistic)
- Herbert card: 9.0-9.5, specific defects documented with measurements
- Defect detection: Systematic (8 corners, 8 edges, 18 zones individually inspected)
- Cross-side verification: Mandatory for suspected defects
- Safety defaults: Always applied when uncertain

**Net Result**: Grading accuracy matches professional ChatGPT analysis, system behaves like a trained human grader who is appropriately critical.

---

## Post-Implementation: Next Steps

After hardening is complete and tested:

1. **Create regression test suite** - Save 10-20 test cards with known grades, re-test after any prompt changes
2. **Monitor grade distribution** - Track 10.0 frequency over next 100 cards, should be <1%
3. **Compare to professional grades** - If users submit PSA/BGS graded cards, compare system grades to actual professional grades
4. **Fine-tune severity scales** - If system consistently over/under grades vs. professionals, adjust severity thresholds
5. **Implement Pokemon expansion** - Once grading accuracy proven, proceed with Pokemon card support (metadata only, grading stays same)

---

**Status**: ⏸️ READY TO IMPLEMENT
**Priority**: 🔴 CRITICAL - Fix before deploying to users or adding Pokemon support
**Estimated Completion**: 5-8 hours total work
**Risk Level**: 🟡 MEDIUM - Changes are extensive but well-specified by ChatGPT's forensic analysis

---

**Last Updated**: 2025-10-19
**Author**: Claude Code (based on ChatGPT forensic review)
**Approved by**: Pending user review
