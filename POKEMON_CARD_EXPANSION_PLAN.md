# Pokemon Card Expansion - Implementation Plan
**Date**: 2025-10-19
**Status**: Planning Phase
**Goal**: Add Pokemon as a card category alongside Sports and Other, with Pokemon-specific metadata and rarity scale

---

## Table of Contents
1. [Overview](#overview)
2. [Pokemon Card Metadata Requirements](#pokemon-card-metadata-requirements)
3. [Pokemon Rarity Scale](#pokemon-rarity-scale)
4. [Database Schema Changes](#database-schema-changes)
5. [Frontend UI Updates](#frontend-ui-updates)
6. [API Route Modifications](#api-route-modifications)
7. [Card Information Fetching](#card-information-fetching)
8. [Grading Methodology Adjustments](#grading-methodology-adjustments)
9. [Testing Checklist](#testing-checklist)
10. [Implementation Timeline](#implementation-timeline)

---

## Overview

### Current System State
- **Supported Categories**: Sports cards, Other cards
- **Grading Methodology**: LLM-based (GPT-4o Vision) with enhanced edge/surface defect detection
- **Frontend**: Next.js 15 with TypeScript
- **Database**: Supabase
- **Card Details**: Sport-specific (player name, team, year, manufacturer, card number)

### Target System State
- **Supported Categories**: Sports cards, Pokemon cards, Other cards
- **Grading Methodology**: Same LLM-based approach (no changes to core grading)
- **Card Details**:
  - Sports: Existing fields (player, team, year, etc.)
  - Pokemon: Pokemon-specific fields (Pokemon name, set, card number, rarity, type, HP, etc.)
  - Other: Generic fields

### Design Principles
1. **Maintain Existing Functionality**: Sports card grading continues unchanged
2. **Reuse Grading System**: Pokemon cards use same grading methodology/prompts
3. **Modular Architecture**: Pokemon-specific logic isolated from sports logic
4. **Consistent UI/UX**: Similar user experience across all card types
5. **Extensible Design**: Easy to add more card types in the future (Yu-Gi-Oh, Magic, etc.)

---

## Pokemon Card Metadata Requirements

### Essential Pokemon Card Information

**What collectors need to see on every Pokemon card:**

1. **Pokemon Name** (e.g., "Charizard")
   - The featured Pokemon on the card
   - Critical for identification and value

2. **Set Name** (e.g., "Base Set", "Vivid Voltage", "Crown Zenith")
   - The expansion/set the card belongs to
   - Major factor in card value and collectibility

3. **Card Number** (e.g., "4/102", "25/100")
   - Format: `[card number]/[total cards in set]`
   - Example: "4/102" means card #4 out of 102 cards in the set
   - Essential for identification

4. **Rarity** (e.g., "Rare Holo", "Ultra Rare", "Secret Rare")
   - Pokemon-specific rarity system (see detailed scale below)
   - Directly impacts card value

5. **Card Type** (e.g., "Pokemon", "Trainer", "Energy")
   - Pokemon: Pokemon creature cards
   - Trainer: Supporter/Item/Stadium cards
   - Energy: Energy cards (less commonly graded)

6. **Pokemon Type** (e.g., "Fire", "Water", "Psychic") *(if applicable)*
   - Only for Pokemon-type cards
   - Example: Charizard = Fire type

7. **HP (Hit Points)** (e.g., "120 HP") *(if applicable)*
   - Only for Pokemon-type cards
   - Displayed on card

8. **Year/Release Date** (e.g., "1999", "2023")
   - Year the set was released
   - Important for vintage vs. modern distinction

9. **Finish Type** (e.g., "Holo", "Reverse Holo", "Non-Holo")
   - Holo: Holographic foil on Pokemon illustration
   - Reverse Holo: Holographic background, non-holo illustration
   - Non-Holo: No holographic elements
   - Critical for value (holo versions worth more)

10. **Special Designations** *(optional but valuable)*
    - First Edition (stamp on left side of card)
    - Shadowless (early Base Set cards without shadow on card frame)
    - Promo (promotional cards)
    - Error/Misprint (known printing errors)

### Metadata Priority
**High Priority (Must Have)**:
- Pokemon Name
- Set Name
- Card Number
- Rarity
- Card Type

**Medium Priority (Should Have)**:
- Pokemon Type
- HP
- Year
- Finish Type

**Low Priority (Nice to Have)**:
- Special Designations
- Artist name
- Set symbol/icon

---

## Pokemon Rarity Scale

### Official Pokemon TCG Rarity System

Pokemon cards use a **completely different rarity system** than sports cards. Here's the comprehensive Pokemon rarity scale:

#### Rarity Categories (from Common to Rarest)

**Tier 1: Common Cards**
1. **Common (C)**
   - Symbol: Solid black circle
   - Description: Basic cards, most frequently pulled
   - Example: Basic Energy cards, common Pokemon
   - Market Value: $0.10 - $1

**Tier 2: Uncommon Cards**
2. **Uncommon (UC)**
   - Symbol: Solid black diamond
   - Description: Less common than Common, but still readily available
   - Example: Evolution Pokemon, Trainer cards
   - Market Value: $0.25 - $2

**Tier 3: Rare Cards**
3. **Rare (R)**
   - Symbol: Solid black star
   - Description: One rare per booster pack (non-holo)
   - Example: Non-holo rare Pokemon
   - Market Value: $0.50 - $5

4. **Rare Holo (RH)**
   - Symbol: Solid black star (holographic card)
   - Description: Holographic rare card
   - Example: Holo rare Pokemon with foil illustration
   - Market Value: $2 - $20

**Tier 4: Ultra Rare Cards**
5. **Reverse Holo**
   - Description: Any common/uncommon/rare with reverse holographic pattern
   - Background is holo, illustration is not
   - Market Value: +50% to +200% of non-holo version

6. **EX / GX / V / VMAX / VSTAR**
   - Description: Special mechanic cards (varies by era)
   - EX (2013-2016), GX (2017-2019), V/VMAX (2020-2022), VSTAR (2022+)
   - Market Value: $5 - $50

7. **Full Art (FA)**
   - Description: Card with illustration extending to full card borders
   - Example: Full Art Trainer Supporters, Full Art Pokemon V
   - Market Value: $10 - $100

8. **Rainbow Rare (RR)**
   - Description: Full Art cards with rainbow holographic pattern
   - Highly sought after
   - Market Value: $20 - $200

**Tier 5: Secret Rare Cards**
9. **Secret Rare (SR)**
   - Symbol: Card number exceeds set total (e.g., "103/102")
   - Description: Ultra-rare cards with special treatments
   - Types:
     * Gold cards (golden finish)
     * Rainbow rares
     * Alternate art cards
   - Market Value: $30 - $500+

10. **Special Illustration Rare (SIR) / Alternate Art (AA)**
    - Description: Ultra-rare cards with unique, artistic illustrations
    - Recent addition to Pokemon TCG (2022+)
    - Market Value: $50 - $1,000+

**Tier 6: Chase/Grail Cards**
11. **Hyper Rare**
    - Description: Rainbow variants of VMAX/VSTAR cards
    - Card number exceeds set total
    - Market Value: $100 - $1,000+

12. **Illustration Rare (IR) / Special Art Rare (SAR)**
    - Description: Ultra-rare cards with unique artistic styles
    - Introduced in Scarlet & Violet era (2023+)
    - Market Value: $100 - $2,000+

13. **Promotional Cards (PROMO)**
    - Description: Cards distributed outside booster packs
    - Examples: Pokemon Center exclusives, tournament prizes, event promos
    - Rarity varies (some promos extremely rare)
    - Market Value: $1 - $10,000+ (depending on promo)

### Era-Specific Rarities

**Vintage Era (1999-2002)**
- Common, Uncommon, Rare, Rare Holo
- **First Edition** (significant value multiplier, 2x-10x base value)
- **Shadowless** (Base Set only, 1.5x-3x value)

**EX Era (2003-2007)**
- Pokemon-ex (ultra rare)
- Pokemon Star (gold star, extremely rare)

**Modern Era (2020-Present)**
- V, VMAX, VSTAR
- Full Art, Rainbow Rare
- Alternate Art, Special Illustration Rare
- Trainer Gallery subset

### Rarity Database Field Design

**Proposed Database Field**: `rarity` (TEXT)

**Standard Values**:
- `"Common"`
- `"Uncommon"`
- `"Rare"`
- `"Rare Holo"`
- `"Reverse Holo"`
- `"V"` / `"VMAX"` / `"VSTAR"`
- `"EX"` / `"GX"`
- `"Full Art"`
- `"Rainbow Rare"`
- `"Secret Rare"`
- `"Hyper Rare"`
- `"Special Illustration Rare"`
- `"Alternate Art"`
- `"Promo"`
- `"First Edition Holo"` (for vintage)

**Additional Boolean Flags** (optional):
- `is_first_edition` (BOOLEAN)
- `is_shadowless` (BOOLEAN)
- `is_reverse_holo` (BOOLEAN)

### Rarity Impact on Grading Value

**Important**: Pokemon rarity directly affects graded card value in ways that differ from sports cards:

- **Common graded card**: Rarely worth grading unless PSA 10
- **Rare Holo**: Worth grading if PSA 9+
- **Ultra Rare (V/VMAX/Full Art)**: Worth grading if PSA 8+
- **Secret Rare / Rainbow Rare**: Worth grading even at PSA 7-8
- **Vintage Holo (Base Set Charizard, etc.)**: Worth grading at any grade

**Recommendation**: Display rarity prominently on grading results page to help users understand card value context.

---

## Database Schema Changes

### Step 1: Add Pokemon-Specific Columns to `cards` Table

**File to create**: `migrations/add_pokemon_card_fields.sql`

```sql
-- Add Pokemon-specific columns to cards table
-- Date: 2025-10-19
-- Purpose: Support Pokemon card category with Pokemon-specific metadata

ALTER TABLE cards
ADD COLUMN IF NOT EXISTS pokemon_name TEXT,
ADD COLUMN IF NOT EXISTS pokemon_set TEXT,
ADD COLUMN IF NOT EXISTS set_card_number TEXT, -- Format: "4/102"
ADD COLUMN IF NOT EXISTS pokemon_rarity TEXT,
ADD COLUMN IF NOT EXISTS pokemon_type TEXT, -- Fire, Water, Grass, etc.
ADD COLUMN IF NOT EXISTS pokemon_hp INTEGER,
ADD COLUMN IF NOT EXISTS finish_type TEXT, -- Holo, Reverse Holo, Non-Holo
ADD COLUMN IF NOT EXISTS is_first_edition BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_shadowless BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS special_designation TEXT; -- Promo, Error, etc.

-- Add index on pokemon_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_cards_pokemon_name ON cards(pokemon_name);

-- Add index on pokemon_set for filtering by set
CREATE INDEX IF NOT EXISTS idx_cards_pokemon_set ON cards(pokemon_set);

-- Add index on pokemon_rarity for value estimation queries
CREATE INDEX IF NOT EXISTS idx_cards_pokemon_rarity ON cards(pokemon_rarity);

-- Add comment to document Pokemon fields
COMMENT ON COLUMN cards.pokemon_name IS 'Pokemon name (e.g., Charizard) - only populated for card_type=pokemon';
COMMENT ON COLUMN cards.pokemon_set IS 'Pokemon set name (e.g., Base Set, Vivid Voltage) - only for card_type=pokemon';
COMMENT ON COLUMN cards.set_card_number IS 'Card number in set format (e.g., 4/102) - only for card_type=pokemon';
COMMENT ON COLUMN cards.pokemon_rarity IS 'Pokemon rarity (Common, Rare Holo, Secret Rare, etc.) - only for card_type=pokemon';
```

**Migration Script**: `run_pokemon_migration.js`

```javascript
// run_pokemon_migration.js
// Applies Pokemon card database migration

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Starting Pokemon card migration...');

  // Read SQL file
  const sql = fs.readFileSync('migrations/add_pokemon_card_fields.sql', 'utf8');

  // Execute migration
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  console.log('✅ Migration completed successfully');
  console.log('📊 Pokemon card fields added to cards table');
  console.log('📇 Indexes created for pokemon_name, pokemon_set, pokemon_rarity');
}

runMigration();
```

**Run command**:
```bash
node run_pokemon_migration.js
```

### Step 2: Update `card_type` Field Values

The existing `card_type` field should now support three values:
- `"sports"` (existing)
- `"pokemon"` (new)
- `"other"` (existing)

**No migration needed** - just update application logic to recognize `"pokemon"` as a valid type.

### Step 3: Create Pokemon Rarity Lookup Table (Optional but Recommended)

**File**: `migrations/create_pokemon_rarity_table.sql`

```sql
-- Create lookup table for Pokemon rarities with value multipliers
-- Date: 2025-10-19

CREATE TABLE IF NOT EXISTS pokemon_rarities (
  id SERIAL PRIMARY KEY,
  rarity_name TEXT UNIQUE NOT NULL,
  rarity_tier INTEGER NOT NULL, -- 1=Common, 2=Uncommon, 3=Rare, 4=Ultra, 5=Secret, 6=Grail
  description TEXT,
  typical_value_min DECIMAL(10,2), -- Minimum market value in USD
  typical_value_max DECIMAL(10,2), -- Maximum market value in USD
  grade_10_multiplier DECIMAL(5,2) DEFAULT 2.0, -- PSA 10 value multiplier
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert standard Pokemon rarities
INSERT INTO pokemon_rarities (rarity_name, rarity_tier, description, typical_value_min, typical_value_max, grade_10_multiplier) VALUES
('Common', 1, 'Basic cards, most frequently pulled', 0.10, 1.00, 1.5),
('Uncommon', 2, 'Less common than Common, still readily available', 0.25, 2.00, 1.5),
('Rare', 3, 'One rare per booster pack (non-holo)', 0.50, 5.00, 2.0),
('Rare Holo', 3, 'Holographic rare card', 2.00, 20.00, 3.0),
('Reverse Holo', 4, 'Reverse holographic pattern', 1.00, 10.00, 2.5),
('V', 4, 'Pokemon V cards (modern era)', 5.00, 50.00, 4.0),
('VMAX', 4, 'Pokemon VMAX cards', 10.00, 100.00, 5.0),
('VSTAR', 4, 'Pokemon VSTAR cards', 8.00, 80.00, 4.5),
('EX', 4, 'Pokemon-ex cards (2003-2016)', 5.00, 100.00, 6.0),
('GX', 4, 'Pokemon-GX cards (2017-2019)', 5.00, 80.00, 5.0),
('Full Art', 5, 'Full Art illustration cards', 10.00, 100.00, 6.0),
('Rainbow Rare', 5, 'Rainbow holographic Full Art', 20.00, 200.00, 8.0),
('Secret Rare', 5, 'Secret Rare cards (number exceeds set total)', 30.00, 500.00, 10.0),
('Hyper Rare', 6, 'Rainbow VMAX/VSTAR variants', 100.00, 1000.00, 12.0),
('Special Illustration Rare', 6, 'Ultra-rare artistic illustrations', 100.00, 2000.00, 15.0),
('Alternate Art', 6, 'Alternate Art ultra-rares', 50.00, 1000.00, 10.0),
('Promo', 3, 'Promotional cards (rarity varies)', 1.00, 10000.00, 5.0),
('First Edition Holo', 6, 'First Edition holographic (vintage)', 50.00, 50000.00, 20.0);

-- Create index for fast rarity lookups
CREATE INDEX idx_pokemon_rarities_name ON pokemon_rarities(rarity_name);
```

**Purpose**: This table allows for:
- Consistent rarity naming across the app
- Estimated value ranges based on rarity
- Grade multipliers for value estimation
- Easy updates to rarity definitions without code changes

---

## Frontend UI Updates

### Step 4: Update Upload Page to Support Pokemon Card Type Selection

**File**: `src/app/upload/page.tsx`

**Changes needed**:

1. Add Pokemon option to card type selector
2. Show/hide sport-specific vs. Pokemon-specific fields based on selection
3. Add Pokemon metadata input fields

**Implementation**:

```typescript
// In src/app/upload/page.tsx

const [cardType, setCardType] = useState<'sports' | 'pokemon' | 'other'>('sports');

// Card type selector UI
<div className="mb-6">
  <label className="block text-sm font-medium mb-2">Card Type</label>
  <div className="flex gap-4">
    <button
      onClick={() => setCardType('sports')}
      className={`px-6 py-3 rounded ${cardType === 'sports' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
    >
      Sports Card
    </button>
    <button
      onClick={() => setCardType('pokemon')}
      className={`px-6 py-3 rounded ${cardType === 'pokemon' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
    >
      Pokemon Card
    </button>
    <button
      onClick={() => setCardType('other')}
      className={`px-6 py-3 rounded ${cardType === 'other' ? 'bg-gray-600 text-white' : 'bg-gray-200'}`}
    >
      Other
    </button>
  </div>
</div>

// Conditional rendering for Sports fields
{cardType === 'sports' && (
  <div className="space-y-4">
    <input
      type="text"
      placeholder="Player Name"
      value={playerName}
      onChange={(e) => setPlayerName(e.target.value)}
      className="w-full px-4 py-2 border rounded"
    />
    <input
      type="text"
      placeholder="Team"
      value={team}
      onChange={(e) => setTeam(e.target.value)}
      className="w-full px-4 py-2 border rounded"
    />
    {/* ...other sports fields... */}
  </div>
)}

// Conditional rendering for Pokemon fields
{cardType === 'pokemon' && (
  <div className="space-y-4">
    <input
      type="text"
      placeholder="Pokemon Name (e.g., Charizard)"
      value={pokemonName}
      onChange={(e) => setPokemonName(e.target.value)}
      className="w-full px-4 py-2 border rounded"
    />

    <input
      type="text"
      placeholder="Set Name (e.g., Base Set, Vivid Voltage)"
      value={pokemonSet}
      onChange={(e) => setPokemonSet(e.target.value)}
      className="w-full px-4 py-2 border rounded"
    />

    <input
      type="text"
      placeholder="Card Number (e.g., 4/102)"
      value={setCardNumber}
      onChange={(e) => setCardNumber(e.target.value)}
      className="w-full px-4 py-2 border rounded"
    />

    <select
      value={pokemonRarity}
      onChange={(e) => setPokemonRarity(e.target.value)}
      className="w-full px-4 py-2 border rounded"
    >
      <option value="">Select Rarity</option>
      <option value="Common">Common</option>
      <option value="Uncommon">Uncommon</option>
      <option value="Rare">Rare</option>
      <option value="Rare Holo">Rare Holo</option>
      <option value="Reverse Holo">Reverse Holo</option>
      <option value="V">V</option>
      <option value="VMAX">VMAX</option>
      <option value="VSTAR">VSTAR</option>
      <option value="Full Art">Full Art</option>
      <option value="Rainbow Rare">Rainbow Rare</option>
      <option value="Secret Rare">Secret Rare</option>
      <option value="Hyper Rare">Hyper Rare</option>
      <option value="Special Illustration Rare">Special Illustration Rare</option>
      <option value="Alternate Art">Alternate Art</option>
      <option value="Promo">Promo</option>
      <option value="First Edition Holo">First Edition Holo</option>
    </select>

    <select
      value={pokemonType}
      onChange={(e) => setPokemonType(e.target.value)}
      className="w-full px-4 py-2 border rounded"
    >
      <option value="">Select Type (optional)</option>
      <option value="Colorless">Colorless</option>
      <option value="Darkness">Darkness</option>
      <option value="Dragon">Dragon</option>
      <option value="Fairy">Fairy</option>
      <option value="Fighting">Fighting</option>
      <option value="Fire">Fire</option>
      <option value="Grass">Grass</option>
      <option value="Lightning">Lightning</option>
      <option value="Metal">Metal</option>
      <option value="Psychic">Psychic</option>
      <option value="Water">Water</option>
    </select>

    <input
      type="number"
      placeholder="HP (optional)"
      value={pokemonHp}
      onChange={(e) => setPokemonHp(e.target.value)}
      className="w-full px-4 py-2 border rounded"
    />

    <select
      value={finishType}
      onChange={(e) => setFinishType(e.target.value)}
      className="w-full px-4 py-2 border rounded"
    >
      <option value="">Select Finish</option>
      <option value="Non-Holo">Non-Holo</option>
      <option value="Holo">Holo</option>
      <option value="Reverse Holo">Reverse Holo</option>
    </select>

    <div className="flex gap-4">
      <label className="flex items-center">
        <input
          type="checkbox"
          checked={isFirstEdition}
          onChange={(e) => setIsFirstEdition(e.target.checked)}
          className="mr-2"
        />
        First Edition
      </label>

      <label className="flex items-center">
        <input
          type="checkbox"
          checked={isShadowless}
          onChange={(e) => setIsShadowless(e.target.checked)}
          className="mr-2"
        />
        Shadowless
      </label>
    </div>

    <input
      type="text"
      placeholder="Year (e.g., 1999, 2023)"
      value={year}
      onChange={(e) => setYear(e.target.value)}
      className="w-full px-4 py-2 border rounded"
    />
  </div>
)}
```

**State variables to add**:
```typescript
const [pokemonName, setPokemonName] = useState('');
const [pokemonSet, setPokemonSet] = useState('');
const [setCardNumber, setSetCardNumber] = useState('');
const [pokemonRarity, setPokemonRarity] = useState('');
const [pokemonType, setPokemonType] = useState('');
const [pokemonHp, setPokemonHp] = useState('');
const [finishType, setFinishType] = useState('');
const [isFirstEdition, setIsFirstEdition] = useState(false);
const [isShadowless, setIsShadowless] = useState(false);
```

### Step 5: Update Card Display Page to Show Pokemon Metadata

**File**: `src/app/card/[id]/page.tsx`

**Changes needed**: Conditionally display Pokemon metadata when `card_type === 'pokemon'`

```typescript
// In card display component

{card.card_type === 'pokemon' && (
  <div className="pokemon-details bg-red-50 p-6 rounded-lg">
    <h2 className="text-2xl font-bold mb-4">Pokemon Card Details</h2>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <span className="font-semibold">Pokemon:</span>
        <span className="ml-2">{card.pokemon_name}</span>
      </div>

      <div>
        <span className="font-semibold">Set:</span>
        <span className="ml-2">{card.pokemon_set}</span>
      </div>

      <div>
        <span className="font-semibold">Card Number:</span>
        <span className="ml-2">{card.set_card_number}</span>
      </div>

      <div>
        <span className="font-semibold">Rarity:</span>
        <span className="ml-2 px-3 py-1 bg-yellow-200 rounded font-bold">
          {card.pokemon_rarity}
        </span>
      </div>

      {card.pokemon_type && (
        <div>
          <span className="font-semibold">Type:</span>
          <span className="ml-2">{card.pokemon_type}</span>
        </div>
      )}

      {card.pokemon_hp && (
        <div>
          <span className="font-semibold">HP:</span>
          <span className="ml-2">{card.pokemon_hp}</span>
        </div>
      )}

      <div>
        <span className="font-semibold">Finish:</span>
        <span className="ml-2">{card.finish_type || 'Non-Holo'}</span>
      </div>

      {card.is_first_edition && (
        <div className="col-span-2">
          <span className="px-3 py-1 bg-gold-200 rounded font-bold">
            🏆 FIRST EDITION
          </span>
        </div>
      )}

      {card.is_shadowless && (
        <div className="col-span-2">
          <span className="px-3 py-1 bg-purple-200 rounded font-bold">
            ✨ SHADOWLESS
          </span>
        </div>
      )}
    </div>
  </div>
)}

{card.card_type === 'sports' && (
  <div className="sports-details bg-blue-50 p-6 rounded-lg">
    {/* Existing sports card display logic */}
  </div>
)}
```

### Step 6: Update Collection Page to Filter by Card Type

**File**: `src/app/collection/page.tsx`

**Changes needed**: Add filter tabs for Sports/Pokemon/Other

```typescript
// In collection page

const [filterType, setFilterType] = useState<'all' | 'sports' | 'pokemon' | 'other'>('all');

// Filter cards by type
const filteredCards = cards.filter(card => {
  if (filterType === 'all') return true;
  return card.card_type === filterType;
});

// Filter tabs UI
<div className="flex gap-2 mb-6">
  <button
    onClick={() => setFilterType('all')}
    className={`px-4 py-2 rounded ${filterType === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-200'}`}
  >
    All Cards ({cards.length})
  </button>
  <button
    onClick={() => setFilterType('sports')}
    className={`px-4 py-2 rounded ${filterType === 'sports' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
  >
    Sports ({cards.filter(c => c.card_type === 'sports').length})
  </button>
  <button
    onClick={() => setFilterType('pokemon')}
    className={`px-4 py-2 rounded ${filterType === 'pokemon' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
  >
    Pokemon ({cards.filter(c => c.card_type === 'pokemon').length})
  </button>
  <button
    onClick={() => setFilterType('other')}
    className={`px-4 py-2 rounded ${filterType === 'other' ? 'bg-gray-600 text-white' : 'bg-gray-200'}`}
  >
    Other ({cards.filter(c => c.card_type === 'other').length})
  </button>
</div>

// Display filtered cards
{filteredCards.map(card => (
  <CardGridItem key={card.id} card={card} />
))}
```

---

## API Route Modifications

### Step 7: Update Card Creation API to Handle Pokemon Metadata

**File**: `src/app/api/card/route.ts` (or wherever card creation happens)

**Changes needed**: Accept and save Pokemon metadata fields

```typescript
// POST /api/card - Create new card with grading

export async function POST(request: Request) {
  const body = await request.json();
  const {
    frontImageUrl,
    backImageUrl,
    card_type, // 'sports' | 'pokemon' | 'other'

    // Sports fields (existing)
    player_name,
    team,
    year,
    manufacturer,
    card_number,

    // Pokemon fields (new)
    pokemon_name,
    pokemon_set,
    set_card_number,
    pokemon_rarity,
    pokemon_type,
    pokemon_hp,
    finish_type,
    is_first_edition,
    is_shadowless,
    special_designation
  } = body;

  // Build card data object based on card type
  const cardData: any = {
    card_type: card_type || 'other',
    user_id: userId,
    front_image_url: frontImageUrl,
    back_image_url: backImageUrl
  };

  // Add type-specific fields
  if (card_type === 'sports') {
    cardData.player_name = player_name;
    cardData.team = team;
    cardData.year = year;
    cardData.manufacturer = manufacturer;
    cardData.card_number = card_number;
  } else if (card_type === 'pokemon') {
    cardData.pokemon_name = pokemon_name;
    cardData.pokemon_set = pokemon_set;
    cardData.set_card_number = set_card_number;
    cardData.pokemon_rarity = pokemon_rarity;
    cardData.pokemon_type = pokemon_type;
    cardData.pokemon_hp = pokemon_hp ? parseInt(pokemon_hp) : null;
    cardData.finish_type = finish_type;
    cardData.is_first_edition = is_first_edition || false;
    cardData.is_shadowless = is_shadowless || false;
    cardData.special_designation = special_designation;
  }

  // Insert card into database
  const { data: card, error: cardError } = await supabase
    .from('cards')
    .insert([cardData])
    .select()
    .single();

  if (cardError) {
    return NextResponse.json({ error: cardError.message }, { status: 500 });
  }

  // Continue with grading process...
  // (grading logic remains unchanged - same for sports and pokemon)
}
```

---

## Card Information Fetching

### Step 8: Integrate Pokemon TCG API for Auto-Fill Card Details

**Background**: The [Pokemon TCG API](https://pokemontcg.io/) is a free, public API that provides comprehensive Pokemon card data.

**API Endpoint**: `https://api.pokemontcg.io/v2/cards`

**Example Response** for Charizard Base Set:
```json
{
  "data": [
    {
      "id": "base1-4",
      "name": "Charizard",
      "supertype": "Pokémon",
      "subtypes": ["Stage 2"],
      "hp": "120",
      "types": ["Fire"],
      "set": {
        "id": "base1",
        "name": "Base",
        "series": "Base",
        "printedTotal": 102,
        "total": 102,
        "releaseDate": "1999/01/09"
      },
      "number": "4",
      "rarity": "Rare Holo",
      "artist": "Mitsuhiro Arita",
      "images": {
        "small": "https://images.pokemontcg.io/base1/4.png",
        "large": "https://images.pokemontcg.io/base1/4_hires.png"
      }
    }
  ]
}
```

**Implementation**: Create a helper function to fetch Pokemon card details

**File**: `src/lib/pokemonTcgApi.ts` (new file)

```typescript
// src/lib/pokemonTcgApi.ts
// Pokemon TCG API integration for auto-filling card details

export interface PokemonCardData {
  name: string;
  set: string;
  cardNumber: string;
  rarity: string;
  type?: string;
  hp?: number;
  year?: string;
  imageUrl?: string;
}

export async function searchPokemonCard(query: string): Promise<PokemonCardData[]> {
  try {
    const response = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(query)}"`,
      {
        headers: {
          'X-Api-Key': process.env.POKEMON_TCG_API_KEY || '' // API key optional but recommended
        }
      }
    );

    if (!response.ok) {
      throw new Error('Pokemon TCG API request failed');
    }

    const json = await response.json();

    return json.data.map((card: any) => ({
      name: card.name,
      set: card.set.name,
      cardNumber: `${card.number}/${card.set.printedTotal}`,
      rarity: card.rarity,
      type: card.types?.[0],
      hp: card.hp ? parseInt(card.hp) : undefined,
      year: card.set.releaseDate?.split('/')[0],
      imageUrl: card.images.large
    }));
  } catch (error) {
    console.error('Error fetching Pokemon card data:', error);
    return [];
  }
}

export async function getPokemonCardBySetAndNumber(
  setId: string,
  number: string
): Promise<PokemonCardData | null> {
  try {
    const response = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=set.id:${setId} number:${number}`
    );

    if (!response.ok) return null;

    const json = await response.json();
    if (json.data.length === 0) return null;

    const card = json.data[0];
    return {
      name: card.name,
      set: card.set.name,
      cardNumber: `${card.number}/${card.set.printedTotal}`,
      rarity: card.rarity,
      type: card.types?.[0],
      hp: card.hp ? parseInt(card.hp) : undefined,
      year: card.set.releaseDate?.split('/')[0],
      imageUrl: card.images.large
    };
  } catch (error) {
    console.error('Error fetching Pokemon card:', error);
    return null;
  }
}
```

**Usage in Frontend**:
```typescript
// In upload page - add auto-complete search

const [searchResults, setSearchResults] = useState<PokemonCardData[]>([]);

async function handlePokemonSearch(query: string) {
  if (query.length < 3) return;

  const response = await fetch(`/api/pokemon/search?q=${encodeURIComponent(query)}`);
  const results = await response.json();

  setSearchResults(results);
}

// When user selects a search result, auto-fill fields
function selectPokemonCard(cardData: PokemonCardData) {
  setPokemonName(cardData.name);
  setPokemonSet(cardData.set);
  setSetCardNumber(cardData.cardNumber);
  setPokemonRarity(cardData.rarity);
  setPokemonType(cardData.type || '');
  setPokemonHp(cardData.hp?.toString() || '');
  setYear(cardData.year || '');
}
```

**API Route**: `src/app/api/pokemon/search/route.ts` (new file)

```typescript
// src/app/api/pokemon/search/route.ts
import { NextResponse } from 'next/server';
import { searchPokemonCard } from '@/lib/pokemonTcgApi';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  const results = await searchPokemonCard(query);

  return NextResponse.json(results);
}
```

---

## Grading Methodology Adjustments

### Step 9: Pokemon-Specific Grading Considerations

**Important**: The core grading methodology (edge/surface/corner defect detection) remains **IDENTICAL** for Pokemon and sports cards. Both use the same enhanced defect detection prompt.

**What changes**: Context-specific instructions for Pokemon card features

**File to update**: `prompts/card_grader_v1.txt` (optional enhancement)

**Optional addition** (add to system prompt):

```
## Pokemon Card Specific Considerations

When grading Pokemon cards, be aware of the following Pokemon-specific features:

### Holographic Patterns
- **Holo cards**: Holographic foil appears on the Pokemon illustration
  - Holo scratches are MORE VISIBLE than on non-holo surfaces
  - Grade surface defects on holo cards MORE STRICTLY (holo scratches = significant value loss)
  - Common issue: Holo scratches in center of card (Zone 5) - heavily impacts grade

- **Reverse Holo cards**: Holographic pattern on card background, not illustration
  - Check for scratches on BACKGROUND area (not just center)
  - Reverse holo scratches often appear as dark lines on shiny background

### Pokemon-Specific Print Defects
- **Holo bleed**: Holographic material extending beyond intended area (COMMON on vintage)
  - NOT a defect if consistent across print run
  - Only note if excessive/unusual

- **Cosmos holo**: Special holographic pattern (swirl/galaxy effect)
  - Pattern variation is NORMAL, not a defect

- **Off-center holo window**: Holo not aligned with illustration
  - Factory defect, note but don't double-penalize centering

### Vintage Pokemon Cards (1999-2003)
- **Shadowless cards**: Base Set cards without shadow on right side of card frame
  - Confirm shadowless status in metadata
  - NOT a defect - actually MORE VALUABLE

- **First Edition stamp**: Black "1st Edition" stamp on left side
  - Check for stamp wear/damage specifically
  - Stamp condition important for value

### Edge Considerations for Pokemon
- **Black/Dark Blue borders**: Most Pokemon cards have dark borders
  - White edge defects HIGHLY VISIBLE (easier to detect)
  - Even microscopic white dots clearly visible
  - Grade edges STRICTLY for Pokemon (white dots very common)

### Common Pokemon Card Issues
1. **Holo scratches** - Most common defect on rare/ultra-rare Pokemon cards
2. **Whitening on corners** - Especially common on vintage cards
3. **Print lines** - Horizontal lines from printing (common on modern cards, usually minor)
4. **Edge wear** - White dots on bottom edge (very common from pack-fresh cards)

### Grading Impact by Rarity
- **Common/Uncommon**: Minor defects acceptable (these rarely graded)
- **Rare Holo**: Grade strictly (collectors expect near-mint)
- **Ultra Rare (V/VMAX/Full Art)**: Grade VERY strictly (high-value cards)
- **Secret Rare/Grail cards**: Grade EXTREMELY strictly (even tiny defects matter)

**IMPORTANT**: Apply same defect detection rigor regardless of rarity, but note that rarity affects VALUE impact of defects.
```

**Where to add this**: After the general grading methodology section, before the defect detection instructions

---

## Testing Checklist

### Step 10: Testing Plan for Pokemon Card Integration

**Before deploying to production, test all functionality thoroughly:**

#### Database Testing
- [ ] Run migration successfully (`node run_pokemon_migration.js`)
- [ ] Verify new columns exist in `cards` table
- [ ] Verify indexes created on pokemon fields
- [ ] Test inserting a Pokemon card record manually
- [ ] Test querying Pokemon cards by pokemon_name, pokemon_set, pokemon_rarity

#### Frontend Testing
- [ ] Upload page displays Pokemon card type option
- [ ] Clicking Pokemon shows Pokemon-specific input fields
- [ ] Clicking Sports shows sports-specific fields (existing functionality preserved)
- [ ] All Pokemon fields accept input correctly
- [ ] Rarity dropdown shows all Pokemon rarity options
- [ ] First Edition and Shadowless checkboxes work
- [ ] Form validation works (required fields)

#### API Testing
- [ ] POST /api/card creates Pokemon card with metadata
- [ ] Card record saved to database with correct pokemon fields
- [ ] Grading process runs successfully for Pokemon cards
- [ ] Card display page shows Pokemon metadata correctly
- [ ] Collection page filters by Pokemon card type
- [ ] Search/filter functionality works for Pokemon cards

#### Grading Testing
- [ ] Pokemon card grades successfully (same as sports)
- [ ] Grading results display correctly for Pokemon cards
- [ ] Holo card defects detected properly
- [ ] Edge defects on black borders detected
- [ ] Professional grades (PSA/BGS/SGC/CGC) calculated correctly

#### Pokemon TCG API Testing (if implemented)
- [ ] Search for Pokemon card by name returns results
- [ ] Selecting search result auto-fills metadata
- [ ] API handles errors gracefully (no API key, rate limits, etc.)
- [ ] Fallback to manual entry works if API fails

#### Rarity System Testing
- [ ] All rarity options save correctly
- [ ] Rarity displays on card detail page
- [ ] Rarity filters work in collection view
- [ ] First Edition / Shadowless flags display correctly

#### End-to-End Testing
- [ ] Upload Pokemon card from scratch
- [ ] Card grades successfully
- [ ] View grading results
- [ ] View card in collection
- [ ] Filter collection by Pokemon type
- [ ] Edit Pokemon card details
- [ ] Delete Pokemon card

#### Regression Testing (Sports Cards)
- [ ] Sports card upload still works unchanged
- [ ] Sports card grading still works
- [ ] Sports card display still shows sport-specific fields
- [ ] Sports card collection filtering still works
- [ ] No sports card functionality broken by Pokemon addition

---

## Implementation Timeline

### Recommended Implementation Phases

**Phase 1: Database Foundation (1-2 hours)**
- ✅ Create migration SQL file
- ✅ Create migration runner script
- ✅ Run migration on development database
- ✅ Verify schema changes
- ✅ (Optional) Create pokemon_rarities lookup table

**Phase 2: Frontend UI Updates (3-4 hours)**
- ✅ Update upload page with Pokemon card type selector
- ✅ Add Pokemon metadata input fields
- ✅ Add conditional rendering logic (show Pokemon fields only when Pokemon selected)
- ✅ Update card display page to show Pokemon metadata
- ✅ Update collection page with Pokemon filter tab
- ✅ Test UI in browser (visual/functional testing)

**Phase 3: API Route Updates (2-3 hours)**
- ✅ Update card creation API to accept Pokemon metadata
- ✅ Update database insert logic to save Pokemon fields
- ✅ Test API with Postman/Thunder Client
- ✅ Verify Pokemon cards saving to database correctly

**Phase 4: Pokemon TCG API Integration (2-3 hours) - OPTIONAL**
- ✅ Create pokemonTcgApi.ts helper
- ✅ Create /api/pokemon/search route
- ✅ Add auto-complete search UI to upload page
- ✅ Test search and auto-fill functionality
- ✅ Add error handling/fallback to manual entry

**Phase 5: Grading Enhancements (1-2 hours) - OPTIONAL**
- ✅ Add Pokemon-specific grading notes to system prompt
- ✅ Test grading with actual Pokemon cards
- ✅ Verify holo scratch detection
- ✅ Verify edge defect detection on black borders

**Phase 6: Testing & Refinement (2-4 hours)**
- ✅ Run through testing checklist
- ✅ Fix any bugs discovered
- ✅ Test edge cases (missing metadata, invalid inputs, etc.)
- ✅ Regression test sports card functionality
- ✅ User acceptance testing with real Pokemon cards

**Phase 7: Documentation & Deployment (1 hour)**
- ✅ Update README with Pokemon card support
- ✅ Document Pokemon metadata fields
- ✅ Document rarity scale
- ✅ Deploy to production
- ✅ Monitor for issues

**Total Estimated Time**: 12-20 hours depending on optional features

---

## Success Criteria

### How to know Pokemon card integration is successful:

✅ **Functional Completeness**
- Users can upload Pokemon cards and enter Pokemon-specific metadata
- Pokemon cards grade successfully using existing grading system
- Pokemon card details display correctly on card page
- Collection filters by Pokemon card type
- All Pokemon metadata saves and retrieves correctly

✅ **Data Accuracy**
- Pokemon names, sets, card numbers display correctly
- Rarity values match official Pokemon TCG rarity scale
- First Edition/Shadowless flags work correctly
- HP and type fields display when present

✅ **User Experience**
- Upload process intuitive (clear which fields for Pokemon vs sports)
- Pokemon cards visually distinct from sports cards in collection
- Rarity prominently displayed (helps users understand value)
- Auto-fill (if implemented) saves time entering metadata

✅ **System Stability**
- No regression in sports card functionality
- No performance degradation
- Database queries efficient (indexes working)
- Error handling graceful

✅ **Grading Quality**
- Pokemon cards grade as accurately as sports cards
- Holo scratches detected reliably
- Edge defects on black borders detected
- Grade distribution realistic (not too many 10.0s)

---

## Future Enhancements

### After Pokemon card support is stable, consider:

**1. Additional Card Types**
- Magic: The Gathering cards
- Yu-Gi-Oh cards
- Lorcana cards
- One Piece cards
- (Follow same pattern as Pokemon implementation)

**2. Market Price Integration**
- Integrate eBay API for sold listing prices
- Integrate TCGPlayer API for Pokemon card prices
- Show estimated value based on grade + rarity
- Track price trends over time

**3. Advanced Rarity Features**
- Rarity-based value multipliers
- PSA 10 population data (rarity of perfect grades)
- Set completion tracking (collect all cards in a set)
- Rarity distribution charts in collection

**4. Pokemon-Specific Features**
- Pokemon type filtering (show all Fire type cards)
- Set completion tracking (Base Set 102/102 collected)
- Card evolution chains (show pre-evolutions/evolutions)
- Weakness/resistance/retreat cost data

**5. Grading Enhancements**
- Holo pattern recognition (identify holo type)
- Print line detection (common on modern Pokemon cards)
- Holo scratch severity scoring
- Vintage vs. modern grading scale differences

---

## Rollback Plan

### If Pokemon card integration causes issues:

**Quick Rollback** (revert frontend only):
1. Restore `src/app/upload/page.tsx` from git
2. Restore `src/app/card/[id]/page.tsx` from git
3. Restore `src/app/collection/page.tsx` from git
4. Restart dev server

**Full Rollback** (revert database):
```sql
-- Remove Pokemon columns (CAUTION: deletes Pokemon card data)
ALTER TABLE cards
DROP COLUMN IF EXISTS pokemon_name,
DROP COLUMN IF EXISTS pokemon_set,
DROP COLUMN IF EXISTS set_card_number,
DROP COLUMN IF EXISTS pokemon_rarity,
DROP COLUMN IF EXISTS pokemon_type,
DROP COLUMN IF EXISTS pokemon_hp,
DROP COLUMN IF EXISTS finish_type,
DROP COLUMN IF EXISTS is_first_edition,
DROP COLUMN IF EXISTS is_shadowless,
DROP COLUMN IF EXISTS special_designation;

-- Drop indexes
DROP INDEX IF EXISTS idx_cards_pokemon_name;
DROP INDEX IF EXISTS idx_cards_pokemon_set;
DROP INDEX IF EXISTS idx_cards_pokemon_rarity;

-- Drop rarity table if created
DROP TABLE IF EXISTS pokemon_rarities;
```

**Recommended**: Keep database schema but only rollback frontend/API code if there are issues. This preserves any Pokemon cards already graded.

---

## Questions & Answers

**Q: Do Pokemon cards use the same grading scale as sports cards?**
A: Yes! The grading scale (edges, corners, surface, centering, structure) is universal. Pokemon just has different rarity terminology.

**Q: Do we need separate AI prompts for Pokemon vs sports?**
A: No. The existing defect detection prompt works for both. Optional: Add Pokemon-specific context notes (holo scratches, black borders) but core grading logic is identical.

**Q: What if a user uploads a sports card but selects Pokemon type by mistake?**
A: The grading will still work (grading is visual, not metadata-dependent). The metadata displayed will just be wrong. Consider adding a "Edit card type" feature to fix mistakes.

**Q: Should we validate Pokemon metadata (e.g., card number format)?**
A: Recommended. Add validation like:
- Card number matches format "X/Y" (number/total)
- Rarity is from predefined list
- HP is positive integer
- This prevents data quality issues.

**Q: Can we use the Pokemon TCG API for free?**
A: Yes, the Pokemon TCG API is free. Optional API key increases rate limits. Recommend implementing auto-fill to improve UX.

**Q: What about fake/counterfeit Pokemon cards?**
A: The grading system evaluates card condition, not authenticity. Consider adding an "Authenticity Warning" feature that flags common fake indicators (wrong font, incorrect holo pattern, etc.) but this is a future enhancement.

**Q: How do we handle Pokemon cards with multiple rarities (e.g., non-holo and holo versions)?**
A: The rarity field should reflect the ACTUAL card variant. If user uploads a holo Charizard, rarity = "Rare Holo". If non-holo, rarity = "Rare". The finish_type field clarifies this.

---

## Summary

This plan provides a **comprehensive, step-by-step roadmap** to add Pokemon card support to your existing card grading system. The implementation:

✅ **Maintains existing functionality** (sports cards unchanged)
✅ **Reuses grading methodology** (no changes to core grading AI)
✅ **Adds Pokemon-specific metadata** (name, set, rarity, type, HP, etc.)
✅ **Implements Pokemon rarity scale** (Common to Hyper Rare)
✅ **Provides clear implementation steps** (database → frontend → API → testing)
✅ **Includes testing checklist** (ensure quality before deployment)
✅ **Estimates timeline** (12-20 hours total work)
✅ **Extensible design** (easy to add more card types later)

**Next Steps**:
1. Review this plan and confirm approach
2. Start with Phase 1 (database migration)
3. Work through phases sequentially
4. Test thoroughly at each phase
5. Deploy when all tests pass

**Key Files to Create**:
- `migrations/add_pokemon_card_fields.sql`
- `run_pokemon_migration.js`
- `src/lib/pokemonTcgApi.ts` (optional)
- `src/app/api/pokemon/search/route.ts` (optional)

**Key Files to Update**:
- `src/app/upload/page.tsx`
- `src/app/card/[id]/page.tsx`
- `src/app/collection/page.tsx`
- `src/app/api/card/route.ts`
- `prompts/card_grader_v1.txt` (optional Pokemon-specific notes)

---

**Document Status**: ✅ Complete and ready for implementation
**Last Updated**: 2025-10-19
**Contact**: Use this document as your implementation guide for Pokemon card expansion
