# API Routes Analysis

**Date:** October 28, 2025
**Purpose:** Document all API routes and identify duplicates/dead code

---

## 📊 ROUTE INVENTORY

### ✅ ACTIVE ROUTES

#### 1. `/api/vision-grade/[id]` (PRIMARY GRADING ENDPOINT)
**File:** `src/app/api/vision-grade/[id]/route.ts`
**Status:** ✅ ACTIVE - PRIMARY
**HTTP Methods:** GET
**Purpose:** Main card grading endpoint using Conversational AI v3.5 PATCHED v2

**Used By:**
- `src/app/sports/[id]/CardDetailClient.tsx` (lines 1287, 1336, 1480)

**Functionality:**
- Single-stage conversational AI grading
- Returns comprehensive grading data with v3.8 weakest link scoring
- Caches results (can force regrade with `?force_regrade=true`)
- Supports all card types (sports, Pokémon, etc.)

**Database Updates:**
- All conversational AI fields
- Professional grade estimates
- Card information

---

#### 2. `/api/sports/[id]`
**File:** `src/app/api/sports/[id]/route.ts`
**Status:** ⚠️ PARTIALLY ACTIVE (DELETE/PATCH only)
**HTTP Methods:** GET, PATCH, DELETE
**Purpose:** Sports card CRUD operations

**Used By:**
- `src/app/sports/[id]/CardDetailClient.tsx` (line 1508 - DELETE only)

**Functionality:**
- **GET:** Grading endpoint (SUPERSEDED by `/api/vision-grade/[id]`)
- **PATCH:** Update card data (ACTIVE)
- **DELETE:** Delete card (ACTIVE)

**Recommendation:**
- ⚠️ **DEPRECATE GET METHOD** - Frontend uses `/api/vision-grade/[id]` instead
- ✅ **KEEP PATCH/DELETE** - Still needed for card management

**Migration Path:**
1. Verify frontend doesn't call GET method
2. Remove or comment out GET handler
3. Keep PATCH and DELETE handlers

---

#### 3. `/api/card/[id]`
**File:** `src/app/api/card/[id]/route.ts`
**Status:** ✅ ACTIVE - ASSISTANT-BASED GRADING
**HTTP Methods:** GET (likely)
**Purpose:** OpenAI Assistants API-based grading (alternative to vision grading)

**Used By:**
- `src/app/card/[id]/page.tsx`
- `src/app/api/upload/route.ts`

**Functionality:**
- Uses OpenAI Assistants API (not Vision API)
- Loads different instruction files per card category (Pokemon, sports, etc.)
- Different approach from vision-grade
- Files: `pokemon_assistant_instructions_master.txt`, `sports_assistant_instructions.txt`, etc.

**Recommendation:** ✅ **KEEP** - Different grading approach for specific use cases

---

#### 4. `/api/upload`
**File:** `src/app/api/upload/route.ts`
**Status:** ✅ ACTIVE
**HTTP Methods:** POST (likely)
**Purpose:** Upload card images to Supabase Storage

**Recommendation:** ✅ **KEEP** - Essential functionality

---

#### 5. `/api/cards/search`
**File:** `src/app/api/cards/search/route.ts`
**Status:** ✅ ACTIVE (assumed)
**HTTP Methods:** GET (likely)
**Purpose:** Search cards in collection

**Recommendation:** ✅ **KEEP** - Collection management

---

#### 6. `/api/cards/[id]/visibility`
**File:** `src/app/api/cards/[id]/visibility/route.ts`
**Status:** ✅ ACTIVE (assumed)
**HTTP Methods:** PATCH (likely)
**Purpose:** Toggle card visibility (public/private)

**Recommendation:** ✅ **KEEP** - Privacy feature

---

### ⏸️ DEPRECATED ROUTES

#### 7. `/api/opencv-analyze`
**File:** `src/app/api/opencv-analyze/route.ts`
**Status:** ⏸️ DISABLED
**HTTP Methods:** POST (likely)
**Purpose:** OpenCV computer vision analysis (Stage 0)

**Used By:** NONE - commented out in route.ts (lines 244-294)

**Why Disabled:** Unreliable boundary detection, false slab detection (Oct 19, 2025)

**Recommendation:** 🗑️ **DELETE** - Add to deprecation documentation

**Migration Steps:**
1. Add note to `opencv_service/DEPRECATED.md` (✅ DONE)
2. Delete `/api/opencv-analyze/route.ts` after 3-6 months
3. Remove from API directory

---

### ❓ UNKNOWN STATUS / NEEDS INVESTIGATION

#### 8. `/api/grade/[id]` ⚠️ POTENTIAL DUPLICATE
**File:** `src/app/api/grade/[id]/route.ts`
**Status:** ❓ UNKNOWN - NO FRONTEND USAGE FOUND
**HTTP Methods:** GET
**Purpose:** Old grading endpoint? (appears incomplete)

