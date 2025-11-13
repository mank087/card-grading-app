# 🔒 Public/Private Card Visibility Implementation Plan
**Date**: October 21, 2025
**Status**: 📋 PLANNING

---

## 📋 Overview

Add public/private visibility controls for graded cards:
- **Private Cards**: Hidden from all public views, not searchable, only visible to owner
- **Public Cards**: Can be shared via link, searchable by serial number, visible to anyone

---

## 🎯 Feature Requirements

### **Private Cards** 🔒
- ✅ Only visible to card owner (when logged in)
- ✅ Not searchable by serial number
- ✅ Not displayed in any public galleries/lists
- ✅ Direct link access shows "This card is private" or 404
- ✅ Owner can still view and manage
- ✅ Default setting for new cards

### **Public Cards** 🌐
- ✅ Link can be shared with anyone
- ✅ Searchable by serial number
- ✅ Visible in public galleries (if implemented)
- ✅ Social media sharing enabled
- ✅ No login required to view

---

## 🗄️ Phase 1: Database Schema Changes

### **1.1: Add Visibility Column**

**Migration SQL**:
```sql
-- Add visibility column to cards table
ALTER TABLE cards
ADD COLUMN visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'private'));

-- Add index for efficient querying
CREATE INDEX idx_cards_visibility ON cards(visibility);

-- Add composite index for serial + visibility (for search)
CREATE INDEX idx_cards_serial_visibility ON cards(serial, visibility);

-- Add composite index for user_id + visibility (for owner's collection)
CREATE INDEX idx_cards_user_visibility ON cards(user_id, visibility) WHERE user_id IS NOT NULL;
```

**Alternative (using boolean)**:
```sql
-- Using boolean if you prefer
ALTER TABLE cards
ADD COLUMN is_public BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_cards_is_public ON cards(is_public);
CREATE INDEX idx_cards_serial_public ON cards(serial, is_public);
```

**Migration File**: `migrations/add_card_visibility.sql`

---

### **1.2: Update Existing Cards**

**Set all existing cards to private by default**:
```sql
-- Update all existing cards to private (safe default)
UPDATE cards
SET visibility = 'private'
WHERE visibility IS NULL;

-- Or if using boolean:
UPDATE cards
SET is_public = FALSE
WHERE is_public IS NULL;
```

---

## 🔐 Phase 2: Backend API Changes

### **2.1: Update Card Detail API**

**File**: `src/app/api/sports/[id]/route.ts`

**Current Behavior**: Returns any card by ID
**New Behavior**: Check visibility before returning

```typescript
// GET /api/sports/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const supabase = supabaseServer();

  // Get current user (if logged in)
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || null;

  // Fetch card
  const { data: card, error } = await supabase
    .from('cards')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  // Check visibility permissions
  const isOwner = userId && card.user_id === userId;
  const isPublic = card.visibility === 'public';

  if (!isPublic && !isOwner) {
    // Card is private and user is not the owner
    return NextResponse.json(
      {
        error: 'This card is private',
        message: 'The owner has set this card to private. Only they can view it.'
      },
      { status: 403 }
    );
  }

  // User can view the card
  return NextResponse.json(card);
}
```

---

### **2.2: Add Visibility Update API**

**File**: `src/app/api/cards/[id]/visibility/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// PATCH /api/cards/[id]/visibility
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const supabase = supabaseServer();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Parse request body
  const { visibility } = await request.json();

  // Validate visibility value
  if (!['public', 'private'].includes(visibility)) {
    return NextResponse.json(
      { error: 'Invalid visibility value. Must be "public" or "private"' },
      { status: 400 }
    );
  }

  // Fetch card to verify ownership
  const { data: card, error: fetchError } = await supabase
    .from('cards')
    .select('user_id')
    .eq('id', id)
    .single();

  if (fetchError || !card) {
    return NextResponse.json(
      { error: 'Card not found' },
      { status: 404 }
    );
  }

  // Verify user owns this card
  if (card.user_id !== user.id) {
    return NextResponse.json(
      { error: 'You can only change visibility of your own cards' },
      { status: 403 }
    );
  }

  // Update visibility
  const { data: updatedCard, error: updateError } = await supabase
    .from('cards')
    .update({ visibility })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    console.error('[Visibility Update Error]', updateError);
    return NextResponse.json(
      { error: 'Failed to update visibility' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    visibility: updatedCard.visibility,
    message: `Card is now ${visibility}`
  });
}
```

