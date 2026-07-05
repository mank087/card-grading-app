# Market Pricing Optimization Plan — July 3, 2026

> **IMPLEMENTATION STATUS (July 3, 2026, end of session):**
> **DONE:** WS7.0 Yu-Gi-Oh bug fix · WS1 (migrations + import script + coverage report script; import NOT yet run) · WS2 local matcher (`src/lib/sportsCardMatcher.ts`) wired local-first into `searchSportsCardPrices` incl. subset, serial, boundary-safe numbers, no silent substitution · WS2b sports identity validation in `sports/[id]/route.ts` (tiered, AI snapshot, `validated_source` columns) · WS4 shared estimate module `src/lib/pricing/dcmEstimate.ts` (interpolation, no raw×3) consolidated across server + web client · WS5.1–5.4/5.6 eBay hygiene · WS3 parallel picker: API route `/api/pricing/sports-parallels`, web un-gating in PriceChartingLookup, native mobile picker (`dcm-mobile/components/ParallelPicker.tsx`) · WS8 `/sports-database` page + APIs + footer link · WS6.2 cron backlog logging.
> **USER STEPS REQUIRED:** (1) apply `supabase/migrations/20260703_add_sports_cards_database.sql` and `20260703_add_identity_validation_columns.sql` in the Supabase SQL editor; (2) run `node scripts/import-sports-database.js` (~2k set pages one-time discovery, then batched CSVs); (3) run `npx tsx scripts/sports-db-coverage-report.ts` for the baseline; (4) mobile picker ships via the usual DUAL OTA (iOS 1.0.1 / Android 1.0.0).
> **UPDATE (later same day): ALL workstreams are now code-complete** — WS2c visual parallel disambiguation (`src/lib/sportsParallelVision.ts`, 79-entry glossary, base-biased gating, wired into the sports route), WS7 cross-category alignment for Pokemon/MTG/Lorcana/One Piece/Star Wars (validation columns + AI snapshots everywhere; OP variant-aware + name-safety gate; SW variant column via `20260703_add_starwars_variant_column.sql` ⚠️ needs applying; Lorcana set-code from table), WS7.6 freshness checker now covers all six categories (first run found **114 Star Wars sets missing** — SW importer discovery switched from hardcoded queries to the category page so a re-run closes the gap), WS5.5 asking-range labels across web + mobile, WS2.8 reset script (`scripts/reset-sports-nomatch-cache.js`).
> Deliberately skipped: WS6.5 `priceCharting.ts` rename (churn > value), WS6.1 cron retirement (keep until CSV import is scheduled), WS7.7 "Other" unverified badge (minor polish).
> Post-import steps: run `npx tsx scripts/sports-db-coverage-report.ts` (baseline), `node scripts/reset-sports-nomatch-cache.js`, re-run `node scripts/import-starwars-database.js` (variant column + 114 missing sets). Mobile changes ship via dual OTA.

Consolidated findings and fixes from the full market-pricing system review (SportsCardsPro/PriceCharting matching, DCM estimate math, eBay fallback, parallel picker UX, caching/cron). Confirmed: Legendary subscription includes full CSV price-guide download (regenerated every 24h, columns match API JSON keys) — this is the foundation for Workstream 1.

Priorities: **P0** = directly fixes user-reported accuracy complaints. **P1** = high-value follow-on. **P2** = hygiene/consistency.

---

## Workstream 1 — Local Sports Card Database (P0, foundation)

The sports equivalent of the pokemon/mtg/lorcana local DBs, sourced from the SportsCardsPro CSV download (checklist + prices in the same rows).

