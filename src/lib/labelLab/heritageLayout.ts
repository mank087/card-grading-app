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
  EMBLEM_XS: [458, 532, 606] as const, EMBLEM_TOP: 40, EMBLEM_SLOT: 56, EMBLEM_TRACK: 240,
  EMBLEM_GLYPH: 46, EMBLEM_WORD_CENTER: 180, EMBLEM_WORD_H: 34,
  GRADE_X: 700, GRADE_Y: 60, GRADE_W: 360,
  SUBS_RIGHT: 70, SUBS_TOP: 84, SUBS_W: 300,
} as const

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

export function fitHeritageFront(primaryName: string, contextLine: string, serial?: string): HeritageFrontFit {
  const name = fitLines(primaryName, HERITAGE_PX.TEXT_BOX / boldFitFactor(primaryName), 84, 30, 3)
  // Context floor is 24 (3.5pt at true size): below that an inkjet dithers the
  // line into noise. The fitter never truncates — long lines wrap a row earlier.
  const ctx = fitLines((contextLine || '').toUpperCase(), HERITAGE_PX.TEXT_BOX, 30, 24, 3, heritageCtxTracking)
  // Approximate bottom of the stack: block top, name and context rows at their
  // line heights, gap, divider (+margins), serial row.
  const textBottom =
    HERITAGE_PX.TEXT_Y +
    name.rows.length * name.size * 1.06 +
    Math.max(name.size * 0.28, 18) +
    ctx.rows.length * ctx.size * 1.2 +
    (24 + 6) + (18 + 34 * 1.2)
  // The logo accent bars only collide with the serial line if BOTH hold: the
  // stack reaches down into the bar row (bars sit at y 341-347), AND the
  // serial text extends rightward into the left bar's zone (bars start at
  // x 438). A blanket depth test hid the bars on every two-row-context label
  // even when the serial stopped 200px short of them.
  const BAR_TOP = 341
  const BAR_LEFT = 438
  const serialRight = HERITAGE_PX.TEXT_X + widthOf(`Serial: ${serial ?? ''}`, 34, 2)
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

export function heritageMarkBox(scale: number, fit: Pick<HeritageFrontFit, 'textBottom' | 'serialRight' | 'serialTop'> | number): HeritageMarkBox {
  // Number form kept for callers that only know the text bottom.
  const f = typeof fit === 'number'
    ? { textBottom: fit, serialRight: Number.POSITIVE_INFINITY, serialTop: fit }
    : fit
  const PX = HERITAGE_PX
  const requested = Math.min(
    HERITAGE_LOGO_SCALE.max,
    Math.max(HERITAGE_LOGO_SCALE.min, Number.isFinite(scale) ? scale : 1)
  )
  const baseW = PX.MARK_W * PX.MARK_SCALE
  const baseH = PX.MARK_H * PX.MARK_SCALE
  // Baseline the mark sits on: bottom of the historic slot.
  const bottom = PX.H - PX.MARK_BOTTOM - (PX.MARK_H - baseH) / 2
  // Ceiling: 10px of air under the text stack, never above y=232 (the mark
  // must stay a bottom-strip element even when the card has a one-line name).
  // Two ceilings. STRICT keeps the mark under the whole text stack. RELAXED
  // lets it rise alongside the serial — legal only when the mark is clear of
  // the serial horizontally, which depends on the mark's own width, so solve
  // with the relaxed ceiling first and fall back if the result overlaps.
  const strict = Math.max(232, f.textBottom + 10)
  const relaxed = Math.max(232, f.serialTop + 4)
  const wantH = baseH * requested
  const solve = (ceiling: number) => {
    const maxH = Math.max(baseH * HERITAGE_LOGO_SCALE.min, bottom - ceiling)
    const hh = Math.min(wantH, maxH)
    const ww = baseW * (hh / baseH)
    return { hh, ww, xx: (PX.W - ww) / 2 }
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
