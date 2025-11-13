# Pokemon TCG API Integration Plan

**Date:** October 29, 2025
**API:** PokemonTCG.io (https://dev.pokemontcg.io/)
**API Key:** a69e2947-6080-4a50-84ae-9f91e054f33e
**Goal:** Use Pokemon TCG API to populate card metadata instead of relying on AI

---

## 📋 TABLE OF CONTENTS

1. [Integration Strategy](#integration-strategy)
2. [API Overview](#api-overview)
3. [Implementation Files](#implementation-files)
4. [Upload Flow with API](#upload-flow-with-api)
5. [AI Role Adjustment](#ai-role-adjustment)
6. [Code Examples](#code-examples)

---

## 🎯 INTEGRATION STRATEGY

### Hybrid Approach: API + AI

**Pokemon TCG API provides:**
- ✅ Card name, set, card number
- ✅ Rarity (official Pokemon TCG rarity)
- ✅ Pokemon type, HP, attacks, abilities
- ✅ Artist, release date, legalities
- ✅ Market prices (TCGPlayer integration)
- ✅ Set information (total cards, symbols)
- ✅ Card images (small, large, hi-res)

**AI still handles:**
- ✅ Grading (centering, corners, edges, surface)
- ✅ Defect detection
- ✅ Condition assessment
- ✅ Professional slab detection (PSA/BGS)
- ✅ Special features (First Edition, Shadowless)
- ✅ Image quality assessment

### Workflow

```
USER UPLOADS POKEMON CARD
  ↓
1. Images uploaded to Supabase Storage
  ↓
2. AI does LIGHTWEIGHT identification (Step 0.5 only)
   - Extract: Card name + Set name (or set code)
   - Quick 5-second call
  ↓
3. Search Pokemon TCG API
   - Query: name + set
   - Get complete card data
   - Auto-fill all metadata fields
  ↓
4. AI does FULL GRADING (Steps 1-15)
   - Focus on condition grading only
   - Use API data for card info (no extraction needed)
   - Full detailed analysis
  ↓
5. Combine API metadata + AI grading
   - Save to database
   - Display on card detail page
```

---

## 🌐 API OVERVIEW

### Endpoints

**Base URL:** `https://api.pokemontcg.io/v2`

**Key Endpoints:**

1. **Search Cards**
   ```
   GET /cards?q=name:charizard set.name:base
   ```

2. **Get Card by ID**
   ```
   GET /cards/base1-4
   ```

3. **Search Sets**
   ```
   GET /sets?q=name:base
   ```

4. **Get Rarities**
   ```
   GET /rarities
   ```

5. **Get Types**
   ```
   GET /types
   ```

### Rate Limits

- **With API Key:** 20,000 requests/day
- **Without API Key:** 1,000 requests/day
- **Rate:** Max 1000 requests per hour

**Our usage:** ~2 requests per card upload (search + get details) = 10,000 cards/day limit ✅

### Authentication

```javascript
headers: {
  'X-Api-Key': 'a69e2947-6080-4a50-84ae-9f91e054f33e'
}
```

---

## 📁 IMPLEMENTATION FILES

### File Structure

```
src/
├── lib/
│   ├── pokemonTcgApi.ts           ← NEW: API client
│   └── pokemonCardMatcher.ts     ← NEW: Fuzzy matching logic
├── app/
│   ├── api/
│   │   └── pokemon/
│   │       ├── search/
│   │       │   └── route.ts       ← NEW: Search API endpoint
│   │       └── identify/
│   │           └── route.ts       ← NEW: AI identification endpoint
│   └── upload/
│       └── pokemon/
│           └── page.tsx           ← UPDATE: Add API search UI
```

---

## 📦 CODE EXAMPLES

### 1. Pokemon TCG API Client

**File:** `src/lib/pokemonTcgApi.ts`

```typescript
// src/lib/pokemonTcgApi.ts
// Pokemon TCG API client for fetching card data

const POKEMON_API_BASE = 'https://api.pokemontcg.io/v2';
const POKEMON_API_KEY = 'a69e2947-6080-4a50-84ae-9f91e054f33e';

export interface PokemonCard {
  id: string;                    // "base1-4"
  name: string;                  // "Charizard"
  supertype: string;             // "Pokémon"
  subtypes: string[];            // ["Stage 2"]
  hp?: string;                   // "120"
  types?: string[];              // ["Fire"]
  evolvesFrom?: string;          // "Charmeleon"

  set: {
    id: string;                  // "base1"
    name: string;                // "Base"
    series: string;              // "Base"
    printedTotal: number;        // 102
    total: number;               // 102
    releaseDate: string;         // "1999/01/09"
    images: {
      symbol: string;
      logo: string;
    };
  };

  number: string;                // "4"
  rarity: string;                // "Rare Holo"
  artist?: string;               // "Mitsuhiro Arita"

  images: {
    small: string;               // Low-res image URL
    large: string;               // High-res image URL
  };

  tcgplayer?: {
    url: string;
    updatedAt: string;
    prices?: {
      holofoil?: {
        low: number;
        mid: number;
        high: number;
        market: number;
      };
      normal?: {
        low: number;
        mid: number;
        high: number;
        market: number;
      };
      '1stEditionHolofoil'?: {
        low: number;
        mid: number;
        high: number;
        market: number;
      };
    };
  };

  cardmarket?: {
    url: string;
    updatedAt: string;
    prices?: {
      averageSellPrice: number;
      lowPrice: number;
      trendPrice: number;
    };
  };
}

export interface PokemonSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  releaseDate: string;
  images: {
    symbol: string;
    logo: string;
  };
}

/**
 * Search for Pokemon cards by name and optional set
 */
export async function searchPokemonCards(
  name: string,
  setName?: string
): Promise<PokemonCard[]> {
  try {
    // Build query
    let query = `name:"${name}"`;
    if (setName) {
      query += ` set.name:"${setName}"`;
    }

    const url = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': POKEMON_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Pokemon TCG API error: ${response.status}`);
    }

    const json = await response.json();
    return json.data || [];
  } catch (error) {
    console.error('Error searching Pokemon cards:', error);
    return [];
  }
}

/**
 * Get a specific card by ID
 */
export async function getPokemonCardById(cardId: string): Promise<PokemonCard | null> {
  try {
    const url = `${POKEMON_API_BASE}/cards/${cardId}`;

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': POKEMON_API_KEY
      }
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return json.data || null;
  } catch (error) {
    console.error('Error fetching Pokemon card:', error);
    return null;
  }
}

/**
 * Search for Pokemon sets
 */
export async function searchPokemonSets(name: string): Promise<PokemonSet[]> {
  try {
    const query = `name:"${name}"`;
    const url = `${POKEMON_API_BASE}/sets?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': POKEMON_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Pokemon TCG API error: ${response.status}`);
    }

    const json = await response.json();
    return json.data || [];
  } catch (error) {
    console.error('Error searching Pokemon sets:', error);
    return [];
  }
}