- **1.1** New migration: `sports_card_products` table — `pc_id` (SportsCardsPro `id`, PK), `product_name`, `console_name` (set), all price columns (`loose`, `graded`, `new`, `cib`, `box_only`, `manual_only`, `bgs_10`, `condition_17`, `condition_18` — pennies→dollars at import), `sales_volume`, `release_date`, `imported_at`. Plus **parsed columns**: `card_number` (from `#123` in product name), `serial_denominator` (from `/75`), `variant_text` (product name minus player/number). Indexes: `pg_trgm` on `product_name`, btree on `(console_name, card_number)`.
- **1.2** Import script `scripts/import-sports-database.js` mirroring `import-mtg-database.js`: fetch CSV with API token, parse, batch upsert. Custom User-Agent (see Scryfall lesson). Weekly schedule to start.
- **1.3** Coverage report script: % of existing graded sports cards that match a local product — baseline before/after Matching v2.
- **1.4** Map existing `dcm_price_product_id` values onto local rows (they're the same IDs).

## Workstream 2 — Sports Matching v2 (P0)

Replace live-search-and-score with local queries over the complete product set.

- **2.1** Local matcher: filter by set-name similarity + **exact card-number column equality** + player trigram; score variant keywords in code. Replaces `searchProducts` top-25 dependency (`src/lib/priceCharting.ts:344-381`).
- **2.2** **Include insert/subset names in matching.** Currently deliberately excluded (`src/lib/pricing/dcmPriceTracker.ts:297-320`), so "Downtown"/"Kaboom" inserts price as base cards — likely the #1 sports complaint. Exact insert hit = large bonus; product has insert name the card lacks (or vice versa) = disqualify; retry without subset as low-confidence fallback (vision may hallucinate subsets).
- **2.3** **Serial-numbering auto-disambiguation**: `/75` → unique `serial_denominator=75` product in the set+number group = auto-select, high confidence.
- **2.4** **Use the rookie flag** (currently passed but ignored — `dcmPriceTracker.ts:346`): match `[RC]` in product names as a scoring signal.
- **2.5** **Kill the silent different-product price fallback** (`priceCharting.ts:788-830`): when the true match has no prices, return "no price data" + parallel picker prompt instead of a lower-scored product's prices. (Largely moot once prices come from local rows.)
- **2.6** Fold `sales_volume` into confidence: thin-comp products (≤2 sales) flagged "limited data" regardless of match score.
- **2.7** Interim (only if WS1 is delayed): word-boundary card-number matching in the live scorer (`priceCharting.ts:643-671` — `#4` currently matches `#40`/`#400`); stop truncating set names to 4 words (`:285-300`).
- **2.8** After deploy: clear `dcm_price_match_confidence='no-match'` negative-cache markers on sports cards so previously unmatched cards retry against the new matcher.

## Workstream 2b — DB-Backed Sports Card Identification (P0, extends WS2)

Use the local DB to canonicalize card identity, not just pricing — extends the proven Pokemon pattern (`src/app/api/pokemon/[id]/route.ts:1124-1200`: local-DB match → DB values are source of truth, `validated_source` recorded, AI values kept as fallback) to sports, closing the "no ID validation for sports/other" gap from the Jul 1 grading audit.

- **2b.1** Tiered validation after AI identification:
  - **Tier 1 — exact**: serial denominator match or single candidate in the set+number family → adopt full DB identity (canonical set name, product name, subset/parallel).
  - **Tier 2 — family match**: player + card number + set identify the family (base + all parallels) → adopt canonical set name, number, player spelling, and insert name; the *parallel* stays AI-determined but is snapped to the family's actual parallel list (AI says "Zebra" and Zebra exists → adopt it; AI's parallel doesn't exist in the family → flag for the picker).
  - **Tier 3 — no match**: AI-only values, `validated_source: null`, flagged — same as Pokemon's fallback.
- **2b.2** Preserve the original AI extraction untouched (snapshot in the card JSON or separate column); DB-derived values become the default *displayed* identity. Display resolver prefers validated fields when present.
- **2b.3** Identity and pricing share one product link: `dcm_price_product_id` becomes the canonical identity anchor, so a parallel-picker correction (WS3) fixes name, label text, eBay listing title, and price together.
- **2b.4** Bonus: canonical product IDs fix **pop report fragmentation** — today two users grading the same card with different AI spellings count as different cards.
- **2b.5** Caveat: SportsCardsPro product/console names are parsed strings (e.g. `LeBron James [Silver Prizm] #23` / `2023 Panini Prizm`), not structured checklist fields — parse quality gates adoption, so only adopt at Tier 1/2 confidence and record which tier fired.

## Workstream 2c — Visual Parallel Disambiguation (P1, extends 2b)

Have the AI identify the parallel visually — but constrained to the DB family's real parallel list, via attributes rather than names.

- **2c.1** **Attribute extraction, not name guessing**: the vision pass reports structured attributes — background pattern (none/shattered-glass/stripes/wave/camo…), border/foil color, foil present?, serial read — and code matches attributes against the family's candidates deterministically.
- **2c.2** **Parallel-features glossary**: static lookup mapping known parallel names → visual signatures ("Cracked Ice = shattered-glass foil pattern", "Zebra = black/white stripes"). Panini/Topps reuse the vocabulary across years/sports; ~100–200 entries covers most of the hobby.
- **2c.3** **Confidence-gated, base-biased adoption**: pattern/color/serial matches auto-adopt (patterns ~90%+, colors ~80–90%, serials ~deterministic). Foil-only distinctions (Silver Prizm vs base, refractor vs non) are unreliable from flat photos (~60–75%) → default to base + fire the WS3.4 "confirm your parallel" one-tap prompt. Never silently claim a premium parallel — inflated price is the worse failure mode.
- **2c.4** Runs as a small follow-up vision call with the same images, only when the family has >1 parallel and serial didn't resolve it.
- **2c.5** Later option (data-driven): an angled "shimmer shot" in the capture flow would solve foil detection; ship without it and let confirm-prompt correction rates decide.

## Workstream 3 — Parallel Picker UX, Web + Mobile (P1)

Confirmed today: the parallel dropdown only renders after a successful auto-match (`PriceChartingLookup.tsx:1197`), manual search only on the exact "No matching products found" error + owner (`:994-1006`), high-confidence matches hide the picker in a collapsed `<details>` (`:1226`), and **mobile has no picker at all** (card detail is native, read-only pricing, no `dcm-select` calls anywhere in dcm-mobile).

- **3.1** New API route `/api/pricing/sports-parallels?cardId=` — returns the grouped parallel list (with prices) from `sports_card_products` for the card's set + number. Backed by local data, it can never silently return empty the way `getAvailableParallels` does (`priceCharting.ts:867-967` filters by AI-extracted card number and returns `[]` when it's wrong).
- **3.2** Web: render the picker **unconditionally for owners** — match found, no match, or no prices. Un-gate manual search from the exact-error-string condition. Keep free-text search as a secondary tab for oddballs.
- **3.3** Mobile: native parallel-picker screen (list from 3.1, save via existing `/api/pricing/dcm-select` — the endpoint already works; mobile just never calls it). Remember dual OTA runtimes when shipping.
- **3.4** Post-grading prompt: when the matched card has N>1 parallels and no serial/parallel auto-disambiguation fired, show "This card has N parallels — confirm yours" on the result screen.
- **3.5** Fix client-side empty-cache bug: `fetchParallels` never re-queries after a once-empty result (`PriceChartingLookup.tsx:360-363`).

