# Slab Detection Enhancement for Conversational Grading v3.5

**Date:** October 29, 2025
**Purpose:** Restore working professional slab detection from v1 prompt to v3.5 PATCHED v2

---

## 📋 PROBLEM IDENTIFIED

The current prompt (v3.5 PATCHED v2) has slab extraction instructions buried in Step 1 (lines 316-350), causing the AI to miss or skip them. The old v1 prompt had slab detection as a **MAJOR EARLY SECTION** with strong visual emphasis, detailed examples, and a clear 5-step protocol.

---

## ✅ SOLUTION: Add Prominent Slab Detection Section

### Placement
Insert this section **IMMEDIATELY AFTER STEP 0** (Alteration Detection) and **BEFORE STEP 1** (Card Information Extraction).

This ensures the AI:
1. Checks for slabs EARLY in the process
2. Sees the instructions with high prominence
3. Understands it's a critical task, not optional

---

## 📝 ENHANCED SLAB DETECTION SECTION (To Add to Prompt)

```markdown
===========================================
STEP 0.5: PROFESSIONAL GRADING SLAB DETECTION
===========================================

Version: Slab Detection Module v2.0
Purpose: Detect and extract information from professional grading slabs (PSA, BGS, CGC, SGC, HGA, TAG, CSG)

⚠️ **CRITICAL - MANDATORY SLAB CHECK:**
**BEFORE YOU BEGIN STEP 1, YOU MUST CHECK IF THIS CARD IS IN A PROFESSIONAL GRADING SLAB.**

If card is in a professional grading slab:
1. ✅ Extract the professional grade and certification number from the slab label
2. ✅ STILL perform complete AI grading analysis on the visible card through the slab
3. ✅ Report BOTH grades - professional grade AND your AI analysis grade
4. ✅ Note that your AI grade is based on visible card portions through slab holder

---

### 🔍 DETECTION PROTOCOL (5 STEPS)

**STEP 1: CHECK FOR SLAB/HOLDER**

Look for these indicators that card is professionally graded:
- Card is encased in rigid plastic holder/slab (hard case, not soft sleeve)
- Professional grading label visible (usually at top or bottom of case)
- Label contains company logo, grade number, and certification number
- Slab is thicker and more rigid than penny sleeve or top loader

**STEP 2: IDENTIFY GRADING COMPANY**

If slab detected, identify company by visual branding on label:

| Company | Label Visual Characteristics |
|---------|------------------------------|
| **PSA** | Red label, "PSA" logo in white text, large white number grade (1-10), certification number below grade, player name at top |
| **BGS** (Beckett) | Black label (or Gold/Black Label for pristine 10), "BECKETT" or "BGS" text, decimal grade (e.g., 9.5), four visible subgrade boxes (Centering/Corners/Edges/Surface) |
| **CGC** | Blue or orange label, "CGC" logo, decimal grade, subgrades visible in boxes |
| **SGC** | Black label, "SGC" logo, numeric grade (1-10 or 1-100 scale), card name |
| **TAG** | White/silver label, "TAG" logo, decimal grade with 0.1 increments (e.g., 9.8) |
| **HGA** | Clear/transparent label, "HGA" logo, decimal grade |
| **CSG** | White/blue label, "CSG" logo, numeric grade |

**STEP 3: EXTRACT SLAB METADATA**

Read text from the label and extract:
- **Professional Grade**: The numeric grade (e.g., "10", "9.5", "9")
  - PSA: 1-10 scale (whole numbers)
  - BGS: 0.5-10 scale (half-point increments)
  - SGC: 1-10 or 1-100 scale
  - CGC/TAG/HGA: Decimal scale

- **Certification Number**: Cert # or serial number printed on label
  - Format: Usually 7-10 digits (e.g., "12345678", "PSA-12345678")
  - Location: Usually below grade on front label or on back/side of slab
  - Look for text like "Cert #:", "Certification #:", or just numbers

- **Subgrades** (BGS/CGC only):
  - Four subgrade numbers for: Centering, Corners, Edges, Surface
  - Format: "9.5 / 10 / 9.5 / 9.5" or in separate boxes
  - Only BGS and CGC provide subgrades

**STEP 4: PERFORM AI GRADING**

**⚠️ CRITICAL**: Even if slab detected, you MUST still grade the card using normal grading procedures.
- Grade based on VISIBLE card portions through the slab plastic
- Note that slab holder may cause glare, reflections, or obscure some areas
- Adjust image_confidence if viewing is impaired by slab glare
- Document in case_detection that card is in professional slab

**STEP 5: OUTPUT FORMAT**

**In Step 1 (Card Information Extraction), include these fields:**

```markdown
- **Professional Grade**: PSA 10 (Gem Mint)
  [Or: "BGS 9.5 (Gem Mint)" or "SGC 98" or "None visible" if not slabbed]

