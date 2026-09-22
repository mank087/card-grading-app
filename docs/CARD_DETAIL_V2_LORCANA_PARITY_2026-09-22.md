# Card detail V2 — Lorcana parity walk

**Date:** 2026-09-22
**Branch:** `card-detail-v2` (worktree `tmp/card-detail-v2`)
**Legacy source of truth:** `src/app/lorcana/[id]/CardDetailClient.tsx` (7,004 lines, frozen)
**V2 adapter:** `src/app/lorcana/[id]/CardDetailV2Client.tsx`

**Every block of page chrome, hero, analysis, footer, report and modals is the
shared shell, identical to Pokemon and sports** — see
`CARD_DETAIL_V2_SPORTS_PARITY_2026-09-22.md` §1, §3, §5, which apply here
unchanged, including the three blocks dropped when the Pokemon adapter was
built. Only what Lorcana does differently is listed below.

---

## 1. Card Information — the Lorcana-only half

Legacy's grid is `3866-4160`. The shared `CardFacts` prints Set, Subset, Year,
Card number, Rarity/variant, Language and DCM serial; everything else lands in
`src/components/card-detail/categories/LorcanaCardInfo.tsx`.

| Legacy block (line) | V2 location | Verdict |
| --- | --- | --- |
| Card Name, bilingual (3895) | `LorcanaCardInfo` "Card name" | placed |
| Ink Color, six-colour badge (3928) | `LorcanaCardInfo` "Ink colour" | placed, emoji dropped |
| Card Type (3955) | `LorcanaCardInfo` "Card type" | placed |
| Character Version (3965) | `LorcanaCardInfo` "Character version" | placed |
| Ink Cost / Strength / Willpower / Lore Value (3975-4014) | `LorcanaCardInfo` | placed |
| Inkwell badge (4015) | `LorcanaCardInfo` "Inkwell" | placed |
| Set + expansion code (4024) | Set is `CardFacts`; the code is `LorcanaCardInfo` "Set code" | placed, split |
| Collector Number (4043) | `CardFacts` "Card number" | placed |
| Rarity (4053) | `LorcanaCardInfo` "Rarity" — the same `rarity_or_variant`/`rarity_description` chain legacy prints | placed |
| Artist (4063) | `LorcanaCardInfo` "Artist" | placed |
| Enchanted (4073) / Foil (4083) | `LorcanaCardInfo` "Enchanted" / "Finish", with legacy's rule that Foil is hidden on an Enchanted card | placed |
| Language, only when not English (4093) | `LorcanaCardInfo` "Language" | placed |
| Franchise (4103) | `LorcanaCardInfo` "Franchise" | placed |
| Classifications (4113) / Abilities (4130) | `LorcanaCardInfo`, the shared `cd-chip-list` | placed |
| Flavor Text (4148) | `LorcanaCardInfo`, quoted prose | placed |

## 2. Special features

**No category slot.** Lorcana legacy's badge list (4162-4256) is the shared
Pokemon list exactly — subset, serial, rookie, autograph, print finish, Variant
— so the adapter passes no `renderCategoryBadges` and no
`renderCategoryVariantBadge`, and the shared `SpecialFeatures` draws all of it.

## 3. Market

| Legacy block (line) | V2 location | Verdict |
| --- | --- | --- |
| `LorcanaPriceLookup` `#tour-live-market-pricing` (5258-5282) | Market tab via `renderPricing` — **the same props, field for field**, including foil-aware `is_foil`, the `rarity ?? rarity_tier` chain and the `conversational ?? recommended` grade fallback | placed |
| "Find and price…" `#tour-market-pricing` (5285) | Market tab `renderMarketplaceLinks` | placed |
| TCGPlayer (5300-5345) | same `CardData` payload (`character_version`, `expansion_code`, `is_enchanted`, `is_foil`) and the same set-then-name URL rule | placed, copy shortened |
| eBay + eBay Sold (5348-5398) | same `generateLorcanaEbaySearchUrl` / `…SoldListingsUrl` payloads, `dcm_grade_whole` included | placed, copy shortened |
| **Scryfall link (5400-5420)** | — | **dropped.** Its condition is `card.scryfall_id`, a Magic column a Lorcana row never carries, and the URL it builds is a Magic card page. The block is dead on every Lorcana card and would be wrong on any card where it fired. |
| PriceCharting (5424-5447) | `renderMarketplaceLinks`, the lookup's product page or legacy's own three-part fallback query (character · version · number) | placed, copy shortened |

## 4. Deliberate differences, recorded

1. **`cardInfo` precedence is reproduced, not reconciled.** Lorcana reads the
   DATABASE COLUMNS FIRST — like Pokemon, unlike the other five in this batch —
   because the grading route writes verified catalogue values into them. Three
   rules are Lorcana's alone and are carried verbatim in
   `src/lib/cardDetail/cardInfoCategories.ts`: the set name is taken from
   `cards.card_set` only when it passes legacy's `isValidSetName` (rejecting
   '', 'unknown', 'n/a' and anything containing 'unknown lorcana') and the last
   resort is the literal 'Unknown Set'; the subset is appended only when the set
   name does not already contain it; and `year` is `release_date` RAW, not
   sliced to four characters as Pokemon slices it.
2. **Rarity buckets.** `categoryUsesRarityBuckets('lorcana')` is false, so
   `pickRarity` skips a grader bucket — the V2-wide rule. Verified on screen:
   the test card prints `Enchanted`, its real rarity.
3. **`uploadHref` is `/lorcana/upload`**, not `/upload/lorcana`. That is
   legacy's own not-found link (2257, 2848) and the two routes are different.
   The retake CTA is `/upload?category=Lorcana` (2243, 6739), as legacy has it.
4. **Structured data.** Brand fallback `'Disney Lorcana'`, category
   `'Disney Lorcana Trading Cards'`, and the breadcrumb href is legacy's
   query-string form `https://dcmgrading.com/upload?category=Lorcana` (1543) —
   the only category whose breadcrumb is not `/upload/<category>`.
5. **No emoji.** Legacy prints 🟡🟣🟢🔴🔵⚫ inside the ink badge and ✨/💎
   elsewhere; V2 carries no emoji anywhere.

## 5. Anchors

Lorcana is the only client that attaches `tour-optic-score` through `id=`
rather than `tourId=` (Phase 0 §3). The shell renders all sixteen ids for every
category, so nothing category-specific was needed.

## 6. Verification

Test card: `03a6200c-cf5f-4636-a1f8-fbef3d5d4bc3` (Mickey Mouse - Steamboat
Pilot, public, from `/sitemap.xml`).

- `curl` `?v=1` → 200, `?v=2` → 200.
- Browser, logged out, `?v=2`: identity, grade chip 10, four subgrades, value
  with the labelled low/median/high range, the three holder cards, Grade
  details, the Lorcana fields (ink colour Emerald, card type, character
  version, ink cost, strength, willpower, lore, inkwell, set code, rarity,
  artist, franchise, classifications), Market with `LorcanaPriceLookup` and
  "fresh prices" (proof the additive `isCached` / `marketRange` are wired), the
  four marketplace links with correct Lorcana URLs, Reports.
- No React console errors; only a 429 and a 404 on dev-server resources, the
  same pair the other V2 pages show.
- Loaded at 375 wide: `document.scrollWidth === 375`, no horizontal scroll.
- Nothing from another category in the page text (regex over the V2 root for
  pokemon / magic / scryfall / yu-gi-oh / one piece returned no matches).

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
