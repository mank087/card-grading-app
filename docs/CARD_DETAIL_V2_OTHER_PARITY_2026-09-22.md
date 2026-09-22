# Card detail V2 — "Other" parity walk

**Date:** 2026-09-22
**Branch:** `card-detail-v2` (worktree `tmp/card-detail-v2`)
**Legacy source of truth:** `src/app/other/[id]/CardDetailClient.tsx` (6,807 lines, frozen)
**V2 adapter:** `src/app/other/[id]/CardDetailV2Client.tsx`

**Every block of page chrome, hero, analysis, footer, report and modals is the
shared shell, identical to Pokemon and sports** — see
`CARD_DETAIL_V2_SPORTS_PARITY_2026-09-22.md` §1, §3, §5, which apply here
unchanged, including the three blocks dropped when the Pokemon adapter was
built. Only what 'Other' does differently is listed below.

**This route also carries Star Wars.** `/starwars/[id]` has redirected to
`/other/[id]` since March 2026 (commit d41b72f8) and every Star Wars row
carries `category='Other', sub_category='Star Wars'`. See
`CARD_DETAIL_V2_STARWARS_PARITY_2026-09-22.md`.

---

## 1. Card Information — the "Other"-only half

Legacy's grid is `3805-4056` and is the thinnest of the eight. The shared
`CardFacts` prints Set, Subset, Year, Card number, Rarity/variant, Language and
DCM serial; everything else lands in
`src/components/card-detail/categories/OtherCardInfo.tsx`.

| Legacy block (line) | V2 location | Verdict |
| --- | --- | --- |
| Card Name, bilingual (3832) | `OtherCardInfo` "Card name" | placed |
| **Ink Color (3866), Card Type (3892), Character Version (3902), Ink Cost (3912), Strength (3922), Willpower (3932)** | `OtherCardInfo`, in legacy's order | placed — **see the note below** |
| Set Name (3943) | `CardFacts` "Set" | placed |
| Card Number (3957) | `CardFacts` "Card number" | placed |
| Manufacturer (3967) | `OtherCardInfo` "Manufacturer" | placed |
| Card Date → "Year/Date" (3977) | `OtherCardInfo` "Year / date" | placed |
| Autographed (3988) / Memorabilia (3996), each printed only when true | `OtherCardInfo` | placed |
| Special Features, the free-text field (4005) | `OtherCardInfo` "Special features" | placed |
| Language, only when not English (4015) | `OtherCardInfo` "Language" | placed |
| Front Text (4025) / Back Text (4035) | `OtherCardInfo`, inside one "Card text" panel | placed |
| Flavor Text (4045) | `OtherCardInfo`, quoted prose in the same panel | placed |

### The six Lorcana leftovers

The block of ink colour / card type / character version / ink cost / strength /
willpower is Lorcana's, left behind in the 'Other' client by a copy. Each reads
`cardInfo.<lorcana field>` — a key `buildCardInfo(card, 'other')` never fills,
because the 'other' chain does not define it — and then falls through to
`cards.<column>`, which **is** a real column. So the block is dead for a normal
Other card but CAN fire on a row that carries Lorcana data under the Other
category. It is reproduced, reading the columns, so such a row prints the same
thing on both pages. Not tidied: the frozen page and V2 must agree.

## 2. Special features

**No category slot.** 'Other' legacy's badge list (4058-4160) is the shared
Pokemon list exactly — subset, serial, rookie, autograph, print finish, Variant
— so the adapter passes no `renderCategoryBadges` and no
`renderCategoryVariantBadge`.

## 3. Market

| Legacy block (line) | V2 location | Verdict |
| --- | --- | --- |
| `OtherPriceLookup` (5167-5190) | Market tab via `renderPricing` — **the same props, field for field**, including `cardId`, `manufacturer` and `game_type` | placed |
| **THREE marketplace tiles, not four** — legacy's grid is `grid-cols-3` (5205) and there is no TCGPlayer tile | `renderMarketplaceLinks` returns three links | placed |
| eBay + eBay Sold (5208-5250) | same `generateOtherEbaySearchUrl` / `…SoldListingsUrl` payloads, including `card_date` in place of a year and `dcm_grade_whole` | placed, copy shortened |
| PriceCharting (5258-5275) | the lookup's product page or legacy's character + name + number fallback | placed, copy shortened |

`cardInfo.game_type` in legacy's lookup props is a key the 'other' chain never
fills, so the value is always the literal `'other'`. Kept, with a comment.

