# Disney Lorcana Grading System - Comprehensive Implementation Plan

## Executive Summary

This document outlines a complete plan to build a Disney Lorcana card grading system leveraging the proven MTG and Pokemon grading infrastructure. This plan incorporates all lessons learned from the MTG implementation, including critical fixes discovered on 2025-01-11.

**Timeline Estimate:** 5-7 days for full implementation (including all fixes from day one)
**Complexity:** Medium (leveraging existing infrastructure with comprehensive bug prevention)

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Lessons Learned from MTG Implementation](#2-lessons-learned-from-mtg-implementation)
3. [Database Schema Updates](#3-database-schema-updates)
4. [AI Prompt Creation](#4-ai-prompt-creation)
5. [API Route Implementation](#5-api-route-implementation)
6. [Upload Page Creation](#6-upload-page-creation)
7. [Card Details Page](#7-card-details-page)
8. [Collection Page Updates](#8-collection-page-updates)
9. [External API Integration](#9-external-api-integration)
10. [Marketplace Integration](#10-marketplace-integration)
11. [Testing Strategy](#11-testing-strategy)
12. [Implementation Checklist](#12-implementation-checklist)

---

## 1. System Architecture Overview

### Lorcana System Flow
```
User Upload → /lorcana/upload
              ↓
         Store in DB (category: "Lorcana")
              ↓
         /api/lorcana/[id] → gradeCardConversational('lorcana')
              ↓
         AI Grades Card (lorcana_conversational_grading_v4_2.txt)
              ↓
         Store Results → conversational_grading field
              ↓
         Display → /lorcana/[id] (Card Details)
```

### Key Differentiators from MTG
- **Enchanted/Foil variants** - Special holographic treatment
- **Ink colors** - Amber, Amethyst, Emerald, Ruby, Sapphire, Steel (6 colors)
- **Character versions** - Multiple versions of same character
- **Quest cards** - Unique card type specific to Lorcana
- **Songs** - Special card type that can be "sung" by characters
- **Shift mechanic** - Upgrade existing characters

---

## 2. Lessons Learned from MTG Implementation

### 🔧 Critical Fixes to Implement from Day One

#### Fix #1: Processing Time Storage Bug
**Problem:** Processing time was recalculated on every page load (showing 0.3s instead of actual 80s+ grading time)

**Solution:**
```typescript
// ❌ WRONG - Don't do this for cached cards
processing_time: Date.now() - startTime

// ✅ CORRECT - Use stored value
processing_time: card.processing_time
```

**Files to fix:**
- `src/app/api/lorcana/[id]/route.ts` (in the "already fully processed" section)

---

#### Fix #2: Set Name Lookup Table
**Problem:** AI made up descriptive names like "Special Edition" instead of using set codes

**Solution:**
- Include comprehensive Lorcana set lookup table in prompt
- Add explicit rule: "DO NOT make up descriptive names. Use set codes if set not in table."

**Sets to include:**
```
TFC - The First Chapter
ROF - Rise of the Floodborn
ITI - Into the Inklands
URU - Ursula's Return
SHI - Shimmering Skies
AZU - Azurite Sea
PRO - Promo Cards
```

---

#### Fix #3: Limiting Factor for Perfect Cards
**Problem:** Prompt forced AI to mention limiting factor even for 10.0 cards

**Solution:**
```
🆕 PERFECT CARD HANDLING (All categories = 10.0):
If all four weighted scores tied at 10.0:
• Preliminary Grade = 10.0
• Limiting Factor = "none" (no limiting factor for perfect cards)
• For perfect 10.0 cards, use "none" as limiting factor
• For all other grades, identify the category with the lowest weighted score
```

Update summary instruction:
```
"summary": "ONLY mention the limiting factor if the final grade is less than 10.0.
For perfect 10.0 cards, describe the flawless condition without mentioning any limiting factor."
```

---

#### Fix #4: Prompt Version Type System
**Problem:** `visionGrader.ts` didn't support 'lorcana' type, would fall back to wrong prompt

**Solution:**
```typescript
// Update function signatures in visionGrader.ts
function loadConversationalPrompt(cardType: 'sports' | 'pokemon' | 'mtg' | 'lorcana' = 'sports')

// Update ternary to load correct prompt
const promptFileName = cardType === 'pokemon'
  ? 'pokemon_conversational_grading_v4_2.txt'
  : cardType === 'mtg'
  ? 'mtg_conversational_grading_v4_2.txt'
  : cardType === 'lorcana'
  ? 'lorcana_conversational_grading_v4_2.txt'
  : 'conversational_grading_v4_2_ENHANCED_STRICTNESS.txt';

// Update export function
export async function gradeCardConversational(
  frontImageUrl: string,
  backImageUrl: string,
  cardType: 'sports' | 'pokemon' | 'mtg' | 'lorcana' = 'sports',
```

**Files to update:**
- `src/lib/visionGrader.ts` (3 locations: lines ~1219, ~1244, ~1396)

---

#### Fix #5: Frontend Card Info Mapping
**Problem:** Frontend wasn't mapping Lorcana-specific fields from AI response

**Solution:**
Map ALL Lorcana-specific fields in CardDetailClient:
```typescript
const cardInfo = {
  // Standard fields
  card_name: stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || null,

  // 🎴 LORCANA-SPECIFIC FIELDS (ADD ALL)
  ink_color: stripMarkdown(card.conversational_card_info?.ink_color) || card.ink_color || null,
  lorcana_card_type: stripMarkdown(card.conversational_card_info?.lorcana_card_type) || card.lorcana_card_type || null,
  character_version: stripMarkdown(card.conversational_card_info?.character_version) || card.character_version || null,
  inkwell: card.conversational_card_info?.inkwell !== undefined ? card.conversational_card_info.inkwell : (card.inkwell || false),
  strength: stripMarkdown(card.conversational_card_info?.strength) || card.strength || null,
  willpower: stripMarkdown(card.conversational_card_info?.willpower) || card.willpower || null,
  lore_value: stripMarkdown(card.conversational_card_info?.lore_value) || card.lore_value || null,
  ink_cost: stripMarkdown(card.conversational_card_info?.ink_cost) || card.ink_cost || null,
  classifications: card.conversational_card_info?.classifications || card.classifications || null,
  is_enchanted: card.conversational_card_info?.is_enchanted !== undefined ? card.conversational_card_info.is_enchanted : (card.is_enchanted || false),
  is_foil: card.conversational_card_info?.is_foil !== undefined ? card.conversational_card_info.is_foil : (card.is_foil || false),
  // ... etc
};
```

---

#### Fix #6: Browser Tab Metadata
**Problem:** Generic title didn't show card-specific info

**Solution:**
Create dynamic metadata in `page.tsx`:
```typescript
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = supabaseServer();
  const { data: card } = await supabase.from('cards').select('*').eq('id', id).single();

  if (!card) {
    return {
      title: 'Lorcana Card Not Found | DCM Grading',
      description: 'Professional Disney Lorcana card grading and authentication by DCM',
    };
  }

  // Build title: Card Name | Set | Card Number | Year | DCM Grade X
  const cardName = stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || '';
  const setName = stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || '';
  const cardNumber = stripMarkdown(card.conversational_card_info?.card_number) || card.card_number || '';
  const year = card.conversational_card_info?.set_year || card.set_year || '';
  const grade = card.conversational_decimal_grade;

  const titleParts = [cardName, setName, cardNumber, year].filter(Boolean);
  let title = titleParts.join(' | ');

  if (grade) {
    title += ` | DCM Grade ${grade}`;
  }

  return { title, description: `${cardName} ${setName} graded DCM ${grade}/10. Professional Lorcana card grading.` };
}
```

---

#### Fix #7: Evaluation Details Formatting
**Problem:** Prompt version wrapped to second line in 3-column grid

**Solution:**
Use 2-row layout:
```tsx
<div className="space-y-3 text-sm">
  {/* Prompt Version - Full Width */}
  <div>
    <span className="font-semibold text-gray-700">Prompt Version:</span>{' '}
    <span className="text-gray-600">{jsonData.prompt_version}</span>
  </div>

  {/* Evaluation Date and Processing Time - Side by Side */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    <div>
      <span className="font-semibold text-gray-700">Evaluation Date:</span>{' '}
      <span className="text-gray-600">{formatGradedDate(card.created_at)}</span>
    </div>
    <div>
      <span className="font-semibold text-gray-700">Processing Time:</span>{' '}
      <span className="text-gray-600">
        {card.processing_time ? `${(card.processing_time / 1000).toFixed(1)}s` : 'N/A'}
      </span>
    </div>
  </div>
</div>
```

---

#### Fix #8: PDF Report Improvements
**Apply all improvements from MTG:**

1. **Increased Font Sizes:**
   - Header: 18pt (was 16pt)
   - Section titles: 9pt (was 8pt)
   - Body text: 7pt (was 6pt)
   - Footer text: 6pt (was 5pt)

2. **Darker Footer Colors:**
   - Report meta: `#4a5568` (was `#718096`)
   - Disclaimer: `#6b7280` (was `#a0aec0`)

3. **Marketing Call to Action:**
   ```tsx
   <Text style={reportStyles.callToAction}>
     Grade your card collection at DCMGrading.com
   </Text>
   ```

---

#### Fix #9: Remove "Evaluated in X.Xs" from Top
**Remove the processing time display next to Re-grade button**

Keep processing time ONLY in Evaluation Details section at bottom.

---

#### Fix #10: Comprehensive Marketplace Links
**Pass ALL relevant data to marketplace functions:**
```tsx
href={generateLorcanaEbaySearchUrl({
  category: 'Lorcana',
  card_name: extractEnglishForSearch(cardInfo.card_name),
  featured: extractEnglishForSearch(cardInfo.player_or_character),
  card_set: extractEnglishForSearch(cardInfo.set_name),
  card_number: cardInfo.card_number,
  ink_color: cardInfo.ink_color,
  is_enchanted: cardInfo.is_enchanted,
  is_foil: cardInfo.is_foil,
  character_version: extractEnglishForSearch(cardInfo.character_version),
  dcm_grade_whole: card.conversational_whole_grade || recommendedGrade.recommended_whole_grade
})}
```

---

## 3. Database Schema Updates

### 3.1 New Columns for Lorcana Cards

**File:** Create migration `migrations/add_lorcana_specific_fields.sql`

```sql
-- Lorcana-Specific Card Information Fields
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS ink_color TEXT, -- Amber, Amethyst, Emerald, Ruby, Sapphire, Steel
ADD COLUMN IF NOT EXISTS lorcana_card_type TEXT, -- Character, Action, Item, Location, Song
ADD COLUMN IF NOT EXISTS character_version TEXT, -- Version name (e.g., "Sorcerer's Apprentice", "Brave Little Tailor")
ADD COLUMN IF NOT EXISTS inkwell BOOLEAN DEFAULT false, -- Has ink circle?
ADD COLUMN IF NOT EXISTS strength INTEGER, -- Character strength (for characters)
ADD COLUMN IF NOT EXISTS willpower INTEGER, -- Character willpower (for characters)
ADD COLUMN IF NOT EXISTS lore_value INTEGER, -- Lore value (how much lore card generates)
ADD COLUMN IF NOT EXISTS ink_cost INTEGER, -- Cost to play the card
ADD COLUMN IF NOT EXISTS classifications TEXT[], -- Classifications: Storyborn, Dreamborn, Floodborn, Hero, Villain, etc.
ADD COLUMN IF NOT EXISTS move_cost INTEGER, -- Cost to move (for characters)
ADD COLUMN IF NOT EXISTS quest_value INTEGER, -- Lore gained when questing (for characters)
ADD COLUMN IF NOT EXISTS abilities TEXT, -- Card abilities/text
ADD COLUMN IF NOT EXISTS flavor_text TEXT, -- Flavor text
ADD COLUMN IF NOT EXISTS is_enchanted BOOLEAN DEFAULT false, -- Enchanted variant (ultra-premium foil)
ADD COLUMN IF NOT EXISTS is_foil BOOLEAN DEFAULT false, -- Standard foil variant
ADD COLUMN IF NOT EXISTS card_number TEXT, -- Card number (e.g., "123/204")
ADD COLUMN IF NOT EXISTS expansion_code TEXT, -- Set code (TFC, ROF, ITI, URU, SHI, AZU, PRO)
ADD COLUMN IF NOT EXISTS artist_name TEXT,
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'English',
ADD COLUMN IF NOT EXISTS franchise TEXT DEFAULT 'Disney'; -- Disney franchise (Disney Princess, Pixar, Marvel, etc.)

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cards_lorcana_ink_color ON cards(ink_color) WHERE category = 'Lorcana';
CREATE INDEX IF NOT EXISTS idx_cards_lorcana_card_type ON cards(lorcana_card_type) WHERE category = 'Lorcana';
CREATE INDEX IF NOT EXISTS idx_cards_lorcana_is_enchanted ON cards(is_enchanted) WHERE category = 'Lorcana';
CREATE INDEX IF NOT EXISTS idx_cards_lorcana_expansion ON cards(expansion_code) WHERE category = 'Lorcana';
CREATE INDEX IF NOT EXISTS idx_cards_lorcana_character ON cards(character_version) WHERE category = 'Lorcana';

-- Comments for documentation
COMMENT ON COLUMN cards.ink_color IS 'Lorcana ink color: Amber, Amethyst, Emerald, Ruby, Sapphire, or Steel';
COMMENT ON COLUMN cards.lorcana_card_type IS 'Card type: Character, Action, Item, Location, or Song';
COMMENT ON COLUMN cards.character_version IS 'Character version name (e.g., "Sorcerer''s Apprentie", "Beast - Transformed")';
COMMENT ON COLUMN cards.inkwell IS 'Has inkwell symbol (can be played as ink)';
COMMENT ON COLUMN cards.is_enchanted IS 'Enchanted variant (premium holographic treatment)';
COMMENT ON COLUMN cards.strength IS 'Character strength stat';
COMMENT ON COLUMN cards.willpower IS 'Character willpower stat';
COMMENT ON COLUMN cards.lore_value IS 'Lore value (points earned when questing)';
COMMENT ON COLUMN cards.classifications IS 'Array of classifications: Storyborn, Dreamborn, Floodborn, Hero, Villain, etc.';
```

### 3.2 Reuse Existing Fields

Many fields can be reused:
- `card_name` → Character name (e.g., "Mickey Mouse")
- `card_set` → Set name (e.g., "The First Chapter")
- `manufacturer_name` → "Ravensburger"
- `release_date` → Set release year
- `rarity_description` → Common, Uncommon, Rare, Super Rare, Legendary, Enchanted
- `autographed` → For artist-signed cards
- `featured` → Main character name (for search)

---

## 4. AI Prompt Creation

### 4.1 Create New Prompt File

**File:** `prompts/lorcana_conversational_grading_v4_2.txt`

**Source:** Copy `prompts/mtg_conversational_grading_v4_2.txt` (not Pokemon, use MTG as base since it has all the fixes)

### 4.2 Global Find & Replace

| Find (MTG) | Replace (Lorcana) |
|---|---|
| `MTG` | `LORCANA` |
| `Magic: The Gathering` | `Disney Lorcana` |
| `Magic` or `MTG card` | `Lorcana` or `Lorcana card` |
| `Black Lotus` | `Elsa - Snow Queen` |
| `Lightning Bolt` | `Mickey Mouse - Brave Little Tailor` |
| `Jace, the Mind Sculptor` | `Maleficent - Monstrous Dragon` |
| `Modern Horizons 3` | `Into the Inklands` |
| `Alpha` or `Limited Edition Alpha` | `The First Chapter` |
| `Wizards of the Coast` | `Ravensburger` |
| `Mark Tedin` or `Rebecca Guay` | `Grace Tran` or `Matthew Robert Davies` |

### 4.3 Remove MTG-Specific Sections

**Delete:**
- Mana cost instructions
- MTG color identity (WUBRG)
- MTG card types (Creature, Instant, Sorcery, etc.)
- Power/Toughness
- Planeswalker instructions
- Commander format references

**Replace with Lorcana equivalents:**

---

#### 4.3.1 Ink Color Classification (Replace MTG Color Identity)

```
INK COLOR CLASSIFICATION:
Lorcana cards belong to one of six ink colors:
• 🟡 Amber - Associated with cunning, charisma, and charm
• 🟣 Amethyst - Associated with magic, mystery, and intelligence
• 🟢 Emerald - Associated with nature, growth, and wisdom
• 🔴 Ruby - Associated with bravery, strength, and heroism
• 🔵 Sapphire - Associated with logic, knowledge, and strategy
• ⚫ Steel - Associated with determination, resilience, and toughness

EXTRACTION:
• Ink color is visible in the top-left corner as a colored ink splash symbol
• Extract the exact color name: "Amber", "Amethyst", "Emerald", "Ruby", "Sapphire", or "Steel"
• The ink splash will have the corresponding color
• DO NOT confuse with border color or card art colors
```

---

#### 4.3.2 Card Type Classification (Replace MTG Card Types)

```
LORCANA CARD TYPE CLASSIFICATION:
• Character - Most common type, can quest for lore
  - Has Strength and Willpower stats in bottom corners
  - Has Lore value (star symbol) in bottom-left
  - Can be exerted to quest or challenge

• Action - One-time effect card
  - Played for immediate effect, then discarded
  - No stats
  - May have "Song" subtype

• Item - Persistent effect card
  - Remains in play until removed
  - No stats
  - Provides ongoing benefits

• Location - Permanent card that modifies play area
  - Has Willpower and Move Cost
  - Can be moved to by characters
  - Provides benefits while characters are there

• Song - Special Action subtype
  - Can be played normally OR "sung" by a character
  - When sung, use character's ink cost instead of song's cost
  - Look for "Song" designation in type line
```

---

#### 4.3.3 Character Stats (Replace Power/Toughness)

```
CHARACTER STATS (Characters Only):
• Strength - Located in bottom-left corner, sword icon
  - Represents attack power when challenging
  - Format: Single number (1-10+)
  - Extract exact value

• Willpower - Located in bottom-right corner, shield icon
  - Represents defense/toughness
  - Format: Single number (1-10+)
  - Extract exact value

• Lore Value - Located in bottom-left, star/hexagon icon
  - Points earned when character quests
  - Format: Single number (0-4)
  - Extract exact value

• Ink Cost - Located in top-left, inside ink splash
  - Cost to play the card
  - Format: Single number (0-10+)
  - Extract exact value

For non-Characters: All stats should be null
```

---

#### 4.3.4 Classifications & Characteristics

```
CLASSIFICATIONS (Lorcana-Specific):
Lorcana cards have multiple classifications visible in type line:

• Origin Classifications:
  - Storyborn - Original character from Disney movies
  - Dreamborn - Reimagined version of character
  - Floodborn - New form created by the Floodborn event

• Character Traits:
  - Hero - Heroic character
  - Villain - Villainous character
  - Ally - Supportive character
  - Princess - Disney Princess
  - Deity - Powerful being
  - Knight - Warrior character
  - Sorcerer - Magic user
  - Inventor - Technological character
  - Pirate - Swashbuckler
  - Titan - Large/powerful being
  - [Many others - extract all visible classifications]

EXTRACTION:
• Classifications appear in type line after card type
• Example: "Character - Storyborn Hero Princess"
• Extract as array: ["Storyborn", "Hero", "Princess"]
• Include ALL visible classifications
```

---

#### 4.3.5 Enchanted & Foil Variants

```
SPECIAL VARIANTS:

A. ENCHANTED CARDS (Ultra-Premium)
• Enchanted cards are the highest rarity
• Visual Characteristics:
  - Full-art borderless design
  - Holographic/foil treatment across entire card
  - Art extends to edges with no border
  - Text overlay on art (not in text box)
  - Ultra-premium look
• Set "is_enchanted": true
• Rarity: "Enchanted"

B. STANDARD FOIL CARDS
• Standard holographic treatment
• Normal border and frame
• Holographic sheen over entire card
• Set "is_foil": true
• Rarity matches non-foil (Common, Uncommon, Rare, etc.)

C. NON-FOIL CARDS
• Standard matte finish
• No holographic elements
• Set both "is_enchanted" and "is_foil" to false

GRADING CONSIDERATIONS:
• Enchanted cards are more susceptible to edge wear due to borderless design
• Foil cards may show curl, scratching, or clouding
• Assess foil defects separately from handling damage
```

---

#### 4.3.6 Inkwell Symbol

```
INKWELL IDENTIFICATION:
• Located in bottom-center of card
• Appears as small ink circle/droplet symbol
• If present: Card can be played face-down as ink
• If absent: Card cannot be used as ink

EXTRACTION:
• "inkwell": true (if ink symbol present)
• "inkwell": false (if no ink symbol)

IMPORTANCE:
• Inkwell status is a key gameplay feature
• Players often filter collections by inkwell status
• Always check bottom-center for ink symbol
```

---

### 4.4 Add Lorcana-Specific Defect Patterns

```
🆕 LORCANA-SPECIFIC DEFECT PATTERNS:

A. ENCHANTED CARD EDGE WEAR
• Borderless design makes edges highly visible
• Assess all four edges carefully for whitening/wear
• Even minor edge wear is more noticeable than bordered cards
• Deduct based on visibility:
  - Barely visible under magnification: -0.5 points
  - Visible at arm's length: -1.0 to -2.0 points
  - Prominent whitening: -2.0 to -3.0 points

B. FOIL SCRATCHING & CURL
• Lorcana foils can show scratching from shuffling
• Examine surface for fine scratches that disrupt foil pattern
• Check for curl by viewing card from side angle
• Foil curl assessment: None, Slight, Moderate, Severe
• Deduct for curl: Slight (0 points), Moderate (-0.5 points), Severe (-1.0 point)

C. INK SPLASH DEFECTS
• Examine top-left ink splash symbol for printing defects
• Look for color misregistration (colors not aligned)
• Check for ink splotches or missing color
• Ink splash is critical identifier - defects here are notable

D. CHARACTER STAT BOX DEFECTS
• Check bottom corners for stat box printing issues
• Strength (bottom-left) and Willpower (bottom-right) must be legible
• Look for ink spots, missing numbers, or blurry printing
• Stat box defects affect playability - deduct accordingly

E. QUEST/LORE SYMBOL DEFECTS
• Examine lore value symbol in bottom-left
• Check for printing errors, missing stars, or color issues
• Lore value is gameplay-critical information

F. HOLOGRAPHIC PATTERN ISSUES (Enchanted)
• Enchanted cards should have consistent holographic pattern
• Check for dead spots (areas with no holo)
• Look for holo clouding or haze
• Assess pattern disruption from scratches

G. BORDERLESS ART ASSESSMENT (Enchanted)
• Entire card surface is printable area
• Assess art quality across full card face
• Look for print lines, banding, or color shifts
• Check registration (layers aligned properly)
```

---

### 4.5 Update SET IDENTIFICATION MINI TABLE

**Critical:** Include ALL Lorcana sets to prevent "Special Edition" bug

```
## 📚 LORCANA SET IDENTIFICATION MINI TABLE

**2023-2024 LORCANA SETS:**
| Set Code | Set Name                | Total Cards | Year | Notes                      |
|----------|-------------------------|-------------|------|----------------------------|
| TFC      | The First Chapter       | 204         | 2023 | First Lorcana set          |
| ROF      | Rise of the Floodborn   | 204         | 2024 | Second set                 |
| ITI      | Into the Inklands       | 204         | 2024 | Third set                  |
| URU      | Ursula's Return         | 204         | 2024 | Fourth set (villain-themed)|
| SHI      | Shimmering Skies        | 204         | 2024 | Fifth set                  |
| AZU      | Azurite Sea             | 204         | 2024 | Sixth set (Pirates theme)  |
| PRO      | Promo Cards             | Varies      | 2023+| Convention/event promos    |
| P1       | First Chapter Promos    | Varies      | 2023 | TFC promo variants         |
| P2       | Floodborn Promos        | Varies      | 2024 | ROF promo variants         |

**SET IDENTIFICATION INSTRUCTIONS:**
1. Look for 3-letter set code on card (usually bottom-left with card number)
2. Match set code to table above
3. Extract set_name from table (e.g., "The First Chapter" for TFC)
4. Extract expansion_code (e.g., "TFC")
5. If set code NOT in table:
   - Set expansion_code to the code you found (e.g., "ABC")
   - Set set_name to null (NOT a made-up descriptive name)
   - Set needs_api_lookup to true

🚨 **DO NOT make up descriptive names like "Special Edition", "Limited Edition", etc.**
If you find a set code not in the table, use the code as expansion_code and set set_name to null.

**EXAMPLE:**
❌ WRONG: Found "XYZ" → set_name: "Special Edition"
✅ CORRECT: Found "XYZ" → expansion_code: "XYZ", set_name: null, needs_api_lookup: true
```

---

### 4.6 Update PERFECT CARD HANDLING

**Critical Fix:** Prevent "limiting factor" mention for 10.0 cards

```
🆕 PERFECT CARD HANDLING (All categories = 10.0):
If all four weighted scores tied at 10.0:
• Preliminary Grade = 10.0
• Limiting Factor = "none" (no limiting factor for perfect cards)

⚠️ CRITICAL RULES:
• For perfect 10.0 cards, use "none" as limiting factor
• For all other grades (< 10.0), identify the category with the lowest weighted score as the limiting factor
• NEVER use "None", "N/A", or "All Equal" - use exactly "none" (lowercase)
```

---

### 4.7 Update Card Info Fields in JSON Schema

**Line ~2300-2350: Replace with Lorcana fields**

```json
"card_info": {
  "card_name": "Full card name (e.g., 'Mickey Mouse - Brave Little Tailor', 'Elsa - Snow Queen')",
  "player_or_character": "Character base name for search (e.g., 'Mickey Mouse', 'Elsa', 'Maleficent')",
  "character_version": "Character version/title (e.g., 'Brave Little Tailor', 'Snow Queen', 'Monstrous Dragon')",
  "set_name": "Full set name (e.g., 'The First Chapter', 'Rise of the Floodborn', 'Into the Inklands')",
  "set_era": "Always null for Lorcana (no eras yet)",
  "expansion_code": "Three-letter set code (e.g., 'TFC', 'ROF', 'ITI', 'URU', 'SHI', 'AZU', 'PRO')",
  "card_number": "Card number from bottom-left (e.g., '123/204', '45/204')",
  "year": "Release year (e.g., '2023', '2024')",
  "manufacturer": "ALWAYS 'Ravensburger' for Lorcana cards",
  "serial_number": "For serialized promos, extract numbering (e.g., '123/500') or 'N/A'",
  "rarity_or_variant": "Common, Uncommon, Rare, Super Rare, Legendary, Enchanted, or Promo",
  "subset": "Variant type if applicable (e.g., 'Promo', 'D23 Exclusive', 'First Edition')",

  // LORCANA-SPECIFIC FIELDS
  "ink_color": "Amber" or "Amethyst" or "Emerald" or "Ruby" or "Sapphire" or "Steel",
  "lorcana_card_type": "Character" or "Action" or "Item" or "Location" or "Song",
  "inkwell": true or false,  // Has inkwell symbol (can be played as ink)?
  "ink_cost": 1-10+ or null,  // Cost to play card (in ink splash top-left)
  "strength": 1-10+ or null,  // For Characters only, bottom-left sword icon
  "willpower": 1-10+ or null,  // For Characters/Locations, bottom-right shield icon
  "lore_value": 0-4 or null,  // For Characters, bottom-left star/hexagon icon
  "move_cost": 1-10+ or null,  // For Locations, cost to move there
  "quest_value": 0-4 or null,  // Same as lore_value for Characters
  "classifications": ["Storyborn", "Hero", "Princess"] or [],  // Array of all classifications from type line
  "abilities": "Full card text/abilities" or null,
  "flavor_text": "Flavor text if present" or null,
  "artist_name": "Artist name from bottom of card (e.g., 'Grace Tran', 'Matthew Robert Davies')",
  "franchise": "Disney franchise (e.g., 'Frozen', 'Mickey & Friends', 'The Little Mermaid', 'Hercules')",
  "is_enchanted": true or false,  // Enchanted variant (borderless, full-art, ultra-premium)?
  "is_foil": true or false,  // Standard foil variant?
  "is_promo": true or false,  // Promo card?
  "language": "English" or "Japanese" or "French" or "German" etc.,

  "rookie_or_first": false,  // NOT APPLICABLE for Lorcana (always false)
  "autographed": false,  // RARE - Only true if visible cursive SIGNATURE from artist
  "memorabilia": false,  // NOT APPLICABLE for Lorcana (always false)
  "authentic": true or false,  // Is this genuine Ravensburger card or potential counterfeit?
  "needs_api_lookup": true or false  // Set to true if set identification failed
}
```

---

### 4.8 Update Summary Instruction for Perfect Cards

**Line ~2540:**

```json
"summary": "3-4 SENTENCES providing an overall card condition summary for THIS card.
Synthesize findings from all four grading categories (centering, corners, edges, surface).
Describe the card's overall condition.

⚠️ LIMITING FACTOR RULE:
• ONLY mention the limiting factor if the final grade is LESS THAN 10.0
• For perfect 10.0 cards (limiting_factor = 'none'), describe the flawless condition WITHOUT mentioning any limiting factor
• For grades < 10.0, explicitly state what category limited the grade

Mention any notable strengths and provide context for the assigned grade.
Use specific observations from THIS card's analysis."
```

---

### 4.9 Update Autograph Section

**Replace MTG autograph examples with Lorcana equivalents:**

```
MANUFACTURER AUTHENTICATION INDICATORS (any = VERIFIED):
• Artist signature at convention (common for Lorcana artists)
• CGC/PSA/BGS certified autograph encapsulation
• Artist Proof designation
• Official Ravensburger authentication seal (rare)
• D23 Expo signature with official stamp

COMMON LORCANA ARTIST AUTOGRAPHS:
• Look for signatures from: Grace Tran, Matthew Robert Davies, Jochem Van Gool, Giulia Riva, etc.
• Artist signatures typically in silver or gold pen
• May include character sketch or doodle alongside signature
• Convention signatures often have event name/date stamp
```

---

### 4.10 Update Examples Throughout Prompt

Find all example cards and replace with Lorcana equivalents:

**Before:**
```
Example: "Alpha Black Lotus from Limited Edition Alpha, 1993"
```

**After:**
```
Example: "Elsa - Snow Queen from The First Chapter (TFC), 2023"
Example: "Mickey Mouse - Brave Little Tailor from Rise of the Floodborn (ROF) #123/204"
Example: "Maleficent - Monstrous Dragon (Enchanted) from Into the Inklands (ITI)"
Example: "Stitch - Carefree Surfer (Promo) from Azurite Sea Promos"
```

---

## 5. API Route Implementation

### 5.1 Create Lorcana API Route

**File:** `src/app/api/lorcana/[id]/route.ts`

**Source:** Copy `src/app/api/mtg/[id]/route.ts` (NOT Pokemon - use MTG as it has all fixes)

### 5.2 Find & Replace

| Find | Replace |
|---|---|
| `mtg` | `lorcana` |
| `MTG` | `Lorcana` |
| `processingMTGCards` | `processingLorcanaCards` |
| `MTGCardGradingRequest` | `LorcanaCardGradingRequest` |
| `mana_cost` | `ink_cost` |
| `mtg_card_type` | `lorcana_card_type` |
| `color_identity` | `ink_color` |
| `creature_type` | `character_version` |
| `power_toughness` | `strength` (but also add `willpower`) |
| `mtg_conversational_grading_v4_2.txt` | `lorcana_conversational_grading_v4_2.txt` |

---

### 5.3 Update Field Extraction Function

**Line ~98: `extractLorcanaFieldsFromConversational()`**

```typescript
function extractLorcanaFieldsFromConversational(conversationalJSON: any) {
  try {
    const data = typeof conversationalJSON === 'string' ? JSON.parse(conversationalJSON) : conversationalJSON;
    const cardInfo = data.card_info || {};

    console.log('[Lorcana Field Extraction] card_info:', cardInfo);

    return {
      // Standard card fields
      card_name: cardInfo.card_name || null,
      card_set: cardInfo.set_name || null,
      card_number: cardInfo.card_number || null,
      release_date: cardInfo.year || null,
      manufacturer_name: cardInfo.manufacturer || 'Ravensburger',
      serial_numbering: cardInfo.serial_number || null,
      authentic: cardInfo.authentic !== undefined ? cardInfo.authentic : null,
      rarity_description: cardInfo.rarity_or_variant || null,
      autographed: cardInfo.autographed !== undefined ? cardInfo.autographed : null,
      featured: cardInfo.player_or_character || null,
      subset: cardInfo.subset || null,

      // Lorcana-specific fields
      ink_color: cardInfo.ink_color || null,
      lorcana_card_type: cardInfo.lorcana_card_type || null,
      character_version: cardInfo.character_version || null,
      inkwell: cardInfo.inkwell !== undefined ? cardInfo.inkwell : false,
      ink_cost: cardInfo.ink_cost || null,
      strength: cardInfo.strength || null,
      willpower: cardInfo.willpower || null,
      lore_value: cardInfo.lore_value || null,
      quest_value: cardInfo.quest_value || cardInfo.lore_value || null, // Same value
      move_cost: cardInfo.move_cost || null,
      classifications: cardInfo.classifications || null,
      abilities: cardInfo.abilities || null,
      flavor_text: cardInfo.flavor_text || null,
      expansion_code: cardInfo.expansion_code || null,
      artist_name: cardInfo.artist_name || null,
      franchise: cardInfo.franchise || null,
      is_enchanted: cardInfo.is_enchanted !== undefined ? cardInfo.is_enchanted : false,
      is_foil: cardInfo.is_foil !== undefined ? cardInfo.is_foil : false,
      is_promo: cardInfo.is_promo !== undefined ? cardInfo.is_promo : false,
      language: cardInfo.language || 'English'
    };
  } catch (error) {
    console.error('[Lorcana Field Extraction] Error parsing conversational JSON:', error);
    return {};
  }
}
```

---

### 5.4 CRITICAL FIX: Processing Time for Cached Cards

**Line ~373 (in "already fully processed" section):**

```typescript
// ✅ CRITICAL FIX: Use stored processing_time, NOT recalculated
return NextResponse.json({
  ...card,
  // ... other fields
  front_url: frontUrl,
  back_url: backUrl,
  processing_time: card.processing_time  // ✅ Use stored value from database
});
```

**DO NOT USE:**
```typescript
processing_time: Date.now() - startTime  // ❌ WRONG - Recalculates every time
```

---

### 5.5 External API Integration (Future)

**Note:** Lorcana doesn't have a public API like Scryfall yet. Plan for future integration:

**Potential APIs:**
- Dreamborn.ink (community database)
- Lorcana API (if/when released)
- TCGPlayer API for Lorcana category

**Placeholder for future:**
```typescript
// 🔮 FUTURE: Lorcana API Integration
// When Lorcana gets official API, add here
const ENABLE_LORCANA_API = false;

if (ENABLE_LORCANA_API && needsApiLookup) {
  console.log(`[GET /api/lorcana/${cardId}] 🔍 Calling Lorcana API for card lookup...`);

  try {
    const apiResult = await lookupLorcanaCard(cardNumber, cardName, setCode);

    if (apiResult.success) {
      console.log(`[GET /api/lorcana/${cardId}] ✅ API lookup successful:`, apiResult.set_name);
      // Merge results back into card_info
      conversationalGradingData.card_info.set_name = apiResult.set_name;
      // ... etc
    }
  } catch (error: any) {
    console.error(`[GET /api/lorcana/${cardId}] ⚠️ API lookup error:`, error.message);
  }
}
```

---

### 5.6 Update Category Filter

**Line ~163:**

```typescript
.eq("category", "Lorcana") // Ensure it's a Lorcana card
```

---

### 5.7 CRITICAL: Update visionGrader.ts

**File:** `src/lib/visionGrader.ts`

**Three locations to update:**

**Location 1: Line ~1219**
```typescript
function loadConversationalPrompt(cardType: 'sports' | 'pokemon' | 'mtg' | 'lorcana' = 'sports')
```

**Location 2: Line ~1244-1250**
```typescript
const promptFileName = cardType === 'pokemon'
  ? 'pokemon_conversational_grading_v4_2.txt'
  : cardType === 'mtg'
  ? 'mtg_conversational_grading_v4_2.txt'
  : cardType === 'lorcana'
  ? 'lorcana_conversational_grading_v4_2.txt'
  : 'conversational_grading_v4_2_ENHANCED_STRICTNESS.txt';
```

**Location 3: Line ~1396**
```typescript
export async function gradeCardConversational(
  frontImageUrl: string,
  backImageUrl: string,
  cardType: 'sports' | 'pokemon' | 'mtg' | 'lorcana' = 'sports',
```

---

## 6. Upload Page Creation

### 6.1 Create Upload Page

**File:** `src/app/lorcana/upload/page.tsx`

**Source:** Copy `src/app/mtg/upload/page.tsx`

### 6.2 Updates Needed

**Global Find & Replace:**
| Find | Replace |
|---|---|
| `Magic: The Gathering` or `MTG` | `Disney Lorcana` or `Lorcana` |
| `mtg` | `lorcana` |
| `category: "MTG"` | `category: "Lorcana"` |
| `"Upload MTG Card"` | `"Upload Lorcana Card"` |
| `/mtg` | `/lorcana` |

**Update Hero Section:**

```typescript
<div className="text-center mb-8">
  <h1 className="text-4xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-3">
    <span className="text-5xl">✨</span>
    Upload Disney Lorcana Card
  </h1>
  <p className="text-gray-600 text-lg">
    Professional grading for Lorcana cards with detailed condition analysis
  </p>
  <p className="text-sm text-gray-500 mt-2">
    Supports all Lorcana sets • Enchanted detection • Ink color identification
  </p>
</div>
```

**Update Instructions:**

```typescript
<div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-6">
  <h3 className="font-semibold text-purple-900 mb-2">📸 Photo Tips for Lorcana Cards:</h3>
  <ul className="text-sm text-purple-800 space-y-1 ml-4">
    <li>• Take photos on a solid, neutral background for best contrast</li>
    <li>• Ensure ink splash (top-left) and stats (bottom corners) are clearly visible</li>
    <li>• For Enchanted cards, capture holographic pattern without too much glare</li>
    <li>• Check bottom-center for inkwell symbol visibility</li>
    <li>• Keep card flat to show any curl or warping accurately</li>
    <li>• For foil cards, show holographic effect without washing out details</li>
    <li>• Capture card number (bottom-left) clearly for set identification</li>
  </ul>
</div>
```

---

## 7. Card Details Page

### 7.1 Create Card Details Page Structure

**Files to create:**
- `src/app/lorcana/[id]/page.tsx` (Server component with dynamic metadata)
- `src/app/lorcana/[id]/CardDetailClient.tsx` (Client component)

**Source:** Copy from MTG card details (already has all fixes)

---

### 7.2 Server Component with Dynamic Metadata

**File:** `src/app/lorcana/[id]/page.tsx`

**CRITICAL: Include dynamic metadata fix**

```typescript
import { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabaseServer';
import LorcanaCardDetails from './CardDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Helper: Strip markdown formatting
function stripMarkdown(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\*\*/g, '').trim();
}

// Helper: Check if value is valid
function isValidValue(value: any): boolean {
  if (!value) return false;
  if (typeof value !== 'string') return false;
  const cleaned = value.trim().toLowerCase();
  if (cleaned === '' || cleaned === 'unknown' || cleaned === 'n/a' || cleaned === 'null') return false;
  return true;
}

// ✅ CRITICAL FIX: Dynamic metadata showing card-specific info
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = supabaseServer();

  const { data: card, error } = await supabase
    .from('cards')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !card) {
    return {
      title: 'Lorcana Card Not Found | DCM Grading',
      description: 'Professional Disney Lorcana card grading and authentication by DCM',
    };
  }

  // Build dynamic title: Card Name | Set | Card Number | Year | DCM Grade X
  const cardName = stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || '';
  const setName = stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || '';
  const cardNumber = stripMarkdown(card.conversational_card_info?.card_number) || card.card_number || '';
  const year = card.conversational_card_info?.set_year || card.set_year || '';
  const grade = card.conversational_decimal_grade;

  const titleParts = [cardName, setName, cardNumber, year].filter(p => isValidValue(p));
  let title = titleParts.join(' | ');

  if (!title) {
    title = 'Lorcana Card';
  }

  if (grade !== null && grade !== undefined && !isNaN(grade)) {
    title += ` | DCM Grade ${grade}`;
  } else {
    title += ' | DCM Grading';
  }

  // Truncate if too long
  if (title.length > 70) {
    const truncated = title.substring(0, 67);
    const lastSpace = truncated.lastIndexOf(' ');
    title = truncated.substring(0, lastSpace) + '...';
  }

  const description = `${cardName} ${setName} ${year} graded DCM ${grade}/10. Professional Disney Lorcana card grading with AI analysis.`;

  console.log('[METADATA] Lorcana card title:', title);
  console.log('[METADATA] Lorcana card description:', description);

  return {
    title,
    description,
  };
}

export default function LorcanaCardDetailPage() {
  return <LorcanaCardDetails />;
}
```

---

### 7.3 Client Component - CRITICAL FIXES

**File:** `src/app/lorcana/[id]/CardDetailClient.tsx`

**Copy from MTG CardDetailClient, then update:**

---

#### 7.3.1 CRITICAL: Card Info Mapping

**Around line 2050-2100:**

```typescript
// ✅ CRITICAL FIX: Map ALL Lorcana fields from AI response
const cardInfo = {
  // Standard fields
  card_name: stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || null,
  player_or_character: stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || null,
  set_name: stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || null,
  card_number: stripMarkdown(card.conversational_card_info?.card_number) || card.card_number || null,
  rarity_or_variant: stripMarkdown(card.conversational_card_info?.rarity_or_variant) || card.rarity_description || null,
  subset: stripMarkdown(card.conversational_card_info?.subset) || card.subset || null,

  // 🎴 LORCANA-SPECIFIC FIELDS (CRITICAL - Map ALL fields)
  ink_color: stripMarkdown(card.conversational_card_info?.ink_color) || card.ink_color || null,
  lorcana_card_type: stripMarkdown(card.conversational_card_info?.lorcana_card_type) || card.lorcana_card_type || null,
  character_version: stripMarkdown(card.conversational_card_info?.character_version) || card.character_version || null,
  inkwell: card.conversational_card_info?.inkwell !== undefined ? card.conversational_card_info.inkwell : (card.inkwell || false),
  ink_cost: stripMarkdown(card.conversational_card_info?.ink_cost) || card.ink_cost || null,
  strength: stripMarkdown(card.conversational_card_info?.strength) || card.strength || null,
  willpower: stripMarkdown(card.conversational_card_info?.willpower) || card.willpower || null,
  lore_value: stripMarkdown(card.conversational_card_info?.lore_value) || card.lore_value || null,
  quest_value: stripMarkdown(card.conversational_card_info?.quest_value) || card.quest_value || card.lore_value || null,
  move_cost: stripMarkdown(card.conversational_card_info?.move_cost) || card.move_cost || null,
  classifications: card.conversational_card_info?.classifications || card.classifications || null,
  abilities: stripMarkdown(card.conversational_card_info?.abilities) || card.abilities || null,
  flavor_text: stripMarkdown(card.conversational_card_info?.flavor_text) || card.flavor_text || null,
  expansion_code: stripMarkdown(card.conversational_card_info?.expansion_code) || card.expansion_code || null,
  artist_name: stripMarkdown(card.conversational_card_info?.artist_name) || card.artist_name || null,
  franchise: stripMarkdown(card.conversational_card_info?.franchise) || card.franchise || null,
  is_enchanted: card.conversational_card_info?.is_enchanted !== undefined ? card.conversational_card_info.is_enchanted : (card.is_enchanted || false),
  is_foil: card.conversational_card_info?.is_foil !== undefined ? card.conversational_card_info.is_foil : (card.is_foil || false),
  is_promo: card.conversational_card_info?.is_promo !== undefined ? card.conversational_card_info.is_promo : (card.is_promo || false),
  language: stripMarkdown(card.conversational_card_info?.language) || card.language || 'English',
  set_year: card.conversational_card_info?.year || card.release_date || null,
  manufacturer: card.conversational_card_info?.manufacturer || card.manufacturer_name || 'Ravensburger'
};
```

---

#### 7.3.2 Remove "Evaluated in" Text (CRITICAL FIX)

**Around line 2217-2223:**

```typescript
// ✅ CRITICAL FIX: Remove "Evaluated in X.Xs" next to Re-grade button
<button
  onClick={regradeCard}
  disabled={loading}
  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
  title="Re-grade this card with the latest model"
>
  <span>{loading ? 'Re-grading...' : 'Re-grade Card'}</span>
</button>
</div>  {/* Close button container - NO processing time div */}
```

**DO NOT include this:**
```typescript
<div className="text-sm text-gray-500">
  {card.processing_time ? (
    <span>Evaluated in {(card.processing_time / 1000).toFixed(1)}s</span>
  ) : null}
</div>
```

---

#### 7.3.3 Evaluation Details Formatting (CRITICAL FIX)

**Around line 5023-5045:**

```typescript
{/* ✅ CRITICAL FIX: 2-row layout for Evaluation Details */}
<div className="mt-8 pt-8 border-t-2 border-gray-300 bg-gray-50 -mx-8 -mb-8 px-8 py-6">
  <h4 className="text-lg font-bold text-gray-900 mb-3">Evaluation Details</h4>
  <div className="space-y-3 text-sm">
    {/* Prompt Version - Full Width */}
    <div>
      <span className="font-semibold text-gray-700">Prompt Version:</span>{' '}
      <span className="text-gray-600">{jsonData.prompt_version}</span>
    </div>
    {/* Evaluation Date and Processing Time - Side by Side */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <span className="font-semibold text-gray-700">Evaluation Date:</span>{' '}
        <span className="text-gray-600">{formatGradedDate(card.created_at)}</span>
      </div>
      <div>
        <span className="font-semibold text-gray-700">Processing Time:</span>{' '}
        <span className="text-gray-600">
          {card.processing_time ? `${(card.processing_time / 1000).toFixed(1)}s` : 'N/A'}
        </span>
      </div>
    </div>
  </div>
</div>
```

---

#### 7.3.4 Lorcana Card Information Display

**Around line 2800:**

```tsx
{/* Lorcana Card Information Section */}
<div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-6 mb-6">
  <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-gray-200">
    ✨ Card Information
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

    {/* Card Name */}
    {(cardInfo.card_name || card.card_name) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Card Name</p>
        <p className="text-lg font-bold text-gray-900">
          {cardInfo.card_name || card.card_name}
        </p>
        {(cardInfo.character_version || card.character_version) && (
          <p className="text-sm text-gray-600 italic mt-0.5">
            {cardInfo.character_version || card.character_version}
          </p>
        )}
      </div>
    )}

    {/* Ink Color with colored badge */}
    {(cardInfo.ink_color || card.ink_color) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Ink Color</p>
        <div className="flex gap-1">
          {(() => {
            const inkColor = cardInfo.ink_color || card.ink_color;
            const colorMap: {[key: string]: {bg: string, text: string, emoji: string}} = {
              'Amber': {bg: 'bg-yellow-100', text: 'text-yellow-800', emoji: '🟡'},
              'Amethyst': {bg: 'bg-purple-100', text: 'text-purple-800', emoji: '🟣'},
              'Emerald': {bg: 'bg-green-100', text: 'text-green-800', emoji: '🟢'},
              'Ruby': {bg: 'bg-red-100', text: 'text-red-800', emoji: '🔴'},
              'Sapphire': {bg: 'bg-blue-100', text: 'text-blue-800', emoji: '🔵'},
              'Steel': {bg: 'bg-gray-200', text: 'text-gray-800', emoji: '⚫'}
            };
            const colorInfo = colorMap[inkColor] || {bg: 'bg-gray-200', text: 'text-gray-800', emoji: '⚪'};
            return (
              <span className={`px-3 py-1 rounded-lg text-sm font-bold ${colorInfo.bg} ${colorInfo.text} flex items-center gap-2`}>
                <span>{colorInfo.emoji}</span>
                {inkColor}
              </span>
            );
          })()}
        </div>
      </div>
    )}

    {/* Card Type */}
    {(cardInfo.lorcana_card_type || card.lorcana_card_type) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Type</p>
        <p className="text-lg font-bold text-gray-900">
          {cardInfo.lorcana_card_type || card.lorcana_card_type}
        </p>
      </div>
    )}

    {/* Ink Cost */}
    {(cardInfo.ink_cost || card.ink_cost) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Ink Cost</p>
        <p className="text-lg font-bold text-purple-700">
          {cardInfo.ink_cost || card.ink_cost}
        </p>
      </div>
    )}

    {/* Strength (Characters) */}
    {(cardInfo.strength || card.strength) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">⚔️ Strength</p>
        <p className="text-lg font-bold text-red-700">
          {cardInfo.strength || card.strength}
        </p>
      </div>
    )}

    {/* Willpower (Characters/Locations) */}
    {(cardInfo.willpower || card.willpower) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">🛡️ Willpower</p>
        <p className="text-lg font-bold text-blue-700">
          {cardInfo.willpower || card.willpower}
        </p>
      </div>
    )}

    {/* Lore Value (Characters) */}
    {(cardInfo.lore_value || cardInfo.quest_value || card.lore_value) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">⭐ Lore Value</p>
        <p className="text-lg font-bold text-yellow-700">
          {cardInfo.lore_value || cardInfo.quest_value || card.lore_value}
        </p>
      </div>
    )}

    {/* Inkwell Badge */}
    {(cardInfo.inkwell || card.inkwell) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Inkwell</p>
        <span className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-sm font-bold">
          💧 Inkable
        </span>
      </div>
    )}

    {/* Classifications */}
    {(cardInfo.classifications || card.classifications) && (
      <div className="col-span-2">
        <p className="text-sm font-semibold text-gray-600 mb-1">Classifications</p>
        <div className="flex flex-wrap gap-2">
          {(cardInfo.classifications || card.classifications).map((classification: string, idx: number) => (
            <span
              key={idx}
              className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold"
            >
              {classification}
            </span>
          ))}
        </div>
      </div>
    )}

    {/* Set/Expansion */}
    {(() => {
      const setName = (cardInfo.set_name && cardInfo.set_name !== 'null') ? cardInfo.set_name : card.card_set || 'Unknown Set';
      return setName !== 'Unknown Set' && (
        <div>
          <p className="text-sm font-semibold text-gray-600 mb-1">Set</p>
          <p className="text-lg text-gray-900">{setName}</p>
          {(cardInfo.expansion_code || card.expansion_code) && (
            <p className="text-xs text-gray-500 font-mono mt-0.5">
              [{cardInfo.expansion_code || card.expansion_code}]
            </p>
          )}
        </div>
      );
    })()}

    {/* Card Number */}
    {(cardInfo.card_number || card.card_number) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Card Number</p>
        <p className="text-lg text-gray-900 font-mono">
          {cardInfo.card_number || card.card_number}
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

    {/* Franchise */}
    {(cardInfo.franchise || card.franchise) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Franchise</p>
        <p className="text-lg text-gray-900">
          {cardInfo.franchise || card.franchise}
        </p>
      </div>
    )}

    {/* Enchanted Badge */}
    {(cardInfo.is_enchanted || card.is_enchanted) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Variant</p>
        <span className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 text-white rounded-lg text-sm font-bold shadow-md">
          ✨ Enchanted
        </span>
      </div>
    )}

    {/* Foil Badge */}
    {(cardInfo.is_foil || card.is_foil) && !(cardInfo.is_enchanted || card.is_enchanted) && (
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">Finish</p>
        <span className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-blue-400 to-purple-400 text-white rounded-lg text-sm font-bold">
          💎 Foil
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

---

## 8. Collection Page Updates

### 8.1 Update Main Collection Page

**File:** `src/app/collection/page.tsx`

**Add Lorcana tab:**

```typescript
const categories = [
  { id: 'all', label: 'All Cards', icon: '🎴' },
  { id: 'Sports', label: 'Sports', icon: '⚾' },
  { id: 'Pokemon', label: 'Pokemon', icon: '⚡' },
  { id: 'MTG', label: 'Magic', icon: '🎴' },
  { id: 'Lorcana', label: 'Lorcana', icon: '✨' }, // NEW
  { id: 'Other', label: 'Other', icon: '🃏' }
];
```

### 8.2 Add Lorcana-Specific Filters

```typescript
{selectedCategory === 'Lorcana' && (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
    {/* Ink Color Filter */}
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">Ink Color</label>
      <select className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
        <option value="">All Colors</option>
        <option value="Amber">🟡 Amber</option>
        <option value="Amethyst">🟣 Amethyst</option>
        <option value="Emerald">🟢 Emerald</option>
        <option value="Ruby">🔴 Ruby</option>
        <option value="Sapphire">🔵 Sapphire</option>
        <option value="Steel">⚫ Steel</option>
      </select>
    </div>

    {/* Card Type Filter */}
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
      <select className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
        <option value="">All Types</option>
        <option value="Character">Character</option>
        <option value="Action">Action</option>
        <option value="Item">Item</option>
        <option value="Location">Location</option>
        <option value="Song">Song</option>
      </select>
    </div>

    {/* Variant Filter */}
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">Variant</label>
      <select className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
        <option value="">All Variants</option>
        <option value="enchanted">Enchanted Only</option>
        <option value="foil">Foil Only</option>
        <option value="normal">Normal Only</option>
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
        <option value="Super Rare">Super Rare</option>
        <option value="Legendary">Legendary</option>
        <option value="Enchanted">Enchanted</option>
      </select>
    </div>
  </div>
)}
```

---

## 9. External API Integration

### 9.1 Future: Lorcana API

**Note:** As of 2024, there is no official Ravensburger API for Lorcana.

**Potential future integration:**
- Dreamborn.ink API (community-maintained)
- Official Ravensburger API (when/if released)
- TCGPlayer API (Lorcana category)

**Placeholder file:** `src/lib/lorcanaApi.ts`

```typescript
/**
 * Lorcana API Integration (PLACEHOLDER)
 *
 * This file is prepared for future Lorcana API integration.
 * As of 2024, no official API exists.
 *
 * Potential APIs:
 * - Dreamborn.ink (community database)
 * - Official Ravensburger API (future)
 * - TCGPlayer API (Lorcana category)
 */

interface LorcanaCard {
  id: string;
  name: string;
  version: string;
  set: string;
  set_name: string;
  card_number: string;
  rarity: string;
  ink_color: string;
  type: string;
  // ... etc
}

interface LorcanaLookupResult {
  success: boolean;
  set_name?: string;
  set_code?: string;
  card_number?: string;
  rarity?: string;
  error?: string;
}

export async function lookupLorcanaCard(
  cardNumber?: string,
  cardName?: string,
  setCode?: string
): Promise<LorcanaLookupResult> {
  // TODO: Implement when API becomes available
  console.log('[Lorcana API] Lookup not yet implemented - waiting for official API');

  return {
    success: false,
    error: 'Lorcana API not yet available'
  };
}
```

---

## 10. Marketplace Integration

### 10.1 Update TCGPlayer Utils for Lorcana

**File:** `src/lib/tcgplayerUtils.ts`

**Add Lorcana category handling:**

```typescript
export function generateTCGPlayerSearchUrl(cardData: CardData): string {
  const searchParts: string[] = [];

  // For Lorcana cards
  if (cardData.category === 'Lorcana') {
    // Character name (base name)
    if (cardData.featured) {
      searchParts.push(cardData.featured);
    }

    // Character version (e.g., "Brave Little Tailor")
    if (cardData.character_version) {
      searchParts.push(cardData.character_version);
    }

    // Set code if available
    if (cardData.expansion_code) {
      searchParts.push(cardData.expansion_code);
    }

    // Card number
    if (cardData.card_number) {
      searchParts.push(cardData.card_number);
    }

    // Enchanted indicator (CRITICAL for pricing)
    if (cardData.is_enchanted) {
      searchParts.push('Enchanted');
    } else if (cardData.is_foil) {
      searchParts.push('Foil');
    }

    const query = encodeURIComponent(searchParts.join(' '));
    return `https://www.tcgplayer.com/search/lorcana/product?q=${query}&view=grid&productTypeName=Cards`;
  }

  // ... (existing Pokemon/Sports/MTG logic)
}
```

---

### 10.2 Create Lorcana eBay Utils

**File:** `src/lib/ebayUtils.ts`

**Add Lorcana-specific functions:**

```typescript
/**
 * Generate eBay search URL for Lorcana cards (optimized for accurate search)
 * Priority: Character Name + Version + Set > Card Number > Enchanted Status
 */
export function generateLorcanaEbaySearchUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Character name (REQUIRED - most important)
  if (cardData.card_name) {
    searchTerms.push(cardData.card_name);
  } else if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Character version (CRITICAL for Lorcana - same character has many versions)
  if (cardData.character_version && !searchTerms[0]?.includes(cardData.character_version)) {
    searchTerms.push(cardData.character_version);
  }

  // 3. Set name (helps narrow results)
  if (cardData.card_set && cardData.card_set !== 'Unknown') {
    searchTerms.push(cardData.card_set);
  } else if (cardData.expansion_code) {
    searchTerms.push(cardData.expansion_code);
  }

  // 4. Card number
  if (cardData.card_number) {
    searchTerms.push(cardData.card_number);
  }

  // 5. Variant indicator (IMPORTANT - huge price difference)
  if (cardData.is_enchanted) {
    searchTerms.push('Enchanted');
  } else if (cardData.is_foil) {
    searchTerms.push('Foil');
  }

  // 6. Condition hint based on grade
  if (cardData.dcm_grade_whole) {
    if (cardData.dcm_grade_whole >= 9) {
      searchTerms.push('NM'); // Near Mint
    } else if (cardData.dcm_grade_whole >= 7) {
      searchTerms.push('LP'); // Lightly Played
    }
  }

  const searchQuery = searchTerms.join(' ');

  // eBay search URL with Lorcana category
  const baseUrl = 'https://www.ebay.com/sch/i.html';
  const params = new URLSearchParams({
    _nkw: searchQuery,
    _sacat: '183454', // Disney Lorcana TCG category
    LH_TitleDesc: '0', // Search title only
    _udlo: '1', // Minimum price $1
    _sop: '16', // Sort by: Best Match
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate eBay sold listings URL for Lorcana cards
 * Shows completed sales for pricing reference
 */
export function generateLorcanaEbaySoldListingsUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // Same search logic as above
  if (cardData.card_name) {
    searchTerms.push(cardData.card_name);
  } else if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  if (cardData.character_version && !searchTerms[0]?.includes(cardData.character_version)) {
    searchTerms.push(cardData.character_version);
  }

  if (cardData.card_set && cardData.card_set !== 'Unknown') {
    searchTerms.push(cardData.card_set);
  } else if (cardData.expansion_code) {
    searchTerms.push(cardData.expansion_code);
  }

  if (cardData.card_number) {
    searchTerms.push(cardData.card_number);
  }

  if (cardData.is_enchanted) {
    searchTerms.push('Enchanted');
  } else if (cardData.is_foil) {
    searchTerms.push('Foil');
  }

  const searchQuery = searchTerms.join(' ');

  const baseUrl = 'https://www.ebay.com/sch/i.html';
  const params = new URLSearchParams({
    _nkw: searchQuery,
    _sacat: '183454', // Disney Lorcana TCG category
    LH_Sold: '1', // Sold listings only
    LH_Complete: '1', // Completed listings
    _udlo: '1', // Minimum price $1
    _sop: '13', // Sort by: Price + Shipping: lowest first
  });

  return `${baseUrl}?${params.toString()}`;
}
```

---

### 10.3 CRITICAL: Comprehensive Marketplace Data Passing

**In CardDetailClient.tsx around line 4370:**

```tsx
{/* Marketplace Links Section */}
<div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 p-6 mb-6">
  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
    <span>💰</span> Market Price Lookup
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

    {/* ✅ CRITICAL: Pass ALL relevant data */}
    {/* TCGPlayer */}
    <a
      href={generateTCGPlayerSearchUrl({
        category: 'Lorcana',
        card_name: extractEnglishForSearch(cardInfo.card_name) || extractEnglishForSearch(card.card_name),
        featured: extractEnglishForSearch(cardInfo.player_or_character) || extractEnglishForSearch(card.featured),
        character_version: extractEnglishForSearch(cardInfo.character_version) || extractEnglishForSearch(card.character_version),
        card_set: extractEnglishForSearch(cardInfo.set_name) || extractEnglishForSearch(card.card_set),
        card_number: cardInfo.card_number || card.card_number,
        expansion_code: cardInfo.expansion_code || card.expansion_code,
        is_enchanted: cardInfo.is_enchanted || card.is_enchanted,
        is_foil: cardInfo.is_foil || card.is_foil
      } as CardData)}
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

    {/* eBay General Search */}
    <a
      href={generateLorcanaEbaySearchUrl({
        category: 'Lorcana',
        card_name: extractEnglishForSearch(cardInfo.card_name) || extractEnglishForSearch(card.card_name),
        featured: extractEnglishForSearch(cardInfo.player_or_character) || extractEnglishForSearch(card.featured),
        character_version: extractEnglishForSearch(cardInfo.character_version) || extractEnglishForSearch(card.character_version),
        card_set: extractEnglishForSearch(cardInfo.set_name) || extractEnglishForSearch(card.card_set),
        card_number: cardInfo.card_number || card.card_number,
        expansion_code: cardInfo.expansion_code || card.expansion_code,
        is_enchanted: cardInfo.is_enchanted || card.is_enchanted,
        is_foil: cardInfo.is_foil || card.is_foil,
        dcm_grade_whole: card.conversational_whole_grade || recommendedGrade.recommended_whole_grade
      } as CardData)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-3 bg-white hover:bg-blue-50 border-2 border-blue-300 rounded-lg px-4 py-3 transition-all"
    >
      <span className="text-2xl">🔍</span>
      <div className="text-left">
        <p className="font-bold text-gray-900 text-sm">eBay Search</p>
        <p className="text-xs text-gray-600">General Search</p>
      </div>
    </a>

    {/* eBay Sold Listings */}
    <a
      href={generateLorcanaEbaySoldListingsUrl({
        category: 'Lorcana',
        card_name: extractEnglishForSearch(cardInfo.card_name) || extractEnglishForSearch(card.card_name),
        featured: extractEnglishForSearch(cardInfo.player_or_character) || extractEnglishForSearch(card.featured),
        character_version: extractEnglishForSearch(cardInfo.character_version) || extractEnglishForSearch(card.character_version),
        card_set: extractEnglishForSearch(cardInfo.set_name) || extractEnglishForSearch(card.card_set),
        card_number: cardInfo.card_number || card.card_number,
        expansion_code: cardInfo.expansion_code || card.expansion_code,
        is_enchanted: cardInfo.is_enchanted || card.is_enchanted,
        is_foil: cardInfo.is_foil || card.is_foil,
        dcm_grade_whole: card.conversational_whole_grade || recommendedGrade.recommended_whole_grade
      } as CardData)}
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

  </div>
</div>
```

---

## 11. Testing Strategy

### 11.1 Test Card Selection

Select diverse Lorcana cards for testing:

**Common Characters:**
- Mickey Mouse - Brave Little Tailor (TFC)
- Elsa - Snow Queen (TFC)
- Stitch - Carefree Surfer (various sets)

**Rare/Legendary:**
- Maleficent - Monstrous Dragon (TFC)
- Aladdin - Prince Ali (ROF)
- Belle - Strange but Special (ITI)

**Enchanted Variants:**
- Any Enchanted card (borderless, full-art)
- Test edge wear assessment on borderless design

**Special Variants:**
- Foil variants (not Enchanted)
- Promo cards (D23, convention exclusives)
- Different ink colors (all 6 colors)

**Different Card Types:**
- Characters (most common)
- Actions
- Items
- Locations
- Songs

**Condition Variety:**
- Near Mint Enchanted (edge-sensitive)
- Lightly Played foil with curl
- Moderately Played with corner wear
- Heavily Played with surface damage

---

### 11.2 Testing Checklist

#### Phase 1: Upload & Grading
- [ ] Upload Lorcana card - front and back images
- [ ] Verify card is stored with category = "Lorcana"
- [ ] Confirm grading initiates with Lorcana prompt
- [ ] Check AI extracts Lorcana-specific fields (ink_color, strength, willpower, lore_value, inkwell)
- [ ] Verify set identification from lookup table
- [ ] Confirm grade calculation completes
- [ ] **Critical:** Verify processing_time is stored correctly (not 0.3s on page load)

#### Phase 2: Card Details Display
- [ ] Card name displays correctly
- [ ] Character version displays (e.g., "Brave Little Tailor")
- [ ] Ink color displays with colored badge
- [ ] Card type displays (Character, Action, etc.)
- [ ] Strength/Willpower displays for characters
- [ ] Lore value displays
- [ ] Ink cost displays
- [ ] Inkwell badge appears for inkable cards
- [ ] Classifications display as tags
- [ ] Expansion name and code display
- [ ] Card number displays
- [ ] Artist name displays
- [ ] Enchanted badge appears for enchanted cards
- [ ] Foil badge appears for foil cards
- [ ] All grading sections populate (centering, corners, edges, surface)
- [ ] Centering summaries display correctly
- [ ] Subgrade summaries display in all sections
- [ ] **Critical:** "Evaluated in X.Xs" does NOT appear next to Re-grade button
- [ ] **Critical:** Processing time shows correctly in Evaluation Details (e.g., "80.4s" not "0.3s")
- [ ] **Critical:** Evaluation Details has proper 2-row layout (prompt version full width)
- [ ] **Critical:** Perfect 10.0 cards do NOT mention limiting factor in summary
- [ ] **Critical:** Browser tab shows: Card Name | Set | Number | Year | Grade

#### Phase 3: PDF Report
- [ ] Download PDF report
- [ ] Verify Lorcana-specific fields appear in report
- [ ] Check centering summaries display
- [ ] Confirm all subgrade summaries display
- [ ] Verify card label shows character name + version + set + number
- [ ] **Critical:** Font sizes are readable (increased from original)
- [ ] **Critical:** Footer text is darker (not light gray)
- [ ] **Critical:** "Grade your card collection at DCMGrading.com" appears at bottom
- [ ] **Critical:** Report fits on single page

#### Phase 4: Collection Page
- [ ] Lorcana tab appears in collection (with ✨ icon)
- [ ] Lorcana cards display in grid
- [ ] Ink color filter works
- [ ] Card type filter works
- [ ] Variant filter works (Enchanted/Foil/Normal)
- [ ] Rarity filter works
- [ ] Search finds Lorcana cards by name

#### Phase 5: Marketplace Links
- [ ] TCGPlayer link opens with correct search
- [ ] eBay General Search link opens with correct search
- [ ] eBay Sold link opens with correct search
- [ ] Links work for Enchanted cards
- [ ] Links work for different character versions
- [ ] Links include character version in search
- [ ] **Critical:** All relevant data passed to marketplace functions

#### Phase 6: Edge Cases
- [ ] Foreign language card display
- [ ] Promo card handling
- [ ] Enchanted card edge wear assessment
- [ ] Foil curl detection and scoring
- [ ] Borderless card edge assessment (Enchanted)
- [ ] Cards with special promo stamps
- [ ] Different ink colors render correctly
- [ ] Songs vs Actions display correctly
- [ ] Locations with move cost

#### Phase 7: Critical Fixes Verification
- [ ] **Processing time bug:** Refresh page multiple times, verify time stays same (80s+, not 0.3s)
- [ ] **Set name bug:** Test card from set NOT in lookup table, verify no "Special Edition"
- [ ] **Limiting factor bug:** Grade perfect 10.0 card, verify summary doesn't mention limiting factor
- [ ] **Prompt type bug:** Verify Lorcana prompt loads (check logs for "lorcana_conversational_grading_v4_2.txt")
- [ ] **Frontend mapping:** Verify all Lorcana fields appear in card details
- [ ] **Metadata:** Verify browser tab title is dynamic
- [ ] **Evaluation Details:** Verify 2-row layout with proper formatting
- [ ] **PDF fonts:** Verify all text is readable
- [ ] **Marketplace data:** Verify comprehensive data in eBay/TCG URLs

---

## 12. Implementation Checklist

### 🔧 **CRITICAL: Apply All Fixes First**

#### Pre-Implementation: Update Core Files
- [ ] Update `src/lib/visionGrader.ts` with 'lorcana' type support (3 locations)
- [ ] Test visionGrader type system works

---

### Week 1: Foundation (Days 1-2)

#### Database & Migration
- [ ] Create `migrations/add_lorcana_specific_fields.sql`
- [ ] Include ALL Lorcana fields (ink_color, lorcana_card_type, character_version, inkwell, etc.)
- [ ] Run migration on development database
- [ ] Verify all new columns exist
- [ ] Test inserting sample Lorcana data

#### AI Prompt
- [ ] Copy MTG prompt (NOT Pokemon) to `prompts/lorcana_conversational_grading_v4_2.txt`
- [ ] Global find/replace (MTG → Lorcana)
- [ ] Remove MTG-specific sections
- [ ] Add Lorcana-specific sections (ink colors, card types, character stats)
- [ ] **Critical:** Add complete SET IDENTIFICATION MINI TABLE with all Lorcana sets
- [ ] **Critical:** Update PERFECT CARD HANDLING section (limiting factor = "none" for 10.0)
- [ ] **Critical:** Update summary instruction (only mention limiting factor if < 10.0)
- [ ] Update all examples to use Lorcana cards
- [ ] Update JSON schema with Lorcana fields
- [ ] Review and refine prompt
- [ ] Test prompt with sample Lorcana card

---

### Week 1: Core Functionality (Days 3-5)

#### API Route
- [ ] Copy MTG route (NOT Pokemon) to `src/app/api/lorcana/[id]/route.ts`
- [ ] Global find/replace
- [ ] Update `extractLorcanaFieldsFromConversational()` function with ALL fields
- [ ] **Critical:** Fix processing_time for cached cards (use `card.processing_time`, not `Date.now() - startTime`)
- [ ] Update field mappings in database save
- [ ] Update cached data parsing
- [ ] Update category filter to "Lorcana"
- [ ] Test route with Postman/Thunder Client
- [ ] **Critical:** Verify processing_time saves correctly during grading
- [ ] **Critical:** Verify processing_time returns correctly on refresh

#### Upload Page
- [ ] Create `src/app/lorcana/upload/` directory
- [ ] Copy MTG upload to `page.tsx`
- [ ] Update branding and text (Disney Lorcana)
- [ ] Update category to "Lorcana"
- [ ] Update photo tips for Lorcana cards
- [ ] Add Lorcana-specific validation
- [ ] Update icon to ✨
- [ ] Test upload flow end-to-end

---

### Week 2: Display & Polish (Days 6-8)

#### Card Details Page - Server Component
- [ ] Create `src/app/lorcana/[id]/` directory
- [ ] Create server component `page.tsx`
- [ ] **Critical:** Implement dynamic metadata (card name | set | number | year | grade)
- [ ] Copy metadata logic from MTG (includes all fixes)
- [ ] Test browser tab title updates dynamically

#### Card Details Page - Client Component
- [ ] Create client component `CardDetailClient.tsx`
- [ ] Copy MTG card detail structure (has all fixes)
- [ ] **Critical:** Map ALL Lorcana-specific fields in cardInfo object
- [ ] Build Lorcana card info section with ink color badges
- [ ] Add character stat displays (strength, willpower, lore)
- [ ] Add inkwell badge
- [ ] Add classifications tags
- [ ] Add enchanted/foil badges with gradients
- [ ] **Critical:** Remove "Evaluated in X.Xs" text next to Re-grade button
- [ ] **Critical:** Add Evaluation Details section with 2-row layout
- [ ] **Critical:** Add Processing Time to Evaluation Details
- [ ] Test with various card types
- [ ] Test with Enchanted cards
- [ ] Test with different ink colors

#### Collection Page
- [ ] Add Lorcana tab to collection page (with ✨ icon)
- [ ] Create Lorcana-specific filters (ink color, type, variant, rarity)
- [ ] Implement filter logic
- [ ] Test filtering functionality
- [ ] Update card grid display for Lorcana

#### Marketplace Integration
- [ ] Update `tcgplayerUtils.ts` for Lorcana
- [ ] Create `generateLorcanaEbaySearchUrl()` in `ebayUtils.ts`
- [ ] Create `generateLorcanaEbaySoldListingsUrl()` in `ebayUtils.ts`
- [ ] **Critical:** Pass ALL relevant data to marketplace functions (category, character_version, is_enchanted, etc.)
- [ ] Test all marketplace links
- [ ] Verify links work with Enchanted cards
- [ ] Verify links include character version

---

### Week 2: Testing & Refinement (Days 9-10)

#### Comprehensive Testing
- [ ] Upload 10+ diverse Lorcana cards
- [ ] Test all ink colors (Amber, Amethyst, Emerald, Ruby, Sapphire, Steel)
- [ ] Test all card types (Character, Action, Item, Location, Song)
- [ ] Test Enchanted cards (edge wear assessment)
- [ ] Test foil cards (curl assessment)
- [ ] Test different rarities
- [ ] Test promo cards
- [ ] Verify all grading sections populate
- [ ] Verify PDF reports generate correctly
- [ ] Test marketplace links with various cards
- [ ] Test collection filters

#### Critical Fixes Verification
- [ ] **Processing Time Test:** Grade card, note time (e.g., 80s), refresh page 5x, verify time stays 80s (not 0.3s)
- [ ] **Set Name Test:** Mock card with unknown set code "XYZ", verify expansion_code="XYZ" and set_name=null (NOT "Special Edition")
- [ ] **Perfect Card Test:** Grade perfect 10.0 card, verify summary doesn't say "limiting factor is..."
- [ ] **Prompt Type Test:** Check logs during grading, verify "lorcana_conversational_grading_v4_2.txt" loads
- [ ] **Frontend Mapping Test:** Check card details, verify ALL Lorcana fields display
- [ ] **Metadata Test:** Check browser tab, verify dynamic title with card name/set/grade
- [ ] **Evaluation Details Test:** Verify prompt version on first row, date/time on second row
- [ ] **PDF Test:** Download report, verify fonts readable, footer darker, CTA present
- [ ] **Marketplace Test:** Check eBay URL in browser address bar, verify all params present

#### Bug Fixes & Polish
- [ ] Fix any UI issues
- [ ] Refine prompt based on AI performance
- [ ] Adjust field mappings if needed
- [ ] Add loading states
- [ ] Add error messages
- [ ] Optimize image uploads for Enchanted cards (high-res needed)

#### Documentation
- [ ] Create `LORCANA_GRADING_QUICK_START.md`
- [ ] Document Lorcana-specific fields
- [ ] Document all critical fixes applied
- [ ] Update main README with Lorcana section
- [ ] Create troubleshooting guide for common issues
- [ ] Document differences between Lorcana and MTG implementations

---

## 13. File Structure Summary

```
card-grading-app/
├── prompts/
│   └── lorcana_conversational_grading_v4_2.txt (NEW - copy from MTG, not Pokemon)
├── migrations/
│   └── add_lorcana_specific_fields.sql (NEW)
├── src/
│   ├── lib/
│   │   ├── visionGrader.ts (UPDATE - add 'lorcana' type support)
│   │   ├── lorcanaApi.ts (NEW - placeholder for future)
│   │   ├── tcgplayerUtils.ts (UPDATE)
│   │   └── ebayUtils.ts (UPDATE - add Lorcana functions)
│   ├── app/
│   │   ├── api/
│   │   │   └── lorcana/
│   │   │       └── [id]/
│   │   │           └── route.ts (NEW - COPY FROM MTG)
│   │   ├── lorcana/
│   │   │   ├── upload/
│   │   │   │   └── page.tsx (NEW)
│   │   │   └── [id]/
│   │   │       ├── page.tsx (NEW - with dynamic metadata)
│   │   │       └── CardDetailClient.tsx (NEW - with all fixes)
│   │   └── collection/
│   │       └── page.tsx (UPDATE - add Lorcana tab)
│   └── components/
│       └── reports/
│           ├── ReportStyles.ts (ALREADY UPDATED - has font/color fixes)
│           └── CardGradingReport.tsx (ALREADY UPDATED - has CTA)
└── docs/
    └── LORCANA_GRADING_QUICK_START.md (NEW)
```

---

## 14. Success Criteria

### Minimum Viable Product (MVP)
- ✅ Lorcana cards can be uploaded with front/back images
- ✅ AI correctly grades Lorcana cards using Lorcana-specific prompt
- ✅ Lorcana-specific fields extract and display (ink_color, strength, willpower, lore_value, inkwell)
- ✅ Card details page displays all Lorcana information
- ✅ PDF report generates with Lorcana data
- ✅ Collection page shows Lorcana cards with filters
- ✅ Marketplace links work (TCGPlayer, eBay)
- ✅ **All critical fixes implemented and verified**

### Full Feature Set
- ✅ All MVP criteria met
- ✅ Enchanted cards detected and graded with borderless edge assessment
- ✅ Foil cards graded with foil-specific defects
- ✅ Different ink colors display with colored badges
- ✅ All card types handled (Character, Action, Item, Location, Song)
- ✅ All subgrade summaries display correctly
- ✅ Error handling for edge cases
- ✅ **All 10 critical fixes verified working**
- ✅ Comprehensive documentation

---

## 15. Risk Mitigation

### Potential Issues & Solutions

**Issue 1: No Official Lorcana API**
- Solution: Use comprehensive set lookup table in prompt, prepare placeholder for future API

**Issue 2: Enchanted Cards Edge Wear**
- Solution: Add specific borderless assessment in prompt, note that edges are more visible

**Issue 3: Character Version Confusion**
- Solution: Always include character version in search terms, display prominently

**Issue 4: Ink Color Misidentification**
- Solution: Clear instructions in prompt about ink splash location (top-left corner)

**Issue 5: Foil Curl on Lorcana Cards**
- Solution: Add specific foil curl assessment, note as manufacturing issue

**Issue 6: Processing Time Bug Recurrence**
- Solution: **CRITICAL** - Triple-check cached card return uses `card.processing_time`, not recalculated value

**Issue 7: Set Name "Special Edition" Bug**
- Solution: **CRITICAL** - Include ALL Lorcana sets in lookup table, add explicit rule against making up names

**Issue 8: Limiting Factor for Perfect Cards**
- Solution: **CRITICAL** - Use "none" for 10.0 cards, update summary instruction

---

## 16. Timeline Summary

| Phase | Duration | Deliverables |
|---|---|---|
| **Planning & Setup** | 0.5 days | Database migration, visionGrader.ts updates, file structure |
| **Prompt Creation** | 1.5 days | Lorcana-specific prompt with ALL fixes, examples, testing |
| **API Route** | 1 day | Lorcana route, field extraction, processing_time fix |
| **Upload Page** | 0.5 days | Upload UI, validation, flow testing |
| **Card Details** | 2 days | Display components, metadata, all critical fixes |
| **Collection & Marketplace** | 0.5 days | Filters, marketplace links with comprehensive data |
| **Testing & Verification** | 2 days | Comprehensive testing, ALL critical fixes verification |
| **Documentation** | 0.5 days | Guides, troubleshooting, README, fix documentation |
| **TOTAL** | **8-9 days** | Full Lorcana grading system with all fixes |

---

## 17. Next Steps

1. **Review this plan** and confirm approach
2. **Prioritize critical fixes** - These MUST be implemented first
3. **Update visionGrader.ts** before creating any new files
4. **Set up development environment** for Lorcana testing
5. **Gather test cards** (physical or images) covering all card types and variants
6. **Begin implementation** following checklist order
7. **Verify each critical fix** during testing phase
8. **Document any additional findings** for future card types

---

## 18. Critical Fixes Checklist (Apply First!)

Before implementing Lorcana, verify these fixes are ready:

### ✅ Already Fixed (Verify Working)
- [ ] `visionGrader.ts` type system ready for 'lorcana'
- [ ] PDF report fonts increased
- [ ] PDF footer colors darker
- [ ] PDF CTA added ("Grade your card collection...")
- [ ] `ReportStyles.ts` updated

### 🔧 Must Implement for Lorcana
- [ ] Processing time fix in API route (cached cards)
- [ ] Set lookup table with ALL Lorcana sets
- [ ] Perfect card limiting factor fix ("none" for 10.0)
- [ ] Frontend card info mapping (ALL fields)
- [ ] Dynamic metadata in page.tsx
- [ ] Evaluation Details 2-row layout
- [ ] Remove "Evaluated in" text from top
- [ ] Comprehensive marketplace data passing

---

## Conclusion

This comprehensive plan builds a Disney Lorcana grading system that incorporates **all lessons learned** from the MTG implementation and **all critical fixes** discovered on 2025-01-11.

By implementing these fixes from day one, we avoid:
- Processing time showing 0.3s instead of 80s+
- AI making up "Special Edition" set names
- Perfect 10.0 cards mentioning limiting factors
- Missing Lorcana-specific fields in frontend
- Generic browser tab titles
- Hard-to-read PDF reports
- Missing marketplace data in search URLs

This plan provides a clear roadmap from concept to production-ready Lorcana grading system, with all known bugs prevented from the start.

---

**Document Version:** 1.0
**Created:** 2025-01-11
**Based On:** MTG Implementation + Critical Fixes from 2025-01-11
**Status:** ✅ READY FOR REVIEW AND IMPLEMENTATION
