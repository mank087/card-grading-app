# Phase 2A: identity save foundation

September 17, 2026. Implements increment 2A of
[DCM_PHASE2_IDENTITY_CONFIRMATION_SCOPE.md](DCM_PHASE2_IDENTITY_CONFIRMATION_SCOPE.md).
No UI. Nothing was applied to the production database; the migration is written
and tested locally against PGlite and is pasted by hand as usual.

## What changed

| File | Change |
|---|---|
| `supabase/migrations/20260917_identity_confirmation.sql` | New. Revision and confirmation columns on `cards`, the `card_identity_history` trail, and the `save_card_identity()` function. |
| `src/lib/identity/saveCardIdentity.ts` | New. The one shared identity service: per-category field allowlist, material-change detection, the pricing invalidation list, and the RPC call with a pre-migration fallback. |
| `src/app/api/cards/[id]/details/route.ts` | PATCH now delegates the whole save to the service. Auth, ownership, the sold lock, protected fields, validation messages, label regeneration and the custom-label sync are unchanged and still run in the same order. |
| `src/app/api/pricing/dcm-select/route.ts` | Applies the sold-record lock (POST and DELETE) and bumps `pricing_selection_revision`. Request and success response shapes are unchanged apart from an added `code` on the new 423. |
| `src/lib/identity/saveCardIdentity.test.ts` | New. 36 unit tests. |
| `src/lib/identity/saveCardIdentity.database.test.ts` | New. 19 PGlite tests that execute the real migration file. |

### Defects fixed

**A. Card number written two ways.** Owner edits used to write the JSON key
`card_number_raw` only, leaving a stale `card_number` in the same blob, so the
label and the details page could disagree. `buildIdentityPatch` writes both keys
from the same value, clears both together, and keeps alphanumeric numbers
(`091/086`, `RA-CS`, `OP11-001`) verbatim.

**B. Identity edits never invalidated pricing.** A corrected card kept the old
card's product selection and price. A material identity change now nulls the
columns listed below in the same transaction as the edit.

**C. Four unguarded writes.** The original snapshot, the identity, the label and
the custom label were four independent updates with no revision check. Identity,
the original snapshot, the confirmation state and the pricing invalidation now
commit in one transaction under `SELECT ... FOR UPDATE`, and the request can
send `expected_identity_revision` to get a 409 instead of clobbering a newer
edit. Label regeneration and the custom-label sync deliberately stay outside the
transaction: they are derived data and were already best-effort.

**D. No way to confirm without editing.** `confirm: true` with no field changes
is a valid request. Previously it returned 400 "No changes to save", which is
why owners had to invent a change to approve correct information.

**E. `dcm-select` ignored the sold lock.** It now returns the same 423 body the
details editor returns.

### New request and response keys on `PATCH /api/cards/[id]/details`

Request (all optional): `confirm: true`, `dismiss: true`,
`expected_identity_revision: number`. These three are control keys: they are
skipped by field validation and can never be written into `conversational_card_info`.

Response gains `identity_revision`, `identity_confirmed`, `pricing_invalidated`.
A stale revision returns HTTP 409 with `code: 'identity_revision_conflict'` and
the current `identity_revision`.

Unknown fields are now rejected with 400 instead of being silently accepted and
dropped. The per-category allowlist mirrors the payload branches in
`EditCardDetailsModal`, so no shipped client starts failing.

## Invalidated pricing columns

`PRICING_INVALIDATION_COLUMNS` in `src/lib/identity/saveCardIdentity.ts` is the
single list. The database function intersects it with its own hard-coded
allowlist, so a column that is not in both cannot be nulled.

