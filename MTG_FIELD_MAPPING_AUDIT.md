# MTG Field Mapping Comprehensive Audit
**Date:** 2025-11-11
**Card Analyzed:** Common Crook (Card ID: from user)
**Issue:** Missing MTG-specific fields in Card Details display

---

## Executive Summary

**CRITICAL ISSUE IDENTIFIED:** MTG-specific fields are being extracted by the AI and saved to the database, but **NOT being mapped to the frontend `cardInfo` object** in `CardDetailClient.tsx`.

### Root Cause
The `cardInfo` mapping object (line 2029-2051 in CardDetailClient.tsx) only includes Pokemon-specific fields and does NOT include MTG-specific fields like:
- `mana_cost`
- `color_identity`
- `mtg_card_type`
- `creature_type`
- `power_toughness`
- `expansion_code`
- `collector_number`
- `artist_name`
- `is_foil`
- `is_promo`
- `border_color`
- `frame_version`
- `language`
- `keywords`

This causes these fields to display as `null` or not render at all, even though they exist in the database.

---

## Detailed Field Mapping Analysis

### ✅ AI Prompt (mtg_conversational_grading_v4_2.txt)
**Status:** COMPLETE - All MTG fields are defined in the JSON schema (lines 2244-2283)

**Fields Defined:**
```json
{
  "card_info": {
    // Standard fields
    "card_name": "string or null",
    "set_name": "string or null",
    "expansion_code": "string or null",
    "collector_number": "string or null",
    "year": "string or null",
    "manufacturer": "string or null",
    "rarity_or_variant": "string or null",
    "autographed": false,

    // MTG-SPECIFIC FIELDS (✅ ALL DEFINED)
    "mana_cost": "string or null",
    "color_identity": "string or null",
    "mtg_card_type": "string or null",
    "creature_type": "string or null",
    "power_toughness": "string or null",
    "artist_name": "string or null",
    "is_foil": true or false,
    "is_promo": true or false,
    "border_color": "string or null",
    "frame_version": "string or null",
    "is_double_faced": true or false,
    "language": "string or null",
    "keywords": ["string"] or []
  }
}
```

**Verdict:** ✅ CORRECT - AI knows what to extract

---

### ✅ API Route (src/app/api/mtg/[id]/route.ts)
**Status:** COMPLETE - All MTG fields are extracted and saved to database

**Extraction Function:** `extractMTGFieldsFromConversational()` (lines 100-142)

**Fields Extracted:**
```typescript
{
  // Standard fields
  card_name: cardInfo.card_name || null,
  card_set: cardInfo.set_name || null,
  card_number: cardInfo.collector_number || null,
  rarity_description: cardInfo.rarity_or_variant || null,

  // MTG-specific fields (✅ ALL EXTRACTED)
  mana_cost: cardInfo.mana_cost || null,
  color_identity: cardInfo.color_identity || null,
  mtg_card_type: cardInfo.mtg_card_type || null,
  creature_type: cardInfo.creature_type || null,
  power_toughness: cardInfo.power_toughness || null,
  expansion_code: cardInfo.expansion_code || null,
  collector_number: cardInfo.collector_number || null,
  artist_name: cardInfo.artist_name || null,
  is_foil: cardInfo.is_foil !== undefined ? cardInfo.is_foil : false,
  is_promo: cardInfo.is_promo !== undefined ? cardInfo.is_promo : false,
  border_color: cardInfo.border_color || null,
  frame_version: cardInfo.frame_version || null,
  is_double_faced: cardInfo.is_double_faced !== undefined ? cardInfo.is_double_faced : false,
  language: cardInfo.language || 'English',
  keywords: cardInfo.keywords || null,
  scryfall_id: cardInfo.scryfall_id || null
}
```

**Database Save:** Lines 655-720 - All fields included in `updateData`

**Verdict:** ✅ CORRECT - API extracts and saves all fields

---

### ❌ Frontend Display (src/app/mtg/[id]/CardDetailClient.tsx)
**Status:** INCOMPLETE - MTG fields NOT mapped to `cardInfo` object

