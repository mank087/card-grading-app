# v3.5 PATCHED v2 Clean Rebuild Plan

**Date:** October 24, 2025
**Status:** 🚧 In Progress
**Approach:** Clean slate - purpose-built for v3.5, no backward compatibility hacks

---

## 🎯 Why Rebuild?

### Current Problems
1. **Parser was built for v3.2** - keeps breaking on v3.5 format changes
2. **Frontend was built for v3.2** - only shows STEP 1 & 2, skips STEP 3-15
3. **Too many band-aids** - conditional checks, regex fallbacks, "what if" logic
4. **Hard to debug** - which of the 10 fallback patterns failed?
5. **Hard to maintain** - every format change requires 3 file updates

### Clean Slate Benefits
1. ✅ **Purpose-built for v3.5** - no legacy format support needed
2. ✅ **Simpler code** - one format, one parser, one renderer
3. ✅ **Easier to debug** - clear expectations, clear failures
4. ✅ **Easier to maintain** - one source of truth (the v3.5 prompt)
5. ✅ **More reliable** - designed for the actual output, not guessing

---

## 📋 v3.5 PATCHED v2 Output Structure

### Markdown Format (from server logs)

```markdown
# Card Grading Report

## [STEP 1] CARD INFORMATION EXTRACTION

- **Card Name / Title**: Eddy Pineiro
- **Player / Character**: Eddy Pineiro
- **Set Name**: Donruss
- **Year**: 2024
...

## [STEP 2] IMAGE QUALITY & CONFIDENCE ASSESSMENT

- **Image Confidence**: B
- **Justification**: The images are clear...

## [STEP 3] FRONT EVALUATION

### A. Centering

- **Left/Right**: 55/45
- **Top/Bottom**: 50/50
- **Centering Sub-Score**: 9.5

### B. Corners

- **Top Left**: Slight wear
- **Top Right**: Slight wear
- **Bottom Left**: Slight wear
- **Bottom Right**: Slight wear
- **Corners Sub-Score**: 8.5

### C. Edges

- **Left**: Minor wear
- **Right**: Minor wear
- **Top**: Minor wear
- **Bottom**: Minor wear
- **Edges Sub-Score**: 8.5

### D. Surface

- **Defects**: Visible crease near the top right
- **Surface Sub-Score**: 4.0 (due to crease)

## [STEP 4] BACK EVALUATION

[Same structure as STEP 3]

## [STEP 5] SIDE-TO-SIDE CROSS-VERIFICATION

- **Centering Correlation**: ✓ Consistent
- **Corner Damage Consistency**: ✓ Consistent
...

## [STEP 6] DEFECT PATTERN ANALYSIS

- **Defect Pattern**: Structural Compromise...

## [STEP 7] SUB-SCORE GUIDELINES

[Technical - not displayed]

## [STEP 8] SUB-SCORE TABLE

:::SUBSCORES
centering_front: 9.5
centering_back: 9.5
corners_front: 8.5
corners_back: 8.5
edges_front: 8.5
edges_back: 8.5
surface_front: 4.0
surface_back: 4.0
weighted_total: 6.5
:::END

## [STEP 9] GRADE CAP ENFORCEMENT

[Technical - not displayed]

## [STEP 10] FINAL GRADE CALCULATION AND REPORT

- **Weighted Total (Pre-Cap)**: 6.5
- **Capped Grade**: 4.0 (due to structural crease)
- **Final Decimal Grade**: 4.0
- **Grade Range**: 4.0 ± 0.5 (due to Image Confidence B)
- **Whole Number Equivalent**: 4
- **Condition Label**: Good (G)

## [STEP 11] CONDITION LABEL CONVERSION

[Technical - not displayed]

## [STEP 12] CHECKLIST BLOCK

:::CHECKLIST
autograph_verified: false
structural_damage: true
...
:::END

## [STEP 13] VALIDATION & QUALITY CONTROL

[Technical - not displayed]

## [STEP 14] STATISTICAL & CONSERVATIVE CONTROL

- Grade distribution maintained...

## [STEP 15] APPENDIX – DEFINITIONS

- **Whitening**: Fiber exposure...
- **Crease**: Surface break visible both sides...

## [STEP 16] FINAL OUTPUT REQUIREMENTS

[Technical - not displayed]

:::META
prompt_version: Conversational_Grading_v3.5_PATCHED_v2
model: GPT-4o-2024-11-20
...
:::END
```

