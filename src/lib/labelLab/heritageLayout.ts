/**
 * Heritage label — shared layout math and palette resolution.
 *
 * Two renderers draw this label: the @react-pdf document (heritageSlabPdfDoc,
 * print) and the Studio's live SVG preview (HeritageLabelPreview, browser).
 * Everything both need — theme colours, text fitting, the band palette rules,
 * the mockup-px geometry — lives here so the preview cannot drift from what
 * actually prints. This module must stay free of @react-pdf imports: the
 * preview is client-bundled and must not pull the PDF engine in statically.
 *
 * All geometry is in "mockup px": the design was authored at 1400 x 400 for a
 * 2.8" x 0.8" label. The PDF renderer maps px -> points; the SVG preview uses
 * the px values directly inside a 1400x400 viewBox.
 */
import { fitLines, widthOf, type FitResult } from './textFit'
import { isStockLayout, type OrgLabelDesign, type BandPosition, type LogoZone } from '@/lib/labels/orgLabelDesign'

// ---------------------------------------------------------------------------
// Geometry (mockup px, 1400 x 400)
// ---------------------------------------------------------------------------
export const HERITAGE_PX = {
  W: 1400, H: 400,
  BAND_W: 90, RULE_W: 6,
  // Front text block
  TEXT_X: 150, TEXT_Y: 50, TEXT_BOX: 940,
  // Front grade chip
  CHIP_X: 1130, CHIP_Y: 64, CHIP_W: 240, CHIP_H: 240 * (252 / 240), CHIP_R: 28, CHIP_BORDER: 6,
  // Front bottom-centre mark
  MARK_W: 260, MARK_H: 96, MARK_BOTTOM: 8, MARK_SCALE: 0.85, RULE_LEN: 112, RULE_GAP: 20,
  // Back
  QR_X: 132, QR_Y: 52, QR_BOX: 296, QR_IMG: 280, QR_LOGO_DISC: 70, QR_LOGO: 56,
  // Serial, centred under the QR box. The QR encodes the serial but is not
  // eyeball-sortable, and front/back are two separate stickers — printing the
  // number here is what lets a stack of backs be matched to a stack of fronts
  // by hand. 28px = 4.03pt at true size, just above the ~4pt floor where an
  // inkjet starts dithering small type; the 8px gap keeps it off the QR's
  // quiet zone and its descender-free box ends at 384 of the 400px height.
  QR_SERIAL_GAP: 8, QR_SERIAL_SIZE: 28, QR_SERIAL_TRACK: 2,
  EMBLEM_XS: [458, 532, 606] as const, EMBLEM_TOP: 40, EMBLEM_SLOT: 56, EMBLEM_TRACK: 240,
  EMBLEM_GLYPH: 46, EMBLEM_WORD_CENTER: 180, EMBLEM_WORD_H: 34,
  GRADE_X: 700, GRADE_Y: 60, GRADE_W: 360,
  SUBS_RIGHT: 70, SUBS_TOP: 84, SUBS_W: 300,
} as const

// ---------------------------------------------------------------------------
// Geometry engine (enterprise Label Designer)
// ---------------------------------------------------------------------------
/**
 * Every front-label rect, derived from an org design document. With no
 * document (consumers, orgs that never opened the designer) the output is the
 * HERITAGE_PX constants above, number for number — the isolation gate
 * (scripts/label-design-snapshot.ts) holds the renderers to that.
 *
 * The design is a set of BOUNDED choices; this function is where they become
 * rects, and the rules that keep the label printable live here rather than in
 * any renderer:
 *   - the band (any edge, any width) and the optional border carve the
 *     content rect; everything else lives inside it;
 *   - the chip anchors to the content's right edge and caps at its height;
 *   - a side-zone logo takes a square column and hands the text whatever
 *     width is left — the fitter shrinks type, it never overlaps;
 *   - the text stack gets a hard floor (maxBottom) so a short content rect
 *     (top/bottom band) can never push the serial off the label.
 */
export interface Rect { x: number; y: number; w: number; h: number }

