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
 *  - 'up30' (30 per sheet, 3 cols × 10 rows) — added Sept 28 2026 for a dealer
 *    whose vendor makes pre-perforated duplex sheets. Fixed Avery 5160
 *    geometry: 2.625" × 1" labels, 0.5" top margin, 0.1875" left margin,
 *    0.125" column gap, no row gap. The slab design is FITTED into the slot
 *    (labels/sheetFit). No cut guides — the paper is perforated.
 *
 * Every layout is a `SheetLayoutPreset` ({cols, rows, labelW, labelH,
 * marginTop, marginLeft, colGap, rowGap}); standard / dense derive theirs from
 * the label size exactly as before (numbers pinned in sheetGeometry.test.ts).
 *
 * Duplex options (all layouts; defaults reproduce the historic output):
 * `duplexFlip` 'long' (backs page mirrored left/right) or 'short' (backs page
 * additionally turned 180° — renderers check `backPageRotated`), plus printer
 * calibration offsets in inches: a global X/Y applied to both pages and a
 * back-only X/Y, measured in the back page's own printed coordinates.
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

export type SheetDensity = 'standard' | 'dense' | 'up30'

/** Which paper edge the printer flips on for duplex. */
export type DuplexFlip = 'long' | 'short'

/**
 * Printer calibration, INCHES. Positive X moves content right, positive Y
 * down, each measured on the side it applies to, looking at that side.
 * `global*` shifts both pages; `back*` shifts the backs page only.
 */
export interface SheetOffsetsIn {
  globalX: number
  globalY: number
  backX: number
  backY: number
}

export const ZERO_SHEET_OFFSETS: SheetOffsetsIn = { globalX: 0, globalY: 0, backX: 0, backY: 0 }

/** Everything a batch generator needs to lay out a duplex sheet. */
export interface SheetPrintOptions {
  density: SheetDensity
  duplexFlip?: DuplexFlip
  offsetsIn?: Partial<SheetOffsetsIn> | null
}

/** Generators accept either a bare density (legacy) or full print options. */
export type SheetLayoutArg = SheetDensity | SheetPrintOptions

/** A grid on US Letter, inches. Label positions follow directly from it. */
export interface SheetLayoutPreset {
  cols: number
  rows: number
  labelWIn: number
  labelHIn: number
  /** Paper edge to the top of row 1 / the left of column 1. */
  marginTopIn: number
  marginLeftIn: number
  /** Space BETWEEN two adjacent labels (0 = labels abut). */
  colGapIn: number
  rowGapIn: number
}

/**
 * 30 per sheet — Avery 5160 / 8160 geometry. 3 × 2.625" + 2 × 0.125" +
 * 2 × 0.1875" = 8.5"; 10 × 1" + 2 × 0.5" = 11". The grid is symmetric on the
 * page in both axes, so long- and short-edge duplex both land exactly behind.
 */
export const UP30_PRESET: SheetLayoutPreset = {
  cols: 3,
  rows: 10,
  labelWIn: 2.625,
  labelHIn: 1,
  marginTopIn: 0.5,
  marginLeftIn: 0.1875,
  colGapIn: 0.125,
  rowGapIn: 0,
}

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
  /** The same grid in inches (informational for standard/dense). */
  preset: SheetLayoutPreset
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
  /** Duplex flip edge; 'short' = renderers turn the backs page 180°. */
  duplexFlip: DuplexFlip
  /** Calibration in POINTS, pre-combined: front = global, back = global + back. */
  offsets: { frontX: number; frontY: number; backX: number; backY: number }
  /**
   * Pre-perforated stock (up30): the design is fitted into the slot, no
   * per-label cut guides are drawn, and bleed is limited to half the gap
   * between labels so it never paints onto a neighbour.
   */
  perforated: boolean
  /** Most bleed (points) a renderer may paint past a slot edge. */
  maxBleedX: number
  maxBleedY: number
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

function normalizeOffsets(o?: Partial<SheetOffsetsIn> | null): SheetOffsetsIn {
  const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0)
  return { globalX: n(o?.globalX), globalY: n(o?.globalY), backX: n(o?.backX), backY: n(o?.backY) }
}

