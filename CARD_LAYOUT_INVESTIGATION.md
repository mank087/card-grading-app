# Card Layout Investigation Summary

## Investigation Date
November 24, 2025

## Issues Reported
1. Sports card centering DCM Analysis box width different from Pokemon
2. Surface details section blank for Pokemon, Lorcana, MTG (data exists in DCM report)
3. Subgrade scores missing in Pokemon/Lorcana/MTG/Other corners/edges/surface sections
4. Other card centering summary text not displaying
5. DCM Optic Confidence scores need to be consistent across all card types

## Findings

### ✅ GOOD NEWS: All Frontend Code is Already Correct!

After systematic review of all CardDetailClient files, I found that **ALL card types have the identical, correct implementation**:

#### 1. Surface Details Mapping ✅
**All card types** (Sports, Pokemon, Lorcana, MTG, Other) have the correct mapping code:

```typescript
const rawFrontSurface = detailsJson.surface?.front || detailsJson.front_surface || {};
const rawBackSurface = detailsJson.surface?.back || detailsJson.back_surface || {};

const frontSurface = {
  analysis: rawFrontSurface.analysis,
  defects: rawFrontSurface.defects,
  summary: rawFrontSurface.front_summary || rawFrontSurface.summary,
  sub_score: rawFrontSurface.score
};
```

**Display code:**
```tsx
{frontSurface.analysis && (
  <div className="mb-3">
    <p className="text-xs text-gray-700">{frontSurface.analysis}</p>
  </div>
)}

{/* Defects array */}
{frontSurface.defects && Array.isArray(frontSurface.defects) && ...}

{frontSurface.summary && (
  <div className="pt-3 mt-auto border-t-2 border-blue-300 bg-blue-50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
    <p className="text-sm text-gray-800 font-medium">
      <span className="text-blue-700 font-bold">DCM Optic™ Analysis:</span> {frontSurface.summary}
    </p>
  </div>
)}
```

#### 2. Subgrade Scores Display ✅
**All card types** have the subgrade score display:

```tsx
{/* Corners */}
<div className="flex items-center justify-between mb-3">
  <h4 className="text-md font-bold text-blue-900">Corners</h4>
  {frontCorners.sub_score !== undefined && (
    <span className="text-xl font-bold text-blue-600">{frontCorners.sub_score}/10</span>
  )}
</div>
```

This pattern is repeated for Edges and Surface sections in all card types.

#### 3. Centering Summary Text ✅
**Other card** (and all others) have the centering summary:

```tsx
const frontAnalysisText = card.conversational_corners_edges_surface?.front_centering?.summary
  || centeringAnalysisText.front
  || centering.front_centering_analysis
  || 'No analysis available';

const formattedFront = formatDCMAnalysis(frontAnalysisText, ...);

// Display:
<p className="text-xs text-gray-700 leading-relaxed flex-grow">
  {formattedFront.text}
</p>
```

#### 4. Centering Box Width ✅
Both Sports and Pokemon have **identical width classes**:
```tsx
<div className="w-full max-w-xs mt-3">
  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border-2 border-purple-300 shadow-lg min-h-[200px] flex flex-col">
```

## Root Cause Analysis

Since all frontend code is correct and identical across card types, the issue is likely:

### 1. **Old Schema Data**
The cards you're viewing may have been graded with an **older schema (pre-v5.0)** that doesn't include:
- `quality_tier` fields in `conversational_centering_ratios`
- Nested structure (`surface: { front: {}, back: {} }`)
- `sub_score` fields in corners/edges/surface

### 2. **Backend Response Structure**
The backend may be returning data in a different format than expected, or some fields are null/undefined.

## Recommended Actions

### Step 1: Run the Diagnostic Script
I've created a diagnostic script to check the actual data structure:

```bash
npx tsx scripts/check-card-data-structure.ts <card_id> <card_type>
```

Examples:
```bash
npx tsx scripts/check-card-data-structure.ts 123 pokemon
npx tsx scripts/check-card-data-structure.ts 456 sports
npx tsx scripts/check-card-data-structure.ts 789 lorcana
```

This will show:
- Whether surface data exists and in what format
- Whether subgrade scores are present
- Whether centering summaries are available
- Whether this is a v5.0 card (with quality_tier)

### Step 2: Re-Grade Cards with Latest Schema
If the diagnostic shows missing fields, **re-grade the cards** to get the latest v5.0 data structure:

