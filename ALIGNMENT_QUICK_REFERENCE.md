# QUICK REFERENCE: v4.0 JSON Alignment Issues

## CRITICAL BUGS TO FIX IMMEDIATELY

### 🔴 BUG #1: Corner Defects Not Extracted (CRITICAL)
**Location:** `route.ts` lines 522-523, 563-564, 607-610, 628-631

**Problem:** Code treats corner objects as strings
```typescript
// ❌ WRONG (current code)
`TL: ${parsedJSONData.corners?.front?.top_left || 'N/A'}`
// Returns: "TL: [object Object]"

// ✅ CORRECT
`TL: ${parsedJSONData.corners?.front?.top_left?.condition || 'N/A'}`
// Returns: "TL: Sharp and clean"
```

**Impact:** All corner defect details are lost

---

### 🔴 BUG #2: Professional Grade Estimates Ignored (CRITICAL)
**Location:** `route.ts` lines 459-656

**Problem:** AI provides professional grade estimates in JSON, but backend NEVER extracts them

**Current Flow:**
```
AI generates estimates → route.ts IGNORES them → uses separate mapper instead
```

**Fix:** Extract `professional_grade_estimates` from JSON (1 line change)
```typescript
// Add to conversationalGradingData (line ~508)
professional_grade_estimates: parsedJSONData.professional_grade_estimates || null,
```

---

### 🔴 BUG #3: preliminary_grade Missing from Frontend Type
**Location:** `CardDetailClient.tsx` line ~462

**Problem:** Database has the column, backend saves it, but frontend type definition missing

**Fix:** Add one line to Card interface
```typescript
conversational_preliminary_grade?: number | null;
```

---

### 🔴 BUG #4: Summary Fields Not Extracted
**Location:** `route.ts` line ~516

**Problem:** JSON provides human-readable summaries for each category, but they're never extracted

**Missing:**
- `centering.front.summary` - "Nearly perfect centering..."
- `corners.front.summary` - "Overall excellent corner quality..."
- `edges.front.summary` - "Minimal edge wear..."
- `surface.front.summary` - "Nearly pristine surface..."
- (Same for back side)

**Impact:** Loss of contextual explanations

---

## QUICK FIX GUIDE

### Fix #1: Corner Defects (5 locations)
1. Line 522-523 (transformedDefects.front.corners)
2. Line 563-564 (transformedDefects.back.corners)
3. Line 607-610 (rawDefectsForEbay.front.corners)
4. Line 628-631 (rawDefectsForEbay.back.corners)

**Search for:** `parsedJSONData.corners?.front?.top_left ||`
**Replace with:** `parsedJSONData.corners?.front?.top_left?.condition ||`

**Also add defect extraction:**
```typescript
defects: [
  ...(parsedJSONData.corners?.front?.top_left?.defects || []).map((d: string) => ({
    description: d,
    severity: 'minor',
    location: 'top_left corner'
  })),
  // ... repeat for top_right, bottom_left, bottom_right
]
```

### Fix #2: Professional Grades (1 line)
**File:** `route.ts` line ~508
```typescript
professional_grade_estimates: parsedJSONData.professional_grade_estimates || null,
```

### Fix #3: Frontend Type (1 line)
**File:** `CardDetailClient.tsx` line ~462
```typescript
conversational_preliminary_grade?: number | null;
```

### Fix #4: Summary Fields (requires migration)
**File:** `route.ts` line ~516
```typescript
category_summaries: {
  centering_front: parsedJSONData.centering?.front?.summary || null,
  centering_back: parsedJSONData.centering?.back?.summary || null,
  corners_front: parsedJSONData.corners?.front?.summary || null,
  corners_back: parsedJSONData.corners?.back?.summary || null,
  edges_front: parsedJSONData.edges?.front?.summary || null,
  edges_back: parsedJSONData.edges?.back?.summary || null,
  surface_front: parsedJSONData.surface?.front?.summary || null,
  surface_back: parsedJSONData.surface?.back?.summary || null
},
```

**Migration:**
```sql
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_category_summaries JSONB;
```

---

## TESTING CHECKLIST

After fixes, test:
- [ ] Upload card with corner defects → verify corner condition readable
- [ ] Check corner defects array is populated
- [ ] Verify professional grade estimates saved from JSON
- [ ] Verify preliminary_grade accessible in frontend
- [ ] Check category summaries stored in database

---

## ALIGNMENT STATS

| Category | Status |
|----------|--------|
| ✅ Fully aligned | 28 fields (19%) |
| 🔴 Critical bugs | 4 issues |
| ⚠️ Missing data | 119 fields (79%) |
| ℹ️ Intentionally skipped | ~100 fields |

---

## ESTIMATED FIX TIME

- **Critical fixes (1-3):** 30 minutes
- **Summary extraction (4):** 15 minutes
- **Testing:** 15 minutes
- **Total:** ~1 hour

---

**See COMPREHENSIVE_ALIGNMENT_REPORT_v4_0_JSON.md for full details**
