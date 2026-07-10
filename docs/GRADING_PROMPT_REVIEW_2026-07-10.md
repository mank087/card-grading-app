# Grading Prompt Review — Master Rubric + 8 Deltas + API Cost Audit
**Date:** 2026-07-10 · **Scope:** `prompts/master_grading_rubric_v5.txt` (5,487 lines, ~72K tokens), all 8 `*_delta_v5.txt` files (~205KB), and every OpenAI call in the per-card grading path.
**Goals (user-ranked):** 1) accuracy, 2) anti-hallucination/guessing, 3) token cost.

Every change below is tagged **[SAFE]** (cannot change grades) or **[GATED]** (grade-affecting — must pass `scripts/repeatability-harness.ts` + `run-calibration.ts` before shipping, per the standing rule).

---

## A. ACCURACY — defects found (priority order)

### A1. Over-detection bias lines — likely prompt-side root of the open corner-whitening bug [GATED]
Three master-rubric lines invert the burden of proof and directly contradict Section 1.9's "if you cannot confirm, do not report" (line 706):
- **759–760:** "A faint line you're unsure about? If it catches light differently → IT IS A SCRATCH. Do not talk yourself out of it."
- **911:** "Any white spot that isn't clearly dust = defect"
- **2813:** "When in doubt about whether something is a defect, it probably is."

On light borders (where the rubric itself admits whitening is low-contrast, 2254–2264) these force flagging ambiguous brightness — the exact "uniform minor whitening on all 4 corners" signature from the Joey/Cooper Flagg investigation. **Deleting these three lines may fix at the source what the cosmetic-verification structural-gating plan (`COSMETIC_VERIFICATION_REFINEMENT_SCOPE.md`) was designed to patch downstream.** Test this FIRST on the same calibration set — if FP rate drops with Shaq's recall intact, the structural-gating project shrinks or dies.

### A2. Centering: same words → three different scores (the flapping engine) [GATED]
- Language↔band tables disagree: C2 (3749–3757) maps "clearly/noticeably wider" to max 9; C5 (3853–3863) maps the same words to max 8; Quality-Tier tables (3408–3416) map "CLEARLY wider" to 8 and "OBVIOUSLY" to 7. Same observation → 7, 8, or 9 depending on which table the model lands on per run.
- Line 3400 calls 55/45 "Good" — the Score Guide (3441–3453) says 55/45 = 10. Direct contradiction inside the 9-vs-10 decision.
- 3203–3212, 3499–3504, 3577 **mandate mm measurements** ("Front Left border measured: ___mm") that Sections 1.7/6/7.5 prohibit — the model can't measure mm, so it invents numbers that then drive ratio math.
**Fix:** keep ONE language↔band table (Quality-Tier aligned to Score Guide), fix 3400, replace mm blanks with relative language ("left ≈ 1.3× right").

### A3. Retired rogue caps still alive [GATED]
- **1245:** "Cardstock exposure (white core visible) → 5" sits in Tier B — but ALL whitening is white-core exposure by the rubric's own definition (766–769) → a literal read caps any whitening at 5. Second feeder of whitening over-penalization.
- 1247–1258: count-based caps ("3+ heavy defects → 6") that Sections 1.11 and 6.5 explicitly retired.
- 1190–1199: validation examples contradict the retirement text 10 lines above, use banned mm precision, and conflict with the edge ladder.
- 3987–3995: corner structural table says crease→3/tear→2 vs Section 1.11's crease→4/tear→3; 3923–3926 uses retired "−3 to −4 points" deduction language.
- 3983–3985 & 4209–4211: "apply the spread adjustment" — an adjustment the ladders say doesn't exist.
- 4478–4479: surface ladder keeps a "3+ defects → subtract 1" count penalty the other ladders retired.

### A4. Cross-file scoring contradiction: Star Wars stains [GATED]
`starwars_delta:231–233` scores wax stains small→7/medium→6/large→5 while claiming to cite the master ladder, which says 6/5/4 (master:4469–4471). Every vintage SW stain grades +1 vs every other card type. Bonus: the master is itself split (1252 says large stain→5 vs 4471 says →4) — reconcile both.

### A5. Pokemon delta self-contradiction on set identification [GATED-light]
Lines 65–69: "DO NOT guess the set — backend determines it." Lines 415–583: a 6KB denominator lookup table that MANDATES set identification, with ≥5 denominator collisions (189→Darkness Ablaze *or* Astral Radiance, 245→Lost Origin *or* Silver Tempest…) and memory-recalled 2025/2026 sets. Delete the table; the backend DB lookup already exists. (Grade-adjacent only via card_info; still harness it.)