---

### **2.3: Add Serial Number Search API**

**File**: `src/app/api/cards/search/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// GET /api/cards/search?serial=ABC123
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const serial = searchParams.get('serial');

  if (!serial) {
    return NextResponse.json(
      { error: 'Serial number is required' },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();

  // Get current user (if logged in)
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || null;

  // Search for cards by serial number
  let query = supabase
    .from('cards')
    .select('id, serial, card_name, featured, dvg_decimal_grade, front_url, visibility, user_id, created_at')
    .ilike('serial', `%${serial}%`);

  // If user is not logged in, only show public cards
  if (!userId) {
    query = query.eq('visibility', 'public');
  } else {
    // If user is logged in, show public cards + their own private cards
    query = query.or(`visibility.eq.public,user_id.eq.${userId}`);
  }

  const { data: cards, error } = await query
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[Search Error]', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    results: cards || [],
    count: cards?.length || 0
  });
}
```

---

### **2.4: Update Collection API**

**File**: `src/app/api/collection/route.ts` or similar

**Update to filter based on ownership**:
```typescript
// Only show cards owned by current user
const { data: cards } = await supabase
  .from('cards')
  .select('*')
  .eq('user_id', user.id) // Only user's cards (both public and private)
  .order('created_at', { ascending: false });
```

---

## 🎨 Phase 3: Frontend Changes

### **3.1: Add Visibility Toggle to Card Detail Page**

**File**: `src/app/sports/[id]/CardDetailClient.tsx`

**Location**: In header area, near re-grade button

```typescript
// Add to component state
const [visibility, setVisibility] = useState<'public' | 'private'>(card.visibility || 'private');
const [changingVisibility, setChangingVisibility] = useState(false);

// Function to update visibility
const updateVisibility = async (newVisibility: 'public' | 'private') => {
  setChangingVisibility(true);

  try {
    const response = await fetch(`/api/cards/${cardId}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: newVisibility })
    });

    const data = await response.json();

    if (response.ok) {
      setVisibility(newVisibility);
      alert(`Card is now ${newVisibility}`);
    } else {
      alert(data.error || 'Failed to update visibility');
    }
  } catch (error) {
    console.error('Failed to update visibility:', error);
    alert('Failed to update visibility');
  } finally {
    setChangingVisibility(false);
  }
};

// JSX: Add visibility toggle in header
<div className="flex items-center space-x-4">
  {/* Existing buttons */}
  <button onClick={regradeCard}>Re-grade Card</button>

  {/* Visibility Toggle */}
  <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-2">
    <span className="text-xs font-medium text-gray-600">
      {visibility === 'public' ? '🌐 Public' : '🔒 Private'}
    </span>
    <button
      onClick={() => updateVisibility(visibility === 'public' ? 'private' : 'public')}
      disabled={changingVisibility}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        visibility === 'public' ? 'bg-green-600' : 'bg-gray-400'
      } disabled:opacity-50`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          visibility === 'public' ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
</div>
```

**Enhanced version with confirmation**:
```typescript
const toggleVisibility = async () => {
  const newVisibility = visibility === 'public' ? 'private' : 'public';

  // Confirmation when making public
  if (newVisibility === 'public') {
    const confirmed = window.confirm(
      'Are you sure you want to make this card public?\n\n' +
      'Anyone with the link will be able to view this card, and it will be searchable by serial number.'
    );
    if (!confirmed) return;
  }

  await updateVisibility(newVisibility);
};
```

---

### **3.2: Add Visibility Badge**

**Show current visibility status**:
```tsx
{/* Visibility Badge */}
<div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium">
  {visibility === 'public' ? (
    <div className="bg-green-100 text-green-800 flex items-center gap-2">
      <span>🌐</span>
      <span>Public</span>
      <span className="text-xs">(Anyone can view)</span>
    </div>
  ) : (
    <div className="bg-gray-100 text-gray-800 flex items-center gap-2">
      <span>🔒</span>
      <span>Private</span>
      <span className="text-xs">(Only you can view)</span>
    </div>
  )}
</div>
```

---

### **3.3: Update Share Button Logic**

