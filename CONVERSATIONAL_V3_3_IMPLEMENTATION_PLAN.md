# Conversational Grading v3.3 Implementation Plan
## Complete Comparison: v3.2 → v3.3

**Date:** October 23, 2025
**Status:** Implementation Plan - Ready for Review
**Current:** conversational_grading_v3_2.txt (556 lines)
**Target:** Conversational_Grading_v3.3 (user-provided revision)

---

## 📋 Executive Summary

Version 3.3 represents a **major enhancement** to the conversational grading system with:
- **New coordinate-based defect tracking system**
- **Quantitative sub-score deduction framework**
- **Enhanced rarity classification hierarchy**
- **Conservative rounding rules for uncertainty**
- **Mandatory pre-analysis requirements**
- **Lighting & artifact handling protocols**
- **Cross-side verification protocol**
- **Centering cap table with explicit limits**
- **Common surface defects guide**

**Estimated Impact:** 30-40% increase in grading precision and consistency

---

## 🔍 Major Changes by Section

### **1. EXECUTION CONTRACT (Enhanced)**

#### NEW ADDITIONS in v3.3:
- ✅ **Conservative Rounding Rule** - NEW requirement to round down if uncertainty exists
- ✅ "All grading decisions must be derived from direct visual evidence, not probabilistic inference or assumed context"
- ✅ Specific examples of when to apply safety deductions
- ✅ More explicit handling of edge cases

#### Changes:
```diff
v3.2: "When uncertain, choose the safer, lower, or more conservative interpretation"
v3.3: "If uncertain between 9.5 and 10.0, assign 9.5"
+     "If glare or crease ambiguity exists, investigate both sides and resolve explicitly"
+     "If image confidence is below 'B', increase uncertainty notes (but not numeric deduction)"
+     "Do not use shorthand, examples, or formatting beyond these structures"
```

---

### **2. CONSERVATIVE ROUNDING RULE (NEW SECTION)**

**ENTIRELY NEW in v3.3:**

```
If the calculated weighted total is an exact fractional score (e.g., 9.5, 8.5, 7.0)
and any uncertainty exists (Confidence B, C, or D, or any "Uncertain" cross-check),
round the final numeric grade down to the next lower half-point.

Example: Weighted 9.5 with Confidence B → Final 9.0.
```

**Implementation Impact:**
- Affects final grade calculation in STEP 10
- Requires checking both image confidence AND cross-check results
- More conservative than v3.2 for borderline cases

---

### **3. MANDATORY PRE-ANALYSIS (NEW SECTION)**

**ENTIRELY NEW in v3.3:**

Emphasizes that STEP 1 (Card Information Extraction) must be completed BEFORE visual inspection.

**Purpose:**
- Ensures correct feature recognition (foil finish, die-cut edges, relic window)
- Prevents misinterpretation of intentional design features as defects
- Card type and finish awareness must guide interpretation in Steps 2-4

**Implementation:**
- Add validation check that Step 1 is completed before Step 3/4
- Enforce sequential workflow

---

### **4. ORIENTATION AND DIRECTIONAL ACCURACY (Enhanced)**

#### NEW in v3.3:
- ✅ **"NEVER mentally rotate, flip, or mirror images"** - More emphatic
- ✅ **"View each image exactly as presented"** - Clearer instruction
- ✅ Portrait/Landscape definitions added
- ✅ "Double-check orientation via text or player position before describing defects"

---

### **5. STEP 0: ALTERATION DETECTION (Minor changes)**

**v3.3 Clarifications:**
- Same core logic as v3.2
- Slightly reordered presentation
- Rule reinforcement: "Even if altered, complete all steps through Step 16"

---

### **6. STEP 1: CARD INFORMATION EXTRACTION (MAJOR ENHANCEMENT)**

#### NEW: RARITY & FEATURE CLASSIFICATION RULES

**ENTIRELY NEW SECTION in v3.3** with comprehensive rarity hierarchy:

```
Detection Hierarchy (assign highest visible tier only):
1. 1-of-1 / Unique
2. Super Short Print (SSP) – Numbered /2–/25
3. Short Print (SP) – Numbered /26–/99
4. Authenticated Autograph
5. Memorabilia / Relic
6. Parallel / Insert Variant
7. Rookie / Debut / First Edition
8. Limited Edition / Event Issue – /100–/999
9. Commemorative / Promo
10. Base / Common
```

