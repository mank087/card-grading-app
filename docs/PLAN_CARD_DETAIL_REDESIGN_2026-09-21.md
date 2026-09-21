# Card detail redesign — implementation plan (developer response)

Date: 2026-09-21
Source: `docs/mockups/DCM-card-details-developer-handoff-2026-09-21/card-detail-review/`
Status: plan only. No application code changed.

---

## 1. Review of the approach

The direction is sound and I recommend building it. Three points in its favour:

- It surfaces the three things that actually monetise a graded card (labels/holders, value, InstaList) without demoting the grade. Today all three sit *below* the report stack on a ~7,000-line page.
- It is almost entirely a **presentation** change. Nothing in the plan asks for new grading math, new price resolution, or new export generators. That keeps it off the grading engine entirely.
- The handoff is honest about what the prototype does not prove. I verified its claims against the repo and it was accurate on every one I checked.

Two places I disagree with the handoff, both narrowing scope:

- **Drop the value sparkline and the "↗ 6.3% past 30 days" chip from Phase 1.** `card_price_history` is written by the price cron but is read by no UI today, and the portfolio review (Sept 2026) found the eBay-fallback path never stamps `dcm_price_updated_at`, leaving ~21k rows stale. A trend line built on that is worse than no trend line. Ship the number + source + freshness; add history only after a coverage query says the data supports it.
- **Do not pilot Pokémon + sports together.** Sports is the most divergent client (see §3). Pilot Pokémon alone through Phase 2, then take sports as the first rollout category — it will expose the adapter seams with the shell already stable.

### Functionality at risk

| Risk | Why | Mitigation |
| --- | --- | --- |
| Report anchors / QR / guided tour | `ReportSectionNav` links 7 `#tour-*` anchors; `OnboardingTour` targets them; verify URLs and old shared report links point at them | Anchor-to-section map + a test that every `tour-*` id still resolves and reveals its section |
| Label ↔ print parity | The hero preview and the print PDF are two renderers today | Phase 2 gate: preview and generated file must agree on identity, grade, style, serial, QR (see gap G1) |
| Sold / org / public views | `SoldBanner`, `MarkAsSoldButton`, `OrgBrandingBadge`, `visibility` all gate content in-page | Behaviour matrix (owner / public / sold / org) tested per phase, not at the end |
| Ownership | Owner gating is computed client-side from `getStoredSession()` and the API takes a client-supplied `user_id` | Tracked as G6. Do **not** let the redesign add new owner-only surfaces without a server check |

---

## 2. Confirmed integration gaps

Each verified against current source.

**G1 — The slab holder cannot show rendered label artwork.**
`LabelMockup`'s `labelImages` prop is documented and implemented as *"Only honoured by the One-Touch and Toploader mockups"* (`src/components/labels/LabelMockup.tsx:50-55`). The slab path renders `SlabFrontLabel`/`SlabBackLabel` from the DOM, which only knows the built-in modern/classic designs. A Heritage or saved-custom slab therefore cannot be composited into the hero slab today. This is the single largest piece of new engineering in the project.
*Fix:* extend the slab mockup to accept the same `labelImages` data URLs the compact holders already take, fed from `useLabelPreview` / the Heritage and vector generators, so preview and print draw from one source.

**G2 — Holder × style compatibility is undefined.**
`resolveCompactHeritage` already encodes that the compact holders cannot honour per-grade chip colours or layout moves. There is no equivalent rule for custom slab dimensions into Avery 6871/8167.
*Fix:* a small `holderStyleSupport(holder, style, config)` table returning `supported | adapted | unsupported` + a reason string. Unsupported must say so; never stretch or silently substitute.

**G3 — Label Studio preselect takes a serial, not a card id.**
`LabelStudioClient.tsx:2979-2984` reads `?card=` and matches `c.serial === preselectedSerial`. Holder, style and return-target params do not exist.
*Fix:* keep `?card=<serial>`; add `?holder=`, `?style=`, `?return=` as new optional params with an allowlisted return path.