**Only show share options for public cards**:
```tsx
{visibility === 'public' ? (
  <div className="flex space-x-2">
    <button onClick={() => copyCardUrl()}>
      📋 Copy Link
    </button>
    <button onClick={() => shareToTwitter()}>
      🐦 Share on Twitter
    </button>
    <button onClick={() => shareToFacebook()}>
      📘 Share on Facebook
    </button>
  </div>
) : (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
    <p className="text-sm text-yellow-800">
      <span className="font-semibold">🔒 Private Card</span>
      <br />
      Make this card public to enable sharing and search features.
    </p>
  </div>
)}
```

---

### **3.4: Private Card Access Page**

**File**: `src/app/sports/[id]/CardDetailClient.tsx`

**Handle 403 response**:
```tsx
// In error handling
if (error === 'This card is private') {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">🔒</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Private Card</h1>
        <p className="text-gray-600 mb-6">
          This card is set to private. Only the owner can view it.
        </p>
        <Link
          href="/collection"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          View Your Collection
        </Link>
      </div>
    </div>
  );
}
```

---

### **3.5: Add to Collection Page**

**File**: `src/app/collection/page.tsx`

**Show visibility status on each card**:
```tsx
{/* Card visibility indicator */}
<div className="absolute top-2 right-2">
  {card.visibility === 'public' ? (
    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
      🌐 Public
    </span>
  ) : (
    <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
      🔒 Private
    </span>
  )}
</div>
```

**Add bulk visibility actions**:
```tsx
{/* Bulk actions */}
<div className="flex space-x-2 mb-4">
  <button
    onClick={() => bulkUpdateVisibility(selectedCards, 'public')}
    className="px-4 py-2 bg-green-600 text-white rounded"
  >
    Make Selected Public
  </button>
  <button
    onClick={() => bulkUpdateVisibility(selectedCards, 'private')}
    className="px-4 py-2 bg-gray-600 text-white rounded"
  >
    Make Selected Private
  </button>
</div>
```

---

## 🔍 Phase 4: Search Feature

### **4.1: Add Search Page**

