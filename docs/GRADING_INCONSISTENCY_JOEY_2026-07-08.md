# DCM Grading — Customer Inconsistency Review (Joey Miller) & Fix Plan

**Date:** July 8, 2026
**Trigger:** Customer email (Joey Miller / Joe Miller) reporting grade/report inconsistencies on 4 cards graded after the v9.1/v9.2 update.
**Status:** ANALYSIS COMPLETE · **Phase 1 (display coherence) IMPLEMENTED** (uncommitted) · Phases 2–4 awaiting go-ahead.
**Engine version at time of grading:** all cards stamped `DCM_Grading_v9.1` (the stamp constant `DCM_PROMPT_VERSION` was never bumped; the v9.2 evidence-reconciliation code IS present and ran).

---

## The customer's four reports

| # | Card | URL id | Grade | Complaint |
|---|------|--------|-------|-----------|
| 1 | Saddam "Leader" (Desert Storm Pro Set) — **Other** | `910dd3de…` | **8** | Overall 8 "based on corner grading of 8," but the report shows corners all **10s** |
| 2 | Michael Jordan '91 Fleer (JPEG upload) — **Sports** | `917d6b3e…` | **9** | Centering-driven 9; inconsistent with the app-camera grade of 10 |
| 3 | Michael Jordan '91 Fleer (in-app camera) — **Sports** | `b98dc05b…` | **10** | (the "correct" one — same card as #2) |
| 4 | Andre/Hogan WrestleMania III (JPEG upload) — **Sports** | `848ddbc1…` | **9** | Overall 9 "because of surface," but the report shows surface all **10s** |
| 5 | Andre/Hogan WrestleMania III (in-app camera) — **Other** | `cd250fa5…` | **9** | Same as #4 |

He is essentially **correct on every point.** The findings below are backed by the raw stored grading records (`scripts/dump-joey-cards.ts`), the actual card images pulled from storage (`scripts/fetch-joey-images.ts`), and the engine/route/display code.

---

## Root causes (three distinct bugs + two aggravators)

### A. Display trifurcation — the detailed panel renders PRE-CAP numbers (cards 1, 4, 5) — **FIXED in Phase 1**
Each subgrade is persisted in **three** representations plus a narrative:
1. `conversational_sub_scores.{cat}.weighted` and `.front/.back`
2. `conversational_weighted_sub_scores.{cat}` ← the tile headline prefers this column
3. the structured `.score` fields **inside `conversational_grading` JSON** — `corners.front.top_left.score`, `corners.front.score`, `corners.score`, `edges.front.top.score`, `surface.front.score`, `centering.front.score`
4. `conversational_final_grade_summary` + `conversational_limiting_factor` (baked from post-cap `serverRounded`)

The engine reconciles #1, #2, #4 to the post-cap consensus (and reconciles prose *number tokens* via `reconcileFaceProse`), but **#3 was never touched.** The "Detailed Grading Analysis" panel (`CardDetailClient.tsx` `renderCorners`/`renderEdges`/`renderSurface`/`renderCentering`, ~L5738–5880) reads #3 directly. So card 1's Corner Analysis showed **every corner 10/10, Overall 10** next to a tile/summary of **8** → "in the report the corners are all graded 10's." Same for surface on cards 4/5.

Root: `visionGrader.ts` Step 7.5 (~L2467) reconciled prose tokens only, not the structured `.score` fields.

### B. Zoom inspection over-detects, then blocks its own safety net (cards 1, 4, 5)
The magnified 24-crop pass (`zoomInspection.ts`) manufactured defects the holistic passes, the user, AND the images contradict:
- **Card 1:** "minor whitening" on **all four** front corners of a clean vintage card → `corners_front` cap 8. **Image review: corners are visibly sharp/clean.** The base model's own summary said *"sharp unworn corners… final grade 10."* User report: `noDefectsConfirmed: true`. Uncertainty ±2.
- **Cards 4/5:** "minor scratch(es)" in the large glossy-black photo field → `surface_front` cap 9. **Image review: at most faint dust/glare specks, not handling scratches.**

