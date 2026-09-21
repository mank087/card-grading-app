# Card detail V2 — Phase 0 inventory & baseline

Date: 2026-09-21
Plan: `docs/PLAN_CARD_DETAIL_REDESIGN_2026-09-21.md`
Status: Phase 0 delivered. Flag + switch are live in code and default to the current page.

---

## 1. One change to the approved plan

**The per-user allowlist (`CARD_DETAIL_V2_USER_IDS`) cannot be built as specified.**

Sessions live in `localStorage` via `src/lib/directAuth.ts`, and **no server component in this app reads cookies** (`grep -rl "cookies()" src/app` returns nothing). A server component therefore cannot know who is asking, so a server-side per-user flag is not implementable without new auth plumbing.

Rollout is staged **by category** instead. That is what the plan wanted anyway — Pokémon pilot, then one category at a time — and it keeps the decision on the server where the kill switch belongs. Reviewers get V2 by deploying a preview with `CARD_DETAIL_V2=on`.

Everything else in §4 of the plan is built exactly as approved: server-side (non-`NEXT_PUBLIC_`) flag, `?v=1`/`?v=2` override, legacy clients untouched, rollback with no redeploy.

---

## 2. Flag and switch (built)

| File | Role |
| --- | --- |
| `src/lib/featureFlags/cardDetailV2.ts` | Resolves version per request |
| `src/lib/featureFlags/cardDetailV2.test.ts` | 24 tests, passing |
| `src/app/pokemon/[id]/CardDetailV2Client.tsx` | Phase 1 build site (scaffold today) |
| `src/app/pokemon/[id]/page.tsx` | The switch — **only** legacy file touched, 3 small edits |

`CARD_DETAIL_V2` modes:

| Value | Effect |
| --- | --- |
| unset / `off` / `false` / `0` | Every category serves the current page. **Default.** |
| `on` / `true` / `all` | Every category serves V2 |
| `pokemon` / `pokemon,sports` | Only the listed categories serve V2 |

`?v=1` and `?v=2` override the mode so both pages can be compared on one card — but are **powerless when the mode is `off`**, and there is a test pinning that. A kill switch a URL can defeat is not a kill switch.

**Rollback: set `CARD_DETAIL_V2=off` in Vercel.** Takes effect on the next request. No redeploy, no revert commit, no data change.

The eight `CardDetailClient.tsx` files are byte-identical to what they were, and stay that way for the whole project.

---

## 3. Anchor map

All eight clients, plus the tour's own step list. This is the compatibility contract V2 must honour.

| Anchor | Present in | V2 section |
| --- | --- | --- |
| `tour-card-images` | all 8 | Hero (showcase) |
| `tour-visibility-toggle` | all 8 | Hero (record actions) |
| `tour-grade-score` | all 8 | Hero (grade summary) |
| `tour-subgrades` | all 8 | Hero (grade summary) |
| `tour-condition-summary` | all 8 | Grade details |
| `tour-download-buttons` | all 8 | Reports |
| `tour-edit-details` | all 8 | Overview (card facts) |
| `tour-card-info` | pokemon, mtg, onepiece, yugioh, starwars — **not** sports, lorcana, other | Overview (card facts) |
| `tour-live-market-pricing` | all except mtg | Market & portfolio |
| `tour-market-pricing` | all except mtg | Market & portfolio |
| `tour-optic-score` | **lorcana only** | Grade details |

### Correction (same day, after self-review)

An earlier version of this section claimed `OnboardingTour` had four dead steps costing ~19 seconds. **That was wrong.** My grep matched only literal `id="tour-…"`; the remaining anchors are attached through a `tourId="…"` prop on the collapsible sections. All eight clients carry all of them:

| Anchor (via `tourId=`) | Present in | V2 section |
| --- | --- | --- |
| `tour-card-info` | all 8 | Overview (card facts) |
| `tour-centering` | all 8 | Grade details |
| `tour-optic-score` | all 8 (lorcana via `id=`) | Grade details |
| `tour-market-value` | all 8 | Hero value panel / Market & portfolio |
| `tour-pro-estimates` | all 8 | Market & portfolio |
| `tour-insta-list` | all 8 | Hero InstaList panel |