---

## 🏗️ New Architecture Design

### 1. Parser (v3.5-specific)

**File:** `src/lib/conversationalParserV3_5.ts`

**Purpose:** Clean, simple parser that ONLY handles v3.5 format

**Key Features:**
- ✅ Parse `## [STEP N] TITLE` format (not flexible regex - exact match)
- ✅ Parse `### A. Subsection` format
- ✅ Parse `- **Key**: Value` bullet points
- ✅ Extract centering ratios: `Left/Right: 55/45`
- ✅ Parse `:::SUBSCORES`, `:::CHECKLIST`, `:::META` blocks
- ✅ Extract grade from `Final Decimal Grade: 4.0`
- ✅ Extract corner/edge details from subsections
- ✅ Extract surface defects from subsections

**Design Principles:**
- 🎯 **Single Responsibility** - one function per extraction task
- 🎯 **Explicit over Implicit** - exact format matching, no guessing
- 🎯 **Fail Fast** - if format doesn't match, log error and return null
- 🎯 **Type Safety** - strong TypeScript interfaces

**Interface:**
```typescript
interface ConversationalGradingV3_5 {
  // Main grade
  decimal_grade: number;
  whole_grade: number;
  grade_range: string;
  condition_label: string;

  // Image quality
  image_confidence: string; // A, B, C
  image_justification: string;

  // Card info
  card_info: {
    card_name: string;
    player: string;
    set_name: string;
    year: string;
    manufacturer: string;
    card_number: string;
    sport: string;
    rarity_tier: string;
  };

  // Sub-scores
  sub_scores: {
    centering: { front: number; back: number };
    corners: { front: number; back: number };
    edges: { front: number; back: number };
    surface: { front: number; back: number };
    weighted_total: number;
  };

  // Centering ratios
  centering: {
    front_lr: string; // "55/45"
    front_tb: string; // "50/50"
    back_lr: string;
    back_tb: string;
  };

  // Defects
  corners: {
    front: {
      top_left: string;
      top_right: string;
      bottom_left: string;
      bottom_right: string;
    };
    back: {
      top_left: string;
      top_right: string;
      bottom_left: string;
      bottom_right: string;
    };
  };

  edges: {
    front: {
      left: string;
      right: string;
      top: string;
      bottom: string;
    };
    back: {
      left: string;
      right: string;
      top: string;
      bottom: string;
    };
  };

  surface: {
    front: string;
    back: string;
  };

  // Cross-verification
  cross_verification: {
    centering_correlation: string;
    corner_consistency: string;
    edge_pattern: string;
    structural_verification: string;
  };

  // Final report sections
  defect_pattern: string;
  final_calculation: string;
  statistical_control: string;
  appendix: string;

  // Metadata
  meta: {
    prompt_version: string;
    model: string;
    evaluated_at: string;
  };

  // Raw markdown for frontend display
  full_markdown: string;
}
```

**Parser Functions:**
```typescript
// Main parser
export function parseConversationalV3_5(markdown: string): ConversationalGradingV3_5 | null;

// Step-specific parsers
function parseStep1_CardInfo(stepContent: string): CardInfo;
function parseStep2_ImageQuality(stepContent: string): ImageQuality;
function parseStep3_FrontEvaluation(stepContent: string): FrontEvaluation;
function parseStep4_BackEvaluation(stepContent: string): BackEvaluation;
function parseStep5_CrossVerification(stepContent: string): CrossVerification;
function parseStep6_DefectPattern(stepContent: string): string;
function parseStep10_FinalCalculation(stepContent: string): FinalCalculation;
function parseStep14_StatisticalControl(stepContent: string): string;
function parseStep15_Appendix(stepContent: string): string;

// Block parsers
function parseSubscoresBlock(markdown: string): SubScores;
function parseChecklistBlock(markdown: string): Checklist;
function parseMetaBlock(markdown: string): Meta;

// Subsection parsers
function parseCentering(subsection: string): { lr: string; tb: string; score: number };
function parseCorners(subsection: string): { tl: string; tr: string; bl: string; br: string; score: number };
function parseEdges(subsection: string): { left: string; right: string; top: string; bottom: string; score: number };
function parseSurface(subsection: string): { defects: string; score: number };
```

