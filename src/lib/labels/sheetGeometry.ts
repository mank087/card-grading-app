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
 *  - 'up26' / 'up30' — TRUE-SIZE layouts for a dealer's custom pre-perforated
 *    duplex Letter sheets (owner decision Sept 30 2026: a slab label is ALWAYS
 *    printed at its real 2.8" × 0.8" — never scaled, never padded; Avery
 *    templates are for toploader / one-touch labels only). No gaps, no cut
 *    guides — the vendor perforates between the labels.
 *      up26: 2 cols × 13 rows of 2.8" × 0.8", upright. Block 5.6" × 10.4",
 *            1.45" left/right, 0.3" top/bottom (`up26Preset(colGapIn)` keeps
 *            the block centred if the vendor wants a column gap).
 *      up30: 10 cols × 3 rows, each label turned 90° clockwise so it occupies
 *            0.8" × 2.8" on the sheet. Block 8.0" × 8.4", 0.25" left/right,
 *            1.3" top/bottom.
 *    The 2.625" × 1" Avery-5160-geometry 30-up of Sept 28 is GONE; `density=30`
 *    (and its old aliases) now means the true-size sideways 30-up. Duplex for
 *    these two layouts is placed per label (see "Duplex for true-size
 *    layouts" below), not by turning the whole backs page.
 *
 * Every layout is a `SheetLayoutPreset` ({cols, rows, labelW, labelH,
 * marginTop, marginLeft, colGap, rowGap}); standard / dense derive theirs from
 * the label size exactly as before (numbers pinned in sheetGeometry.test.ts).
 *
 * Duplex options (all layouts; defaults reproduce the historic output):
 * `duplexFlip` 'long' (backs page mirrored left/right) or 'short' (backs page
 * additionally turned 180° — standard / dense renderers check
 * `backPageRotated`; true-size renderers use `slotPlacement`), plus printer
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

export type SheetDensity = 'standard' | 'dense' | 'up26' | 'up30'

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
  /** The label's FOOTPRINT on the sheet (0.8 × 2.8 for a sideways label). */
  labelWIn: number
  labelHIn: number
  /** Paper edge to the top of row 1 / the left of column 1. */
  marginTopIn: number
  marginLeftIn: number
  /** Space BETWEEN two adjacent labels (0 = labels abut). */
  colGapIn: number
  rowGapIn: number
  /**
   * How far the FRONT of each label is turned on the sheet, degrees clockwise
   * (0 = reads normally with the sheet portrait; 90 = the label's top edge
   * faces the sheet's RIGHT edge, text runs top-to-bottom). Default 0.
   */
  rotationDeg?: 0 | 90
}

/** The physical slab label, inches. Every true-size layout prints exactly this. */
export const SLAB_LABEL_W_IN = 2.8
export const SLAB_LABEL_H_IN = 0.8

/**
 * 26 per sheet, true size, upright: 2 × 13 of 2.8" × 0.8". The block is
 * centred both ways; `colGapIn` (default 0 — one shared perforation between
 * the columns) widens the gutter without moving the block off centre.
 */
export function up26Preset(colGapIn = 0): SheetLayoutPreset {
  const gap = Math.max(0, colGapIn)
  return {
    cols: 2,
    rows: 13,
    labelWIn: SLAB_LABEL_W_IN,
    labelHIn: SLAB_LABEL_H_IN,
    marginTopIn: 0.3,
    marginLeftIn: Math.round(((8.5 - 2 * SLAB_LABEL_W_IN - gap) / 2) * 1e6) / 1e6,
    colGapIn: gap,
    rowGapIn: 0,
    rotationDeg: 0,
  }
}
export const UP26_PRESET: SheetLayoutPreset = up26Preset(0)

/**
 * 30 per sheet, true size, SIDEWAYS: 10 × 3 labels, each 2.8" × 0.8" turned
 * 90° clockwise (0.8" wide × 2.8" tall on the sheet). 10 × 0.8 = 8.0" +
 * 2 × 0.25" = 8.5"; 3 × 2.8 = 8.4" + 2 × 1.3" = 11". No gaps.
 */