**G4 — There is no draft state for single listings.** *(corrected after self-review)*
`ebay_listings.status` is `active | sold | ended`; `draft` exists only for bulk batches. A per-card lookup **does** exist — `GET /api/ebay/listing/check?cardId=` (JWT-authed, verifies against eBay, already used by `EbayListingModal` as its duplicate guard). An earlier draft of this plan said no such endpoint existed; that was wrong.
*Fix:* drive the panel from the existing check endpoint: *Connect eBay → Create listing → View active listing → Sold*. **Do not ship a "resume draft" affordance** — the mockup shows one and single listings have no drafts. No new endpoint required.

**G5 — Portfolio has no card-focused entry point.**
`src/app/market-pricing/page.tsx` reads no search params.
*Fix:* Phase 1 links to `/market-pricing` plainly; add `?card=<id>` scroll/highlight in Phase 3.

**G6 — Ownership is enforced in the client.**
The detail client fetches `/api/pokemon/{id}?...&user_id=<client-supplied>` and computes `isOwner` from local session. Private purchase data and owner-only exports must not rely on that.
*Fix:* this is the existing open code-audit item, not created by the redesign. The redesign must not widen it; anything owner-only that the new page adds gets a server check. Recommend fixing it as its own workstream.

**G7 — Purchase price / unrealised gain does not exist.**
No `purchase_price`, `cost_basis` or equivalent anywhere in `src` or `supabase/migrations`. The mockup's "Purchase price $145.00 / Unrealized gain +$40.00" panel is unbacked.
*Fix:* cut from scope. It needs a migration, a private-field access rule and a portfolio rollup. Separate project.

**G8 — No price history surface.** (see §1) `card_price_history` is written, never read by UI. Charts deferred.

**Non-gaps — verified working:** shop ids `traditional-graded-slabs`, `avery-8167`, `avery-6871`, `zion-magpro` all exist in `src/lib/shopProducts.ts`; `resolveCardValue` + `valueGuard` already give hero and portfolio one number with a withheld state, so the hero needs no new valuation logic.

---

## 3. Scale of the work

| Client | Lines |
| --- | --- |
| pokemon | 7,191 |
| yugioh | 7,094 |
| starwars | 7,055 |
| onepiece | 7,053 |
| lorcana | 7,002 |
| other | 6,805 |
| sports | 6,768 |
| mtg | 6,744 |
| **total** | **~55,700** |

Normalising the category token out of pokemon vs sports and diffing leaves **~2,159 differing lines (~31%)**. So roughly 70% is common boilerplate that collapses into the shell, and ~30% per category is genuine adapter work — identity fields, category pricing component, category-specific report blocks. That ratio is the basis for the per-category rollout estimate below.

---

## 4. Preserving the current page (revert path)

This is a hard requirement and it shapes the file layout.

1. **The eight existing `CardDetailClient.tsx` files are not edited.** They stay byte-identical on the branch for the whole project. The new page is a sibling file.
2. `src/app/{category}/[id]/page.tsx` picks the client at request time:
   ```
   const v2 = await cardDetailV2Enabled(cardId, userId)   // server-side
   return v2 ? <CardDetailsV2 .../> : <PokemonCardDetails .../>
   ```
3. **The flag is read server-side, not `NEXT_PUBLIC_`.** Next inlines `NEXT_PUBLIC_*` at build time, so a public flag would need a redeploy to roll back. A server-side `CARD_DETAIL_V2` (values: `off` / `allowlist` / `<category list>` / `on`) plus a `CARD_DETAIL_V2_USER_IDS` allowlist flips in the Vercel dashboard and takes effect on the next request.
4. `?v=1` / `?v=2` query overrides on top of the flag, so reviewers can compare the two pages side by side on the same card without touching config.
5. **Rollback = set `CARD_DETAIL_V2=off`.** No revert commit, no redeploy, no data change. The old page is still the one being served to everyone the flag does not name.
6. Because the old clients are untouched, the shared-component extraction is *additive only*: `CardDetailShell` and friends are new files. No refactor of the legacy clients until V2 is at 100% for a full release cycle, at which point deleting them is a separate cleanup PR.