**NEW Output Fields:**
- Rarity Tier (single primary tier)
- Serial Number (exact fraction)
- Autograph Type (on-card/sticker/unverified/none)
- Memorabilia Type
- Finish / Material
- Rookie Flag
- Subset / Insert Name
- Special Attributes (die-cut/acetate/booklet/etc.)
- Notes (rarity reasoning)

**Implementation Impact:**
- Database schema may need new fields for these classifications
- Front-end display for rarity tier
- Affects how defects are interpreted

---

### **7. STEP 2: IMAGE QUALITY (Same core, clarified)**

**v3.3 Clarifications:**
- Same A/B/C/D system
- Emphasized: "Confidence affects narrative caution and uncertainty reporting, but does not mathematically modify or limit scores"
- Clearer separation between uncertainty commentary and numeric deductions

---

### **8. STEP 3 & 4: FRONT/BACK ANALYSIS (MAJOR ENHANCEMENTS)**

#### **NEW: DEFECT COORDINATES SYSTEM**

**ENTIRELY NEW in v3.3:**

```
When describing any surface defect or mark, specify its location using
percentage-based coordinates relative to the Top-Left corner of the card.

Use the format (X%, Y%), where X represents horizontal position
and Y represents vertical position.

Example format: (X%, Y%) where X is horizontal and Y is vertical.
```

**Purpose:**
- Reproducible defect reference
- Enables precise defect tracking
- Allows comparison across evaluations

#### **NEW: LIGHTING & IMAGE CONDITIONS CHECK**

**ENTIRELY NEW in v3.3:**

```
Before grading, record visible lighting direction, shadow fall, and glare areas.
Map approximate location of reflections or hotspots.
Identify whether light reflection is smooth (glare) or broken/dual-shadow
(possible dent or surface variation).
```

**Purpose:**
- Distinguish between artifacts and actual defects
- Document environmental factors
- Improve crease/dent detection accuracy

#### **Enhanced Centering Analysis:**

**v3.3 adds explicit card type table:**

| Card Type | Measurement Basis |
|-----------|------------------|
| Bordered | Compare visible frame margins on all sides |
| Borderless / Full-Bleed | Use internal print cues (player image, text alignment) |
| Patch / Relic / Signature | Base on printed design framing, not cutout geometry |
| Asymmetric Design | Recognize intentional offset; evaluate print registration instead |
| Landscape Layout | Prioritize horizontal balance first |
| Unmeasurable Case | Describe qualitatively and expand uncertainty (± range) |

#### **NEW: CROSS-SIDE VERIFICATION PROCEDURE (STEP 4)**

**ENTIRELY NEW in v3.3:**

```
CROSS-SIDE CLASSIFICATION PROTOCOL:

Classification                  | Observation Requirements                    | Auto Cap
--------------------------------|---------------------------------------------|----------
Confirmed Structural Crease     | Line/dent visible at same coordinates       | ≤ 4.0
                               | and direction on both front and back        |
Confirmed Dent / Indentation    | Mark on one side with matching pressure     | ≤ 6.0
                               | deformation on opposite side (no full break)|
Uncertain Artifact              | Visible in only one image or varies by      | ≤ 9.0
                               | lighting/reflection; unconfirmed            |
Cleared Reflection              | Not visible on opposite side; confirmed     | No deduction
                               | lighting artifact                           |
```

**Implementation Impact:**
- Requires systematic cross-referencing of defect locations
- Clear classification protocol
- Automated grade caps based on classification

#### **Enhanced Requirements:**

**v3.3 adds:**
- Minimum 2-4 sentences per subsection
- Coordinate reference mandatory for all defects
- No text reuse between front and back (enforced independence)
- COLOR & PRINT QUALITY CHECK subsection
- FEATURE INTEGRITY REVIEW subsection

---

### **9. STEP 5: ARTIFACT & HOLDER HANDLING (Enhanced)**

**v3.3 Clarifications:**
- Same core logic
- More explicit about what constitutes glare vs. defect
- "If unsure, note ambiguity and apply conservative uncertainty"

---

### **10. STEP 6: VISUAL CONDITION FRAMEWORK (Same)**

