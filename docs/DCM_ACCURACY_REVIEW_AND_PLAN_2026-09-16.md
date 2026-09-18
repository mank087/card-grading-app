# DCM capture, identification, pricing and grading accuracy review

September 16, 2026 · Review of local checkout at `c3ff3f81` · Plan, not a production change

## Recommendation

Improve the existing Luna pipeline incrementally, and build owner confirmation of card identity as a standard step after grading. Do both: confirmation should not depend on first proving that AI identification cannot improve. Better identification reduces correction effort; confirmation resolves uncertainty about exact printings and gives owners a reliable recovery path.

The highest priority is preventing incomplete evidence from looking like a completed, confident inspection. The current system has valuable safeguards, but some failure paths negate them. Next, unify card identity and price selection so corrected names, numbers and parallels cannot retain a price for the previous card. Improve capture and orientation alongside those fixes. Then simplify prompts under controlled evaluation.

There is insufficient evidence from this review to promise a specific increase in physical grading accuracy, identify a single production cause of horizontal submissions, or claim that a model change is needed. The code does establish actionable problems without requiring a model replacement.

## Scope and evidence

Reviewed the web camera, native capture and image processing, upload quality checks, active master/delta loader, shared conversational grader, region inspection and structural verifier, model routing, identity reconciliation, category lookup paths, owner editing, pricing selection, regrade preservation and earlier local evaluation reports.

The eight category routes call `gradeCardConversational`; the active loader reads `prompts/master_grading_rubric_v5.txt` plus the corresponding category delta. The checkout stamps `DCM_Grading_v9.25`. Older grading functions and archived prompt files are not evidence of active behavior merely because they exist. The isolated `grading-work/v10` candidate is not the production architecture reviewed here.

This was a source audit plus offline tests. No customer grades, photos, identities, prices, prompts, deployment settings or application code were changed. Live deployment revision, environment flags, app build adoption, device behavior, catalog completeness and error frequencies remain unverified. A September 15 handoff describes then-unreleased changes; that is historical context, not proof of today's deployment state.

Validation performed:

- Focused Vitest run: **10 files, 172 tests passed**, covering identification, identity preservation, centering policy, consensus explanations, capture reason codes, thumbnail handling and checklist-year behavior. OpenAI calls in these unit tests are mocked.
- Additional reproducible, offline probes of current helper implementations: [audit probes](C:/Users/benja/card-grading-app/docs/dcm-accuracy-audit-2026-09-16-probes.cjs). Run `node docs/dcm-accuracy-audit-2026-09-16-probes.cjs` from the repository root.
- Read earlier identification and grading studies, then checked key findings against current code. Historical experimental outcomes below are explicitly attributed; they were not rerun here.
- Consulted official OpenAI model and vision documentation for Luna-specific guidance.

## 1. Camera capture and orientation

### What already works in our favor

The web camera requests a 3840×2160 stream, has resolution fallbacks, requests continuous focus/exposure/white balance when supported, and attempts `ImageCapture.takePhoto()` before falling back to a video frame. The visible guide and crop use shared geometry. Camera cropping and resizing happen together, with a final JPEG quality of 0.9 and a 3000px long-edge limit. Gallery uploads are not blindly cropped to the camera guide.

Native capture already prefers suitable photo sizes, uses continuous focus behavior, offers refocus interaction, waits briefly before shutter, combines crop/resize operations and performs an advisory pixel-based blur check. The dimensions-only quality module is not the only native quality check: `blurCheck.ts` is separately called by capture.

These improvements should be preserved. Comments saying there is only one lossy encode need qualification: a true camera JPEG is already encoded before our processing. The processing avoids extra application encode generations; it does not make the entire sensor-to-upload path lossless.

Sources: [web camera hook](C:/Users/benja/card-grading-app/src/hooks/useCamera.ts:190), [web crop](C:/Users/benja/card-grading-app/src/utils/guideCrop.ts:175), [native capture](C:/Users/benja/card-grading-app/dcm-mobile/app/grade/capture.tsx:325), [native processing](C:/Users/benja/card-grading-app/dcm-mobile/lib/imageUtils.ts:211), [native blur check](C:/Users/benja/card-grading-app/dcm-mobile/lib/blurCheck.ts:1).

### Horizontal submissions: separate three different problems

1. **Landscape file:** a vertical card is inside a wide image with background.
2. **Sideways card pixels:** the actual card/text needs a 90° or 180° rotation.
3. **Incorrect orientation metadata or display:** the pixels are correct, but the model's orientation label or a UI assumption is wrong.

These need different fixes. Automatically rotating every wide image would damage legitimate horizontal cards and may rotate correctly oriented vertical cards sitting inside wide photos.

**Confirmed:** both camera guides default to portrait. Guide selection controls the crop rectangle; it does not establish the printed card's upright direction. The reviewed preview controls offer acceptance/retake, without a dedicated rotate-captured-image step. The normal web portrait math does not inherently make landscape outputs: an offline 390×844 viewport / 3840×2160 stream probe produced a **1065×1491 portrait crop**.

