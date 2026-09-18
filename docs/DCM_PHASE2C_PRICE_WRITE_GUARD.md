# Phase 2C — revision-guarded price writers

Status: built, uncommitted, no new migration. Uses only columns that are already
live in production: `cards.identity_revision` and
`cards.pricing_selection_revision` (both `int NOT NULL DEFAULT 0`, added by
`supabase/migrations/20260917_identity_confirmation.sql`).

## The race, in plain words

Phase 2A and 2B let an owner correct what a card actually is, and let them pick
which PriceCharting product it should be priced against. A material identity
change bumps `identity_revision` and nulls the stored price columns. Picking or
clearing a product bumps `pricing_selection_revision`.

Every price writer, though, still wrote by card id alone:

1. A refresh reads the card, sees "2021 reprint", and asks PriceCharting or eBay
   for a price. That takes seconds for one card and minutes for a cron batch.
2. While the lookup is in flight the owner corrects the card to the 1960 Topps
   Mantle. Their correction lands: revision up, prices nulled.
3. The lookup returns and writes the 2021 reprint's price onto the corrected
   card, by id.

To the owner, the correction did not stick. Worse, the displayed-value guard
(`src/lib/pricing/valueGuard.ts`) can be beaten this way: it judges the value
that is on the row, and a stale writer can put a value there that no longer
matches the identity. Corrections are about to become common, so the window is
about to be hit often.

## The fix

`src/lib/pricing/guardedPriceWrite.ts`:

- `readPriceRevisions(row)` pulls both counters off a row that was just read.
  A row that did not select the columns yields `null`, meaning "this caller
  cannot guard". `null`/`0` columns yield `0`.
- `guardedPriceUpdate(supabase, cardId, revisions, payload)` issues ONE update
  whose WHERE clause is `id = ? AND identity_revision = ? AND
  pricing_selection_revision = ?`, with `.select('id')` so zero rows matched can
  be told from one. Zero rows means the card moved on: the price is discarded,
  one line is logged, nothing is retried. With `revisions === null` it writes as
  before and returns `unguarded_written`, warning once per process.
- It is a compare-and-set inside the WHERE clause, deliberately not a
  read-then-write. A re-read just before the update would narrow the window, not
  close it.
- It never throws. A price write must never be the reason a grade, a review or a
  cron batch fails.

Every converted writer reads the two columns in the SAME select that reads the
identity it is about to price (`PRICE_REVISION_SELECT`,
`REFRESH_CARD_SELECT`), carries them through the async work, and passes them to
the write. A stale result is silent from the customer's point of view: the next
refresh prices the corrected card.

## Every writer of the guarded columns

Guarded columns: `dcm_price_estimate`, `dcm_price_raw`, `dcm_price_graded_high`,
`dcm_price_median`, `dcm_price_average`, `dcm_price_updated_at`,
`dcm_price_match_confidence`, `dcm_price_product_id`, `dcm_price_product_name`,
`dcm_cached_prices`, `dcm_prices_cached_at`, `ebay_price_lowest`,
`ebay_price_median`, `ebay_price_average`, `ebay_price_highest`,
`ebay_price_listing_count`, `ebay_price_updated_at`, `scryfall_price_usd`,
`scryfall_price_usd_foil`, `dcm_selected_product_id`,
`dcm_selected_product_name`, `dcm_selected_at`. The authoritative list is
`PRICING_INVALIDATION_COLUMNS` in `src/lib/identity/saveCardIdentity.ts`.

