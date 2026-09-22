# Card detail V2 — MTG parity walk

**Date:** 2026-09-22
**Branch:** `card-detail-v2` (worktree `tmp/card-detail-v2`)
**Legacy source of truth:** `src/app/mtg/[id]/CardDetailClient.tsx` (6,746 lines, frozen)
**V2 adapter:** `src/app/mtg/[id]/CardDetailV2Client.tsx`

Same walk as the sports one. **Every block of page chrome, hero, analysis,
footer, report and modals is the shared shell, identical to Pokemon and
sports** — see `CARD_DETAIL_V2_SPORTS_PARITY_2026-09-22.md` §1, §3, §5, which
apply here unchanged, including the three blocks dropped when the Pokemon
adapter was built (Card Detection Assessment, Front/Back Analysis, Card Text
(OCR)). Only what MTG does differently is listed below.

---

## 1. Card Information — the MTG-only half

Legacy's grid is `3863-4246`. The shared `CardFacts` prints Set, Subset, Year,
Card number, Rarity/variant, Language and DCM serial; everything else in that
grid lands in `src/components/card-detail/categories/MtgCardInfo.tsx`.

| Legacy block (line) | V2 location | Verdict |
| --- | --- | --- |
| Card Name, with `flavor_name` (Universes Beyond / Secret Lair crossover) above the canonical name, and the bilingual split (3888-3928) | `MtgCardInfo` "Card name" | placed |
| Mana Cost (3931), + the `mtg_mana_cost` Scryfall fallback (4089) | `MtgCardInfo` "Mana cost" — one row, legacy's precedence | placed, two blocks merged |
| Type / type line (3942), + the `mtg_type_line` fallback (4099) | `MtgCardInfo` "Type" | placed, two blocks merged |
| Creature Type (3953) | `MtgCardInfo` "Creature type" | placed |
| Power / Toughness (3964) | `MtgCardInfo` "Power / toughness" | placed |
| Color Identity chips (3975), + the `mtg_colors` fallback (4109) | `MtgCardInfo` "Color identity" / "Colors" | placed |
| Set + expansion code (4006) | Set is `CardFacts`; the code is `MtgCardInfo` "Set code", with the `mtg_set_code` fallback (4147) folded in | placed, split |
| Card Number (4023) | `CardFacts` "Card number" | placed |
| Rarity (4033), + the `mtg_rarity` fallback with `mythic` → "Mythic Rare" (4137) | `MtgCardInfo` "Rarity". **The shared row cannot carry it:** `viewModel.identity.rarityOrVariant` does not read `cards.mtg_rarity`, so a Scryfall-only rarity would vanish | placed |
| Artist (4044) | `MtgCardInfo` "Artist" | placed |
| Foil "Finish" chip + `foil_type` (4052) | `MtgCardInfo` "Finish" | placed |
| Language, only when not English (4069 and 4169) | `MtgCardInfo` "Language" | placed, two blocks merged |
| Double-Faced indicator (4078) and its duplicate badge (4188) | `MtgCardInfo` "Card layout". The duplicate can never render (`x && !x`) and is dropped | placed |
| Promo (4158) | `MtgCardInfo` "Promo" | placed |
| Border Color (4179) / Frame Version (4189) | `MtgCardInfo` "Border" / "Frame" | placed |
| Keywords (4198) | `MtgCardInfo`, the shared `cd-chip-list` | placed |
| Scryfall database link (4227) | `MtgCardInfo`, a quiet link under the grid | placed, styled down |
| "Card Text" — rules and flavour (4443-4458) | `MtgCardInfo`, `cardInfo.card_front_text` | placed |

## 2. Special features

The shared `SpecialFeatures` draws subset, serial, rookie, autograph (+ auth
markers + the unverified footnote), print finish, Variant and Authentic — MTG
legacy's list (4301-4385) is Pokemon's, so the shared badge set is used as-is,
Variant included (no `renderCategoryVariantBadge`, unlike sports).

| Legacy badge (line) | V2 location | Verdict |
| --- | --- | --- |
| FOIL (4267) | `MtgFeatureBadges` | placed |
| RARITY, `mtg_rarity` (4275) | `MtgFeatureBadges` | placed |
| DOUBLE-FACED (4285) | `MtgFeatureBadges` | placed |
| Extended art / Showcase / Borderless / Retro frame / Full art (4387-4423) | `MtgFeatureBadges` | placed |
| FOIL TYPE, when it is not "Standard Foil" (4424) | `MtgFeatureBadges` | placed |
| The section's extra visibility terms (4254-4260) | `hasMtgFeatures` → `hasCategoryFeatures` | placed |

