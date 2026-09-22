# Card detail V2 — One Piece parity walk

**Date:** 2026-09-22
**Branch:** `card-detail-v2` (worktree `tmp/card-detail-v2`)
**Legacy source of truth:** `src/app/onepiece/[id]/CardDetailClient.tsx` (7,055 lines, frozen)
**V2 adapter:** `src/app/onepiece/[id]/CardDetailV2Client.tsx`

**Every block of page chrome, hero, analysis, footer, report and modals is the
shared shell, identical to Pokemon and sports** — see
`CARD_DETAIL_V2_SPORTS_PARITY_2026-09-22.md` §1, §3, §5, which apply here
unchanged, including the three blocks dropped when the Pokemon adapter was
built. Only what One Piece does differently is listed below.

---

## 1. Card Information — the One Piece-only half

Legacy's grid is `3812-4146`. The shared `CardFacts` prints Set, Subset, Year,
Card number, Rarity/variant, Language and DCM serial; everything else lands in
`src/components/card-detail/categories/OnePieceCardInfo.tsx`.

| Legacy block (line) | V2 location | Verdict |
| --- | --- | --- |
| Card Name, bilingual (3838) | `OnePieceCardInfo` "Card name" | placed |
| Card Type — Leader / Character / Event / Stage (3872) | `OnePieceCardInfo` "Card type" | placed |
| Color, slash-separated chips (3882) | `OnePieceCardInfo` "Color" | placed, colour fills dropped |
| Power (3912) / Cost (DON!!) (3922) / Life (3932) / Counter (3942) | `OnePieceCardInfo`, legacy's labels kept | placed |
| Attribute (3952) / Sub types → "Affiliations" (3962) / Variant type (3972) | `OnePieceCardInfo` | placed |
| Set + expansion code (3982), and the duplicate Expansion Code block (4068) | Set is `CardFacts`; the code is `OnePieceCardInfo` "Set code", the two legacy blocks merged into one | placed |
| Card Number (4001) | `CardFacts` "Card number" | placed |
| Rarity (4011) / Artist (4021) | `OnePieceCardInfo` | placed |
| Finish — FOIL + `foil_type` (4031) | `OnePieceCardInfo` "Finish" | placed |
| Language, only when not English (4048 and 4088) | `OnePieceCardInfo` "Language", the two blocks merged | placed |
| Card layout — double-faced (4058), and its duplicate badge (4118) | `OnePieceCardInfo` "Card layout". The duplicate can never render (`x && !x`) and is dropped | placed |
| Promo (4078) | `OnePieceCardInfo` "Promo" | placed |
| Border (4098) / Frame (4108) | `OnePieceCardInfo` "Border". **Frame is dropped** — `frame_version` is an MTG-only key that `buildCardInfo(card, 'onepiece')` never fills and the `cards` table has no such column for One Piece, so the block is dead | placed / dropped |
| Keywords (4128) | `OnePieceCardInfo`, the shared `cd-chip-list` | placed |

## 2. Special features

The shared `SpecialFeatures` draws subset, serial, rookie, autograph, print
finish, Variant and Authentic — One Piece legacy's list is Pokemon's plus five
variant badges and two more at the end.

| Legacy badge (line) | V2 location | Verdict |
| --- | --- | --- |
| Parallel art (4211) | `OnePieceFeatureBadges` | placed |
| Manga art, suppressed on a `parallel_manga` card (4219) | `OnePieceFeatureBadges` | placed |
| Parallel manga (4227) | `OnePieceFeatureBadges` | placed |
| SP card (4235) | `OnePieceFeatureBadges` | placed |
| Alternate art (4243) | `OnePieceFeatureBadges` | placed |
| Promo (4295) and Foil (4305) | `OnePieceFeatureBadges` | placed |
| The section's extra visibility terms (4159-4163) | `hasOnePieceFeatures` → `hasCategoryFeatures` | placed |

As with MTG, legacy filters frame treatments out of the SUBSET badge only; the
shared badge prints `cardInfo.subset` as Pokemon and sports do. Recorded
difference, not a bug.

## 3. Market