## Workstream 4 — DCM Estimate Math (P1)

- **4.1** Replace the **`raw × 3` fallback** (`priceCharting.ts:500-502`) when no graded comp exists: fall back to raw value labeled "ungraded value", or interpolate from whatever graded tiers exist.
- **4.2** **Interpolate between grade tiers** instead of `Math.round(dcmGrade)` (`:495` — an 8.5 currently prices as PSA 9). Both neighboring tier prices are already available.
- **4.3** **Consolidate the triplicated estimate logic** into one shared module — currently in `priceCharting.ts:488-534`, `dcmPriceTracker.ts:72-117`, and client-side `PriceChartingLookup.tsx:775-824`; they already disagree on `graded_high` (client sends PSA-10-only at `:150`; tracker computes max across companies at `dcmPriceTracker.ts:366-370`).
- **4.4** Missing grade defaults to 8 (`dcmPriceTracker.ts:357`) — keep, but surface as lower confidence.
- **4.5** UI wording: label tiers "Grade 9" not "PSA 9" — SportsCardsPro's `graded-price` is a cross-company aggregate, and BGS/SGC columns currently mirror the same number (`normalizePrices`, `priceCharting.ts:442-456`). Cheap credibility win.

## Workstream 5 — eBay Fallback Hygiene (P0 quick wins; Insights API is closed to new users)

