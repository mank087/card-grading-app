# Web review handoff, 2026-09-15

Seven commits sit on `master` ahead of `origin/master`. Review them in the order below; each builds on the previous one. Everything typechecks (`npx tsc --noEmit -p .`) and the label and grading test suites pass (`npx vitest run src/lib/labels src/lib/labelLab src/lib/grading`, 190 tests). Nothing here has been deployed.

A second group, already live since 2026-09-14, is listed at the end for context.

## Change order 1: Navigation link (7a6a2009)

**Files**: `src/app/ui/Navigation.tsx` (+2)

Adds "Affiliates" under "Enterprise" in the Resources menu, in both the guest and member lists, which also feed the mobile menu.

**Review**: confirm the menu order on desktop and in the mobile drawer. Zero risk.

## Change order 2: Traditional label rebuilt as the Classic design (0e475e8b)

The built-in `traditional` style is now a DCM classic grading-house label: purple frame, white field, four-line all-caps card block on the left, right column with card number, condition, large grade and serial, DCM mark bottom centre straddling the frame. Back carries only the mark, serial with verify URL, and a QR on a white plate. Mockups: `docs/mockups/traditional-classic-*.png`.

**New modules (read these first)**
- `src/lib/labelLab/classicLayout.ts` (+527) with tests (+352). Geometry in a 1400x400 design space and the text fitting rules: the right column claims its width first; the left block shrinks uniformly from 52 to a floor of 34 then truncates with an ellipsis; non-empty lines pack upward; only the fourth baseline is capped by the logo plate. No DOM or react-pdf imports, so the mobile app ports it verbatim.
- `src/lib/labelLab/classicSlabPdfDoc.tsx` (+311): react-pdf `ClassicFront` / `ClassicBack` blocks with a `bare` prop.
- `src/components/labels/ClassicLabelPreview.tsx` (+306): the single SVG preview every web surface uses.
- `src/lib/labels/classicRaster.ts` (+148): browser rasteriser for the eBay composite and the raster fallback.

**Wired surfaces**
- `src/lib/labels/vectorSlabGenerator.tsx` (+425): `style === 'traditional'` branch in all four public generators (single duplex, batch duplex, fold-over single, fold-over batch), Zion size through a bare scaled panel. Note the react-pdf quirk: a `scale()` transform applies its Y factor twice to the transformed node's own background and border, so the frame is drawn unscaled outside the transform and the panel renders bare inside it. Same fix shipped for Heritage on 2026-09-14.
- `src/lib/slabLabelGenerator.ts` (+49): raster fallback delegates to the classic renderer so no path can print the old design.
- `src/lib/cardImageGenerator.ts` (+54): eBay listing composite draws the classic front.
- Seven card pages `src/app/<type>/[id]/CardDetailClient.tsx` (+29 each): `isClassicSelection` branch renders the preview; the old light block stays as the fall-through for custom slots.
- `src/components/CardSlab.tsx` (-393 net): collection slab grid uses the preview; dead local label components removed.
- Label wizard (`src/components/labelWizard/*`), `LabelMockup.tsx`, `LabelStyleDropdown.tsx`, `label-preview/[cardId]/page.tsx` (mobile-web bridge), `labelPresets.ts` copy, `src/app/account/page.tsx` swatch.
- `src/lib/labels/labelStyleResolution.ts` (+24): `isClassicSelection(labelStyle, activeConfig)`. Heritage wins first, any config-backed selection is never Classic, then the built-in id.

**Deliberately unchanged**: Modern; Heritage (byte-identical, `npx tsx scripts/label-design-snapshot.ts check`); saved custom slots built on the old light design, everywhere including print.

**Review focus**
1. `isClassicSelection` gating on every surface: a customer's custom slot must not flip.
2. `vectorSlabGenerator.tsx` Zion branch: the bare-panel structure, not a scaled node with its own border.
3. Long text: the sweep proofs are described in the commit; regenerate with `npx tsx scripts/_tmp-classic-proof.ts` if you want to eyeball the PDFs.
4. `StepConfirm` now sends `labelStyle="traditional"` with `configOverride: null` for a pristine built-in Traditional, so print matches preview.

**Known follow-ups**: line one reads "1999 BASE SET" rather than "1999 POKEMON BASE SET" because the label data carries no category word; `standardStyleNeedsTextHalo('traditional')` still evaluates the old preset spec (harmless, worth pinning).

## Change order 3: Grading v9.25, centering consensus explains itself (871c3ecb)

**Trigger**: customer serial 676561. Three passes scored centering 10, consensus row 9, no note. A scan of the 240 most recent cards found 53 with that shape, 46 involving a non-standard design face.