| Legacy block (line) | V2 location | Verdict |
| --- | --- | --- |
| `OnePiecePriceLookup` (5523-5541) | Market tab via `renderPricing` — **the same props, field for field** | placed |
| TCGPlayer (5566-5600) | same `CardData` payload and the same set-then-name URL rule | placed, copy shortened |
| eBay + eBay Sold (5606-5640) | same `generateOnePieceEbaySearchUrl` / `…SoldListingsUrl` payloads — **only name, character and number**, with no grade term, which is legacy's | placed, copy shortened |
| PriceCharting (5648-5665) | the lookup's product page or legacy's character + number fallback query | placed, copy shortened |

Three keys legacy reads in these chains — `cardInfo.card_id`,
`cardInfo.set_year`, `cardInfo.rarity` — are **not defined on the object**, so
they always fall through to the next term. They are kept in the adapter, with
comments, so the chain reads the same as the frozen page.

## 4. Deliberate differences, recorded

1. **`cardInfo` precedence is reproduced, not reconciled.** One Piece's chain
   is MTG's character for character — model JSON first, no frame treatment
   appended to the set name — with `'Bandai'` as the manufacturer fallback.
   The four JSON-first TCGs therefore share one builder,
   `buildTcgCardInfo` in `src/lib/cardDetail/cardInfoCategories.ts`. Note the
   legacy chain reads the GENERIC json keys (`card_color`, `card_power`,
   `card_cost`, `life`, `counter_amount`, `attribute`, `sub_types`,
   `variant_type`) and only the COLUMNS are `op_`-prefixed; that is carried
   verbatim.
2. **Rarity buckets.** `categoryUsesRarityBuckets('onepiece')` is false, so
   `pickRarity` skips a grader bucket — the V2-wide rule. Verified on screen:
   the test card prints `L`, its real One Piece rarity.
3. **Structured data.** Brand fallback `'Bandai'`, category `'One Piece
   Trading Cards'`, breadcrumb "One Piece Cards" → `/upload/onepiece`, all
   legacy's (1486, 1514).
4. **`retakeHref` is `/upload?category=One%20Piece`**, percent-encoded, which
   is what legacy sends (3324, 6791).
5. **No emoji.** Legacy prints ✨📖🌟🎨🔄 inside the badges; V2 carries none.

## 5. Known pre-existing issue, NOT introduced here

`generateTCGPlayerSearchUrl` / `generateTCGPlayerSetSearchUrl`
(`src/lib/tcgplayerUtils.ts`) special-case only Magic and Lorcana and default
everything else to `productLineName: 'pokemon'`. The One Piece TCGPlayer link
therefore points at `tcgplayer.com/search/pokemon/…`. **V2 passes the identical
`CardData` the legacy page passes, so both pages produce the identical wrong
URL.** Fixing the util is out of scope for this rollout; it affects One Piece,
Yu-Gi-Oh, Star Wars and Other equally.

## 6. Verification

Test card: `0c2e3695-7b56-447f-98f2-9e2366f5ffe4` (Monkey.D.Luffy, Romance
Dawn OP01-003 L Parallel, public, from `/sitemap.xml`).

- `curl` `?v=1` → 200, `?v=2` → 200 (checked on
  `00b799cf-58d2-491d-aaec-c3186f7250db`, also public).
- Browser, logged out, `?v=2`: identity, grade chip 7, four subgrades, value,
  the three holder cards, Grade details, the One Piece fields (card type
  Leader, colour Red, power 5000, life 4, attribute Strike, affiliations
  "Supernovas, Straw Hat Crew", variant Parallel, rarity L, finish Foil),
  Special features (shared Variant "L", Authentic, One Piece "Parallel art"
  and "Foil"), Market with `OnePiecePriceLookup` and the four links, Reports.
- No React console errors. `[OnePiecePriceLookup] Error: No matching products
  found` is the lookup reporting its own data outcome and is the same on the
  legacy page; the rest are 404s on dev-server resources.
- Loaded at 375 wide: `document.scrollWidth === 375`, no horizontal scroll.
- Nothing from another category in the page text.

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