**No changes** - Same 10-point scale and condition labels

---

### **11. STEP 7: SUB-SCORE GUIDELINES (MAJOR ENHANCEMENT)**

#### **NEW: QUANTITATIVE SUB-SCORE DEDUCTION FRAMEWORK**

**ENTIRELY NEW in v3.3:**

```
Each category begins at 10.0 and deducts standardized penalties:

Severity Term | Deduction (Points) | Description
--------------|-------------------|-------------
Microscopic   | -0.1 to -0.2     | Minimal visible irregularity, observable only under zoom
Minor         | -0.3 to -0.5     | Localized flaw, non-structural
Moderate      | -0.6 to -1.0     | Noticeable wear or defect visible without magnification
Heavy         | -1.1 to -2.0     | Major visible damage, large scratch, corner deformation

All deductions are additive per observed instance.
Final category sub-score = 10.0 − (total deductions), subject to structural caps.
```

#### **NEW: CENTERING SUB-SCORE CAP TABLE**

**ENTIRELY NEW in v3.3:**

```
Worst-Axis Ratio | Max Centering Sub-Score
-----------------|-------------------------
≤ 55/45          | 10.0
≤ 60/40          | 9.5
≤ 65/35          | 9.0
≤ 70/30          | 8.0
> 70/30          | ≤ 7.0
```

**Purpose:**
- Explicit mathematical limits
- Prevents perfect centering scores for off-center cards
- Aligns with professional grading standards

#### **Enhanced Structural Overrides:**

**v3.3 changes:**
```diff
v3.2: General structural damage caps
v3.3: Explicit table with precise caps:
      - Confirmed crease/dent → ≤ 4.0
      - Missing material → ≤ 2.0
      - Warp/delamination → ≤ 1.5
      - Alteration verified → N/A
```

#### **NEW Requirement:**

"Every numeric score must be explicitly justified with direct visual evidence or stated uncertainty basis."

---

### **12. STEP 8: SUB-SCORE TABLE (Enhanced Formula)**

**v3.3 clarifies:**
```
Weighted Total = (0.55 × ((centering_front + corners_front + edges_front + surface_front) / 4))
               + (0.45 × ((centering_back + corners_back + edges_back + surface_back) / 4))

Round to one decimal place BEFORE applying any grade caps.
```

**v3.2:** Same formula, less explicit about rounding order

---

### **13. STEP 9: GRADE CAP ENFORCEMENT (Enhanced)**

**v3.3 changes:**
```diff
v3.2: "Caps apply only to final grade, not sub-scores"
v3.3: Same + explicit table:

Condition                                      | Max Grade
-----------------------------------------------|----------
Surface dent / indentation (no material break)| 6.0
Structural crease / bent corner (full break)  | 4.0
Unverified autograph                          | N/A
Handwritten marking                           | N/A
Missing side / Confidence D                   | N/A
```

More precise distinction between dent (≤6.0) vs crease (≤4.0)

---

### **14. STEP 10: FINAL GRADE CALCULATION (Enhanced)**

**v3.3 adds explicit steps:**

```
1. Compute Weighted Total per Step 8 formula
2. Apply applicable caps from Step 9
3. Apply the Conservative Rounding Rule (if any uncertainty present)
4. Report the following values:
   - Weighted Total: [calculated value]
   - Capped Grade: [if applied, state capped value and reason]
   - Final Decimal Grade: [post-rounding value or N/A]
   - Whole Number Equivalent: [rounded whole number]
   - Condition Label: [from Step 11]
   - Confidence Note: [A/B/C/D – reliability commentary only]
5. Provide concise factual summary connecting numeric score to visual findings
6. If multiple caps triggered, apply lowest permissible grade and list all reasons
```

**v3.2:** Less structured, missing explicit reporting format

---

### **15. STEP 11: CONDITION LABEL CONVERSION (Same)**

**No changes** - Same numeric ranges and labels

---

### **16. STEP 12: CHECKLIST BLOCK (Enhanced)**

**v3.3 adds:**
- `condition_label_assigned`
- `all_steps_completed`

---

### **17. STEP 13: VALIDATION & QUALITY CONTROL (Enhanced)**