**Used By:** **NONE** - No grep matches in frontend

**Analysis:**
- File exists but frontend doesn't call it
- Uses OpenAI for grading
- Appears incomplete (file ends at line 50 in the middle of logic)
- Potentially predates `/api/vision-grade/[id]`

**Recommendation:** 🗑️ **LIKELY DEAD CODE - DELETE**

**Verification Steps:**
1. Search entire codebase for `/api/grade/` usage
2. Check if any external tools call this endpoint
3. If confirmed unused, delete file
4. Document as deprecated code

---

## 📋 SUMMARY

### Active Grading Routes
| Route | Purpose | Status | Frontend Usage |
|-------|---------|--------|----------------|
| `/api/vision-grade/[id]` | PRIMARY grading | ✅ ACTIVE | CardDetailClient.tsx |
| `/api/card/[id]` | Assistant-based grading | ✅ ACTIVE | card/[id]/page.tsx |
| `/api/sports/[id]` GET | Sports grading (old) | ⚠️ SUPERSEDED | NONE |

### CRUD Routes
| Route | Purpose | Status | Methods |
|-------|---------|--------|---------|
| `/api/sports/[id]` | Sports card CRUD | ⚠️ PARTIAL | PATCH, DELETE |
| `/api/cards/[id]/visibility` | Visibility toggle | ✅ ACTIVE | PATCH |
| `/api/cards/search` | Search collection | ✅ ACTIVE | GET |

### Deprecated/Dead Routes
| Route | Status | Action |
|-------|--------|--------|
| `/api/opencv-analyze` | ⏸️ DISABLED | Document + Delete |
| `/api/grade/[id]` | ❓ LIKELY DEAD | Verify + Delete |
| `/api/sports/[id]` GET | ⚠️ SUPERSEDED | Deprecate GET method |

---

## 🔧 RECOMMENDED ACTIONS

### Immediate (Phase 2.3)

1. **Verify `/api/grade/[id]` is unused**
   ```bash
   # Search entire codebase
   grep -r "/api/grade/" .
   # Search external config files
   grep -r "api/grade" *.json *.md *.txt
   ```

2. **Document `/api/sports/[id]` GET deprecation**
   - Add comment to route.ts GET handler
   - Note that `/api/vision-grade/[id]` should be used instead

3. **Update API documentation**
   - Document active routes
   - Mark deprecated routes
   - Add migration guide

### Short Term (Next Sprint)

1. **Delete `/api/grade/[id]`** (after verification)
   - Remove file: `src/app/api/grade/[id]/route.ts`
   - Remove directory: `src/app/api/grade/`

2. **Comment out `/api/sports/[id]` GET method**
   - Add deprecation notice
   - Redirect callers to `/api/vision-grade/[id]`

3. **Delete `/api/opencv-analyze`**
   - Remove file: `src/app/api/opencv-analyze/route.ts`
   - Already documented in `opencv_service/DEPRECATED.md`

### Medium Term (Future Cleanup)

1. **Consolidate sports card operations**
   - Keep PATCH/DELETE in `/api/sports/[id]`
   - OR move to `/api/cards/[id]` for consistency

2. **API versioning**
   - Consider `/api/v1/grade` structure for future changes
   - Maintain backward compatibility

---

## 📁 ROUTE STRUCTURE (Proposed Final State)

```
src/app/api/
├── card/[id]/           # OpenAI Assistant-based grading (keep)
├── cards/
│   ├── [id]/visibility/ # Toggle public/private (keep)
│   └── search/          # Search collection (keep)
├── sports/[id]/         # PATCH/DELETE only (deprecate GET)
├── upload/              # Image upload (keep)
└── vision-grade/[id]/   # PRIMARY grading endpoint (keep)
```

**Deleted:**
- `api/grade/[id]/` - Dead code
- `api/opencv-analyze/` - Disabled OpenCV service

---

## 🔍 INVESTIGATION FINDINGS

### Why Two Grading Systems?

**`/api/vision-grade/[id]` (Vision API):**
- Single API call with detailed prompt
- Returns markdown report
- v3.8 weakest link scoring
- Best for visual analysis

**`/api/card/[id]` (Assistants API):**
- Uses pre-configured OpenAI Assistants
- Different instruction files per card type
- May have conversation history/context
- Alternative grading approach

**Both are valid** - Different use cases or testing different approaches

---

## 📞 NEXT STEPS

1. ✅ Complete Phase 2.3 investigation
2. ⏸️ Verify `/api/grade/[id]` usage (grep entire project)
3. ⏸️ Document `/api/sports/[id]` deprecation plan
4. ⏸️ Create deletion checklist for dead routes

---

**Document Version:** 1.0
**Last Updated:** October 28, 2025
**Next Review:** After verification of `/api/grade/[id]` usage

---

END OF API ROUTES ANALYSIS
