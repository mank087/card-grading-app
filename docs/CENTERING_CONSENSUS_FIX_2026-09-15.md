# Centering consensus 9 under three passes of 10 (2026-09-15)

## The symptom

The three-pass table shows centering 10 / 10 / 10 and the consensus row shows 9.
Nothing on the page says why. Customers read it as the system contradicting
itself, and it is not obviously wrong until you know where the 9 comes from.

## The data

`scripts/_tmp-centering-mismatch-scan.ts`, run against the last 240 cards with a
stored `conversational_grading` blob (14-day window, 12 rows per batch, one heavy
column, stops on error):

- 53 of 240 cards (22%) show the pattern: median of the three pass centering
  scores strictly above the displayed centering consensus.
- 46 of those 53 carry at least one non-standard face (`card_type` not
  "Standard Bordered"): borderless, asymmetric insert, die-cut or foil-frame.
- Customer case: serial 676561. Front `card_type` "Foil-Frame", ratios XX/XX,
  face score 9, passes 10 / 10 / 10, consensus 9.
- Tile-drag case: serial 626654. `averaged` 9 / 10 / 10 / 10 displayed as
  `averaged_rounded` 9 / 9 / 9 / 9.

## The mechanism

Two separate ones, both correct arithmetic and both invisible.

**1. The face-level clamp.** `visionGrader.ts` Step 3.5 ("Enforce the rubric's
weakest-link invariant at the FACE level") clamps each category to
MIN(front, back) taken from `jsonData.raw_sub_scores` — the DETAILED per-face
sections, which are scored separately from the three whole-card passes. So a
front section at 9 pulls the category to 9 even when every pass said 10. It
logged to the console, added no consensus note, and did not fold into the
displayed pass rows.

Why the per-face 9s existed on non-standard designs: a rubric contradiction.
`prompts/master_grading_rubric_v5.txt` STEP 1 (TYPE B/C/D/E) still said
"Maximum centering score: 9" while the v9.21/v9.22 block above it said do NOT
deduct for a design that has no border. `sports_delta_v5.txt` and the worked
example in `pokemon_delta_v5.txt` repeated the cap.

And why the R0 policy did not rescue the foil-frame case: `centeringPolicy.ts`
mapped "Foil-Frame" to `'indeterminate'`, which is deliberately excluded from
R0 (an unknown layout must not inherit the benefit of the doubt). A decorative
foil frame is not an unknown layout, though — it is a card with no even printed
border, the same class as full-bleed.

**2. The gate drag.** The uncertainty and rigid-case gates hold a 10 at 9 for a
reason about evidence QUALITY, and the v9.12 weakest-link display invariant then
drags every tile down to match. The gate wrote its reason into the summary; the
tiles moved silently.

## The fix (v9.25)

`DCM_PROMPT_VERSION` is now `DCM_Grading_v9.25`.

**Rubric.** The four "Maximum centering score: 9" bullets in STEP 1 (TYPE B, C,
D, E) are replaced with a line consistent with v9.22: score from internal
alignment or internal geometry, a design with no even border is not deducted for
lacking one, and if nothing shows a shift score 10 and return XX/XX. Same fix in
`sports_delta_v5.txt` (die-cut section) and in the `pokemon_delta_v5.txt` Full
Art VMAX worked example, which now scores centering 10 with XX/XX and says why.
Remaining hits for "Maximum centering score" are all under `prompts/backups/`.

**Policy.** `centeringPolicy.ts` gains a `'foil_frame'` FaceLayout.
`layoutFromCardType` maps "foil-frame", "foil frame", "pattern-frame" and
"pattern frame" to it. It is in `UNMEASURABLE_BY_DESIGN_LAYOUTS`, so R0 raises a
foil-frame face with NO stated ratio and a proposed score of 9 or 10 — and it is
deliberately NOT in `MEASURABLE_LAYOUTS`, so R4 still refuses a Gem claim on a
foil-frame face that DID state a ratio. `centeringUnmeasurableNote` takes an
optional layout and says "decorative foil or pattern" rather than claiming the
artwork runs to the edge.

**Engine.** `src/lib/grading/consensusExplain.ts` is a new pure module holding
the note wording. In `visionGrader.ts`:

- the RAW per-pass category scores are captured right after the median block,
  before any mutation (`rawPassCats` / `rawMedianOf`);
- Step 3.5 records each clamp (`faceClamps`) and emits nothing there;
- after every gate has settled `finalGrade` and `serverRounded`, a wrapped block
  folds the consensus into the displayed pass rows (same shape as the v9.1 zoom
  fold: capping is monotonic, so median(folded) still equals the consensus and
  the grade cannot move) and pushes ONE consensus note;
- the v9.12 tile drag pushes one note reusing the gate's own reason clause.

Note wording:

> Centering consensus is 9 although each whole-card evaluation scored it 10: the
> detailed front assessment scored 9. &lt;first sentence of the face prose, 200
> chars max&gt;

> Subgrades shown at 9 to match the held grade: the evaluations scored corners,
> edges and surface at 10, but the grade is held at 9 because the photos are not
> clear enough to confirm a 10.

The clamp note is suppressed when the gap is already explained elsewhere on the
page: a zoom face cap on that category (`appliedFaceCaps`), a structural cap on
surface, the v9.9 dissent-reflection note, or the tile-drag note. It is also
suppressed when a later gate pulled the category BELOW the clamped face score,
because then the gate owns the explanation.

## How to re-measure

```
npx tsx scripts/_tmp-centering-mismatch-scan.ts
```

It reads the last 240 recent cards in batches of 12 and prints the mismatch
count, the count by card type and a few example serials. The 22% / 53-of-240
figure above is its output on 2026-09-15. After v9.25 has been live for a few
days, re-run it: the residual should be cards where the clamp is real (a genuine
per-face difference) rather than a design-type cap, and every one of those should
now carry a consensus note. Follow the production DB safety rules — small
batches, one heavy column, stop on error.
