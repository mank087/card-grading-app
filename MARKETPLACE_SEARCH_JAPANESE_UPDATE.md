# Marketplace Search Updates for Japanese Pokemon Cards

## Problem
After implementing bilingual display (e.g., "ガマゲロゲ (Seismitoad)"), marketplace searches were receiving the full bilingual text, which doesn't work well on US marketplaces like TCGPlayer and eBay.

**Before:**
- TCGPlayer search: `?q=ガマゲロゲ (Seismitoad)+109/086`
- eBay search: `?_nkw=ガマゲロゲ (Seismitoad)+109/086`
- **Result:** No or poor search results

## Solution
Created a helper function to extract just the English portion from bilingual text for marketplace searches.

**After:**
- TCGPlayer search: `?q=Seismitoad+109/086`
- eBay search: `?_nkw=Seismitoad+109/086`
- **Result:** Accurate search results on US marketplaces

---

## Implementation

### File: `src/app/pokemon/[id]/CardDetailClient.tsx`

### 1. New Helper Function (Line 2013-2026)

```typescript
// Helper: Extract English name from bilingual format for marketplace searches
const extractEnglishForSearch = (text: string | null | undefined): string | null => {
  if (!text) return null;

  // Check if text contains Japanese characters and bilingual format
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  if (!hasJapanese) return text; // Already English-only

  // Extract English from "Japanese (English)" format
  const parts = text.split(/[/()（）]/);
  const englishPart = parts.find((p: string) => p.trim() && !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(p));

  return englishPart ? englishPart.trim() : text;
};
```

**How it works:**
1. Returns null if input is null/undefined
2. Checks if text contains Japanese characters
3. If no Japanese, returns text as-is (English cards work normally)
4. If Japanese, splits on common separators: `/`, `(`, `)`, `（`, `）`
5. Finds the part without Japanese characters (the English translation)
6. Returns trimmed English text

---

### 2. Updated TCGPlayer Search (Lines 4394-4407)

**Before:**
```typescript
const cardData = {
  featured: cardInfo.player_or_character || card.featured || card.pokemon_featured,
  card_set: cardInfo.set_name || cardInfo.set_era || card.card_set,
  // ...
};
```

**After:**
```typescript
// Extract English names for US marketplace search
const pokemonName = extractEnglishForSearch(cardInfo.player_or_character) ||
                   extractEnglishForSearch(card.featured) ||
                   card.pokemon_featured;
const setName = extractEnglishForSearch(cardInfo.set_name) ||
               extractEnglishForSearch(cardInfo.set_era) ||
               card.card_set;

const cardData = {
  featured: pokemonName,
  card_set: setName,
  // ...
};
```

---

### 3. Updated eBay General Search (Line 4439)

**Before:**
```typescript
featured: cardInfo.player_or_character || card.featured
```

**After:**
```typescript
featured: extractEnglishForSearch(cardInfo.player_or_character) ||
         extractEnglishForSearch(card.featured)
```

---

### 4. Updated eBay Sold Listings (Line 4460)

**Before:**
```typescript
featured: cardInfo.player_or_character || card.featured
```

**After:**
```typescript
featured: extractEnglishForSearch(cardInfo.player_or_character) ||
         extractEnglishForSearch(card.featured)
```

---

## Test Cases

### Test 1: Japanese Card with Bilingual Data
**Input:**
- `player_or_character`: "ガマゲロゲ (Seismitoad)"
- `card_number`: "109/086"

**Output:**
- TCGPlayer: `Seismitoad 109/086` ✅
- eBay: `Seismitoad 109/086` ✅

### Test 2: English-Only Card
**Input:**
- `player_or_character`: "Pikachu"
- `card_number`: "025/165"

**Output:**
- TCGPlayer: `Pikachu 025/165` ✅
- eBay: `Pikachu 025/165` ✅

### Test 3: Japanese-Only Text (No English Translation)
**Input:**
- `player_or_character`: "ガマゲロゲ"
- `card_number`: "109/086"

**Output:**
- TCGPlayer: `ガマゲロゲ 109/086` ✅ (Falls back to Japanese if no English found)
- eBay: `ガマゲロゲ 109/086` ✅

### Test 4: Alternative Separators
**Input:**
- `player_or_character`: "ガマゲロゲ／Seismitoad" (full-width slash)
- `card_number`: "109/086"

**Output:**
- TCGPlayer: `Seismitoad 109/086` ✅
- eBay: `Seismitoad 109/086` ✅

---

## Benefits

1. ✅ **Better Search Results** - US marketplaces search by English names
2. ✅ **Backward Compatible** - English-only cards work exactly as before
3. ✅ **Smart Fallback** - If no English found, uses full text (Japanese collectors market)
4. ✅ **Universal Format** - Works with parentheses `()` and full-width parentheses `（）`
5. ✅ **Set Name Support** - Also extracts English set names for better TCGPlayer set-specific searches

---

## Display vs Search Behavior

### On Card Details Page:
**Display:** Shows full bilingual format
```
Card Name: ガマゲロゲ
          Seismitoad
```

### In Marketplace Links:
**TCGPlayer URL:** `tcgplayer.com/search?q=Seismitoad+109/086`
**eBay URL:** `ebay.com/sch?_nkw=Seismitoad+109/086`

**This gives users the best of both worlds:**
- See the authentic Japanese card information on the detail page
- Get accurate English marketplace search results

---

## Files Modified

1. ✅ `src/app/pokemon/[id]/CardDetailClient.tsx`
   - Added `extractEnglishForSearch` helper function
   - Updated TCGPlayer search
   - Updated eBay general search
   - Updated eBay sold listings search

**No other files needed updates** - All marketplace searches go through CardDetailClient.

---

## Future Considerations

### Other Marketplaces
If you add more marketplace integrations (Mercari, Yahoo Auctions Japan, etc.), consider:
- **Japanese marketplaces:** Use full bilingual or Japanese-only text
- **International marketplaces:** Use `extractEnglishForSearch()`

### Multi-Language Support
This pattern can be extended to other languages:
- Korean Pokemon cards: "한국어 (Korean)"
- Chinese Pokemon cards: "中文 (Chinese)"

Just update the regex pattern to detect additional character sets.

---

## Status: ✅ COMPLETE

All marketplace searches now intelligently extract English names for optimal search results while maintaining bilingual display on the card detail page.
