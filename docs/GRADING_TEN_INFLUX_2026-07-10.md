# Grade-10 Influx Investigation — 2026-07-10

**Trigger:** Customer reported cards with clear wear (worth ~7 at most) receiving grade 10 since this week's grading updates. Owner asked whether our recent changes caused an influx of unwarranted 10s.

**Verdict:** The influx is **real and statistically strong**, but it was **not caused by any of this week's committed code changes**. It is a **perception/recall regression** — the vision model is calling too many cards flawless, especially glare-obscured foil/chrome cards and at least one card graded through a plastic case — amplified by the fact that the grading system has **no calibration/regression guardrail**, so its 10-rate floats freely with model behavior.

---

## 1. The influx is real (not noise, not a data artifact)

Daily grade-10 rate, production `cards` (n=4,564 over 21 days):

| Window | 10-rate |
|---|---|
| Jun 19 – Jul 4 (pre-v9.1 baseline) | ~14–24% (mean **24.5%**, sd 6.8%) |
| Jul 5–8 (v9.1/v9.2 live) | 27% → 32% → 34% → 30% |
| **Jul 9** | **46.9%** (z = **+3.28**) |
| **Jul 10** | **55.8%** (z = **+4.59**) |

- Jul 9–10 sit **3.3–4.6 standard deviations** above the prior three-week baseline — not day-to-day variance.
- Average minimum subgrade rose from ~8.4 baseline to **9.05 (Jul 9)** and **9.28 (Jul 10)**.
- **Not a user-mix artifact:** 103 unique users graded on Jul 9–10; the 10-rate is still **52.6%** with the single highest-volume submitter removed. Broad across the population.
- **Broad across categories** (Jul 1–7 → Jul 9–10): Pokémon +29.9pts, Sports +21.7, One Piece +41.1, Yu-Gi-Oh +33.3. A shared-pipeline signal, not a card-type prompt issue.

## 2. Our committed changes this week did NOT cause it

All three grading-related commits this week are display/persistence only — verified by reading the code:

| Commit | What it does | Can it raise a grade? |
|---|---|---|
| `0fd6dac` Phase 1 (Jul 8) | Step 7.6 clamps structured **display** scores **down** to the final grade | **No** — only ever lowers; never touches `finalGrade`/`serverRounded`/`raw_sub_scores` |
| `91675cb` Phase 4 (Jul 9) | Other/Sports route field persistence; reads the server-**capped** grade | **No** — "No change to the grading algorithm" |
| `ea149d9` (Jul 9) | Cosmetic-verification refinement **scope doc only** (81 lines, no code) | **No** — not implemented |

Other candidates ruled out with data:
- **v9.2 evidence-reconciliation (Step 3.8)** — the rule that raises unsupported 7–8 categories to 9 — **fired exactly once in 21 days**, and that card ended at grade **7**. Not the cause.
- **No prompt files changed** since v9.1 (`b08f69e`, Jul 5).
- **Capping/weakest-link logic is intact:** every grade-10 card has **all four subgrades = 10** and **zero recorded defects** (0 incoherent 10s on any day). The shift is entirely at the perception layer, not in post-processing.

**Two distinct effects are stacked:**
1. **v9.1/v9.2 (Jul 5–6) raised the baseline** ~18% (Jul 1–4) → ~32% (Jul 6–8). This *is* attributable to the engine change (real 3-pass median ensemble + narrate-after-consensus).
2. **The Jul 9–10 spike (47–56%) has no corresponding code/prompt change in the repo.** With no regression gate, the most likely remaining causes are **OpenAI model-side drift** in GPT‑5.1 behavior (the grader stacks ~5 stochastic vision calls at base temp 0.3 — highly sensitive to model updates) or a higher **zoom-inspection fallback rate** (zoom failures aren't persisted, so this can't be confirmed from the DB alone). Server logs (`[GRADE RECALC] ⚠️ zoom inspection unavailable`) would disambiguate.

## 3. The 10s are genuinely unwarranted (ground truth)

Visual spot-check of recent grade-10 cards (all scored 10/10/10/10, zero recorded defects):