Two design faults amplify it:
- **Multi-region "corroboration" is a loophole.** `visionGrader.ts` ~L2036: `corroborated = regionCount >= 2 || holisticMin <= cap+1`. Four *false* corner findings from the same biased pass satisfy `regionCount ≥ 2` and count as mutual corroboration; the `≥3 regions → −1` penalty (`zoomInspection.ts` ~L379) then pushed corners **10→8**.
- **The v9.2 evidence-reconciliation guard is disabled by the false finding.** Step 3.8 (~L2129): *"a zoom face-cap on the category blocks it (cap == evidence)."* The one guard for unjustified 7–8 deductions cannot fire because the hallucination *is* the evidence.
- **Uncertainty runs backwards:** card 1 took a 2-point cap at ±2 (low confidence), where the benefit of the doubt should widen.
- **Live reproduction:** the Shaq calibration card (Jul 8 run) scored `[10,10,10]` on all holistic passes, then zoom capped `corners_front 10→8` and `surface_front 10→8`.

### C. Centering has no perspective normalization — photo-source drift (cards 2 vs 3)
Same physical Jordan card:
- JPEG upload → front `Left ≈ 4.0mm, Right ≈ 3.0mm` → **43/57 → centering 9 → grade 9**
- In-app camera → front `Left ≈ 7.0mm, Right ≈ 7.0mm` → **50/50 → centering 10 → grade 10**

**Image review:** the JPEG is slightly rotated/keystoned (borders read uneven); the camera shot sits square. Centering is measured in mm off the **raw framing with no deskew/rectification**, so tilt/crop moves the ratio by a full grade. Centering is the most crop-sensitive subgrade, so it drifts first. Meanwhile `postGradeEmailTemplates.ts` promises *"two photos of the same card produce the same grade."*

### D. Aggravator — the "Other" route drops fields
`src/app/api/other/[id]/route.ts` does **not** persist `conversational_limiting_factor`, `conversational_weighted_sub_scores`, or `weighted_total_pre_cap` (confirmed null on cards 1 & 5; populated on the Sports cards). It also reads `scoring.final_grade` before the capped `final_grade` (~L496). So on "Other" cards the page can't cleanly show *why* the grade dropped.

### E. Aggravator — category/identity split
The same Andre card was filed **Sports** ("Andre the Giant / Hulk Hogan", card 4) and **Other** ("WrestleMania III", card 5) across two uploads — two categories, two matchers, two identities.

### Also confirmed (not in Joey's cards, but same class)
- **Uncertainty/unanimity gate** (`visionGrader.ts` ~L2337–2354) knocks a final 10→9 while leaving all four subgrades at 10 — a *by-design* second path to "overall below all tiles." The client (~L3159) then **hides the Limiting Factor block** when all subgrades are 10, so a gate-down has no on-page explanation except one summary sentence.
- **Cached-path drift (Sports):** the cached read re-derives `conversational_sub_scores` but not `weighted_sub_scores`/`limiting_factor` → tiles can change on refresh.
- **`capped_grade_reason`** (sports route ~L1062) is written from the AI's `grading_metadata`, not the engine's real `gradeCapNote`.

---

## Fix plan (phased)