/**
 * Get all available rarities
 */
export async function getPokemonRarities(): Promise<string[]> {
  try {
    const url = `${POKEMON_API_BASE}/rarities`;

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': POKEMON_API_KEY
      }
    });

    if (!response.ok) {
      return [];
    }

    const json = await response.json();
    return json.data || [];
  } catch (error) {
    console.error('Error fetching rarities:', error);
    return [];
  }
}

/**
 * Convert API card data to our database format
 */
export function convertApiCardToMetadata(apiCard: PokemonCard) {
  return {
    card_name: apiCard.name,
    player_or_character: apiCard.name,
    set_name: apiCard.set.name,
    card_number: `${apiCard.number}/${apiCard.set.printedTotal}`,
    year: apiCard.set.releaseDate?.split('/')[0] || null,
    manufacturer: 'The Pokemon Company', // or 'Wizards of the Coast' for vintage
    sport_or_category: 'Pokemon',
    rarity_tier: apiCard.rarity,

    // Pokemon-specific
    pokemon_type: apiCard.types?.[0] || null,
    hp: apiCard.hp ? parseInt(apiCard.hp) : null,
    card_type: apiCard.supertype, // "Pokémon", "Trainer", "Energy"
    subtypes: apiCard.subtypes,
    evolvesFrom: apiCard.evolvesFrom,
    artist: apiCard.artist,

    // API metadata
    api_card_id: apiCard.id,
    api_image_small: apiCard.images.small,
    api_image_large: apiCard.images.large,

    // Market prices
    tcgplayer_url: apiCard.tcgplayer?.url,
    market_price: apiCard.tcgplayer?.prices?.holofoil?.market ||
                  apiCard.tcgplayer?.prices?.normal?.market ||
                  apiCard.cardmarket?.prices?.averageSellPrice ||
                  null
  };
}
```

---

### 2. Pokemon Card Matcher (Fuzzy Matching)

**File:** `src/lib/pokemonCardMatcher.ts`

```typescript
// src/lib/pokemonCardMatcher.ts
// Fuzzy matching to find best card match from API results

