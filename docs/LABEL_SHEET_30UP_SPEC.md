# DCM slab labels: 30 per sheet, pre-perforated, duplex

Send this spec to the perforation vendor. DCM prints to exactly this grid: the
label print window's **30 per sheet** option, `density=30` on
`/label-export/batch`, and `'up30'` in `src/lib/labels/sheetGeometry.ts`
(`UP30_PRESET`).

## Sheet

| Item | Inches | mm |
|---|---|---|
| Paper | 8.5 × 11 (US Letter, portrait) | 215.9 × 279.4 |
| Grid | 3 columns × 10 rows = 30 labels | |
| Label size | 2.625 × 1.000 | 66.675 × 25.400 |
| Top margin (paper edge to row 1) | 0.500 | 12.70 |
| Bottom margin | 0.500 | 12.70 |
| Left margin (paper edge to column 1) | 0.1875 | 4.76 |
| Right margin | 0.1875 | 4.76 |
| Gap between columns | 0.125 | 3.175 |
| Gap between rows | 0 (the rows share one perforation) | 0 |
| Horizontal pitch | 2.750 | 69.85 |
| Vertical pitch | 1.000 | 25.40 |

This is the Avery 5160 / 8160 layout. The grid is centred on the page both ways,
so the perforations are in the same place from either side of the sheet. Both
sides print, so use stock that takes duplex printing (no adhesive backing
unless one side is left blank).

## Perforation lines

Vertical cuts, measured from the **left** paper edge (6 lines: each column has
its own left and right cut, and the 0.125" strips between columns are waste):

| Column | Left cut | Right cut |
|---|---|---|
| 1 | 0.1875" (4.76 mm) | 2.8125" (71.44 mm) |
| 2 | 2.9375" (74.61 mm) | 5.5625" (141.29 mm) |
| 3 | 5.6875" (144.46 mm) | 8.3125" (211.14 mm) |

Horizontal cuts, measured from the **top** paper edge (11 lines, 1" apart):
0.5", 1.5", 2.5", 3.5", 4.5", 5.5", 6.5", 7.5", 8.5", 9.5", 10.5"
(12.7, 38.1, 63.5, 88.9, 114.3, 139.7, 165.1, 190.5, 215.9, 241.3, 266.7 mm).

## How DCM prints on it

- Page 1 has the fronts and page 2 the backs (then 3/4, and so on). Print
  duplex at **100% / Actual Size**.
- Long-edge flip (the default): the backs page is mirrored left to right, so
  column 1 swaps with column 3 and column 2 stays put. The short-edge option
  also turns the backs page 180°.
- The 2.8" × 0.8" slab design is scaled evenly to 93.75% (2.625" × 0.75") and
  centred in the 1" slot. The label background fills the 0.125" above and
  below. It is never stretched.
- No cut lines are printed on the labels. Small grey ticks in the paper margins
  mark every perforation line on the front page.
- The background can run up to 0.0625" into the column gaps. It never runs past
  a row line, because the rows touch.

## Alignment test and calibration

In the label print window, open **Duplex alignment** and click **Download 30-up
alignment test**. The PDF has three pages:

1. Front: 30 numbered black outlines, each with a centre cross.
2. Back: the same outlines where the backs will print, drawn in red with a
   1/32" scale.
3. This spec, plus the measuring steps.

Print pages 1 and 2 duplex. Each box must measure exactly 2.625" × 1"; if it
doesn't, fix the print scale before anything else. Hold the sheet up to a light
with the red side facing you, then read the offsets:

- **Back only X/Y**: if the black cross is n ticks right of the red centre, add
  n/32" to Back X. If it is n ticks below, add n/32" to Back Y.
- **Both sides X/Y**: measure from the top paper edge to box 1 on page 1. It
  should be 0.500". Global Y += 0.500 − measured. Measure from the left paper
  edge to box 1. It should be 0.1875". Global X += 0.1875 − measured.

Offsets can be entered in inches or mm (max ±0.25"). Click **Save**; they are
stored in this browser (`dcm_slab_sheet_calibration`) and apply to every
10/20/30-up duplex sheet printed from it. Reprint the test until the crosses
line up.
