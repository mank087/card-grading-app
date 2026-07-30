# Binders — collection organization design

**Date:** 2026-07-30
**Status:** proposal, nothing built
**Author:** design pass against the current `/collection` implementation

---

## 1. The problem

Users ask to "reorder their collection and organize it how they want." In practice that
request bundles three separate needs:

| What they say | What they mean | Covered today? |
|---|---|---|
| "Let me reorder" | My best cards should be at the top | No |
| "Let me organize it" | I want my own named groupings | No |
| "It keeps resetting" | Remember my sort/filter between visits | No |

The collection today has sort (name / grade / value / date / set, both directions),
category + sport filters, a multi-field search, grid/list toggle, bulk select, and the
new ownership tabs. Sorting is therefore largely solved. Grouping is not.

### The constraint that shapes everything

Power users hold **500–2,000+ cards** (per the cap comment in
`src/app/api/ebay/eligible-cards/route.ts`), and `/api/cards/my-collection` currently
returns **every card in one response** with client-side filtering and a "Load More" that
slices 20 at a time.

That rules out the obvious answer. Hand-ordering 2,000 items is not a gesture a human can
perform — moving a card from position 3 to position 1,400 means scroll-dragging through
70 "Load More" clicks. **Every app that offers manual ordering scopes it to small curated
sets**: a Spotify playlist, an Apple Photos album, a Trello column. None let you
hand-order a 2,000-item library.

So: manual order is the right tool, scoped to a binder rather than the whole collection.

---

## 2. The model

A **binder** is a user-created, named container. A card can be in many binders, or none.
"All Cards" remains the master view and is never manually ordered.

This maps onto the physical mental model the hobby already uses, which is why Collectr,
Dex and TCGplayer all converged on the same shape.

Two kinds:

- **Manual binder** — the user adds cards and drags them into the order they want.
- **Smart binder** — a saved filter that populates itself ("every 10", "Pokémon 2023+",
  "anything over $100"). No membership rows, no manual order, zero upkeep.

---

## 3. Schema

```sql
CREATE TABLE binders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  cover_card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  accent_color  TEXT,
  position      NUMERIC NOT NULL,     -- order of the binders themselves
  smart_filter  JSONB,                -- NULL = manual binder
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,
  slug          TEXT,                 -- /collection/<username>/<slug>
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

CREATE TABLE binder_cards (
  binder_id UUID NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
  card_id   UUID NOT NULL REFERENCES cards(id)   ON DELETE CASCADE,
  position  NUMERIC NOT NULL,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (binder_id, card_id)
);

CREATE INDEX idx_binder_cards_order ON binder_cards (binder_id, position, card_id);
CREATE INDEX idx_binder_cards_card  ON binder_cards (card_id);
CREATE INDEX idx_binders_user       ON binders (user_id, position);
```

`card_count` is deliberately **not** denormalised in v1 — a count per binder on the list
screen is a cheap indexed aggregate, and a stale counter is a support ticket. Revisit only
if the list screen measurably drags.

### RLS

Both tables need policies mirroring the `cards` pattern (owner-only read/write), plus one
extra: anonymous read on `binders WHERE is_public = TRUE` and on the `binder_cards` rows
belonging to those binders. See §8 for the privacy rule that goes with it.

---

## 4. Ordering: fractional indexing

This is the detail most implementations get wrong.

`position` is `NUMERIC`, not a sequential integer.

- **Append:** `max(position) + 1024`
- **Insert between a and b:** `(a + b) / 2`
- **Move:** one `UPDATE` of one row

The naive alternative — integer positions renumbered on every drag — rewrites the whole
binder per move. That is slow, it races when two tabs drag at once, and it turns a
50-card binder reorder into 50 row writes.

**Rebalance guard:** when the gap between neighbours drops below `1e-6`, renumber that
binder's rows to clean `n * 1024` spacing in a single transaction. With 1024 spacing and
midpoint inserts this needs ~20 consecutive inserts into the same gap, so it is rare — but
it must exist, or a determined user eventually exhausts float precision on the client.

**Reordering is server-computed.** The client sends intent, not a number:

```
PATCH /api/binders/:id/cards/reorder
{ "cardId": "...", "afterCardId": "..." | null }   // null = move to front
```

The server reads the neighbours, computes the midpoint, writes one row. The client never
invents a position — that is what makes concurrent drags safe.

---

## 5. API surface

| Method | Route | Notes |
|---|---|---|
| `GET` | `/api/binders` | list + card counts + cover thumb |
| `POST` | `/api/binders` | create (manual or smart) |
| `PATCH` | `/api/binders/[id]` | rename, description, cover, colour, visibility, position |
| `DELETE` | `/api/binders/[id]` | **removes the binder only, never the cards** |
| `GET` | `/api/binders/[id]/cards` | ordered, keyset-paginated |
| `POST` | `/api/binders/[id]/cards` | bulk add `{ cardIds: [...] }` |
| `DELETE` | `/api/binders/[id]/cards` | bulk remove `{ cardIds: [...] }` |
| `PATCH` | `/api/binders/[id]/cards/reorder` | see §4 |
| `GET` | `/api/cards/[id]/binders` | which binders hold this card |

### Deleting a binder must not delete cards

This is the single highest-risk confusion in the feature, and it is the same failure mode
as the delete-vs-sold work: a destructive action whose blast radius the user misjudges.
The confirm copy must say it outright — *"Delete this binder? The 43 cards in it stay in
your collection."* — and the API must never touch `cards`.