### Phase 1 — Kill the display contradiction ✅ IMPLEMENTED (display-only, no grade change)
**`src/lib/visionGrader.ts` — new Step 7.6** (after Step 7.5, before `extractedGrade`): clamp every structured per-category section score in the grading JSON **down** to the final consensus —
- category rollup `.score` → `serverRounded[cat]`
- per-face `.score` and per-position scores → `raw_sub_scores[{cat}_{face}]` (the same value the tile's F/B shows)
- never raise a score; when a face is clamped below 10, append a one-line pointer to that face's summary so a "perfect score" sentence can't sit beside a clamped number with no explanation.

Because the fix is server-side on the stored JSON, **all consumers** (sports client, other client, report PDF, mobile) are corrected at once, with no per-client edits.

**Verification:**
- `scripts/verify-section-clamp.ts` — replays the exact loop on the real stored JSON for cards 1/4/5: **3/3 COHERENT** (card 1 corners 10→8 F+B; cards 4/5 surface front 10→9, back stays 10 matching `B:10`).
- `npx tsc --noEmit` — **0 errors** in `visionGrader.ts` (no new type errors).
- `scripts/run-calibration.ts` — Step 7.6 ran end-to-end without error; grade unaffected (display-only). ⚠️ **Calibration set is stale**: 2 of 3 seed cards now return CARD NOT FOUND and must be re-seeded before the gate is trustworthy again.

**Still open in Phase 1 scope (UI, small):** when the overall is gated below `MIN(subgrades)` (the 10→9 case), show a tile-adjacent "held at 9" note and stop hiding the Limiting Factor block. *(Not one of Joey's cards; deferred.)*
**Backfill:** Joey's 5 already-stored cards keep their pre-fix JSON; a one-shot re-clamp backfill (or a regrade under Phase 2) is needed to correct them retroactively.

### Phase 2 — Fix the zoom false-positive path (changes the grades) — PENDING
1. Close the corroboration loophole: require zoom caps to be corroborated by the **holistic passes or the user report**, not same-pass region count. Limit a zoom-only cosmetic cap (whitening/scratch/scuff) to `consensus − 1` unless `holisticMin ≤ cap+1` or the user report doesn't claim clean.
2. Respect `noDefectsConfirmed: true` + all-passes-≥9 → note-don't-cap for uncorroborated cosmetic findings.
3. Tie cap aggressiveness to image confidence (≤1 point on uncorroborated findings at ±2).
4. Add a cosmetic-verification pass mirroring `verifyStructuralClaim()` (re-crop, one targeted question; fail-safe = don't cap).
5. Recalibrate the light-border whitening rule (`zoomInspection.ts` ~L253–262) so "not perfectly crisp" ≠ automatic whitening on vintage stock.
- Gate against a **re-seeded** calibration set + Joey's 5 cards + a vintage/glossy-black sample.

### Phase 3 — Centering photo-drift (the Jordan issue) — PENDING
- 3a (cheap, ship first): ±1 centering tolerance / honest uncertainty band so a borderline 9/10 doesn't flip the whole grade.
- 3b: deskew/perspective-rectify before centering measurement (reuse Scanner Lab geometry); prefer geometric border detection over free-form mm estimation.
- 3c: same-card consistency guard (same user + identity within N hours → surface/reconcile prior result).

### Phase 4 — Consistency cleanups — PENDING
- Persist `limiting_factor`/`weighted_sub_scores`/`weighted_total_pre_cap` in the **Other** route; use the capped `final_grade` (~L496).
- Sports cached path: re-derive `weighted_sub_scores`/`limiting_factor` so refresh can't drift.
- Persist the engine's real `gradeCapNote` into `capped_grade_reason`.
- Bump `DCM_PROMPT_VERSION` to v9.2.
- Investigate the category/identity split at upload categorization.

---

## Diagnostic scripts (read-only, left in `scripts/`)
- `dump-joey-cards.ts` — full grading-record dump for the 5 cards
- `fetch-joey-images.ts` — pulls the front images to scratchpad for visual review
- `verify-section-clamp.ts` — replays the Phase 1 clamp against real stored JSON and asserts coherence

## Customer-facing recommendation
Cards 1, 4, 5 are almost certainly **10s** (or a defensible 9 with a *real* shown defect). Offer Joey a **free regrade** once Phase 1+2 ship, with a short note acknowledging the report-display bug was real and fixed.