export interface HeritageGeometry {
  W: number; H: number
  /** Inside the border stroke, or the whole label. */
  outer: Rect
  /** Stroke-centred rect + stroke width, mockup px. null = no border. */
  border: (Rect & { width: number; color: string }) | null
  band: Rect & { position: BandPosition; horizontal: boolean }
  rule: Rect
  /** Outer minus band + rule: where text, chip and mark live. */
  content: Rect
  text: { x: number; y: number; w: number; maxBottom: number; scale: number }
  chip: { x: number; y: number; w: number; h: number; r: number; bw: number; scale: number }
  logo: {
    zone: LogoZone
    /** The side column (left/right zones); null for the bottom strip. */
    column: Rect | null
    scale: number
    offset: { x: number; y: number }
    accentRules: boolean
  }
  /** Accent-bar anchors the fitter tests the serial against (content-relative). */
  barTop: number
  barLeft: number
  /** Nothing in the document moves any stock rect. */
  stock: boolean
}

/** Mockup px per inch (1400 px = 2.8"). */
export const HERITAGE_PX_PER_INCH = 500

export function heritageGeometry(design?: OrgLabelDesign | null): HeritageGeometry {
  const PX = HERITAGE_PX
  const W = PX.W, H = PX.H
  const stock = isStockLayout(design)
  const d = design ?? null

  let outer: Rect = { x: 0, y: 0, w: W, h: H }
  let border: HeritageGeometry['border'] = null
  if (d?.border.enabled) {
    const wPx = d.border.width * HERITAGE_PX_PER_INCH
    const iPx = d.border.inset * HERITAGE_PX_PER_INCH
    border = { x: iPx + wPx / 2, y: iPx + wPx / 2, w: W - 2 * (iPx + wPx / 2), h: H - 2 * (iPx + wPx / 2), width: wPx, color: d.border.color }
    outer = { x: iPx + wPx, y: iPx + wPx, w: W - 2 * (iPx + wPx), h: H - 2 * (iPx + wPx) }
  }

  const bandW = PX.BAND_W * (d?.band.width ?? 1)
  const position: BandPosition = d?.band.position ?? 'left'
  const R = PX.RULE_W
  let band: HeritageGeometry['band']
  let rule: Rect
  let content: Rect
  switch (position) {
    case 'right':
      band = { x: outer.x + outer.w - bandW, y: outer.y, w: bandW, h: outer.h, position, horizontal: false }
      rule = { x: band.x - R, y: outer.y, w: R, h: outer.h }
      content = { x: outer.x, y: outer.y, w: outer.w - bandW - R, h: outer.h }
      break
    case 'top':
      band = { x: outer.x, y: outer.y, w: outer.w, h: bandW, position, horizontal: true }
      rule = { x: outer.x, y: outer.y + bandW, w: outer.w, h: R }
      content = { x: outer.x, y: outer.y + bandW + R, w: outer.w, h: outer.h - bandW - R }
      break
    case 'bottom':
      band = { x: outer.x, y: outer.y + outer.h - bandW, w: outer.w, h: bandW, position, horizontal: true }
      rule = { x: outer.x, y: band.y - R, w: outer.w, h: R }
      content = { x: outer.x, y: outer.y, w: outer.w, h: outer.h - bandW - R }
      break
    default:
      band = { x: outer.x, y: outer.y, w: bandW, h: outer.h, position: 'left', horizontal: false }
      rule = { x: outer.x + bandW, y: outer.y, w: R, h: outer.h }
      content = { x: outer.x + bandW + R, y: outer.y, w: outer.w - bandW - R, h: outer.h }
  }

  // Chip: right-anchored, vertically centred with the stock 10px lift, capped
  // at the content height so a top/bottom band can never clip it.
  let cs = d?.chip.scale ?? 1
  const chipCapH = content.h - 32
  if (PX.CHIP_H * cs > chipCapH) cs = chipCapH / PX.CHIP_H
  const chipW = PX.CHIP_W * cs
  const chipH = PX.CHIP_H * cs
  const chip = {
    x: content.x + content.w - 30 - chipW,
    y: content.y + (content.h - chipH) / 2 - 10 * (content.h / H),
    w: chipW, h: chipH, r: PX.CHIP_R * cs, bw: PX.CHIP_BORDER * cs, scale: cs,
  }

  // Logo zone.
  const zone: LogoZone = d?.logo.zone ?? 'bottom'
  const logoScale = d?.logo.scale ?? 1
  const offset = d?.logo.offset ?? { x: 0, y: 0 }
  let column: Rect | null = null
  let textX = content.x + 54
  let textRight = chip.x - 40
  if (zone === 'left' || zone === 'right') {
    const side = Math.min(240 * logoScale, content.h - 48)
    const colX = zone === 'left' ? content.x + 30 : chip.x - 30 - side
    column = { x: colX, y: content.y + 24, w: side, h: content.h - 48 }
    if (zone === 'left') textX = column.x + column.w + 30
    else textRight = column.x - 30
  }
  const text = {
    x: textX,
    y: content.y + Math.min(50, content.h * 0.125),
    w: textRight - textX,
    maxBottom: content.y + content.h - 12,
    scale: d?.text.scale ?? 1,
  }

  return {
    W, H, outer, border, band, rule, content, text, chip,
    logo: { zone, column, scale: logoScale, offset, accentRules: d?.logo.accentRules ?? true },
    // Stock: bars at y 341 with the left bar's zone starting at x 438.
    barTop: content.y + content.h - 59,
    barLeft: content.x + 342,
    stock,
  }
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
export interface HeritageTheme {
  field: string; ink: string; inkSoft: string
  rule: string; edge: string; edgeWidth: number; divider: string
}

/**
 * Screen vs print theme. The production Studio always uses the print-hardened
 * theme — the ivory 2% tint dithers into speckle on consumer inkjets, so the
 * hardened theme drops to paper white and darkens every structural element.
 * See heritageSlabPdfDoc for the full rationale.
 */
export function heritageTheme(hardened: boolean): HeritageTheme {
  return hardened
    ? {
        field: '#FFFFFF', ink: '#1F2937', inkSoft: '#4B5563',
        rule: '#101014', edge: '#141414', edgeWidth: 1, divider: '#101014',
      }
    : {
        field: '#FAF8F4', ink: '#141414', inkSoft: '#5A5A5A',
        rule: '#A67C1B', edge: '#E5DECF', edgeWidth: 0.5, divider: '#D9D2C4',
      }
}

// ---------------------------------------------------------------------------
// Band palette
// ---------------------------------------------------------------------------
/** DCM brand purples — the band fallback when a card has no extracted colours. */
export const HERITAGE_BRAND_COLORS = ['#7c3aed', '#4c1d95', '#a855f7', '#2e1065', '#c4b5fd']

/**
 * Band colours for a card: its extracted palette first, then edge colours,
 * then primary/secondary, then the brand set. Mirrors the Label Lab's
 * cardDerivedColors resolution so Studio and Lab agree per card.
 */
export function resolveHeritageBandColors(cardColors: {
  palette?: string[] | null
  topEdgeColors?: string[] | null
  primary?: string | null
  secondary?: string | null
} | null | undefined): string[] {
  const cc = cardColors
  if (cc?.palette && cc.palette.length >= 2) return cc.palette.slice(0, 5)
  if (cc?.topEdgeColors && cc.topEdgeColors.length >= 2) return cc.topEdgeColors.slice(0, 5)
  if (cc?.primary) return [cc.primary, cc.secondary || cc.primary]
  return HERITAGE_BRAND_COLORS
}

// ---------------------------------------------------------------------------
// Text fitting
// ---------------------------------------------------------------------------
/** CJK + full-width ranges: kana, CJK unified (+ext A), compat, full-width forms. */
export const HERITAGE_CJK_RE = /[　-ヿ㐀-鿿豈-﫿＀-￯]/

/** Tracking applied to the context line, and therefore part of its fit. */
export const heritageCtxTracking = (size: number) => (size > 24 ? 4 : 2)

export interface HeritageFrontFit {
  name: FitResult
  ctx: FitResult
  /**
   * False when the fitted stack runs into the bottom strip, where the logo's
   * accent bars would underline the serial — the bars yield, the mark stays.
   */
  rulesOk: boolean
  /** Bottom of the fitted text stack, in label px — the mark's growth ceiling. */
  textBottom: number
  /** Right edge of the serial line — the accent bars must stay clear of it. */
  serialRight: number
  /** Top of the serial row: a mark clear of the serial horizontally may rise this high. */
  serialTop: number
}

// ---------------------------------------------------------------------------
// Back layout
// ---------------------------------------------------------------------------
export interface HeritageBackLayout {
  /** X of each SHOWN emblem slot, in display order (compacted, no gaps). */
  emblemXs: number[]
  /** Centre of the grade + condition column. */
  centerX: number
  /** Left/right bounds the grade column may occupy. */
  left: number
  right: number
  /** Condition line, fitted to the available width. */
  condSize: number
  condTracking: number
}

/**
 * Solve the back's middle column so the grade + condition sit CENTRED in
 * whatever space the left cluster (QR + shown emblems) and the right cluster
 * (sub-grades) leave — and so a long condition never runs under either.
 * Emblems compact leftward instead of holding fixed slots, so one badge does
 * not strand dead space in the middle.
 */
export function heritageBackLayout(opts: {
  showFounder?: boolean
  showCardLover?: boolean
  showVip?: boolean
  hasSubgrades: boolean
  condition: string
}): HeritageBackLayout {
  const P = HERITAGE_PX
  const shown = [opts.showFounder, opts.showCardLover, opts.showVip].filter(Boolean).length
  const SLOT_PITCH = 74
  const firstX = P.EMBLEM_XS[0]
  const emblemXs = Array.from({ length: shown }, (_, i) => firstX + i * SLOT_PITCH)
  // Left bound: after the emblems, or after the QR box when none are shown.
  const left = shown > 0 ? firstX + shown * SLOT_PITCH + 6 : P.QR_X + P.QR_BOX + 20
  // Right bound: where the sub-grade column starts, or near the band edge.
  const right = opts.hasSubgrades ? P.W - P.SUBS_RIGHT - P.SUBS_W : P.W - 60
  const centerX = (left + right) / 2
  const avail = right - left - 24
  // Fit the condition: relax tracking first (7 -> 3), then size (34 -> 24).
  let condSize = 34
  let condTracking = 7
  const fits = () => widthOf(opts.condition, condSize, condTracking) <= avail
  while (!fits() && condTracking > 3) condTracking -= 1
  while (!fits() && condSize > 24) condSize -= 1
  return { emblemXs, centerX, left, right, condSize, condTracking }
}

/**
 * Bold-width compensation for the name fit. textWidthEm measures regular
 * weight; Helvetica-Bold runs ~6% wider on mixed case and ~12% on capitals
 * (bold caps are 0.72em vs the table's 0.64) — all-caps names like "ONE
 * HUNDRED AND ONE DALMATIANS" sat visibly into the grade chip at a flat 6%.
 */
export function boldFitFactor(text: string): number {
  const letters = (text.match(/[A-Za-z]/g) || []).length
  if (!letters) return 1.06
  const caps = (text.match(/[A-Z]/g) || []).length
  return 1.06 + 0.06 * (caps / letters)
}

/** Bottom of a fitted stack: block top, name + context rows, gap, divider (+margins), serial row. */
function stackBottom(top: number, name: FitResult, ctx: FitResult): number {
  return (
    top +
    name.rows.length * name.size * 1.06 +
    Math.max(name.size * 0.28, 18) +
    ctx.rows.length * ctx.size * 1.2 +
    (24 + 6) + (18 + 34 * 1.2)
  )
}

export function fitHeritageFront(primaryName: string, contextLine: string, serial?: string, geom?: HeritageGeometry): HeritageFrontFit {
  const g = geom ?? heritageGeometry(null)
  let nameMax = Math.round(84 * g.text.scale)
  let ctxMax = Math.round(30 * g.text.scale)
  let name = fitLines(primaryName, g.text.w / boldFitFactor(primaryName), nameMax, 30, 3)
  // Context floor is 24 (3.5pt at true size): below that an inkjet dithers the
  // line into noise. The fitter never truncates — long lines wrap a row earlier.
  let ctx = fitLines((contextLine || '').toUpperCase(), g.text.w, ctxMax, 24, 3, heritageCtxTracking)
  // Approximate bottom of the stack: block top, name and context rows at their
  // line heights, gap, divider (+margins), serial row.
  let textBottom = stackBottom(g.text.y, name, ctx)
  // Designer layouts with a short content rect (top/bottom band, border):
  // step the maximum sizes down until the stack clears the floor. The stock
  // stack never reaches it, so consumers never enter this loop.
  while (textBottom > g.text.maxBottom && nameMax > 40) {
    nameMax -= 6
    ctxMax = Math.max(24, ctxMax - 1)
    name = fitLines(primaryName, g.text.w / boldFitFactor(primaryName), nameMax, 30, 3)
    ctx = fitLines((contextLine || '').toUpperCase(), g.text.w, ctxMax, 24, 3, heritageCtxTracking)
    textBottom = stackBottom(g.text.y, name, ctx)
  }
  // The logo accent bars only collide with the serial line if BOTH hold: the
  // stack reaches down into the bar row (bars sit at y 341-347), AND the
  // serial text extends rightward into the left bar's zone (bars start at
  // x 438). A blanket depth test hid the bars on every two-row-context label
  // even when the serial stopped 200px short of them.
  const BAR_TOP = g.barTop
  const BAR_LEFT = g.barLeft
  const serialRight = g.text.x + widthOf(`Serial: ${serial ?? ''}`, 34, 2)
  const vClear = textBottom + 6 <= BAR_TOP
  const hClear = serial != null && serialRight + 16 <= BAR_LEFT
  // The serial row is the only text the mark can sit BESIDE (it is short and
  // left-aligned); everything above it spans the full text box.
  const serialTop = textBottom - (18 + 34 * 1.2)
  return { name, ctx, rulesOk: vClear || hClear, textBottom, serialRight, serialTop }
}

// ---------------------------------------------------------------------------
// Logo mark sizing
// ---------------------------------------------------------------------------
/**
 * Enterprise logo scale bounds. 1 is the historic mark size (0.85 of the
 * 260x96 slot). Stores with a square or stacked logo need more than that —
 * 'meet' fitting caps a square mark at the slot's 96px height, which is what
 * made it read as tiny — so the range runs up to 2x. The floor exists for
 * wide wordmarks that look better understated.
 */
export const HERITAGE_LOGO_SCALE = { min: 0.7, max: 2, step: 0.05, default: 1 } as const

export interface HeritageMarkBox {
  /** Image rect, already centred inside the slot. */
  x: number; y: number; w: number; h: number
  /** Y of the accent bars' top edge, and their inner x bounds. */
  ruleY: number; ruleLeft: number; ruleRight: number; ruleLen: number
  /** True when the requested scale had to be reduced to clear the text. */
  clamped: boolean
}

/**
 * Geometry for the bottom-centre mark at a requested scale.
 *
 * The mark grows from a FIXED BASELINE (the bottom of the historic slot), not
 * from its centre: growing symmetrically would push it off the bottom edge,
 * since the slot already sits 8px from it. Growth therefore goes upward, and
 * upward is where the text stack lives — so the height is clamped to keep a
 * gap below `textBottom` for the card actually being rendered. A store can ask
 * for 2x and get it on a short name, and quietly get less on a long one,
 * rather than shipping a label with the mark printed over the serial.
 *
 * Shared by the on-screen SVG preview and the print PDF so the two cannot
 * drift. Callers in PDF space multiply the returned numbers by their own unit
 * scale.
 */
/**
 * Whether the accent bars still fit beside a (possibly enlarged) mark. The
 * bars grow outward with the mark, so a big logo can push the left bar into
 * the serial even when fitHeritageFront judged the fixed-size bars clear.
 */
export function heritageRulesFit(fit: HeritageFrontFit, box: HeritageMarkBox): boolean {
  return fit.rulesOk && box.ruleLeft >= fit.serialRight + 16
}

/**
 * The largest logo scale this layout can still honour for a fitted card —
 * past it the mark is clamped and the number changes nothing. The designer
 * caps its slider here so the control stops where the element stops.
 */
export function heritageLogoScaleMax(geom: HeritageGeometry, fit: Pick<HeritageFrontFit, 'textBottom' | 'serialRight' | 'serialTop'>): number {
  if (geom.logo.column) {
    return Math.max(HERITAGE_LOGO_SCALE.min, Math.min(1.5, (geom.content.h - 48) / 240))
  }
  const baseH = HERITAGE_PX.MARK_H * HERITAGE_PX.MARK_SCALE
  const atMax = heritageMarkBox(HERITAGE_LOGO_SCALE.max, fit, geom)
  return Math.max(HERITAGE_LOGO_SCALE.min, Math.min(HERITAGE_LOGO_SCALE.max, Math.round((atMax.h / baseH) * 100) / 100))
}

/** Largest chip scale the content rect can hold (the geometry caps past it). */
export function heritageChipScaleMax(geom: HeritageGeometry, limit: number): number {
  return Math.max(0.8, Math.min(limit, Math.round(((geom.content.h - 32) / HERITAGE_PX.CHIP_H) * 100) / 100))
}

export function heritageMarkBox(
  scale: number,
  fit: Pick<HeritageFrontFit, 'textBottom' | 'serialRight' | 'serialTop'> | number,
  geom?: HeritageGeometry,
): HeritageMarkBox {
  // Number form kept for callers that only know the text bottom.
  const f = typeof fit === 'number'
    ? { textBottom: fit, serialRight: Number.POSITIVE_INFINITY, serialTop: fit }
    : fit
  const PX = HERITAGE_PX
  const g = geom ?? heritageGeometry(null)

  // Side columns (designer 'left' / 'right' zones): a square mark inside the
  // column, slid vertically by the offset. No accent bars, no text ceiling —
  // the column already reserved its width from the text box.
  if (g.logo.column) {
    const c = g.logo.column
    const side = c.w
    const travel = Math.max(0, (c.h - side) / 2)
    const y = c.y + (c.h - side) / 2 + g.logo.offset.y * travel
    return {
      x: c.x, y, w: side, h: side,
      ruleY: y + side / 2 - 3,
      ruleLeft: Number.NEGATIVE_INFINITY, ruleRight: Number.POSITIVE_INFINITY, ruleLen: 0,
      clamped: side < 240 * g.logo.scale - 0.5,
    }
  }

  const requested = Math.min(
    HERITAGE_LOGO_SCALE.max,
    Math.max(HERITAGE_LOGO_SCALE.min, Number.isFinite(scale) ? scale : 1)
  )
  const baseW = PX.MARK_W * PX.MARK_SCALE
  const baseH = PX.MARK_H * PX.MARK_SCALE
  const content = g.content
  // Baseline the mark sits on: bottom of the historic slot.
  const bottom = content.y + content.h - PX.MARK_BOTTOM - (PX.MARK_H - baseH) / 2
  // Ceiling: 10px of air under the text stack, never above y=232 (the mark
  // must stay a bottom-strip element even when the card has a one-line name).
  // Two ceilings. STRICT keeps the mark under the whole text stack. RELAXED
  // lets it rise alongside the serial — legal only when the mark is clear of
  // the serial horizontally, which depends on the mark's own width, so solve
  // with the relaxed ceiling first and fall back if the result overlaps.
  const floor = content.y + 232 * (content.h / PX.H)
  const strict = Math.max(floor, f.textBottom + 10)
  const relaxed = Math.max(floor, f.serialTop + 4)
  const wantH = baseH * requested
  // Centred on the LABEL (not the content rect): "bottom-centre" reads as the
  // physical centre whichever edge the band sits on. The designer offset
  // slides it toward the band-side padding or the chip, never under either.
  const solve = (ceiling: number) => {
    const maxH = Math.max(baseH * HERITAGE_LOGO_SCALE.min, bottom - ceiling)
    const hh = Math.min(wantH, maxH)
    const ww = baseW * (hh / baseH)
    let xx = (g.outer.w - ww) / 2 + g.outer.x
    if (g.logo.offset.x !== 0) {
      const leftLimit = content.x + 24
      const rightLimit = g.chip.x - 16 - ww
      const travel = g.logo.offset.x > 0 ? Math.max(0, rightLimit - xx) : Math.max(0, xx - leftLimit)
      xx += g.logo.offset.x * travel
    }
    return { hh, ww, xx }
  }
  let { hh: h, ww: w, xx: x } = solve(relaxed)
  if (x < f.serialRight + 16) ({ hh: h, ww: w, xx: x } = solve(strict))
  const y = bottom - h
  const ruleY = y + h / 2 - 3
  return {
    x, y, w, h,
    ruleY,
    ruleLeft: x - PX.RULE_GAP - PX.RULE_LEN,
    ruleRight: x + w + PX.RULE_GAP,
    ruleLen: PX.RULE_LEN,
    clamped: h < wantH - 0.5,
  }
}