### A6. Route bug: generic vision-grade route mis-grades [SAFE code fix]
`src/app/api/vision-grade/[id]/route.ts:446` calls `gradeCardConversational(frontUrl, backUrl)` with **no cardType (silently grades as 'sports' with the sports delta) and no condition report**. Verify whether this route is still reachable from any client; fix or retire.

### A7. Smaller consistency fixes [GATED, batch with Phase 1]
- Two divergent metadata specs in master (5230–5238 vs 5300–5307), both stamped v9.0.
- quality_tier enum omits "Severely Off-Center" (3563 vs 3581) — cards ≤6 have no valid value.
- Two uncertainty systems (fixed letter-mapping vs "widen the band" instructions) + a stray "±0.0".
- Lorcana lists "Foil" as a rarity *tier* (173–176) — finish ≠ rarity; misclassifies foil Legendaries.
- Yu-Gi-Oh! claimed by BOTH its own delta and other_delta:11 — if routed to Other, none of the YGO-specific rules apply.
- Section numbering: 1.12 out of order, no 1.15, no 13, dead pointer to "Section 1.10.4" (4954).

## B. ANTI-HALLUCINATION — defects found

### B1. No escape hatch = forced invention [GATED — biggest behavioral win]
The corners/edges output formats (4086–4116, 4326–4358) require integer scores + 2–3 unique sentences **per corner/edge with no null/"cannot assess" option**, and Rule 10 demands 16 uniquely-worded descriptions "referencing actual colors" even when the photo doesn't resolve individual corners. Uniqueness-for-its-own-sake forces invented differentiating detail — the raw material of fabricated defects AND fabricated cleanliness.
**Fix:** allow `"score": null, "condition": "not assessable at this resolution"` per area (server already handles N/A from Section 5's not_visible flow); drop unique-wording, keep only "no verbatim copy-paste." Only other_delta blesses "unknown" — promote that pattern to the master so all 8 types inherit it. Add "unknown" to mandatory enums (pokemon card_era/border_color, lorcana ink_color).

### B2. Echo bait (known production leak class) [mostly SAFE]
- Master 5173–5234: fully filled example JSON (scores 9/9/10/9…, "Near Mint-Mint", timestamp "2025-01-15T14:32:00Z", prompt_version "DCM_Grading_v9.0") — these exact strings have leaked into production output before. Replace values with `<int 1-10>`-style placeholders.
- Master 5231: **mandated timestamp** — the model has no clock; always fabricated (v9.2 already server-stamps). Delete.
- Master 4691–4701: required first-person template "…I see microscopic white fiber exposure" — violates the rubric's own first-person ban, zoom-language ban, and microscopic-mark restriction. Rewrite.
- Deltas: real set names in example JSON (5 files), future/TBD sets from memory (Pokemon "Mega Evolution 2025/Ascended Heroes 2026", MTG 2025–26 TBD rows, OP-14/15 2026), sports worked examples where 5 of 6 land on grade 9 (anchoring), Star Wars examples asserting full final grades ("Grade 10"), version-stamp mismatches (pokemon header v5.1 / footer v5.0).
- Sports 167–177: "authentic: false if missing league logos" → legit unlicensed products (Leaf, pre-license Panini) flagged as counterfeit. Add "unlicensed ≠ counterfeit."

### B3. False-precision machinery [GATED]
- Confidence formula demanding percentage arithmetic over 32 subjective sub-ratings (1973–2044) — invented numbers; collapse to direct A–D criteria.
- "How Common (~5%, ~15%…)" centering priors (3226–3234) — teaches the model to sample a prior instead of observing. Delete.
- Fill-in-the-blank justification templates (3499–3515) — model completes the sentence whether or not it measured. Require facts, not templates.
- Section 7 "CORRECT" examples using 0.2mm/"max zoom" language that the same section prohibits (2740–2742, 2816–2822, 2853).

## C. COST — audit results

**Per-card today (typical): ~$0.19–0.21**, using repo rates (in $1.25/M uncached, $0.125/M cached, out $10/M).

| Call | Input | Output (typ.) |
|---|---|---|
| Main ensemble (gpt-5.1, n=3, one call, temp 0.3, seed 7, detail:high, 16K cap) | ~78–88K tok (72K rubric + 4–13K delta + ~2.2K images) | ~15K |
| Zoom (24 crops, n=5, lean ~1K prompt — rubric NOT sent ✓) | ~23K (mostly image tokens) | ~4K |
| Structural verify (conditional) | ~1–5K | ~1.5K |

**Key inversion: output dominates.** 3×5K completions ≈ $0.15 vs $0.014 for the entire *cached* input. The 72K rubric only dominates if caching misses ($0.109 vs $0.014 — 8× swing).

**Caching is correctly structured** (static system prefix, dynamic content only in the user message after images, `prompt_cache_key: dcm-grader-${cardType}`, hit % already logged). Two open items:
1. **Verify the hit rate is real** — run `scripts/audit-prompt-cache.ts` (it flags a suspicious p50 branch). [SAFE]
2. **Test ONE shared cache key** across card types — the 72K rubric precedes the delta, so all 8 types share the same prefix; per-type keys prevent a Pokemon grade from warming the cache for a Lorcana grade (low-volume types cold-miss constantly). [SAFE]

Other findings: dead code with live-looking API calls (3 unused grading functions in visionGrader, one at temp 1.0; missing prompt file they reference; 3 unreachable gpt-4o markdown-extraction calls), ~1MB of dead v4.2/backup prompt files, zoom crops overlap ~2–3× per pixel (deliberate but ~2× minimum image tokens), retry loop doesn't honor Retry-After, main `max_completion_tokens` 16K allows $0.48/card worst case.

## D. RECOMMENDED SEQUENCE

**Phase 0 — zero-grade-risk, do immediately [SAFE]:**
1. Run `scripts/audit-prompt-cache.ts`; if hit rate is low, A/B a single shared `prompt_cache_key`. (Up to ~$0.095/card, ~45%.)
2. Log completion_tokens p99 → later tune the 16K cap.
3. Delete dead prompt files (v4.2 + backups, ~1MB) and the 3 dead grading functions; fix or retire the generic vision-grade route (cardType/condition-report bug).
4. Echo-bait scrub that can't change scoring semantics: timestamp mandate, placeholder-ize example JSON values, version-stamp syncs. (Borderline — batch into Phase 1's harness run anyway since the files are being touched.)

