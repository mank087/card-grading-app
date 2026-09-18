# Displayed value guard

Status: built 2026-09-17, uncommitted, on `accuracy-phase1-refunds-firstlook`.
No stored value was changed and no database was touched.

## The rule, in plain words

A DCM value is not shown when all three of these are true:

1. the value is over **$500**, and
2. the owner has not vouched for the card (no `dcm_selected_product_id`, no
   `identity_confirmed_revision`), and
3. the identity is **thin**: the set is blank, or the year is blank on a
   category where the year is what separates an original from a reprint.

"Blank" means null, empty, or one of `unknown`, `n/a`, `na`, `none`, `null`,
`undefined`, trimmed and case-insensitive. The set is read from `card_set` or
`conversational_card_info.set_name`; the year from `release_date` or
`conversational_card_info.year`.

For Pokemon, MTG, Lorcana, One Piece and Yu-Gi-Oh a blank **year** alone is not
thin: the scan showed their year is often simply not copied into
`release_date`, while the set name already pins the printing. A blank **set**
is thin for every category. For sports, Other, Star Wars and any card with no
category on file, a blank year is thin.

A field the caller did not select is not the same as a field that is null. If a
caller supplies neither a set field nor a year field, the guard returns
`trusted: true, reason: 'identity_unknown'` and shows the value. The fix for
that is to widen the caller's `select`, never to guess.

## Why $500, and why this exists at all

A read-only scan of production on 2026-09-17 found 1,108 cards at or above
$1,000. 274 of them (199 users, 264 publicly visible, $5.9M of shown value) had
no set or no year and a product that was auto-matched rather than chosen by the
owner. With no set and no year the price lookup searches by name, lands on the
subject's most famous card, and the grade formula multiplies it:

| Card as stored | Matched to | Shown |
| --- | --- | --- |
| "Babe Ruth", no set, no year, grade 9 | Babe Ruth #53 | $2,739,573 |
| "Mickey Mantle", set "Topps Baseball", no year, grade 8 | Mickey Mantle #311 | $778,764 |
| 1977 Wonder Bread Luke Skywalker (a $30-200 card), set "Unknown", grade 10 | Luke Skywalker #1 | $94,854.17 |

Nearly all of these matches were stamped match confidence "high". The numbers
were public under the company's name.

$500 is a deliberate line, not a measurement. Below it a name-only match is not
a claim worth hiding, and hiding it would empty most collections of their
values for no benefit. Above it the number is the kind of figure someone repeats
to a buyer, a spouse or an insurer.

## Where the rule lives

- `src/lib/pricing/valueGuard.ts` — pure, dependency-free. `assessValueTrust`,
  `isBlankIdentityText`, `capMatchConfidence`, `VALUE_GUARD_THRESHOLD`.
- `src/lib/pricing/resolveCardValue.ts` — applies the guard to the DCM estimate,
  the legacy `dcm_cached_prices` blob and the eBay median. A withheld card
  resolves to `{ value: 0, source: 'withheld', withheldValue, withheldReason }`,
  so `getCardValue` returns 0 and every total ignores it automatically.
  Scryfall is exempt: it is a per-printing price set only after an MTG card has
  been matched to an exact card id, so it cannot drift onto a more famous card.
- `dcm-mobile/lib/valueGuard.ts` and `dcm-mobile/lib/resolveCardValue.ts` are
  byte-identical copies. A test fails if they drift.

## Surfaces changed, and what the viewer now sees

### Owner surfaces (the value is replaced by one line of text)

