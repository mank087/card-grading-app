# Enterprise Label Designer — Tier 1 Spec

*Aug 24, 2026 · scope: Enterprise/Dealer orgs only · consumer labels and Label Studio unchanged*

## 1. Goal

Give store owners an interactive label designer inside Brand Setup (`/store/settings`) where they can drag and resize their logo, move the color band to any edge (vertical or horizontal), scale the grade chip and text, switch the grade chip to white, and add a border — all within bounds that guarantee the label still prints correctly for every card name length.

"Tier 1" = a **guided** editor: every control is a bounded parameter in a versioned design document. No free-form canvas. Tier 2 (free canvas) can later be built on the same document.

## 2. Non-goals / isolation guarantees

| Surface | Tier 1 impact |
|---|---|
| Consumer labels (cards with `org_id = null`) | **None.** The design document is only read when `card.org_id` matches the viewer's org (existing `useOrgHouseStyle` rule) or server-side via `getBrandingForCard`. |
| Label Studio (`/labels`, `CustomLabelConfig`, saved styles) | **None.** No new fields on `CustomLabelConfig`; Studio keeps its own presets. Org design is a separate document. |
| Label Lab (admin) | **None.** |
| Native mobile app | **Out of scope.** `SlabCard.tsx` has no org branding today; org cards already render with DCM styling natively. Parity is a follow-up. |
| Existing enterprise orgs | **Byte-identical output** when no design document exists — defaults reproduce today's geometry exactly. Verified by snapshot test (§9). |

Mechanism: a single new resolver, `resolveOrgLabelDesign(org) → LabelDesign`, is the only reader of the new data. Every renderer keeps its current signature and gains one optional `design?: LabelDesign` input. Absent → current behavior.

## 3. Design document (`organizations.storefront.slab.design`)

Stored in the existing `storefront` JSONB next to today's `slab` keys (which remain and are migrated into the document lazily — no migration needed).

```jsonc
{
  "v": 1,
  "base": "heritage",                 // 'heritage' | 'modern'
  "band": {
    "position": "left",               // 'left' | 'right' | 'top' | 'bottom'
    "pattern": "diamond",             // existing BAND_PATTERNS id
    "colorSource": "brand",           // 'brand' | 'card' | 'custom'
    "colors": [],                     // ≤5 hex when custom
    "width": 1.0                      // 0.6–1.5 × stock band width (90px)
  },
  "logo": {
    "zone": "bottom",                 // 'bottom' | 'left' | 'right'
    "variant": "color",               // 'color' | 'black' | 'white'
    "scale": 1.0,                     // 0.7–2.0 (bottom) / 0.7–1.5 (left/right)
    "offset": { "x": 0, "y": 0 },     // -1..1, fraction of the zone's free travel
    "accentRules": true               // the two gold bars beside a bottom mark
  },
  "chip": {
    "theme": "black",                 // 'black' | 'white'
    "scale": 1.0,                     // 0.8–1.1
    "grade10Color": null              // hex; null = foil
  },
  "text": {
    "scale": 1.0,                     // 0.85–1.15 (name + context + serial)
    "align": "left"                   // 'left' | 'center'
  },
  "border": {
    "enabled": false,
    "color": "#1C1B18",
    "width": 0.03,                    // inches, 0.015–0.06
    "inset": 0.06                     // inches from the die-cut edge, ≥0.06
  }
}
```

**Server validation** (`/api/org/settings` PATCH, `slab.design`): every number clamped to its range, enums whitelisted, hex validated, unknown keys dropped. Owner-only, same as today. Reading is through `resolveOrgLabelDesign`, which fills defaults and also accepts the legacy `slab.*` keys so nothing needs a backfill.

## 4. Editor UX (Brand Setup → "Label Designer")

Replaces the current slab section's static preview. Layout: canvas left (~60%), property panel right, sample-card bar above.

**Canvas** — the existing `HeritageLabelPreview` / `ModernFrontLabel` SVG at 1400×400 logical px, scaled to fit. Front and back tabs (back stays read-only in Tier 1; it inherits band + chip theme + border).

**Selectable elements**: logo · grade chip · color band · text block · border. Click to select; selection shows a keyline and its properties in the panel.

**Direct manipulation**
- Logo: drag inside its zone (zone outline shown while dragging; snaps to zone centre); corner handles scale within range. Zone change via panel (bottom / left / right).
- Chip and text: corner handle scales within range (no dragging — position is fixed by the layout).
- Band: click the four edge targets to move it; width handle on its inner edge.
- Border: toggle + width/color/inset in the panel; drawn on canvas as it will print, including the inset.

**Sample-card bar**: three real cards from the org (or DCM samples if they have none) — *short name*, *typical*, *worst case* (longest name + longest set + 10-char serial). The canvas re-renders for each; the worst case is always rendered in the background and drives the collision indicator.