| Writer (file:line) | What it writes | Status |
| --- | --- | --- |
| `src/lib/pricing/batchPriceRefresh.ts:140` (`savePriceToDb`) | full DCM estimate + cached payload + matched product | **guarded** — revisions read by the caller's `REFRESH_CARD_SELECT`, returned as `stale: true` |
| `src/lib/pricing/batchPriceRefresh.ts:164` (`markNoMatch`) | `dcm_price_updated_at`, `dcm_price_match_confidence = 'no-match'` | **guarded** — an unguarded no-match marker would mute a corrected card for a week |
| `src/lib/pricing/dcmPriceTracker.ts:244` (`saveDcmPriceCache`) | all nine `dcm_price_*` columns (sports) | **guarded** via `CardForDcmPricing.identity_revision` / `refreshDcmPriceByProductId(..., revisions)` |
| `src/lib/ebay/priceTracker.ts:603` (`savePriceCache`) | six `ebay_price_*` columns | **guarded** via `CardForPricing.identity_revision`; a stale write also skips the `card_price_history` snapshot |
| `src/app/api/pricing/dcm-save/route.ts:97` | nine `dcm_price_*` columns, client-initiated | **guarded** when the client sends both revisions; 409 `price_write_stale` on stale |
| `src/app/api/pricing/pokemon/route.ts:85` | `dcm_cached_prices` + `dcm_price_*` | **guarded**, 409 on stale |
| `src/app/api/pricing/mtg/route.ts:85` | same | **guarded**, 409 on stale |
| `src/app/api/pricing/lorcana/route.ts:85` | same | **guarded**, 409 on stale |
| `src/app/api/pricing/onepiece/route.ts:85` | same | **guarded**, 409 on stale |
| `src/app/api/pricing/other/route.ts:86` | same | **guarded**, 409 on stale |
| `src/app/api/pricing/pricecharting/route.ts:84` | same | **guarded**, 409 on stale |
| `src/app/api/pricing/dcm-select/route.ts:178` (POST) | `dcm_selected_*` + revision bump + clears the old product's prices | **compare-and-set on `pricing_selection_revision`**, 3 attempts, then 409 |
| `src/app/api/pricing/dcm-select/route.ts:264` (DELETE) | clears `dcm_selected_*` + revision bump + clears prices | same |
| `src/lib/gradeReview/detailsPricing.ts:65` (clear) | nulls `ebay_price_*` on a material admin correction | **guarded** |
| `src/lib/gradeReview/detailsPricing.ts:83` (save) | six `ebay_price_*` columns | **guarded** |
| `src/app/api/yugioh/[id]/route.ts:1208` | `dcm_price_*` from a fire-and-forget lookup after grading | **guarded** — the lookup outlives the request, so the owner can confirm or correct before it lands |
| `src/app/api/starwars/[id]/route.ts:1210` | same | **guarded** |
| `src/app/api/mtg/verify/route.ts:134` | Scryfall identity fields **and** `scryfall_price_usd(_foil)` | **guarded** — it writes after a network round trip, and an owner correction must beat Scryfall auto-verify |
| `src/app/api/cron/update-card-prices/route.ts` | nothing directly; calls `refreshCardPrice` | **guarded** via `REFRESH_CARD_SELECT`; stale cards counted as `staleWrites`, never `failed` |
| `src/app/api/market-pricing/refresh-prices/route.ts` | same | **guarded**; stale is neither success nor failure (`staleWrites` in the response) |
| `src/app/api/cards/[id]/refresh-price/route.ts` | same | **guarded**; a stale result reports `refreshed: false` |
| `src/app/api/ebay/cached-price/route.ts` | via `getCardPriceWithCache` | **guarded** (revisions added to its select) |
| `src/app/api/ebay/batch-refresh-prices/route.ts:178` | via `fetchAndCacheCardPrice` | **guarded** (revisions added to its select) |
| `src/app/api/pricing/dcm-cached-price/route.ts` | via `getDcmPriceWithCache` | **guarded**; also passes `dcm_selected_product_id` so the owner's pick wins |
| `src/app/api/pricing/dcm-batch-refresh/route.ts:165` | via `batchRefreshDcmPrices` | **guarded** (that function reads the revisions itself) |
| `src/app/api/vision-grade/[id]/route.ts:2254` | `dcm_price_*` written while GRADING | **out of scope** — a card being graded for the first time has no correction in flight. It calls `fetchAndCacheDcmPrice`/`fetchAndCacheCardPrice` without revisions, so those writes are unguarded by design |
| `src/app/api/mtg/[id]/route.ts:1105` | `scryfall_price_usd(_foil)` inside the `conversational_card_info` JSON, not the columns | **out of scope** — JSON enrichment on the grading path |
| `src/app/collection/page.tsx` (~1126, 1684) | builds bodies for `/api/pricing/dcm-save` and local React state | **unguarded and left that way** — it prices many cards from a list view and does not load `identity_revision` per card. The route accepts a revision-free save; see "Not covered" |
| `src/lib/mtgApiVerification.ts:337`, `src/lib/scryfallApi.ts:445` | pure builders, no database access | not writers |
| `src/app/enterprise/[slug]/card/[id]/page.tsx:193+` | read path only (withholds a value for display) | not a writer |

## The 409 contract

Client-initiated saves (`/api/pricing/dcm-save`, the six category pricing routes,
`/api/pricing/dcm-select`):

- The client sends `identity_revision` and `pricing_selection_revision` in the
  request body. The detail pages load the card with `select('*')`, so both are on
  the card prop and are threaded through the existing lookup props.
- If either has moved, the route answers **HTTP 409** with
  `{ success: false, code: 'price_write_stale', error: <sentence> }` and writes
  nothing.
- The component handles 409 by refetching this card's price **once**, quietly
  (`refetchAfterStalePrice`, guarded by a ref so it can never loop). It never
  shows an error, because nothing went wrong: the owner's correction won.
