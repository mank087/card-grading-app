# Grading v9.15 — majority gem gate: working evidence checks

**Date:** August 14, 2026
**Supersedes the calibration in:** v9.14 (majority gem gate)
**Code:** `src/lib/visionGrader.ts` — `defectListOf`, `centeringOf`, the majority gem gate
**Backtest:** `scripts/_tmp-backtest-v915.ts`

---

## Why this release exists

v9.14 relaxed Gem Mint from strict unanimity to a 2-of-3 majority, but only when
the lone dissent was **evidence-free**: it cited no defect in the category it
marked down, and the magnified inspection applied no cap there.

The citation half of that test never worked.

`defectListOf()` built each pass's `defects_noted` by walking the completion's
category sections and keeping entries where `typeof d === 'string'`. The rubric
emits defects as **objects** (`{type, severity, location, description}`) in
corners, edges, and surface. Every entry was discarded, so `defects_noted` was
`[]` on every card ever graded and `citedEvidence` was permanently `false`.

Verified in production: **0 of 25** recent cards had a single per-pass defect
note, including a grade-7 card whose corners and edges scored 7.

Two consequences:

1. The gate effectively ran on the zoom and structural checks alone. An
   evidence-backed 2-vs-1 split — the July refund shape v9.14 was written to
   keep holding at 9 — would have taken the 10.
2. **The v9.14 calibration is void.** `scripts/_tmp-backtest-majority-gate.ts:60`
   used the same string filter, so its "~24.7% projected 10-rate" was computed
   with the citation test off. That figure describes "2-of-3 always wins unless
   zoom or structural objects", not the policy as designed.

---

## Fix A — object-aware defect extraction

`defectListOf` now serializes object defects, drops `severity: "none"` (the
schema allows explicit no-defect entries, which are not evidence), and prefixes
each line with its category and face.

Measured on 25 recent cards: **0 → 49** extracted entries, 13 of 25 cards now
carry at least one note. Grade-10 cards still produce zero, as they should.

**The prefix is load-bearing.** The gate previously matched defects to
categories with keyword regexes written for a list that was always empty. With
real text flowing through they misfire: a corner defect reading *"white edge
wear along the left border"* matches the centering regex on `border` and the
edges regex on `edge`. On the same 25 cards the centering regex matched 7, every
one a false positive. Matching is now `line.startsWith(category)`.

---

## Fix B — centering measurement as evidence

Centering has no defect list by design; it is measured, not itemised. So the
citation test can never speak to a centering dissent — and centering is
essentially all of them: **13 of 13** majority-awarded 10s between Aug 13-14.

Each pass reports `left_right` / `top_bottom` per face. Deviation is half the
gap between opposing borders: `50/50` → 0, `55/45` → 5. Pass records now persist
`centering_ratios` and `centering_dev`.

Two arms:

| Arm | Rule | Status |
|---|---|---|
| **Measured** | Card's own deviation ≥ **5** points | Backtested |
| **Disagreement** | Dissent measured ≥ **4** points worse than either 10-voter | **Not backtested** |

5 points is `55/45`, the rubric's own line for a centering 10 ("~20% of cards
achieve 55/45 or better"). A card measured at or past it makes a centering 9 a
defensible read rather than noise, so the 10 holds at 9.

The disagreement arm compares per-pass measurements, which **historic records do
not contain** — this release is what starts storing them. It could not be
backtested, so it is set wide enough to fire only on blatant disagreement, and
it can only tighten the gate. Revisit once per-pass ratios have accumulated.

---

## Backtest results

**Cohort A** — 292 cards from Aug 1-12 held 10→9 by the old unanimity rule;
131 of them are 2-of-3 splits. 10-rate is projected against the Aug 1-12 base of
311/1789 = 17.4%. July baseline: 24.5%.

| Policy | 10s restored | Projected 10-rate |
|---|---|---|
| v9.14 as shipped (citation dead) | 131 | 24.7% |
| Fix A only | 131 | 24.7% |
| Fix A + B, T=3 | 98 | 22.9% |
| Fix A + B, T=4 | 108 | 23.4% |
| **Fix A + B, T=5 (shipped)** | **117** | **23.9%** |
| Fix A + B, T=6 | 131 | 24.7% |

**Cohort B** — 56 grade-10s awarded since Aug 13. At T=5, **1 flips to 9**
(T=4 → 7, T=3 → 8).

T=5 lands just under the July baseline, is anchored to a threshold the rubric
already defines rather than curve-fitted, and disturbs one live card.

### What the backtest cannot measure

`cited=0` in every row above. Stored records contain no per-pass defect text —
only the median-pick completion's sections survive, and on a card that reached
the 10 line the winning completion has no defects to cite. **Fix A's impact is
not retroactively measurable**; it can only be observed going forward. The
numbers above are therefore a lower bound on how much the gate tightens: they
capture Fix B alone.

This also means the 23.9% figure could drift down once Fix A starts catching
real citations on corners/edges/surface dissents. Those are ~0% of current
majority-10s, so the near-term effect should be small, but the 10-rate is worth
watching for two weeks post-deploy.

---

## Also changed

- The customer-facing note no longer claims the dissent scored low *"without
  citing a flaw"* — unfalsifiable before this release. It now states only what
  was checked, with separate wording for centering (measurement) and for
  corners/edges/surface (no recorded defect).
- `DCM_PROMPT_VERSION` → `DCM_Grading_v9.15`.
- The identical-passes shortcut detector (`visionGrader.ts:559`), which compares
  `defects_noted` across passes, was also inert and now has real input.

## Watch after deploy

1. **10-rate** — expect ~23-24%. A drop below 20% means Fix A is catching more
   citations than the backtest could see.
2. **`centering_dev` distribution** on majority-10s — confirms the 5-point line
   sits where intended.
3. **Disagreement-arm firings** — log line `majority gem gate`. If it never
   fires, per-pass measurement disagreement is rarer than assumed and the arm
   can be tightened toward the measured arm.