---

### 2. Frontend Renderer (v3.5-specific)

**File:** `src/app/sports/[id]/CardDetailClient.tsx` (update formatConversationalGrading function)

**Purpose:** Clean, simple renderer that displays v3.5 sections

**Design:**
```typescript
const formatConversationalGradingV3_5 = (markdown: string): string => {
  if (!markdown) return '';

  // Remove parser-only blocks
  const cleaned = markdown
    .replace(/:::SUBSCORES[\s\S]*?:::END/g, '')
    .replace(/:::CHECKLIST[\s\S]*?:::END/g, '')
    .replace(/:::META[\s\S]*?:::END/g, '');

  // Split into steps
  const steps = cleaned.split(/(?=## \[STEP \d+\])/g).filter(s => s.trim());

  let html = '';

  for (const step of steps) {
    const stepMatch = step.match(/## \[STEP (\d+)\] (.+)/);
    if (!stepMatch) continue;

    const stepNumber = parseInt(stepMatch[1]);
    const stepTitle = stepMatch[2];
    const stepContent = step.replace(/## \[STEP \d+\] .+\n/, '');

    // Display logic - explicit and clear
    switch (stepNumber) {
      case 1: // CARD INFORMATION EXTRACTION
        html += renderCardInfo(stepContent, stepTitle);
        break;

      case 2: // IMAGE QUALITY & CONFIDENCE ASSESSMENT
        html += renderImageQuality(stepContent, stepTitle);
        break;

      case 3: // FRONT EVALUATION
      case 4: // BACK EVALUATION
        // Store for two-column layout
        if (stepNumber === 3) {
          frontEval = stepContent;
        } else {
          html += renderFrontBackEvaluation(frontEval, stepContent);
        }
        break;

      case 5: // SIDE-TO-SIDE CROSS-VERIFICATION
        html += renderCrossVerification(stepContent, stepTitle);
        break;

      case 6: // DEFECT PATTERN ANALYSIS
        html += renderDefectPattern(stepContent, stepTitle);
        break;

      case 10: // FINAL GRADE CALCULATION AND REPORT
        html += renderFinalCalculation(stepContent, stepTitle);
        break;

      case 14: // STATISTICAL & CONSERVATIVE CONTROL
        html += renderStatisticalControl(stepContent, stepTitle);
        break;

      case 15: // APPENDIX – DEFINITIONS
        html += renderAppendix(stepContent, stepTitle);
        break;

      // Skip technical steps (7, 8, 9, 11, 12, 13, 16)
      default:
        // Intentionally skip - these are technical/parser-only steps
        break;
    }
  }

  return html;
};

// Render functions
function renderCardInfo(content: string, title: string): string {
  return `
    <div class="my-6">
      <div class="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-5 border-l-4 border-indigo-500 shadow-sm">
        <div class="flex items-center gap-3 mb-4">
          ${cardInfoIcon}
          <h3 class="text-lg font-bold text-gray-900">${title}</h3>
        </div>
        ${formatBulletPoints(content)}
      </div>
    </div>
  `;
}

function renderFrontBackEvaluation(frontContent: string, backContent: string): string {
  return `
    <div class="my-6">
      <div class="grid md:grid-cols-2 gap-6">
        <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-l-4 border-blue-500 shadow-sm">
          <h3 class="text-lg font-bold text-blue-900 mb-4">Front Evaluation</h3>
          ${formatSubsections(frontContent)}
        </div>
        <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-l-4 border-green-500 shadow-sm">
          <h3 class="text-lg font-bold text-green-900 mb-4">Back Evaluation</h3>
          ${formatSubsections(backContent)}
        </div>
      </div>
    </div>
  `;
}

// Helper: Format subsections (A. Centering, B. Corners, etc.)
function formatSubsections(content: string): string {
  const subsections = content.split(/(?=### [A-D]\. )/g);
  let html = '';

  for (const subsection of subsections) {
    const titleMatch = subsection.match(/### ([A-D])\. (.+)/);
    if (!titleMatch) continue;

    const letter = titleMatch[1];
    const subsectionTitle = titleMatch[2];
    const subsectionContent = subsection.replace(/### [A-D]\. .+\n/, '');

    html += `
      <div class="mb-4">
        <h4 class="text-sm font-bold text-gray-800 mb-2">${letter}. ${subsectionTitle}</h4>
        ${formatBulletPoints(subsectionContent)}
      </div>
    `;
  }

  return html;
}

// Helper: Format bullet points
function formatBulletPoints(content: string): string {
  const lines = content.trim().split('\n');
  let html = '<div class="space-y-2">';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('-')) continue;

    // Extract key-value from: - **Key**: Value
    const kvMatch = trimmed.match(/^- \*\*(.+?)\*\*:\s*(.+)/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2];
      html += `
        <div class="flex items-start gap-2 pl-4">
          <span class="text-indigo-600 mt-1">•</span>
          <div>
            <span class="font-semibold text-gray-900">${escapeHtml(key)}:</span>
            <span class="text-gray-700">${escapeHtml(value)}</span>
          </div>
        </div>
      `;
    } else {
      // Plain bullet point
      const text = trimmed.substring(2).trim();
      html += `
        <div class="flex items-start gap-2 pl-4">
          <span class="text-indigo-600 mt-1">•</span>
          <span class="text-gray-700">${escapeHtml(text)}</span>
        </div>
      `;
    }
  }

  html += '</div>';
  return html;
}
```

