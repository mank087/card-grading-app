# DCM Grading System — Full-System Audit & Fix Plan

**Date:** July 1, 2026 · **Execution update: July 2, 2026 — see EXECUTION STATUS below**
**Status:** AUDIT COMPLETE — W1, W2, and the Riley mobile-crop hotfix EXECUTED July 2 (see below).

---

## EXECUTION STATUS (July 2, 2026)

**Backups:** all 9 prompt files at `prompts/backups/*_PRE-v8.9_2026-07-02.txt`; all code files were clean at git HEAD `2367d0e` before edits (git checkout = revert path).

### DONE — Mobile crop hotfix (Riley, W3 #1/#2)
- `dcm-mobile/app/grade/capture.tsx` + `dcm-mobile/lib/imageUtils.ts`: gallery picks now use
  `compressImage` (resize+compress ONLY — no center-band, no aspect force-crop). Camera path
  unchanged (its crop models the preview). Fixes DSLR/gallery uploads being cut off.
- ⏳ REQUIRES DUAL OTA PUBLISH: iOS runtime 1.0.1 AND Android runtime 1.0.0 (see memory note
  on split OTA runtimes — a single `eas update` reaches iOS only).

### DONE — W1 code fixes (`src/lib/visionGrader.ts` + all 8 routes)
- Determinism: `seed: 7`, `temperature 0.1` (was 0.35), `top_p 0.5` (was 1.0), `detail:'high'`
  (was 'auto'), `prompt_cache_key: dcm-grader-{cardType}`; cached_tokens now logged on success;
  HTTP 400 removed from retryables; version stamps → v8.8.
- Grade math: `averaged_rounded.final` now carries the weakest-link-CAPPED grade; all 8 routes'
  fresh+cache paths flipped to prefer `final_grade.decimal_grade` (fixes the Other-route
  page-refresh grade change and covers old cached data); `Math.floor` → `Math.round`.
