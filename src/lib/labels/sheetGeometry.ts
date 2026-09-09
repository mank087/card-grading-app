/**
 * Slab label SHEET geometry — where labels sit on a US Letter page.
 *
 * Two densities:
 *
 *  - 'standard' (10 per sheet, 2 cols × 5 rows) — the layout every slab sheet
 *    has printed since the Label Lab promotion. A 0.25" cut margin on EVERY
 *    side of every label, grid centred on the page. For 2.8" × 0.8" this
 *    reproduces the old module constants exactly (cell 3.3" × 1.3",
 *    gridStart 68.4pt / 162pt) — see sheetGeometry.test.ts.
 *
 *  - 'dense' (20 per sheet, 2 cols × 10 rows) — added Sept 2026. Horizontal
 *    geometry is untouched (0.25" cut margin left/right of each label), the
 *    vertical gap between two labels is exactly 0.25" (0.125" of guide space
 *    above and below each label), and the whole block is centred vertically so
 *    the top and bottom page margins are equal:
 *        margin = (11 − (rows·h + (rows−1)·0.25)) / 2
 *    which is 0.375" for h = 0.8" and 0.575" for h = 0.76" (Zion Mag Pro).
 *    Tall labels that cannot fit 10 rows with at least MIN_EDGE_MARGIN_IN of
 *    paper margin drop to the largest row count that does, and `summary` says
 *    so.
 *
 * Coordinates are POINTS (72 per inch), y measured down from the page top,
 * matching react-pdf and jsPDF.
 *
 * NOTE on non-standard label sizes at 'standard' density: the production
 * renderers keep passing the STANDARD 2.8" × 0.8" geometry and centre a
 * smaller label (Zion) inside the cell, exactly as they always have — that is
 * what keeps today's 10-up output identical to the point. `resolveSheetGeometry`
 * itself applies the cut-margin rule to whatever dims it is handed.
 */

export type SheetDensity = 'standard' | 'dense'

export const INCH = 72
export const PAGE_W_PT = 8.5 * INCH
export const PAGE_H_PT = 11 * INCH

/** Guide margin left and right of every label, both densities. */
export const CUT_MARGIN_IN = 0.25
/** Vertical guide margin above/below every label at 'standard' density. */
export const STANDARD_ROW_MARGIN_IN = 0.25
/** Gap BETWEEN two stacked labels at 'dense' density (0.125" each side). */
export const DENSE_ROW_GAP_IN = 0.25
/** Dense layouts never print closer than this to the top/bottom paper edge. */
export const MIN_EDGE_MARGIN_IN = 0.3

export const STANDARD_ROWS = 5
export const DENSE_ROWS = 10
export const SHEET_COLS = 2

export interface SheetGeometry {
  density: SheetDensity
  /** Label size in points. */
  labelW: number
  labelH: number
  cols: number
  rows: number
  labelsPerPage: number
  /** Cell pitch in points (label + its guide margins). */
  cellW: number
  cellH: number
  /** Guide space between two adjacent labels, in points. */
  gapX: number
  gapY: number
  /** Top-left of the FIRST CELL (not the first label) — 68.4 / 162 at standard. */
  gridStartX: number
  gridStartY: number
  /** Top-left of the first LABEL (cell origin + half the gap). */
  firstLabelX: number
  firstLabelY: number
  /** Paper margin above the first / below the last label. */
  marginTopIn: number
  marginBottomIn: number
  /** e.g. `20 per sheet · 2.8" × 0.8" · 3/8" top and bottom margin`. */
  summary: string
}

const round4 = (n: number) => Math.round(n * 10000) / 10000

/** 0.375 -> 3/8, 0.25 -> 1/4, else a decimal. Used only in `summary`. */
function inchLabel(v: number): string {
  const eighths = v * 8
  if (Math.abs(eighths - Math.round(eighths)) < 1e-6) {
    const n = Math.round(eighths)
    if (n === 0) return '0"'
    if (n % 8 === 0) return `${n / 8}"`
    const g = (a: number, b: number): number => (b === 0 ? a : g(b, a % b))
    const d = g(n, 8)
    return `${n / d}/${8 / d}"`
  }
  return `${round4(v)}"`
}

