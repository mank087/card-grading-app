# Card detail V2 — Yu-Gi-Oh parity walk

**Date:** 2026-09-22
**Branch:** `card-detail-v2` (worktree `tmp/card-detail-v2`)
**Legacy source of truth:** `src/app/yugioh/[id]/CardDetailClient.tsx` (7,096 lines, frozen)
**V2 adapter:** `src/app/yugioh/[id]/CardDetailV2Client.tsx`

**Every block of page chrome, hero, analysis, footer, report and modals is the
shared shell, identical to Pokemon and sports** — see
`CARD_DETAIL_V2_SPORTS_PARITY_2026-09-22.md` §1, §3, §5, which apply here
unchanged, including the three blocks dropped when the Pokemon adapter was
built. Only what Yu-Gi-Oh does differently is listed below.

**The legacy Yu-Gi-Oh client is a copy of the One Piece client.** Its own
header comment still reads "🏴‍☠️ ONE PIECE CARD INFO", it imports the One
Piece eBay builders, and its Card Information grid still carries One Piece's
labels. The `CARD_DETAIL_V2_ONEPIECE_PARITY_2026-09-22.md` walk therefore
applies block for block; this file records only what is genuinely Yu-Gi-Oh's
and the one label correction.

---

## 1. Card Information — the Yu-Gi-Oh-only half

Legacy's grid is `3850-4184`. The shared `CardFacts` prints Set, Subset, Year,
Card number, Rarity/variant, Language and DCM serial; everything else lands in
`src/components/card-detail/categories/YugiohCardInfo.tsx`.

| Legacy field (line) | Legacy label | V2 label | Verdict |
| --- | --- | --- | --- |
| Card name, bilingual (3876) | Card Name | Card name | placed |
| `ygo_card_type` (3910) | Card Type | Card type | placed |
| `ygo_attribute` chips (3920) | Color | **Attribute** | placed, **relabelled** |
| `ygo_atk` (3950) | Power | **ATK** | placed, **relabelled** |
| `ygo_def` (3960) | Cost (DON!!) | **DEF** | placed, **relabelled** |
| `ygo_level` (3970) | Life | **Level / rank** | placed, **relabelled** |
| `ygo_scale` (3980) | Counter | **Pendulum scale** | placed, **relabelled** |
| `ygo_race` (3990) | Attribute | **Type** | placed, **relabelled** |
| `ygo_archetype` (4000) | Affiliations | **Archetype** | placed, **relabelled** |
| `ygo_frame_type` (4010) | Variant | Frame | placed, **relabelled** |
| Set + expansion code (4020), and the duplicate Expansion Code block (4106) | Set / Set Code | `CardFacts` "Set" + `YugiohCardInfo` "Set code" | placed, merged |
| Rarity (4049) / Artist (4059) | — | same | placed |
| Finish — FOIL + `foil_type` (4069) | Finish | Finish | placed |
| Language, not English (4086 and 4116) | Language | Language | placed, merged |
| Card layout, and its duplicate badge (4096 / 4146) | Card Layout | Card layout | placed; the duplicate can never render (`x && !x`) and is dropped |
| Promo (4126) / Border (4136) | — | same | placed |
| **Frame Version (4146)** | Frame | — | **dropped** — `frame_version` is an MTG-only key that `buildCardInfo(card, 'yugioh')` never fills; the block is dead on every Yu-Gi-Oh card |
| Keywords (4166) | Keywords | Keywords | placed |

### The relabelling, recorded in full

This is the one place in the whole rollout where V2 does **not** copy legacy's
words, and it is deliberate. The copy-paste left One Piece's labels attached to
Yu-Gi-Oh's fields, so the frozen page tells a Yu-Gi-Oh owner that their card's
DEF is its "Cost (DON!!)" and its Level is its "Life". Reproducing that would
put a known-wrong label into the redesigned page on purpose.

**The sources, the fallbacks and the conditionals are legacy's, untouched.**
Only the eight words changed. The frozen legacy client is not edited; it keeps
printing what it prints today until it is retired.

## 2. Special features

Identical to One Piece's, with `ygo_frame_type` in place of `op_variant_type`:
parallel art, manga art (suppressed on `parallel_manga`), parallel manga, SP
card, alternate art (4211-4251), plus promo and foil. They reach the shared
`SpecialFeatures` through `renderCategoryBadges`; `hasYugiohFeatures` carries
the section's extra visibility terms (4198-4202).

## 3. Market

