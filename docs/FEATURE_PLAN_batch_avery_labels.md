# Feature Plan: Batch Avery Label Printing

**Created:** January 5, 2026
**Status:** Planning
**Priority:** TBD

---

## Overview

Enable users to select up to 18 cards from My Collection, arrange their placement on an Avery 6871 sheet (3×6 grid), preview the sheet, and download a single PDF with all labels positioned correctly for printing.

---

## Requirements

| Requirement | Decision |
|-------------|----------|
| Maximum labels per sheet | 18 (hard limit) |
| Reorder/drag-drop labels | Yes - for partial sheet continuity |
| Remember last position | No |
| Preview before download | Yes |

---

## Current State (Already Built)

| Component | Status | Location |
|-----------|--------|----------|
| Avery 6871 template specs | Complete | `src/lib/averyLabelGenerator.ts` |
| Single label generation | Complete | `generateAveryLabel()` |
| Position calculation | Complete | `getLabelPosition()` |
| Collection multi-select | Complete | `src/app/collection/page.tsx` |
| Bulk action bar | Complete | Shows when cards selected |
| Label data generation | Complete | `src/lib/labelDataGenerator.ts` |
| Calibration offsets | Complete | Stored in localStorage |

### Avery 6871 Specifications (Current Implementation)

```
Sheet Size: 8.5" × 11" (Letter)
Label Size: 2.375" × 1.25" (2-3/8" × 1-1/4")
Grid: 3 columns × 6 rows = 18 labels per sheet

Margins:
- Left: 0.326"
- Top: 1.125"
- Horizontal gap: 0.3125"
- Vertical gap: 0.25"
- Border bleed: 0.0625"
```

---

## What Needs to Be Built

### 1. Library Function: `generateAveryLabelSheet()`

**File:** `src/lib/averyLabelGenerator.ts`

**Function Signature:**
```typescript
export async function generateAveryLabelSheet(
  labelDataArray: FoldableLabelData[],
  positionMap: Map<number, number>,  // cardIndex -> gridPosition (0-17)
  offsets?: CalibrationOffsets
): Promise<Blob>
```

**Logic:**
1. Validate max 18 labels
2. Create single-page PDF (letter size, portrait)
3. For each label in positionMap:
   - Get grid position (0-17)
   - Calculate x,y coordinates using existing `getLabelPosition()`
   - Draw label at position using existing `drawLabel()` logic
4. Return PDF blob

**Error Handling:**
- Throw if >18 labels
- Throw if duplicate positions
- Throw if position out of range (0-17)

---

### 2. Component: `BatchAveryLabelModal.tsx`

**File:** `src/components/reports/BatchAveryLabelModal.tsx`

**Props:**
```typescript
interface BatchAveryLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCards: Card[];  // Max 18 cards
}
```

