# Refined Cosmetic Verification — Project Scope

**Date:** July 9, 2026
**Goal:** Cut the corner/edge "whitening" over-detection (Type-1 false positives) that is under-grading real customer cards, **without** losing recall on genuine minor wear (the Shaq/Type-2 problem). Measured on a real calibration set — no shipping without numbers.

---

## 1. The problem (measured, not assumed)
The last-24h production review (163 cards) found **~17%** capped to 7–8 by zoom-detected "minor whitening" on corners/edges — frequently on **all four corners at once** (Cooper Flagg, Saddam, multiple Charizards, MJ, Jirachi). Spot-checking the same signature on Joey's disputed cards confirmed the corners were **actually clean**. So production (v9.1) is **systematically under-grading a meaningful fraction of clean cards from 9–10 down to 7–8**, generating the exact "why did my clean card get an 8?" disputes Joey raised.

**Why prior attempts failed:**
- **Voting doesn't catch it.** The over-detection is a *systematic* light-border bias (the rubric's "not crisply sharp = whitening" rule fires on every light-border corner), so it appears in a *majority* of the 5 zoom samples and survives the majority vote.
- **A re-verification pass (Phase 2 `verifyCosmeticClaims`) over-corrected.** Re-asking the model "real or artifact?" shares the same bias at the faint margin — it fixed Andre/Joey false positives but **waived Shaq's real wear** (9–10 vs correct 7). Net accuracy dropped (measured: 80%→ worse).

**The core tension:** tightening false-positive suppression loosens real-defect recall. Any fix must be measured on **both** kinds of case at once.

---

## 2. The key insight — the discriminator is finding STRUCTURE, not a re-look
The confirmed false positives and the confirmed real wear differ in the **structure of the findings**, which the biased model can't fake (and which is computable in code, with no extra vision call that shares the bias):

| Case | Findings | Verdict |
|------|----------|---------|
| Cooper Flagg (clean) | **minor** whitening on **all 4** back corners — *uniform* | FALSE — systematic bias |
| Saddam / Joey (clean) | **minor** whitening on all 4 front corners +4 more — *uniform* | FALSE (visually confirmed clean) |
| **Shaq (real wear)** | **moderate** front-TR, minor front-BL, **moderate** front-BR, **moderate** back-TL … — *varied severity, includes moderate, localized* | REAL — cap applies |

**Real handling wear is uneven** (specific corners get dinged, mixed severities). **A uniform "minor everything" report is the fingerprint of the detector's light-border bias, not damage.** This structural signal separates our confirmed FP cases from our confirmed TP case cleanly — and it's deterministic, so it doesn't add stochasticity or re-share the model's bias.

---

## 3. Design principles
1. **Discriminate on finding-structure + independent signals, in code — don't re-ask the biased model.** (This is the departure from Phase 2's verifier-centric approach.)
2. **Benefit of the doubt only for the systematic-bias signature** (uniform minor on a light border, holistic-missed, low image confidence). Localized/varied/moderate+ wear still caps.
3. **Measure precision AND recall** on a set that contains both FP and TP cases. Ship only if false positives drop *and* recall holds.
4. **Keep it a small, reviewable change** to the existing cosmetic-cap path — not a rewrite.

---

## 4. Proposed mechanism (to be tuned on the calibration set)
For each face+category cosmetic cap the zoom proposes (whitening/softening on corners/edges):

- **Heavy/severe** → cap (real damage). No change.
- **Moderate**, OR corroborated by a holistic completion, OR **varied severities** across positions, OR **localized** (1–2 positions, not uniform) → cap. (Catches Shaq.)
- **Uniform minor** (same "minor" on ≥3 of 4 positions of a face) + holistic scored the category ≥9 + light-colored border → **do NOT cap below 9** (systematic-bias benefit of the doubt). (Kills Cooper Flagg / Saddam.)
- **Image confidence C/D** → minor findings never cap below 9 (can't confidently call faint whitening on a soft photo).

Signals computed in code from data we already have: the zoom findings' per-position severities (uniform vs varied), holistic pass scores (corroboration), the model's border description / a quick light-border color check, and `image_quality.confidence_letter`.

Open question to settle with data: does "uniform minor" ever hide *real* even all-corner wear? (Rare, but the calibration set must include a genuinely evenly-worn card to check recall there.)

---

## 5. Calibration set (the prerequisite — build this FIRST)
Label a set spanning the decision boundary, drawn from production + our known cards:
- **False positives (want → 9–10):** Cooper Flagg, Saddam, 2–3 of the flagged Charizards, MJ — visually confirmed clean corners.
- **True positives (want the cap to hold):** Shaq (varied minor/moderate), plus 1–2 genuinely corner-worn cards (localized) and 1 **evenly** all-corner-worn card (the hard recall case).
- **Controls:** a clean Gem 10, a creased card (structural), a dark-border card (bias doesn't fire there).
Each labeled with an expected grade + the expected corner/edge outcome. Reuse `scripts/repeatability-harness.ts` (already engine-switchable + resumable).

---

## 6. Success metrics
- **False-positive rate** on the clean-but-flagged cards: target near 0 (they grade 9–10).
- **Recall** on the worn cards: Shaq stays ~7; localized-wear cards keep their cap.
- **Repeatability** unchanged or better (spread not worse than current).
- No regression on the structural/clean controls.

---

## 7. Phased plan
- **A. Build + label the calibration set** (visual review of the flagged production cards to confirm FP vs TP). *Prerequisite.*
- **B. Baseline** current production behavior on the set (FP rate + recall) via the harness.
- **C. Implement** the structure-based gating (Section 4) behind the harness; tune thresholds on the set.
- **D. A/B** vs the production baseline: confirm FP rate drops AND recall holds AND repeatability doesn't regress.
- **E. Ship** only if the numbers clear the bar; otherwise iterate.

## 8. Risks
- The uniformity heuristic could suppress a rare genuinely-even all-corner-worn card (recall risk) → the calibration set must include one; if it fails, add a corroboration escape hatch.
- Light-border detection reliability → keep it advisory (one signal among several), not a hard gate.
- Perception noise remains the floor — this reduces a *systematic* bias, not random miss/hit variance.