const dimsLabel = (w: number, h: number) => `${round4(w)}" × ${round4(h)}"`

/** Largest row count whose centred block keeps >= MIN_EDGE_MARGIN_IN margins. */
function denseRowsThatFit(labelHIn: number): number {
  for (let rows = DENSE_ROWS; rows >= 1; rows--) {
    const block = rows * labelHIn + (rows - 1) * DENSE_ROW_GAP_IN
    const margin = (11 - block) / 2
    if (margin >= MIN_EDGE_MARGIN_IN - 1e-9) return rows
  }
  return 1
}

export function resolveSheetGeometry(opts: {
  labelWIn: number
  labelHIn: number
  density: SheetDensity
}): SheetGeometry {
  const { density } = opts
  const labelWIn = opts.labelWIn > 0 ? opts.labelWIn : 2.8
  const labelHIn = opts.labelHIn > 0 ? opts.labelHIn : 0.8

  const cols = SHEET_COLS
  const labelW = labelWIn * INCH
  const labelH = labelHIn * INCH

  // Horizontal geometry is identical for both densities: a 0.25" cut margin
  // on each side of every label, grid centred across the 8.5" page.
  const gapX = CUT_MARGIN_IN * 2 * INCH
  const cellW = labelW + gapX
  const gridStartX = (PAGE_W_PT - cols * cellW) / 2
  const firstLabelX = gridStartX + gapX / 2

  let rows: number
  let gapY: number
  let note = ''
  if (density === 'dense') {
    rows = denseRowsThatFit(labelHIn)
    gapY = DENSE_ROW_GAP_IN * INCH
    if (rows < DENSE_ROWS) {
      note = ` (${rows} rows — a ${round4(labelHIn)}" label cannot fit ${DENSE_ROWS} to a page)`
    }
  } else {
    rows = STANDARD_ROWS
    gapY = STANDARD_ROW_MARGIN_IN * 2 * INCH
  }

  const cellH = labelH + gapY
  const gridStartY = (PAGE_H_PT - rows * cellH) / 2
  const firstLabelY = gridStartY + gapY / 2
  const marginTopIn = firstLabelY / INCH
  const lastLabelBottom = firstLabelY + (rows - 1) * cellH + labelH
  const marginBottomIn = (PAGE_H_PT - lastLabelBottom) / INCH

  const labelsPerPage = cols * rows
  if (labelsPerPage !== cols * rows) {
    throw new Error('sheetGeometry: labelsPerPage must equal cols × rows')
  }

  const summary =
    `${labelsPerPage} per sheet · ${dimsLabel(labelWIn, labelHIn)} · ` +
    `${inchLabel(round4(marginTopIn))} top and bottom margin${note}`

  return {
    density,
    labelW,
    labelH,
    cols,
    rows,
    labelsPerPage,
    cellW,
    cellH,
    gapX,
    gapY,
    gridStartX,
    gridStartY,
    firstLabelX,
    firstLabelY,
    marginTopIn: round4(marginTopIn),
    marginBottomIn: round4(marginBottomIn),
    summary,
  }
}

/** The layout every slab sheet printed before the dense option existed. */
export const STANDARD_SLAB_GEOMETRY: SheetGeometry = resolveSheetGeometry({
  labelWIn: 2.8,
  labelHIn: 0.8,
  density: 'standard',
})

/** `?density=dense` / `?density=20` → 'dense'; anything else → 'standard'. */
export function parseSheetDensity(value: string | null | undefined): SheetDensity {
  const v = (value || '').trim().toLowerCase()
  return v === 'dense' || v === '20' ? 'dense' : 'standard'
}

/** Top-left of a label in the grid; `mirrored` flips the column for duplex backs. */
export function labelPos(
  geometry: SheetGeometry,
  index: number,
  mirrored: boolean,
): { x: number; y: number } {
  const col = index % geometry.cols
  const row = Math.floor(index / geometry.cols)
  const useCol = mirrored ? geometry.cols - 1 - col : col
  return {
    x: geometry.gridStartX + useCol * geometry.cellW + geometry.gapX / 2,
    y: geometry.gridStartY + row * geometry.cellH + geometry.gapY / 2,
  }
}