| File | What the owner now sees |
| --- | --- |
| `src/app/collection/page.tsx` | Grid tile and table cell show a "Confirm details" chip (full sentence on hover); the list view shows "Confirm your card details to see a value". The card still links to its detail page, where Edit Card Details lives. Totals, "cards with a price" and value sorting treat the card as unpriced. |
| `src/app/{pokemon,sports,mtg,lorcana,onepiece,other,starwars,yugioh}/[id]/CardDetailClient.tsx` | The green "DCM Estimated Value" callout is replaced by "Confirm your card details to see a value" plus one sentence saying to add the set and year with Edit Card Details. The Market Value section's dollar badge is dropped. Public viewers see nothing in place of either. |
| `src/components/pricing/{PokemonPriceLookup,MTGPriceLookup,LorcanaPriceLookup,OnePiecePriceLookup,OtherPriceLookup,PriceChartingLookup}.tsx` | The big teal DCM value panel is replaced, for the owner only, by the same line plus a pointer to "See other card variants". The DCM bar is dropped from the price-by-grade chart. |
| `src/app/instalist-marketplace/bulk/[batchId]/BulkBatchClient.tsx` | The per-row price hint reads "Confirm your card details to see a value" instead of a DCM figure. |
| `src/app/instalist-marketplace/components/CardPicker.tsx` | The row's "~$X" hint is omitted, and value sorting treats the card as $0. |
| `dcm-mobile/app/card/[id].tsx` | The DCM Estimated Value card shows the same line to the owner, nothing to anyone else. The Market Value section title loses its "~$X", and the estimate and the chart's DCM bar are dropped. |
| `dcm-mobile/app/(tabs)/collection.tsx` | Row prices disappear; the stats bar counts the card as unpriced. |
| `dcm-mobile/components/marketplace/CardPicker.tsx` | Same as the web picker. |

### Public surfaces (no value at all, the way they already behave with no price)

| File | What changed |
| --- | --- |
| `src/components/FeaturedCardTile.tsx` | A withheld card falls through to the existing "View Market Value" link instead of the price badge. Used by `/featured` and shared collections. |
| `src/app/enterprise/[slug]/card/[id]/page.tsx` | The whole pricing payload (`dcm_price_estimate`, raw/median/average/graded-high, match confidence, product name, `dcm_cached_prices`) is dropped before it crosses to the client, so `OrgCardReport` renders its existing "No saved price estimate is available for this card yet." and skips `OrgMarketValueDetails` entirely. |

`generateMetadata`, the OG images and the JSON-LD on the card and storefront card
pages were checked: none of them emits a price or an `offers` block, so there
was nothing to guard there.

### Totals and money math

| File | Change |
| --- | --- |
| `src/app/api/market-pricing/portfolio/route.ts` | Totals, category breakdown, top cards, value distribution and grade-vs-value already run through the resolver, so a withheld card contributes 0. The movers chart and the grading-time-vs-current summary read `dcm_price_estimate` straight off the row, so they now go through a new `displayableEstimate()` that returns 0 for a withheld card: a withheld card can no longer appear as a top gainer. `'withheld'` is attributed to "Unpriced" in the price-source breakdown. |
| `src/lib/ebay/bulkSettings.ts` (`priceForCard`) | Unchanged: it already reads the resolver, so a withheld card's estimate rule returns `null` (the existing "seller sets it" path), never $0.00. |
| `src/components/ebay/EbayListingModal.tsx` | Unchanged: the seeded price is only filled when the resolved value is over 0, so a withheld card opens with a blank asking price and no "Suggested from your portfolio value" label. |

### Admin

`src/app/admin/(dashboard)/cards/page.tsx` still shows the raw number, greyed,
with "(withheld from customer)" beside it, in both the mobile card list and the
desktop table. Finding the affected cards is the point of that screen.

### Selects widened

Every one of these gained `dcm_selected_product_id` and
`identity_confirmed_revision` (and `release_date` where it was missing). They are
tiny scalar columns.