**Confirmed fallback risk:** if web guide cropping throws, `MobileCamera` accepts the complete capture frame. A landscape sensor frame can therefore become a landscape upload even though the user framed a portrait guide. This is a concrete path, not proof of how frequently it explains customer submissions. [Fallback](C:/Users/benja/card-grading-app/src/components/camera/MobileCamera.tsx:160).

**Confirmed geometry defect:** native guide sizing floors width at 60% of the viewport even if the height constraint requires less. A synthetic 800×350 measured container with portrait selected produces a 480×672 guide, taller than the container. Whether this container occurs in deployed layouts requires device verification, but the helper violates its own fit guarantee. [Guide sizing](C:/Users/benja/card-grading-app/dcm-mobile/lib/imageUtils.ts:192).

**Device-dependent risk:** web still-to-preview mapping assumes identical axis orientation and a centered, uniformly scaled field of view. It does not independently verify sensor orientation, lens switching or stabilization/crop differences. Native mapping also assumes a particular preview/photo relationship. Bounds checks cannot prove that the same card area was captured. [Still mapping](C:/Users/benja/card-grading-app/src/hooks/useCamera.ts:245), [native mapping](C:/Users/benja/card-grading-app/dcm-mobile/lib/imageUtils.ts:285).

**Pipeline inconsistency:** thumbnails explicitly apply EXIF rotation; the shared original loader returns raw downloaded buffers and the zoom extraction path uses their dimensions/pixels without that same normalization step. Normal camera uploads generally bake orientation into pixels, but the processing contract should cover every ingest path, including integrations. This is a risk to test with EXIF fixtures, not a demonstrated production rotation rate. [Original loader](C:/Users/benja/card-grading-app/src/lib/images/originalImages.ts:25), [zoom crops](C:/Users/benja/card-grading-app/src/lib/zoomInspection.ts:563).

### Recommended capture changes

**First release:**

- Add 90° left/right rotation in front and back preview, with an upright-text instruction. Save rotation independently for each face. Persist the transform so overlays and later crops agree.
- Keep portrait as the default, with an explicit, clearly labeled horizontal-card option. Remembering device rotation must not silently change the selected card layout.
- Remove the native guide's minimum-width override when it violates available height. Test phone/tablet, landscape device, short viewport and safe-area layouts.
- Snapshot preview dimensions, guide geometry, sensor dimensions and orientation at shutter time. Avoid mixing a pre-shutter stream size with a post-capture viewport after device rotation.
- Record crop fallback as a distinct state. Show its full-frame preview clearly and offer crop adjustment/retake; do not imply the accepted file necessarily matches the guide.
- Normalize EXIF once at server ingest. Preserve uploaded source plus an immutable normalized derivative and transform metadata. Every inspection, thumbnail and overlay should reference the same coordinate convention.

**Quality improvements:**

- Measure card area, not just image size. A large image with a small card can pass the current 1000px long-edge gate. Track card short-edge pixels, minimum corner detail and whether all four physical edges are visible.
- Score blur and exposure within the card region, with corner/edge checks. Whole-image Laplacian variance can be boosted by textured backgrounds and detailed print; mean luminance can miss localized glare and penalize naturally dark artwork.
- Add glare masks and clipping/saturation measures. Request a retake when the identity strip, surface region or corner is obscured. Do not convert photographic obstruction into a physical defect.
- Treat a failed quality check as **unknown**, not measured sharpness. Native blur currently fails open; retain capture availability but represent that state honestly.
- Use a short stability window or choose the sharpest of a small burst where supported. Current fixed shutter delays are not evidence that focus settled. Capability-test lens/focus behavior on real devices.
- Offer optional oblique photos for foil treatment, suspected creases and surface marks after the standard straight-on front/back pair. Label their purpose and angle. A second view should resolve specific ambiguity, not add a mandatory burden to every submission.
- Preserve high-quality source material; avoid synthetic sharpening, generative enhancement or denoising that invents/removes defect evidence. Use perspective correction only with retained originals and explicit transforms, preferably for identification and centering rather than replacing condition evidence.

The current web quality UI permits **Use Anyway**. Native blur is advisory. The upload resolution gate and bulk preflight do not establish that fine surface detail is inspectable. Add a shared server preflight before expensive grading and before credit consumption is finalized, using the existing upload/retry accounting model. Distinguish usable, limited and retake-required outcomes. Calibrate thresholds on manually labeled device captures before hard enforcement. [Web preview override](C:/Users/benja/card-grading-app/src/components/camera/ImagePreview.tsx:111), [upload gate](C:/Users/benja/card-grading-app/src/app/upload/page.tsx:364), [quality calibration limitations](C:/Users/benja/card-grading-app/src/utils/imageQuality.ts:65).