`OtherPriceLookup` is the one lookup with an eBay fallback path
(`handleEbayPriceLoad`, ~717). That path was **not** given `marketRange` /
`isCached` / `cacheAgeDays` — the eBay response carries none of them and the
fields are optional, so the hero simply shows the estimate with no range and no
freshness line, which is the honest answer. The PriceCharting path got all
three, like every other lookup.

## 4. Deliberate differences, recorded

1. **`cardInfo` precedence is reproduced, not reconciled.** Four rules are
   'Other' alone and are carried verbatim in
   `src/lib/cardDetail/cardInfoCategories.ts`: the subset is appended with NO
   frame-treatment filter (unlike MTG / One Piece / Yu-Gi-Oh); `manufacturer`
   reads `cards.manufacturer`, not `manufacturer_name`; `year` is
   `release_date` raw; and `autographed` / `memorabilia` are decided by the
   model JSON ALONE. That last one matters — 'Other' is the only category
   besides sports that does NOT carry the Pokemon quirk where a NULL
   `memorabilia_type` reads as true, so the Special features panel stays hidden
   on a card that has nothing, instead of appearing empty. (Legacy's object
   literal declares `autographed` and `memorabilia` twice; JavaScript's later
   key wins, and it is the JSON-only pair that is reproduced.)
2. **Rarity buckets.** `categoryUsesRarityBuckets('other')` is false, so
   `pickRarity` skips a grader bucket — the V2-wide rule.
3. **Structured data `brand`.** Legacy omits `brand` ENTIRELY when the card has
   no manufacturer (1480-1484); the shared `buildCardStructuredData` always
   emits one, so the adapter passes `fallbackBrand: 'Trading Cards'`. This is
   the same departure the sports adapter records with `'Sports Cards'`. The
   category (`'Collectible Trading Cards'`), the breadcrumb ("Other Cards" →
   `/upload?category=Other`) and the fallback card name
   (`'Collectible Card'`) are legacy's exactly (1485, 1511, 1516).
4. **`uploadHref` and `retakeHref` are both `/upload?category=Other`.** There
   is no `/upload/other` route; legacy's not-found link and retake CTA are both
   the query-string form (2213, 6543).

## 5. Verification

Test card: `0006d261-2865-4df4-a4d0-eae9de83b55e` (Anakin Skywalker, Topps Star
Wars Galaxy #14 — a MIGRATED STAR WARS ROW, which is the useful case, public,
from `/sitemap.xml`).

- `curl` `?v=1` → 200, `?v=2` → 200.
- `curl` `/starwars/<same id>?v=2` → `307` to
  `/other/<id>?v=2`, the override preserved.
- Browser, logged out, `?v=2`: identity ("The Chosen One", Star Wars Galaxy
  #14), grade chip 10, four subgrades with the limiting-factor line, value
  `$6.03`, the three holder cards, Grade details, the 'Other' fields (card
  name, manufacturer Topps), Market with `OtherPriceLookup` and **three** links
  (no TCGPlayer, as legacy has it), Reports. The Special features panel is
  correctly absent — nothing on this row is true under 'Other''s JSON-only
  autograph/memorabilia rule.
- No React console errors from this page.
- Loaded at 375 wide: `document.scrollWidth === 375`, no horizontal scroll.
- Nothing from another category in the page text (regex over the V2 root for
  pokemon / magic / scryfall / one piece / lorcana / yu-gi-oh / DON!! returned
  no matches).

## Appendix — the DCM Optic™ report's own "Card Information" sub-block

Legacy's full report (`renderCardInfo`, mtg 5940, lorcana 6220, onepiece 6242,
yugioh 6281, other 6025) prints a SECOND identity grid inside the report, and
each category merges its own fields into it from `conversational_card_info`
(MTG adds mana cost, type line, creature type, power/toughness, colour
identity, set code and artist; the others add their equivalents).

V2's shared `FullAnalysisJson` prints that grid from the DVG blob's own
`card_info`, with every category's field names listed together and `Field`
drawing nothing for one the record does not carry — the data-driven pattern the
sports pass established when it added Sport and Team. The category-specific
names legacy merges in from `conversational_card_info` are **not** repeated
there, because V2 already shows every one of them in the Overview tab's
category slot, which is the block this parity walk covers above.

Scope call, recorded: adding those names to the shared report grid would be
additive and data-driven, but they live in a different object from the one that
grid reads, so they would print empty on every card. Left out on purpose.
