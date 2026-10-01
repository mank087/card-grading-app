# DCM slab labels: true-size pre-perforated duplex sheets (26 and 30 per sheet)

Send this spec to the perforation vendor. Every slab label prints at its real
size, **2.8" × 0.8" (71.12 × 20.32 mm)**. Nothing is scaled or padded. There
are two layouts:

| Layout | Print window option | URL (`/label-export/batch`) | Code (`src/lib/labels/sheetGeometry.ts`) |
|---|---|---|---|
| 26 per sheet, upright | **26 per sheet (true size)** | `density=26` | `'up26'`, `UP26_PRESET` / `up26Preset(colGapIn)` |
| 30 per sheet, sideways | **30 per sheet (true size, sideways)** | `density=30` | `'up30'`, `UP30_PRESET` |

The Sept 28 30-up used Avery 5160 geometry (2.625" × 1", design scaled to
93.75%). That layout has been removed. `density=30`, `up30` and the old
`avery5160` alias now all give the true-size sideways 30-up. Avery templates
are still used for toploader and magnetic one-touch labels; those code paths
are separate and unchanged.

Both grids are centred on the page in both directions, so the perforations
are in the same place on either side of the sheet and from either end. The
sheet can be loaded any way round. Both sides print, so the stock must take
duplex printing.

## 30 per sheet: sideways (10 columns × 3 rows)

Each label is turned 90° clockwise. On the sheet it is 0.8" wide and 2.8" tall,
with the label's top edge toward the sheet's right edge.

| Item | Inches | mm |
|---|---|---|
| Paper | 8.5 × 11 (US Letter, portrait) | 215.9 × 279.4 |
| Label on the sheet (W × H) | 0.8 × 2.8 | 20.32 × 71.12 |
| Block | 8.0 × 8.4 | 203.2 × 213.36 |
| Left / right margin | 0.25 | 6.35 |
| Top / bottom margin | 1.3 | 33.02 |
| Gap between labels | 0 (neighbours share a perforation) | 0 |
| Pitch | 0.8 across, 2.8 down | 20.32 / 71.12 |

**Vertical perforations**, measured from the **left** paper edge (11 lines):

| in | 0.25 | 1.05 | 1.85 | 2.65 | 3.45 | 4.25 | 5.05 | 5.85 | 6.65 | 7.45 | 8.25 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mm | 6.35 | 26.67 | 46.99 | 67.31 | 87.63 | 107.95 | 128.27 | 148.59 | 168.91 | 189.23 | 209.55 |

**Horizontal perforations**, measured from the **top** paper edge (4 lines):

| in | 1.3 | 4.1 | 6.9 | 9.7 |
|---|---|---|---|---|
| mm | 33.02 | 104.14 | 175.26 | 246.38 |

## 26 per sheet: upright (2 columns × 13 rows)

| Item | Inches | mm |
|---|---|---|
| Paper | 8.5 × 11 (US Letter, portrait) | 215.9 × 279.4 |
| Label (W × H) | 2.8 × 0.8 | 71.12 × 20.32 |
| Block | 5.6 × 10.4 | 142.24 × 264.16 |
| Left / right margin | 1.45 | 36.83 |
| Top / bottom margin | 0.3 | 7.62 |
| Gap between labels | 0 (neighbours share a perforation) | 0 |
| Pitch | 2.8 across, 0.8 down | 71.12 / 20.32 |

**Vertical perforations** from the left paper edge (3 lines): 1.45", 4.25",
7.05" (36.83, 107.95, 179.07 mm).

