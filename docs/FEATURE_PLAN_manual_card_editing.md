# Feature Plan: Manual Card Details Editing

**Created:** December 29, 2024
**Status:** Planning
**Priority:** TBD

---

## Overview

Allow users to manually edit card information (not grades or condition) via an "Edit Details" button on the card detail page. Changes will update the database, regenerate labels, and propagate to all displays including downloadable reports and the collection page.

---

## Problem Statement

Currently, all card information is extracted by AI during the grading process. If the AI misidentifies a card name, set, player, or other details, users have no way to correct it. This feature allows users to fix incorrect information while preserving the integrity of the grade and condition assessment.

---

## Scope

### In Scope
- Editing card identification fields (name, set, number, year, etc.)
- Editing special features (autograph, rookie, memorabilia flags)
- Editing category-specific fields (holofoil type, Pokemon type, etc.)
- Automatic label regeneration after edit
- Updates propagate to all displays and downloads

### Out of Scope
- Editing grades or sub-scores
- Editing condition labels
- Editing AI analysis text
- Editing centering ratios
- Bulk editing multiple cards

---

## Database Schema

### Editable Fields

#### Core Fields (All Categories)

| Field | Database Column | JSONB Path | Type | Required |
|-------|----------------|------------|------|----------|
| Card Name | `card_name` | `conversational_card_info.card_name` | text | Yes |
| Player/Character | `featured` | `conversational_card_info.player_or_character` | text | No |
| Set Name | `card_set` | `conversational_card_info.set_name` | text | No |
| Card Number | `card_number` | `conversational_card_info.card_number_raw` | text | No |
| Year | `release_date` | `conversational_card_info.year` | text | No |
| Manufacturer | `manufacturer_name` | `conversational_card_info.manufacturer` | text | No |
| Serial Number | `serial_numbering` | `conversational_card_info.serial_number` | text | No |

#### Special Features (Checkboxes)

| Feature | Database Column | JSONB Path | Type |
|---------|----------------|------------|------|
| Autographed | `autographed` | `conversational_card_info.autographed` | boolean |
| Rookie Card | `rookie_card` | `conversational_card_info.rookie_or_first` | boolean |
| Memorabilia | `memorabilia_type` | `conversational_card_info.memorabilia` | enum |
| Facsimile Auto | - | `conversational_card_info.facsimile_autograph` | boolean |
| Official Reprint | - | `conversational_card_info.official_reprint` | boolean |

#### Pokemon-Specific Fields

| Field | Database Column | JSONB Path | Type | Options |
|-------|----------------|------------|------|---------|
| Holofoil | `holofoil` | `conversational_card_info.holofoil` | enum | Yes, No, Reverse |
| Pokemon Type | `pokemon_type` | `conversational_card_info.pokemon_type` | enum | Fire, Water, Grass, etc. |
| Pokemon Stage | `pokemon_stage` | `conversational_card_info.pokemon_stage` | enum | Basic, Stage 1, Stage 2, etc. |
| HP | - | `conversational_card_info.hp` | text | Numeric string |
| Card Type | `card_type` | `conversational_card_info.card_type` | enum | Pokemon, Trainer, Energy |

#### MTG-Specific Fields

| Field | Database Column | JSONB Path | Type | Options |
|-------|----------------|------------|------|---------|
| Is Foil | `is_foil` | `conversational_card_info.is_foil` | boolean | - |
| Foil Type | `foil_type` | `conversational_card_info.foil_type` | enum | Standard, Etched, etc. |
| Rarity | `mtg_rarity` | `conversational_card_info.mtg_rarity` | enum | Common, Uncommon, Rare, Mythic |
| Double-Faced | `is_double_faced` | `conversational_card_info.is_double_faced` | boolean | - |
| Set Code | `mtg_set_code` | `conversational_card_info.expansion_code` | text | 3-letter code |

#### Lorcana-Specific Fields