The fallback currently medians the **25 cheapest active asking listings**, mixing raw/graded/lots (`src/lib/ebay/browseApi.ts:186-188`, stats `:261-285`).

- **5.1** Drop `sort=price` — use best-match so the sample isn't the cheapest tail.
- **5.2** Title exclusions before stats: `PSA|BGS|SGC|CGC|graded|slab` (separate graded from raw), `lot|reprint|proxy|custom|break|digital`.
- **5.3** Outlier trimming (IQR or drop top/bottom 15%) before median/average.
- **5.4** Tighten the relevance filter (`browseApi.ts:296-323`) from OR to AND (player last name AND card number when available) and **apply it to all card types** — currently sports-only.
- **5.5** UI: label eBay-sourced numbers "eBay asking range", not market value (web + mobile resolvers tag `source: 'ebay-median'` — use it).
- **5.6** Fix `listing_count` semantics: post-filter count vs `data.total` inconsistency (`browseApi.ts:279`).
- **5.7** Note: WS1+WS2 shrink eBay's sports surface area to genuinely unlisted cards, since most current fallbacks are matching failures, not missing data.

## Workstream 6 — Infra & Consistency (P2)

- **6.1** Retire the per-card SportsCardsPro API crawl from the weekly cron for sports — prices refresh via CSV re-import in one shot. Cron keeps covering non-sports categories.
- **6.2** Cron observability: log how many stale cards exceeded the 600-card cap each run (`cron/update-card-prices/route.ts`).
- **6.3** Unify subset/parallel field usage between engines — eBay queries use `subset` (`browseApi.ts:476`), SportsCardsPro doesn't; after WS2 both should.
- **6.4** `getAvailableParallels` "No prices" mislabeling (`priceCharting.ts:940-957` checks fields the search endpoint omits) — moot once the picker reads local rows.
- **6.5** Rename/alias `src/lib/priceCharting.ts` → it's the SportsCardsPro client (`API_BASE_URL` line 24); recurring source of confusion.

---

## Suggested sequencing
## Workstream 7 — Cross-Category DB Validation Alignment (audited Jul 3, 2026)

Audit of how Pokemon/MTG/Lorcana/One Piece/Yu-Gi-Oh/Star Wars/Other validate AI identification against their local DBs, vs the sports WS2b/2c design.

### 7.0 — CONFIRMED BUG (P0, two-line fix)
`src/lib/yugiohCardMatcher.ts:101,155` uses `supabaseServer.from(...)` but `supabaseServer` is a **function** (`src/lib/supabaseServer.ts:3` — every other matcher calls `supabaseServer()`). The TypeError is swallowed by the route's try/catch (`yugioh/[id]/route.ts:856`) → **Yu-Gi-Oh DB validation has never run**. Fix the two call sites; consider a backfill/re-validation pass for existing Yu-Gi-Oh cards.

### 7.1 — Uniform validation record (P1)
No category persists a proper top-level `validated_source`/verified flag (except Pokemon-JP). Confidence is scattered: `card_info.mtg_database_match_confidence`, Lorcana `_database_match`, `*_database_match_confidence` columns for OP/YGO/SW, nothing for Pokemon-EN. Standardize: top-level `validated_source` + `validation_confidence` columns on all categories, written by every matcher path, null = unvalidated AI guess (surface as a subtle badge).