**Collision indicator**: red outline + "Logo will shrink on long names" / "Text will wrap to 3 lines" chips. It never blocks saving — the fitter clamps at print time — but the store sees it.

**Print check** toggle: renders the print-hardened variant (`heritageTheme(true)`, chip inks for print) so what they approve is what the PDF draws.

**Save model**: drag/scale update local state live; PATCH fires on release (same pattern as today's logo slider). Undo/redo is a local history stack (20 steps). "Reset to house default" restores the DCM default document. "Duplicate as new…" is **not** in Tier 1 (one design per org).

## 5. Geometry engine (the real work)

Today Heritage positions are constants (`HERITAGE_PX`). Tier 1 replaces the constant with a pure function:

```ts
heritageGeometry(design: LabelDesign, fit: HeritageFrontFit): HeritageGeometry
// → { band: Rect, textBox: Rect, chip: Rect, logo: Rect & {zone}, border?: Rect, rules?: {...} }
```

Rules the function enforces (these are what make the editor "guided"):
- **Band position** sets the label's inner content rect. Left/right band: content is 1400−band wide. Top/bottom band: content is 400−band tall, and the band is drawn at 1400×(90·width) using the same `bandGeometry` patterns rotated 90°. Patterns are authored in a 90×400 box; the top/bottom case passes a transposed box so every existing pattern works without re-authoring (verified visually per pattern in QA).
- **Logo zone**: `bottom` = today's strip (`heritageMarkBox`, unchanged); `left` = a square column inside the content rect, full content height minus padding (this is the "Emblem" placement — ~280px, 2× what a square logo gets today); `right` = same column placed between text and chip. Offset moves the mark within the zone's free travel; the zone's edges are hard limits. Per-card clamp against the fitted text stays exactly as today.
- **Text box** is whatever is left after band, logo zone (if left/right) and chip; the existing `fitHeritageFront` fitter takes the width as a parameter instead of `TEXT_BOX`. `text.scale` multiplies its max font sizes; the fitter still shrinks.
- **Chip** stays anchored to the content rect's right edge; `chip.scale` scales it about its centre, capped so it never exceeds content height − 2·padding.
- **Border**: drawn inside the die-cut at `inset`, and the content rect shrinks by `inset + width` so nothing touches it.

Modern uses the same document but a smaller surface: band position maps to the gradient edge, logo zone left/right only, chip theme = grade-color override, border supported. `ModernFrontLabel` already accepts `colorOverrides`; it gains `design`.

## 6. Renderer matrix

| Renderer | File | Reads geometry today from | Tier 1 change |
|---|---|---|---|
| Screen preview (SVG) | `components/labels/HeritageLabelPreview.tsx` | `HERITAGE_PX` | consume `heritageGeometry(design)`; add border + chip theme |
| Print PDF (vector) | `lib/labelLab/heritageSlabPdfDoc.tsx` | `HERITAGE_PX` × unit scale | same geometry function, unit-scaled; chip theme |
| Batch/fold-over generator | `lib/labels/heritageSlabGenerator.tsx` | via PDF doc | thread `design` through `HeritageRenderOptions` |
| Small holders (canvas) | `lib/labels/heritageCompact.ts` | own constants | chip theme, band colors, border **only** — band position and logo zone are fixed (no room) and the editor says so |
| Modern front/back | `components/labels/ModernFrontLabel.tsx`, `vectorSlabGenerator.tsx` | Tailwind classes | logo zone, chip theme via `colorOverrides`, border |
| Card image / social | `lib/cardImageGenerator.ts` | passes `logoOverrides` | pass `design` |
| Grading report chip | `components/reports/CardGradingReport.tsx` | `GRADE_CHIP_BLACK` | chip theme |
| Storefront mock + Brand Setup preview | `StorefrontSlabMock.tsx`, `OrgLabelPreview.tsx` | props | pass `design` (preview is the editor canvas) |
| Native mobile | `dcm-mobile/components/grading/SlabCard.tsx` | own constants | **unchanged** (no org branding natively today) |

Chip theme detail: `labelPresets.ts` gains `GRADE_CHIPS_WHITE` / `GRADE_CHIPS_WHITE_PRINT` — white fill, keyline in the grade's ink, numeral in a **dark** ink table (today's silver/gold/lime inks are unreadable on white). Grade 10 keeps the foil ring; on white the numeral is foil and the "GEM MINT" word is near-black. `resolveGradeChip(grade, hardened, theme)` is the only entry point; the default `theme = 'black'` keeps every existing caller identical.

## 7. Data flow (unchanged shape, one new field)

`storefront.slab.design` → `getOrgBranding()` / `/api/org/branding` (adds `design`) → `OrgContext.membership.design` → `useOrgHouseStyle` synthesises the config as today **plus** attaches `design` → card surfaces pass it to renderers. Server routes that render for a card (`label-export`, card images, reports) use `getBrandingForCard(cardId).design`.