### Pagination

`GET /api/binders/[id]/cards` uses **keyset** pagination, not offset:

```sql
WHERE binder_id = :id AND (position, card_id) > (:lastPos, :lastId)
ORDER BY position, card_id
LIMIT 50
```

Offset pagination breaks under reordering — move a card and rows shift across page
boundaries, so users see duplicates or gaps mid-scroll. Keyset is stable.

This is also the moment to move `/api/cards/my-collection` to server-side
filtering + paging. It already returns every card for every user; adding a second
per-binder view on top of that is the point where it stops being survivable. **Treat it as
part of this work, not as a surprise discovered afterwards.**

---

## 6. Interaction with what already exists

| Existing behaviour | Decision |
|---|---|
| **Soft-deleted cards** (`deleted_at`) | Filter out of binder views. Membership row stays, so restoring a card silently returns it to its binders — a nice property that falls out of the design for free. |
| **Sold cards** (`ownership_status`) | Stay in their binders, shown with the SOLD badge. A binder is a record of what you had; silently removing cards on sale would be surprising. See open decision D2. |
| **Ownership tabs** (Owned/Sold/Archived) | Nest *inside* the selected binder — binder is the outer scope, ownership the inner filter. |
| **Search + sort** | Operate within the selected binder. |
| **Bulk select** | Already exists; gains an "Add to binder ▾" action. This is the primary way cards get into binders. |
| **Public collection** (`/collection/[username]`) | Unchanged. Binder sharing is additive, §8. |
| **Card detail pages** | Gain a small "In binders: X, Y ＋" control. |

---

## 7. UI

### Web

A horizontally scrollable **binder strip** above the existing controls:

```
[ All Cards ] [ 🟣 Vintage Football 43 ] [ 🔵 PC 12 ] [ ⭐ Graded 10s ] [ + New binder ]
```

Selecting a binder scopes everything below it — the ownership tabs, search, sort and
category filters keep working inside that scope. "All Cards" is the default and behaves
exactly as the page does today, so nothing changes for users who never make a binder.

**Drag is only enabled when a binder is selected *and* sort is set to "Custom".** If the
user is sorting by grade and tries to drag, the card doesn't move and a hint appears:
*"Switch to Custom order to rearrange."* This is the Notion/Airtable rule, and it avoids
the worst bug in this class of feature — dragging a card, seeing it snap back, and not
understanding why (the sort was overriding it).

Empty state matters: a first-time user sees a single "＋ New binder" chip with a one-line
explanation, not an empty rail.

### Mobile

Binders list screen → binder detail. **v1 mobile is view / add / remove only; reordering
happens on web.** React Native drag-and-drop inside a scroll view is genuinely fiddly
(`react-native-draggable-flatlist` plus gesture-handler conflicts with the existing
`ScrollView` on the card screens), and it is not worth blocking the whole feature. Mobile
reorder is a fast follow once the model is proven.

---

## 8. Sharing a binder

`binders.is_public` + `slug` → `/collection/<username>/<slug>`, reusing the existing
`/api/cards/public-collection` pattern and the `profiles.username` lookup.

**Privacy rule: a public binder shows only the cards that are themselves public.** A
binder being public must never override an individual card's `visibility`. Without that
rule, adding a private card to a shared binder silently publishes it.

This is also a partial answer to the still-open *public-by-default + indexed* item from
the July privacy audit: today the only sharing option is "my entire collection." A binder
lets someone share a curated subset instead — better privacy posture *and* a better
sharing artefact.

---

## 9. Phasing

| Phase | Scope | Rough effort |
|---|---|---|
| **1** | Schema + RLS, binder CRUD, add/remove, binder strip, custom order + drag on web, server-side paging for binder views | 3–4 days |
| **2** | Mobile: binder list, binder detail, add/remove | 1–2 days |
| **3** | Smart binders (reuse existing filter shape in `smart_filter`) | 1–2 days |
| **4** | Public binder sharing | 1 day |
| **5** | Mobile drag reorder | 1 day |

Phase 1 is the commitment. Everything after it is independent and can be dropped or
resequenced.

---

## 10. What I would NOT build

- **Nested binders / sub-folders.** Doubles the navigation complexity and almost nobody
  uses depth beyond one level. Tags or multiple binder membership cover the same need.
- **Manual ordering of "All Cards".** §1.
- **A binder limit.** No reason to cap it; the indexes handle it.
- **Auto-filing rules on manual binders.** That is what smart binders are for; two
  mechanisms doing the same job is how this gets confusing.

---

## 11. Open decisions

**D1 — Binder strip on `/collection`, or a separate `/collection/binders` page?**
Recommend the strip: keeps one collection surface and lets binders share the existing
search/sort/bulk machinery. A separate page means duplicating all of it.

**D2 — Do sold cards stay in binders?**
Recommend yes, badged. But a "For Sale" binder arguably wants them gone on sale. The
middle path is a per-binder `hide_sold` toggle, default off. Worth deciding before
building rather than retrofitting.

**D3 — Does pinning still ship?**
Pin-to-top is half a day and covers "my best cards first" without any binder navigation.
Binders do not replace it — different need. Recommend shipping pin + view-persistence
*first* as a quick win, then binders.

**D4 — Mobile reorder in v1?**
Recommend no (§7).

**D5 — Default binders on signup?**
Seeding something like "Favourites" gives the feature discoverability, but pre-made empty
containers read as clutter to users who don't want them. Lean no; rely on the empty state.