- **Roberto Clemente (Sports)** — graded **through a rigid plastic display case** (visible plastic frame + thumb-notch hole). Corners/edges/surface cannot be assessed through the holder. `case_detection` exists in the schema but did not gate the grade.
- **Jasson Domínguez, Greedent VMAX, Clemente refractor, Koby (One Piece)** — foil/chrome fronts shot with **heavy glare/reflection that obscures the surface and corners**, yet each scored a perfect surface/corner 10. The model defaults to "flawless" when it cannot actually see a defect, rather than withholding the 10 or lowering confidence.

**Reliability failure (grade shopping):** in the last **3 days alone**, the same card re-graded minutes/hours apart flapped:
- Aaron Rodgers **10 ↔ 7**, Giratina **10,10,10 ↔ 7**, Ethan Holliday **10 ↔ 8**, Jacob Misiorowski **10 ↔ 8**, Eddy Pineiro **8 ↔ 3**.

A card that legitimately deserves ~7 is sometimes receiving a 10. This is exactly the customer's complaint, and it confirms the 10s are not trustworthy.

**Magnitude:** Jul 9–10 produced ~113 grade-10s from 227 cards. At the baseline 24.5% rate we'd expect ~56 — i.e. **~55–60 "excess" 10s in two days** that likely would not have graded 10 previously.

## 4. Mechanism summary

The influx concentrates in cards the model rates **A/B image confidence** (A-tier: 70.8% 10-rate on Jul 9–10; B-tier: 50.8%). C/D correctly never award 10. But "A/B confidence" currently includes glare-occluded foil and cased cards. So the failure is: **model over-assigns high self-confidence and, given that, is far too generous — awarding Gem 10 on the *absence* of a visible defect rather than the *confirmed presence* of clean corners/edges/surface.**

---

## 5. Recommendations

**A. Immediate containment (stop the bleeding on customer trust)**
1. **"Verify, don't assume" Gem-10 gate.** A grade of 10 should require the inspection to have *positively confirmed* clean corners/edges/surface — not merely failed to find a defect. Where a region is glare/reflection-occluded, treat it as unverified: cap at 9 (or lower confidence) rather than awarding 10.
2. **Fix the cased-card leak.** Cards detected inside a slab/holder/plastic case should be flagged `reshoot_required`, not graded as raw 10s. Wire `case_detection` to actually gate.
3. **Glare handling.** When a foil/chrome surface is dominated by specular glare, the surface subgrade cannot be a confirmed 10 — require a usable read or withhold the top grade.

**B. Root-cause guardrail (the real fix — this is the 3rd grading swing in a week)**
4. **Stand up the calibration + repeatability harness as a required, monitored gate** (`scripts/repeatability-harness.ts`, `scripts/run-calibration.ts` already exist; calibration set is stale). Label a set spanning grades 1–10 that deliberately includes glare foil, chrome, and cased cards. **Run it daily against a production sample** and alarm when the 10-rate or calibration error drifts — this is what would have caught Jul 9–10, which had *no code change* to point at.
5. **Reduce compounding variance:** lower base temperature toward 0 and/or cut the number of stacked stochastic passes so the same card stops flapping 10↔7 (per the Jul 8 architecture review).