**Current `cardInfo` Mapping (lines 2029-2051):**
```typescript
const cardInfo = {
  card_name: ...,
  player_or_character: ...,
  set_name: ...,
  year: ...,
  manufacturer: ...,
  card_number: ...,
  sport_or_category: ...,
  serial_number: ...,
  rookie_or_first: ...,
  subset: ...,
  rarity_tier: ...,
  autographed: ...,
  memorabilia: ...,
  card_front_text: ...,
  card_back_text: ...,
  // Pokemon-specific fields
  pokemon_type: ...,
  pokemon_stage: ...,
  hp: ...,
  card_type: ...

  // ❌ MISSING: MTG-SPECIFIC FIELDS!
};
```

**MTG Display Code (lines 2891-3036):**
The display code DOES check for MTG fields:
- Line 2892: `{(cardInfo.mana_cost || card.mana_cost) && ...}`
- Line 2902: `{(cardInfo.mtg_card_type || card.mtg_card_type) && ...}`
- Line 2912: `{(cardInfo.creature_type || card.creature_type) && ...}`
- Line 2922: `{(cardInfo.power_toughness || card.power_toughness) && ...}`
- Line 2932: `{(cardInfo.color_identity || card.color_identity) && ...}`
- Line 3000: `{(cardInfo.artist_name || card.artist_name) && ...}`
- Line 3010: `{(cardInfo.is_foil || card.is_foil) && ...}`
- Line 3020: `{(cardInfo.is_promo || card.is_promo) && ...}`
- Line 3029: `{(cardInfo.language || card.language) && ...}`

**Problem:** The display code checks `cardInfo.mana_cost` first, but this property doesn't exist in the `cardInfo` object! It then falls back to `card.mana_cost` which comes directly from the database.

**Verdict:** ❌ BROKEN - MTG fields not mapped, relying solely on database fallback

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. AI GRADING PROMPT (mtg_conversational_grading_v4_2.txt)     │
│    ✅ Defines all MTG fields in JSON schema                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. OPENAI GPT-4o RESPONSE                                       │
│    Returns JSON with card_info containing all MTG fields        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. API ROUTE (route.ts)                                         │
│    ✅ extractMTGFieldsFromConversational() extracts fields      │
│    ✅ Saves to database columns                                 │
│    ✅ Returns conversational_card_info JSON                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. DATABASE                                                      │
│    ✅ Columns exist: mana_cost, color_identity, etc.            │
│    ✅ Data stored correctly                                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. FRONTEND CardDetailClient.tsx                                │
│    ❌ cardInfo object does NOT map MTG fields                   │
│    ⚠️  Falls back to card.mana_cost (direct DB access)          │
│    ⚠️  Works but bypasses intended abstraction layer            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Missing MTG Fields in `cardInfo` Object

### 🔴 CRITICAL (Must Always Display)
| Field Name | AI Prompt | API Extraction | Database Column | cardInfo Mapping | Display Code | Status |
|------------|-----------|----------------|-----------------|------------------|--------------|--------|
| `mana_cost` | ✅ | ✅ | ✅ `mana_cost` | ❌ | ✅ (fallback) | **BROKEN** |
| `color_identity` | ✅ | ✅ | ✅ `color_identity` | ❌ | ✅ (fallback) | **BROKEN** |
| `mtg_card_type` | ✅ | ✅ | ✅ `mtg_card_type` | ❌ | ✅ (fallback) | **BROKEN** |
| `expansion_code` | ✅ | ✅ | ✅ `expansion_code` | ❌ | ✅ (fallback) | **BROKEN** |
| `collector_number` | ✅ | ✅ | ✅ `collector_number` | ❌ | ✅ (fallback) | **BROKEN** |
| `rarity_or_variant` | ✅ | ✅ | ✅ `rarity_description` | ❌ | ✅ (fallback) | **BROKEN** |
| `artist_name` | ✅ | ✅ | ✅ `artist_name` | ❌ | ✅ (fallback) | **BROKEN** |

### 🟡 HIGH PRIORITY (Important for Creatures/Specific Card Types)
| Field Name | AI Prompt | API Extraction | Database Column | cardInfo Mapping | Display Code | Status |
|------------|-----------|----------------|-----------------|------------------|--------------|--------|
| `creature_type` | ✅ | ✅ | ✅ `creature_type` | ❌ | ✅ (fallback) | **BROKEN** |
| `power_toughness` | ✅ | ✅ | ✅ `power_toughness` | ❌ | ✅ (fallback) | **BROKEN** |
| `is_foil` | ✅ | ✅ | ✅ `is_foil` | ❌ | ✅ (fallback) | **BROKEN** |
| `language` | ✅ | ✅ | ✅ `language` | ❌ | ✅ (fallback) | **BROKEN** |

