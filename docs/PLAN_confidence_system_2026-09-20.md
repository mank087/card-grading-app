# Confidence system — review of the ChatGPT audit, and a plan

September 20, 2026. Read-only review: no grading behaviour or customer records were changed.
The audit is `docs/CONFIDENCE_PHOTO_QUALITY_AUDIT_2026-09-20.md`; it analysed a 243-card
calibration replay. Everything below was re-measured on **production traffic**.

## Verdict on the audit

Its central claim is right, and the problem is larger than it found.

| Audit claim | Checked against | Result |
| --- | --- | --- |
| C confidence turns a 10 into a 9 with no defect | `visionGrader.ts`: letter maps A/B/C/D to ±0/1/2/3, and ±2 or more blocks a 10 | **Confirmed** |
| All four subgrade tiles can be lowered to 9 | the weakest-link display block: "evidence-quality cap, all categories" | **Confirmed** — 32 of 44 sampled cases |
| Clipping has false positives | 1,234 cards with stored geometry, plus photos checked by eye | **Confirmed, and it is my rule** — see below |
| The letter is subjective and comes from one evaluation | code | **Confirmed** |
| Clipping is the priority fix | production sample | **Overstated** — it is 9% of the problem |

What the audit missed: since September 17 the grader already has the thing it recommends
building. The fail-closed inspection refuses to publish a grade unless all 28 magnified regions
were actually inspected by a quorum of samples. That is regional evidence, recorded per card
(`capture_quality.zoom_coverage`). The confidence letter is an older, vaguer proxy for the same
question, and it is now overruling the better measurement.

## What production shows (last 14 days, 3,227 graded cards)

| Confidence | Share of cards | Got a 10 | Got exactly 9 |
| --- | --- | --- | --- |
| A | 5.5% | 35% | 34% |
| B | 68.6% | 20% | 33% |
| **C** | **24.2%** | **0%** | **76%** |
| **D** | 1.7% | **0%** | 71% |

- **One card in four gets C or D, and not one of those 837 cards received a 10.**
- C cards pile up on exactly 9 at more than twice the rate of B cards. That pile-up is the cap.
- Pokémon is hit hardest (34% C/D), then Other (25%) and Sports (23%); MTG least (10%).

A sample of 120 C/D cards graded 9, spread across the two weeks:

- **37% had all three evaluations at 10.** The confidence letter was the only reason for the 9.
- 29% had two of three at 10. 34% were genuinely a 9 or lower.

Scaled up: about **230 cards in two weeks — roughly 7% of everything graded, 17 a day — came back
a 9 when every evaluation scored 10.** Among those unanimous cards:

- **50% were in a holder or sleeve**
- 43% were the model's own judgement: "soft" and "focus" (27 each), "reflect" (26), "glare" (24),
  "lighting" (20)
- 9% were clipping flags

## The clipping rule (mine, from the P047 verdict)

The rule calls a corner out-of-frame when it is within 0.6% of the photo border. Its own comment
says fully framed cards "sit far inside this." That is false: the 5th-percentile card has its
nearest corner 0.4% from the border.

- It flags **7.1% of all cards** (88 of 1,234).
- Only 28 of those 88 have a corner actually ON the border. **51 (58%) are 2 to 6 units inside.**
- By eye, three of those 51: one is a plainly complete card with margin on every side (a false
  positive), one is tight but every corner is visible, one really does run off the bottom edge.

So the inside-the-border band is a mix, and simply shrinking the tolerance would trade one error
for another. The zoom pass already reports, per corner region, whether it showed mostly card. That
is the right test: a corner the magnified inspection actually saw is not a clipped corner.

## Plan

Ordered so that the first steps change no grades, and nothing that moves grades ships without a
replay first.

### 1. Replay before anything else (free)
The cap is pure server logic applied to stored pass scores, so its removal can be replayed exactly,
with no model calls: for every card in the last 30 days, recompute the final grade under each
candidate rule below and report which cards move and what happens to the 10-rate. Today the
10-rate is 15.9%. The code's own comments put the healthy baseline near 24.5% and record that 47
to 56% was a past failure, so the target is a number near the baseline, not a bigger number.

### 2. Fix the clipping rule
A corner is clipped when it sits on the border (within 0.1%), **or** when the magnified inspection
could not see that corner region. Replay on the stored geometry; expect flags to fall from 7.1% to
roughly 2 to 3%.

### 3. Let measured coverage, not the letter, decide whether a 10 is supported
Replace "C means ±2 means no 10" with:

- **Complete magnified coverage, no clipped corner, no rigid holder:** the letter does not cap. The
  evidence for a 10 exists and was checked region by region.
- **D, a genuinely clipped corner, or a rigid holder:** still caps, as now.
- **Evaluations disagree about possible damage:** still raises uncertainty, as now.

The letter stays as information for the customer. It stops being a veto.

### 4. Stop presenting a photo limit as condition damage
When a grade is held only by evidence quality, show the subgrades the evaluations actually gave and
mark the final grade as held, with the real reason. Not four 9s. This needs care: showing four 10s
under a 9 is exactly what customers complained about on July 27, which is why the tiles are dragged
today. The fix for both complaints is a distinct, labelled "held" state, and that touches the web,
the app and the label, so it is a design decision for you.

### 5. Say the true reason
"The photos are not clear enough" is currently used even when the real cause is a holder, a clipped
corner, or disagreement between evaluations. Record the specific cause on the card and show it, and
make every screen display the server's actual uncertainty instead of rebuilding it from the letter.

### 6. Decide the holder policy separately
Half the unanimous-capped cards are in holders. There is already an honest, explicit rule for rigid
cases ("re-submit outside the holder"). The open question is sleeves and top loaders, which the
model grades as C today. Your own verdict on the display-holder card was "9 plus or minus 1", which
argues for keeping a cap there. This is your call, and it is the biggest single lever in the data.

### 7. Validate with your eyes before shipping steps 2 and 3
The replay in step 1 produces the exact list of cards that would move from 9 to 10. Review about 30
of them, links on your phone. If you would not call them 10s, the rule is wrong and we stop. That is
cheaper and more direct than the multi-phone photo study the audit proposes, which is still worth
doing later for repeatability.

### Later
Align the capture-time checks (web focus and brightness, app dimensions and blur, bulk file checks)
with what the grader actually caps on, so a customer who passes the checks is not surprised, and
after a cap tell them which photo to retake and why. A targeted "replace this photo" flow and
provisional grades are the audit's larger ideas; they are good, and they are a product build, not a
fix.

## What I would not do
- Remove the cap outright. Genuinely bad photos would receive final 10s, and the 10-rate has
  blown out before.
- Tune for a target percentage of 10s. The measure is whether the cards that move are really 10s.
- Ship any of steps 2, 3 or 6 on reasoning alone. Each one moves grades for thousands of cards.