`SUBSET/INSERT` at 4295 filters frame treatments out of the subset before it
prints. V2 keeps legacy's *set-name* frame-treatment filter (in
`buildTcgCardInfo`) but the shared subset badge prints `cardInfo.subset`
unfiltered, the way Pokemon and sports do. **Recorded difference**, not a bug:
the value is legacy's, the filter is one badge's local rule.

## 3. Market

| Legacy block (line) | V2 location | Verdict |
| --- | --- | --- |
| `MTGPriceLookup` (5442-5468) | Market tab via `renderPricing` — **the same props, field for field**, including foil-aware `is_foil` and the `mtg_rarity` rarity fallback | placed |
| TCGPlayer link (5488-5525) | `renderMarketplaceLinks`, same `CardData` payload and the same set-then-name URL rule | placed, copy shortened |
| eBay + eBay Sold (5527-5580) | same `generateMTGEbaySearchUrl` / `generateMTGEbaySoldListingsUrl` payloads, `dcm_grade_whole` included | placed, copy shortened |
| Scryfall link, only when the row carries an id, labelled "Verified card" when `mtg_api_verified` (5584-5605) | `renderMarketplaceLinks`, fifth link | placed |
| PriceCharting (5608-5625) | `renderMarketplaceLinks`, the lookup's product page or legacy's search fallback | placed, copy shortened |

**The MTG disambiguator / Scryfall verification UI does not exist in the legacy
detail page.** The only Scryfall surface it has is the two links above plus the
"Verified card" wording; the disambiguator itself lives in the card-ID/API
layer, not here. Nothing was re-implemented and nothing is missing.

## 4. Deliberate differences, recorded

1. **`cardInfo` precedence is reproduced, not reconciled.** MTG reads
   `conversational_card_info` BEFORE the database columns (the Scryfall data is
   merged into that JSON by the API route), refuses to append a frame treatment
   — showcase, borderless, extended art, full art, etched, retro, anime — to the
   set name, and falls back to `'Wizards of the Coast'` for the manufacturer.
   `buildCardInfo(card, 'mtg')` carries all three verbatim, in
   `src/lib/cardDetail/cardInfoCategories.ts`.
2. **Rarity buckets.** `categoryUsesRarityBuckets('mtg')` is false, so
   `pickRarity` skips a grader bucket and the printed rarity wins — the V2-wide
   rule made for Pokemon. The frozen legacy page still prints the bucket.
3. **Structured data.** The `brand` fallback is legacy MTG's own
   `'Wizards of the Coast'` (1489-1494) and the category string is legacy's
   `'Magic: The Gathering Trading Cards'`. As everywhere in V2 the shared
   builder prefers `conversational_decimal_grade` over the DVG recommended
   grade, which legacy MTG does not — the Phase 1 choice, not an MTG one.
4. **No emoji.** Legacy prints ✨ / 🔄 / ⭐ / 🖼️ / 🌌 / 📜 / 🎨 / 🔍 inside the
   chips and badges; V2 carries no emoji anywhere.
5. **Marketplace link copy.** The short form ("Active listings", "Price
   history", "Market data"); the URLs and payloads are legacy's exactly.

## 5. Anchors

MTG legacy is the one client with no `tour-live-market-pricing` /
`tour-market-pricing` id (Phase 0 §3). The shell renders all sixteen ids for
every category, so MTG gains the two rather than losing any; nothing
category-specific was needed.

## 6. Verification

Test card: `003a41f6-77f0-4daf-9c23-3b09eda124ae` (Moss Diamond, public, from
`/sitemap.xml`).

- `curl` `?v=1` → 200, `?v=2` → 200.
- Browser, logged out, `?v=2`: identity, grade chip 8, four subgrades, value,
  the three holder cards, Grade details, Market with `MTGPriceLookup` (matched
  "Moss Diamond [Foil] #327", live range, "fresh prices" — proof the additive
  `isCached` / `marketRange` are wired), the four marketplace links (Scryfall
  correctly absent: this row carries no `scryfall_id`), Pro estimates, Reports.
- No React console errors; the only console entries are a 429 and a 404 on
  dev-server resources, present on the other V2 pages too.
- Loaded at 390 wide: `document.scrollWidth === 390`, no horizontal scroll.
- Nothing from another category in the text; the only other-category words in
  the page are "Professional Sports Authenticator" and "Sportscard Guaranty",
  which are PSA's and SGC's own names in the mail-away estimates panel.

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