## 8. Phases and estimates

| Phase | Work | Est. |
|---|---|---|
| P0 | `LabelDesign` type, validator, `resolveOrgLabelDesign`, defaults, API read/write, snapshot test proving byte-identical output with no document | 2 d |
| P1 | Chip white theme + dark ink table across 6 chip surfaces; border on Heritage + Modern | 3 d |
| P2 | `heritageGeometry()` extraction; logo zones (bottom / left / right) + offset; text-box width param on the fitter | 3 d |
| P3 | Band position (top/bottom transposed patterns, right) + width; Modern mapping | 3 d |
| P4 | Editor UI: canvas selection, drag/handles, property panel, sample-card bar, collision indicator, print check, undo | 4 d |
| P5 | QA: print proofs on Avery slab sheets for each band position and border; pattern-by-pattern check of transposed bands; Kings Kards migration to `logo.zone = 'left'` | 1 d |

**≈ 16 working days.** P1 alone ships the two items already requested (white chip; Kings Kards via `zone: 'left'` lands in P2) and can go out before the editor exists — the settings page can expose them as plain controls first.

## 9. Test plan

- **Isolation snapshot**: render the front/back PDF + SVG for (a) a consumer card, (b) every current enterprise org's sample card, before and after P0–P3 with no design document → identical bytes (PDF metadata stripped). This is the gate for every phase.
- **Label Studio**: existing Studio unit/snapshot tests untouched and green; no diff in `labelPresets` exports other than additions.
- **Worst-case names**: fixture of the 10 longest card names per type in production; every zone/band combination must render without overlap (fitter clamps, collision flag set, never a paint over the serial).
- **Physical print**: one Avery 6871 + 8167 sheet per band position with border on; measure border evenness against die-cut drift.

## 10. Open decisions (owner call)

1. Border default inset — spec says 0.06″ (1.5 mm) minimum; go tighter only if the print proof holds.
2. Allow `text.align: 'center'`? Cheap, but centred text plus a left logo zone looks unbalanced; suggest leaving it out of the first release.
3. Should the editor be Enterprise-tier only, or Dealer too? Zero cost either way — it's a settings screen.
4. Mobile parity: accept DCM-styled org cards natively for now, or schedule the native geometry port (~1 week) right after Tier 1.

---

## Implementation status (Aug 24, 2026)

**Built (uncommitted):**
- `src/lib/labels/orgLabelDesign.ts` — document type, limits, normalizer/validator, legacy-key bridge, `resolveOrgLabelDesign`, `isStockLayout`.
- `heritageGeometry()` in `src/lib/labelLab/heritageLayout.ts`; `fitHeritageFront` / `heritageMarkBox` take geometry (stock output unchanged).
- Renderers reading `design`: `HeritageLabelPreview` (SVG), `heritageSlabPdfDoc` (print PDF, incl. rotated bands, border, scaled back), `heritageSlabGenerator` (single/batch/fold-over + edge-aware bleed), `heritageRaster`, `cardImageGenerator`, `CardGradingReport` chip, `heritageCompact` (chip theme only).
- White chip theme: `GRADE_CHIPS_WHITE` + `resolveGradeChip(grade, forPrint, theme)`.
- Plumbing: `getOrgBranding().design`, `/api/org/branding`, `OrgContext`, `loadLogosForCard().design`, all 8 card detail pages, collection, CardSlab, OrgCardReport, storefront mock, label-export (single/batch), BatchSlabLabelModal, DownloadReportButton, eBay modal / image prep, label-preview.
- API: `/api/org/settings` GET returns `slab.design`; PATCH accepts `slab.design` (or legacy flat keys) and always stores both in sync. Admin storefront route accepts `slab.design`, merges slab one level deep (no longer wipes owner mark settings).
- UI: `src/components/enterprise/LabelDesigner.tsx` in `/store/settings` (autosave on release) and the admin org console (applies on “Save storefront”). Drag logo, resize handles for logo / chip / text, band edge targets + width handle, sample-card bar with worst-case notes, undo/redo, reset.
- Dev tools: `/dev/label-designer` harness, `/dev/pdf-proof?name=…` rasterizer, `scripts/label-design-proofs.ts`.
- Isolation gate: `scripts/label-design-snapshot.ts` (`baseline` / `check`), 16 fixtures — green after every phase.

**Deliberately not in this pass:**
- Modern label: the designer’s band / border / chip / text fields are disabled for Modern. Its print renderers (`slabLabelPdfDoc`, `cardImageGenerator` modern path) don’t read the document, and showing options on screen that don’t print would be worse than not offering them. Modern keeps logo version + size.
- Physical Avery print proofs (needs a printer).
- Kings Kards migration to `logo.zone = 'left'` — a production data change; do it from their Brand Setup once the code is deployed.
- Native mobile parity (no org branding natively today).