**Phase 1 — surgical accuracy fixes [GATED, one harness run]:**
The contradiction kills: A1 bias lines, A2 centering unification + 55/45 fix + de-mm, A3 rogue caps, A4 SW stains + master stain split, A6/A7 batch, B1 escape hatches, B2/B3 remainder. Expected effects: whitening FP rate down (measure Shaq recall!), centering flap down, no 10-rate regression. **This phase likely obsoletes part of the cosmetic-verification structural-gating plan — run it against that same FP/TP card set first.**

**Phase 2 — restructure for tokens + adherence [GATED]:**
- Master: merge duplicate defect guides (§1.10 vs §6, ~250 lines), centering internal dedup (~180), weakest-link ×12 → ×3 (~70), "whitening ≠ 10" ×9 → ×2 (~120), triple checklists → one (~120), dead rounding (~40). **Total ~950–1,100 lines / ~17–20% (~6.5–8K tokens).**
- Deltas: kill ~28 ladder-row restatements (single master declaration "delta patterns are recognition-only; ALL scoring via master ladders"), promote 12 duplicated blocks to master (is_foil default-false, year-null, authentic heuristic, OCR-exact, era-narrative-only, simulated-damage, facsimile/reprint, holo-scratch, print-line), consolidate worked examples. **Total ~45–55KB / ~22–26%.**
- Combined: ~25–30% smaller prompt → cheaper cold misses AND better instruction adherence (shorter prompts follow rules better — accuracy co-benefit).

**Phase 3 — output/zoom diet [GATED, only after 1–2 settle]:**
Trim output-schema verbosity (the single largest line item, ~$0.15/card), zoom crop tile-boundary sizing (~23K → ~10K input). Do NOT touch ensemble n=3 or zoom n=5 — they are the variance-control mechanism (architecture review).

**Projected cost after Phases 0–2: ~$0.10–0.12/card** (from ~$0.19–0.21), with accuracy improved rather than traded away.

---
*Sources: three parallel reviews (master rubric line-by-line; 8 deltas + cross-file matrix; API/cost audit of visionGrader.ts, zoomInspection.ts, promptLoader_v5.ts, routes). Line numbers refer to current files at commit c8ab07d.*