- `src/app/api/market-pricing/portfolio/route.ts` (also `release_date`)
- `src/app/api/cards/my-collection/route.ts`
- `src/app/api/binders/[id]/cards/route.ts`
- `src/app/api/ebay/eligible-cards/route.ts`
- `src/lib/ebay/bulkService.ts` (`DRAFT_CARD_COLUMNS`)
- `src/lib/cards/publicShowcase.ts` (featured gallery)
- `src/app/api/admin/cards/route.ts`
- `dcm-mobile/app/(tabs)/collection.tsx`, `dcm-mobile/app/pages/ebay-list.tsx`

The eight category detail routes (`/api/pokemon/[id]` and friends) already
`select('*')`, so the guard's inputs reach the card detail pages unchanged.

## Match confidence honesty

A price match produced from a query with no set and no year is capped at `low`.
"Best Match" on a name-only search was the label that made these numbers look
checked. The cap is applied once, at the point each search returns, by
`capMatchConfidence` in `valueGuard.ts`:

`searchSportsCardPrices`, `searchPokemonCardPrices`, `searchMTGCardPrices`,
`searchLorcanaCardPrices`, `searchOnePieceCardPrices`, `searchOtherCardPrices`
each kept their entire body under a `…Uncapped` name and gained a thin exported
wrapper that caps the confidence and logs when it does. `none` is left alone.

Matching behaviour is unchanged, no search terms changed, and nothing stored was
rewritten. A direct product-id lookup (the owner's own selection) still reports
`high`, which is correct: the owner picked it.

## Deliberately not done

- **No stored value was cleared or rewritten.** The 274 rows keep their
  `dcm_price_estimate`. They are hidden by the guard, not corrected. Reversing
  the guard shows them again, exactly as they were.
- **No stored match confidence was rewritten.** Only newly computed confidences
  are capped, so the existing "high" stamps on those rows stay in the database.
- **Reprint and authenticity detection is a separate problem.** The guard does
  not ask whether a match is right. Many of these cards are almost certainly
  reprints and a $30 Wonder Bread Luke will still be matched to Luke Skywalker
  #1 the moment somebody confirms a set and year that happen to be wrong.
- **The matched product's own market data is still shown.** On the card detail
  pages and the mobile card screen, the price range, the PSA/BGS/CGC grade
  tables and the "Average" cell come from the matched product and still render
  for a withheld card, next to the "Not the right version?" prompt. The DCM
  value for *this* card is what the guard hides. If those tables should go too,
  that is a follow-up.
- **No mobile OTA was published.** The mobile copies are in the repo, and the
  app's own surfaces are guarded, but nothing reaches a phone until an OTA or a
  store build ships.
- **No new UI.** The owner gets a line of text, not a dialog. The Phase 2B
  confirmation dialog is still the place a proper "is this your card?" flow
  belongs.

## How to lift the guard for one card

Either of the owner's existing actions is enough, and both are permanent for
that card:

1. **Confirm the details.** Edit Card Details on the card page, filling in the
   set and the year. A material identity edit also bumps
   `identity_revision` and invalidates the old pricing, so the card is repriced
   against the identity that was actually confirmed. A confirmation sets
   `identity_confirmed_revision`, which satisfies the guard by itself.
2. **Pick the pricing product.** "See other card variants" in the Market Value
   section, then choose the right printing. That writes
   `dcm_selected_product_id` (`/api/pricing/dcm-select`) and the guard steps
   aside.

Admins cannot lift the guard for someone else: there is still no admin
identity-edit tool.

## Tests

```
node node_modules/vitest/vitest.mjs run src/lib/pricing/valueGuard.test.ts src/lib/pricing/resolveCardValue.test.ts
node node_modules/typescript/bin/tsc --noEmit --pretty false
cd dcm-mobile && node ../node_modules/typescript/bin/tsc --noEmit --pretty false
```

The three production cards above are asserted as withheld by name.
`resolveCardValue.test.ts` also fails if `dcm-mobile/lib/resolveCardValue.ts` or
`dcm-mobile/lib/valueGuard.ts` drifts from the `src/` copy (compared with line
endings normalised).