| Field | Database Column | JSONB Path | Type | Options |
|-------|----------------|------------|------|---------|
| Ink Color | `ink_color` | `conversational_card_info.ink_color` | enum | Amber, Amethyst, Emerald, etc. |
| Card Type | `lorcana_card_type` | `conversational_card_info.lorcana_card_type` | enum | Character, Action, Item, etc. |
| Character Version | `character_version` | `conversational_card_info.character_version` | text | - |
| Inkwell | `inkwell` | `conversational_card_info.inkwell` | boolean | - |
| Ink Cost | `ink_cost` | `conversational_card_info.ink_cost` | integer | 1-10 |
| Enchanted | `is_enchanted` | `conversational_card_info.is_enchanted` | boolean | - |

#### Sports-Specific Fields

| Field | Database Column | JSONB Path | Type |
|-------|----------------|------------|------|
| Sport/Category | `sport_or_category` | - | enum |

### Dual Storage Pattern

**Critical Implementation Note:** Card data is stored in TWO locations that must stay synchronized:

1. **Direct database columns** (e.g., `card_name`, `card_set`)
   - Used for database indexing and search
   - Legacy compatibility

2. **`conversational_card_info` JSONB column**
   - Source of truth for display
   - Structured data from AI extraction

When editing, BOTH must be updated to maintain consistency.

### Fields That Trigger Label Regeneration

Any change to these fields requires calling `generateLabelData()`:
- card_name
- featured (player/character)
- card_set
- card_number
- release_date (year)
- serial_numbering
- autographed
- rookie_card
- holofoil (Pokemon)
- is_foil/foil_type (MTG)
- is_enchanted (Lorcana)

---

## API Design

### Endpoint

```
PATCH /api/cards/[id]/details
```

### Request

```typescript
interface UpdateCardDetailsRequest {
  // Core fields
  card_name?: string;
  featured?: string;
  card_set?: string;
  card_number?: string;
  release_date?: string;
  manufacturer_name?: string;
  serial_numbering?: string;

  // Special features
  autographed?: boolean;
  rookie_card?: boolean;
  memorabilia_type?: 'none' | 'patch' | 'jersey' | 'bat' | 'ticket' | 'other';
  facsimile_autograph?: boolean;
  official_reprint?: boolean;

  // Pokemon-specific
  holofoil?: 'Yes' | 'No' | 'Reverse';
  pokemon_type?: string;
  pokemon_stage?: string;
  hp?: string;
  card_type?: 'Pokemon' | 'Trainer' | 'Energy';

  // MTG-specific
  is_foil?: boolean;
  foil_type?: string;
  mtg_rarity?: string;
  is_double_faced?: boolean;
  mtg_set_code?: string;

  // Lorcana-specific
  ink_color?: string;
  lorcana_card_type?: string;
  character_version?: string;
  inkwell?: boolean;
  ink_cost?: number;
  is_enchanted?: boolean;
}
```

### Response

```typescript
interface UpdateCardDetailsResponse {
  success: boolean;
  card: Card;           // Full updated card object
  label_data: LabelData; // Regenerated label data
  message?: string;      // Success/error message
}
```

### Error Responses

| Status | Reason |
|--------|--------|
| 400 | Invalid field values or validation errors |
| 401 | User not authenticated |
| 403 | User does not own this card |
| 404 | Card not found |
| 409 | Card is currently being graded |
| 500 | Database or server error |

### API Implementation Logic

```typescript
// Pseudocode for PATCH handler
async function handleUpdateCardDetails(cardId: string, body: UpdateCardDetailsRequest) {
  // 1. Get authenticated user
  const user = await getAuthenticatedUser();
  if (!user) return 401;

  // 2. Fetch card and verify ownership
  const card = await getCard(cardId);
  if (!card) return 404;
  if (card.user_id !== user.id) return 403;

  // 3. Check if card is being graded
  if (isCardBeingGraded(cardId)) return 409;

  // 4. Validate input fields
  const validation = validateFields(body, card.category);
  if (!validation.valid) return 400;

  // 5. Build update objects
  const columnUpdates = buildColumnUpdates(body);
  const jsonbUpdates = buildJsonbUpdates(body, card.conversational_card_info);

  // 6. Update database
  await supabase.from('cards').update({
    ...columnUpdates,
    conversational_card_info: jsonbUpdates,
    updated_at: new Date().toISOString()
  }).eq('id', cardId);

  // 7. Regenerate label data
  const updatedCard = await getCard(cardId);
  const labelData = generateLabelData(updatedCard);

  // 8. Save label data
  await supabase.from('cards').update({
    label_data: labelData
  }).eq('id', cardId);

  // 9. Return success
  return { success: true, card: updatedCard, label_data: labelData };
}
```