| Column | Evidence |
|---|---|
| `dcm_selected_product_id` | written `src/app/api/pricing/dcm-select/route.ts:73` |
| `dcm_selected_product_name` | written `src/app/api/pricing/dcm-select/route.ts:74` |
| `dcm_selected_at` | written `src/app/api/pricing/dcm-select/route.ts:75` |
| `dcm_price_estimate` | read `src/lib/pricing/resolveCardValue.ts:65`, written `src/app/api/pricing/dcm-save/route.ts:86` |
| `dcm_price_raw` | written `src/app/api/pricing/dcm-save/route.ts:87` |
| `dcm_price_graded_high` | written `src/app/api/pricing/dcm-save/route.ts:88` |
| `dcm_price_median` | written `src/app/api/pricing/dcm-save/route.ts:89` |
| `dcm_price_average` | written `src/app/api/pricing/dcm-save/route.ts:90` |
| `dcm_price_updated_at` | staleness key the crons order by, `src/app/api/cron/update-card-prices/route.ts:60` |
| `dcm_price_match_confidence` | written `src/app/api/pricing/dcm-save/route.ts:92`; `'no-match'` is itself a cache marker, `src/lib/pricing/batchPriceRefresh.ts:147` |
| `dcm_price_product_id` | the automatic match shortcut, read `src/lib/pricing/batchPriceRefresh.ts:159` |
| `dcm_price_product_name` | written `src/app/api/pricing/dcm-save/route.ts:94` |
| `dcm_cached_prices` | written `src/lib/pricing/batchPriceRefresh.ts:119`, read as a fallback estimate `src/lib/pricing/resolveCardValue.ts:72` |
| `dcm_prices_cached_at` | freshness gate for that blob, `src/app/api/pricing/pokemon/route.ts:117` |
| `ebay_price_lowest` | written `src/lib/ebay/priceTracker.ts:591` |
| `ebay_price_median` | written `src/lib/ebay/priceTracker.ts:592`, read `src/lib/pricing/resolveCardValue.ts:88` |
| `ebay_price_average` | written `src/lib/ebay/priceTracker.ts:593` |
| `ebay_price_highest` | written `src/lib/ebay/priceTracker.ts:594` |
| `ebay_price_listing_count` | written `src/lib/ebay/priceTracker.ts:595` |
| `ebay_price_updated_at` | staleness key, `src/app/api/ebay/cached-price/route.ts:66` |
| `scryfall_price_usd` | per-printing price, written `src/app/api/mtg/[id]/route.ts:1105`, read `src/lib/pricing/resolveCardValue.ts:82` |
| `scryfall_price_usd_foil` | written `src/app/api/mtg/[id]/route.ts:1106`, read `src/lib/pricing/resolveCardValue.ts:79` |

Deliberately NOT invalidated, because they are history rather than a current
price: `dcm_price_at_grading` and `dcm_price_at_grading_date`
(`src/app/api/market-pricing/portfolio/route.ts:202-208` uses them as the movers
baseline) and every row in `card_price_history`.

A material change is a change to name/player, set (including `mtg_set_code`),
subset or insert, printed card number, year, manufacturer, language,
parallel/variant (`parallel_type`, `holofoil`, `is_foil`, `foil_type`,
`is_reverse_holo`, `is_first_edition`) or serial numbering. Comparison is
trimmed and case-insensitive with `''` treated as null, so `"  Topps "` against
`"topps"` is not a change and does not invalidate anything.

## Deploy order

Migration first is preferred: apply
`supabase/migrations/20260917_identity_confirmation.sql`, then deploy the code.

Code first is also safe. If `save_card_identity()` is missing, the service
detects PostgREST `PGRST202` / Postgres `42883`, logs one warning naming the
migration, and falls back to the route's previous multi-write behaviour, still
applying the card-number fix and the pricing invalidation. In that mode
`confirm` and `dismiss` return `unavailable` (HTTP 503) rather than pretending
to have saved, and `identity_revision` comes back as `null`.
`dcm-select` tolerates a missing `pricing_selection_revision` the same way and
logs once.

## Not done yet

- **The confirmation dialog and banner (2B).** No UI at all: no "Confirm card
  details" prompt, no review banner, no first-look wiring. `EditCardDetailsModal`
  still sends plain edits and never sends the control keys, so behaviour for
  existing users is unchanged.
- **Revision-guarded background price writers (2C).** `dcm-save`,
  `/api/pricing/*`, `batchPriceRefresh` and the cron routes still write prices by
  card ID with no identity or selection revision condition, so a slow in-flight
  price request that started before an identity correction can still land after
  it. 2A only guarantees the stale value is cleared at save time. This is the
  main remaining hole.
- **The admin corrections path has its own writer.**
  `src/lib/gradeReview/cardDetails.ts` (`buildDetailsPatch`) still builds and
  applies its own identity patch for manual grade reviews. It is not routed
  through `saveCardIdentity`, so an admin correction does not bump
  `identity_revision`, does not write a `card_identity_history` row, and relies
  on `src/lib/gradeReview/detailsPricing.ts` to refetch prices instead of
  invalidating them. Consolidating the two writers is a follow-up.
- **`dcm-select` revision bump is read-then-write**, not an atomic increment. It
  is an owner-initiated action on one card, so a lost bump is tolerable for now;
  2C should move it into the same function.
- **Mobile.** No native changes. The API contract is additive, so the app keeps
  working unchanged.
- **`pricing_selection_revision` is written but nothing reads it yet.** It exists
  for 2C's race rejection.

## Running the tests

```
node node_modules/typescript/bin/tsc --noEmit --pretty false
node node_modules/vitest/vitest.mjs run src/lib/identity
node node_modules/vitest/vitest.mjs run src/lib/identity src/lib/grading src/lib/identification src/lib/gradeReview
```

The database test executes the real migration file against an in-process PGlite
instance with a minimal `cards` table. It never touches Supabase.
