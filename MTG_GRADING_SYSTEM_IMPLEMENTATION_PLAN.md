# Magic: The Gathering Grading System - Comprehensive Implementation Plan

## Executive Summary

This document outlines a complete plan to build a Magic: The Gathering (MTG) card grading system using the proven Pokemon grading infrastructure as a foundation. The implementation will maintain consistency with existing systems while adding MTG-specific features and considerations.

**Timeline Estimate:** 3-5 days for full implementation
**Complexity:** Medium (leveraging existing Pokemon infrastructure)

---

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Database Schema Updates](#database-schema-updates)
3. [AI Prompt Creation](#ai-prompt-creation)
4. [API Route Implementation](#api-route-implementation)
5. [Upload Page Creation](#upload-page-creation)
6. [Card Details Page](#card-details-page)
7. [Collection Page Updates](#collection-page-updates)
8. [External API Integration](#external-api-integration)
9. [Marketplace Integration](#marketplace-integration)
10. [Testing Strategy](#testing-strategy)
11. [Implementation Checklist](#implementation-checklist)

---

## 1. System Architecture Overview

### Current Pokemon System (Reference)
```
User Upload → /mtg/upload
              ↓
         Store in DB (category: "MTG")
              ↓
         /api/mtg/[id] → gradeCardConversational('mtg')
              ↓
         AI Grades Card (mtg_conversational_grading_v4_2.txt)
              ↓
         Store Results → conversational_grading field
              ↓
         Display → /mtg/[id] (Card Details)
```

### New MTG System (To Build)
Will follow the exact same flow, with MTG-specific customizations at each step.

---

## 2. Database Schema Updates

### 2.1 New Columns for MTG Cards

**File:** Create migration `migrations/add_mtg_specific_fields.sql`

```sql
-- MTG-Specific Card Information Fields
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS mana_cost TEXT,
ADD COLUMN IF NOT EXISTS color_identity TEXT,
ADD COLUMN IF NOT EXISTS mtg_card_type TEXT, -- Creature, Instant, Sorcery, Enchantment, Artifact, Planeswalker, Land
ADD COLUMN IF NOT EXISTS creature_type TEXT, -- e.g., "Human Wizard", "Dragon", "Artifact Creature - Golem"
ADD COLUMN IF NOT EXISTS power_toughness TEXT, -- e.g., "3/3", "5/5", "*/2"
ADD COLUMN IF NOT EXISTS expansion_code TEXT, -- e.g., "MH3", "LCI", "BLB"
ADD COLUMN IF NOT EXISTS collector_number TEXT, -- e.g., "234", "123a", "456s"
ADD COLUMN IF NOT EXISTS artist_name TEXT,
ADD COLUMN IF NOT EXISTS flavor_text TEXT,
ADD COLUMN IF NOT EXISTS oracle_text TEXT, -- Full card text
ADD COLUMN IF NOT EXISTS keywords TEXT[], -- Array of keywords: Flying, Haste, etc.
ADD COLUMN IF NOT EXISTS is_foil BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_promo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS border_color TEXT, -- Black, White, Silver, Gold
ADD COLUMN IF NOT EXISTS frame_version TEXT, -- Modern, Future, Old, M15, etc.
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'English', -- Support for foreign cards
ADD COLUMN IF NOT EXISTS is_double_faced BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS scryfall_id UUID; -- For Scryfall API integration

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cards_mtg_card_type ON cards(mtg_card_type) WHERE category = 'MTG';
CREATE INDEX IF NOT EXISTS idx_cards_expansion_code ON cards(expansion_code) WHERE category = 'MTG';
CREATE INDEX IF NOT EXISTS idx_cards_is_foil ON cards(is_foil) WHERE category = 'MTG';
CREATE INDEX IF NOT EXISTS idx_cards_scryfall_id ON cards(scryfall_id) WHERE category = 'MTG';

-- Comments for documentation
COMMENT ON COLUMN cards.mana_cost IS 'Mana cost in WUBRG format, e.g., "{2}{U}{U}"';
COMMENT ON COLUMN cards.color_identity IS 'Color identity for Commander, e.g., "WU" for Azorius';
COMMENT ON COLUMN cards.mtg_card_type IS 'Card type: Creature, Instant, Sorcery, Enchantment, Artifact, Planeswalker, Land';
COMMENT ON COLUMN cards.power_toughness IS 'Power/Toughness for creatures, e.g., "3/3"';
COMMENT ON COLUMN cards.expansion_code IS 'Three-letter set code, e.g., "MH3" for Modern Horizons 3';
```

### 2.2 Reuse Existing Pokemon Fields

Many fields can be reused:
- `card_name` → Card name
- `card_set` → Expansion name
- `card_number` → Collector number
- `manufacturer_name` → "Wizards of the Coast"
- `release_date` → Set release year
- `serial_numbering` → For serialized cards (e.g., "/500")
- `rarity_description` → Common, Uncommon, Rare, Mythic Rare
- `autographed` → For artist-signed cards
- `featured` → Main creature/character name (for search)

---

## 3. AI Prompt Creation

### 3.1 Create New Prompt File

**File:** `prompts/mtg_conversational_grading_v4_2.txt`

**Source:** Copy `prompts/pokemon_conversational_grading_v4_2.txt`

### 3.2 Global Find & Replace

| Find (Pokemon) | Replace (MTG) |
|---|---|
| `POKEMON` | `MTG` |
| `Pokemon TCG` | `Magic: The Gathering` |
| `Pokemon` | `Magic` or `MTG card` |
| `Pikachu` | `Black Lotus` or `Lightning Bolt` |
| `Charizard` | `Jace, the Mind Sculptor` |
| `Scarlet & Violet` | `Modern Horizons 3` |
| `Base Set` | `Alpha` or "Limited Edition Alpha" |
| `Pokemon Company` | `Wizards of the Coast` |
| `Wizards of the Coast` (when it appears as old manufacturer) | `Wizards of the Coast` (keep) |
| `Ken Sugimori` | `Mark Tedin` or `Rebecca Guay` |

### 3.3 Remove Pokemon-Specific Sections

**Delete:**
- Lines mentioning "Pokemon type" (Fire, Water, etc.)
- "Pokemon stage" (Basic, Stage 1, Stage 2)
- "HP" field
- Pokemon-specific autograph instructions (Pokemon Center, World Championship)
- Pokemon-specific defect patterns

**Replace with MTG equivalents:**

#### 3.3.1 Card Type Classification (Replace Pokemon Type Section)

```
CARD TYPE CLASSIFICATION:
• Creature - Has power/toughness
• Instant - Can be cast at instant speed
• Sorcery - Cast during main phase only
• Enchantment - Permanent spell
• Artifact - Permanent spell
• Planeswalker - Has loyalty counters
• Land - Produces mana
• Tribal - Has creature type but may not be a creature
```

#### 3.3.2 Mana Cost & Color Identity (Replace Pokemon Stage Section)

```
MANA COST EXTRACTION:
• Format: Symbols in curly braces {2}{U}{U}
• Hybrid mana: {W/U}, {B/R}
• Phyrexian mana: {W/P}
• Generic mana: {X}, {2}, {5}
• Extract exact symbols from top-right corner

COLOR IDENTITY:
• W = White (Plains)
• U = Blue (Island)
• B = Black (Swamp)
• R = Red (Mountain)
• G = Green (Forest)
• C = Colorless
```

#### 3.3.3 Power/Toughness (Replace HP Section)

```
POWER/TOUGHNESS (Creatures Only):
• Format: "3/3", "5/5", "*/2", "2+*/4"
• Located in bottom-right corner
• Extract exact values including asterisks and plus signs
• Non-creatures: null
```

#### 3.3.4 MTG-Specific Rarity Symbols

```
RARITY IDENTIFICATION:
• Common - Black set symbol
• Uncommon - Silver set symbol
• Rare - Gold set symbol
• Mythic Rare - Orange/red set symbol
• Special - Purple (bonus sheet) or other colors

SPECIAL DESIGNATIONS:
• Foil - Holographic sheen across entire card
• Promo - Special promo stamp (e.g., star, date)
• Serialized - Numbered x/500 or similar
• Showcase - Alternate art treatment
• Borderless - Extended art to edges
• Extended Art - Art extends beyond normal frame
```

### 3.4 Add MTG-Specific Defect Patterns

```
🆕 MTG-SPECIFIC DEFECT PATTERNS:

A. FOIL CURL ASSESSMENT
• Examine card edges for warping/bowing
• Document direction of curl (edges up or edges down)
• Severity: None, Slight, Moderate, Severe
• Note: Foil curl is manufacturing-related, not handling damage
• Deduct up to 1.0 points for severe curl that affects playability

B. FOIL SCRATCHING & CLOUDING
• Examine foil surface for scratches that disrupt holographic pattern
• Look for "foil clouding" - white haze on foil surface
• Differentiate between surface scratches and foil delamination
• Deduct based on visibility and coverage area

C. PRINTING ISSUES (Common in MTG)
• Print lines - horizontal or vertical lines from printing process
• Color registration - misaligned color layers
• Ink spots or splotches
• Whitening on dark borders (common on black-bordered cards)
• Note if defect appears to be factory printing vs. handling damage

D. DOUBLE-FACED CARD HANDLING
• For transforming cards, assess both faces separately
• Document if card uses checklist/placeholder card
• Note any issues with the transform indicator

E. BORDER CONDITION (MTG-Specific)
• Black borders show whitening more readily than white borders
• Assess all four edges for edge wear
• Silver/Gold borders: assess for scratching
• Borderless cards: assess edge-to-edge artwork condition
```

### 3.5 Update Card Info Fields in JSON Schema

**Replace this section (around line 2180-2210):**

```json
"card_info": {
  "card_name": "Card's full name as printed (e.g., 'Black Lotus', 'Lightning Bolt', 'Jace, the Mind Sculptor')",
  "player_or_character": "Primary creature or character name for search (e.g., 'Jace', 'Nicol Bolas', 'Elesh Norn')",
  "set_name": "Full expansion name (e.g., 'Modern Horizons 3', 'Murders at Karlov Manor')",
  "set_era": "Era or block name (e.g., 'Modern Horizons', 'Ravnica', 'Phyrexia')",
  "expansion_code": "Three-letter set code (e.g., 'MH3', 'MKM', 'BLB')",
  "collector_number": "Collector number from bottom-left (e.g., '234', '123a', '456s')",
  "year": "Release year (e.g., '2024', '1993')",
  "manufacturer": "ALWAYS 'Wizards of the Coast' for MTG cards",
  "card_number": "Same as collector_number for consistency",
  "serial_number": "For serialized cards, extract numbering (e.g., '123/500') or 'N/A'",
  "rarity_or_variant": "Common, Uncommon, Rare, Mythic Rare, or special variants (Showcase, Borderless, Extended Art, etc.)",
  "subset": "Special subset if applicable (e.g., 'Retro Frame', 'Phyrexian Language', 'Borderless')",

  // MTG-SPECIFIC FIELDS
  "mana_cost": "{2}{U}{U}" or "{3}{W}{W}" or null,  // Extract from top-right corner
  "color_identity": "U" or "WU" or "WUBRG" or null,  // W=White, U=Blue, B=Black, R=Red, G=Green
  "mtg_card_type": "Creature" or "Instant" or "Sorcery" or "Enchantment" or "Artifact" or "Planeswalker" or "Land",
  "creature_type": "Human Wizard" or "Dragon" or "Artifact Creature - Golem" or null,  // For creatures only
  "power_toughness": "3/3" or "5/5" or "*/2" or null,  // For creatures only, bottom-right corner
  "artist_name": "Artist name from bottom-center (e.g., 'Rebecca Guay', 'Mark Tedin')",
  "is_foil": true or false,  // Does card have holographic foil treatment?
  "is_promo": true or false,  // Does card have promo stamp or designation?
  "border_color": "Black" or "White" or "Silver" or "Gold",
  "frame_version": "Modern" or "Future" or "Old" or "M15" or "Borderless",
  "is_double_faced": true or false,  // Transforming card with two faces?
  "language": "English" or "Japanese" or "German" etc.,
  "keywords": ["Flying", "Haste", "Trample"] or [],  // Array of keywords extracted from rules text

  "rookie_or_first": false,  // NOT APPLICABLE for MTG (always false)
  "autographed": false,  // RARE - Only set to true if you see a visible cursive SIGNATURE from the artist
  "memorabilia": false,  // NOT APPLICABLE for MTG (always false)
  "authentic": true or false,  // Is this a genuine WotC card or potential counterfeit?

  "needs_api_lookup": true or false  // Set to true if you need Scryfall API to identify set/card
}
```

### 3.6 Update Autograph Section

**Replace Pokemon autograph examples with MTG equivalents:**

```
MANUFACTURER AUTHENTICATION INDICATORS (any = VERIFIED):
• "Artist Proof" stamp or designation
• CGC/PSA/BGS certified autograph encapsulation
• COA (Certificate of Authenticity) reference printed on card
• Official convention signature with event stamp
• Wizards of the Coast authentication seal (rare)

COMMON MTG ARTIST AUTOGRAPHS:
• Look for signatures from: Rebecca Guay, John Avon, Mark Tedin, Seb McKinnon, Noah Bradley, etc.
• Artist signatures typically in silver or gold pen
• May include sketch or doodle alongside signature
```

### 3.7 Update Examples Throughout Prompt

Find all example cards and replace with MTG equivalents:

**Before:**
```
Example: "Base Set Charizard #4/102 from 1999"
```

**After:**
```
Example: "Alpha Black Lotus from Limited Edition Alpha, 1993"
Example: "Modern Horizons 3 Eldrazi Incursion #234"
Example: "Murders at Karlov Manor Lazav, Wearer of Faces (Showcase)"
```

---

## 4. API Route Implementation

### 4.1 Create MTG API Route

**File:** `src/app/api/mtg/[id]/route.ts`

**Source:** Copy `src/app/api/pokemon/[id]/route.ts`

### 4.2 Find & Replace

| Find | Replace |
|---|---|
| `pokemon` | `mtg` |
| `Pokemon` | `MTG` |
| `processingPokemonCards` | `processingMTGCards` |
| `PokemonCardGradingRequest` | `MTGCardGradingRequest` |
| `pokemon_type` | `mtg_card_type` |
| `pokemon_stage` | `creature_type` |
| `hp` | `power_toughness` |
| `pokemon_featured` | `featured` |
| `pokemon_conversational_grading_v4_2.txt` | `mtg_conversational_grading_v4_2.txt` |

### 4.3 Update Field Extraction Functions

**Line 98: `extractMTGFieldsFromConversational()`**

```typescript
function extractMTGFieldsFromConversational(conversationalJSON: any) {
  try {
    const data = typeof conversationalJSON === 'string' ? JSON.parse(conversationalJSON) : conversationalJSON;
    const cardInfo = data.card_info || {};

    console.log('[MTG Field Extraction] card_info:', cardInfo);

    return {
      // Standard card fields
      card_name: cardInfo.card_name || null,
      card_set: cardInfo.set_name || null,
      card_number: cardInfo.collector_number || cardInfo.card_number || null,
      release_date: cardInfo.year || null,
      manufacturer_name: cardInfo.manufacturer || 'Wizards of the Coast',
      serial_numbering: cardInfo.serial_number || null,
      authentic: cardInfo.authentic !== undefined ? cardInfo.authentic : null,
      rarity_description: cardInfo.rarity_or_variant || null,
      autographed: cardInfo.autographed !== undefined ? cardInfo.autographed : null,
      featured: cardInfo.player_or_character || null,

      // MTG-specific fields
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
      keywords: cardInfo.keywords || null
    };
  } catch (error) {
    console.error('[MTG Field Extraction] Error parsing conversational JSON:', error);
    return {};
  }
}
```

### 4.4 Add Scryfall API Integration

**Line 473: Replace Pokemon TCG API lookup with Scryfall**

```typescript
// 🆕 HYBRID SET IDENTIFICATION: Check if we need Scryfall API lookup
const cardInfo = conversationalGradingData.card_info;
const needsApiLookup = cardInfo?.needs_api_lookup === true ||
                       ((!cardInfo?.set_name || cardInfo?.set_name === null) && !!cardInfo?.card_number);

console.log(`[GET /api/mtg/${cardId}] 🔍 Set identification check:`, {
  set_name: cardInfo?.set_name || 'null',
  card_number: cardInfo?.card_number || 'null',
  needs_api_lookup_flag: cardInfo?.needs_api_lookup,
  will_call_api: needsApiLookup ? 'YES' : 'NO'
});

if (needsApiLookup) {
  console.log(`[GET /api/mtg/${cardId}] 🔍 Calling Scryfall API for card lookup...`);

  try {
    const cardNumber = cardInfo.collector_number || cardInfo.card_number;
    const cardName = cardInfo.card_name;
    const setCode = cardInfo.expansion_code;

    if (cardNumber || cardName) {
      const apiResult = await lookupMTGCard(cardNumber, cardName, setCode);

      if (apiResult.success) {
        console.log(`[GET /api/mtg/${cardId}] ✅ Scryfall lookup successful:`, apiResult.set_name);

        // Merge Scryfall results back into card_info
        conversationalGradingData.card_info.set_name = apiResult.set_name;
        conversationalGradingData.card_info.expansion_code = apiResult.set_code;
        conversationalGradingData.card_info.collector_number = apiResult.collector_number;
        conversationalGradingData.card_info.rarity_or_variant = apiResult.rarity;
        conversationalGradingData.card_info.scryfall_id = apiResult.scryfall_id;
        conversationalGradingData.card_info.artist_name = apiResult.artist;
        conversationalGradingData.card_info.mana_cost = apiResult.mana_cost;
        conversationalGradingData.card_info.mtg_card_type = apiResult.type_line;
        conversationalGradingData.card_info.oracle_text = apiResult.oracle_text;
        conversationalGradingData.card_info.needs_api_lookup = false;
      } else {
        console.warn(`[GET /api/mtg/${cardId}] ⚠️ Scryfall lookup failed:`, apiResult.error);
      }
    }
  } catch (error: any) {
    console.error(`[GET /api/mtg/${cardId}] ⚠️ Scryfall lookup error:`, error.message);
  }
}
```

### 4.5 Update Category Filter

**Line 163: Change category check**

```typescript
.eq("category", "MTG") // Ensure it's an MTG card
```

---

## 5. Upload Page Creation

### 5.1 Create Upload Page

**File:** `src/app/mtg/upload/page.tsx`

**Source:** Copy `src/app/pokemon/upload/page.tsx`

### 5.2 Updates Needed

**Global Find & Replace:**
| Find | Replace |
|---|---|
| `Pokemon` | `Magic: The Gathering` or `MTG` |
| `pokemon` | `mtg` |
| `category: "Pokemon"` | `category: "MTG"` |
| `"Upload Pokemon Card"` | `"Upload MTG Card"` |
| `/pokemon` | `/mtg` |

**Update Hero Section (around line 80):**

```typescript
<div className="text-center mb-8">
  <h1 className="text-4xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-3">
    <span className="text-5xl">🎴</span>
    Upload Magic: The Gathering Card
  </h1>
  <p className="text-gray-600 text-lg">
    Professional grading for MTG cards with detailed condition analysis
  </p>
  <p className="text-sm text-gray-500 mt-2">
    Supports all MTG expansions • Foil detection • Variant identification
  </p>
</div>
```

**Update Instructions (around line 120):**

```typescript
<div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
  <h3 className="font-semibold text-blue-900 mb-2">📸 Photo Tips for MTG Cards:</h3>
  <ul className="text-sm text-blue-800 space-y-1 ml-4">
    <li>• Take photos on a solid, dark background for best contrast</li>
    <li>• Ensure mana symbols and set symbol are clearly visible</li>
    <li>• For foils, avoid glare while showing holographic pattern</li>
    <li>• Capture collector number in bottom-left corner</li>
    <li>• Keep card flat to show any foil curl accurately</li>
    <li>• For double-faced cards, photograph both sides separately</li>
  </ul>
</div>
```

### 5.3 Add MTG-Specific Image Validation

**After line 200, add MTG validation:**

```typescript
// MTG-specific validation
const validateMTGImage = (file: File): string | null => {
  // Check file size (max 10MB for high-res foil detection)
  if (file.size > 10 * 1024 * 1024) {
    return 'Image size must be less than 10MB';
  }

  // Check file type
  if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
    return 'Only JPG and PNG images are supported';
  }

  return null;
};
```

---

## 6. Card Details Page

### 6.1 Create Card Details Page Structure

**Files to create:**
- `src/app/mtg/[id]/page.tsx` (Server component)
- `src/app/mtg/[id]/CardDetailClient.tsx` (Client component)

**Source:** Copy from Pokemon card details

### 6.2 Server Component

**File:** `src/app/mtg/[id]/page.tsx`

```typescript
import { Metadata } from 'next';
import { MTGCardDetailClient } from './CardDetailClient';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return {
    title: 'MTG Card Grading Report | DCM',
    description: 'Professional Magic: The Gathering card grading with detailed condition analysis',
  };
}

export default function MTGCardDetailPage({ params }: { params: { id: string } }) {
  return <MTGCardDetailClient cardId={params.id} />;
}
```

### 6.3 Client Component - MTG-Specific Card Info Section

**File:** `src/app/mtg/[id]/CardDetailClient.tsx`

**Copy from Pokemon CardDetailClient, then update:**

**Card Info Display Section (around line 2800):**

```tsx
{/* MTG Card Information Section */}
<div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-6 mb-6">
  <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-gray-200">
    🎴 Card Information
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

    {/* Card Name with bilingual support */}
    {(cardInfo.card_name || card.card_name) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Card Name</p>
        {(() => {
          const cardName = cardInfo.card_name || card.card_name;
          const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(cardName);

          if (hasJapanese) {
            const parts = cardName.split(/[/()（）]/);
            const japanesePart = parts.find(p => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(p));
            const englishPart = parts.find(p => p.trim() && !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(p));

            return (
              <div>
                <p className="text-lg font-bold text-gray-900 font-noto-sans-jp">
                  {japanesePart?.trim()}
                </p>
                {englishPart && (
                  <p className="text-sm text-gray-600 mt-0.5">
                    {englishPart.trim()}
                  </p>
                )}
              </div>
            );
          }

          return <p className="text-lg font-bold text-gray-900">{cardName}</p>;
        })()}
      </div>
    )}

    {/* Mana Cost */}
    {(cardInfo.mana_cost || card.mana_cost) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Mana Cost</p>
        <p className="text-lg font-bold text-gray-900 font-mono">
          {cardInfo.mana_cost || card.mana_cost}
        </p>
      </div>
    )}

    {/* Card Type */}
    {(cardInfo.mtg_card_type || card.mtg_card_type) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Type</p>
        <p className="text-lg font-bold text-gray-900">
          {cardInfo.mtg_card_type || card.mtg_card_type}
        </p>
      </div>
    )}

    {/* Creature Type */}
    {(cardInfo.creature_type || card.creature_type) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Creature Type</p>
        <p className="text-lg text-gray-900">
          {cardInfo.creature_type || card.creature_type}
        </p>
      </div>
    )}

    {/* Power/Toughness */}
    {(cardInfo.power_toughness || card.power_toughness) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Power / Toughness</p>
        <p className="text-lg font-bold text-green-700">
          {cardInfo.power_toughness || card.power_toughness}
        </p>
      </div>
    )}

    {/* Color Identity */}
    {(cardInfo.color_identity || card.color_identity) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Color Identity</p>
        <div className="flex gap-1">
          {(cardInfo.color_identity || card.color_identity).split('').map((color: string, idx: number) => {
            const colorMap: {[key: string]: {name: string, bg: string, text: string}} = {
              'W': {name: 'White', bg: 'bg-yellow-100', text: 'text-yellow-800'},
              'U': {name: 'Blue', bg: 'bg-blue-100', text: 'text-blue-800'},
              'B': {name: 'Black', bg: 'bg-gray-800', text: 'text-white'},
              'R': {name: 'Red', bg: 'bg-red-100', text: 'text-red-800'},
              'G': {name: 'Green', bg: 'bg-green-100', text: 'text-green-800'},
              'C': {name: 'Colorless', bg: 'bg-gray-200', text: 'text-gray-700'}
            };
            const colorInfo = colorMap[color] || colorMap['C'];
            return (
              <span
                key={idx}
                className={`px-2 py-1 rounded-lg text-xs font-bold ${colorInfo.bg} ${colorInfo.text}`}
                title={colorInfo.name}
              >
                {color}
              </span>
            );
          })}
        </div>
      </div>
    )}

    {/* Set/Expansion */}
    {(() => {
      const setName = (cardInfo.set_name && cardInfo.set_name !== 'null') ? cardInfo.set_name :
                     (card.card_set && card.card_set !== 'null') ? card.card_set :
                     cardInfo.set_era || card.card_set || 'Unknown Set';

      return setName !== 'Unknown Set' && (
        <div>
          <p className="text-sm font-semibold text-gray-600 mb-1">Expansion</p>
          <p className="text-lg text-gray-900">{setName}</p>
          {(cardInfo.expansion_code || card.expansion_code) && (
            <p className="text-xs text-gray-500 font-mono mt-0.5">
              [{cardInfo.expansion_code || card.expansion_code}]
            </p>
          )}
        </div>
      );
    })()}

    {/* Collector Number */}
    {(cardInfo.collector_number || cardInfo.card_number || card.card_number) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Collector Number</p>
        <p className="text-lg text-gray-900 font-mono">
          {cardInfo.collector_number || cardInfo.card_number || card.card_number}
        </p>
      </div>
    )}

    {/* Rarity */}
    {(cardInfo.rarity_or_variant || card.rarity_description) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Rarity</p>
        <p className="text-lg text-gray-900">
          {cardInfo.rarity_or_variant || card.rarity_description}
        </p>
      </div>
    )}

    {/* Artist */}
    {(cardInfo.artist_name || card.artist_name) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Artist</p>
        <p className="text-lg text-gray-900">
          {cardInfo.artist_name || card.artist_name}
        </p>
      </div>
    )}

    {/* Foil Badge */}
    {(cardInfo.is_foil || card.is_foil) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Finish</p>
        <span className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-bold shadow-md">
          ✨ Foil
        </span>
      </div>
    )}

    {/* Promo Badge */}
    {(cardInfo.is_promo || card.is_promo) && (
      <div>
        <span className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500 text-yellow-900 rounded-lg text-sm font-bold">
          ⭐ Promo
        </span>
      </div>
    )}

    {/* Language */}
    {(cardInfo.language || card.language) && (cardInfo.language || card.language) !== 'English' && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Language</p>
        <p className="text-lg text-gray-900">
          {cardInfo.language || card.language}
        </p>
      </div>
    )}

  </div>
</div>
```

### 6.4 Add MTG-Specific Visual Elements

**Mana Symbol Renderer (add helper function):**

```typescript
// Helper: Render MTG mana symbols
const renderManaSymbols = (manaCost: string) => {
  if (!manaCost) return null;

  const symbols = manaCost.match(/\{[^}]+\}/g) || [];

  return (
    <div className="flex gap-1 items-center">
      {symbols.map((symbol, idx) => {
        const clean = symbol.replace(/[{}]/g, '');
        return (
          <span
            key={idx}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-xs font-bold border border-gray-400"
            title={symbol}
          >
            {clean}
          </span>
        );
      })}
    </div>
  );
};
```

---

## 7. Collection Page Updates

### 7.1 Update Main Collection Page

**File:** `src/app/collection/page.tsx`

**Add MTG tab:**

```typescript
const categories = [
  { id: 'all', label: 'All Cards', icon: '🎴' },
  { id: 'Sports', label: 'Sports', icon: '⚾' },
  { id: 'Pokemon', label: 'Pokemon', icon: '⚡' },
  { id: 'MTG', label: 'Magic', icon: '🎴' }, // NEW
  { id: 'Other', label: 'Other', icon: '🃏' }
];
```

### 7.2 Add MTG-Specific Filters

```typescript
{selectedCategory === 'MTG' && (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
    {/* Color Filter */}
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">Color</label>
      <select className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
        <option value="">All Colors</option>
        <option value="W">White</option>
        <option value="U">Blue</option>
        <option value="B">Black</option>
        <option value="R">Red</option>
        <option value="G">Green</option>
        <option value="C">Colorless</option>
        <option value="Multi">Multicolor</option>
      </select>
    </div>

    {/* Card Type Filter */}
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
      <select className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
        <option value="">All Types</option>
        <option value="Creature">Creature</option>
        <option value="Instant">Instant</option>
        <option value="Sorcery">Sorcery</option>
        <option value="Enchantment">Enchantment</option>
        <option value="Artifact">Artifact</option>
        <option value="Planeswalker">Planeswalker</option>
        <option value="Land">Land</option>
      </select>
    </div>

    {/* Foil Filter */}
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">Finish</label>
      <select className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
        <option value="">All Finishes</option>
        <option value="foil">Foil Only</option>
        <option value="nonfoil">Non-Foil Only</option>
      </select>
    </div>

    {/* Rarity Filter */}
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">Rarity</label>
      <select className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
        <option value="">All Rarities</option>
        <option value="Common">Common</option>
        <option value="Uncommon">Uncommon</option>
        <option value="Rare">Rare</option>
        <option value="Mythic">Mythic Rare</option>
      </select>
    </div>
  </div>
)}
```

---

## 8. External API Integration

### 8.1 Create Scryfall API Utility

**File:** `src/lib/scryfallApi.ts`

```typescript
/**
 * Scryfall API Integration for MTG Card Lookup
 * API Documentation: https://scryfall.com/docs/api
 */

interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  mana_cost?: string;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  colors?: string[];
  color_identity?: string[];
  artist?: string;
  released_at: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
  };
}

interface ScryfallLookupResult {
  success: boolean;
  set_name?: string;
  set_code?: string;
  collector_number?: string;
  rarity?: string;
  scryfall_id?: string;
  artist?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  power_toughness?: string;
  error?: string;
}

/**
 * Look up MTG card by collector number, name, or set code
 */
export async function lookupMTGCard(
  collectorNumber?: string,
  cardName?: string,
  setCode?: string
): Promise<ScryfallLookupResult> {
  try {
    console.log('[Scryfall API] Looking up card:', { collectorNumber, cardName, setCode });

    let searchUrl = 'https://api.scryfall.com/cards/search?q=';

    // Build search query
    const queryParts: string[] = [];
    if (cardName) queryParts.push(`!"${cardName}"`);
    if (collectorNumber) queryParts.push(`number:${collectorNumber}`);
    if (setCode) queryParts.push(`set:${setCode}`);

    if (queryParts.length === 0) {
      return { success: false, error: 'No search parameters provided' };
    }

    searchUrl += queryParts.join(' ');

    // Respect Scryfall rate limit (100ms between requests)
    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DCM-Grading-App/1.0'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'Card not found in Scryfall database' };
      }
      throw new Error(`Scryfall API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return { success: false, error: 'No matching cards found' };
    }

    // Take first result (most relevant)
    const card: ScryfallCard = data.data[0];

    // Format power/toughness
    let powerToughness = null;
    if (card.power && card.toughness) {
      powerToughness = `${card.power}/${card.toughness}`;
    }

    console.log('[Scryfall API] ✅ Card found:', card.name);

    return {
      success: true,
      set_name: card.set_name,
      set_code: card.set.toUpperCase(),
      collector_number: card.collector_number,
      rarity: formatRarity(card.rarity),
      scryfall_id: card.id,
      artist: card.artist,
      mana_cost: card.mana_cost,
      type_line: card.type_line,
      oracle_text: card.oracle_text,
      power_toughness: powerToughness
    };

  } catch (error: any) {
    console.error('[Scryfall API] Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Format rarity from Scryfall format to display format
 */
function formatRarity(rarity: string): string {
  const rarityMap: {[key: string]: string} = {
    'common': 'Common',
    'uncommon': 'Uncommon',
    'rare': 'Rare',
    'mythic': 'Mythic Rare',
    'special': 'Special',
    'bonus': 'Bonus'
  };

  return rarityMap[rarity] || rarity;
}

/**
 * Get card image from Scryfall
 */
export async function getScryfallImage(scryfallId: string, size: 'small' | 'normal' | 'large' = 'normal'): Promise<string | null> {
  try {
    const response = await fetch(`https://api.scryfall.com/cards/${scryfallId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch card: ${response.status}`);
    }

    const card: ScryfallCard = await response.json();

    return card.image_uris?.[size] || null;
  } catch (error) {
    console.error('[Scryfall API] Error fetching image:', error);
    return null;
  }
}
```

### 8.2 Update MTG API Route to Use Scryfall

**In `src/app/api/mtg/[id]/route.ts` around line 490:**

```typescript
import { lookupMTGCard } from '@/lib/scryfallApi';

// ... (in the needsApiLookup section)

const apiResult = await lookupMTGCard(cardNumber, cardName, setCode);
```

---

## 9. Marketplace Integration

### 9.1 Update TCGPlayer Utils for MTG

**File:** `src/lib/tcgplayerUtils.ts`

**Add MTG category handling:**

```typescript
export function generateTCGPlayerSearchUrl(cardData: {
  featured?: string;
  card_set?: string;
  card_number?: string;
  variant?: string;
  category?: string; // NEW
  expansion_code?: string; // NEW
  is_foil?: boolean; // NEW
}): string {
  const searchParts: string[] = [];

  // For MTG cards, use card name
  if (cardData.category === 'MTG') {
    if (cardData.featured) {
      searchParts.push(cardData.featured);
    }

    // Add expansion code if available
    if (cardData.expansion_code) {
      searchParts.push(cardData.expansion_code);
    }

    // Add collector number
    if (cardData.card_number) {
      searchParts.push(cardData.card_number);
    }

    // Add foil indicator
    if (cardData.is_foil) {
      searchParts.push('foil');
    }

    const query = encodeURIComponent(searchParts.join(' '));
    return `https://www.tcgplayer.com/search/magic/product?q=${query}`;
  }

  // ... (existing Pokemon/Sports logic)
}
```

### 9.2 Update Card Detail Client with MTG Marketplace Links

**In `src/app/mtg/[id]/CardDetailClient.tsx`:**

```tsx
{/* Marketplace Links Section */}
<div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 p-6 mb-6">
  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
    <span>💰</span> Market Price Lookup
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

    {/* TCGPlayer */}
    <a
      href={generateTCGPlayerSearchUrl({
        featured: extractEnglishForSearch(cardInfo.card_name) || extractEnglishForSearch(card.card_name),
        expansion_code: cardInfo.expansion_code || card.expansion_code,
        card_number: cardInfo.collector_number || card.card_number,
        is_foil: cardInfo.is_foil || card.is_foil,
        category: 'MTG'
      })}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-3 bg-white hover:bg-blue-50 border-2 border-blue-300 rounded-lg px-4 py-3 transition-all"
    >
      <span className="text-2xl">🛒</span>
      <div className="text-left">
        <p className="font-bold text-gray-900 text-sm">TCGPlayer</p>
        <p className="text-xs text-gray-600">Search Market</p>
      </div>
    </a>

    {/* eBay Sold */}
    <a
      href={generateEbaySoldUrl({
        featured: extractEnglishForSearch(cardInfo.card_name) || extractEnglishForSearch(card.card_name),
        card_set: extractEnglishForSearch(cardInfo.set_name) || extractEnglishForSearch(card.card_set),
        card_number: cardInfo.collector_number || card.card_number
      })}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-3 bg-white hover:bg-yellow-50 border-2 border-yellow-400 rounded-lg px-4 py-3 transition-all"
    >
      <span className="text-2xl">📊</span>
      <div className="text-left">
        <p className="font-bold text-gray-900 text-sm">eBay Sold</p>
        <p className="text-xs text-gray-600">Recent Sales</p>
      </div>
    </a>

    {/* Scryfall */}
    {(card.scryfall_id || cardInfo.scryfall_id) && (
      <a
        href={`https://scryfall.com/card/${card.scryfall_id || cardInfo.scryfall_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-3 bg-white hover:bg-purple-50 border-2 border-purple-300 rounded-lg px-4 py-3 transition-all"
      >
        <span className="text-2xl">🔍</span>
        <div className="text-left">
          <p className="font-bold text-gray-900 text-sm">Scryfall</p>
          <p className="text-xs text-gray-600">Card Database</p>
        </div>
      </a>
    )}

  </div>
</div>
```

---

## 10. Testing Strategy

### 10.1 Test Card Selection

Select diverse MTG cards for testing:

**Common Cards:**
- Lightning Bolt (M11, Alpha, Modern Horizons 3)
- Llanowar Elves (M12, Alpha, Foundations)
- Counterspell (Various sets)

**Rare/Mythic:**
- Jace, the Mind Sculptor (Worldwake)
- Tarmogoyf (Future Sight, Modern Horizons)
- Black Lotus (Alpha - if available)

**Special Variants:**
- Foil showcase card (Murders at Karlov Manor)
- Borderless planeswalker
- Extended art card
- Serialized card (if available)
- Japanese/foreign language card
- Double-faced card (Innistrad)

**Condition Variety:**
- Near Mint foil
- Lightly Played with foil curl
- Moderately Played with edge wear
- Heavily Played with whitening

### 10.2 Testing Checklist

#### Phase 1: Upload & Grading
- [ ] Upload MTG card - front and back images
- [ ] Verify card is stored with category = "MTG"
- [ ] Confirm grading initiates with MTG prompt
- [ ] Check AI extracts MTG-specific fields (mana_cost, creature_type, power_toughness)
- [ ] Verify Scryfall API lookup works for set identification
- [ ] Confirm grade calculation completes

#### Phase 2: Card Details Display
- [ ] Card name displays correctly
- [ ] Mana cost displays with symbols
- [ ] Color identity shows with colored badges
- [ ] Card type displays (Creature, Instant, etc.)
- [ ] Power/Toughness displays for creatures
- [ ] Expansion name and code display
- [ ] Collector number displays
- [ ] Artist name displays
- [ ] Foil badge appears for foil cards
- [ ] All grading sections populate (centering, corners, edges, surface)
- [ ] Centering summaries display correctly
- [ ] Subgrade summaries display in all sections

#### Phase 3: PDF Report
- [ ] Download PDF report
- [ ] Verify MTG-specific fields appear in report
- [ ] Check centering summaries display
- [ ] Confirm all subgrade summaries display
- [ ] Verify card label shows card name + set + number

#### Phase 4: Collection Page
- [ ] MTG tab appears in collection
- [ ] MTG cards display in grid
- [ ] Color filter works
- [ ] Card type filter works
- [ ] Foil filter works
- [ ] Rarity filter works
- [ ] Search finds MTG cards by name

#### Phase 5: Marketplace Links
- [ ] TCGPlayer link opens with correct search
- [ ] eBay Sold link opens with correct search
- [ ] Scryfall link opens to correct card (if scryfall_id present)
- [ ] Links work for foil cards
- [ ] Links work for foreign language cards

#### Phase 6: Edge Cases
- [ ] Double-faced card grading
- [ ] Foreign language card display
- [ ] Serialized card handling
- [ ] Foil curl detection and scoring
- [ ] Borderless card edge assessment
- [ ] Cards with no set symbol (test/promo)

---

## 11. Implementation Checklist

### Week 1: Foundation (Days 1-2)

#### Database & Migration
- [ ] Create `migrations/add_mtg_specific_fields.sql`
- [ ] Run migration on development database
- [ ] Verify all new columns exist
- [ ] Test inserting sample MTG data

#### AI Prompt
- [ ] Copy Pokemon prompt to `prompts/mtg_conversational_grading_v4_2.txt`
- [ ] Global find/replace (Pokemon → MTG)
- [ ] Remove Pokemon-specific sections
- [ ] Add MTG-specific sections (mana cost, card types, foil defects)
- [ ] Update all examples to use MTG cards
- [ ] Update JSON schema with MTG fields
- [ ] Review and refine prompt

### Week 1: Core Functionality (Days 3-5)

#### API Route
- [ ] Copy Pokemon route to `src/app/api/mtg/[id]/route.ts`
- [ ] Global find/replace
- [ ] Update `extractMTGFieldsFromConversational()` function
- [ ] Update field mappings in database save
- [ ] Update cached data parsing
- [ ] Test route with Postman/Thunder Client

#### Scryfall Integration
- [ ] Create `src/lib/scryfallApi.ts`
- [ ] Implement `lookupMTGCard()` function
- [ ] Add rate limiting (100ms between requests)
- [ ] Test with various card searches
- [ ] Integrate into API route
- [ ] Add error handling and fallbacks

#### Upload Page
- [ ] Create `src/app/mtg/upload/` directory
- [ ] Copy Pokemon upload to `page.tsx`
- [ ] Update branding and text
- [ ] Update category to "MTG"
- [ ] Update photo tips for MTG cards
- [ ] Add MTG-specific validation
- [ ] Test upload flow end-to-end

### Week 2: Display & Polish (Days 6-8)

#### Card Details Page
- [ ] Create `src/app/mtg/[id]/` directory
- [ ] Create server component `page.tsx`
- [ ] Create client component `CardDetailClient.tsx`
- [ ] Copy Pokemon card detail structure
- [ ] Build MTG card info section
- [ ] Add mana symbol rendering
- [ ] Add color identity badges
- [ ] Add foil/promo badges
- [ ] Implement bilingual support (for Japanese MTG cards)
- [ ] Test with various card types

#### Collection Page
- [ ] Add MTG tab to collection page
- [ ] Create MTG-specific filters (color, type, foil, rarity)
- [ ] Implement filter logic
- [ ] Test filtering functionality
- [ ] Update card grid display for MTG

#### Marketplace Integration
- [ ] Update `tcgplayerUtils.ts` for MTG
- [ ] Add MTG-specific URL generation
- [ ] Add Scryfall link
- [ ] Test all marketplace links
- [ ] Verify links work with foil cards

### Week 2: Testing & Refinement (Days 9-10)

#### Comprehensive Testing
- [ ] Upload 10+ diverse MTG cards
- [ ] Test all card types (creature, instant, planeswalker, etc.)
- [ ] Test foil cards
- [ ] Test foreign language cards
- [ ] Test double-faced cards
- [ ] Test serialized cards
- [ ] Verify all grading sections populate
- [ ] Verify PDF reports generate correctly
- [ ] Test marketplace links
- [ ] Test collection filters

#### Bug Fixes & Polish
- [ ] Fix any UI issues
- [ ] Refine prompt based on AI performance
- [ ] Adjust field mappings if needed
- [ ] Optimize Scryfall API calls
- [ ] Add loading states
- [ ] Add error messages

#### Documentation
- [ ] Create `MTG_GRADING_QUICK_START.md`
- [ ] Document MTG-specific fields
- [ ] Document Scryfall integration
- [ ] Update main README with MTG section
- [ ] Create troubleshooting guide

---

## 12. Optional Enhancements (Future Phases)

### Phase 2: Advanced Features
- [ ] MTG price tracking integration
- [ ] Commander format legality checker
- [ ] Deck builder integration
- [ ] Card value estimation (based on grade + rarity)
- [ ] Multi-language support UI

### Phase 3: Community Features
- [ ] MTG collection sharing
- [ ] Trade board for graded cards
- [ ] Grade distribution analytics
- [ ] Rarity/value leaderboards

---

## 13. File Structure Summary

```
card-grading-app/
├── prompts/
│   └── mtg_conversational_grading_v4_2.txt (NEW)
├── migrations/
│   └── add_mtg_specific_fields.sql (NEW)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── mtg/
│   │   │       └── [id]/
│   │   │           └── route.ts (NEW)
│   │   ├── mtg/
│   │   │   ├── upload/
│   │   │   │   └── page.tsx (NEW)
│   │   │   └── [id]/
│   │   │       ├── page.tsx (NEW)
│   │   │       └── CardDetailClient.tsx (NEW)
│   │   └── collection/
│   │       └── page.tsx (UPDATE)
│   └── lib/
│       ├── scryfallApi.ts (NEW)
│       └── tcgplayerUtils.ts (UPDATE)
└── docs/
    └── MTG_GRADING_QUICK_START.md (NEW)
```

---

## 14. Success Criteria

### Minimum Viable Product (MVP)
- ✅ MTG cards can be uploaded with front/back images
- ✅ AI correctly grades MTG cards using MTG-specific prompt
- ✅ MTG-specific fields extract and display (mana cost, type, power/toughness)
- ✅ Scryfall API successfully identifies card sets
- ✅ Card details page displays all MTG information
- ✅ PDF report generates with MTG data
- ✅ Collection page shows MTG cards with filters
- ✅ Marketplace links work (TCGPlayer, eBay, Scryfall)

### Full Feature Set
- ✅ All MVP criteria met
- ✅ Foil cards detected and graded with foil-specific defects
- ✅ Foreign language cards supported with bilingual display
- ✅ Double-faced cards handled correctly
- ✅ All subgrade summaries display (centering, corners, edges, surface)
- ✅ Error handling for edge cases
- ✅ Comprehensive documentation

---

## 15. Risk Mitigation

### Potential Issues & Solutions

**Issue 1: Scryfall API Rate Limiting**
- Solution: Implement 100ms delay between requests, cache results in database

**Issue 2: Foil Curl Affects Grading**
- Solution: Add specific foil curl assessment in prompt, note as manufacturing issue

**Issue 3: Double-Faced Cards**
- Solution: Prompt user to upload both faces separately, link in database

**Issue 4: Serialized Card Numbering**
- Solution: Extract serial number separately, display prominently

**Issue 5: Foreign Language Cards**
- Solution: Use bilingual display (like Japanese Pokemon), Scryfall can identify by number

---

## 16. Timeline Summary

| Phase | Duration | Deliverables |
|---|---|---|
| **Planning & Setup** | 0.5 days | Database migration, file structure |
| **Prompt Creation** | 1 day | MTG-specific prompt, examples, testing |
| **API Route** | 1 day | MTG route, field extraction, Scryfall integration |
| **Upload Page** | 0.5 days | Upload UI, validation, flow testing |
| **Card Details** | 1.5 days | Display components, MTG-specific sections |
| **Collection & Marketplace** | 0.5 days | Filters, marketplace links |
| **Testing & Refinement** | 2 days | Comprehensive testing, bug fixes |
| **Documentation** | 0.5 days | Guides, troubleshooting, README |
| **TOTAL** | **7-8 days** | Full MTG grading system |

---

## 17. Next Steps

1. **Review this plan** with stakeholders
2. **Prioritize features** (MVP vs. nice-to-have)
3. **Set up development environment** for MTG testing
4. **Gather test cards** (physical or images) for diverse testing
5. **Begin implementation** following checklist order
6. **Iterate based on testing** feedback

---

## Conclusion

This comprehensive plan leverages the proven Pokemon grading infrastructure to rapidly build a Magic: The Gathering grading system. By reusing existing architecture and patterns, development time is minimized while ensuring consistency across card types.

The phased approach allows for incremental delivery:
- **Week 1:** Core functionality (upload, grade, display)
- **Week 2:** Polish and testing (filters, marketplace, refinement)

This plan provides a clear roadmap from concept to production-ready MTG grading system.

---

**Document Version:** 1.0
**Created:** 2025-01-07
**Last Updated:** 2025-01-07
**Status:** ✅ READY FOR IMPLEMENTATION