function printFields(flip?: DuplexFlip, offsetsIn?: Partial<SheetOffsetsIn> | null) {
  const o = normalizeOffsets(offsetsIn)
  return {
    duplexFlip: (flip === 'short' ? 'short' : 'long') as DuplexFlip,
    offsets: {
      frontX: o.globalX * INCH,
      frontY: o.globalY * INCH,
      backX: (o.globalX + o.backX) * INCH,
      backY: (o.globalY + o.backY) * INCH,
    },
  }
}

/** Geometry for an explicit preset (up30; any grid that fits on Letter). */
export function geometryFromPreset(
  preset: SheetLayoutPreset,
  opts: { density?: SheetDensity; duplexFlip?: DuplexFlip; offsetsIn?: Partial<SheetOffsetsIn> | null; summary?: string } = {},
): SheetGeometry {
  const { cols, rows } = preset
  const labelW = preset.labelWIn * INCH
  const labelH = preset.labelHIn * INCH
  const gapX = preset.colGapIn * INCH
  const gapY = preset.rowGapIn * INCH
  const cellW = labelW + gapX
  const cellH = labelH + gapY
  const firstLabelX = preset.marginLeftIn * INCH
  const firstLabelY = preset.marginTopIn * INCH
  const gridStartX = firstLabelX - gapX / 2
  const gridStartY = firstLabelY - gapY / 2
  const rightIn = (PAGE_W_PT - (firstLabelX + (cols - 1) * cellW + labelW)) / INCH
  const bottomIn = (PAGE_H_PT - (firstLabelY + (rows - 1) * cellH + labelH)) / INCH
  if (rightIn < -1e-9 || bottomIn < -1e-9) {
    throw new Error(`sheetGeometry: preset ${cols}×${rows} does not fit on Letter`)
  }
  const labelsPerPage = cols * rows
  const summary = opts.summary ??
    `${labelsPerPage} per sheet · ${dimsLabel(preset.labelWIn, preset.labelHIn)} · ` +
    `${inchLabel(round4(preset.marginTopIn))} top, ${inchLabel(round4(preset.marginLeftIn))} side margin`
  return {
    density: opts.density ?? 'up30',
    preset,
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
    marginTopIn: round4(preset.marginTopIn),
    marginBottomIn: round4(bottomIn),
    summary,
    ...printFields(opts.duplexFlip, opts.offsetsIn),
    perforated: true,
    maxBleedX: gapX / 2,
    maxBleedY: gapY / 2,
  }
}

export function resolveSheetGeometry(opts: {
  labelWIn: number
  labelHIn: number
  density: SheetDensity
  duplexFlip?: DuplexFlip
  offsetsIn?: Partial<SheetOffsetsIn> | null
}): SheetGeometry {
  const { density } = opts
  if (density === 'up30') {
    // Fixed stock: the slot is 2.625" × 1" whatever the design's own size.
    return geometryFromPreset(UP30_PRESET, { density: 'up30', duplexFlip: opts.duplexFlip, offsetsIn: opts.offsetsIn })
  }
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

  // The same grid expressed as a preset (informational — positions below
  // still come from the point values, so 10-up / 20-up stay exact).
  const preset: SheetLayoutPreset = {
    cols,
    rows,
    labelWIn,
    labelHIn,
    marginTopIn: round4(marginTopIn),
    marginLeftIn: round4(firstLabelX / INCH),
    colGapIn: round4(gapX / INCH),
    rowGapIn: round4(gapY / INCH),
  }

  return {
    density,
    preset,
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
    ...printFields(opts.duplexFlip, opts.offsetsIn),
    perforated: false,
    maxBleedX: Infinity,
    maxBleedY: Infinity,
  }
}

/** The layout every slab sheet printed before the dense option existed. */
export const STANDARD_SLAB_GEOMETRY: SheetGeometry = resolveSheetGeometry({
  labelWIn: 2.8,
  labelHIn: 0.8,
  density: 'standard',
})

/**
 * `?density=dense` / `20` → 'dense'; `up30` / `30` / `30up` / `avery5160` →
 * 'up30'; anything else → 'standard'.
 */
export function parseSheetDensity(value: string | null | undefined): SheetDensity {
  const v = (value || '').trim().toLowerCase()
  if (v === 'dense' || v === '20') return 'dense'
  if (v === 'up30' || v === '30' || v === '30up' || v === 'avery5160' || v === '5160') return 'up30'
  return 'standard'
}