**Cause**: the face-level clamp after the median (`visionGrader.ts`, "Enforce the rubric's weakest-link invariant at the FACE level") lowered the category to the detailed front score and logged to console only. The rubric still capped foil-frame, asymmetric, borderless and die-cut faces at centering 9, contradicting the v9.22 rule.

**Files**
- `prompts/master_grading_rubric_v5.txt` (4 bullets), `prompts/sports_delta_v5.txt`, `prompts/pokemon_delta_v5.txt`: the max-9 rule removed; the Pokemon worked example now scores a full-art card 10 with XX/XX ratios.
- `src/lib/grading/centeringPolicy.ts` (+33) and test: new `foil_frame` layout joins R0 (raised to centred when no ratio is stated) but stays out of the measurable set.
- `src/lib/grading/consensusExplain.ts` (+177, new) and test: pure note builders and the "already explained" exclusion.
- `src/lib/visionGrader.ts` (+167): `DCM_PROMPT_VERSION` bumped to v9.25; raw per-pass category scores captured before mutation; Step 3.5 records clamps; after all gates, an unexplained clamp is folded into the displayed pass rows and one consensus note quotes the face assessment; the uncertainty and rigid-holder gates push a note when they drag subgrade tiles.
- `docs/CENTERING_CONSENSUS_FIX_2026-09-15.md`: write-up.

**Review focus**
1. `finalGrade` is not recomputed anywhere in the new code. Verify by reading the fold block.
2. Invariant: median of displayed pass values equals `serverRounded[cat]` after the fold.
3. The exclusion set in `isAlreadyExplained`: zoom cap, structural cap, dissent reflection, gate drag.
4. Prompt diffs are small; read them in full.

**After deploy**: re-run `scripts/_tmp-centering-mismatch-scan.ts` after a day of traffic; target zero unexplained all-10-passes-above-consensus cases. Watch the 10-rate, since the design cap removal moves some non-standard cards from 9 to 10 by intent.

## Change order 4 and 5: Other card page (83e6d8fc, 4fa6ed3e)

**Files**: `src/app/other/[id]/CardDetailClient.tsx`

The eighth card page was missed in change order 2 and had no classic branch. The first commit mirrors the change; the second moves the `useClassicQrDataUrl` hook above the component's early returns after React reported a hook-order change. All eight pages now call the hook directly after the style check.

**Review**: hook placement relative to `if (loading) return` on this page.

## Change order 6: Edit Card Label modal preview (65f62bbb)

**Files**: `src/components/EditCardLabelModal.tsx` (+114/-), the eight card pages (+4 each)

The modal drew a fixed dark Modern mockup regardless of style. It now accepts `labelStyle`, `activeConfig`, `heritageBandColors` and `colorOverrides` from the page and renders the same front-label component the card page uses (Heritage, Classic or Modern), redrawing live from the fields. Save and revert logic untouched.

**Review**: the context line is assembled as "Set • Subset • #Number • Year" to match `labelDataGenerator`; confirm the Heritage branch receives a band palette.

## Change order 7: Mobile parity, web side only (280de0d3)

**Web file**: `src/components/marketing/ZoomableImage.tsx` (+5). The lightbox overlay gains `data-dcm-keep="1"`, the opt-out the app's WebView chrome sweep now honours. The rest of the commit is under `dcm-mobile/` and is a separate review.

**Deploy note**: the app's label bridges, the partner API and this attribute are all web-side, so the web must deploy before any over-the-air app update.

## Already live since 2026-09-14 (context, not for re-review)

| Commit | Area |
|---|---|
| b9a00cc8, f5b08fa9, 9ad6c499 | Credits page JSON-LD: product images, return policy, digital shipping (Search Console merchant listings) |
| c8029981, 45bc6d30, ef20a641 | Pricing page reorder, package art strips, tap-to-expand, VIP and Card Lovers sheets |
| 07d3b57b | Migration: `user_credits.label_style` defaults to heritage (applied by hand) |
| dae88e79 | Heritage PDF Zion Mag Pro border fix (the react-pdf scale quirk) |
| a1b32548, c6948ff1, 19a0eac8 | Affiliate program on a credits model, application form, admin tab, partner card; migration 20260915 applied by hand |
| 9e051783 | Affiliates and Enterprise page redesigns with schema and accessibility fixes |
| 0223798c | gitignore for marketing render output |

## Verification commands

```
npx tsc --noEmit -p .
npx vitest run src/lib/labels src/lib/labelLab src/lib/grading
npx tsx scripts/label-design-snapshot.ts check
npx tsx scripts/_tmp-classic-proof.ts
```