import { PokemonCard } from './pokemonTcgApi';

/**
 * Calculate similarity score between two strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1.0;

  // Contains match
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Levenshtein distance (simplified)
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Find best matching card from API results
 */
export function findBestMatch(
  apiResults: PokemonCard[],
  aiIdentification: {
    name?: string;
    set?: string;
    cardNumber?: string;
    rarity?: string;
  }
): PokemonCard | null {
  if (apiResults.length === 0) return null;
  if (apiResults.length === 1) return apiResults[0];

  // Score each result
  const scored = apiResults.map(card => {
    let score = 0;
    let factors = 0;

    // Name match (most important)
    if (aiIdentification.name) {
      score += calculateSimilarity(card.name, aiIdentification.name) * 3;
      factors += 3;
    }

    // Set match (very important)
    if (aiIdentification.set) {
      score += calculateSimilarity(card.set.name, aiIdentification.set) * 2;
      factors += 2;
    }

    // Card number match (important)
    if (aiIdentification.cardNumber) {
      const apiNumber = `${card.number}/${card.set.printedTotal}`;
      score += calculateSimilarity(apiNumber, aiIdentification.cardNumber) * 2;
      factors += 2;
    }

    // Rarity match (less important)
    if (aiIdentification.rarity) {
      score += calculateSimilarity(card.rarity, aiIdentification.rarity);
      factors += 1;
    }

    return {
      card,
      score: factors > 0 ? score / factors : 0
    };
  });

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  console.log('[Pokemon Matcher] Top 3 matches:');
  scored.slice(0, 3).forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.card.name} (${result.card.set.name}) - Score: ${result.score.toFixed(2)}`);
  });

  // Return best match if score is good enough
  if (scored[0].score >= 0.6) {
    return scored[0].card;
  }

  return null;
}
```

---

### 3. API Search Endpoint

**File:** `src/app/api/pokemon/search/route.ts`