---

## UI Components

### 1. EditCardDetailsButton

**Location:** Card detail page header, near existing action buttons

**Behavior:**
- Only visible to card owner (check user_id match)
- Opens EditCardDetailsModal on click
- Disabled while card is being graded

```typescript
interface EditCardDetailsButtonProps {
  card: Card;
  onEditComplete: (updatedCard: Card) => void;
}
```

**Visual Design:**
- Secondary button style (outline or ghost)
- Edit/pencil icon + "Edit Details" text
- Mobile: Icon only to save space

### 2. EditCardDetailsModal

**Layout:**

```
┌──────────────────────────────────────────────────┐
│  Edit Card Details                          [X]  │
├──────────────────────────────────────────────────┤
│                                                  │
│  BASIC INFORMATION                               │
│  ┌────────────────────────────────────────────┐  │
│  │ Card Name *                                │  │
│  │ [_________________________________]        │  │
│  └────────────────────────────────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────────┐   │
│  │ Player/Character│  │ Set Name            │   │
│  │ [______________]│  │ [_________________] │   │
│  └─────────────────┘  └─────────────────────┘   │
│  ┌─────────────────┐  ┌─────────────────────┐   │
│  │ Card Number     │  │ Year                │   │
│  │ [______________]│  │ [_________________] │   │
│  └─────────────────┘  └─────────────────────┘   │
│  ┌────────────────────────────────────────────┐  │
│  │ Manufacturer                               │  │
│  │ [_________________________________]        │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ Serial Numbering (e.g., /99, /50)          │  │
│  │ [_________________________________]        │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  SPECIAL FEATURES                                │
│  ┌────────────────────────────────────────────┐  │
│  │ ☐ Autographed    ☐ Rookie Card            │  │
│  │ ☐ Facsimile Auto ☐ Official Reprint       │  │
│  │                                            │  │
│  │ Memorabilia: [None ▼]                      │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  POKEMON DETAILS (shown for Pokemon cards)       │
│  ┌────────────────────────────────────────────┐  │
│  │ Holofoil: [Yes ▼]  Pokemon Type: [Fire ▼] │  │
│  │ Stage: [Basic ▼]   HP: [___]              │  │
│  │ Card Type: [Pokemon ▼]                     │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
├──────────────────────────────────────────────────┤
│                      [Cancel]  [Save Changes]    │
└──────────────────────────────────────────────────┘
```

**Form Sections:**

1. **Basic Information** (all categories)
   - Card Name (text, required)
   - Player/Character (text)
   - Set Name (text)
   - Card Number (text)
   - Year (text or year picker)
   - Manufacturer (text)
   - Serial Numbering (text)

2. **Special Features** (all categories)
   - Autographed (checkbox)
   - Rookie Card (checkbox)
   - Facsimile Autograph (checkbox)
   - Official Reprint (checkbox)
   - Memorabilia Type (select: None, Patch, Jersey, Bat, Ticket, Other)

3. **Category-Specific Section** (dynamic based on card.category)
   - Pokemon: Holofoil, Pokemon Type, Stage, HP, Card Type
   - MTG: Foil, Foil Type, Rarity, Double-Faced, Set Code
   - Lorcana: Ink Color, Card Type, Character Version, Inkwell, Ink Cost, Enchanted
   - Sports: Sport/Category

**States:**
- Loading: Show spinner while fetching/saving
- Error: Show error message with retry option
- Success: Show toast and close modal

**Behavior:**
- Pre-fill all fields with current values
- Validate required fields on submit
- Show confirmation if closing with unsaved changes
- Refresh card detail page after successful save

