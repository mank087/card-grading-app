# Card detail V2 — Phase 2 preview / print parity

Date: 2026-09-21
Scope: the Phase 2 exit gate from `docs/PLAN_CARD_DETAIL_REDESIGN_2026-09-21.md`
(gap **G1**, "preview and generated file must agree on identity, grade, style,
serial, QR").

## How this was produced, and what it is not

**Everything below is CODE-VERIFIED, not OUTPUT-VERIFIED.** I cannot sign in to
this environment, so I could not generate a single real PDF and hold it next to
a screenshot. What I did instead was follow both code paths — the on-screen
renderer and the download generator — field by field, to the function that
produces the value, and record whether they read the same source.

That distinguishes two different claims, and the tables keep them apart:

- **same source** — preview and print demonstrably read the same function or
  the same object. A rendering difference is still possible (a font falls back,
  a fitter wraps differently); the *data* cannot differ.
- **DIFFERENT source** — the two paths read different things. These are the
  findings; three of them are real and all three are inherited from the legacy
  page, not introduced by Phase 2.

Nothing here is a claim about pixels.

---

## The two paths

### Preview (what Phase 2 puts on screen)

| Surface | Renderer | Data in |
| --- | --- | --- |
| Hero card + label piece | `src/components/card-detail/holders/CardLabelPiece.tsx` → `LabelArtwork` | `vm.labelData` |
| Holder cards — slab slot | `LabelArtwork` via `LabelMockup`'s new `slabLabel` prop | `vm.labelData` |
| Holder cards — Avery 8167 / 6871 | Heritage: `useHolderCompactImages` → `renderToploader*` / `renderOneTouch*`. Any other style: `LabelMockup`'s built-in compact DOM | `buildHeritageCompactInputs(card, …)` |

`vm.labelData` is `getCardLabelData(card)` — `src/lib/cardDetail/viewModel.ts:386`.
`LabelArtwork` turns it into a `SlabLabelData` with `toSlabLabelData`
(`src/components/card-detail/holders/LabelArtwork.tsx:159, 170`), which is the
one shared adapter (`src/lib/labels/slabLabelDataAdapter.ts:27`).

### Print (what the download produces)

| Format | Entry | Data in |
| --- | --- | --- |
| Slab insert 2.8×0.8 | `handleSlabDownload` — `src/components/reports/DownloadReportButton.tsx:1321` | `buildSlabData()` — `DownloadReportButton.tsx:1291` |
| Avery 6871 One-Touch | `handleDownloadAveryLabel` — `DownloadReportButton.tsx:960` | Heritage: `buildCompactHeritageSheet('onetouch', …)` — `:929`. Otherwise `getCardLabelData(card)` — `:971` |
| Avery 8167 toploader | `handleDownloadAvery8167Label` — `DownloadReportButton.tsx:1121` | same split |
| Avery 8167 fold-over | `handleDownloadFoldOverLabel` — `DownloadReportButton.tsx:1209` | same split |

`buildSlabData()` opens with `const cleanLabelData = getCardLabelData(card)`
(`DownloadReportButton.tsx:1292`) and forwards its fields one for one. So the
slab preview and the slab print start from the *same call on the same row*.

---

## Table 1 — Graded slab (2.8″ × 0.8″ insert)

Applies to all four styles: the slab generator branch
(`DownloadReportButton.tsx:1349-1390`) picks a different renderer per style but
hands each the same `slabData`.

| Field | Preview reads | Print reads | Verdict |
| --- | --- | --- | --- |
| Display name | `labelData.primaryName` (`LabelArtwork.tsx:185, 258`; `slabLabelDataAdapter.ts:30`) | `cleanLabelData.primaryName` (`DownloadReportButton.tsx:1308`) | same source — code-verified |
| Set / context line | `labelData.contextLine` (`LabelArtwork.tsx:186`; adapter `:31`) | `cleanLabelData.contextLine` (`:1309`) | same source — code-verified |
| Features | `labelData.features` / `.featuresLine` (`LabelArtwork.tsx:187, 290`; adapter `:32-33`) | `cleanLabelData.features` / `.featuresLine` (`:1310-1311`) | same source — code-verified |
| Grade | `labelData.grade` / `.gradeFormatted` (adapter `:38-39`) | `cleanLabelData.grade` / `.gradeFormatted` (`:1313, 1315`) | same source — code-verified |
| Condition | `labelData.condition` (adapter `:40`) | `cleanLabelData.condition` (`:1316`) | same source — code-verified |
| Altered-authentic | `labelData.isAlteredAuthentic` (adapter `:41`) | `cleanLabelData.isAlteredAuthentic` (`:1317`) | same source — code-verified |
| Designation ("Altered – Unverified Autograph") | `labelData.designation` (adapter `:45`) | `labelData.designation`, via the same adapter inside the generators | same source — code-verified |
| Serial | `labelData.serial` (adapter `:34`) | `cleanLabelData.serial` (`:1312`) | same source — code-verified |
| Sub-grades (back) | `card.conversational_sub_scores.X.weighted ?? 0` (`CardDetailShell.tsx`, legacy rule 3075-3080) | `weightedScores.X ?? subScores.X.weighted ?? 0` (`:1319-1323`) | **DIFFERENT source — finding 1** |
| QR destination | `${origin}/${category}/${id}` (`CardDetailShell.tsx`, legacy rule 2680) | `cardQrUrl(id, serial, branding, fallback)` → `/verify/<serial>` for a consumer card (`orgBranding.ts:34-43`) | **DIFFERENT source — finding 2** |
| Emblems (Founder / VIP / Card Lover) | `detail.emblems` (`useCardDetail`, legacy 1771-1802) | `showFounderEmblem` / `showVipEmblem` / `showCardLoversEmblem` props, fed from the same hook by the adapter (`CardDetailV2Client.tsx`) | same source — code-verified |
| Org logo — front mark | `orgLogos.mark`, `orgLogos.scale`, `orgLogos.design` (`LabelArtwork.tsx:167-172, 196-199`) | Heritage `logoBlack: orgLogos.mark`, `logoScale`, `design` (`:1357-1359`); Modern `whiteLogoDataUrl: orgLogos.mark` (`:1374`) | same source — code-verified |
| Org logo — Heritage back QR disc | `colorLogoHref={orgLogos.mark}` (`LabelArtwork.tsx:168`) | `logoDataUrl: orgLogos.color` (`:1365`) | **DIFFERENT source — finding 3** |
| Heritage pattern / band / grade-chip colours | `resolveHeritageSelection(labelStyle, activeConfig)` (`LabelArtwork.tsx:134`) | `resolveHeritageSelection(labelStyle, customLabelConfig)` (`:1352`) | same source — code-verified |
| Custom-config colours (Modern) | `colorOverrides` from `extractColorOverrides(activeConfig)` | `downloadCustomSlabLabel(printData, customLabelConfig)` (`:1383`) | same config object — code-verified |

**Per style, the slab preview branch matches the print branch one for one:**

| Style | Preview branch | Print branch |
| --- | --- | --- |
| Heritage (built-in or `custom-N` with `style: 'heritage'`) | `HeritageLabelPreview` (`LabelArtwork.tsx:163`) | `heritageSlabGenerator` (`:1354`) |
| Modern (built-in) | `ModernFrontLabel` / `ModernBackLabel` (`:181, 197`) | `downloadSlabLabel(…, 'modern')` (`:1385`) |
| Traditional (built-in = Classic) | `ClassicLabelPreview` (`:220`) | `downloadSlabLabel(…, 'traditional')` (`:1385`) |
| Custom `custom-N`, `style: 'modern'` | `ModernFrontLabel` + `colorOverrides` (`:181`) | `downloadCustomSlabLabel(…, customLabelConfig)` (`:1383`) |
| Custom `custom-N`, `style: 'traditional'` | the inline light block (`:239-410`) | `downloadCustomSlabLabel(…, customLabelConfig)` (`:1383`) |

The **representative custom** case I could construct from presets without a
signed-in account is a `custom-N` config with `style: 'heritage'`,
`heritagePattern` and `heritageGradeColors` — the shape
`useCustomLabelStyleWithOrg` synthesises for an enterprise house style
(`useOrgHouseStyle.ts:105-115`), and the shape the unit tests exercise. **That
case is code-verified.** I could not exercise a *saved* `custom-N` slot end to
end, because saving one needs an account — so the custom **row in Table 1 is
code-verified but not output-verified**, like every other row.

---

## Table 2 — Avery 8167 toploader and Avery 6871 One-Touch

Two different questions here: what is drawn, and whether the *style* survives
at all. The second is `holderStyleSupport`, and it is the honest half.

### Heritage

| Field | Preview reads | Print reads | Verdict |
| --- | --- | --- | --- |
| Name, context, short context, serial, grade, condition, sub-grades | `buildHeritageCompactInputs(card, …)` (`useHolderCompactImages.ts:96`) | `buildHeritageCompactInputs(card, …)` (`DownloadReportButton.tsx:941`) | **same function, same row** — code-verified |
| Band pattern + palette | `resolveCompactHeritage(labelStyle, activeConfig)` (`useHolderCompactImages.ts:77`) | `resolveCompactHeritage(labelStyle, customLabelConfig)` (`DownloadReportButton.tsx:933`) | same source — code-verified |
| Emblems | the three flags, forwarded | the three flags, forwarded (`:946-948`) | same source — code-verified |
| Org chip theme | `orgLogos.design.chip.theme` (`useHolderCompactImages.ts:72`) | `logoSet.design.chip.theme` (`:949`) | same source — code-verified |
| Wordmark | `loadWordmarkDataUrl()` (`useHolderCompactImages.ts:89`) | `loadWordmarkDataUrl()` (`:945`) | same source — code-verified |
| Rasteriser | `renderToploaderFront/Back`, `renderOneTouchFront/Back`, `renderFoldFront/Back` at 260 dpi (`HeritageCompactPreview.tsx:29-33`) | the same renderers, inside `heritageCompactSheets` (`:951-953`) | **same renderers** — code-verified |
| QR destination | `compactQrDataUrl(verifyUrl)` where `verifyUrl = ${origin}/${category}/${id}` | `compactQrDataUrl(cardQrUrl(...))` → `/verify/<serial>` (`:940, 942`) | **DIFFERENT source — finding 2 again** |
| Per-grade chip colours | dropped by `resolveCompactHeritage` | dropped by `resolveCompactHeritage` | same source (both drop it) — surfaced to the reader as `adapted` |

This is the strongest parity in the project: the compact preview *is* the print
renderer, called with the same builder, differing only in DPI.

### Modern, Traditional/Classic, and every saved custom design

| Field | Preview shows | Print draws | Verdict |
| --- | --- | --- | --- |
| Everything | `LabelMockup`'s built-in compact DOM label — DCM purple/white, logo, name, grade, QR (`LabelMockup.tsx:573-660, 673-707`) | `generateAveryLabel` / `generateAvery8167Label` / `generateFoldOverLabel8167`, taking only `getCardLabelData(card)`, a QR and a logo (`DownloadReportButton.tsx:1006-1110, 1121-1199, 1209-1270`) | the chosen style reaches **neither** — both show DCM's fixed compact design |

The generators never read `labelStyle` or `customLabelConfig`: the only
style-aware compact path is `buildCompactHeritageSheet`, and it returns `null`
for anything that is not Heritage (`:933-934`). **The preview is therefore
honest about the paper** — it shows the generic label because that is what
prints — and `holderStyleSupport` returns `adapted` with a note saying so, on
the card, under the preview. Nothing is silently substituted.

---

## The compatibility table as implemented

`src/lib/cardDetail/holderSupport.ts`, unit-tested in `holderSupport.test.ts`.

| Holder | Heritage (no chip colours) | Heritage + per-grade chip colours | Modern | Traditional / Classic | Saved custom |
| --- | --- | --- | --- | --- | --- |
| Graded slab | supported | supported | supported | supported | supported |
| Top loader (8167) | supported | **adapted** | **adapted** | **adapted** | **adapted** |
| One-Touch (6871) | supported | **adapted** | **adapted** | **adapted** | **adapted** |

Notes shown to the reader:

- Heritage + chip colours → *"Heritage prints here with its pattern and band
  colours. The per-grade chip colours you chose stay on the slab insert."*
  Evidence: `resolveCompactHeritage` returns only `{ pattern, bandColors }`
  (`labelStyleResolution.ts:71-79`), and its own doc comment says the compact
  panels cannot hold chip colours or layout moves (`:56-66`).
- Modern / Traditional / custom → *"The Avery sheet prints DCM's standard
  compact label. Your colours and layout stay on the slab insert — they do not
  fit this size."* Evidence: the generic generator path above.
- A custom slot with non-standard dimensions (Zion Mag Pro 2.51″ × 0.76″) adds
  *"This holder uses its own Avery label size, so your custom slab dimensions do
  not apply to it."*

No cell is `unsupported`. The status exists and is styled, but every
holder/style pair can produce *something* truthful today.

---

## Findings

### Finding 1 — sub-grades: preview ignores `conversational_weighted_sub_scores`

- Preview: `card.conversational_sub_scores.X.weighted ?? 0` (legacy pokemon
  3075-3080, copied into `CardDetailShell.tsx`).
- Print: `weightedScores.X ?? subScores.X.weighted ?? 0`
  (`DownloadReportButton.tsx:1319-1323`).
- Heritage compact reads a third rule that tolerates both shapes and rounds to
  the nearest half (`heritageCompactInputs.ts:23-31`).

For a row where `conversational_weighted_sub_scores` disagrees with
`conversational_sub_scores.*.weighted`, the printed back label and the on-screen
back label will show different sub-grades.

**Pre-existing**, not introduced by Phase 2 — V2 reproduces legacy's rule
deliberately. Phase 2 did not change it because that is a behaviour change to a
number the owner reads, and it belongs in its own review. Recommend
normalising all three onto `heritageCompactInputs`' tolerant reader.

### Finding 2 — QR destination differs between screen and paper

- Preview QR encodes `${origin}/${category}/${id}` — the page you are on.
- Printed QR encodes `cardQrUrl(...)`: `/enterprise/<slug>/card/<id>` for an
  org card, else **`https://dcmgrading.com/verify/<serial>`**, falling back to
  the category URL only when the row has no serial (`orgBranding.ts:34-43`).

Both resolve to a real DCM page for the same card, so a scan is never broken —
but they are not the same URL, and on a localhost or preview deployment the
preview QR points at that host while the print QR points at production.

**Pre-existing**; legacy has exactly the same split. Phase 2 kept it rather
than quietly changing what the on-screen QR encodes.

### Finding 3 — org Heritage back: QR-disc mark differs

- Preview passes `colorLogoHref={orgLogos.mark}` (the Brand Setup variant).
- Print deliberately overrides to `orgLogos.color` for the QR centre, with the
  reason in the code: *a white Brand Setup mark would vanish on the white QR
  plate* (`DownloadReportButton.tsx:1362-1366`).

So an org whose Brand Setup mark is the white variant sees a different disc on
screen than on paper. **Pre-existing** (legacy passes `orgLogos.mark` too), and
the print side is the correct one. Only affects enterprise org cards whose
`logoVariant` is `white`.

---

## What is NOT verified

- **No PDF was generated.** Every row above is a reading of the code paths. No
  claim in this document has been confirmed against a produced file.
- **No signed-in session.** The owner-only download triggers were mounted and
  type-checked but never clicked through to a file; the position/calibration
  modals were not exercised.
- **A saved `custom-N` slot could not be created**, so the custom rows rest on
  the code path plus the synthesised org-house config shape.
- **Fitting and wrapping were not compared.** A long name that wraps to two
  lines on screen and one on paper would not show up in any table here; the
  shared-renderer design (Heritage compact) removes that risk for the compact
  holders but not for the slab.

The gate this document can honestly close is: *preview and print read the same
data, except in the three places named above.* Closing the pixel half of the
gate needs an account and a printer.