### How to establish the actual horizontal root cause

Collect a representative recent sample with source channel, client/build version, device/browser, original and normalized dimensions, EXIF orientation, capture method, guide orientation, viewport, crop result/fallback and user rotation. Manually classify each into the three failure types above. Compare card geometry/text orientation with displayed orientation. Reproduce the highest-volume failing combinations on devices. This should precede any blanket automatic rotation or customer-image backfill.

## 2. Identification: why errors survive

### Dedicated identification exists, but is narrow

`identifyCardFromImages` uses a short separate Luna call, both faces when available, display thumbnails created at 480px width and `detail: low`. This is useful for large printed names, but not a robust basis for tiny collector codes, copyrights, edition marks or finish. Luna's low-detail preprocessing can reduce the image further to fit 512×512.

The reconciliation layer primarily checks name and number. It deliberately does not overwrite disputed numbers and does not resolve year, set, language or variant from the independent result. A successful independent name read therefore does not mean the exact card printing has been verified. On failure, the grader's identity continues with reduced confidence where reconciliation runs. [Identification call](C:/Users/benja/card-grading-app/src/lib/identification/identifyCard.ts:126), [reconciliation](C:/Users/benja/card-grading-app/src/lib/identification/reconcile.ts:169).

**Offline reproductions in current code:**

- Reconciliation says **Mew and Mewtwo agree**, due to substring matching.
- Different Japanese names normalize to empty strings and are treated as agreement.
- A medium-confidence independent result with no usable name/number can leave an unstated grading confidence promoted to **high**.
- The separate catalog name helper treats **Mega Charizard X EX and Mega Charizard Y EX** as the same species. That may support family retrieval, but cannot establish exact identity.

Fix comparison semantics: `agreement`, `conflict`, and `unknown` must be distinct. Preserve Unicode. Use category-specific full-name components, forms/subtitles and player suffixes when they distinguish people. Do not promote exact-printing confidence from coarse name agreement or absent evidence.

### Category-specific review

| Category | Existing foundation | Priority correction |
|---|---|---|
| Sports | Independent name read, checklist/year corroboration, local set/parallel matching and pricing integration | Read name/number/year evidence at adequate resolution; separate copyright, season and issue year. Checklist surname agreement is too permissive for exact identity. Parallel needs product-family and serial/finish evidence, not just a color word. |
| Pokémon | English/Japanese databases, denominator filters, verification service and specialized fields | Consolidate competing lookup paths. The inline path sorts newest first and selects a plausible result without proving uniqueness. Preserve forms, language, denominator, promo/edition, holo/reverse and set symbols. |
| MTG | Set/collector lookup and visual printing disambiguation | Medium visual selections can become `validationTier='exact'`; five-character prefix guards are weak. Visual comparison samples at most eight printings, potentially excluding the actual printing. Separate card/oracle identity, printing, language and finish. |
| Lorcana | Set/collector parsing and full-name catalog enrichment | Non-low confidence can become exact; the five-character guard cannot distinguish many subtitles. Resolve character + subtitle + collector/set + language + foil/enchanted treatment. |
| One Piece | Printed codes, family records and per-variant prices | Variant token-overlap selection does not reject equal-scoring candidates. Preserve family status until art/parallel variant is uniquely supported. |
| Yu-Gi-Oh! | Set-code lookup, name checks and recovery from misread codes | Printing lookup takes `.limit(1)` for a set code, without edition/language/rarity constraints. A matching code can still leave printing details unresolved. Keep passcode separate from set code. |
| Star Wars | Catalog family/variant lookup | Separate Topps entertainment products from Star Wars Unlimited before condition or identity assumptions. Use exact product-family adapters and inspect variant ties; do not treat the entire category as one TCG. |
| Other | Generic extraction plus Naruto and supported TCG adapters | Require a recognized subcategory for catalog-verified status. Unknown/unsupported products remain visual-only. Use actual construction/shape instead of assuming every non-sports card has rounded TCG corners. |

Current code references: [Pokémon selection](C:/Users/benja/card-grading-app/src/app/api/pokemon/[id]/route.ts:1223), [MTG acceptance](C:/Users/benja/card-grading-app/src/app/api/mtg/[id]/route.ts:995), [Lorcana acceptance](C:/Users/benja/card-grading-app/src/app/api/lorcana/[id]/route.ts:952), [One Piece ties](C:/Users/benja/card-grading-app/src/lib/onepieceCardMatcher.ts:463), [Yu-Gi-Oh! printing query](C:/Users/benja/card-grading-app/src/lib/yugiohCardMatcher.ts:116), [sports name agreement](C:/Users/benja/card-grading-app/src/lib/identification/sportsChecklist.ts:100).

### Proposed identification architecture