/** `?flip=short` → 'short'; anything else → 'long'. */
export function parseDuplexFlip(value: string | null | undefined): DuplexFlip {
  return (value || '').trim().toLowerCase() === 'short' ? 'short' : 'long'
}

/** The density out of a generator's layout argument. */
export function sheetDensityOf(arg: SheetLayoutArg | undefined | null): SheetDensity {
  if (!arg) return 'standard'
  return typeof arg === 'string' ? arg : arg.density
}

/** Normalises a generator's layout argument into print options. */
export function sheetPrintOptionsOf(arg: SheetLayoutArg | undefined | null): SheetPrintOptions {
  if (!arg) return { density: 'standard' }
  return typeof arg === 'string' ? { density: arg } : arg
}

/**
 * Geometry for a generator's layout argument. `labelWIn/labelHIn` are the
 * design's size (ignored by up30, whose slot is fixed).
 */
export function resolveSheetLayout(
  arg: SheetLayoutArg | undefined | null,
  labelWIn: number,
  labelHIn: number,
): SheetGeometry {
  const o = sheetPrintOptionsOf(arg)
  return resolveSheetGeometry({
    labelWIn, labelHIn, density: o.density, duplexFlip: o.duplexFlip, offsetsIn: o.offsetsIn,
  })
}

/** Applies a layout argument's flip + calibration to an existing geometry. */
export function withPrintOptions(geometry: SheetGeometry, arg: SheetLayoutArg | undefined | null): SheetGeometry {
  const o = sheetPrintOptionsOf(arg)
  if (!o.duplexFlip && !o.offsetsIn) return geometry
  return { ...geometry, ...printFields(o.duplexFlip, o.offsetsIn) }
}

/** True when the backs page must be rendered turned 180° (short-edge flip). */
export function backPageRotated(geometry: SheetGeometry): boolean {
  return geometry.duplexFlip === 'short'
}

/** A rect turned 180° about the page centre (short-edge backs, raster paths). */
export function rotateRect180(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return { x: PAGE_W_PT - x - w, y: PAGE_H_PT - y - h }
}

/** Duplex instruction wording for sheet headers. */
export function duplexFlipText(geometry: SheetGeometry): string {
  return geometry.duplexFlip === 'short' ? 'flip on short edge' : 'flip on long edge'
}

/**
 * Top-left of a label in the grid; `mirrored` = the duplex BACKS page.
 *
 * Backs are mirrored left/right (long-edge flip). For short-edge flip the
 * renderer additionally turns the whole backs page 180° about its centre, so
 * the position returned here is the PRE-rotation one — which is why the back
 * calibration offset is negated in that case: after the turn it lands where
 * the user measured it. Zero offsets reproduce the historic positions exactly.
 */
export function labelPos(
  geometry: SheetGeometry,
  index: number,
  mirrored: boolean,
): { x: number; y: number } {
  const col = index % geometry.cols
  const row = Math.floor(index / geometry.cols)
  const useCol = mirrored ? geometry.cols - 1 - col : col
  let x = geometry.gridStartX + useCol * geometry.cellW + geometry.gapX / 2
  let y = geometry.gridStartY + row * geometry.cellH + geometry.gapY / 2
  const o = geometry.offsets
  if (o) {
    if (!mirrored) {
      x += o.frontX
      y += o.frontY
    } else if (geometry.duplexFlip === 'short') {
      x -= o.backX
      y -= o.backY
    } else {
      x += o.backX
      y += o.backY
    }
  }
  return { x, y }
}

/**
 * Where a label's back finally lands on the printed backs page, AFTER any
 * short-edge 180° turn — for renderers that place items directly (jsPDF).
 * `w/h` are the painted size; `rotate180` = the item must also be turned.
 */
export function backPlacement(
  geometry: SheetGeometry,
  index: number,
  w: number,
  h: number,
  offX = 0,
  offY = 0,
): { x: number; y: number; rotate180: boolean } {
  const p = labelPos(geometry, index, true)
  const x = p.x + offX
  const y = p.y + offY
  if (!backPageRotated(geometry)) return { x, y, rotate180: false }
  return { ...rotateRect180(x, y, w, h), rotate180: true }
}