---

## Affected Components & Files

### Files to Create

| File | Purpose |
|------|---------|
| `src/app/api/cards/[id]/details/route.ts` | PATCH endpoint for updating card details |
| `src/components/cards/EditCardDetailsModal.tsx` | Modal form component |
| `src/components/cards/EditCardDetailsButton.tsx` | Trigger button component |
| `src/lib/cardDetailsValidation.ts` | Validation helpers for card fields |

### Files to Modify

| File | Changes |
|------|---------|
| `src/app/pokemon/[id]/CardDetailClient.tsx` | Add EditCardDetailsButton, handle refresh |
| `src/app/sports/[id]/CardDetailClient.tsx` | Add EditCardDetailsButton, handle refresh |
| `src/app/mtg/[id]/CardDetailClient.tsx` | Add EditCardDetailsButton, handle refresh |
| `src/app/lorcana/[id]/CardDetailClient.tsx` | Add EditCardDetailsButton, handle refresh |
| `src/app/other/[id]/CardDetailClient.tsx` | Add EditCardDetailsButton, handle refresh |

### Files That Require No Changes

| File | Reason |
|------|--------|
| `src/lib/labelDataGenerator.ts` | Already regenerates from card fields |
| `src/lib/useLabelData.ts` | Uses generateLabelData dynamically |
| `src/components/CardLabel.tsx` | Renders from labelData prop |
| `src/components/reports/DownloadReportButton.tsx` | Generates fresh labelData on download |
| `src/app/api/cards/my-collection/route.ts` | Reads from same database fields |

---

## Data Flow

### Edit Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INITIATES EDIT                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  User clicks "Edit Details" button on card detail page       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  EditCardDetailsModal opens with current values pre-filled   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  User modifies fields and clicks "Save Changes"             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend validates required fields                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PATCH /api/cards/[id]/details called with changes          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND PROCESSING                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 1. Verify user authentication                          │ │
│  │ 2. Verify card ownership (user_id match)               │ │
│  │ 3. Validate field values                               │ │
│  │ 4. Update direct database columns                      │ │
│  │ 5. Merge into conversational_card_info JSONB           │ │
│  │ 6. Call generateLabelData() to regenerate label        │ │
│  │ 7. Save label_data to database                         │ │
│  │ 8. Update updated_at timestamp                         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  API returns updated card object with new label_data         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend updates state with new card data                   │
│  Modal closes, success toast shown                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  DISPLAYS NOW UPDATED                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ✓ Card Information section shows new values            │ │
│  │ ✓ CardLabel component shows updated label              │ │
│  │ ✓ Download reports will use new data                   │ │
│  │ ✓ Collection page will show updates on next load       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Considerations

### Authentication & Authorization

1. **User must be authenticated** - Verify session token
2. **Ownership verification** - Card's `user_id` must match authenticated user
3. **RLS enforcement** - Supabase Row Level Security as additional layer

### Protected Fields

These fields must NEVER be editable via this endpoint:
- `id` - Card identifier
- `user_id` - Owner reference
- `created_at` - Creation timestamp
- `raw_decimal_grade` - Grade scores
- `dcm_grade_whole` - Whole number grade
- `conversational_decimal_grade` - Conversational grade
- `conversational_whole_grade` - Whole number grade
- `conversational_condition_label` - Condition label
- `conversational_grading` - Full AI analysis
- `conversational_sub_scores` - Sub-grade scores
- `conversational_centering_ratios` - Centering data
- `ai_grading` - Full AI response
- `front_path` / `back_path` - Image paths

### Input Validation

| Field | Validation Rules |
|-------|-----------------|
| card_name | Required, max 200 chars, trim whitespace |
| card_number | Max 50 chars, allow special formats (94/102, SM226) |
| year | 4-digit year or empty, range 1900-current+1 |
| serial_numbering | Max 20 chars, format like /99 or /50 |
| hp | Numeric string or empty |
| ink_cost | Integer 1-10 or null |

### Rate Limiting

