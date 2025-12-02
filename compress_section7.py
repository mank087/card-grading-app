"""
Compress Section 7 of master_grading_rubric_v5.txt
Target: Reduce from ~359 lines to ~200 lines while preserving all core rules
"""

# Read the file
with open('prompts/master_grading_rubric_v5.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find Section 7 boundaries (line indices start at 0, file lines start at 1)
section7_start = None
section8_start = None

for i, line in enumerate(lines):
    if 'SECTION 7: EVIDENCE-BASED GRADING PROTOCOL' in line:
        section7_start = i
    if section7_start and 'SECTION 8: GRADING METHODOLOGY' in line:
        section8_start = i
        break

print(f"Section 7 spans lines {section7_start + 1} to {section8_start}")
print(f"Total lines in Section 7: {section8_start - section7_start}")

# Optimized Section 7
optimized_section7 = """═══════════════════════════════════════════════════════════════════════
SECTION 7: EVIDENCE-BASED GRADING PROTOCOL
UNIVERSAL ANTI-HALLUCINATION SAFEGUARDS
═══════════════════════════════════════════════════════════════════════

🚨 **CRITICAL PRINCIPLE:** Every assessment claim (defect OR pristine) requires observable evidence.

**PURPOSE:** Prevent false positives (inventing defects) and false negatives (missing real defects).
**SCOPE:** Applies to ALL cards, ALL scores (1.0-10.0), ALL components.

────────────────────────────────────────────────────────────────────────
1. REQUIRED EVIDENCE (5 Elements)
────────────────────────────────────────────────────────────────────────

**For ANY defect claim, provide ALL 5:**
1. **LOCATION:** Specific position ("Top-left corner" not "Corner")
2. **SIZE:** Measurement with qualifier ("~0.2mm" not "minor")
3. **APPEARANCE:** Describe what you see using THIS card's features
4. **COLORS:** Actual observable colors from THIS card
5. **METHOD:** How you found it ("At max zoom examining corner tip")

**For pristine/no defect claims, provide ALL 4:**
1. **INSPECTION:** What areas examined ("At max zoom, examined corner tip area")
2. **NEGATIVE FINDINGS:** What defects checked for but NOT found ("Zero fiber, no rounding, coating intact")
3. **OBSERVABLE FEATURES:** What perfect looks like on THIS card ("Sharp apex, border extends to point")
4. **CARD DETAILS:** Reference actual card colors/design ("Navy blue border shows no whitening")

**INSUFFICIENT EXAMPLES:**
❌ "Minor wear" → Missing: appearance, color, measurement
❌ "Some whitening" → Missing: location, extent, colors
❌ "Small scratch" → Missing: position, length, direction
❌ "Corner is perfect" → Missing: inspection evidence, what checked for

**ACCEPTABLE EXAMPLE:**
✅ "Top-left corner against red border: white cardstock fiber visible at tip, ~0.2mm length, high contrast. At max zoom: zero rounding, no lift/tilt, coating intact elsewhere."

────────────────────────────────────────────────────────────────────────
2. DESCRIPTION-SCORE-DEFECTS CONSISTENCY
────────────────────────────────────────────────────────────────────────

🚨 **THREE-WAY VALIDATION (All must align):**

**IF you describe defect → MUST deduct points + entry in defects array**
**IF score < 10.0 → MUST describe defect + entry in defects array**
**IF defects array non-empty → MUST describe in narrative + deduct points**

**Validation before submission:**
□ Defect in description → Score < 10.0 + Entry in defects array?
□ Score < 10.0 → Defect description + Entry in defects array?
□ Defects array count = Defects in narrative count?
□ Each corner/edge has UNIQUE description (no copy-paste)?

**VIOLATION EXAMPLES:**
❌ Description: "0.2mm fiber exposure" | Score: 10.0 | Defects: [] → INCONSISTENT!
❌ Description: "Sharp and clean" | Score: 8.5 | Defects: [] → WHERE'S THE -1.5 DEDUCTION?
❌ Description: "Fiber (0.3mm) and rounding (0.4mm)" | Defects: [fiber only] → MISMATCH!

**CORRECT EXAMPLE:**
✅ Description: "0.2mm fiber at apex" | Score: 9.5 | Defects: [{type: "fiber_exposure", severity: "minor", description: "0.2mm"}]

────────────────────────────────────────────────────────────────────────
3. INSPECTION DOCUMENTATION
────────────────────────────────────────────────────────────────────────

**For EVERY component, state:**
• WHAT inspected (corner tip area)
• HOW inspected (max zoom, viewing angles)
• WHAT looked for (fiber, rounding, structural)
• WHAT found (defects OR confirmed absence)

❌ "Corner is perfect" → No inspection evidence
✅ "At max zoom: examined corner tip, checked for fiber/rounding/lift, zero defects - sharp apex maintained"

────────────────────────────────────────────────────────────────────────
4. NO TEMPLATE LANGUAGE
────────────────────────────────────────────────────────────────────────

🚨 **PROHIBITED:**
• Identical corner descriptions ("Sharp, no fiber, 10.0" × 4 corners)
• Generic colors ("dark border" instead of "navy blue border")
• Template phrases ("typical wear", "expected condition", "minor imperfections")

**REQUIRED:**
• Each corner has UNIQUE wording
• State ACTUAL colors ("navy blue" not "dark")
• Describe OBSERVABLE features, not assumptions

────────────────────────────────────────────────────────────────────────
5. PRE-SUBMISSION CHECKLIST
────────────────────────────────────────────────────────────────────────

**CRITICAL VALIDATIONS:**
□ Every defect in narrative → in defects array
□ Every defects array entry → described in narrative
□ Scores match descriptions (defect = deduction)
□ Each corner/edge/surface has unique description
□ Actual colors stated (not "dark"/"light")
□ Defect count matches array length
□ Total deductions sum to (10.0 - score)
□ If score = 10.0 → "zero defects" explicitly stated with evidence
□ If score < 10.0 → defect causing deduction described

**If ANY fails → Revise before submission**

────────────────────────────────────────────────────────────────────────
6. COMMON HALLUCINATION PATTERNS (AVOID)
────────────────────────────────────────────────────────────────────────

**FALSE POSITIVES (Inventing Defects):**
❌ "Likely minor wear given age" → ASSUMPTION, not observation
❌ "Typical edge wear for this era" → ASSUMPTION, not specific defect
❌ "Slight imperfections visible" → VAGUE, no observable evidence

**FALSE NEGATIVES (Claiming Perfection Without Proof):**
❌ "All corners flawless, 10.0" → No inspection documentation
❌ "No defects visible" [confidence C/D] → Can't claim no defects with poor visibility
❌ All 8 corners: "Sharp, no fiber, 10.0" → Template language, not individual inspection

**CORRECT APPROACH:**
✅ "At max zoom, top-left corner against red border: white fiber visible at tip, ~0.15mm where coating worn. No rounding, no lift/tilt detected."
• Observable evidence (white fiber, red border)
• Measurement (0.15mm)
• Location (top-left, corner tip)
• Actual colors (red, white)
• Method (max zoom)
• Negative findings (no rounding, no lift/tilt)

"""

# Build new file content
new_lines = lines[:section7_start] + [optimized_section7] + lines[section8_start:]

# Write back
with open('prompts/master_grading_rubric_v5.txt', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("\nSection 7 optimized!")
print(f"Original Section 7: {section8_start - section7_start} lines")
print(f"Optimized Section 7: {len(optimized_section7.split(chr(10)))} lines")
print(f"Saved: {(section8_start - section7_start) - len(optimized_section7.split(chr(10)))} lines")