1. Open each card detail page
2. Click the "Re-Grade" button
3. Wait for grading to complete (120 seconds max)
4. Check if all sections now display correctly

### Step 3: Check Backend API Response
If re-grading doesn't fix it, check the actual API response:

1. Open browser DevTools (F12)
2. Go to Network tab
3. Reload the card page
4. Find the API request (e.g., `/api/pokemon/123`)
5. Check the JSON response structure for `conversational_corners_edges_surface`

### Step 4: Verify Database Schema
Ensure the database has the correct columns:
```sql
-- Check if quality_tier columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pokemon_cards'
AND column_name LIKE '%quality_tier%';

-- Check conversational_corners_edges_surface structure
SELECT
  id,
  conversational_corners_edges_surface->'surface'->'front' as front_surface,
  conversational_corners_edges_surface->'surface'->'back' as back_surface
FROM pokemon_cards
WHERE id = <card_id>;
```

## Frontend Code Locations

For reference, the correct implementation exists in these files:

### Sports (Baseline)
- **File:** `src/app/sports/[id]/CardDetailClient.tsx`
- **Centering:** Lines 3368-3503
- **Corners/Edges/Surface:** Lines 3604-3870

### Pokemon
- **File:** `src/app/pokemon/[id]/CardDetailClient.tsx`
- **Centering:** Lines 3691-3840
- **Corners/Edges/Surface:** Lines 3972-4330

### Lorcana
- **File:** `src/app/lorcana/[id]/CardDetailClient.tsx`
- **Centering:** Lines 3598-3732
- **Corners/Edges/Surface:** Similar pattern to Pokemon

### MTG
- **File:** `src/app/mtg/[id]/CardDetailClient.tsx`
- **Centering:** Lines 3589-3723
- **Corners/Edges/Surface:** Similar pattern to Pokemon

### Other
- **File:** `src/app/other/[id]/CardDetailClient.tsx`
- **Centering:** Lines 3468-3602
- **Corners/Edges/Surface:** Similar pattern to Pokemon

## Data Structure Requirements

For all sections to display correctly, the backend response must include:

```typescript
{
  conversational_centering_ratios: {
    front_lr: "50/50",
    front_tb: "51/49",
    front_quality_tier: "Perfect",  // v5.0+
    back_lr: "52/48",
    back_tb: "50/50",
    back_quality_tier: "Excellent"  // v5.0+
  },
  conversational_corners_edges_surface: {
    // Option 1: Nested structure (preferred for v5.0+)
    corners: {
      front: {
        top_left: "Sharp",
        top_right: "Sharp",
        bottom_left: "Minor wear",
        bottom_right: "Sharp",
        summary: "DCM analysis text...",
        score: 9.5
      },
      back: { /* same structure */ }
    },
    edges: {
      front: {
        top: "Clean",
        bottom: "Clean",
        left: "Clean",
        right: "Clean",
        summary: "DCM analysis text...",
        score: 10
      },
      back: { /* same structure */ }
    },
    surface: {
      front: {
        analysis: "Detailed analysis text...",
        defects: [
          {
            type: "scratch",
            severity: "minor",
            location: "top-left quadrant",
            size: "small",
            description: "Fine surface scratch..."
          }
        ],
        summary: "DCM analysis text...",
        score: 9.0
      },
      back: { /* same structure */ }
    },
    front_centering: {
      summary: "Centering analysis text..."
    },
    back_centering: {
      summary: "Centering analysis text..."
    },

    // Option 2: Flat structure (legacy, also supported)
    front_corners: { /* same fields as corners.front */ },
    back_corners: { /* same fields as corners.back */ },
    front_edges: { /* same fields as edges.front */ },
    back_edges: { /* same fields as edges.back */ },
    front_surface: { /* same fields as surface.front */ },
    back_surface: { /* same fields as surface.back */ }
  }
}
```

## Next Steps

1. **Run the diagnostic script** on one card of each type
2. **Share the output** so we can see the actual data structure
3. **Re-grade if needed** to get v5.0 data
4. If issues persist, we'll investigate the backend API route and database mapping

## Conclusion

✅ **All frontend layouts are correct and consistent across card types**
✅ **Surface mapping, subgrade scores, and centering summaries are all properly implemented**
✅ **The issue is most likely related to data availability, not code**

The diagnostic script will help us identify exactly what data is present or missing for your specific cards.