---

## 📝 Implementation Steps

### Phase 1: Create New Parser ✅

1. ✅ Backup current files
2. ⏳ Create `src/lib/conversationalParserV3_5.ts`
3. ⏳ Define `ConversationalGradingV3_5` interface
4. ⏳ Implement step-specific parsers
5. ⏳ Implement block parsers
6. ⏳ Implement subsection parsers
7. ⏳ Test parser with real markdown from server logs

### Phase 2: Create New Frontend Renderer

1. ⏳ Create `formatConversationalGradingV3_5()` function
2. ⏳ Implement render functions for each step
3. ⏳ Implement subsection formatters
4. ⏳ Implement helper functions (bullet points, key-value pairs)
5. ⏳ Update CardDetailClient.tsx to use new function

### Phase 3: Update API Route

1. ⏳ Update `/api/vision-grade/[id]/route.ts` to use new parser
2. ⏳ Save parsed data to correct database columns
3. ⏳ Ensure JSONB structure matches new interface

### Phase 4: Testing

1. ⏳ Grade a brand new card
2. ⏳ Verify server logs show correct parsing
3. ⏳ Verify frontend displays all 9 narrative steps
4. ⏳ Verify tabs populate with correct data
5. ⏳ Verify no TypeScript errors
6. ⏳ Verify no browser console errors

---

## ✅ Success Criteria

- [ ] Parser extracts ALL v3.5 data correctly
- [ ] Frontend displays ALL 9 narrative steps:
  - STEP 1: CARD INFORMATION EXTRACTION
  - STEP 2: IMAGE QUALITY & CONFIDENCE ASSESSMENT
  - STEP 3 & 4: Front/Back Evaluation (two-column)
  - STEP 5: SIDE-TO-SIDE CROSS-VERIFICATION
  - STEP 6: DEFECT PATTERN ANALYSIS
  - STEP 10: FINAL GRADE CALCULATION AND REPORT
  - STEP 14: STATISTICAL & CONSERVATIVE CONTROL
  - STEP 15: APPENDIX – DEFINITIONS
- [ ] Technical steps correctly hidden (7, 8, 9, 11, 12, 13, 16)
- [ ] Centering tab shows actual ratios (55/45, not null)
- [ ] Corners & Edges tab shows defect details
- [ ] Surface tab shows defect descriptions
- [ ] Analysis tab shows sub-scores
- [ ] No errors in server logs
- [ ] No errors in browser console
- [ ] Code is clean, maintainable, well-documented

---

## 🎯 Next Actions

1. **Create v3.5-specific parser** (`conversationalParserV3_5.ts`)
2. **Create v3.5-specific renderer** (update `formatConversationalGradingV3_5` in CardDetailClient.tsx)
3. **Update API route** to use new parser
4. **Test thoroughly** with multiple cards
5. **Remove old backward compatibility code** (once verified working)

---

**This is the right approach.** Clean, purpose-built, maintainable. 🚀
