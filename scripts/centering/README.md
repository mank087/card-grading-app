# Centering ground truth (Step 6a, Oct 16 2026)

`truth-set.json` — 17 cards, front border widths in source-photo pixels read by eye from
ruler-overlaid edge strips (see `_readme` inside). Olsen reproduces the Aug 26 independent
edge-detector read. Cards with no measurable border (full art, painted edges, glare) are listed
as skipped so nobody re-measures them.

Tools (run from the repo root with `npx tsx --env-file=.env.local scripts/centering/<tool> <scratch-dir> [ids]`):

- `edge-strips.ts <out> <card-id ...>` — one sheet per card: L/R/T/B strips, cut edge on the left,
  interior to the right, 10 px ticks, labels every 50 px. This is how the truth was read.
- `compare-truth.ts <out>/compare.json` — truth vs the ensemble's own ratio vs the live CV
  (`measureCentering` around `detectCardGeometry`'s quad). Needs `<out>/edge-meta.json` from
  `edge-strips.ts` to resolve ids.
- `proto-background-walk.ts <out>` — a background-inward border walker (prototype, FAILED).
- `model-strip-read.ts <out>` — the model reads widths off the ruler strips (FAILED).

## Result (Oct 16)

| path | L/R MAE (pts) | T/B MAE | direction right on off-centre cards |
|---|---|---|---|
| ensemble's own ratio | 2.9 (n=16) | 4.6 (n=13) | 2/3, 3/5 |
| live CV around the model quad | 5.6 (n=14) | 9.3 (n=10) | 2/3, 4/4 |
| background-walk prototype | 16.7 (n=3) | 6.4 (n=5) | — |
| model reading ruler strips | 4.8 (n=16) | 5.0 (n=14) | 2/3, 2/5 |

The ensemble's low MAE is compression: most cards here are near 50/50 and it calls those
right, but it under-reads every real offset (Olsen truth 40/33 → 48/45). CV catches Olsen's
top/bottom (33) but produces wild widths elsewhere (Cubone bottom 16 px vs top 104) because the
quad lands inside the card and the ±48 px snap cannot reach the cut edge. Neither is a
measurement. Next: a dedicated edge finder scored against this file (cut edge from the
background side, design-aware inner edge), with `compare-truth.ts` as the scoreboard; until
then the CV gate can only flag, never re-score (CV_CENTERING_GATE_V1).