Staging review happens on a Vercel preview deployment of the branch with `CARD_DETAIL_V2=on`, which is also how the acceptance checklist gets walked.

---

## 5. Proposed implementation approach

**Normalised view model first.** One `CardDetailViewModel` built per category adapter: identity, images (front/back + signed-url states), grade + subgrades + findings, permissions, `resolveCardValue` output including the withheld state, listing state, effective label design (`useCustomLabelStyleWithOrg` + `labelStyleResolution`). Every shared component reads only this. Category clients become adapters that produce it, and nothing else.

**Components** (all new files under `src/components/card-detail/`):
`CardDetailShell` · `CardHolderShowcase` · `GradeSummary` · `CardValueSummary` · `InstaListPanel` · `CardDetailSections` · `CardFacts`.

**Reuse, do not re-implement:** `useLabelData` / `slabLabelDataAdapter` for label text; `useLabelPreview` for artwork; `DownloadReportButton` generators for every export; `PokemonPriceLookup` / `PriceChartingLookup` per category; `EbayListingModal` for the editor; `shopProducts` for links. The new page adds **no new generator and no new price path**.

**Anchor compatibility layer.** A map from each `tour-*` id to its owning section. On mount, if `location.hash` names a legacy anchor, open that section, then scroll. `ReportSectionNav` is superseded by the new section nav inside V2 only; the legacy page keeps using it.

**Styling** uses the existing `dcm-*` design tokens in `src/app/design-system.css`, not the mockup's stylesheet. The mockup's palette is close but not identical (`--purple:#6c48b5` vs `--dcm-purple:#9810fa`); brand tokens win.

---

## 6. Phased estimate

Estimates are developer-days for one engineer, and assume the Pokémon-only pilot from §1.

| Phase | Work | Days |
| --- | --- | --- |
| **0 — Inventory & baseline** | Action/permission inventory across the 8 clients, anchor map, desktop+mobile perf baseline, flag plumbing and the dual-client switch | 3–4 |
| **1 — Shell & parity (Pokémon)** | View model + adapter, shell, section nav + anchor compatibility, grade summary, value summary (no chart), InstaList panel on the existing `/api/ebay/listing/check`, all five sections wired to existing components | 8–11 |
| **2 — Holder showcase** | G1 slab artwork path (the big one), G2 compatibility table, holder switching, style selector with preview-vs-saved separation, G3 Label Studio handoff, shop links, **preview/export parity gate** | 9–13 |
| **3 — Category rollout** | sports first (most divergent), then mtg, lorcana, onepiece, yugioh, starwars, other — ~1.5–2 days each incl. its own behaviour matrix | 11–14 |
| **4 — QA, a11y, perf, release** | owner/public/sold/org matrix, keyboard + focus + 200% zoom + 320→1440px, lazy-loading of PDF/chart/listing code, acceptance checklist, rollback rehearsal | 5–7 |
| | **Total** | **36–49 days** |

Excluded by decision, each its own project: purchase cost / gain-loss (G7), price history charts (G8), per-card persistent presentation, server-side ownership hardening (G6), showcase-image export, new marketplace channels.

No migration is required for this scope. If per-card style persistence is later approved, that is the first migration this project would need.

---

## 7. What I need from you before starting

1. **Confirm Pokémon-only pilot** (vs the handoff's Pokémon + sports).
2. **Confirm the cuts** — sparkline/% change, purchase cost, resume-draft — or tell me which to keep and I will price the backing work.
3. **Confirm the flag/rollback shape** in §4, since it determines the file layout from day one.

On approval I will start Phase 0 and come back with the anchor map, the behaviour matrix and the perf baseline before any UI is written.