- **Certification Number**: 12345678
  [Or: "N/A" if not slabbed or cert number not visible]

- **Sub-Grades** (BGS/CGC only): 9.5/10/9.5/10
  [Format: Centering/Corners/Edges/Surface]
  [Or: "N/A" if not BGS/CGC or not visible]
```

**If no slab detected:**
- **Professional Grade**: None visible
- **Certification Number**: N/A
- **Sub-Grades**: N/A

---

### 📸 VISUAL IDENTIFICATION GUIDE

**PSA Slab:**
- Red label at top of case
- Large white number (1-10) in center of label
- "PSA" text above grade
- "GEM MT 10" or similar condition description
- Certification number below grade (8-digit number)
- Player name and card details at top of label

**BGS/Beckett Slab:**
- Black label (or gold for perfect 10)
- "BECKETT" or "BGS" text
- Decimal grade (e.g., 9.5) in large text
- Four subgrade boxes visible showing: Centering, Corners, Edges, Surface scores
- Certification number on label
- Card information at top

**SGC Slab:**
- Black label
- "SGC" logo
- Numeric grade (1-10 or 1-100)
- Card information on label
- Certification barcode or number

**CGC Slab:**
- Blue or orange label
- "CGC" logo
- Decimal grade with subgrades in boxes
- Certification number

---

### 🎯 EXAMPLES OF CORRECT OUTPUT

**Example 1: PSA 10 Slab Detected**

In your Step 1 output, include:
```markdown
- **Card Name**: Shane Gillis
- **Player**: Shane Gillis
- **Set Name**: Topps Now
- **Year**: 2024
- **Professional Grade**: PSA 10 (Gem Mint)
- **Certification Number**: 12345678
- **Sub-Grades**: N/A
```

**Example 2: BGS 9.5 with Subgrades Detected**

```markdown
- **Card Name**: Mike Trout
- **Player**: Mike Trout
- **Set Name**: Bowman Chrome
- **Year**: 2011
- **Professional Grade**: BGS 9.5 (Gem Mint)
- **Certification Number**: BGS-0012345678
- **Sub-Grades**: 9.5/10/9.5/10
```

**Example 3: Raw Card (No Slab)**

```markdown
- **Card Name**: LeBron James
- **Player**: LeBron James
- **Set Name**: Panini Prizm
- **Year**: 2020
- **Professional Grade**: None visible
- **Certification Number**: N/A
- **Sub-Grades**: N/A
```

---

### ⚠️ CRITICAL REMINDERS

1. **DO NOT REFUSE TO GRADE SLABBED CARDS**
   - You MUST grade cards in professional slabs
   - Your AI grade is independent and provides comparison
   - Both grades are valuable information

2. **LOOK AT THE SLAB LABEL FIRST**
   - Check for company logo (PSA, BGS, SGC, etc.)
   - Read the grade number from the label
   - Find the certification number (usually below grade)

3. **EXTRACT DATA EVEN IF PARTIALLY VISIBLE**
   - If you can see "PSA 10" but certification number is obscured → Report grade, note cert number not visible
   - If slab type is unclear → Report "unknown" for company, but note slab detected

4. **OUTPUT FORMAT MATTERS**
   - Use EXACT format: `Professional Grade: PSA 10 (Gem Mint)`
   - Use EXACT format: `Certification Number: 12345678`
   - These formats are parsed by the system

5. **ALWAYS OUTPUT THESE FIELDS IN STEP 1**
   - Professional Grade (required)
   - Certification Number (required)
   - Sub-Grades (only if BGS/CGC)

---

### 🚫 COMMON MISTAKES TO AVOID

❌ **DON'T SAY:** "I'm unable to grade this card because it's in a slab"
✅ **DO SAY:** "Card is in PSA 10 slab. Proceeding with independent AI grading analysis."

❌ **DON'T SKIP:** Professional Grade and Certification Number fields in Step 1
✅ **DO INCLUDE:** All three fields (Professional Grade, Certification Number, Sub-Grades) in Step 1 table

❌ **DON'T WRITE:** "Professional Grade: Not applicable" (if slab detected)
✅ **DO WRITE:** "Professional Grade: PSA 10 (Gem Mint)" (extract from label)

❌ **DON'T WRITE:** "Certification Number: See slab"
✅ **DO WRITE:** "Certification Number: 12345678" (read from label)

---

**END OF SLAB DETECTION MODULE**

Now proceed to STEP 1: CARD INFORMATION EXTRACTION
```