**Horizontal perforations** from the top paper edge (14 lines, 0.8" apart):

| in | 0.3 | 1.1 | 1.9 | 2.7 | 3.5 | 4.3 | 5.1 | 5.9 | 6.7 | 7.5 | 8.3 | 9.1 | 9.9 | 10.7 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mm | 7.62 | 27.94 | 48.26 | 68.58 | 88.90 | 109.22 | 129.54 | 149.86 | 170.18 | 190.50 | 210.82 | 231.14 | 251.46 | 271.78 |

If the vendor wants a gutter between the two columns (for example 1/8" of
waste), set `colGapIn` in `up26Preset(colGapIn)`. The block stays centred: the
side margins become (8.5 − 5.6 − gap) / 2. The default is 0, a single shared
perforation.

## How DCM prints on these sheets

- Page 1 holds the fronts and page 2 the backs (then pages 3 and 4, and so on).
  Print duplex at **100% / Actual Size**, never "Fit to page".
- Every label is drawn at exactly 2.8" × 0.8". No cut lines are printed on the
  labels. Small grey ticks in the paper margins mark every perforation line on
  the front page.
- The sheets have no gaps, so nothing bleeds past a label edge. Each label is
  clipped to its own rectangle.
- The printer's duplex setting must match **Printer flips on** in the print
  window (Duplex alignment). Long edge is the default.

### Duplex: where each back goes and which way up

A slab label is turned over left-to-right, about its own vertical axis (the
0.8" direction). The back must sit behind its front and read upright after
that turn. The derivation is in the comment block "Duplex for true-size
layouts" in `sheetGeometry.ts`. `sheetGeometry.test.ts` checks it by
simulating the physical flip for every slot.

| Layout | Front rotation | Long-edge flip | Short-edge flip |
|---|---|---|---|
| 26 upright | 0° | columns mirror (col 1 ↔ col 2); back drawn at 0° | rows mirror (row 1 ↔ row 13); back turned 180° |
| 30 sideways | 90° | columns mirror (col 1 ↔ col 10); back at 270°, i.e. turned 180° from the front | rows mirror (row 1 ↔ row 3); back at 90°, the same way round as the front |

On the sideways sheet, the label's turn-over axis runs across the sheet. That
is the short-edge flip axis, so a short-edge flip needs no extra turn.

## Alignment test and calibration

Open the label print window, choose 26 or 30 per sheet, open **Duplex
alignment**, and click **Download 26-up / 30-up alignment test**. The PDF has
three pages:

1. Front: every label outline in black, drawn the way it sits on the sheet.
   Each is numbered "n FRONT", marked TOP along its top edge, and has a centre
   cross.
2. Back: the outlines where the backs will print, drawn in red. Each has a
   1/32" scale and "BACK n", written the way the back reads.
3. The vendor spec and measuring steps.

Print pages 1 and 2 duplex. Then:

1. **Scale.** Each box must measure exactly 2.8" × 0.8". If it doesn't, fix the
   print scale before anything else.
2. **Both sides X/Y.** Measure from the top paper edge to box 1. It should be
   1.3" (30-up) or 0.3" (26-up): Global Y += expected − measured. Measure from
   the left paper edge to box 1. It should be 0.25" (30-up) or 1.45" (26-up):
   Global X += expected − measured.
3. **Back only X/Y.** Hold the sheet up to a light with the red side facing you.
   If the black cross is n ticks right of the red centre, add n/32" to Back X.
   If it is n ticks below, add n/32" to Back Y.
4. **Orientation.** Tear out one label and turn it over left to right. "BACK n"
   must read upright with TOP at the top. If it reads upside down, the printer
   flips on the other edge: change **Printer flips on** and print again.

Offsets can be entered in inches or mm (max ±0.25"). Click **Save**. They are
stored in this browser (`dcm_slab_sheet_calibration`) and apply to every
10, 20, 26 and 30 per sheet duplex print from it. Reprint the test until the
crosses line up.

## Things to check on the real printer

- **Printable area.** The 30-up prints to 0.25" from the left and right paper
  edges, and the 26-up to 0.3" from the top and bottom. Most laser printers
  print to about 0.17", but check that the outermost labels are not clipped.
  The header text sits closer to the edge than the labels and may be cut off.
  That is harmless.
- **Registration.** There are no gaps, so any front-to-back error shows as a
  sliver of the neighbouring label's colour at a perforation. Calibrate before
  each production run on a new printer.