**File**: `src/app/search/page.tsx` (NEW)

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function SearchPage() {
  const [serial, setSerial] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const searchCards = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serial.trim()) return;

    setLoading(true);
    setSearched(true);

    try {
      const response = await fetch(`/api/cards/search?serial=${encodeURIComponent(serial)}`);
      const data = await response.json();

      if (response.ok) {
        setResults(data.results);
      } else {
        alert(data.error || 'Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Search Graded Cards</h1>

      {/* Search Form */}
      <form onSubmit={searchCards} className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="Enter serial number (e.g., DCM-2024-001234)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Only public cards are searchable. Private cards can only be viewed by their owners.
        </p>
      </form>

      {/* Results */}
      {searched && (
        <div>
          {results.length > 0 ? (
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Found {results.length} {results.length === 1 ? 'card' : 'cards'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((card) => (
                  <Link
                    key={card.id}
                    href={`/sports/${card.id}`}
                    className="block border rounded-lg p-4 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex gap-4">
                      <Image
                        src={card.front_url}
                        alt="Card"
                        width={100}
                        height={140}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {card.featured || card.card_name || 'Card'}
                        </p>
                        <p className="text-sm text-gray-600">
                          Serial: {card.serial}
                        </p>
                        <p className="text-sm text-gray-600">
                          Grade: {card.dvg_decimal_grade !== null ? card.dvg_decimal_grade : 'N/A'}
                        </p>
                        <p className="text-xs text-green-600 mt-2">
                          🌐 Public
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <span className="text-4xl mb-4 block">🔍</span>
              <p className="text-gray-600">No public cards found with that serial number.</p>
              <p className="text-sm text-gray-500 mt-2">
                Try a different search or check if the card is set to private.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

### **4.2: Add Search Link to Navigation**

**Add to main navigation**:
```tsx
<Link href="/search" className="text-blue-600 hover:text-blue-800">
  🔍 Search Cards
</Link>
```

---

## 🧪 Phase 5: Testing Plan

### **5.1: Database Testing**

**Test migration**:
```sql
-- Verify column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'cards' AND column_name = 'visibility';

-- Verify indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'cards' AND indexname LIKE '%visibility%';

-- Test query performance
EXPLAIN ANALYZE
SELECT * FROM cards WHERE visibility = 'public' AND serial ILIKE '%DCM%';
```

---

### **5.2: API Testing**

**Test visibility update**:
```bash
# Update to public
curl -X PATCH http://localhost:3000/api/cards/{card_id}/visibility \
  -H "Content-Type: application/json" \
  -d '{"visibility": "public"}'

# Update to private
curl -X PATCH http://localhost:3000/api/cards/{card_id}/visibility \
  -H "Content-Type: application/json" \
  -d '{"visibility": "private"}'

# Search by serial (public only)
curl http://localhost:3000/api/cards/search?serial=DCM-2024-001234
```

---

### **5.3: Frontend Testing**

**Manual test cases**:

1. **Private Card Access**:
   - [ ] Owner can view private card
   - [ ] Non-owner sees "This card is private" message
   - [ ] Logged out user sees "This card is private" message

2. **Public Card Access**:
   - [ ] Anyone can view public card (logged in or not)
   - [ ] Public card appears in search results
   - [ ] Share buttons work on public cards

3. **Visibility Toggle**:
   - [ ] Toggle changes from private to public
   - [ ] Toggle changes from public to private
   - [ ] Confirmation shown when making public
   - [ ] Badge updates after toggle

4. **Search**:
   - [ ] Search finds public cards by serial
   - [ ] Search does not find private cards (unless owner)
   - [ ] Search results link to correct cards

---

## 📊 Phase 6: User Experience Enhancements

### **6.1: Share Features for Public Cards**

**Enhanced share modal**:
```tsx
{visibility === 'public' && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <h3 className="font-semibold text-blue-900 mb-2">Share This Card</h3>
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={window.location.href}
          readOnly
          className="flex-1 px-3 py-2 bg-white border rounded text-sm"
        />
        <button
          onClick={() => copyToClipboard(window.location.href)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Copy
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={shareToTwitter} className="flex-1 px-3 py-2 bg-sky-500 text-white rounded">
          Twitter
        </button>
        <button onClick={shareToFacebook} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded">
          Facebook
        </button>
      </div>
    </div>
  </div>
)}
```

---

### **6.2: Privacy Notice**

**Show when toggling to public**:
```tsx
const confirmMakePublic = () => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md">
        <h2 className="text-xl font-bold mb-4">Make Card Public?</h2>
        <div className="space-y-3 text-sm text-gray-700 mb-6">
          <p>✅ Anyone with the link can view this card</p>
          <p>✅ Card will be searchable by serial number</p>
          <p>✅ Card information will be visible to the public</p>
          <p>⚠️ You can change back to private at any time</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              updateVisibility('public');
              closeModal();
            }}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded"
          >
            Make Public
          </button>
          <button
            onClick={closeModal}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## 🔐 Phase 7: Security Considerations

### **7.1: Authentication**

**Required**:
- User must be logged in to change visibility
- User must own the card to change visibility
- Implement rate limiting on visibility API

---

### **7.2: Prevent Enumeration**

**Don't reveal if card exists**:
```typescript
// Instead of "Card not found" vs "Card is private"
// Always return same response for unauthorized access
if (!isPublic && !isOwner) {
  return NextResponse.json(
    { error: 'Card not found' }, // Generic message
    { status: 404 } // Same status code
  );
}
```

---

### **7.3: Add to .env**

**Configuration**:
```env
# Default card visibility for new uploads
DEFAULT_CARD_VISIBILITY=private

# Allow public galleries (future feature)
ENABLE_PUBLIC_GALLERY=false
```

---

## 📈 Phase 8: Analytics & Monitoring

### **8.1: Track Visibility Changes**

**Add logging**:
```typescript
// In visibility update API
console.log(`[Visibility Change] User ${user.id} changed card ${id} to ${visibility}`);

// Track in analytics
analytics.track('Card Visibility Changed', {
  cardId: id,
  userId: user.id,
  oldVisibility: currentVisibility,
  newVisibility: visibility
});
```

---

### **8.2: Usage Stats**

**Database queries**:
```sql
-- Count public vs private cards
SELECT
  visibility,
  COUNT(*) as count
FROM cards
GROUP BY visibility;

-- Most searched serial numbers
-- (Track search queries in separate table)
SELECT serial, COUNT(*) as searches
FROM search_logs
GROUP BY serial
ORDER BY searches DESC
LIMIT 10;
```

---

## 🗂️ Implementation Checklist

### **Phase 1: Database** ✅
- [ ] Create migration file
- [ ] Add visibility column
- [ ] Add indexes
- [ ] Update existing cards to private
- [ ] Test migration in development
- [ ] Run migration in production

### **Phase 2: Backend** ✅
- [ ] Update card detail API (check visibility)
- [ ] Create visibility update API
- [ ] Create search API
- [ ] Update collection API
- [ ] Add authentication checks
- [ ] Add error handling
- [ ] Test all endpoints

### **Phase 3: Frontend** ✅
- [ ] Add visibility toggle to card detail page
- [ ] Add visibility badge
- [ ] Update share button logic
- [ ] Create private card access page
- [ ] Update collection page
- [ ] Add bulk visibility actions
- [ ] Test all UI components

### **Phase 4: Search** ✅
- [ ] Create search page
- [ ] Create search API
- [ ] Add to navigation
- [ ] Test search functionality

### **Phase 5: Testing** ✅
- [ ] Test private card access
- [ ] Test public card access
- [ ] Test visibility toggle
- [ ] Test search
- [ ] Test as owner
- [ ] Test as non-owner
- [ ] Test logged out

### **Phase 6: Documentation** ✅
- [ ] Update user guide
- [ ] Add privacy policy section
- [ ] Document API endpoints
- [ ] Create video tutorial

---

## 🚀 Recommended Implementation Order

### **Week 1: Core Functionality**
1. Day 1-2: Database migration
2. Day 3-4: Backend APIs (visibility check, update)
3. Day 5: Frontend toggle and badge

### **Week 2: Features & Polish**
1. Day 1-2: Search functionality
2. Day 3: Private card access page
3. Day 4: Collection page updates
4. Day 5: Testing and bug fixes

### **Week 3: Enhancement & Launch**
1. Day 1: Bulk actions
2. Day 2: Share features
3. Day 3: Analytics & monitoring
4. Day 4: Documentation
5. Day 5: Production deployment

---

## 📝 Files to Create/Modify

### **New Files**:
1. `migrations/add_card_visibility.sql` - Database migration
2. `src/app/api/cards/[id]/visibility/route.ts` - Visibility update API
3. `src/app/api/cards/search/route.ts` - Search API
4. `src/app/search/page.tsx` - Search page

### **Modified Files**:
1. `src/app/api/sports/[id]/route.ts` - Add visibility check
2. `src/app/api/vision-grade/[id]/route.ts` - Add visibility check
3. `src/app/sports/[id]/CardDetailClient.tsx` - Add toggle and badge
4. `src/app/collection/page.tsx` - Add visibility indicators

---

## 💡 Future Enhancements

### **Optional Features** (Phase 9+):
1. **Public Gallery Page**: Browse all public cards
2. **User Profiles**: Public profile page showing user's public cards
3. **Share Statistics**: Track how many views each public card gets
4. **QR Code Sharing**: Generate QR codes for public cards
5. **Embeddable Cards**: Allow public cards to be embedded on other websites
6. **Privacy Presets**: "Make all my cards public/private"
7. **Scheduled Visibility**: Set card to become public at specific date
8. **Visibility History**: Log when visibility was changed

---

## 🎯 Success Metrics

**Track These**:
- % of cards set to public vs private
- Number of search queries per day
- Views on public cards (if tracking implemented)
- Share button clicks on public cards
- Time to toggle visibility (UX metric)

**Goals**:
- < 2 seconds to toggle visibility
- 100% uptime for visibility API
- No unauthorized access to private cards
- Search response time < 500ms

---

## ⚠️ Important Notes

1. **Default to Private**: New cards should be private by default for user privacy
2. **Clear Communication**: Make it obvious what "public" means
3. **Easy Reversal**: Users can always change back to private
4. **No Deletion Required**: Private cards stay in database, just hidden
5. **Owner Override**: Owner can always view their own cards regardless of visibility

---

**Status**: 📋 Ready for Implementation
**Estimated Time**: 2-3 weeks for full implementation
**Priority**: High (user-requested feature)
**Complexity**: Medium

---

**Last Updated**: 2025-10-21
**Next Step**: Review plan and begin Phase 1 (Database Migration)