### 7.2 — Preserve original AI extraction (P1)
Pokemon **rewrites the raw `conversational_grading` JSON** with corrected values (`pokemon/[id]/route.ts:1210-1232`) — the AI original is destroyed; other categories preserve it only implicitly in the raw report string. Standardize the WS2b rule: snapshot AI-extracted identity before any DB overwrite (e.g. `card_info.ai_original`), everywhere.

### 7.3 — Variant/finish-aware identity (P1, mirrors sports 2b/2c)
- One Piece: matcher **always collapses to base card** (`onepieceCardMatcher.ts:149,239,275` — `variant_type null` filters) even though `onepiece_cards` stores alt-art/manga/parallel rows; base `market_price` gets attached to alt-arts. Match variants; use AI visual cues (alt-art/manga detection) to pick within the family — same attribute approach as sports 2c.
- Star Wars: `stripBrackets` erases the `[Foil]/[Hyperspace]` markers that are the only variant distinction in PriceCharting-sourced data (`starwarsCardMatcher.ts:51-53`), and matching is number-only → wrong-variant prices. Parse brackets into a variant column at import (same as sports WS1.1) instead of stripping.
- Yu-Gi-Oh: rarity variants modeled per-printing (good) but **1st Edition vs Unlimited not modeled at all**; rarity only reliable when the exact set code matches.
- MTG/Lorcana: foil finish is never part of identity — `is_foil` stays an unvalidated AI guess; Lorcana enchanted (distinct collector number) works, foil doesn't.
- Pokemon: holo/reverse-holo/1st-edition not in the DB match key; English path never reads DB rarity.

### 7.4 — Matcher correctness details (P1)
- One Piece direct card-ID path returns `high` confidence **without any name/set cross-check** (`onepieceCardMatcher.ts:429-448`) — a misread card number silently becomes a confident wrong identity. Add the name-safety gate MTG/Lorcana already have (`mtg/[id]/route.ts:931-943`).
- Lorcana set-code derivation is a hardcoded name→code if/else chain (`lorcana/[id]/route.ts:849-867`) — new sets silently fall through; derive from `lorcana_sets` table instead.

### 7.5 — Identity→pricing linkage (P1)
Validated identity and priced product can silently diverge everywhere — pricing routes run an independent PriceCharting text match:
- One Piece pricing receives raw AI fields, not the validated identity (`pricing/onepiece/route.ts:146-254`); the `[id]` route doesn't pass DB values through.
- Star Wars stores `db_card_name` "for pricing reference" then **never uses it** — auto-pricing sends the AI name (`starwars/[id]/route.ts:1035-1072`).
- MTG/Lorcana capture local foil prices (`scryfall_price_usd_foil`, `price_usd_foil`) that pricing never uses.
Standardize the sports 2b.3 rule: validated identity (and its variant) is what gets priced; where a local DB price exists for the exact variant, prefer it or use it as a sanity band around the PriceCharting number.

### 7.6 — Freshness & coverage (P2)
- `check-tcg-db-freshness.js` covers MTG/Lorcana/OP/YGO but **not Pokemon and not Star Wars** — add both.
- One Piece promo endpoint retired (404 since Jan 2026) → promos no longer refresh; find alternate source or flag.
- Star Wars import discovery is a hardcoded query list (`import-starwars-database.js:60-84`) — new sets are never discovered; drive discovery from PriceCharting category listing instead.
- No category re-validates already-graded cards when the DB updates (validation is grade-time-once). Consider a lazy re-validation pass (e.g. on card view if `validated_source` null and DB has been refreshed since).

### 7.7 — "Other" category (P2)
No DB, no validation — 100% unverified AI identity; pricing is a text match with `useEbayFallback` as the only net. Acceptable by design (unbounded category), but: apply the WS5 eBay hygiene, show an "unverified" identity state, and route more categories out of "Other" as dedicated DBs appear (Yu-Gi-Oh and Star Wars currently price through the Other path even though they have identity DBs).