- Consider rate limiting edits (e.g., max 10 edits per card per hour)
- Log all edits for audit purposes

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Card is being graded | Return 409 Conflict, disable edit button |
| Empty optional fields | Set to null in database |
| Japanese/Unicode text | Allow full Unicode, handle in display |
| Very long text | Enforce max length limits |
| Invalid category-specific fields | Ignore fields not applicable to category |
| Concurrent edits (same user, multiple tabs) | Last write wins |
| Network failure during save | Show error, allow retry, preserve form state |
| Session expires during edit | Show re-auth prompt, preserve form state |

---

## Testing Checklist

### Unit Tests
- [ ] Validation helpers for each field type
- [ ] JSONB merge logic preserves unedited fields
- [ ] Label regeneration produces correct output

### Integration Tests
- [ ] API returns 401 for unauthenticated requests
- [ ] API returns 403 for non-owner requests
- [ ] API returns 400 for invalid field values
- [ ] API successfully updates all field types
- [ ] Label data is correctly regenerated

### E2E Tests
- [ ] Edit button only visible to card owner
- [ ] Modal opens with current values
- [ ] Form validation shows errors
- [ ] Successful edit updates card detail page
- [ ] Successful edit updates card label
- [ ] Downloaded report uses updated data
- [ ] Collection page shows updated data

### Manual Testing
- [ ] Test each category (Pokemon, Sports, MTG, Lorcana, Other)
- [ ] Test on mobile devices
- [ ] Test with Japanese text
- [ ] Test clearing optional fields
- [ ] Test all special feature checkboxes

---

## Implementation Estimate

| Component | Estimated Lines | Complexity |
|-----------|----------------|------------|
| API endpoint | ~150 | Medium |
| EditCardDetailsModal | ~400 | High |
| EditCardDetailsButton | ~40 | Low |
| Validation helpers | ~100 | Medium |
| CardDetailClient integration (x5) | ~100 total | Low |
| **Total** | **~800** | **Medium** |

### Suggested Implementation Order

1. **Phase 1: API** (Backend)
   - Create PATCH endpoint
   - Add validation logic
   - Test with Postman/curl

2. **Phase 2: Modal Component** (Frontend)
   - Build form with all sections
   - Add category-specific rendering
   - Implement validation UI

3. **Phase 3: Integration** (Connect)
   - Add button to detail pages
   - Wire up modal open/close/submit
   - Handle success/error states

4. **Phase 4: Testing & Polish**
   - Write tests
   - Mobile responsive adjustments
   - Accessibility review

---

## Future Enhancements (Out of Scope)

- Bulk edit multiple cards
- Edit history / audit log UI
- Undo recent edit
- Admin override for any card
- AI-assisted field suggestions
- Auto-complete for set names / player names

---

## Questions to Resolve Before Implementation

1. Should there be a limit on how many times a card can be edited?
2. Should edits be logged for audit purposes?
3. Should we show "Last edited" timestamp on card detail page?
4. Should certain fields require admin approval to change?
5. What happens to market data links (eBay, TCGPlayer) after name changes?

---

## Appendix: Reference Code Locations

### Database Schema
- `database_schema_v3_1_complete.sql`
- `supabase/migrations/add_enhanced_card_fields.sql`

### Label Generation
- `src/lib/labelDataGenerator.ts` - generateLabelData function
- `src/lib/useLabelData.ts` - Helper hooks

### Card Types
- `src/types/card.ts` - Card and ConversationalCardInfo interfaces

### Existing Card APIs
- `src/app/api/cards/[id]/route.ts` - GET single card
- `src/app/api/cards/my-collection/route.ts` - GET user's cards
- `src/app/api/pokemon/[id]/route.ts` - Pokemon-specific

### Card Detail Pages
- `src/app/pokemon/[id]/CardDetailClient.tsx`
- `src/app/sports/[id]/CardDetailClient.tsx`
- `src/app/mtg/[id]/CardDetailClient.tsx`
- `src/app/lorcana/[id]/CardDetailClient.tsx`
- `src/app/other/[id]/CardDetailClient.tsx`