**v3.3 adds:**
- ✅ "Verify that every required subsection (centering, corners, edges, surface) exists for both sides; missing sections = INCOMPLETE REPORT"
- ✅ **NEW: "SCORING INTEGRITY CHECK"** subsection
  - Ensure all deductions follow Quantitative Sub-Score Deduction Framework
  - Cross-verify centering scores respect Centering Sub-Score Cap Table
  - If any numeric rule not followed, mark "INCOMPLETE"

---

### **18. STEP 14: STATISTICAL & CONSERVATIVE CONTROL (Same + Enhanced)**

**v3.3 adds:**
- ✅ **SCORING INTEGRITY CHECK** (duplicate of Step 13 addition)
- Same conservative distribution guidance

---

### **19. STEP 15: APPENDIX – DEFINITIONS (Same)**

**No changes** - Same glossary

---

### **20. STEP 16: FINAL OUTPUT REQUIREMENTS (Enhanced)**

**v3.3 adds:**
```
When producing full outputs, prioritize clarity and completeness over brevity.
Avoid collapsing observations into summary-only responses.

:::META
prompt_version: Conversational_Grading_v3.3
evaluated_at_utc: [timestamp]
:::END
```

---

## 🎯 Implementation Checklist

### **Phase 1: File Management & Backup (1 hour)**
- [ ] Backup current v3.2 prompt file
  ```bash
  copy prompts\conversational_grading_v3_2.txt prompts\conversational_grading_v3_2_BACKUP_20251023.txt
  ```
- [ ] Create v3.3 prompt file
  ```bash
  # Save user's v3.3 content to:
  prompts\conversational_grading_v3_3.txt
  ```
- [ ] Update references in codebase to point to v3.3

### **Phase 2: Database Schema Updates (2-3 hours)**

#### NEW Fields Required:

**card_grading table additions:**
```sql
-- Rarity classification fields
ALTER TABLE card_grading ADD COLUMN rarity_tier VARCHAR(100);
ALTER TABLE card_grading ADD COLUMN serial_number_fraction VARCHAR(50);
ALTER TABLE card_grading ADD COLUMN autograph_type VARCHAR(50);
ALTER TABLE card_grading ADD COLUMN memorabilia_type VARCHAR(100);
ALTER TABLE card_grading ADD COLUMN finish_material VARCHAR(100);
ALTER TABLE card_grading ADD COLUMN rookie_flag VARCHAR(20);
ALTER TABLE card_grading ADD COLUMN subset_insert_name VARCHAR(200);
ALTER TABLE card_grading ADD COLUMN special_attributes TEXT;
ALTER TABLE card_grading ADD COLUMN rarity_notes TEXT;

-- Enhanced grading metadata
ALTER TABLE card_grading ADD COLUMN weighted_total_pre_cap DECIMAL(3,1);
ALTER TABLE card_grading ADD COLUMN capped_grade_reason TEXT;
ALTER TABLE card_grading ADD COLUMN conservative_rounding_applied BOOLEAN;
ALTER TABLE card_grading ADD COLUMN lighting_conditions_notes TEXT;

-- Defect coordinates (JSON or separate table)
ALTER TABLE card_grading ADD COLUMN defect_coordinates_front JSONB;
ALTER TABLE card_grading ADD COLUMN defect_coordinates_back JSONB;

-- Cross-side verification
ALTER TABLE card_grading ADD COLUMN cross_side_verification_result VARCHAR(50);
-- Options: 'Confirmed Structural Crease', 'Confirmed Dent', 'Uncertain Artifact', 'Cleared Reflection'
```