1. Normalize front/back and determine coarse category, product construction and readable orientation.
2. Run focused Luna transcription on native-resolution identity regions plus whole-card context. Keep raw text, side/region and uncertainty separate from inferred fields.
3. Parse category-specific identifiers deterministically. Keep card number, set denominator and physical-copy serial denominator separate.
4. Retrieve a candidate set using multiple observed identifiers. A catalog match verifies a candidate only if the observed constraints distinguish it from alternatives. Missing catalog coverage is not evidence of uniqueness.
5. Compare plausible candidates using discriminating features: artwork, set mark, subtitle, rarity, foil pattern or edition. Preserve an explicit none-of-these outcome. Escalate to targeted crops or owner review when evidence is insufficient.
6. Store a typed, versioned identity with per-field provenance and separate confidence for family, exact printing and physical-copy attributes.
7. Give grading only relevant construction/layout information. Keep price, desirability and desired grade out of its condition decision. Resolve pricing from the final identity revision.

Use Luna throughout this plan. A model upgrade is not a prerequisite. Structured JSON improves contract reliability but cannot prove the model read the photograph correctly.

The sports year guard currently can replace a conflicting copyright year with last-stat-year + 1. Keep the observed copyright and proposed issue year as different fields; a stat-table heuristic should create an inference or conflict, not rewrite observed text as proven fact. [Year heuristic](C:/Users/benja/card-grading-app/src/lib/yearGuard.ts:130).

## 3. Owner confirmation and correct pricing

### Build this even if AI identification improves

The proposed post-grade workflow is appropriate. On the owner's first visit after a completed grade, show a focused **Confirm your card details** sheet. It should be associated with the server-side identity revision, not browser-local storage alone.

Suggested flow:

1. Grade result is available; open one confirmation sheet after page data has settled, avoiding competition with congratulations/offers/review modals.
2. Show zoomable front/back images, card name, set, year, number, category/language and printing details. Highlight uncertain/conflicting fields.
3. Offer **Looks correct**, **Edit details**, **Not sure / Review later**. A postponed review leaves a visible unresolved badge; do not repeatedly interrupt every visit.
4. Offer catalog candidates with distinguishing details and reference artwork. Allow **None of these** and manual entry. Separate parallel/finish from subset/insert, and physical serial number from collector number.
5. Show the selected pricing product and why it matches. Confirming identity and confirming a pricing product are separate recorded decisions, even when presented in the same sheet.
6. Save once, update labels/details/report views, then load pricing for the saved identity revision. Successful identity saving must not be undone by a pricing outage.

The existing [EditCardDetailsModal](C:/Users/benja/card-grading-app/src/components/cards/EditCardDetailsModal.tsx:115), [edit endpoint](C:/Users/benja/card-grading-app/src/app/api/cards/[id]/details/route.ts:280), [web variation picker](C:/Users/benja/card-grading-app/src/components/pricing/PriceChartingLookup.tsx:611) and [native ParallelPicker](C:/Users/benja/card-grading-app/dcm-mobile/components/ParallelPicker.tsx) are reusable foundations. This is not a greenfield editing feature. The existing admin details-review path remains useful for disputes but should not be required for ordinary owner corrections.

### Fix the save contract before adding the popup

**Confirmed identity mismatch:** the owner endpoint maps edited `card_number` to JSON `card_number_raw`, while the prior JSON `card_number` can survive unchanged. Top-level number, raw number and consumers of the canonical number can therefore disagree. The endpoint does not synchronize the report's `card_info` the way the admin correction helper does. [Mapping](C:/Users/benja/card-grading-app/src/app/api/cards/[id]/details/route.ts:206).

**Confirmed pricing gap:** owner details edits do not invalidate cached prices or the separately saved `dcm_selected_product_id`. Pricing prefers the saved product ID. Editing a wrong year/name/parallel can therefore retain a price for the previous selection. The pricing effect dependencies also omit `parallel_type` and `card_number`; relying on a rerender/refetch alone is insufficient. [Selection priority](C:/Users/benja/card-grading-app/src/components/pricing/PriceChartingLookup.tsx:192), [effect dependencies](C:/Users/benja/card-grading-app/src/components/pricing/PriceChartingLookup.tsx:643).

**Admin path gap:** `refreshPricesAfterDetails` refreshes DCM pricing only for sports and preserves prior eBay comps when no new result is found. After an identity change those comps can describe the wrong card. Retain historical snapshots, but stop displaying them as current valuation. [Admin pricing refresh](C:/Users/benja/card-grading-app/src/lib/gradeReview/detailsPricing.ts:11).

Implement one identity-update service used by owner confirmation, editing and admin corrections:

- Strict typed allowlist; ownership and existing sold/locked-record protections; optimistic revision checks.
- Atomic update of canonical identity, applicable legacy projections, confirmation record and audit history. Preserve original AI observations rather than overwriting the audit trail.
- Explicit rules for labels/custom labels and report display. The original grading run remains historical; current identity overlays must be versioned and consistent.
- Invalidate incompatible catalog IDs, selected price products, cached DCM/eBay values and search keys in the same transaction. Preserve historical prices tied to their old identity revision.
- Queue repricing with an identity revision/idempotency key. Apply an arriving price only if that revision still matches. An old in-flight request must not restore stale pricing after a correction.
- Store `identity_status`, `identity_revision`, confirmed-by/at, changed fields and field sources; store price provider/product ID, selection source, identity revision and last-fetched time separately. These are proposed fields, not claims about the current schema.
- Retain current regrade identity protection. A condition regrade must preserve an owner-confirmed identity; explicit reidentification creates a proposed new revision.

**Pricing promise:** confirming an exact catalog product can improve product-match correctness. It cannot guarantee a current market price exists or that a modeled DCM value equals a sale price. Show provider/product, freshness and whether the value is raw, a third-party grade observation, or a DCM-derived estimate. If the exact variant is unavailable, display unavailable or clearly labeled family-level context; do not silently substitute a base-card price.

For native, web, bulk submissions and returning owners, use the same server state. Owner edits must not let users change the AI condition grade. Changes to construction-relevant fields (e.g. category or a mistaken autograph/foil designation) can flag the condition assessment for a targeted reevaluation rather than silently rewriting it.

## 4. Grading pipeline findings

### Priority 0: incomplete analysis is being represented as completed analysis

**G1. Missing zoom regions count as clean.** The zoom parser logs omitted IDs and treats them as clean. Even an empty object can enter the parsed sample list through the legacy fallback. The return reports `ok: true` and `regionsInspected: regions.length`, which is the number generated, not confirmed reviewed. A model omission can therefore suppress a defect and still contribute to an apparently successful inspection. Require every expected region exactly once with a valid verdict; preserve missing/invalid as unknown, retry affected batches, and report actual coverage. [Parser](C:/Users/benja/card-grading-app/src/lib/zoomInspection.ts:947).

**G2. Missing ensemble evaluations are padded with copies.** If fewer than three usable completions survive, `passSrc` repeats the base to fill three rows. One surviving result can look like three agreeing results, affecting spread and Gem gates. Keep actual count and raw samples; require a genuine quorum or explicitly label reduced coverage. [Padding](C:/Users/benja/card-grading-app/src/lib/visionGrader.ts:2283).

**G3. Geometry failure re-enables blind crops.** A gate exception continues with image-edge crops; null fill values are treated as 100 for the threshold check. On a margin-heavy image this can inspect background. Geometry's Luna completion ceiling is only 400 tokens, while the separate identifier documents empty Luna outputs at that budget. Increase/calibrate the budget and validate quads/fill, but also change fallback policy: unknown geometry is unknown coverage, not permission to inspect arbitrary image edges. [Gate config](C:/Users/benja/card-grading-app/src/lib/zoomInspection.ts:698), [fallback](C:/Users/benja/card-grading-app/src/lib/zoomInspection.ts:833).

**G4. Structural verification errors can preserve confirmation.** The verifier returns `confirmed: true` for fetch, parsing and request failures so the cap can stand. The final pipeline may then apply a grade-4 ceiling to an unverified claim. Existing corroboration mitigates some cases; it does not turn service failure into visible evidence. Return a tri-state verdict and retain the earlier evidence separately. Retry or mark review-required when a consequential claim remains unresolved. [Verifier](C:/Users/benja/card-grading-app/src/lib/zoomInspection.ts:160).

### Priority 1: scoring, evidence and location contracts disagree

**G5. No enforced full output schema at the main boundary.** The prompt says `json_schema`, but the call uses `json_object`. Parsing plus usable-number selection does not validate every required field, enum, finite range or cross-field relationship. Add runtime schemas and reject/troubleshoot incomplete results before aggregation. Prefer strict structured output where supported, with a versioned schema. [Request](C:/Users/benja/card-grading-app/src/lib/visionGrader.ts:2018).

**G6. Zoom uses different scoring rules.** A global minor/moderate/heavy mapping (9/8/6) plus spread rules does not match all detailed master/category ladders. Example: One Piece's worked examples give two minor corner/edge locations an 8; the zoom cap leaves all-minor findings at 9 regardless of spread. Depending on which stage detects the same wear, the grade can differ. Use one category-aware deterministic scoring policy driven by defect extent/visibility, and explicitly calibrate the existing false-positive tradeoff before removing it. [Zoom caps](C:/Users/benja/card-grading-app/src/lib/zoomInspection.ts:317), [minor-only exception](C:/Users/benja/card-grading-app/src/lib/zoomInspection.ts:1157), [One Piece examples](C:/Users/benja/card-grading-app/prompts/onepiece_delta_v5.txt:430).

