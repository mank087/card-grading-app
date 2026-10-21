# Authenticity flag: plan to stop false "Unlicensed" calls

> **SUPERSEDED Oct 21, 2026 (owner decision).** Photos cannot reliably establish authenticity, so instead of fixing the flag it was removed from every customer-facing surface: the card page Special features badge, the legacy card pages for all seven categories, their full-analysis field lists, and the enterprise card report. `card_info.authentic` is still produced and stored for internal use only. Do not build the phases below unless the owner reopens this. The findings section remains accurate.

Oct 21, 2026. Owner request after the Charizard 16131421 case.

## What happened

A customer's gold Charizard 4/102 was graded with `card_info.authentic = false`, which shows on the card page as **Authentic: Unlicensed**. A manual review then called it a replica and changed the set. The card matches the official 2021 Celebrations Ultra-Premium Collection metal Charizard: color-filled energy symbols, a metallic-gold logo on an otherwise regular back, and metal showing where the paint wore at the corners. The flag was cleared on Oct 21 (set to null, with `authenticity_review` recording the owner decision).

## What the data says (cards graded Oct 6 to Oct 20)

| Measure | Value |
|---|---|
| Cards the grader marked `authentic = false` | 95 of about 3,700 (2.5%) |
| Of those, the first look independently said `licensed` | 29 |
| First look said `cannot_tell` | 6 |
| First look agreed, `custom_or_unlicensed` | 60 |

The 29 disagreements are mostly official products:

- Official regional printings: Simplified Chinese 151, Chinese Scarlet & Violet.
- Official specialty products: MTG Judge Gift Card, Ancient Mew movie promo, Wizards promos.
- **Sets released after the model's training data:** Mega Evolution (2025), Ascended Heroes (2026), 30th Celebration (2026), Star Trek Commander (2026), Yu-Gi-Oh BETB (2026), Gundam GCG (2026).

The model does not recognize those sets and reads "unrecognized" as "unofficial". The 60 agreements are mostly genuine non-licensed items: fan-made "VCOS" Pikachu cosplay customs, bootleg One Piece sets, custom college cards and unlicensed prism art.

Three root causes:

1. **The flag is a single model opinion with no corroboration.** The first look's independent `licensed_product` read already exists on every card and is ignored.
2. **The prompt invites false positives.** The deltas say "false if proxy/counterfeit/unofficial" with no evidence requirement, so an unfamiliar set, a specialty format (metal, oversized, regional language) or a post-cutoff release is enough.
3. **Nothing downstream is calibrated to the flag's reliability.** The card page states "Unlicensed" as fact. Meanwhile the price and identity paths ignore the flag entirely, so a flagged custom Jordan still showed $28,679.

## Plan

### Phase 0: build the truth set (no engine change)

- Build `scripts/authenticity-calibration-set.json`, about 60 cards, labeled by eye:
  - **Should flag:** VCOS customs, bootleg One Piece, custom college cards, unlicensed prism art, obvious gold-foil replicas with all-gold energy symbols.
  - **Must not flag:** the Celebrations metal Charizard, official regional printings, Judge and other special promos, official reprints (Topps Archives and similar), and post-cutoff sets from each game.
  - **Cannot tell:** cases where photos genuinely cannot settle it.
- Add an authenticity column to the calibration runner (same pattern as identity anchors).
- Baseline today's flag against it: precision and recall.

**Exit:** the baseline numbers and a labeled set the owner has reviewed.

### Phase 1: corroborate before flagging

- **Show the flag only when the two independent reads agree.** That means the grader says not authentic and the first look says `custom_or_unlicensed`.
  - On the Oct 6 to 20 data this alone removes 35 of 95 flags. That is all 29 disagreements and the 6 cannot-tells, and most of those removals are the false positives above.
- **Catalog veto.** Never flag a card linked with high confidence to an official catalog entry (Pokémon EN/JA, Scryfall, One Piece, Lorcana, Yu-Gi-Oh). An official catalog match is stronger evidence than the model's opinion.
- **Known specialty products table.** Add a `knownOfficialSpecialty.ts` list on the `pokemonSpecialPromos.ts` pattern, covering official metal cards (Celebrations UPC Charizard and Pikachu, and the other UPC metal releases), jumbo/oversized promos, and 1999 Burger King gold cards. A match means the card is never flagged and shows its proper identity.

### Phase 2: change what the grader is asked

- **Replace the boolean** with `authenticity: "consistent_with_official" | "possible_unlicensed" | "cannot_tell"`, plus `authenticity_evidence: string[]`.
- **Require concrete tells for `possible_unlicensed`.** These are things like:
  - fan or custom branding (e.g. "VCOS");
  - misspellings or wrong text;
  - a back design that differs from the game's standard back;
  - all-gold energy or type symbols on a "gold" card;
  - no manufacturer or copyright mark.
- **State outright what does not count.** "I do not recognize this set or promo" is never evidence. New sets are released after the model was trained. Regional languages, metal, oversized and other specialty formats are official products.
- **Make `cannot_tell` the default** when photos cannot settle it.
- Keep the old `authentic` field for one release, derived from the new one, so old code paths keep working.

### Phase 3: what customers see

- **Rename the badge.** "Unlicensed" becomes **"Authenticity: Not verified"** (for `possible_unlicensed`) with a one-line explanation and a link. It never says fake or unlicensed as fact, because DCM grades from photos and cannot authenticate.
- **Hold the price on flagged cards.** Show "Market value not shown: authenticity not verified" instead of a genuine card's price. This only ships after Phase 1 brings precision up.
- **Customer dispute path.** Add "authenticity" as a concern in the grade review request form, so a customer can ask us to look again.
- **Admin control.** Add a "Clear authenticity flag" button on the admin grade-review page, recording reason, admin and date. This replaces one-off scripts.

### Phase 4: existing cards

- Re-evaluate every historical `authentic = false` card with the Phase 1 rule, which uses data already stored on each card (first look + catalog link). Downgrade disagreements to `cannot_tell`.
- **Owner decision before running.** It changes card pages, so dry run first with a count by category.

### Phase 5: keep it honest

- **Weekly monitor:** count flags by category and game, and list the ten newest flags for a quick by-eye check.
- **Add every customer dispute to the calibration set**, the same way grading disputes become anchors today.

## Success criteria

- At least 95% precision on `possible_unlicensed` flags in the calibration set.
- Zero flags on the must-not-flag anchors, including the metal Charizard and every post-cutoff set.
- At least 80% recall on clear-cut customs and bootlegs.
- No change to grades. Authenticity never moves a grade; it only labels.

## Order and effort

| Phase | Work | Risk |
|---|---|---|
| 0 Truth set | about half a day of labeling with the owner, about $5 of runs | none |
| 1 Corroboration + catalog veto + specialty table | about a day | low: it only removes flags |
| 2 Prompt and schema | about a day, plus a calibration run | medium: a prompt change, measured against Phase 0 |
| 3 Badge copy, price hold, dispute, admin button | about a day, web plus app parity | low after Phase 1 |
| 4 Historical re-evaluation | about an hour, owner approves | low with a dry run |
| 5 Monitor | about an hour | none |

Phase 1 alone fixes most of the observed false flags, and it only removes flags, so it is safe to ship first.