| Legacy block (line) | V2 location | Verdict |
| --- | --- | --- |
| `OtherPriceLookup` `#tour-live-market-pricing` (5560-5580) | Market tab via `renderPricing` — **the same props, field for field**, including `manufacturer: 'Konami'` and `game_type: 'Yu-Gi-Oh'` | placed |
| TCGPlayer (5606-5640) | same `CardData` payload, `category: 'Yu-Gi-Oh'` | placed, copy shortened |
| **eBay + eBay Sold (5645-5680)** | same URLs — legacy calls `generateOnePieceEbaySearchUrl` / `…SoldListingsUrl` (import line 25) | placed verbatim; **see §5** |
| PriceCharting (5688-5700) | the lookup's product page or legacy's character + number fallback | placed, copy shortened |

As with One Piece, `cardInfo.card_id`, `cardInfo.set_year` and
`cardInfo.rarity` in legacy's chains are keys the object never defines. They
are kept, with comments, so the chain reads the same as the frozen page.

## 4. Deliberate differences, recorded

1. **`cardInfo` precedence is reproduced, not reconciled.** Yu-Gi-Oh's chain is
   One Piece's character for character — model JSON first, no frame treatment
   appended to the set name — with `'Konami'` as the manufacturer fallback, and
   it shares `buildTcgCardInfo` in `src/lib/cardDetail/cardInfoCategories.ts`.
   That includes the mapping the copy left behind: ATK reads the JSON key
   `card_power`, DEF reads `card_cost`, level reads `life` and scale reads
   `counter_amount`. Carried verbatim.
2. **Rarity buckets.** `categoryUsesRarityBuckets('yugioh')` is false, so
   `pickRarity` skips a grader bucket — the V2-wide rule. Verified on screen:
   the test card prints `Starlight Rare`.
3. **Structured data.** Brand fallback `'Konami'`, category `'Yu-Gi-Oh! TCG
   Trading Cards'`, breadcrumb "Yu-Gi-Oh Cards" → the query-string route
   `https://dcmgrading.com/upload?category=Yu-Gi-Oh`, all legacy's (1523, 1552).
4. **`uploadHref` and `retakeHref` are both `/upload?category=Yu-Gi-Oh`.**
   There is no `/upload/yugioh` route; legacy's not-found link and retake CTA
   are both the query-string form (2267, 6832).
5. **No emoji.** Legacy prints ✨📖🌟🎨🔄 inside the badges; V2 carries none.
6. **The eight relabelled fields**, §1 above.

## 5. Known pre-existing issues, NOT introduced here

Both are faults of shared helpers that the frozen legacy page hits identically,
because V2 passes the identical payload:

1. **The eBay links say "One Piece".** Legacy Yu-Gi-Oh imports
   `generateOnePieceEbaySearchUrl` / `generateOnePieceEbaySoldListingsUrl`
   (line 25), so both pages produce e.g.
   `_nkw=Kewl+Tune+Synchro+PHRA-EN039+One+Piece` under eBay's One Piece
   category id. V2 keeps legacy's helper so the two pages cannot disagree.
   **Worth a follow-up:** `src/lib/ebayUtils.ts` has no Yu-Gi-Oh builder.
2. **The TCGPlayer link says "pokemon".** `generateTCGPlayerSetSearchUrl` /
   `generateTCGPlayerSearchUrl` special-case only Magic and Lorcana and default
   everything else to `productLineName: 'pokemon'`. Affects Yu-Gi-Oh, One
   Piece, Star Wars and Other equally.

## 6. Verification

Test card: `0bf4b1b8-06e0-45ba-a17d-a62fa8d8154a` (Kewl Tune Synchro, Phantom
Revenge PHRA-EN039, public, from `/sitemap.xml`).

- `curl` `?v=1` → 200, `?v=2` → 200 (checked on
  `000fba65-a5ef-4564-921e-d237da20238b`, also public).
- Browser, logged out, `?v=2`: identity, grade chip 9, four subgrades, value
  `$20.65` with the labelled low/median/high range — the same number the legacy
  page shows on its collapsed "Market Value ~$20.65" badge, which is the
  cleanest proof the lookup wiring matches — the three holder cards, Grade
  details, the Yu-Gi-Oh fields (card type Spell Card, rarity Starlight Rare,
  finish Foil; this row carries no ATK/DEF/level, and neither page prints any),
  Special features, Market with `OtherPriceLookup` and the four links, Reports.
- No React console errors from the page itself.
- Loaded at 375 wide: `document.scrollWidth === 375`, no horizontal scroll.
- Nothing from another category in the V2 page text (regex over the V2 root for
  pokemon / magic / scryfall / one piece / lorcana / DON!! returned no matches).
  The "One Piece" strings in §5 are inside the eBay hrefs, which are legacy's.

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