### 7.8 — User-facing identity correction (P1, extends WS3)
No category has an identity-correction path (only pricing-variant override). The WS3 picker concept generalizes: "wrong card?" → search the category's local DB → selecting a row fixes identity + pricing together.

## Workstream 8 — User-Facing Sports Card Database Browser (P1, rides on WS1)

Mirror the six existing `*-database` pages (`/pokemon-database` … `/starwars-database` — public, footer-linked, hand-built ~650–1100 lines each, offset pagination, `ilike` search, sets-dropdown from `<cat>_sets` tables, "Grade This Card" CTA, no pricing shown).

- **8.1** `sports_sets` table, populated during the WS1 import from distinct `console-name` strings. Console-name encodes everything the filters need — format `"<Sport> Cards <Year> <Manufacturer> <SetName>"` (e.g. `"Basketball Cards 1986 Fleer"`, see `priceCharting.ts:71`) — parse into `sport`, `year`, `manufacturer`, `set_name` columns at import.
- **8.2** `/sports-database` page + `/api/sports-database/search` + `/sets` routes following the existing contract (`{cards, pagination}` / `{sets, setsByType}`). Filters: **sport type → manufacturer → year → set dropdown**, then player-name search + card number within results.
- **8.3** **Set-first UX, not a giant card grid** — sports scale is 10–100× the TCG tables (likely 1M+ products), and the CSV has **no card images**, so the TCG image-grid layout doesn't transfer. Browse sets → set page lists cards as rows, **parallels grouped under their base card** (the WS2b family grouping) with expandable variant lists.
- **8.4** **Show prices per row** (Ungraded / Grade 9 / PSA 10 from the local table) — none of the TCG database pages show pricing; this makes the sports browser the most useful page of the family and a strong SEO/acquisition play. ⚠️ Verify SportsCardsPro license terms permit public re-display of price data (vs internal-product use); if restricted, show prices only to logged-in users or Card Lovers.
- **8.5** Reuse: the same search API powers the WS3 parallel picker's manual-search tab. Keep the "Grade This Card" CTA pattern (deep-link to `/upload/sports`), plus "Latest DCM Sports Grades" carousel — graded-card photos compensate for the no-images limitation.
- **8.6** Optional (don't block on it): the 6 existing pages are copy-paste-diverged (~5,600 lines total); build the sports page with extractable structure so a shared `DatabaseBrowser` component can follow. Consider nav exposure beyond the footer and server-side rendering for SEO (existing pages are fully client-rendered).
- **8.7** Mobile: web-only initially, matching the other database pages (none exist in dcm-mobile); WebView wrapper later if wanted.

---

## Suggested sequencing

| Phase | Items | Est. effort |
|---|---|---|
| 0. Bug fix | WS7.0 (Yu-Gi-Oh matcher) | ~0.5 day incl. backfill check |
| 1. Foundation | WS1 (table, import script, coverage report) | ~1–2 days |
| 2. Accuracy core | WS2 + WS2b (local matching + tiered identity validation) + WS5.1–5.4 | ~3–4 days |
| 3. UX | WS3 (picker API + web un-gating + mobile native picker) + WS5.5 | ~2–3 days (mobile OTA both platforms) |
| 4. Estimate quality | WS4 (interpolation, fallbacks, consolidation) | ~1 day |
| 5. Parallel vision | WS2c (attribute extraction + glossary + gating) | ~1–2 days |
| 6. Cross-category alignment | WS7.1–7.5, 7.8 | ~3–4 days |
| 7. Sports database browser | WS8 (sets table lands in Phase 1; page + routes here) | ~2–3 days |
| 8. Cleanup | WS6 + WS7.6–7.7 | ~1 day |

Measurement: run the WS1.3 coverage report before and after Phase 2; track match-confidence distribution (`dcm_price_match_confidence`) and no-match rate on sports cards as the accuracy KPI. For WS7, track % of cards with non-null `validated_source` per category.
