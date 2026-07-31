# Collection page layout review — web, mobile web, mobile app

**Date:** 2026-07-31
**Status:** recommendations only, nothing changed

---

## 1. The measurement

On desktop (2560×855, live account, 874 cards):

> **479px of chrome before the first card — 56% of the viewport.**

More than half the screen, on a large monitor, before you see a single card. On a
phone it is worse: the category row wraps to two lines and the title block stacks,
so the same chrome runs ~520–600px against a ~930px viewport — **roughly two
thirds of the screen**, leaving about one and a half card tiles visible.

*(The desktop figure is measured. The mobile figure is derived from the row
inventory below — the browser resize wouldn't change the reported viewport, so I
did not measure it directly.)*

---

## 2. Why it happened

Four independent filter axes each got their own permanent full-width row:

| Row | Height | Always shown? |
|---|---|---|
| Site nav | ~40px | yes |
| Title + badges + Share + Est. Value + Rescan + view toggle + label style + count | 72px | yes |
| Binder strip | 46px | when binders exist |
| Binder hint ("Drag any card onto a binder…") | ~20px | when binders exist |
| Owned / Sold tabs | 46px | yes |
| Sold hint ("Sold cards stay verifiable…") | ~20px | on Sold |
| Binder context line + Edit binder | ~24px | in a binder |
| Search | 50px | yes |
| Category chips (8 of them) | ~40px, **wraps to ~80px on mobile** | yes |
| Sub-sport chips | ~40px | when Sports selected |
| eBay sold prompt banner | ~120px | until answered |

That's **5–8 stacked rows in the common case, up to 11**. No single addition was
unreasonable; the accumulation is. Most of these rows are mine, added over the
last few hours without stepping back to look at the whole.

---

## 3. What good collection UIs do instead

The pattern is consistent across Apple Photos, Google Photos, eBay's My eBay,
Airbnb, Notion, TCGplayer and Collectr:

1. **One toolbar, not N rows.** Search + a filter trigger + view toggle share a
   single row.
2. **Filters live in a sheet, not on the page.** A "Filter" button with a count
   badge opens a bottom sheet. Chips on the page show only what's *active*.
3. **Navigation stays visible; filters hide.** Which collection you're in is
   navigation. What you're filtering by is state.
4. **The toolbar collapses on scroll.** Search slides away as you scroll down and
   returns on scroll up.
5. **Active state is shown as removable chips**, not as permanently rendered
   controls.

---

## 4. Recommendations, highest value first

### A. Fold "Sold" into the binder strip — deletes an entire row *and* its hint

The Sold view is **already implemented internally as a smart binder**
(`smart_filter: {ownership_status: 'sold'}`). The separate Owned/Sold tab row is
a second way of expressing something the strip can already express.

```
[ All Cards 874 ] [ Sold 10 ] [ ● Favorites 2 ] [ ● Batman 1 ] [ ＋ New ]
```

One horizontally scrolling row replaces two rows plus two hint lines. It also
makes the model easier to explain: *everything is a view of your collection*.

Saves ~90px. Smallest change, biggest win.

### B. Move categories and sort into a filter sheet

The 8 category chips are the single worst offender on mobile because they wrap to
two lines. Replace with:

```
[ 🔍 Search…                    ] [ ⚙ Filter · 2 ]
```

The sheet holds category, sub-sport, sort field and direction. When filters are
active, show small removable chips under the toolbar — `Pokémon ✕` `Grade ↓ ✕` —
so state is visible without the controls being.

Saves ~40–80px, more on mobile.

### C. Retire the permanent hint lines

"Drag any card onto a binder — or tick cards and use Add to binder" is a one-time
teach occupying a permanent row. Options: show it only until the user first files
a card, make it dismissible, or attach it to the strip as a tooltip. Same for
"Sold cards stay verifiable" — that belongs in the Sold empty state (where it
already appears) and on the sold card itself (where it already appears).

Saves ~40px.

### D. Collapse the title block on mobile

`My Collection` + Founder + VIP + Card Lover + Share + Est. Value + Rescan Prices
+ view toggle + Label Style + card count is ten controls in one block.

On mobile: **title + count** on one line, everything else behind an overflow (⋯)
menu. Badges are decorative — move them to the profile/account screen or shrink
to a single combined badge.

Saves ~40px on mobile.

### E. Make the toolbar sticky and collapsing

Once A–D land, what's left is a single ~56px toolbar. Make it `position: sticky`
and hide it on scroll-down / reveal on scroll-up. The user gets a full screen of
cards while browsing and their tools back with one upward flick.

### F. Denser card tiles (separate, but related)

Tiles currently carry: full card image, slab label, visibility badge, price badge,
sale box (when sold), selection checkbox, ⋯ button, View Details, and a Sold /
Still-mine button. On a phone that's ~1.5 tiles visible after the chrome.

Worth offering a **compact grid** (image + grade + name only, actions on
long-press — the sheet already exists) alongside the current rich tile. Apple
Photos' pinch-to-zoom density control is the reference.

---

## 5. Proposed end state

**Mobile (~430px wide):**

```
┌─────────────────────────────┐
│ My Collection      874   ⋯  │  ← title + count + overflow
├─────────────────────────────┤
│ [All 874][Sold 10][Fav 2]▸ │  ← scope: binders + sold, one scroller
├─────────────────────────────┤
│ [🔍 Search…        ][⚙ 2]  │  ← sticky, collapses on scroll
├─────────────────────────────┤
│ Pokémon ✕   Grade ↓ ✕      │  ← only when filters are active
├─────────────────────────────┤
│  ┌────────┐  ┌────────┐    │
│  │  card  │  │  card  │    │  ← ~3× more cards above the fold
```

Chrome drops from ~520–600px to **~150px** (~200px with active filter chips).

**Desktop:** same structure, toolbar and scope on one line since there's room.

---

## 6. Mobile app

The app has the same stack plus its own header bar and tab bar, so it's tighter
still. Same three moves apply — and it's already better positioned for them:

- It **already has bottom-sheet infrastructure** from the card action sheet, so
  the filter sheet is mostly assembly.
- Its category row is already a horizontal scroller rather than wrapping.
- Search could collapse to a magnifier icon in the header, freeing a whole row.

One app-specific note: the binder strip and the Owned/Sold tabs are currently two
separate scrollers stacked. Recommendation A collapses them into one, which
matters more on a phone than anywhere else.

---

## 7. What I would NOT do

- **Don't hide binders behind the filter sheet.** They're navigation, not a
  filter — burying them kills the feature's discoverability.
- **Don't remove search from the toolbar.** At 874 cards it's the primary tool.
- **Don't add a separate "Filters" page.** A sheet keeps context; a page loses it.
- **Don't auto-hide the scope row.** Knowing which binder you're in has to stay
  visible or people get lost.

---

## 8. Sequencing

| Phase | Work | Saves |
|---|---|---|
| 1 | Fold Sold into the binder strip; retire hint lines | ~130px |
| 2 | Filter sheet for category + sub-sport + sort; active-filter chips | ~40–80px |
| 3 | Collapse the mobile title block into title + count + ⋯ | ~40px |
| 4 | Sticky collapsing toolbar | full screen while scrolling |
| 5 | Mobile app parity | — |
| 6 | Compact grid density option | ~2× cards visible |

Phases 1 and 3 are a few hours and get most of the benefit on mobile. Phase 2 is
the biggest single piece. Phase 6 is optional and independent.

---

## 9. One caveat

I have measured web only. The mobile-app figures are inferred from its component
tree, not from a running device — I still have not been able to run the app. The
row inventory is accurate; the pixel estimates for the app are not.
