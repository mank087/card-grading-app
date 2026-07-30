# Grading Accuracy Roadmap — post-v9.4.1 review
**Date:** 2026-07-12 · **Question:** how close can we get to a human mail-away grader, given AI + photo limits — and what's worth doing next?

## Where the system stands (evidence, not vibes)
Five harness iterations this week measured the stack end-to-end. Current state (v9.4.1):
- Repeatability: **0.09–0.18 grade spread** run-to-run (was 0.5–1.0 a week ago). Grade-shopping is effectively dead.
- Anchor accuracy: 81–91% within ±1 of best-sourced human grades, including hard cases (creases, cased cards, glare foil, margin photos, real vs phantom whitening).
- Every confirmed customer complaint class has a verified fix: over-graded 10s (v9.3 gates), missed wear (v9.4 zoom rebuild), invented defects (v9.4.1 geometry).
A human grader is roughly ±1 grade self-consistent on resubmission; the system's repeatability now matches or beats that. The remaining gap is **judgment accuracy at specific boundaries**, ranked below.

## Ranked improvements (expected accuracy gain ÷ effort)

### 1. Deterministic centering from the corner quad — HIGH gain
Centering is the **#1 limiting factor in production** (64 of 275 v9.4 cards) and is still model-eyeballed — the one place a human with a centering tool categorically beats us. We now HAVE the card's corner quad from the v9.4.1 geometry gate. Perspective-rectify the card image from the quad, detect the inner frame/border edges (classic CV — high-contrast straight lines), and **measure** L/R/T/B ratios in pixels. Deterministic, repeatable, auditable ("55/45 measured" beats "looks slightly off-center"). Model estimate stays as fallback when border detection fails (borderless/art cards). This is the single largest remaining accuracy lever.

### 2. Wire the owner's condition report into the zoom (priorityNote) — HIGH gain, ~1 line
`runZoomInspection` has a `priorityNote` option built for exactly this — **it is never passed** (`visionGrader.ts:1662` calls with no options). Xerosic's owner *declared* back-edge whitening in his condition report and the inspector was never told where to look; the system then "refuted" him. Pass the processed condition report's defect claims as the zoom's priority note. Guardrail: a claim primes ATTENTION, never scores directly — the crop still has to show it (keeps grade-fishing impossible).

### 3. Severity calibration at the minor/moderate boundary — MEDIUM gain
Post-v9.4.1, the minor↔moderate boundary IS the 9-vs-7/8 decision, and it's a single stochastic word (Shaq read "moderate" one run, "minor" the next). Give the zoom prompt operational severity anchors ("minor: ≤1mm-equivalent fleck, invisible at arm's length; moderate: a run of whitening or fleck cluster visible at reading distance...") tied to the visibility ladder, and require the model to state WHICH criterion fired. Cheap prompt change; harness-gate it on Shaq/Andre/Koby — the three anchors that currently sit exactly on this boundary.

### 4. Honest ensemble diversity — MEDIUM gain, needs measurement
Both the main ensemble (n=3) and zoom (n=5) run with a FIXED seed — the "independent" samples are partially correlated copies, so unanimity gates and majority votes are weaker signals than they appear (measured earlier: 64% byte-identical passes). Options: drop the seed (real diversity, slightly worse repeatability) or keep it (repeatability, fake votes). This is a measured trade — run the harness both ways at N=4 and pick. Do NOT change n counts (variance control) without the same measurement.

### 5. Grow the anchor set with owner-verified ground truth — compounding gain
11 anchors, several authored semi-blind (Koby's is still disputed). Every accuracy decision is only as good as this set. Cheap growth path: cards customers submit that ALSO have a professional grade (PSA/BGS slab photos of the same card, or crossover submissions), plus your own hand-graded batch. Target ~30 anchors spanning each boundary (9/10 clean, 8/9 minor wear, 6/7 moderate, structural, vintage light-border, foils, margin photos). At that size, the harness becomes a genuine regression suite instead of a smoke test.

### 6. Capture-time enforcement — product-level, prevents the hardest cases
The geometry gate now KNOWS when a photo is ungradeable-at-zoom (fill <68%, no quad). Today that's discovered at grade time. Surface it at CAPTURE time: "move closer — card should fill the frame" before the credit is spent. The reshoot_required signal from the camera review is still unused. Best accuracy fix is a better photo; a human grader holding the card always beats any photo pipeline — shrinking photo variability is how we close that structural gap.

## Not worth doing now (at or below the photo-variability noise floor)
- **Multi-angle/tilt capture** to catch angle-dependent holo scratches — real gap vs humans (they tilt cards under light) but a big product/UX lift for a narrow defect class; revisit if surface-scratch complaints materialize.
- **Chasing the last ±1 on vintage borderline cards** (Saddam-class) — human graders themselves disagree at ±1 there; the system now sits inside that band.
- **More gate/cap logic layers** — the cap stack is now deterministic and calibrated; more rules would trade transparency for noise-fitting. The whack-a-mole from Jul 10 (each fix shifting errors) was the signal we've reached rule-tuning saturation; remaining wins are in PERCEPTION inputs (items 1, 2, 6), not decision logic.
- **Full prompt rewrite** — Phase 1 removed the contradictions that mattered; the pending Phase 2 dedup is a cost/adherence play, not an accuracy one.

## Suggested order
2 (one line, this week) → 3 (prompt + harness, this week) → 1 (CV centering, the big one, ~a day + gate) → 5 (ongoing) → 4 (measured experiment) → 6 (product cycle). Everything harness-gated per standing rule.