- A request that sends **neither** revision is accepted and written unguarded,
  exactly as before. That is what keeps an older cached web bundle and the mobile
  app working. A request that sends only one is treated as unguarded too: half a
  compare-and-set is worse than none.
- `parseRequestRevisions` and `priceRevisionPayload` are the only two places that
  decide this, server-side and client-side respectively.

## Owner-selection precedence

A product the owner picked (`dcm_selected_product_id`) wins over automatic
matching everywhere prices are refreshed:

- `refreshCardPrice` (cron, portfolio refresh, single-card refresh) looks up the
  owner's pick before `dcm_price_product_id`. If the picked product has no price
  right now it stops, rather than searching, because a search would price a
  DIFFERENT product and quietly override the pick
  (`source: 'owner-pick-unavailable'`).
- `getDcmPriceWithCache` and `batchRefreshDcmPrices` reprice the pick even when
  the caller asked for a fresh search.
- No automatic refresh ever writes `dcm_selected_product_id`,
  `dcm_selected_product_name` or `dcm_selected_at`, so a refresh can neither
  replace nor clear a pick. Only `/api/pricing/dcm-select` and the Phase 2A
  identity invalidation touch those.
- `/api/pricing/dcm-select` also clears the previous product's stored prices in
  the same UPDATE (`PRICING_INVALIDATION_COLUMNS` minus the `dcm_selected_*`
  fields), so the old product's money cannot linger until the next fetch.
  `dcm_price_at_grading(_date)` is history and is deliberately untouched.

## Not covered

- **Mobile app callers.** `dcm-mobile/` sends no revisions, so its saves are
  written unguarded. They are the same risk as before Phase 2C, not a new one.
  Closing it needs an app release that reads and sends both columns.
- **Grading-time writes.** `src/app/api/vision-grade/[id]/route.ts` writes prices
  as part of grading a card for the first time. Out of scope by decision.
- **`src/app/collection/page.tsx`.** It prices cards from a list view and posts
  to `/api/pricing/dcm-save` without revisions. It would need the two columns in
  its collection query and in each per-card body; not done here to keep the
  change small.
- **`src/lib/gradeReview/detailsPricing.ts` scope.** It still refreshes DCM
  pricing for sports categories only, and it still never touches
  `dcm_price_*` for non-sports cards or `scryfall_price_usd` for MTG. Those gaps
  predate Phase 2C. A material MTG correction relies on the Phase 2A
  invalidation inside `save_card_identity()` to clear the Scryfall prices. The
  admin writer was not refactored beyond adding the guard and the
  material-change clear.
- **`card_price_history`.** History rows are not revision-guarded; a stale eBay
  refresh now simply does not write one, because `fetchAndCacheCardPrice` returns
  early when its cache write is stale.
- **Unguarded fallback is silent after the first warning.** `guardedPriceUpdate`
  logs the "writing unguarded" warning once per process. If a converted writer
  ever loses its revision columns from a select, production will show one line,
  not one per card.

## Tests

```
node node_modules/typescript/bin/tsc --noEmit --pretty false
node node_modules/vitest/vitest.mjs run src/lib/pricing src/lib/identity src/lib/gradeReview src/lib/ebay "src/app/api/pricing" "src/app/api/cards/[id]"
```

New suites:

- `src/lib/pricing/guardedPriceWrite.test.ts` — both revision filters present in
  the WHERE clause, single query (not read-then-write), 0 rows means stale,
  1 row means written, null revisions means unguarded, warn-once, never throws.
- `src/lib/pricing/batchPriceRefresh.test.ts` — the cron/portfolio/detail family:
  identity changing between the read and the write writes nothing, stale is not a
  failure, owner-pick precedence, the pick is never replaced or cleared.
- `src/lib/pricing/dcmPriceTracker.guard.test.ts` — the sports family, plus owner
  pick precedence in `getDcmPriceWithCache` and `batchRefreshDcmPrices`.
- `src/lib/ebay/priceTrackerGuard.test.ts` — the eBay comps family, including
  "no history snapshot on a stale write".
- `src/lib/gradeReview/detailsPricing.test.ts` — admin corrections: guarded
  write, comps cleared on a material change, comps kept on a cosmetic one.
- `src/app/api/pricing/dcm-save/route.test.ts` — the 409 contract.
- `src/app/api/pricing/pokemon/route.test.ts` — stands in for all six category
  pricing routes (same `savePriceCache` shape, same 409).
- `src/app/api/pricing/dcm-select/route.test.ts` — compare-and-set, retry, 409
  after three attempts, price invalidation, the 2A sold-record lock.

Shared fixture: `src/lib/pricing/__testSupport__/fakeSupabase.ts` (an in-memory
table that records every filter, so a test can mutate a row mid-write to
reproduce the race). It is not a test file; vitest only collects `*.test.ts`.