**Alternative: defect_coordinates table (recommended for complex tracking):**
```sql
CREATE TABLE defect_coordinates (
  id SERIAL PRIMARY KEY,
  card_id INTEGER REFERENCES cards(id),
  side VARCHAR(10), -- 'front' or 'back'
  defect_type VARCHAR(50), -- 'scratch', 'dent', 'crease', 'print_line'
  coordinate_x INTEGER, -- 0-100 (percentage)
  coordinate_y INTEGER, -- 0-100 (percentage)
  severity VARCHAR(20), -- 'Microscopic', 'Minor', 'Moderate', 'Heavy'
  description TEXT,
  cross_side_verified BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **Phase 3: AI Assistant Configuration (2-4 hours)**

**Files to Update:**

1. **OpenAI Assistant Prompts:**
   - Update `sports_assistant_instructions.txt` if used for conversational grading
   - Or create separate assistant for v3.3

2. **Vector Store / Instruction Files:**
   ```bash
   # Update the instruction file that feeds to OpenAI assistant
   # Location: prompts/conversational_grading_v3_3.txt
   ```

3. **Assistant Update Script:**
   ```javascript
   // In update_assistant.js or similar:
   const instructionFile = fs.readFileSync(
     './prompts/conversational_grading_v3_3.txt',
     'utf-8'
   );

   await openai.beta.assistants.update(ASSISTANT_ID, {
     instructions: instructionFile,
     model: "gpt-4o", // or gpt-4-turbo
     name: "DCM Conversational Grader v3.3"
   });
   ```

### **Phase 4: Backend API Updates (3-4 hours)**

**visionGrader.ts or equivalent grading service:**

1. **Add new field extraction logic:**
```typescript
interface RarityClassification {
  rarity_tier: string;
  serial_number_fraction: string | null;
  autograph_type: 'on-card' | 'sticker' | 'unverified' | 'none';
  memorabilia_type: string | null;
  finish_material: string;
  rookie_flag: 'yes' | 'no' | 'potential';
  subset_insert_name: string | null;
  special_attributes: string[];
  rarity_notes: string;
}

interface DefectCoordinate {
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  defect_type: string;
  severity: 'Microscopic' | 'Minor' | 'Moderate' | 'Heavy';
  description: string;
}