### 🟢 NICE-TO-HAVE (Optional Enhancements)
| Field Name | AI Prompt | API Extraction | Database Column | cardInfo Mapping | Display Code | Status |
|------------|-----------|----------------|-----------------|------------------|--------------|--------|
| `is_promo` | ✅ | ✅ | ✅ `is_promo` | ❌ | ✅ (fallback) | **BROKEN** |
| `border_color` | ✅ | ✅ | ✅ `border_color` | ❌ | ❌ | **NOT DISPLAYED** |
| `frame_version` | ✅ | ✅ | ✅ `frame_version` | ❌ | ❌ | **NOT DISPLAYED** |
| `is_double_faced` | ✅ | ✅ | ✅ `is_double_faced` | ❌ | ❌ | **NOT DISPLAYED** |
| `keywords` | ✅ | ✅ | ✅ `keywords` | ❌ | ❌ | **NOT DISPLAYED** |
| `scryfall_id` | ✅ | ✅ | ✅ `scryfall_id` | ❌ | ❌ | **NOT DISPLAYED** |

---

## Why This Matters

### Current Behavior (Common Crook Example)
When you grade "Common Crook":

1. ✅ AI extracts: `mana_cost: "{2}{U}"`, `rarity_or_variant: "Common"`, etc.
2. ✅ API saves to database: `mana_cost = "{2}{U}"`, `rarity_description = "Common"`
3. ✅ API returns: `conversational_card_info: { mana_cost: "{2}{U}", ... }`
4. ❌ Frontend creates `cardInfo` WITHOUT MTG fields
5. ⚠️  Display code checks `cardInfo.mana_cost` → undefined
6. ⚠️  Falls back to `card.mana_cost` → Works but inconsistent

### Problems with Current Approach

1. **Inconsistent Data Source:** Some fields use `cardInfo` (from `conversational_card_info`), others use `card` (direct DB)
2. **Bypasses Abstraction:** The `cardInfo` object is meant to normalize data sources, but MTG fields bypass it
3. **Maintenance Risk:** If `conversational_card_info` structure changes, half the fields break
4. **Confusing for Developers:** Why do Pokemon fields use `cardInfo` but MTG fields use `card`?
5. **Potential Null Values:** If `card.mana_cost` is null but `conversational_card_info.mana_cost` has data, we miss it

---

## Solution: Add MTG Fields to `cardInfo` Mapping

### File to Modify
**Path:** `src/app/mtg/[id]/CardDetailClient.tsx`
**Location:** Lines 2029-2051 (the `cardInfo` object definition)

### Code Changes Required

**BEFORE (Current Code):**
```typescript
const cardInfo = {
  card_name: stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || dvgGrading.card_info?.card_name,
  player_or_character: stripMarkdown(card.conversational_card_info?.player_or_character) || card.pokemon_featured || card.featured || dvgGrading.card_info?.player_or_character,
  // ... existing fields ...
  // Pokemon-specific fields
  pokemon_type: stripMarkdown(card.conversational_card_info?.pokemon_type) || card.pokemon_type || null,
  pokemon_stage: stripMarkdown(card.conversational_card_info?.pokemon_stage) || card.pokemon_stage || null,
  hp: stripMarkdown(card.conversational_card_info?.hp) || card.hp || null,
  card_type: stripMarkdown(card.conversational_card_info?.card_type) || card.card_type || null
};
```