**G7. Structural backstop only guarantees 4.** Server `STRUCT_CAP=4` does not independently enforce all lower rubric ceilings for tears, multiple heavy creases or missing material. The model may already return a lower grade, but a missed lower score is not corrected by this backstop. Encode the agreed structural severity table once and test every class. [Backstop](C:/Users/benja/card-grading-app/src/lib/visionGrader.ts:2996).

**G8. Back-face coordinate conventions differ.** The master requires back labels mapped to the front's physical corner identities. Zoom uses image-relative top-left/top-right labels; structural verification then mirrors locations. Rotated backs and alternative flip directions further break the fixed assumption. Store face-local coordinates and transforms; derive physical correspondences only when registration is known. Crops, overlays, written location and opposite-face verification must share this contract. [Master mirror rule](C:/Users/benja/card-grading-app/prompts/master_grading_rubric_v5.txt:260), [zoom region labels](C:/Users/benja/card-grading-app/src/lib/zoomInspection.ts:591), [opposite-face crops](C:/Users/benja/card-grading-app/src/lib/zoomInspection.ts:217).

**G9. Construction assumptions are too broad.** `hasFactoryRoundedCorners` treats every category except sports as rounded; the Star Wars label is always Star Wars Unlimited. Topps Star Wars and arbitrary Other products should not inherit that blanket rule. Conversely, some sports products are die-cut or rounded. Use observed/catalog-supported construction, not the top-level category alone. [Construction shortcut](C:/Users/benja/card-grading-app/src/lib/zoomInspection.ts:747).

**G10. Voting needs per-region denominators and fault isolation.** Samples from all batches are flattened; thresholds are not based on the valid sample count for each region's batch. One empty/unparseable batch can effectively pass without evidence if others succeed. `Promise.all` also discards the overall zoom result if one batch request rejects. Preserve successful batches, retry failures, require per-region quorum and deduplicate overlapping evidence by physical location, not only region name.

**G11. Raw evidence and displayed consensus are mixed.** Caps are folded into the displayed pass rows and variance is recalculated afterward. That improves arithmetic consistency but can hide original disagreement if those rows are used for evaluation. Store immutable raw runs separately from post-policy display scores and rule traces. A displayed repeated/capped score must never be used as an independent correctness label. [Pass folding](C:/Users/benja/card-grading-app/src/lib/visionGrader.ts:3136).

**G12. Unknown visibility and absence of defects need separate outcomes.** Evidence reconciliation can raise unsupported deductions to 9 after zoom reports no defects. This is reasonable only with validated coverage. Current missing-region behavior undermines that premise. A lack of recorded findings must not count as evidence of clean material when the region was obscured, omitted or never inspected.

## 5. Master prompt and all category deltas

### Size and duplication

Measured current master: **293,000 JavaScript characters, 5,614 lines**, approximately **73,250 tokens using the loader's chars/4 heuristic**. Category deltas add approximately 3,389–10,664 tokens, before the wrapper, images and user context. These are estimates, not tokenizer measurements. The combined instruction burden is roughly 77K–84K estimated tokens. The loader's old 18K–20K master comment is stale.

| Delta | Lines | Approximate tokens (chars/4) |
|---|---:|---:|
| Sports | 738 | 10,664 |
| Pokémon | 648 | 8,063 |
| MTG | 473 | 5,514 |
| Lorcana | 319 | 3,389 |
| One Piece | 475 | 4,939 |
| Yu-Gi-Oh! | 454 | 5,449 |
| Star Wars | 328 | 3,758 |
| Other | 307 | 3,543 |

This makes prioritization difficult, but size alone is not proof of lower accuracy. More importantly, instructions and examples conflict.

### Concrete inconsistencies and hallucination pressure

| Finding | Evidence and consequence | Change |
|---|---|---|
| Borderless rule drift | MTG delta line 442 still says centering maximum 9. Current master/R0 and Pokémon example allow unmeasurable borderless designs to receive 10. | Generate all category examples from the same current policy. |
| Curling versus structural damage | MTG lines 348–351 permit light foil curl without structural damage; master lists warped/curved/bowed cards under cap 4; appended request says a non-flat card is never 8+. | Define harmless manufacturing curl versus damaged stock explicitly in one rule. |
| Conflicting structural summaries | Quick table says missing piece cap 2 and heavy/multiple crease cap 3; detailed Section 1.11 includes missing-piece cap 3 and multiple-heavy-crease cap 2. | Resolve business policy, encode it once and generate prompt references. |
| Blur policy versus runtime grade hold | Master says blur only changes uncertainty, never scores. Server uncertainty/holder gates can hold 10 at 9. | Separate observed condition from evidence sufficiency; document the chosen product policy consistently. |
| Scores-first versus output order | Flow tells the model to decide scores first, yet output order puts long narratives before `raw_sub_scores`; Section 1.5 also describes inspect/write sections before derived score fields. | Use one explicit evidence-to-score sequence and a compact structured record. |
| Forced novelty | Every corner/edge must use unique wording, even if the observations are identical. | Permit identical factual clean descriptions; require specificity only when evidence differs. |
| Imaginary actions | Pokémon and One Piece examples say the card was tilted or viewed at different lighting angles, although only static photos may be supplied. | Say what is visible in the supplied views; never imply physical handling or unseen angles. |
| Quantitative precision without measurement | Worked examples and evidence format encourage millimeter sizes and visual border measurements. | Use pixel/relative extent where justified, with uncertainty; physical dimensions require known geometry. |
| Competing defect priors | "Most cards" show wear, vintage 10s are rare, inspect for defects first, but no speculative deductions. | Keep systematic scanning; remove population grade-rate targets from individual decisions. |
| Alteration uncertainty conflicts | Broad alteration instructions default uncertainty to flagging, while later handwriting instructions default uncertainty to normal grading. | Use explicit evidence thresholds by alteration type and a separate unknown state. |
| Overbroad exemptions | Yu-Gi-Oh! zoom text says never report a defect at the security seal; autograph text excludes pen indentation/smudging categorically. | Exempt expected features, but preserve detection of actual damage to or around them under an explicit policy. |