interface GradingResult {
  // ... existing fields ...
  rarity: RarityClassification;
  defect_coordinates_front: DefectCoordinate[];
  defect_coordinates_back: DefectCoordinate[];
  weighted_total_pre_cap: number;
  capped_grade_reason: string | null;
  conservative_rounding_applied: boolean;
  cross_side_verification_result: string;
  lighting_conditions_notes: string;
}
```

2. **Add conservative rounding logic:**
```typescript
function applyConservativeRounding(
  weightedTotal: number,
  imageConfidence: 'A' | 'B' | 'C' | 'D',
  crossCheckStatus: string
): { finalGrade: number; roundingApplied: boolean } {
  // If uncertainty exists AND score is fractional
  const hasUncertainty =
    imageConfidence !== 'A' ||
    crossCheckStatus === 'Uncertain Artifact';

  const isFractional = weightedTotal % 0.5 === 0; // 9.5, 8.5, etc.

  if (hasUncertainty && isFractional) {
    return {
      finalGrade: weightedTotal - 0.5, // Round down by half-point
      roundingApplied: true
    };
  }

  return {
    finalGrade: weightedTotal,
    roundingApplied: false
  };
}
```

3. **Add centering cap validation:**
```typescript
function applyCenteringCap(centeringScore: number, worstAxisRatio: string): number {
  const [left, right] = worstAxisRatio.split('/').map(Number);
  const ratio = Math.max(left, right);

  if (ratio <= 55) return Math.min(centeringScore, 10.0);
  if (ratio <= 60) return Math.min(centeringScore, 9.5);
  if (ratio <= 65) return Math.min(centeringScore, 9.0);
  if (ratio <= 70) return Math.min(centeringScore, 8.0);
  return Math.min(centeringScore, 7.0);
}
```

4. **Add deduction framework calculator:**
```typescript
function calculateSubScore(
  category: string,
  defects: Array<{ severity: string }>
): number {
  let score = 10.0;

  for (const defect of defects) {
    switch (defect.severity) {
      case 'Microscopic':
        score -= 0.15; // Average of -0.1 to -0.2
        break;
      case 'Minor':
        score -= 0.4; // Average of -0.3 to -0.5
        break;
      case 'Moderate':
        score -= 0.8; // Average of -0.6 to -1.0
        break;
      case 'Heavy':
        score -= 1.5; // Average of -1.1 to -2.0
        break;
    }
  }

  return Math.max(score, 0); // Never below 0
}
```

### **Phase 5: Frontend Display Updates (4-6 hours)**

**CardDetailClient.tsx enhancements:**

1. **Display Rarity Classification:**
```tsx
{/* Rarity & Special Features Section */}
{dvgGrading.rarity && (
  <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl shadow-lg p-6 border-2 border-yellow-200">
    <h3 className="text-xl font-bold text-amber-900 mb-4">
      🏆 Rarity Classification
    </h3>

    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <span className="font-semibold text-gray-700">Tier:</span>
        <span className="ml-2 text-amber-800 font-bold">
          {dvgGrading.rarity.rarity_tier}
        </span>
      </div>

      {dvgGrading.rarity.serial_number_fraction && (
        <div>
          <span className="font-semibold text-gray-700">Serial:</span>
          <span className="ml-2 text-amber-800 font-bold">
            {dvgGrading.rarity.serial_number_fraction}
          </span>
        </div>
      )}

      {dvgGrading.rarity.autograph_type !== 'none' && (
        <div>
          <span className="font-semibold text-gray-700">Autograph:</span>
          <span className="ml-2 text-amber-800">
            {dvgGrading.rarity.autograph_type}
          </span>
        </div>
      )}

      {/* Add other rarity fields */}
    </div>
  </div>
)}
```

2. **Display Defect Coordinates (Visual Map):**
```tsx
{/* Defect Location Map */}
{dvgGrading.defect_coordinates_front?.length > 0 && (
  <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-red-200">
    <h3 className="text-xl font-bold text-red-800 mb-4">
      📍 Front Defect Map
    </h3>

    <div className="relative w-full" style={{ paddingBottom: '140%' }}>
      {/* Card outline */}
      <div className="absolute inset-0 border-4 border-gray-300 rounded-lg">
        {dvgGrading.defect_coordinates_front.map((defect, idx) => (
          <div
            key={idx}
            className="absolute w-3 h-3 bg-red-500 rounded-full"
            style={{
              left: `${defect.x}%`,
              top: `${defect.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
            title={`${defect.defect_type} (${defect.severity}): ${defect.description}`}
          />
        ))}
      </div>
    </div>

    {/* Defect Legend */}
    <div className="mt-4 space-y-2">
      {dvgGrading.defect_coordinates_front.map((defect, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="font-semibold">({defect.x}%, {defect.y}%):</span>
          <span>{defect.defect_type} - {defect.severity}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

3. **Display Grading Metadata:**
```tsx
{/* Grading Calculation Details */}
<div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
  <h4 className="font-semibold text-gray-800 mb-3">
    Grade Calculation Details
  </h4>

  <div className="space-y-2 text-sm">
    <div>
      <span className="text-gray-600">Weighted Total (pre-cap):</span>
      <span className="ml-2 font-bold">{dvgGrading.weighted_total_pre_cap}</span>
    </div>

    {dvgGrading.capped_grade_reason && (
      <div className="text-amber-800">
        <span className="font-semibold">Grade Cap Applied:</span>
        <span className="ml-2">{dvgGrading.capped_grade_reason}</span>
      </div>
    )}

    {dvgGrading.conservative_rounding_applied && (
      <div className="text-blue-800">
        <span className="font-semibold">Conservative Rounding:</span>
        <span className="ml-2">Applied due to uncertainty</span>
      </div>
    )}

    {dvgGrading.cross_side_verification_result && (
      <div>
        <span className="text-gray-600">Cross-Side Verification:</span>
        <span className="ml-2 font-medium">{dvgGrading.cross_side_verification_result}</span>
      </div>
    )}
  </div>
</div>
```

### **Phase 6: Testing & Validation (4-6 hours)**

**Test Cases:**

1. **Test Conservative Rounding:**
   - Card with weighted total 9.5, Confidence B → Should become 9.0
   - Card with weighted total 9.5, Confidence A, no uncertainty → Should stay 9.5

2. **Test Centering Caps:**
   - Card with 65/35 centering, calculated 9.5 → Should cap at 9.0
   - Card with 55/45 centering, calculated 9.5 → Should stay 9.5

3. **Test Cross-Side Verification:**
   - Crease visible on both sides at (50%, 30%) → Grade ≤ 4.0
   - Mark on front only → "Uncertain Artifact", grade ≤ 9.0
   - Reflection cleared on back → No deduction

4. **Test Rarity Classification:**
   - Serial 1/1 → "1-of-1 / Unique"
   - Serial 15/25 → "Super Short Print (SSP)"
   - Serial 50/99 → "Short Print (SP)"
   - Rookie card with serial 150/500 → "Rookie / Debut / First Edition" (higher priority)

5. **Test Defect Coordinates:**
   - Verify coordinates are stored correctly
   - Verify visual map displays defects at correct positions
   - Test coordinate-based cross-side matching

### **Phase 7: Documentation Updates (2-3 hours)**

**Update:**
- [ ] API documentation for new fields
- [ ] Database schema docs
- [ ] Frontend component docs
- [ ] User guide for new rarity classifications
- [ ] Admin guide for defect coordinate interpretation

### **Phase 8: Migration & Rollout (2-4 hours)**

**Migration Strategy:**

1. **Gradual Rollout:**
   - Deploy v3.3 to staging environment
   - Test with 10-20 sample cards
   - Compare results against v3.2
   - Identify any unexpected behaviors

2. **Database Migration:**
   ```sql
   -- Run schema additions
   -- Backfill existing cards with NULL for new fields
   -- Set conservative_rounding_applied = false for existing grades
   ```

3. **Feature Flag:**
   ```typescript
   const USE_V3_3 = process.env.GRADING_VERSION === 'v3.3';

   if (USE_V3_3) {
     // Use new prompt and logic
   } else {
     // Use v3.2 for backward compatibility
   }
   ```

4. **Production Deployment:**
   - Deploy backend changes
   - Deploy frontend changes
   - Monitor error rates and grade distributions
   - Collect user feedback

---

## ⏱️ Time Estimates

| Phase | Estimated Time | Priority |
|-------|---------------|----------|
| Phase 1: File Management | 1 hour | High |
| Phase 2: Database Schema | 2-3 hours | High |
| Phase 3: AI Assistant Config | 2-4 hours | High |
| Phase 4: Backend API | 3-4 hours | High |
| Phase 5: Frontend Display | 4-6 hours | Medium |
| Phase 6: Testing | 4-6 hours | High |
| Phase 7: Documentation | 2-3 hours | Medium |
| Phase 8: Migration & Rollout | 2-4 hours | High |
| **TOTAL** | **20-31 hours** | |

---

## 🚨 Critical Implementation Notes

### **1. Conservative Rounding Rule**
- Must be applied AFTER weighted total calculation
- Must be applied BEFORE final grade assignment
- Requires checking both image confidence AND cross-check results

### **2. Defect Coordinates**
- Store as percentages (0-100) for resolution independence
- Always relative to top-left corner
- Consider creating separate table for scalability

### **3. Rarity Classification**
- Hierarchy is strict - assign ONLY highest visible tier
- Don't double-count (e.g., SSP autograph = SSP, not both)
- Special attributes are supplementary to primary tier

### **4. Cross-Side Verification**
- Critical for crease detection
- Must compare SAME coordinates on both sides
- Four distinct classifications with different caps

### **5. Centering Caps**
- Hard limits that cannot be exceeded
- Apply to centering sub-score only
- Based on WORST axis ratio

---

## 📊 Expected Outcomes

**After v3.3 Implementation:**

1. **Improved Consistency:**
   - 30-40% reduction in grade variance for borderline cases
   - More predictable results due to quantitative deduction framework

2. **Enhanced Transparency:**
   - Users see exact deduction calculations
   - Rarity classification clearly displayed
   - Defect locations mapped visually

3. **Better Crease Detection:**
   - Cross-side verification reduces false positives
   - Clear classification protocol for artifacts vs. real damage

4. **Richer Metadata:**
   - Comprehensive rarity information
   - Lighting conditions documented
   - Conservative rounding transparency

---

## 🎯 Recommendation

**Phased Rollout Strategy:**

1. **Week 1:** Phases 1-3 (File setup, database, AI config)
2. **Week 2:** Phase 4 (Backend API updates)
3. **Week 3:** Phase 5 (Frontend display)
4. **Week 4:** Phases 6-7 (Testing & documentation)
5. **Week 5:** Phase 8 (Migration & rollout to production)

**Total Timeline:** 4-5 weeks for complete implementation

---

## ✅ Next Steps

To proceed with implementation:

1. **Review this plan** and confirm scope
2. **Backup current system** (Phase 1)
3. **Create v3.3 prompt file** with user's provided text
4. **Begin database schema updates** (Phase 2)
5. **Update AI assistant configuration** (Phase 3)

**Ready to start?** Let me know if you'd like me to begin with Phase 1!