export const UP30_PRESET: SheetLayoutPreset = {
  cols: 10,
  rows: 3,
  labelWIn: SLAB_LABEL_H_IN,
  labelHIn: SLAB_LABEL_W_IN,
  marginTopIn: 1.3,
  marginLeftIn: 0.25,
  colGapIn: 0,
  rowGapIn: 0,
  rotationDeg: 90,
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
   * Pre-perforated true-size stock (up26 / up30): no per-label cut guides,
   * bleed limited to half the gap between labels so it never paints onto a
   * neighbour, and backs placed per label with `slotPlacement` (never by
   * turning the whole page).
   */
  perforated: boolean
  /** Front rotation of every label on the sheet, degrees clockwise (0 / 90). */
  labelRotation: 0 | 90
  /** The design's own size in points — 2.8" × 0.8" (201.6 × 57.6) on true-size sheets. */
  designW: number
  designH: number
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

/** Geometry for an explicit preset (up26 / up30; any grid that fits on Letter). */
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
  const rotation: 0 | 90 = preset.rotationDeg === 90 ? 90 : 0
  const summary = opts.summary ??
    `${labelsPerPage} per sheet · ${dimsLabel(SLAB_LABEL_W_IN, SLAB_LABEL_H_IN)} true size${rotation ? ', sideways' : ''}`
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
    labelRotation: rotation,
    designW: SLAB_LABEL_W_IN * INCH,
    designH: SLAB_LABEL_H_IN * INCH,
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
  if (density === 'up26' || density === 'up30') {
    // Fixed true-size stock: every slot is a 2.8" × 0.8" slab label whatever
    // size the design was authored at.
    return geometryFromPreset(density === 'up26' ? UP26_PRESET : UP30_PRESET, {
      density, duplexFlip: opts.duplexFlip, offsetsIn: opts.offsetsIn,
    })
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
    labelRotation: 0,
    designW: labelW,
    designH: labelH,
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
 * `?density=dense` / `20` → 'dense'; `26` / `up26` → 'up26'; `30` / `up30` /
 * `30up` → 'up30' (true-size sideways). The Sept 28 aliases `avery5160` /
 * `5160` also resolve to 'up30' so old bookmarks still print a 30-up sheet
 * (now at true size). Anything else → 'standard'.
 */
export function parseSheetDensity(value: string | null | undefined): SheetDensity {
  const v = (value || '').trim().toLowerCase()
  if (v === 'dense' || v === '20') return 'dense'
  if (v === 'up26' || v === '26' || v === '26up') return 'up26'
  if (v === 'up30' || v === '30' || v === '30up' || v === 'avery5160' || v === '5160') return 'up30'
  return 'standard'
}

/** True for the true-size pre-perforated layouts (26 / 30 per sheet). */
export function isTrueSizeDensity(density: SheetDensity): boolean {
  return density === 'up26' || density === 'up30'
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
 * design's size (ignored by up26 / up30, whose slots are fixed at 2.8" × 0.8").
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

// ---------------------------------------------------------------------------
// Duplex for true-size layouts (up26 / up30)
// ---------------------------------------------------------------------------
//
// Page coordinates: x right, y DOWN, points, as each side is seen when it is
// facing you upright. W = 612, H = 792.
//
// 1. Where a point lands on the other side. The printer prints the backs page
//    so that it reads upright after you flip the sheet over the stated edge:
//      long edge (portrait Letter: the vertical 11" edge) — turn about the
//        sheet's VERTICAL axis:   front (x, y)  is behind back (W − x, y)
//      short edge (the 8.5" edge) — turn about the HORIZONTAL axis:
//                                 front (x, y)  is behind back (x, H − y)
//    So the back slot sits at the flipped rectangle (long: columns mirror,
//    short: rows mirror). Both grids are centred on the page, so the flipped
//    rectangle is exactly another slot of the same grid.
//
// 2. Which way the back must be drawn. A cut slab label is turned over about
//    ITS OWN vertical axis (left <-> right, the axis that runs along the 0.8"
//    side when the label reads normally). Write the label's reading frame as
//    unit vectors r (reading right) and d (reading down). On the front page
//    they are r_f = R(θ)·x̂, d_f = R(θ)·ŷ, θ = the front rotation (clockwise,
//    y-down). Turning the cut label over about d keeps d and reverses r
//    (physically). Seen from the back page those physical directions become
//    S·(−r_f) and S·d_f, where S is the linear part of the flip in step 1:
//    S_long = diag(−1, 1), S_short = diag(1, −1). The back must therefore be
//    drawn with rotation φ such that R(φ)·x̂ = −S·r_f and R(φ)·ŷ = S·d_f, i.e.
//        R(φ) = S · R(θ) · diag(−1, 1)
//    long : diag(−1,1)·R(θ)·diag(−1,1) = R(−θ)      → φ = −θ
//    short: diag(1,−1)·R(θ)·diag(−1,1) = R(180° − θ) → φ = 180° − θ
//
//      layout            front θ   long-edge back φ   short-edge back φ
//      up26 (upright)       0°            0°                180°
//      up30 (sideways)     90°          270° (−90°)          90°
//
//    Sanity check for up30: the label's turn-over axis (its 0.8" direction)
//    runs ACROSS the sheet, i.e. the sheet's horizontal axis — exactly the
//    short-edge flip axis — so a short-edge flip needs no extra turn (φ = θ),
//    while a long-edge flip needs the back turned 180° relative to the front.
//    For up26 the turn-over axis is the sheet's vertical axis (= long edge).
//
// 3. Calibration. `global*` shifts both sides, `back*` the backs side, each in
//    that side's own printed coordinates — they are simply added to the final
//    printed rectangle. Zero offsets = the nominal grid.

/** Normalises an angle to 0 / 90 / 180 / 270. */
function normDeg(deg: number): 0 | 90 | 180 | 270 {
  const d = (((Math.round(deg / 90) * 90) % 360) + 360) % 360
  return d as 0 | 90 | 180 | 270
}

/** Back rotation φ (degrees clockwise) for a front rotation θ and flip edge. */
export function backRotationDeg(frontRotationDeg: number, flip: DuplexFlip): 0 | 90 | 180 | 270 {
  return normDeg(flip === 'short' ? 180 - frontRotationDeg : -frontRotationDeg)
}

/** Where one label prints on one side of a true-size sheet, points. */
export interface SlotPlacement {
  /** Grid cell on THIS side's page, as that side is seen upright. */
  row: number
  col: number
  /** Index on this side's page (row-major). */
  slot: number
  /** Footprint rectangle on this side's page (offsets applied). */
  x: number
  y: number
  w: number
  h: number
  /** Rotation of the 2.8" × 0.8" design inside the footprint, degrees clockwise. */
  rotation: 0 | 90 | 180 | 270
}

/** The nominal (uncalibrated) footprint of a grid cell on the front page. */
function cellRect(g: SheetGeometry, row: number, col: number) {
  return {
    x: g.firstLabelX + col * g.cellW,
    y: g.firstLabelY + row * g.cellH,
    w: g.labelW,
    h: g.labelH,
  }
}

/**
 * The back-page grid cell that sits behind front cell (row, col):
 * long edge mirrors the column, short edge mirrors the row.
 */
export function backCellBehind(g: SheetGeometry, row: number, col: number): { row: number; col: number } {
  return g.duplexFlip === 'short'
    ? { row: g.rows - 1 - row, col }
    : { row, col: g.cols - 1 - col }
}

/**
 * Placement of label `index` (row-major on the FRONT) on the given side of a
 * true-size sheet. The back is computed from the front by the physical flip
 * (see the block comment above), not from a mirrored index, so it is correct
 * by construction; `backCellBehind` is the same answer as a grid cell.
 */
export function slotPlacement(g: SheetGeometry, index: number, side: 'front' | 'back'): SlotPlacement {
  const row = Math.floor(index / g.cols)
  const col = index % g.cols
  const f = cellRect(g, row, col)
  const o = g.offsets
  if (side === 'front') {
    return {
      row, col, slot: index,
      x: f.x + o.frontX, y: f.y + o.frontY, w: f.w, h: f.h,
      rotation: normDeg(g.labelRotation),
    }
  }
  const bx = g.duplexFlip === 'short' ? f.x : PAGE_W_PT - f.x - f.w
  const by = g.duplexFlip === 'short' ? PAGE_H_PT - f.y - f.h : f.y
  const cell = backCellBehind(g, row, col)
  return {
    row: cell.row, col: cell.col, slot: cell.row * g.cols + cell.col,
    x: bx + o.backX, y: by + o.backY, w: f.w, h: f.h,
    rotation: backRotationDeg(g.labelRotation, g.duplexFlip),
  }
}

/**
 * A point given in the label's own DESIGN coordinates (u right / v down as
 * the label reads, 0..designW × 0..designH points) → page coordinates on the
 * side `p` was computed for. Rotation is clockwise about the footprint
 * centre, matching react-pdf `rotate()` and canvas `rotate()` (y down).
 */
export function designToPage(g: SheetGeometry, p: SlotPlacement, u: number, v: number): { x: number; y: number } {
  const cx = p.x + p.w / 2
  const cy = p.y + p.h / 2
  const dx = u - g.designW / 2
  const dy = v - g.designH / 2
  const t = (p.rotation * Math.PI) / 180
  const c = Math.round(Math.cos(t))
  const s = Math.round(Math.sin(t))
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c }
}

/** Every perforation line of a true-size sheet, inches from the top-left paper corner. */
export function perforationLinesIn(g: SheetGeometry): { verticalIn: number[]; horizontalIn: number[] } {
  const xs = new Set<number>()
  const ys = new Set<number>()
  for (let c = 0; c < g.cols; c++) {
    const x = g.firstLabelX + c * g.cellW
    xs.add(round4(x / INCH)); xs.add(round4((x + g.labelW) / INCH))
  }
  for (let r = 0; r < g.rows; r++) {
    const y = g.firstLabelY + r * g.cellH
    ys.add(round4(y / INCH)); ys.add(round4((y + g.labelH) / INCH))
  }
  const sort = (a: number, b: number) => a - b
  return { verticalIn: [...xs].sort(sort), horizontalIn: [...ys].sort(sort) }
}