Sources: [master rules and flow](C:/Users/benja/card-grading-app/prompts/master_grading_rubric_v5.txt:8), [master damage table](C:/Users/benja/card-grading-app/prompts/master_grading_rubric_v5.txt:1126), [MTG curl](C:/Users/benja/card-grading-app/prompts/mtg_delta_v5.txt:348), [MTG borderless cap](C:/Users/benja/card-grading-app/prompts/mtg_delta_v5.txt:442), [Pokémon example](C:/Users/benja/card-grading-app/prompts/pokemon_delta_v5.txt:637), [One Piece example](C:/Users/benja/card-grading-app/prompts/onepiece_delta_v5.txt:419), [appended request](C:/Users/benja/card-grading-app/src/lib/visionGrader.ts:1984).

### Rewrite strategy

Maintain four distinct contracts: capture sufficiency; identity/construction; observable defects; deterministic scoring. Generate user-facing prose from the accepted evidence and final policy trace. Category deltas should contain distinguishing construction/design features and false-positive examples, not duplicate universal scoring math, large product-year lists and verbose narratives.

Do this in small ablations: first contradictory rules, then identity/game-stat extraction, then redundant examples, then narrative format. Retain known false-positive counterexamples. The current source explicitly records a prior corners/edges prose reduction that regressed a vintage-texture control and was rolled back. A shorter prompt is a candidate to measure, not automatically a safer grader. [Prior regression note](C:/Users/benja/card-grading-app/src/lib/visionGrader.ts:78).

## 6. Luna-specific operating plan

The router defaults both baseline and canary to **gpt-5.6-luna**, applies `reasoning_effort: low` unless overridden, removes temperature/top_p for the configured Luna family, and defaults grading images to `high`. The dedicated identifier independently defaults to Luna. Actual production environment overrides were not inspected. Log resolved settings per operation; comments about historical GPT-4/GPT-5.1 behavior are not the current runtime contract. [Model router](C:/Users/benja/card-grading-app/src/lib/grading/modelRouter.ts:53), [detail configuration](C:/Users/benja/card-grading-app/src/lib/grading/imageDetail.ts:34).