- Text reconciliation: new exported `reconcileSummaryWithGrade()` rewrites/anchors the grade in
  the AI summary (regression-tested against run #7's exact production text); `condition_label`
  now DERIVED server-side via `getConditionFromGrade`; `dominant_defect`,
  `weighted_scores.preliminary_grade/weakest_subgrade/limiting_factor` reconciled in write-back.
- Honest uncertainty: `±` value = max(confidence-letter, pass spread, clamp-fired), capped ±3 —
  written to `grade_range` + `image_quality.grade_uncertainty` + extracted_grade.
- Type fix: `GradingMetadataV3_3.meta.version/prompt_version` widened to string.
- tsc verified: error count identical to HEAD (4,433 — all pre-existing; build ignores).

### DONE — W2 prompt fixes (master → v8.8 complete; all 8 deltas aligned)
- Master: STEP 3 centering formula CORRECTED (border÷total, sanity check added); line-203
  scratch cap deleted; Section 6 UNIVERSAL SEVERITY SCALE rewritten to visibility test; all 5
  per-defect deduction blocks → ladder pointers; 1.11 wear/count caps removed (structural only);
  crease caps unified (4/3/2) + SHADOW-vs-CREASE false-positive check; HOLDER-SCRATCH and
  SLEEVE-SEAM false-positive checks added; edge JSON aggregation = worst−spread; 4-element
  evidence MEASUREMENT → qualitative EXTENT (all sites); Grade-10 proof → documentation-only;
  centering-10 prereqs aligned to 55/45 + blur rule; raw_sub_scores derivation rule + server
  clamp disclosed; 1.8 ambiguity bias removed (unconfirmed hints → no deduction, wider
  uncertainty); H-step decimal deductions (texture/print-line/fingerprint/clouding) → ladder
  pointers; "sum properly" → MIN; footer RULE 8 fixed; SECTION 8 split into PART A/PART B;
  stale cross-refs fixed; last conflicting visual-calibration table aligned.
- Identification (Phase C): canonical card_name/player/set definitions in master Section 4
  (overrides deltas); universal YEAR DETECTION HIERARCHY promoted to master;
  `identification_confidence` field added to card_info spec; sports delta card_name examples
  fixed (player-only); Other delta "or card design" year leak fixed.
- All 8 deltas: retired decimal/per-defect deduction blocks → master ladder pointers; ALL
  inverted-math centering examples corrected (sports/pokemon/mtg/lorcana/other); illegal
  8.5/9.5/9.0 example scores fixed; era-leniency removed (pokemon WOTC, mtg vintage, yugioh
  1st Ed, starwars vintage); new carve-outs: Pokemon textured-UR + WOTC swirl, MTG Secret Lair
  matte + white-border≠whitening, Lorcana Enchanted glare, One Piece manga-art + dark-Leader
  glare, **Yu-Gi-Oh embossing REVERSED to design-feature** + dark-back note, Star Wars grey/tan
  back stock, Other GPK/MetaZoo distressed designs; glare-check-first added to every
  holo/chrome section. Version markers: sports v5.1, pokemon v5.1, mtg v5.2, lorcana v5.1,
  onepiece v5.1, yugioh v5.1, starwars v5.1, other v5.6 — all "(aligned with master rubric v8.8)".
- Verified: loader passes all 8 card types; retired-pattern sweep clean; summary-reconciler
  regression suite passes.

### DONE — Condition-report ingestion fixes (July 2, follow-up audit of user-submitted defects/comments)
`src/lib/conditionReportProcessor.ts`:
1. **Mobile comment-box drop fixed:** mobile "no defects + comment" (`{noDefectsConfirmed, cardDescription}`)
   previously returned `undefined` from `ensureProcessedConditionReport` — the user's insights never
   reached the AI (web delivered them; mobile silently discarded). Now builds a minimal processed
   report so the context-only description branch fires — platform parity.
2. **Stale ambiguity bias removed from the injected hint rules:** rule 5 said "AMBIGUOUS → apply
   MINIMUM deduction" — contradicted the v8.8 master fix and, being at the end of the user message,
   likely overrode it. Now: AMBIGUOUS → no deduction, document, widen uncertainty.
3. **Injection screen extended to the description box:** `detectSuspiciousPatterns` only screened
   `notes`; injection text typed into `cardDescription` reached the prompt unfiltered (pre-existing
   web hole, inherited by fix #1's path). Now notes+description are screened together, positive-claim
   filtering applies to descriptions, and the description-only branch honors the suspicious flag.
Behavioral tests pass for: mobile comment delivery, empty-comment no-op, defects+notes parsing (5
defects extracted), and injection filtering.

### DONE — v8.9 ensemble (July 2, evening): real consensus in ONE API call
- `n: 3` on the single chat completion (parallel server-side decode ≈ single-completion latency;
  measured ~40s/card). Each completion = one full evaluation (no more fake pass_1/2/3 in output;
  rubric Section 1.5 rewritten to SINGLE-EVALUATION PROTOCOL; 25+ three-pass references updated).
- Server: parses all completions → median-pick base (identity/narratives) → per-category MEDIAN
  consensus (replaces mean+consensusBoost) → synthesized `grading_passes` keeps every display
  surface unchanged. temp 0.3 / top_p 0.9 (median absorbs diversity). Prompt cache verified 100% hit.
- **STRUCTURAL-DAMAGE MINORITY REPORT:** any completion detecting structural damage overrides the
  median-pick (asymmetric failure costs), + **server-enforced structural cap** (≤4 — was prompt-only),
  + uncertainty floor ±2 on structural disagreement.
- **Detection hardening after a creased card graded 9:** CARD FLATNESS CHECK (outline/corner-lift/
  lighting-plane/front-back agreement — mandatory before structural_damage=false), "false-positive
  checks are not an excuse to dismiss visible damage" counterweight, ZERO-DEFECT RE-INSPECTION rule,
  defect-hunt + flatness added to Section 1.5 self-check and the user-message reminder.
- Live validation: creased Pineiro card 9 → **4 (±3)** with correct crease narrative; clean full-res
  Shaq → 10 (calibration watch-point: possibly lenient; owner estimated 8-9).
- ⚠️ WATCH during testing: Grade-10 frequency (under-detection of micro-defects), false structural
  positives from the minority-report policy.

### DONE — v8.9 Stage B: regioned "zoom" inspection (July 2, late) — the detection architecture fix
- **Why:** holistic full-card vision passes are stochastic detectors (a pronounced crease was missed
  by 1-2 of 3 completions; visible back-border whitening scored 10) and OpenAI downscales images
  (~768px short side) before the model sees them. No prompt wording fixes that.
- **What:** `src/lib/zoomInspection.ts` — server crops each face into 12 regions (4 corners, 4 edge
  strips, 4 surface quadrants) at native res via sharp (moved to prod dependencies), inspects ALL 24
  crops in ONE extra API call run IN PARALLEL with the ensemble (≈zero added wall-clock, ~$0.02-0.15/card).
  Findings map to ladder caps deterministically and only LOWER scores; structural types merge into
  `structural_damage.findings[]` (new enumerated schema — every crease/bend listed separately) and
  trigger the server structural cap. Zoom failure never fails the grade.
- **Min-resolution gate (web + mobile):** long edge <1000px → blocked before spending a credit;
  1000-1600px → warning. (600px Gengar screenshots and 343px thumbnails graded blind in testing.)
- **Validated on the three problem cards:** creased Pineiro → 4 (±3) with BOTH creases enumerated
  (including the top-corner crease the summary previously missed); 600px Gengar 10→8 (zoom caught the
  back-border whitening all three holistic passes missed); full-res Shaq 10→8 (matches owner's own
  8-9 estimate; zoom found the corner specks).
- ⚠️ Known cosmetic: base-completion prose can read cleaner than the zoom findings (e.g. "presents
  as Gem Mint… final grade is 8" + zoom clause). Grade tokens are reconciled; tone is not.

### DONE — v9.0 PSA-ANCHORED CALIBRATION (July 2, night)
- Severity→score bands shifted one rung to match PSA's published per-grade language: ONE minor
  close-inspection flaw → 9 (PSA one-flaw rule); 2+ minors → 8; noticeable-at-normal-distance → 7;
  multiple noticeable → 6. Ladders rewritten COUNT-AWARE (rows describe the whole category; spread
  tables retired). All 8 deltas + Section 6 quick-refs + condition tiers swept (31 delta edits).
- Centering: lower bands relaxed to PSA (6 = up to 80/20, 5 = 85/15, 4 = 90/10); back-centering
  penalty now starts past 90/10 (PSA back tolerance), grade-10 still requires back 75/25.
- Severe-crease tier added: pronounced/full-length crease → 3.
- zoomInspection: SEVERITY_CAP {minor:9, moderate:7, heavy:5}, spread threshold 2+ regions → −1;
  DARK-BORDER RULE (white flecks on dark borders = moderate when multiple — PSA-grounded).
- NEW: GOLDEN CALIBRATION HARNESS — scripts/calibration-set.json + scripts/run-calibration.ts.
  Run before shipping ANY grading change. Seeded with the 3 problem cards.
- CALIBRATION RESULT 3/3: creased → 4 (target 3±1), Gengar → 6 (owner's PSA estimate exactly),
  Shaq → 6 (target 7±1, harsher edge — watch if v9.0 runs harsh on minor-wear dark borders).
- Rubric title now v9.0; engine stamps DCM_Grading_v9.0. Backups: prompts/backups/*PRE-v9.0*.

### DONE — FULL WIRING AUDIT (July 2, final): engine ↔ prompts ↔ web ↔ mobile coherence verified
4 verification agents + loader/calibration gates. VERIFIED CORRECT: engine cap ordering (face-min →
zoom → structural-surface → weakest-link → backstop, all monotonic), retry↔zoom idempotence, grade
precedence engine↔routes, summary pipeline order, post-cap derivations, minority report, zoom crop
bounds at 600px, web three-pass table/consensus notes/labels/PDF reads, mobile capture gates + parse
tolerance + canonical label path + upload contract.
FOUND & FIXED (23 items): prompts — three-pass instruction leftover in 1.10.5 (HIGH), averaged_final
formula vestiges ×2, STEP 10/11 averaging vestiges, Example-3 averaging language, dangling
consensus_notes output ref, company names in backend note, Tier-B pronounced-crease row, 8 delta
alignment labels → v9.0, 3 stale '8/7' band pointers; code — zoom defects now pushed as OBJECTS
(fixes web empty-"Defect"-box rendering + defect_coordinates pollution), consistency
'medium'→'moderate' (fixes gray ?-pill in ThreePassSummary), countDefectsByCategory now reads the
conversational shape (was always 0), zoom-only structural detection now widens uncertainty to ±2,
weighted_scores sync un-nested from raw_sub_scores guard, stale consensus-boost log text.
KNOWN REMAINING (deliberate, low): structural findings[] not rendered as a dedicated UI section on
web/mobile (the rebuilt summary enumerates them in text); mobile GradeBadge uses a local grade→label
map for its caption; mobile ignores final_grade.grade_range in favor of the uncertainty column; dead
code (unreachable markdown branch, serverAvg, duplicate median helpers, routes' scoring.* fallbacks);
DCM Optic section renderers don't list section defects arrays.
FINAL GATES: golden calibration 3/3 (creased 4 ±2 / Gengar 6 / Shaq 6), loader checks 8/8, tsc clean
(1 pre-existing unrelated error).

### PREPARED — awaiting explicit go-ahead
- `scripts/backfill-condition-labels.js` — dry run found **8,543 of 21,987 graded cards (39%)**
  with labels that don't match their grade ("Near Perfect"→"Gem Mint", "Near Mint-Mint"@9→"Mint"
  etc.). Run with `--apply` to normalize (customer-visible mass update — needs owner approval;
  add CSV export of old values first if a revert path is wanted).

### NOT YET DONE
- Real 2-3-call ensemble with median (W1 #4 option B — decision needed: ~2-3× inference cost)
- W3 remainder: web camera 2MP cap, unify codec/quality, real blocking quality gates, wire/delete
  dead detection stack, EXIF handling, mobile condition-report shape check
- W4 cross-card consistency; W5 identification code (identity_validated flag, verify→label
  regen, price-confidence gating, eBay title/category/revise); W6 33k-token rubric evaluation
- Deploy: web (Vercel push) + mobile dual OTA — user actions

---
**Scope:** 11 deep audits covering the entire grading path: capture (web camera / web gallery / mobile camera / mobile gallery) → image processing → OpenAI vision call → prompts (master + 8 deltas) → grade math → storage → labels / condition text / confidence → card detail / PDF / pop report / eBay listings / pricing. Plus card identification end-to-end.

**Trigger:** A customer graded the same 1993 Upper Deck Shaquille O'Neal Trade Card 7 times and received grades 7, 9, 8, 7, 6, 6, 6 (their own assessment: ~8, maybe 9, floor 7). Card IDs and per-run analysis in §1. Separately: identical Pokemon cards receive different labels; cards are mis-identified / mis-dated / set-name-as-card-name; wrong identity reaches labels and eBay listings.

---

## 0. Already applied — "v8.8 prompt consistency pass" (July 1, 2026)

Edits to `prompts/master_grading_rubric_v5.txt` (now titled v8.8) and `prompts/sports_delta_v5.txt` (v5.1).
**Backups:** `prompts/backups/master_grading_rubric_v5_PRE-v8.8_2026-07-01.txt` and `prompts/backups/sports_delta_v5_PRE-v8.8_2026-07-01.txt`. Both files were clean at git HEAD `2367d0e` pre-edit, so `git checkout` is a second revert path. Diff: −503/+308 lines. Verified 15/15 integrity checks through the real `promptLoader_v5` loader.

What v8.8 did:
- ONE scoring ladder per category (corners / edges / surface) keyed to a **visibility test**: defect detectable only on close inspection/zoom = Minor → 9; plainly noticeable at normal viewing distance = Moderate → 8/7.
- Retired 4 rogue cap systems: defect-count caps, arm's-length "First Glance" ceiling, cumulative decimal penalties, keyword/language caps (PART E rewritten). Weakest-link + structural damage are the only caps.
- ONE centering ratio→score table (PSA 2025); other tables demoted to ratio-estimation only; boundary rule = ±2% photo tolerance → higher score.
- Print-dot conflict resolved (manufacturing variance <0.3mm noted in analysis text, NOT defects array → 10 still eligible; classify once, same in all 3 passes).
- New: glossy-surface glare false-positive check (Section 10 Step 5), resolution/crop normalization (Section 5), classification-consistency-across-passes rule, Section 1.9 rewritten around the visibility test (decimal deductions and "always choose harsher" removed).
- Sports delta: severity lists point at master ladders; corner/edge examples de-mm'd and labeled with ladder rows; "uniform tan panel tone ≠ toning" carve-out (catches the Shaq back-panel misread); vintage centering pinned to master table.

**Known incomplete (found by the re-audit, §4):** sports centering example, print-line + holofoil deduction blocks, and surface/relic examples were missed; master still contains the issues in §3.

---

## 1. The seven-run case study (evidence base)

Same physical card, 7 grading runs. Stored data dumped from the `cards` table:

| # | Card ID | Grade | Limiting factor | Key observation |
|---|---------|-------|-----------------|-----------------|
| 1 | 844a5873-9e6c-4d22-a896-a97406fa1f4c | 7 | surface | Back "scribble" **design misread as damage** (pre-v8.7, Jun 29) |
| 2 | 9d0596fe-e4e9-47be-be3b-377336f266f4 | 9 | centering | Post-v8.7 carve-out; cleanest read |
| 3 | c6c312e6-555b-4f50-9409-710416a218f2 | 8 | corners | Reasonable |
| 4 | f1722612-76cc-4866-8d5e-93a7da0fec77 | 7 | corners | 50MP photo surfaced more whitening |
| 5 | b470b83f-fb45-49a0-b32a-a9b289d815eb | 6 | surface | **Crop distorted centering** (37/63 vs ~46/54 in all other runs); glossy-black reflections read as "scuffs and light scratches" |
| 6 | 58710b36-1c9d-4576-96e9-4a3db6108276 | 6 | surface | Design misread returned in new words: "print wear or toning in the central beige text panel" |
| 7 | eca620ab-bde0-4a89-89d4-e6a7898a0938 | 6 | surface | **Internally contradictory output**: summary says "surfaces are clean… the final grade is 8", `weakest_subgrade: 8`, label "Near Mint-Mint" — stored grade 6 |

Cross-cutting observations:
- **All three passes returned IDENTICAL subgrades in all 7 runs.** The three-pass consensus provides zero variance reduction; all variance is between runs.
- **Every run claimed image confidence "A" and grade range "±0"** while spanning 3 full grades — confidence theater.
- Run #6 vs #7: same photo, same grade 6, different claimed reasons and different condition labels (#6 "Excellent", #7 "Near Mint-Mint").

---

## 2. Root causes of run-to-run grade variance

### 2.1 Model call (code) — `src/lib/visionGrader.ts`
- **No seed, temperature 0.35, top_p 1.0** (lines ~1555–1598; comment: "seed removed in v8.5 — no fixed seed allows genuine variance between three passes"). Each regrade is an independent draw.
- **The "three passes" are ONE API call** (single `chat.completions.create` at ~1660) — the model writes pass_1/2/3 in one completion and copies its own scores. `consensusBoost` (~1743) only handles the exact (10,10,9) tuple and **has structurally never fired**. `validateThreePassData` detects identical passes but only warns. The consensus machinery costs tokens and adds nothing.
- **Images sent with `detail: 'auto'`** (~1611, 1618) — OpenAI silently picks the resolution tier per call. The legacy Stage-2 path pins `'high'` (~1296, 1303); the live path doesn't.
- **Uncertainty is AI-authored**: `threePassData.variance` is computed (~1897) but never used; stored uncertainty comes from `image_quality.grade_uncertainty || final_grade.grade_range || '±1'` (~1886). Routes use a different default ('±0.5').
- Retry loop treats HTTP 400 as retryable (~2054) — wasted retries on permanent failures.

### 2.2 Grade math / storage (code)
- **Routes discard the engine's capped grade.** Engine computes `finalGrade = MIN(serverRounded.final, subgradeCap)` (~1814–1815) and returns it as `extracted_grade`, but the write-back stores the **uncapped** average into `averaged_rounded.final` (~1829), and routes read `averaged_rounded.final` first: sports `route.ts:584`, pokemon `route.ts:811`. Weakest-link cap is latent-dead for the stored grade whenever the model's own final exceeds its weakest subgrade.
- **"Other" route fresh-vs-cache split:** fresh grade reads the capped field (`other/[id]/route.ts:480`) but the cache path reads uncapped `averaged_rounded.final` (`:242`) — **a card's grade can change on page refresh with no regrade**.
- **Write-back reconciles numbers but not prose** (~1828–1881): updates `final_grade.decimal/whole_grade`, `weighted_scores.*_weighted`, `raw_sub_scores` — but leaves stale: `final_grade.summary`, `final_grade.condition_label`, `grade_range`, `condition_tier`, `dominant_defect`, `weighted_scores.preliminary_grade`, `limiting_factor`, and raw `pass_1/2/3`. This produced run #7's "grade 6, narrative says 8".
- `whole_grade` computed via `Math.floor` of an already-rounded value in routes (sports:594 etc.) — inconsistent rounding policy vs the engine.
- Per-route JSON re-parsing is duplicated across all 8 category routes with drift (grade field precedence, uncertainty defaults, autograph detection).

### 2.3 Prompts (remaining after v8.8 — master)
Ranked by impact:
1. **INVERTED CENTERING FORMULA — STEP 3** (master ~3456–3472): "(narrower ÷ wider) × 100 … Example: 23mm ÷ 30mm = 76.67 → 77/23 ratio". Correct convention (used by VERIFICATION CHECK 1, the deviation calc, and the score table) is border ÷ total → 43/57. Followed literally, STEP 3 turns a score-9 card into a score-5. Propagated into pokemon/mtg/other/sports delta worked examples.
2. Line ~203: "ANY scratch visible to naked eye = final grade cap 6" — contradicts the scratch table below it (light=8, noticeable=7) and the surface ladder.
3. Section 6 still runs the retired mm→severity→deduction→cap system for 5 defect types (corner fiber ~2521, corner rounding ~2541, edge whitening ~2593, edge chipping ~2613, white dots ~2698); only the scratch block was converted.
4. Section 1.11 keyword-cap tables (~1414–1449) + "CUMULATIVE HEAVY DAMAGE" count caps (~1451–1456); Section 1.13 tier tables' "Max Grade" column — all cap systems v8.8 declared retired but didn't remove.
5. Crease caps disagree three ways: 4 (header ~115), 4 (1.11 ~1427), "6.0–7.0" decimals (Section 6 ~2799–2801).
6. **Edge aggregation inconsistent:** JSON comment says score = *average* of 4 edges (~4547); ladder says worst − spread (~4373); corners say MIN (~4302).
7. **mm precision simultaneously mandatory and forbidden:** 4-element evidence format mandates "approximately X.Xmm" (7.5 ~3039, 3052; corner loop ~4240; edge ~4442; surface ~4711; PART B ~5567) while 1.9/Rule 9/ladders prohibit invented mm.
8. **Grade-10 mechanics bias clean cards to 9:** proof-or-downgrade in 3 places (7.5 ~3156, PART F ~5613, FINAL Q2); centering-10 prereqs demand border *imperceptibility* + 4 measured mm borders, contradicting 55/45=10 and the blur rule.
9. **raw_sub_scores derivation undefined** — passes never store front/back faces; model is never told the server clamps subgrades to MIN(front,back). Root of the face/pass drift feeding run #7.
10. Section 1.8 ambiguity bias: unconfirmed user-reported defects get "minimum deduction" with -0.25/-0.3 decimals (~857–944).
11. Schema leftovers: `condition_tier` required but sourced from a "removed" system (~5422); one checklist says front/back weighted should "sum" (should be MIN, ~5342); FOOTER copy of Rule 8 still says "deduction tables" (~5676); three uncertainty fields with no governing rule.
12. Missing anti-hallucination guards: **shadow vs crease** (false crease = 6-grade error), **holder/slab scratch vs card scratch** (rubric says "deduct through the holder"), sleeve seam vs edge whitening.
13. One remaining conflicting visual-appearance→ratio calibration pair (~3350 vs ~3503).
14. Structure: SECTION 8 duplicated (Centering + Corners), Sections 1.15/13 missing, 1.12 after 1.16, stale cross-refs ("Section 7: CENTERING SCORE GUIDE" ~3743), headers still "v8.5", weakest-link/rounding/no-10 restated 9–15×.
15. Undefined MIN behavior when one card face is N/A (~2011–2020).

### 2.4 Prompts — deltas (7 unaligned + sports gaps)
- **Sports (v5.1, ~80% aligned):** centering example uses inverted math + "caps table" language (score 5 vs correct 9, L~623); print-line (-1/-2, L~501) and holofoil (-1/-2 + product-tier ceiling, L~540–543) deduction blocks missed; surface/relic examples still mm'd.
- **Pokemon (v5.0):** inverted centering example scores a near-perfect card 4 (L~755); five `-N` deduction blocks (607, 630, 654, 678, 722); **missing textured-Ultra-Rare carve-out** (etch pattern scored as scratches — high false-positive source); no WOTC holo-swirl guard; no glare gate. Good pattern to copy: whitening L~698 "see master rubric Section 9".
- **MTG (v5.0/v5.1 mixed markers):** inverted centering + picks the wrong worst axis (L~465); **decimal** deductions -0.3…-1.5 (404–405, 423–424); "same deductions as sports cards" stale refs (379, 391); era-ceiling "10.0 extremely rare for Alpha/Beta" with decimal grades (455–458); no Secret Lair matte / white-border-as-whitening carve-outs. Keep: foil-curl-vs-crease handling (357–361), `is_foil` default-false rule.
- **Lorcana (v5.0):** centering example math nonsensical — 46/54 miscalculated as "86/14 → capping at 4.0" (L~300); decimal per-scratch deductions (242–244); no Enchanted-foil glare guard. Keep: back swirl-design guard (264–293).
- **One Piece (v5.0):** heaviest decimal-deduction load (5 blocks: 320–324, 341–343, 361–363, 386–389, 403–405); **illegal 9.5 scores** in examples (418, 426); no manga-art rough-aesthetic carve-out; no dark-Leader glare guard.
- **Yu-Gi-Oh (v5.0):** **actively wrong — instructs deducting for Ultimate Rare embossing** (268, 274), a design feature; example scores Secret Rare's intrinsic rainbow pattern as "clouding" (372); illegal 8.5 scores (372, 383); additive corner stacking; "age-appropriate wear" leniency (375); no dark-brown-back glare guard.
- **Star Wars (v5.0):** fully pre-v8.8; **centering scored as a floating deduction "-1.0 to -3.0"** (231), bypassing the table; decimal deductions (206–209, 230–233); **9.5 final grade** in example (283); era-leniency; no Topps grey/tan back-stock carve-out (uniform stock tone will read as toning — the exact Shaq failure mode).
- **Other (v5.5):** inverted centering example (6 vs correct 9, L~228); decimal deductions (191–192, 220); **no distressed-design carve-out** despite covering GPK/MetaZoo (printed grime/scribbles = highest false-positive genre). Keep: null-biased extraction posture (237–259).

### 2.5 Capture pipelines
**Web (`src/app/upload/page.tsx` + `src/lib/imageCompression.ts` + `src/hooks/*` + `src/components/camera/*`):**
- Camera captures at **≤~1920×1080 (2MP)** — canvas grabs the video stream, not the sensor (`useCamera.ts:143–170`); gallery uploads reach 3000px. Same card ≈ half the resolution by path.
- Camera path: **triple encode** (JPEG 0.92 → guide-crop re-encode 0.95 → compress 0.80–0.90); gallery: single encode. Camera also gets a blind geometric `cropToGuideFrame` (center crop, doesn't find the card); gallery gets none.
- Web writes **WebP bytes under `.jpg` paths** when the browser supports WebP (`imageCompression.ts:96` + `upload/page.tsx:566`).
- **All quality gates advisory or dead:** `validateImageQuality` (Laplacian blur + brightness) runs only on the camera path and "⚠️ Use Anyway" always proceeds (`ImagePreview.tsx:131–153`); the gallery path has NO check; no minimum resolution anywhere. The full smart-capture stack (`useCardDetection` incl. glare/shadow, `useStabilization`, `useCaptureReadiness`, `useGuideOrientation`) is **dead code** — wired to nothing.
- OpenCV/boundary detection all dead in the live flow (`visionGrader.ts:263` "OpenCV boundary detection unreliable"); `perspective-transform` package unused; no EXIF orientation handling beyond implicit browser behavior.

**Mobile (`dcm-mobile/app/grade/capture.tsx` + `lib/imageUtils.ts` + `review.tsx`):**
- **Blind auto-crop on EVERY image** (`processCardCapture`, `imageUtils.ts:135–222`): 85% center-band crop + force-crop to 2.5:3.5 aspect centered on the FRAME, not the card → systematically perturbs border widths (centering) and can clip corners. Web does no such crop. **Leading cause of mobile-vs-web grade differences.**
- **Gallery orientation bug:** the orientation toggle exists only in camera mode; landscape gallery photos get a portrait crop (`capture.tsx:518–564`).
- Double JPEG encode (0.92 capture → 0.85 re-encode); JPEG always (web may be WebP) — codec asymmetry.
- **"Sharpness"/"Brightness" UI is fake** — derived from resolution, not pixels (`imageUtils.ts:229–301`, `capture.tsx:346–350`). No real blur/brightness/glare gate; any 'D' image proceeds.
- Duplicate detection hashes the **filename**, not content (`imageUtils.ts:307`); web uses SHA-256 content hash.
- Mobile "no defects" condition-report payload shape differs from web's (`review.tsx:132–135` vs `upload/page.tsx:618–624`) — verify the server normalizer treats them identically.

### 2.6 Cross-card consistency
- **No mechanism links identical cards**: no image-hash reuse, no serial/name+set+number alignment across uploads. `image_hash` unreferenced in visionGrader.
- `postGradeEmailTemplates.ts:165` promises "two photos of the same card produce the same grade" — nothing enforces it.

---

## 3. Label / condition / confidence misalignment (bugs a, b, c)

**Four competing grade→condition mappings:**
| Source | Grade 6 | Grade 8 | Location |
|--------|---------|---------|----------|
| `getConditionFromGrade` (deterministic) | "Excellent-Mint" | "Near Mint-Mint" | `conditionAssessment.ts:444–458` |
| `getConditionFromTier` | tier C → "Excellent" | tier E → "Near Mint-Mint" | `conditionAssessment.ts:461–472` |
| `mapToEbayCondition` | 4–6.9 → "Very Good" | 7–8.9 → "Excellent" | `ebayConditionMapper.ts:51–143` |
| AI free text (STORED verbatim) | anything | anything | schema `cardGradingSchema_v5.ts:304` |

- **Stored `conversational_condition_label` = AI prose, never derived from the grade** (written verbatim in every category route). Card-detail header renders it raw (`CardDetailClient.tsx:2990`); the **printed label** ignores it and derives from grade (`labelDataGenerator.ts:516–523`); PDF prefers the AI text (`DownloadReportButton.tsx:391`); eBay uses mapping #3. One card can show 3 different condition words.
- **Bug (a)** two grade-6 cards "Excellent" vs "Near Mint-Mint": card B's model wrote an 8-flavored label before the server clamped the number to 6; label never recomputed.
- **Bug (b)** "summary says 8, grade 6": write-back never regenerates `final_grade.summary`; the regex patcher `fixSummaryGradeMismatch` (`cardGradingSchema_v5.ts:843–882`) misses "earns **an** 8", "graded 8", "a solid 8", decimals, etc. Summary shown on web detail, all PDFs, batch reports, mini report.
- **Bug (c)** identical cards → different labels: independent AI runs + verbatim label/summary + no cross-upload alignment.
- **Confidence:** 5 uncertainty carriers (`conversational_image_confidence` letter, derived uncertainty, `recommended_grade.grade_uncertainty`, `image_quality.grade_uncertainty`/`final_grade.grade_range`, `case_detection.adjusted_uncertainty`) shown in different places, can contradict on one screen; measured pass variance never feeds any of them; "A ±0" shown even when passes disagreed.
- `force_regrade` cache branch prefers the OLD stored label (`vision-grade:288`); admin `regenerate-label` updates `label_data` but not the `conversational_condition_label` column → further divergence.

---

## 4. Card identification (mis-ID / wrong year / set-as-name)

### Prompt side
- **Sports delta card_name examples TEACH the blend**: "Tom Brady Gold Standard", "LeBron James Dominators" (lines 25–26) — trailing tokens are Panini set/insert names. The correct guard ("NEVER use the set name, subset, or product line here") exists ONLY in the Other delta (line 32). Master gives card_name NO definition (typed `"string|null"` only, ~2139).
- **Year hierarchy only in sports** (copyright > print date > set logo > season ±1 lag > null, lines 47–55). Other delta contradicts itself: line 51 "from copyright text **or card design**" vs line 54 forbidding design-era guessing.
- No `card_name_confidence`/`player_confidence`/`year_confidence` anywhere; `set_confidence` exists in only 5 deltas; sports/starwars/other have no confidence fields at all.

### Code side
- **Sports and Other: ZERO reference-DB validation** — AI identity written verbatim (`sports/[id]/route.ts:891–901`, `other/[id]/route.ts:734–766`).
- **All validated categories keep the AI guess silently on DB miss** (pokemon:1117/1200, mtg:940–943 "SKIPPING all DB overrides", lorcana:971–975). Weak first-5-char name-compatibility guard both admits wrong matches and rejects correct ones.
- `validated_source` set ONLY on the Japanese-Pokemon path — no general "identity was verified" flag.
- **Pokemon verify runs fire-and-forget AFTER label_data is generated** and updates columns but never regenerates `label_data` or syncs `card_name`/`year` into the JSONB → label, columns, and JSONB can all disagree (`pokemon/verify/route.ts:137–152`, `pokemon/[id]/route.ts:1544–1569`). Fuzzy verify at medium confidence can overwrite correct AI extraction (±3 card-number neighbor).
- `original_card_info` (untracked migration): write-once snapshot on first user edit; no revert path. User edits via `PATCH /api/cards/[id]/details` DO regenerate label_data (good).
- Pop report groups on raw AI columns `card_name || card_set || card_number` with no normalization (`pop/[category]/sets/route.ts:67`) — mis-IDs pollute/fragment population counts.
- `/api/pokemon/identify` (gpt-4o OCR) is dead code — nothing calls it.

### eBay / pricing propagation
- **Identity frozen at publish — NO ReviseItem anywhere** (`grep ReviseItem src/lib/ebay` = zero). Title, description, item specifics, category, and identity text BAKED INTO the slab/mini-report images + CoA PDF are all snapshots; fixing the card later changes nothing on eBay.
- **eBay category derived server-side solely from `card.category`** (`listing/route.ts:338` → `constants.ts:45–58`); modal's category is never sent — no override possible; unmapped categories silently land in Non-Sport.
- Default title blindly `.substring(0,80)` (grade/condition appended LAST → verbose wrong names push "DCM Grade X" off the end) (`EbayListingModal.tsx:330`).
- **Mobile builds titles independently and differently** (`dcm-mobile/lib/ebayApi.ts:263–277`): leads with `card_name` (the most corruption-prone field) vs web's category-aware `primaryName`; omits grade when only decimal grade exists.
- Silent defaults mask mis-ID: `detectSport` → 'Baseball' (`itemSpecifics.ts:833`); Other `Franchise` → 'Entertainment' (:335).
- **Pricing:** PriceCharting query's first/heaviest token is the player name (`priceCharting.ts:256–338`) — set-as-name corrupts price matching; `dcm_price_match_confidence` recorded but **never gated on**; refresh-by-product-ID hardcodes confidence 'high' (`dcmPriceTracker.ts:449`) — an initial mismatch gets laundered forever.

---

## 5. Cost / latency

- ~78–82k input tokens sent per grading call (~285KB master + ~44KB delta); a 33k-token `master_grading_rubric_v5_optimized.txt` exists unused.
- No `prompt_cache_key` set; `response.usage.prompt_tokens_details.cached_tokens` never logged on success → blind to real cache hit rate (`scripts/audit-prompt-cache.ts` only infers from cost).
- Retrying HTTP 400 up to 3× (visionGrader ~2054).

---

## 6. FIX PLAN — Workstreams

### W1 — Determinism & grade-math correctness (code; highest impact-per-line)
1. Fixed `seed`, temperature ~0.1, `detail:'high'` (visionGrader.ts:1593–1620).
2. Cap `averaged_rounded.final` in the write-back (one line after :1830: `threePassData.averaged_rounded.final = finalGrade;`) → every route consumer gets the weakest-link grade; fixes Other's refresh bug.
3. Consolidate per-route JSON parsing into ONE shared normalizer; routes consume `extracted_grade` only. Kill `Math.floor` inconsistency + uncertainty-default drift + duplicated autograph logic.
4. Make the three passes REAL (2–3 independent API calls, median server-side) or delete the pass machinery. Recommended: real ensemble at low temp — strongest available variance damper.
5. Derive `condition_label` server-side from the final grade via ONE canonical function used by column, card detail, label, PDF, eBay; reconcile the 4 mapping tables.
6. Template the "final grade is N (Label)" summary sentence from server values (replace regex patcher); update `grade_range`, `preliminary_grade`, `limiting_factor`, `condition_tier` in the write-back.
7. Uncertainty from measured pass variance; never display ±0 when passes disagreed; delete per-route defaults.
8. Small: stop retrying 400; bump v8.7→v8.8 stamps (visionGrader ~1977).

### W2 — Prompt fixes (master Phase A + deltas Phase B + identification Phase C)
- **A (master):** fix inverted STEP 3 formula; delete line-203 scratch cap; convert Section 6's 5 mm-deduction blocks to ladder pointers; strip 1.11 keyword/count caps + 1.13 Max Grade column (keep structural caps); unify crease cap; edge aggregation = worst − spread; measurement qualitative everywhere; Grade-10 proof → documentation-only + centering-10 aligned to 55/45; define raw_sub_scores derivation + disclose server clamp; fix 1.8 ambiguity bias; schema leftovers (condition_tier, "sum"→MIN, footer Rule 8, one uncertainty rule); shadow-vs-crease + holder-scratch guards; structural renumbering + stale cross-refs; remaining visual-calibration table pair.
- **B (deltas):** shared SCORING RULES template (ladder pointers, visibility test, no deductions, CORRECT centering example, classification consistency, glare gate) applied to all 8; per-game carve-outs — Pokemon textured URs + WOTC swirl; MTG Secret Lair matte + white-border; Lorcana Enchanted foil; One Piece manga-art + dark Leaders; **Yu-Gi-Oh embossing REVERSAL** + dark backs; Star Wars grey/tan back stock; Other distressed designs (GPK/MetaZoo). Fix all illegal decimal example scores (8.5/9.5/9.0) and inverted-math examples. Finish the 4 missed sports blocks.
- **C (identification):** canonical field definitions in master Section 4 (card_name = subject as printed, NEVER set/product line); fix sports card_name examples; promote year hierarchy to master; delete "or card design" from Other; add identification_confidence to schema.

### W3 — Capture normalization (web + mobile)
1. **Remove/replace mobile blind auto-crop** (`imageUtils.ts:135–222`) — parity with web or real card-edge detection. Biggest cross-platform item.
2. Fix mobile gallery orientation (infer from asset dims, `capture.tsx:121–131`).
3. Normalize resolution/codec/quality across all 4 paths (one long-edge target; fix web camera 2MP cap; single encode; fix WebP-as-.jpg).
4. Real pre-credit quality gates on ALL paths (min resolution, blur floor, brightness) — blocking; port web's Laplacian check to mobile + web gallery; replace mobile's fake indicators.
5. Wire or delete the dead detection stack (glare detection already exists in `useCardDetection.ts:105–106`).
6. EXIF orientation handling; normalize mobile "no defects" condition-report shape with web.

### W4 — Cross-card consistency
Content-hash dedup on mobile (currently filename hash); on grade completion look up same-user matching uploads (image hash or name+set+number) → reuse or flag divergent grades; align the marketing claim in `postGradeEmailTemplates.ts:165`.

### W5 — Identification & downstream (code)
1. Universal `identity_validated` flag; surface unvalidated identity in UI/admin.
2. Pokemon/MTG verify → regenerate `label_data` + sync JSONB.
3. Gate pricing on `dcm_price_match_confidence`; stop refresh-by-product-ID hardcoding 'high'.
4. eBay: smarter title budget (grade before truncation), unify mobile/web title generation (server-side), category override in modal, remove 'Baseball'/'Entertainment' silent defaults.
5. ReviseItem support (or "identity changed — end & relist" prompt).
6. Optional: `original_card_info` revert in admin; delete dead identify endpoint; quarantine dead code (vision-grade DVG route, detection hooks, opencv, `.backup` files in src/).

### W6 — Cost/latency
`prompt_cache_key` per cardType; log `cached_tokens` on success; evaluate the 33k-token optimized rubric (halving prompt cost roughly funds the W1 ensemble); drop 400 from retryables.

### Recommended order
1. **W1 + W2 together as "v8.9"** (prompts and grade-math must move together) → closes label mismatch, narrative bug, refresh bug, most run-to-run spread.
2. **W3** (mobile crop removal needs OTA to BOTH runtimes — iOS 1.0.1 AND Android 1.0.0, see memory note on split OTA runtimes).
3. **W4–W6** in any order.

### Validation plan
After W1+W2: regrade the customer's 7 Shaq images 3–4× each and compare spread (target: consistent 8, occasional 9); verify condition labels are identical for equal grades; verify summary text grade always matches stored grade; run a small calibration set (5–10 known cards) before/after.

---

*Full audit transcripts were produced by 11 subagent runs on July 1, 2026. Related memory notes: `project_grading_v88_prompt_pass.md`, `project_grading_full_system_audit.md` in the Claude project memory.*