**State:**
```typescript
// Card-to-position mapping (cardId -> position 0-17)
const [positionMap, setPositionMap] = useState<Map<string, number>>(new Map());

// Unassigned cards (not yet placed on grid)
const [unassignedCards, setUnassignedCards] = useState<Card[]>([]);

// Calibration
const [xOffset, setXOffset] = useState(0);
const [yOffset, setYOffset] = useState(0);

// UI state
const [isGenerating, setIsGenerating] = useState(false);
const [isPreviewing, setIsPreviewing] = useState(false);
const [previewUrl, setPreviewUrl] = useState<string | null>(null);
```

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  Print Avery Labels                                            [X]  │
│  6 cards selected • 12 positions available                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  UNASSIGNED CARDS                    LABEL SHEET (Avery 6871)        │
│  ┌────────────────────────┐          ┌─────┬─────┬─────┐             │
│  │                        │          │  1  │  2  │  3  │             │
│  │  Drag cards to sheet   │          │ 🃏  │ 🃏  │     │             │
│  │  or click "Auto-fill"  │          ├─────┼─────┼─────┤             │
│  │                        │          │  4  │  5  │  6  │             │
│  │  ┌──────────────────┐  │          │ 🃏  │ 🃏  │     │             │
│  │  │ Charizard #4     │  │          ├─────┼─────┼─────┤             │
│  │  │ DCM-ABC123       │  │          │  7  │  8  │  9  │             │
│  │  └──────────────────┘  │          │ 🃏  │ 🃏  │     │             │
│  │  ┌──────────────────┐  │          ├─────┼─────┼─────┤             │
│  │  │ Pikachu #25      │  │          │ 10 │ 11 │ 12 │             │
│  │  │ DCM-DEF456       │  │          │     │     │     │             │
│  │  └──────────────────┘  │          ├─────┼─────┼─────┤             │
│  │                        │          │ 13 │ 14 │ 15 │             │
│  └────────────────────────┘          │     │     │     │             │
│                                      ├─────┼─────┼─────┤             │
│  [Auto-fill]  [Clear All]            │ 16 │ 17 │ 18 │             │
│                                      │     │     │     │             │
│                                      └─────┴─────┴─────┘             │
│                                                                      │
│  CALIBRATION (optional)                                              │
│  X Offset: [-0.02"] [─────●─────] [+0.02"]                          │
│  Y Offset: [-0.02"] [─────●─────] [+0.02"]                          │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                    [Cancel]    [Preview]    [Download PDF]           │
└──────────────────────────────────────────────────────────────────────┘
```

**Interactions:**

| Action | Behavior |
|--------|----------|
| Drag card to grid position | Assigns card to that position |
| Drag card from grid to unassigned | Removes from grid |
| Click card in grid | Removes from grid (returns to unassigned) |
| Drag card to occupied position | Swaps the two cards |
| "Auto-fill" button | Places unassigned cards in first available positions (1→18) |
| "Clear All" button | Returns all cards to unassigned list |
| "Preview" button | Generates PDF and shows in modal/new tab |
| "Download PDF" button | Generates and downloads PDF |

**Validation:**
- "Download PDF" disabled if no cards assigned to grid
- Show count: "X cards assigned • Y positions available"

---

### 3. Component: `LabelPositionGrid.tsx`

**File:** `src/components/reports/LabelPositionGrid.tsx`

**Props:**
```typescript
interface LabelPositionGridProps {
  positionMap: Map<string, number>;  // cardId -> position
  cards: Card[];  // All selected cards (for lookup)
  onPositionChange: (cardId: string, newPosition: number | null) => void;
  onSwap: (position1: number, position2: number) => void;
}
```

**Features:**
- 3×6 grid of droppable zones
- Each zone shows:
  - Position number (1-18)
  - If occupied: Card thumbnail + truncated name + serial
  - If empty: Dashed border, "Drop here" hint
- Visual feedback on drag hover
- Click occupied cell to remove card

**Drag & Drop Implementation:**
- Use `@dnd-kit/core` or native HTML5 drag-drop
- Draggable: Card items in unassigned list + cards in grid
- Droppable: Grid cells + unassigned area

---

### 4. Component: `UnassignedCardsList.tsx`

**File:** `src/components/reports/UnassignedCardsList.tsx`

**Props:**
```typescript
interface UnassignedCardsListProps {
  cards: Card[];
  onDragStart: (cardId: string) => void;
}
```

**Features:**
- Scrollable list of cards not yet assigned
- Each card shows: Thumbnail (small) + Card name + Serial
- Draggable items
- Empty state: "All cards assigned to sheet"

---

### 5. Preview Modal/View

**Options:**

**Option A: Inline Preview (Recommended)**
- Replace grid view with PDF preview when "Preview" clicked
- Show rendered PDF in iframe or canvas
- "Back to Edit" button to return to arrangement view

**Option B: New Tab Preview**
- Open PDF in new browser tab
- User can close tab and return to modal

**Option C: Modal-in-Modal**
- Show PDF in overlay on top of current modal
- More complex, not recommended

**Recommendation:** Option A (inline preview with back button)

---

### 6. Collection Page Integration

**File:** `src/app/collection/page.tsx`

**Changes:**

1. **Add state for modal:**
```typescript
const [isBatchLabelModalOpen, setIsBatchLabelModalOpen] = useState(false);
```

2. **Add button to bulk action bar:**
```tsx
{selectedCardIds.size > 0 && selectedCardIds.size <= 18 && (
  <button
    onClick={() => setIsBatchLabelModalOpen(true)}
    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
  >
    Print Labels ({selectedCardIds.size})
  </button>
)}

{selectedCardIds.size > 18 && (
  <span className="text-amber-600 text-sm">
    Max 18 cards for label printing
  </span>
)}
```

3. **Add modal component:**
```tsx
<BatchAveryLabelModal
  isOpen={isBatchLabelModalOpen}
  onClose={() => setIsBatchLabelModalOpen(false)}
  selectedCards={displayedCards.filter(c => selectedCardIds.has(c.id))}
/>
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         COLLECTION PAGE                              │
│  User selects 1-18 cards using checkboxes                           │
│  Clicks "Print Labels (N)" button                                    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BATCH AVERY LABEL MODAL                         │
│  Cards start in "Unassigned" list                                    │
│  User drags cards to grid positions OR clicks "Auto-fill"           │
│  User adjusts calibration if needed                                  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
            [Preview Button]         [Download Button]
                    │                       │
                    ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LABEL GENERATION                                │
│  For each assigned card:                                             │
│    1. getCardLabelData(card) → LabelData                            │
│    2. generateQRCodePlain(cardUrl) → QR data URL                    │
│    3. Build FoldableLabelData object                                │
│  Then:                                                               │
│    generateAveryLabelSheet(allLabelData, positionMap, offsets)      │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           OUTPUT                                     │
│  Preview: Display PDF in modal (iframe/embed)                        │
│  Download: Save as "DCM-AveryLabels-{count}-{timestamp}.pdf"        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