Official documentation lists Luna as a cost-sensitive model supporting configurable reasoning. Its vision sizing distinguishes low (512×512 bounds), high (2048×2048 and 2,500 patches), and original (preserved dimensions subject to documented limits). Small text, rotation and precise localization remain known challenges. Therefore the old 768px-short-side rationale for some crops must not be assumed to describe Luna. [Luna model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [vision sizing and limitations](https://developers.openai.com/api/docs/guides/images-vision).

Recommended experiments, retaining Luna:

- Compare `high` versus explicit `original` for normalized whole-card images; keep exact submitted dimensions and token usage in the run manifest.
- Compare 480px/low identification with focused high-resolution text regions and whole-card context.
- Compare low versus medium reasoning **by stage**, with suitable output budgets. Test higher effort selectively for unresolved printing/structural cases only if medium establishes value.
- Increase geometry's budget and validate completion finish reasons, refusal, truncation, schema and coverage. Do not assume a small visible JSON answer needs only a small reasoning-model completion allowance.
- Treat repeated Luna samples as correlated evidence. Their agreement measures consistency, not independent physical truth. A new angle, catalog constraint or human reference adds different evidence; another sample of the same prompt may repeat the same mistake.
- Version model, resolved reasoning/detail, prompt hash, schema, scoring policy, image hash/transforms, catalog revision and valid sample counts together.

Changing `GRADING_IMAGE_DETAIL` affects multiple inspection stages; isolate experimental stage overrides before comparing it. Do not simultaneously change model, prompt, image preprocessing, crop layout and voting thresholds.

## 7. Evaluation and viability

### Existing studies do not establish readiness

The saved v10.2.3 comparison completed 66 paired runs across **11 physical cards**. Its report explicitly says the release gate was not passed and independent references/held-out validation remained pending. The candidate issued only 2 exact grades in 33 candidate runs, versus 33/33 baseline runs. This shows why simply withholding more grades is not a viable accuracy strategy. Repeated runs are not additional independent cards, and this cohort covers only sports, Pokémon and One Piece. [Saved study](C:/Users/benja/card-grading-app/grading-work/accuracy-study-2026-09-06/RESULTS.md).

The identification calibration file also labels many stored identities **unverified**. Do not train or score against those as ground truth. [Calibration labels](C:/Users/benja/card-grading-app/docs/identification-benchmark-calibration.json).

### Reference set and measurements

Proposed starting cohort: **400–800 independently verified cards across all eight categories**, with at least 50 per category and extra coverage for high-volume/ambiguous products. Enrich with known failures: rotated fronts/backs, EXIF variants, genuine horizontal cards, vintage texture, white-on-white wear, factory radii, metallic glare, security seals, real creases, minor curl, reprints, Japanese text and near-identical parallels. Maintain an additional untouched holdout. This is an initial engineering sample, not sufficient to claim very low rare-error rates.

Identity labels require catalog-supported exact printing and human checking. Physical condition labels should include independent expert review of the physical card where feasible, with disagreement adjudication and supporting views. A slab grade alone is not a complete map of visible defects; photo-only references cannot establish invisible damage.

Measure separately:

- Capture: actual sideways rate, guide mismatch, clipped edges, card pixel coverage, blur/glare usability, retake rate and completion by device/channel.
- Identity: field accuracy, exact-printing accuracy, wrong high-confidence match rate, candidate recall, unresolved rate and owner correction/confirmation burden.
- Grading: defect precision/recall by type/category, severe false structural caps, missed structural damage, exact/within-one agreement, repeated-run variation and uncertainty calibration.
- Operations: usable-grade coverage, review/retake frequency, p50/p95 latency, API/reasoning tokens, cost per successfully completed card, support contacts and refunds.
- Pricing: wrong-product rate, stale identity-linked prices, exact-product coverage, unavailable prices and refresh latency.

### Proposed release gates

Deterministic correctness gates should be absolute in tests: missing region is never clean; missing pass is never duplicated as independent evidence; stale pricing cannot attach to a newer identity; owner corrections cannot alter condition grades; all known coordinate transforms round-trip; every published score traces to an agreed policy and valid evidence.

For empirical rollout, preregister tolerances from the measured baseline. Proposed starting requirements: no regression on adjudicated severe-damage controls; lower wrong-exact-identity rate; no material increase in missed defects; at least 95% of baseline completion coverage; p95 latency no more than 20% above baseline and mean cost per completed card no more than 25% above baseline unless the measured quality benefit justifies it. These are proposed business gates, not existing performance or guaranteed achievable numbers.

Keep capture, identification and condition changes separately flagged. Run shadow comparisons first; stage rollout only after holdout review; monitor by category/device/model-settings cohort and retain immediate rollback. Never target a predetermined percentage of 10s as the primary correctness measure.

## 8. Implementation order

Effort below is a planning estimate for one experienced engineer with reviewer/QA support. Device procurement, expert labeling, native release review and production access can extend calendar time.

| Phase | Work | Deliverable / exit criterion | Estimated effort |
|---|---|---|---:|
| 0 | Verify deployed versions/settings, instrument orientation and run manifest, freeze failure fixtures | Attributable baseline and classified horizontal sample | 2–3 days |
| 1 | Fix missing-region/pass handling, tri-state verifier failures, per-batch coverage and geometry fallback | No fabricated completeness; fault-injection tests pass | 4–6 days |
| 2 | Unified identity save, price invalidation/versioning, owner confirmation sheet and reusable candidate picker | Confirm/edit works on all categories and web/native; stale-price races tested | 6–10 days |
| 3 | Preview rotation, native guide fit, normalized ingest, better capture telemetry/preflight | Device matrix passes; retake/coverage tradeoff measured | 5–8 days |
| 4 | Unicode/category comparisons, exact-tier gates, candidate ties, high-resolution Luna identification | Lower wrong-exact rate on verified holdout | 5–8 days |
| 5 | Shared scoring tables, coordinate contract, prompt contradiction cleanup and controlled simplification | Agreed rubric, evidence trace and accuracy/viability gates pass | 8–15 days |

Approximately **30–50 engineering days** if performed sequentially, with useful releases after the early phases. Reference labeling should begin in phase 0 and continue alongside implementation. This is not a commitment to deploy a replacement engine at the end of a fixed calendar window.

**First practical milestone:** owners can confirm/correct the actual printing and price product; capture previews can be rotated; the grader no longer calls missing analysis clean or repeats missing evaluations as independent passes. That delivers clearer results and prevents concrete failure modes while the larger accuracy study runs.