**AFTER (Proposed Fix):**
```typescript
const cardInfo = {
  card_name: stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || dvgGrading.card_info?.card_name,
  player_or_character: stripMarkdown(card.conversational_card_info?.player_or_character) || card.pokemon_featured || card.featured || dvgGrading.card_info?.player_or_character,
  // ... existing fields ...

  // Pokemon-specific fields
  pokemon_type: stripMarkdown(card.conversational_card_info?.pokemon_type) || card.pokemon_type || null,
  pokemon_stage: stripMarkdown(card.conversational_card_info?.pokemon_stage) || card.pokemon_stage || null,
  hp: stripMarkdown(card.conversational_card_info?.hp) || card.hp || null,
  card_type: stripMarkdown(card.conversational_card_info?.card_type) || card.card_type || null,

  // 🎴 MTG-SPECIFIC FIELDS (NEW)
  mana_cost: stripMarkdown(card.conversational_card_info?.mana_cost) || card.mana_cost || null,
  color_identity: stripMarkdown(card.conversational_card_info?.color_identity) || card.color_identity || null,
  mtg_card_type: stripMarkdown(card.conversational_card_info?.mtg_card_type) || card.mtg_card_type || null,
  creature_type: stripMarkdown(card.conversational_card_info?.creature_type) || card.creature_type || null,
  power_toughness: stripMarkdown(card.conversational_card_info?.power_toughness) || card.power_toughness || null,
  expansion_code: stripMarkdown(card.conversational_card_info?.expansion_code) || card.expansion_code || null,
  collector_number: stripMarkdown(card.conversational_card_info?.collector_number) || card.collector_number || null,
  artist_name: stripMarkdown(card.conversational_card_info?.artist_name) || card.artist_name || null,
  is_foil: card.conversational_card_info?.is_foil !== undefined ? card.conversational_card_info.is_foil : (card.is_foil || false),
  is_promo: card.conversational_card_info?.is_promo !== undefined ? card.conversational_card_info.is_promo : (card.is_promo || false),
  border_color: stripMarkdown(card.conversational_card_info?.border_color) || card.border_color || null,
  frame_version: stripMarkdown(card.conversational_card_info?.frame_version) || card.frame_version || null,
  is_double_faced: card.conversational_card_info?.is_double_faced !== undefined ? card.conversational_card_info.is_double_faced : (card.is_double_faced || false),
  language: stripMarkdown(card.conversational_card_info?.language) || card.language || 'English',
  keywords: card.conversational_card_info?.keywords || card.keywords || null,
  rarity_or_variant: stripMarkdown(card.conversational_card_info?.rarity_or_variant) || card.rarity_description || null
};
```

---

## Optional Enhancements (Display New Fields)

### 1. Border Color Display
**Add after Language section (line 3036):**
```typescript
{/* Border Color */}
{(cardInfo.border_color || card.border_color) && (
  <div>
    <p className="text-sm font-semibold text-gray-600 mb-1">Border</p>
    <p className="text-lg text-gray-900">
      {cardInfo.border_color || card.border_color}
    </p>
  </div>
)}
```

### 2. Frame Version Display
```typescript
{/* Frame Version */}
{(cardInfo.frame_version || card.frame_version) && (
  <div>
    <p className="text-sm font-semibold text-gray-600 mb-1">Frame</p>
    <p className="text-lg text-gray-900">
      {cardInfo.frame_version || card.frame_version}
    </p>
  </div>
)}
```

### 3. Keywords Display
```typescript
{/* Keywords */}
{(cardInfo.keywords || card.keywords) && (
  <div className="col-span-2">
    <p className="text-sm font-semibold text-gray-600 mb-2">Keywords</p>
    <div className="flex flex-wrap gap-2">
      {(Array.isArray(cardInfo.keywords) ? cardInfo.keywords : (Array.isArray(card.keywords) ? card.keywords : [])).map((keyword: string, idx: number) => (
        <span
          key={idx}
          className="px-3 py-1 bg-purple-100 text-purple-800 rounded-lg text-sm font-semibold"
        >
          {keyword}
        </span>
      ))}
    </div>
  </div>
)}
```

### 4. Double-Faced Card Indicator
```typescript
{/* Double-Faced Card */}
{(cardInfo.is_double_faced || card.is_double_faced) && (
  <div>
    <span className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500 text-white rounded-lg text-sm font-bold">
      🔄 Double-Faced
    </span>
  </div>
)}
```