### New Files

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/components/reports/BatchAveryLabelModal.tsx` | Main modal component | ~300 |
| `src/components/reports/LabelPositionGrid.tsx` | 3×6 drag-drop grid | ~150 |
| `src/components/reports/UnassignedCardsList.tsx` | Draggable card list | ~80 |

### Modified Files

| File | Changes | Est. Lines |
|------|---------|------------|
| `src/lib/averyLabelGenerator.ts` | Add `generateAveryLabelSheet()` | ~60 |
| `src/app/collection/page.tsx` | Add button + modal integration | ~30 |

### Dependencies

| Package | Purpose | Status |
|---------|---------|--------|
| `@dnd-kit/core` | Drag and drop | May need to install |
| `@dnd-kit/sortable` | Sortable lists | May need to install |
| `jsPDF` | PDF generation | Already installed |

---

## UI/UX Details

### Grid Cell States

| State | Appearance |
|-------|------------|
| Empty | Dashed gray border, position number, "Drop here" text |
| Hover (dragging over) | Purple dashed border, slight scale up |
| Occupied | Solid border, card thumbnail, name, serial |
| Occupied + Hover | Purple glow, swap indicator |

### Card Item States

| State | Appearance |
|-------|------------|
| Default | Card thumbnail, name, serial, drag handle icon |
| Dragging | Slight opacity reduction, shadow |
| Drag preview | Card follows cursor |

### Button States

| Button | Disabled When |
|--------|---------------|
| Auto-fill | All cards already assigned |
| Clear All | No cards assigned |
| Preview | No cards assigned |
| Download PDF | No cards assigned |

### Responsive Design

| Breakpoint | Layout |
|------------|--------|
| Desktop (≥1024px) | Side-by-side: Unassigned list + Grid |
| Tablet (768-1023px) | Stacked: Grid on top, Unassigned below |
| Mobile (<768px) | Full-screen modal, stacked layout, smaller grid cells |

---

## Validation & Error Handling

| Scenario | Handling |
|----------|----------|
| 0 cards selected | Button not shown in collection |
| >18 cards selected | Show warning, button disabled |
| Card missing grade data | Include with "N/A" grade, show warning |
| QR generation fails | Show error toast, allow retry |
| PDF generation fails | Show error toast, allow retry |
| Duplicate position assignment | Prevent (swap instead) |

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User closes modal without downloading | Confirm dialog: "Discard arrangement?" |
| Very long card names | Truncate with ellipsis (existing logic) |
| Japanese/CJK card names | Use ASCII fallback (existing logic) |
| Card without image | Show placeholder thumbnail |
| Slow QR generation | Show loading spinner per card |
| Large batch (18 cards) | Show progress indicator during generation |

---

## Testing Checklist

### Unit Tests
- [ ] `generateAveryLabelSheet()` generates valid PDF
- [ ] Position mapping correctly places labels
- [ ] Calibration offsets apply correctly
- [ ] Validation rejects >18 labels

### Integration Tests
- [ ] Modal opens with correct cards
- [ ] Drag-drop assigns cards to positions
- [ ] Auto-fill places cards correctly
- [ ] Clear All resets state
- [ ] Preview generates and displays PDF
- [ ] Download triggers file save

### Manual Testing
- [ ] Test with 1 card
- [ ] Test with 18 cards (full sheet)
- [ ] Test drag-drop on mobile (touch)
- [ ] Test with mixed categories (Pokemon + Sports)
- [ ] Print test sheet and verify alignment
- [ ] Test calibration adjustments

---

## Implementation Order

### Step 1: Library Function
1. Add `generateAveryLabelSheet()` to `averyLabelGenerator.ts`
2. Test with mock data

### Step 2: Grid Component
1. Create `LabelPositionGrid.tsx`
2. Implement 3×6 grid layout
3. Add drag-drop zones (without drag logic yet)

### Step 3: Unassigned List
1. Create `UnassignedCardsList.tsx`
2. Show card items with thumbnails

### Step 4: Drag & Drop
1. Install `@dnd-kit` packages
2. Implement drag from list to grid
3. Implement drag within grid (swap)
4. Implement drag back to unassigned

### Step 5: Modal Shell
1. Create `BatchAveryLabelModal.tsx`
2. Integrate grid + list components
3. Add Auto-fill and Clear All buttons

### Step 6: Preview
1. Add Preview button
2. Generate PDF blob
3. Display in iframe/embed

### Step 7: Download
1. Add Download button
2. Generate PDF and trigger download

### Step 8: Collection Integration
1. Add button to bulk action bar
2. Wire up modal open/close
3. Pass selected cards to modal

### Step 9: Polish
1. Add loading states
2. Add error handling
3. Mobile responsive adjustments
4. Accessibility review

---

## Estimated Scope

| Phase | Components | Lines | Time |
|-------|------------|-------|------|
| Library function | 1 | ~60 | — |
| UI Components | 3 | ~530 | — |
| Collection integration | 1 | ~30 | — |
| **Total** | **5** | **~620** | — |

---

## Future Enhancements (Out of Scope)

- Multi-sheet support (>18 cards)
- Save/load label arrangements
- Batch download as ZIP
- Direct print integration
- Label templates (different Avery sizes)
- Drag to reorder within unassigned list