```typescript
// src/app/api/pokemon/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchPokemonCards } from '@/lib/pokemonTcgApi';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get('name');
  const set = searchParams.get('set');

  if (!name) {
    return NextResponse.json(
      { error: 'Name parameter required' },
      { status: 400 }
    );
  }

  try {
    const results = await searchPokemonCards(name, set || undefined);

    return NextResponse.json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error: any) {
    console.error('Pokemon search error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

---

### 4. AI Identification Endpoint (Lightweight)

**File:** `src/app/api/pokemon/identify/route.ts`

```typescript
// src/app/api/pokemon/identify/route.ts
// Lightweight AI call to identify card name and set only

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: NextRequest) {
  try {
    const { frontImageUrl, backImageUrl } = await request.json();

    if (!frontImageUrl) {
      return NextResponse.json(
        { error: 'Front image URL required' },
        { status: 400 }
      );
    }

    // Lightweight identification prompt (just name and set)
    const identificationPrompt = `
You are a Pokemon card identifier. Analyze this Pokemon card image and extract ONLY the following information:

1. **Pokemon Name** or **Card Name** (e.g., "Charizard", "Professor Oak", "Fire Energy")
2. **Set Name** (e.g., "Base Set", "Jungle", "Team Rocket", "Evolving Skies")
3. **Card Number** (e.g., "4/102", "1/62") - if visible
4. **Rarity** (e.g., "Rare Holo", "Common", "Ultra Rare") - if visible

Be as accurate as possible. Look for:
- Pokemon name at the top of the card
- Set name/symbol at the bottom right
- Card number at bottom right (format: X/Y)
- Rarity symbol (circle, diamond, star, etc.)

Return ONLY these fields in this exact format:

**Card Name**: [name]
**Set Name**: [set]
**Card Number**: [number or "Not visible"]
**Rarity**: [rarity or "Not visible"]

Do not provide any other analysis. This is just for identification.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: identificationPrompt
            },
            {
              type: 'image_url',
              image_url: { url: frontImageUrl }
            }
          ]
        }
      ],
      max_tokens: 300 // Keep it short and cheap
    });

    const aiResponse = response.choices[0].message.content || '';

    // Parse AI response
    const nameMatch = aiResponse.match(/\*\*Card Name\*\*:\s*(.+?)(?=\n|$)/);
    const setMatch = aiResponse.match(/\*\*Set Name\*\*:\s*(.+?)(?=\n|$)/);
    const numberMatch = aiResponse.match(/\*\*Card Number\*\*:\s*(.+?)(?=\n|$)/);
    const rarityMatch = aiResponse.match(/\*\*Rarity\*\*:\s*(.+?)(?=\n|$)/);

    const identification = {
      name: nameMatch ? nameMatch[1].trim() : null,
      set: setMatch ? setMatch[1].trim() : null,
      cardNumber: numberMatch ? numberMatch[1].trim() : null,
      rarity: rarityMatch ? rarityMatch[1].trim() : null
    };

    // Clean up "Not visible" values
    if (identification.cardNumber?.toLowerCase().includes('not visible')) {
      identification.cardNumber = null;
    }
    if (identification.rarity?.toLowerCase().includes('not visible')) {
      identification.rarity = null;
    }

    console.log('[Pokemon Identify] AI identified:', identification);

    return NextResponse.json({
      success: true,
      identification,
      aiResponse // Include full response for debugging
    });

  } catch (error: any) {
    console.error('Pokemon identification error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

---

### 5. Updated Pokemon Upload Page with API Integration

**File:** `src/app/upload/pokemon/page.tsx`

```typescript
'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { PokemonCard } from '@/lib/pokemonTcgApi';

export default function PokemonUploadPage() {
  const router = useRouter();
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [searchResults, setSearchResults] = useState<PokemonCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<PokemonCard | null>(null);

  // Step 1: Upload images and identify card
  const handleIdentifyCard = async () => {
    if (!frontFile || !backFile) {
      setStatus('❌ Please select both front and back images');
      return;
    }

    try {
      setIsIdentifying(true);
      setStatus('⏳ Uploading images...');

      // Get user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setStatus('❌ You must be logged in');
        return;
      }

      // Upload images temporarily
      const cardId = crypto.randomUUID();
      const frontPath = `${user.id}/${cardId}/front.jpg`;
      const backPath = `${user.id}/${cardId}/back.jpg`;

      const { error: frontError } = await supabase.storage
        .from('cards')
        .upload(frontPath, frontFile);

      if (frontError) throw frontError;

      const { error: backError } = await supabase.storage
        .from('cards')
        .upload(backPath, backFile);

      if (backError) throw backError;

      // Get public URLs
      const { data: frontUrlData } = supabase.storage
        .from('cards')
        .getPublicUrl(frontPath);

      const { data: backUrlData } = supabase.storage
        .from('cards')
        .getPublicUrl(backPath);

      setStatus('🤖 Identifying card with AI...');

      // Call AI identification endpoint
      const identifyResponse = await fetch('/api/pokemon/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontImageUrl: frontUrlData.publicUrl,
          backImageUrl: backUrlData.publicUrl
        })
      });

      const identifyData = await identifyResponse.json();

      if (!identifyData.success) {
        throw new Error('Failed to identify card');
      }

      console.log('[Upload] AI identified:', identifyData.identification);

      setStatus('🔍 Searching Pokemon TCG API...');

      // Search Pokemon TCG API
      const searchParams = new URLSearchParams();
      if (identifyData.identification.name) {
        searchParams.set('name', identifyData.identification.name);
      }
      if (identifyData.identification.set) {
        searchParams.set('set', identifyData.identification.set);
      }

      const searchResponse = await fetch(`/api/pokemon/search?${searchParams}`);
      const searchData = await searchResponse.json();

      if (searchData.count === 0) {
        setStatus('⚠️ Card not found in database. Please enter details manually.');
        setSearchResults([]);
        return;
      }

      setSearchResults(searchData.data);
      setStatus(`✅ Found ${searchData.count} matching card(s). Please select your card.`);

      // Auto-select if only one result
      if (searchData.count === 1) {
        setSelectedCard(searchData.data[0]);
      }

    } catch (error: any) {
      console.error('Identification error:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsIdentifying(false);
    }
  };

  // Step 2: Confirm and create card record
  const handleConfirmCard = async () => {
    if (!selectedCard) {
      setStatus('❌ Please select a card');
      return;
    }

    try {
      setStatus('⏳ Creating card record...');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const cardId = crypto.randomUUID();
      const frontPath = `${user.id}/${cardId}/front.jpg`;
      const backPath = `${user.id}/${cardId}/back.jpg`;

      // Re-upload images with final card ID
      // (In production, might want to move/rename existing uploads)

      // Create card record with API metadata
      const { error: dbError } = await supabase.from('cards').insert({
        id: cardId,
        user_id: user.id,
        category: 'Pokemon',
        front_path: frontPath,
        back_path: backPath,
        serial: `PKM-${Math.random().toString(36).slice(2, 8)}`,

        // Store API metadata
        api_card_id: selectedCard.id,
        card_name: selectedCard.name,

        // Store full API data in JSONB for reference
        api_metadata: selectedCard
      });

      if (dbError) throw dbError;

      setStatus('✅ Card created! Redirecting to grading...');
      setTimeout(() => router.push(`/pokemon/${cardId}`), 1000);

    } catch (error: any) {
      console.error('Card creation error:', error);
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  return (
    <main className="min-h-screen p-8 pt-20">
      <h1 className="text-3xl font-bold mb-6">Upload Pokemon Card</h1>

      <div className="max-w-2xl space-y-6">
        {/* Image Upload */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Front Image:
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFrontFile(e.target.files?.[0] || null)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Back Image:
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setBackFile(e.target.files?.[0] || null)}
              className="w-full"
            />
          </div>

          <button
            onClick={handleIdentifyCard}
            disabled={!frontFile || !backFile || isIdentifying}
            className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400"
          >
            {isIdentifying ? 'Identifying...' : 'Identify Card'}
          </button>
        </div>

        {/* Status */}
        {status && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            {status}
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Select Your Card:</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map((card) => (
                <div
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                    selectedCard?.id === card.id
                      ? 'border-red-600 bg-red-50'
                      : 'border-gray-300 hover:border-red-400'
                  }`}
                >
                  <div className="flex gap-4">
                    <img
                      src={card.images.small}
                      alt={card.name}
                      className="w-24 h-auto rounded"
                    />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{card.name}</h3>
                      <p className="text-sm text-gray-600">{card.set.name}</p>
                      <p className="text-sm text-gray-600">
                        {card.number}/{card.set.printedTotal}
                      </p>
                      <p className="text-sm font-semibold text-yellow-700">
                        {card.rarity}
                      </p>
                      {card.hp && (
                        <p className="text-sm text-red-600 font-bold">
                          {card.hp} HP
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleConfirmCard}
              disabled={!selectedCard}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400"
            >
              Confirm and Grade Card
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
```

---

## 🤖 AI ROLE ADJUSTMENT

### Updated Pokemon AI Prompt Structure

**For Pokemon cards, AI should:**

1. **Skip Card Info Extraction** (Step 1)
   - API provides: Name, Set, Number, Rarity, Type, HP
   - AI only needs to detect: First Edition, Shadowless, Finish Type

2. **Focus on Grading** (Steps 2-15)
   - Professional slab detection
   - Image quality assessment
   - Front evaluation (centering, corners, edges, surface)
   - Back evaluation (independent scoring)
   - Cross-verification
   - Final grade calculation

**Modified prompt section:**

```
[STEP 1] CARD INFORMATION IDENTIFICATION

🎯 OBJECTIVE: Identify Pokemon-specific features NOT provided by API.

API has already provided:
- Pokemon Name: {api_name}
- Set Name: {api_set}
- Card Number: {api_number}
- Rarity: {api_rarity}
- Pokemon Type: {api_type}
- HP: {api_hp}

Your task: Identify ONLY these additional features:

**Finish Type**: [Holo | Reverse Holo | Non-Holo]
**First Edition**: [Yes | No] - Look for "1st Edition" stamp on left side
**Shadowless**: [Yes | No] - Base Set only, no shadow on right side of frame
**Card Type**: [Pokémon | Trainer - [Supporter/Item/Stadium] | Energy]

Continue to Steps 2-15 for full grading analysis...
```

---

## 📊 BENEFITS OF API INTEGRATION

### Accuracy
- ✅ 100% accurate card metadata (official Pokemon data)
- ✅ Consistent rarity naming
- ✅ Correct card numbers and set information
- ✅ No AI hallucination on card details

### Speed
- ✅ API call ~200ms vs. AI extraction ~5-10 seconds
- ✅ Reduces AI token usage (cheaper)
- ✅ Faster upload flow

### Data Richness
- ✅ Market prices from TCGPlayer
- ✅ High-res reference images
- ✅ Complete card database
- ✅ Set symbols and logos

### User Experience
- ✅ Auto-complete search
- ✅ Visual card selection (images)
- ✅ Confidence in data accuracy
- ✅ Suggested cards if multiple matches

---

## ✅ NEXT STEPS

1. **Create API client:** `src/lib/pokemonTcgApi.ts`
2. **Create matcher:** `src/lib/pokemonCardMatcher.ts`
3. **Create endpoints:**
   - `/api/pokemon/search/route.ts`
   - `/api/pokemon/identify/route.ts`
4. **Update upload page:** `/upload/pokemon/page.tsx`
5. **Test with real Pokemon cards**

---

**Ready to implement?** Let me know and I'll start creating these files!
