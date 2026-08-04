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

export function fitHeritageFront(primaryName: string, contextLine: string, serial?: string): HeritageFrontFit {
  const name = fitLines(primaryName, HERITAGE_PX.TEXT_BOX, 84, 30, 3)
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
  return { name, ctx, rulesOk: vClear || hClear }
}