The tour is healthy and needs no repair. The contract for V2 is simply: **all 16 anchors above must exist, and a collapsed/hidden section must open when the tour or a hash targets it** (the legacy page does this through `setCollapsibleOpen`). `#tour-market-value` is also an in-page link target from the hero of the legacy page.

---

## 4. Action & permission inventory

The action surface is **uniform across all eight categories**. Every client imports the same 16 components:

`CardBinderPicker` · `DefectOverlay` · `DownloadReportButton` · `EbayListingButton` · `EditCardDetailsButton` · `EditCardLabelModal` · `GradeReviewButton` · `IdentityReview` · `ImageZoomModal` · `LabelStyleDropdown` · `MarkAsSoldButton` · `OrgBrandingBadge` · `SectionDefects` · `SoldBanner` · `ThreePassSummary` · `UserConditionReport`

This is better news than the plan assumed. The shared shell can own all sixteen, and the category adapter shrinks to almost nothing.

### The one real adapter axis: pricing

| Category | Pricing component |
| --- | --- |
| pokemon | `PokemonPriceLookup` |
| sports | `PriceChartingLookup` |
| mtg | `MTGPriceLookup` |
| lorcana | `LorcanaPriceLookup` |
| onepiece | `OnePiecePriceLookup` |
| yugioh, starwars, other | `OtherPriceLookup` |

Six components across eight categories. The adapter interface is therefore: **identity fields + which pricing component + which anchors exist.** That is the whole of it.

### Ownership gating (unchanged, and a known risk)

Owner-only content is gated in-client by `session?.user?.id === card?.user_id` at 6+ sites in each file, against a `getStoredSession()` read. The data fetch is `/api/pokemon/{id}?...&user_id=<client-supplied>`. This is gap **G6** and the existing open code-audit item. V2 reproduces the current behaviour and adds no new owner-only surface without a server check.

---

## 5. Performance baseline

`next build` is not run in the project directory (it 500s every dev route until restart). Field LCP/INP/CLS must be measured on the staging deploy; those numbers are **not** captured here and I will not estimate them.

What is measurable statically today:

| Measure | Value |
| --- | --- |
| Pokémon client | 7,191 lines, 66 eager imports |
| Dynamic imports / `next/dynamic` in the Pokémon client | **0** |
| All eight clients | ~55,700 lines |
| pokemon↔sports divergence (category token normalised) | 2,159 lines (~31%) |

**Concrete finding:** `DownloadReportButton` statically imports `@react-pdf/renderer` and `qrcode` (lines 4 and 8), and every card detail client statically imports `DownloadReportButton`. With zero dynamic imports anywhere in the client, **the PDF renderer is in the initial bundle of every card detail page**, for every visitor, including those who never download anything. That is the single clearest loading win available and it maps directly to the handoff's checklist item about loading PDF/chart/listing code on demand. Phase 4 target.

---

## 6. Verification status

| Item | Status |
| --- | --- |
| Flag resolution logic | ✅ 24 unit tests passing |
| Whole-project typecheck (`npx tsc --noEmit`) | ✅ clean, exit 0 |
| Legacy clients unmodified | ✅ no edits to any `CardDetailClient.tsx` |
| Switch rendering in a browser | ⚠️ **not yet verified** |

Browser verification needs a real Pokémon card UUID, which needs a production DB read that is blocked in this environment. To close it: either grant the read, or paste any Pokémon card URL from your collection and I will run the dev server with `CARD_DETAIL_V2=pokemon` and confirm both branches (default → V2 scaffold, `?v=1` → current page).

---

## 7. Phase 1 entry criteria

Ready to start. Order of work:

1. `CardDetailViewModel` + Pokémon adapter (identity, images, grade, permissions, `resolveCardValue`, listing state, effective label design).
2. `CardDetailShell` + section nav + **anchor compatibility layer** (all 16 anchors in §3).
3. `GradeSummary`, `CardValueSummary` (no chart), `CardFacts`.
4. `InstaListPanel` driven by the **existing** `GET /api/ebay/listing/check?cardId=` (JWT-authed, already the modal's duplicate guard). No new endpoint needed.
5. Wire all five sections to the existing 16 components.