---

## 🎯 IMPLEMENTATION INSTRUCTIONS

### Where to Insert
Add this section in `prompts/conversational_grading_v3_5_PATCHED.txt`:

**Location:** Between current Step 0 and Step 1

**Before:**
```
## [STEP 0] ALTERATION DETECTION AND FLAGGING
...
[end of step 0]

## [STEP 1] CARD INFORMATION DETAILS
...
```

**After:**
```
## [STEP 0] ALTERATION DETECTION AND FLAGGING
...
[end of step 0]

===========================================
STEP 0.5: PROFESSIONAL GRADING SLAB DETECTION
===========================================
[INSERT NEW SECTION HERE]

## [STEP 1] CARD INFORMATION DETAILS
...
```

### Modifications to Step 1
Update the Step 1 table to include:
```markdown
| Professional Grade | [Company] [Grade] ([Description]) or "None visible" |
| Certification Number | [8-10 digit number] or "N/A" |
| Sub-Grades (BGS/CGC only) | [C/CR/E/S format] or "N/A" |
```

---

## 📊 EXPECTED RESULTS AFTER IMPLEMENTATION

### Test Case: PSA 10 Shane Gillis Card

**AI Output (Step 1):**
```markdown
- **Card Name**: Shane Gillis
- **Player**: Shane Gillis
- **Professional Grade**: PSA 10 (Gem Mint)
- **Certification Number**: 12345678
- **Sub-Grades**: N/A
```

**Parser Extraction:**
```typescript
{
  detected: true,
  company: "PSA",
  grade: "10",
  grade_description: "Gem Mint",
  cert_number: "12345678",
  sub_grades: null
}
```

**Frontend Display:**
- Gold box with "PSA 10 (Gem Mint)"
- Certification #: 12345678
- AI Grade comparison: 10.0 DCM

---

## ✅ BENEFITS OF THIS APPROACH

1. **Early Detection:** AI checks for slab BEFORE extracting card info
2. **Visual Prominence:** Section header with separators makes it unmissable
3. **Clear Protocol:** 5-step process is easy to follow
4. **Visual Guide:** Table showing label characteristics for each company
5. **Examples:** 3 complete examples showing exact output format
6. **Emphasis:** ⚠️ warnings and ✅/❌ markers draw attention
7. **Parser-Friendly:** Output format matches what parser expects

---

## 🔄 ALTERNATIVE: Shorter Version (If Prompt Too Long)

If adding the full section makes the prompt too long, use this condensed version:

```markdown
⚠️ **MANDATORY PRE-CHECK: PROFESSIONAL SLAB DETECTION** ⚠️

BEFORE STEP 1: Check if card is in a professional grading slab (PSA, BGS, SGC, CGC, HGA, TAG).

If slab detected:
1. Read the grade from the label (e.g., "PSA 10", "BGS 9.5")
2. Read the certification number from the label (usually 7-10 digits)
3. For BGS/CGC: Extract subgrades (Centering/Corners/Edges/Surface)

**In Step 1, you MUST include:**
- **Professional Grade**: [Company] [Grade] ([Description]) or "None visible"
- **Certification Number**: [Number] or "N/A"
- **Sub-Grades**: [C/CR/E/S] or "N/A"

**DO NOT refuse to grade slabbed cards. Extract the professional grade AND perform your AI grading.**
```

---

**Next Step:** Choose which version to implement and update the prompt file.

---

END OF ENHANCEMENT DOCUMENTATION