**C. Do NOT ship the pending cosmetic-verification refinement right now**
6. That work (`ea149d9` scope) *reduces* corner/edge over-detection — it pushes grades **up**. It was scoped for the opposite problem (Joey's clean cards under-graded to 7–8). Shipping it during a period of over-grading would make this worse. Re-baseline the calibration set first; only revisit over-detection once the 10-rate is back under control.

---

## 6. ADDENDUM — verified structural cause: the relaxed unanimity gate (v9.1b)

A parallel investigation identified a specific committed cause that this report initially underweighted. **Verified in code and data:**

- **Code** (`visionGrader.ts:2338-2344`): the Gem-Mint gate demotes 10→9 only when `uncertainty≥2 OR (!unanimous10 && !allSubgrades10)`. The `allSubgrades10` escape hatch (added in v9.1b, commit `b08f69e`, Jul 5) lets a **non-unanimous** 10 (passes e.g. `[9,10,10]`) keep its 10 whenever all four rounded subgrades land at 10. Because subgrades round with `Math.round` (9.5→10) and final grade follows weakest-link (final=10 ⟹ subgrades all 10), the escape hatch is open on essentially every final-10 card — so the unanimity requirement almost never fires.
- **Data** (last 5 days, 303 grade-10s): **108 = 35.6% are non-unanimous pass splits** that survived only via the escape hatch (e.g. Michael Jordan `[9,10,10]`, Luka Dončić `[10,10,9]`, Cooper Flagg `[9,10,10]`, Victor Wembanyama `[10,10,9]`). **64.4% have byte-identical passes** — the "3-pass ensemble" produces manufactured agreement, so `unanimous10` is a weak signal (the model rubber-stamps 3 identical 10s on cards it likes; the marginal cards are the splits).

**Reconciliation of the two effects:**
1. The relaxed gate explains the **elevated baseline** since Jul 5 (v9.1 ~30-34%) — it structurally permits 2-vs-1 splits to keep a 10.
2. It does **not** by itself explain the **Jul 8→9→10 step** (30%→47%→56%): the gate code was identical all week. That step is an upward **perception drift** flowing through the now-permissive gate. The two compound.
3. The strict-gate fix is **necessary but not sufficient**: it demotes ~36% of 10s, but ~64% are unanimous — including glare-obscured and cased cards (§3) that all three passes agree are "10". Those need the verify-don't-assume + case/glare gating (§5 A1-A3), and the drift needs the calibration monitor (§5 B4).

**Estimated combined impact:** strict gate alone → recent 10-rate ~50% × 0.64 ≈ **~32%** (back to the v9.1 baseline, not to June's ~20%). Adding glare/case verification + drift monitoring targets the remaining unwarranted unanimous-10s.

## 7. Should we revert to the June system? — No.

- The "June system" is not cleanly identifiable by version stamp (the `v4.2` label before Jul 6 was the junk fallback that v9.2 fixed). It is roughly the v8.5-v8.7 engine, which carried its **own** documented defects: single-call fake consensus, inverted STEP-3 centering math, `detail:'auto'`, four competing condition-label mappings, **no zoom inspection**, no ID validation, narrative/number mismatch.
- v9.1 was built to fix real, customer-reported problems (Joey under-grading, narrative mismatch) and added genuine improvements (zoom, narrate-after-consensus, structural verification, centering fix). A full revert throws those away to fix a defect that is **two surgical changes** (strict gate + verify-don't-assume) away.
- June's ~20% 10-rate was not a validated ground truth either — it was a different distribution produced by buggy code, not a calibrated target.

**Recommendation: keep v9.1, remove the over-permissiveness.** Ship the strict-unanimity gate (recovers most of what a revert would achieve for the 10-rate, surgically) + the verification gates, both behind the calibration harness. Do not hand-deploy ungated (per the architecture-review note on file).

### Minimal code change for the strict gate (`visionGrader.ts:2344`)
```
- if (finalGrade === 10 && (uncertaintyValue >= 2 || (!unanimous10 && !allSubgrades10))) {
+ if (finalGrade === 10 && (uncertaintyValue >= 2 || !unanimous10 || rigidCase)) {
```
Gate behind `scripts/repeatability-harness.ts` + `run-calibration.ts` with a labeled set that includes confirmed 9s, a confirmed 7, and glare/foil/cased cards; confirm the 10-rate drops AND true Gem-10s are not over-demoted before deploying.

## 8. IMPLEMENTATION (2026-07-10, this branch)

**Fix B evidence:** the engine *already detects* the case and ignores it — Clemente's stored JSON: `case_detection: {case_type:"top_loader", impact_level:"moderate", notes:"…slightly limit surface inspection"}` → still 10/10/10/10. Scale: **48/187 grade-10s (26%) in the last 3 days sat in a detected case.**

- **Fix A (strict unanimity):** drop the `allSubgrades10` escape hatch — a final 10 requires all three pass finals ≥10 (uncertainty gate unchanged).
- **Fix B (rigid-case gate):** `case_type ∈ {top_loader, semi_rigid, slab}` OR `impact_level ∈ {moderate, high}` → Gem 10 withheld (held at 9 with an explicit case note). `penny_sleeve`/`none` unaffected.
- **Deferred — glare gating:** `image_quality.glare_present` is a severity-less boolean, true on virtually every foil shot (all 3 sampled 10s). A blanket glare→no-10 rule would over-demote legitimate foil Gems. Needs a per-region glare/occlusion severity signal (zoom crops) first. Follow-up.
- **Calibration set rebuilt** (`scripts/calibration-set.json`, 10 cards): 5 restored anchors (Pineiro crease 3, Shaq wear 7, MJ clean 10, Andre clean 10, Saddam vintage 9) + 5 influx cases (Giratina flap 8, Rodgers flap 8, Clemente cased 9±0, Jasson glare-foil 9, Koby escape-hatch 9). `repeatability-harness.ts` restored from `grading-v9.2-joey-fixes` (89256fe), consolidated-engine import removed.
- **Version stamp:** `DCM_PROMPT_VERSION` → `DCM_Grading_v9.3` (grade-affecting change; DB must distinguish engines).

### Before/After (harness, N=2 per card, live engine)

| Card (anchor) | Expected | BASELINE | FIXED (v9.3) | Verdict |
|---|---|---|---|---|
| Pineiro (crease, structural) | 3±1 | [4,4] crease 2/2 | [4,3] crease 2/2 | ✓ held |
| Shaq (true wear) | 7±1 | [7,7] | [7,8] | ✓ held — no over-correction upward |
| MJ (clean Gem control) | 10±1 | [9,10] | [10,9] | ✓ true 10 still reachable |
| Andre (clean control) | 10±1 | [10,10] | [9,9] | △ in tolerance; strict gate cost it the 10 this round |
| Saddam (vintage borderline) | 9±1 | [8,8] | [7,7] | ✗ drifted low — cosmetic over-detection (pre-existing, unrelated to gates; gates only touch 10s) |
| Giratina (flap) | 8±1 | [7,7] | [9,7] | ✓ in tolerance |
| Rodgers (flap) | 8±1 | [7,7] | [9,9] | ✓ in tolerance |
| **Clemente (CASED)** | **9±0** | **[10,10] FAIL** | **[9,9] PASS** | **✓ Fix B works, deterministic** |
| Jasson (glare foil) | 9±1 | [9,10] | [9,10] | ✓ (glare gating deferred) |
| **Koby (escape hatch)** | **9±1** | **[10,8,7,7] spread 3** | **[9,10] spread 1** | **✓ Fix A demotes the split-10; spread 3→1** |
| **Aggregate** | | spread 0.50, accuracy 18/22 (82%) | spread 0.70, accuracy **18/20 (90%)** | |

Notes:
- Accuracy 82% → **90%**. Both headline defects (cased-10, escape-hatch-10) fixed and verified.
- Andre [9,9]: within tolerance, but shows the strict gate's known cost — a clean card whose passes split loses the 10. MJ kept a 10, so unanimous Gems still get through. Watch the production 10-rate after deploy; if clean Gems under-grade, the correct loosening is "non-unanimous 10 allowed only when zoom POSITIVELY verified all regions clean," not restoring the subgrade hatch.
- Saddam 8→7 and Rodgers 7→9 moves are run-to-run perception noise (gates only affect grade-10 cards) — the residual variance problem (architecture review: temp→0 / fewer passes) remains the next structural fix.
- Projected production impact: ~64% of recent 10s were unanimous → strict gate alone brings Jul-9/10-style 50% 10-rate to ~32%; the case gate removes a further slice (26% of recent 10s sat in detected cases) → expected landing zone ~25-30%, near the 24.5% baseline.

## Reproduction
- `scripts/_tmp-ten-influx-analysis.ts` — daily 10-rate + reconciliation firing
- `scripts/_tmp-ten-drill2.ts` — perception (min-subgrade) trend + incoherent-10 checks
- `scripts/_tmp-cap-firing.ts` — cap/limit firing + 10-rate by category + JSON shape
- `scripts/_tmp-confounders.ts` — significance (z-score), image-confidence tiers, user concentration, repeat-grade spread
- `scripts/_tmp-fetch-ten-images.ts` — downloads recent grade-10 card images for visual audit
- `scripts/_tmp-verify-gate.ts` — recovers per-pass finals; quantifies non-unanimous 10s (escape-hatch survivors)