### 5. Scryfall Database Link
```typescript
{/* Scryfall Link */}
{(cardInfo.scryfall_id || card.scryfall_id) && (
  <div>
    <a
      href={`https://scryfall.com/card/${cardInfo.scryfall_id || card.scryfall_id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors"
    >
      🔍 View on Scryfall
    </a>
  </div>
)}
```

---

## Implementation Priority

### Phase 1: Critical Fix (Do This First) ⚡
✅ Add MTG fields to `cardInfo` mapping object
⏱️ **Time Estimate:** 5 minutes
📁 **File:** `src/app/mtg/[id]/CardDetailClient.tsx` (lines 2029-2051)
🎯 **Impact:** Fixes all missing fields for Common Crook and future cards

### Phase 2: Optional Enhancements (Nice-to-Have)
⭐ Add Border Color display
⭐ Add Frame Version display
⭐ Add Keywords badges
⭐ Add Double-Faced indicator
⭐ Add Scryfall link
⏱️ **Time Estimate:** 15 minutes
📁 **File:** `src/app/mtg/[id]/CardDetailClient.tsx` (after line 3036)
🎯 **Impact:** Shows additional MTG-specific details

### Phase 3: Testing & Validation
1. Re-grade "Common Crook" with `?force_regrade=true`
2. Verify all fields display correctly
3. Test with foil cards
4. Test with foreign language cards
5. Test with planeswalkers (loyalty counters)
6. Test with double-faced cards

---

## Testing Checklist

### Before Fix
- [x] Identified missing fields (mana_cost, rarity, etc.)
- [x] Confirmed AI extraction works
- [x] Confirmed API mapping works
- [x] Confirmed database storage works
- [x] Identified frontend mapping gap

### After Fix (Phase 1)
- [ ] All critical fields display correctly
- [ ] `cardInfo.mana_cost` is defined
- [ ] `cardInfo.rarity_or_variant` is defined
- [ ] `cardInfo.artist_name` is defined
- [ ] Fallback to `card.*` still works if needed

### After Fix (Phase 2 - Optional)
- [ ] Border color displays
- [ ] Frame version displays
- [ ] Keywords display as badges
- [ ] Double-faced indicator shows
- [ ] Scryfall link works

---

## Conclusion

**Problem:** MTG-specific fields are working end-to-end EXCEPT for the frontend `cardInfo` mapping.

**Solution:** Add 16 MTG-specific fields to the `cardInfo` object (lines 2029-2051 in CardDetailClient.tsx).

**Result:** Common Crook and all future MTG cards will display complete information including mana cost, rarity, artist name, and all other MTG-specific details.

**Estimated Fix Time:** 5 minutes for critical fields, 20 minutes total with enhancements.

---

## Quick Reference: MTG Field Names

| Display Name | Database Column | conversational_card_info Key | Prompt Field |
|--------------|-----------------|------------------------------|--------------|
| Mana Cost | `mana_cost` | `mana_cost` | `mana_cost` |
| Color Identity | `color_identity` | `color_identity` | `color_identity` |
| Type | `mtg_card_type` | `mtg_card_type` | `mtg_card_type` |
| Creature Type | `creature_type` | `creature_type` | `creature_type` |
| Power/Toughness | `power_toughness` | `power_toughness` | `power_toughness` |
| Expansion | `card_set` | `set_name` | `set_name` |
| Expansion Code | `expansion_code` | `expansion_code` | `expansion_code` |
| Collector Number | `card_number` | `collector_number` | `collector_number` |
| Rarity | `rarity_description` | `rarity_or_variant` | `rarity_or_variant` |
| Artist | `artist_name` | `artist_name` | `artist_name` |
| Foil | `is_foil` | `is_foil` | `is_foil` |
| Promo | `is_promo` | `is_promo` | `is_promo` |
| Language | `language` | `language` | `language` |
| Border Color | `border_color` | `border_color` | `border_color` |
| Frame Version | `frame_version` | `frame_version` | `frame_version` |
| Double-Faced | `is_double_faced` | `is_double_faced` | `is_double_faced` |
| Keywords | `keywords` | `keywords` | `keywords` |
| Scryfall ID | `scryfall_id` | `scryfall_id` | `scryfall_id` |

---

**END OF AUDIT**

---

## ⚠️ Scryfall API - TEMPORARILY DISABLED

**Date Disabled:** 2025-11-11
**Reason:** API failures detected during testing

The Scryfall API integration has been temporarily disabled. The system now relies entirely on AI extraction from the MTG grading prompt.

### To Re-Enable:
Edit `src/app/api/mtg/[id]/route.ts` line 554:
```typescript
const ENABLE_SCRYFALL_API = false;  // Change to true to re-enable
```

### Impact:
- Set identification now relies on AI mini table only
- Unknown sets will show as null instead of being looked up via Scryfall
- All other MTG fields still extracted normally by AI
- Scryfall link will not display if scryfall_id is not populated
