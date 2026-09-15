/**
 * Classic label ("Traditional", rebuilt Sept 2026) — shared layout math.
 *
 * PORT OF THE WEB SOURCE OF TRUTH: src/lib/labelLab/classicLayout.ts
 * (plus the two helpers it needs from src/lib/labelLab/textFit.ts —
 * textWidthEm / widthOf). Function names, constants and behaviour are kept
 * identical on purpose: the native slab face must fit text exactly the way the
 * printed PDF and the web SVG preview do. If the web module changes, mirror
 * the change here. scripts/_tmp-classic-parity-check.ts asserts the two
 * fitters agree row-for-row.
 *
 * Deliberately free of react / react-native imports so it stays a pure,
 * testable module (the parity check runs it under plain node).
 */

// ---------------------------------------------------------------------------
// Text measurement (port of labelLab/textFit.ts)
// ---------------------------------------------------------------------------

/**
 * Width of a string at 1em, approximated per character class. Font-metric
 * free, which is exactly why it can be shared between @react-pdf, the browser
 * SVG and React Native without any of the three measuring differently.
 */
export function textWidthEm(t: string): number {
  let w = 0
  for (const ch of t) {
    if (/[　-鿿＀-￯]/.test(ch)) w += 1.0
    else if (/[MW@%]/.test(ch)) w += 0.90
    else if (/[mw]/.test(ch)) w += 0.85
    else if (/[A-Z0-9#&]/.test(ch)) w += 0.64
    else if (/[iljtfrI1.,'’!\[\]()|]/.test(ch)) w += 0.30
    else if (ch === ' ') w += 0.28
    else w += 0.53
  }
  return w
}

/** Rendered width including letter-spacing. */
export function widthOf(t: string, size: number, tracking: number): number {
  return textWidthEm(t) * size + Math.max(0, t.length - 1) * tracking
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

/** The DCM brand purple — HERITAGE_BRAND_COLORS[0] on both platforms. */
export const CLASSIC_PURPLE = '#7c3aed'

/** Near-black type ink. Not pure black: it sits better beside the purple. */
export const CLASSIC_INK = '#141026'

/** The muted ink used for the verify URL on the back. */
export const CLASSIC_INK_SOFT = '#5b5670'

export const CLASSIC_FIELD = '#FFFFFF'

/** Same range as the web's HERITAGE_CJK_RE. */
export const CLASSIC_CJK_RE = /[　-ヿ㐀-鿿豈-﫿＀-￯]/

// ---------------------------------------------------------------------------
// Geometry (design units, 1400 x 400 = 2.8" x 0.8")
// ---------------------------------------------------------------------------

export const CLASSIC_PX = {
  W: 1400,
  H: 400,

  /** Purple frame thickness on all four sides. */
  FRAME: 27,
  /** Corner radius of the inner white field. */
  FIELD_R: 5,

  /** Faint purple waves across the field. */
  WAVE_COUNT: 5,
  WAVE_OPACITY: 0.045,
  WAVE_WIDTH: 17,
  WAVE_Y0: 60,
  WAVE_STEP: 70,

  // --- Left identification column -----------------------------------------
  LEFT_X: 65,
  /** Four FIXED baselines. Lines never wrap; a blank line is simply not drawn. */
  LEFT_BASELINES: [95, 160, 225, 290] as const,
  LEFT_TRACK: 1,
  /** Starting size for lines 1-3, and the (smaller) cap for the line-4 notation. */
  LEFT_SIZE_MAX: 52,
  LEFT_SIZE_MAX_L4: 46,
  /** Below this an inkjet dithers caps at 2.8"; we truncate instead of shrinking. */
  LEFT_SIZE_MIN: 34,
  /** Air between the left column and the right column's left edge. */
  LEFT_RIGHT_GAP: 30,

  // --- Right grade column (right-aligned, never shrinks) --------------------
  RIGHT_X: 1335,
  NUM_SIZE: 50, NUM_BASELINE: 85,
  DESC_SIZE: 42, DESC_BASELINE: 150,
  GRADE_SIZE: 115, GRADE_BASELINE: 260,
  SERIAL_SIZE: 50, SERIAL_BASELINE: 330,

  // --- Logo plate, bottom centre, straddling the frame ---------------------
  PLATE_X: 605, PLATE_Y: 275, PLATE_W: 190, PLATE_H: 125,
  PLATE_R: 14, PLATE_STROKE: 5,
  /** The mark image box inside the plate. */
  MARK_X: 625, MARK_Y: 283, MARK_W: 150, MARK_H: 110,
  /** Hard keep-out for the left column's fourth baseline. */
  PLATE_KEEPOUT_LEFT: 590,
  PLATE_KEEPOUT_RIGHT: 810,
  PLATE_KEEPOUT_TOP: 262,

  // --- Back ----------------------------------------------------------------
  /** DCM mark, left, vertically centred. */
  BACK_MARK_X: 85, BACK_MARK_W: 315, BACK_MARK_H: 250,
  /** Centre line of the cert block. */
  BACK_CENTER_X: 735,
  CERT_SIZE: 38, CERT_BASELINE: 165, CERT_TRACK: 5,
  BACK_SERIAL_SIZE: 80, BACK_SERIAL_BASELINE: 250, BACK_SERIAL_MIN: 44,
  VERIFY_SIZE: 27, VERIFY_BASELINE: 300, VERIFY_MIN: 18,
  /** QR image box, and the white plate padding that keeps the waves off it. */
  QR_X: 1055, QR_Y: 60, QR_BOX: 280, QR_PAD: 20,
} as const

/** Inner white field rect. */
export const classicField = () => ({
  x: CLASSIC_PX.FRAME,
  y: CLASSIC_PX.FRAME,
  w: CLASSIC_PX.W - CLASSIC_PX.FRAME * 2,
  h: CLASSIC_PX.H - CLASSIC_PX.FRAME * 2,
  r: CLASSIC_PX.FIELD_R,
})

/**
 * The five wave paths, as SVG path data in design units.
 *
 * Kept for parity with the web module (and so a future react-native-svg build
 * can draw them); the native face has no SVG engine and skips the waves.
 */
export function classicWavePaths(): string[] {
  const out: string[] = []
  for (let i = 0; i < CLASSIC_PX.WAVE_COUNT; i++) {
    const y = CLASSIC_PX.WAVE_Y0 + i * CLASSIC_PX.WAVE_STEP
    out.push(`M -50 ${y} C 200 ${y - 45}, 450 ${y + 45}, 700 ${y} S 1200 ${y - 45}, 1450 ${y}`)
  }
  return out
}

/** The QR's white plate (QR box grown by QR_PAD on every side). */
export const classicQrPlate = () => ({
  x: CLASSIC_PX.QR_X - CLASSIC_PX.QR_PAD,
  y: CLASSIC_PX.QR_Y - CLASSIC_PX.QR_PAD,
  w: CLASSIC_PX.QR_BOX + CLASSIC_PX.QR_PAD * 2,
  h: CLASSIC_PX.QR_BOX + CLASSIC_PX.QR_PAD * 2,
})

/** Back mark box (vertically centred on the label). */
export const classicBackMark = () => ({
  x: CLASSIC_PX.BACK_MARK_X,
  y: (CLASSIC_PX.H - CLASSIC_PX.BACK_MARK_H) / 2,
  w: CLASSIC_PX.BACK_MARK_W,
  h: CLASSIC_PX.BACK_MARK_H,
})

// ---------------------------------------------------------------------------
// Line composition
// ---------------------------------------------------------------------------

export interface ClassicLineSource {
  primaryName?: string | null
  /** "Set • Subset • #Number • Year" (labelDataGenerator.buildContextLine). */
  contextLine?: string | null
  features?: string[] | null
  featuresLine?: string | null
  serial?: string | null
  grade?: number | null
  gradeFormatted?: string | null
  condition?: string | null
  isAlteredAuthentic?: boolean | null
  /** v9.23 notation, e.g. "Altered - Unverified Autograph". */
  designation?: string | null
  /** Structured overrides (preferred when present). */
  setName?: string | null
  subset?: string | null
  cardNumber?: string | null
  formattedCardNumber?: string | null
  year?: string | null
  /** 'on-card' | 'sticker' | 'unverified' | 'none' — from autographPolicy. */
  autographType?: string | null
  autographed?: boolean | null
  /** Parallel / variety, when the caller knows it structurally. */
  rarity_or_variant?: string | null
  op_variant_type?: string | null
}

export interface ClassicLines {
  /** [year + set, card name, variety/features, designation]. '' = not drawn. */
  left: [string, string, string, string]
  right: { number: string; descriptor: string; grade: string; serial: string }
}

const SEP = ' • '
const YEAR_RE = /^(1[89]|20)\d{2}(\s*[-/]\s*\d{2,4})?$/

/** Split a pre-formatted context line back into its parts. */
export function parseClassicContext(contextLine: string | null | undefined): {
  setParts: string[]; number: string; year: string; features: string[]
} {
  const segs = String(contextLine ?? '').split(SEP).map(s => s.trim()).filter(Boolean)
  const setParts: string[] = []
  const features: string[] = []
  let number = ''
  let year = ''
  let seenYear = false
  for (const seg of segs) {
    if (seg.startsWith('#')) { if (!number) number = seg; continue }
    if (!seenYear && YEAR_RE.test(seg)) { year = seg; seenYear = true; continue }
    if (seenYear) features.push(seg)
    else setParts.push(seg)
  }
  return { setParts, number, year, features }
}

/** Uppercase for display. CJK is unaffected by toUpperCase, so it passes through. */
const up = (s: string) => s.toUpperCase()

/** Feature tokens line 4 already states. */
const AUTO_FEATURE_RE = /^(auto|autograph|autographed|on-card auto(graph)?|sticker auto(graph)?)$/i

/** The four left lines and the four right values for a card. */
export function classicLines(data: ClassicLineSource): ClassicLines {
  const parsed = parseClassicContext(data.contextLine)

  // Line 1 — year + set.
  const year = (data.year || parsed.year || '').trim()
  const setParts = data.setName
    ? [data.setName, data.subset || ''].filter(Boolean).map(String)
    : parsed.setParts
  const l1 = up([year, ...setParts].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim())

  // Line 2 — the card name.
  const l2 = up((data.primaryName || '').trim())

  // Line 4 — the designation, resolved BEFORE line 3.
  const autoType = (data.autographType || '').toLowerCase()
  let l4 = ''
  if (data.designation) l4 = up(data.designation.trim())
  else if (autoType === 'on-card') l4 = 'ON-CARD AUTOGRAPH'
  else if (autoType === 'sticker') l4 = 'STICKER AUTOGRAPH'
  else if (data.autographed) l4 = 'AUTOGRAPH'

  // Line 3 — variety / parallel / features, space-joined.
  const rawFeatures: string[] = data.features && data.features.length
    ? data.features.map(String)
    : data.featuresLine
      ? String(data.featuresLine).split(SEP).map(s => s.trim()).filter(Boolean)
      : parsed.features
  const structuredVariety = [data.rarity_or_variant, data.op_variant_type]
    .filter(Boolean).map(String)
  const featureTokens = (structuredVariety.length ? structuredVariety : rawFeatures)
    .filter(f => !(l4 && AUTO_FEATURE_RE.test(f)))
  const l3 = up(featureTokens.join(' ').replace(/\s+/g, ' ').trim())

  // Right column.
  const number = (data.formattedCardNumber
    || (data.cardNumber ? (data.cardNumber.startsWith('#') ? data.cardNumber : `#${data.cardNumber}`) : '')
    || parsed.number).trim()
  const hasGrade = data.grade !== null && data.grade !== undefined && isFinite(Number(data.grade))
  const descriptor = up(
    (!hasGrade && data.isAlteredAuthentic ? 'Authentic' : (data.condition || '')).trim()
  )
  const grade = data.gradeFormatted
    ? String(data.gradeFormatted)
    : hasGrade
      ? Math.round(Number(data.grade)).toString()
      : (data.isAlteredAuthentic ? 'A' : 'N/A')

  return {
    left: [l1, l2, l3, l4],
    right: { number, descriptor, grade, serial: (data.serial || '').trim() },
  }
}

// ---------------------------------------------------------------------------
// Fitting
// ---------------------------------------------------------------------------

/** Bold-width compensation (widthOf measures REGULAR weight). */
export function classicBoldFactor(text: string): number {
  const letters = (text.match(/[A-Za-z]/g) || []).length
  if (!letters) return 1.06
  const caps = (text.match(/[A-Z]/g) || []).length
  return 1.06 + 0.06 * (caps / letters)
}

export interface ClassicRightMetrics {
  /** Left edge of the right column's widest value, in design units. */
  colLeft: number
  widths: { number: number; descriptor: number; grade: number; serial: number }
}

/** Where the right column starts. The right column NEVER shrinks. */
export function classicRightMetrics(right: ClassicLines['right']): ClassicRightMetrics {
  const P = CLASSIC_PX
  const m = (t: string, size: number) => (t ? widthOf(t, size, 0) * classicBoldFactor(t) : 0)
  const widths = {
    number: m(right.number, P.NUM_SIZE),
    descriptor: m(right.descriptor, P.DESC_SIZE),
    grade: m(right.grade, P.GRADE_SIZE),
    serial: m(right.serial, P.SERIAL_SIZE),
  }
  const widest = Math.max(widths.number, widths.descriptor, widths.grade, widths.serial, 0)
  return { colLeft: P.RIGHT_X - widest, widths }
}

/** Maximum width per BASELINE SLOT; only slot 3 is capped by the logo plate. */
export function classicLeftMaxWidths(right: ClassicLines['right']): [number, number, number, number] {
  const P = CLASSIC_PX
  const { colLeft } = classicRightMetrics(right)
  const wide = Math.max(60, colLeft - P.LEFT_RIGHT_GAP - P.LEFT_X)
  const narrow = Math.max(60, Math.min(wide, P.PLATE_KEEPOUT_LEFT - P.LEFT_X))
  return [wide, wide, wide, narrow]
}

export interface ClassicFrontFit {
  /** The shared size driving slots 0-2. */
  size: number
  /** Size per SLOT (slot 3 is capped at LEFT_SIZE_MAX_L4). */
  sizes: [number, number, number, number]
  /** Text per BASELINE SLOT, top-down on baselines 95 / 160 / 225 / 290. */
  rows: [string, string, string, string]
  truncated: [boolean, boolean, boolean, boolean]
  /** Source line index per slot (0 set, 1 name, 2 variety, 3 designation), -1 unused. */
  sources: [number, number, number, number]
}

const ELLIPSIS = '…'

/** Longest prefix of `t` whose width (plus an ellipsis) fits `max`. */
function truncateTo(t: string, size: number, tracking: number, max: number): string {
  const bold = classicBoldFactor(t)
  const fits = (s: string) => widthOf(s, size, tracking) * bold <= max
  if (fits(t)) return t
  let lo = 0
  let hi = t.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (fits(t.slice(0, mid).trimEnd() + ELLIPSIS)) lo = mid
    else hi = mid - 1
  }
  return lo <= 0 ? ELLIPSIS : t.slice(0, lo).trimEnd() + ELLIPSIS
}

/**
 * Fit the four left lines onto the four fixed baselines: compact non-empty
 * lines upward into the slots, shrink UNIFORMLY 52 -> 34, then ellipsize.
 */
export function fitClassicFront(
  lines: readonly [string, string, string, string] | string[],
  opts?: {
    /** Per-SLOT maxima; defaults to classicLeftMaxWidths for `right`. */
    maxWidths?: readonly number[]
    right?: ClassicLines['right']
    tracking?: number
  },
): ClassicFrontFit {
  const P = CLASSIC_PX
  const tracking = opts?.tracking ?? P.LEFT_TRACK
  const fallback = P.PLATE_KEEPOUT_LEFT - P.LEFT_X
  const maxWidths = (opts?.maxWidths
    ?? (opts?.right ? classicLeftMaxWidths(opts.right) : [fallback, fallback, fallback, fallback])) as readonly number[]

  // Compact: non-empty source lines, in order, into the baseline slots.
  const packed: string[] = []
  const sources: [number, number, number, number] = [-1, -1, -1, -1]
  for (let i = 0; i < 4; i++) {
    const t = (lines[i] || '').trim()
    if (!t) continue
    sources[packed.length] = i
    packed.push(t)
  }
  const text: [string, string, string, string] = [
    packed[0] || '', packed[1] || '', packed[2] || '', packed[3] || '',
  ]

  const sizeFor = (slot: number, size: number) =>
    (slot === 3 ? Math.min(P.LEFT_SIZE_MAX_L4, size) : size)
  const fitsAt = (size: number) =>
    text.every((t, slot) =>
      !t || widthOf(t, sizeFor(slot, size), tracking) * classicBoldFactor(t) <= (maxWidths[slot] ?? Infinity))

  let size = P.LEFT_SIZE_MAX
  while (size > P.LEFT_SIZE_MIN && !fitsAt(size)) size -= 1

  const sizes: [number, number, number, number] = [
    sizeFor(0, size), sizeFor(1, size), sizeFor(2, size), sizeFor(3, size),
  ]
  const rows = text.map((t, slot) =>
    t ? truncateTo(t, sizes[slot], tracking, maxWidths[slot] ?? Infinity) : ''
  ) as [string, string, string, string]
  const truncated = rows.map((r, slot) => r !== text[slot]) as [boolean, boolean, boolean, boolean]

  return { size, sizes, rows, truncated, sources }
}

// ---------------------------------------------------------------------------
// Back fitting
// ---------------------------------------------------------------------------

export interface ClassicBackFit {
  serialSize: number
  urlSize: number
  /** Half-width the centred block may occupy either side of BACK_CENTER_X. */
  half: number
}

/** Both centred back rows shrink to the window between the mark and the QR plate. */
export function fitClassicBack(serial: string, verifyUrl: string): ClassicBackFit {
  const P = CLASSIC_PX
  const mark = classicBackMark()
  const plate = classicQrPlate()
  const left = mark.x + mark.w + 20
  const right = plate.x - 20
  const half = Math.max(80, Math.min(P.BACK_CENTER_X - left, right - P.BACK_CENTER_X))
  const avail = half * 2

  let serialSize = P.BACK_SERIAL_SIZE
  while (serialSize > P.BACK_SERIAL_MIN && widthOf(serial, serialSize, 0) * classicBoldFactor(serial) > avail) serialSize -= 1
  let urlSize = P.VERIFY_SIZE
  while (urlSize > P.VERIFY_MIN && widthOf(verifyUrl, urlSize, 0) > avail) urlSize -= 1

  return { serialSize, urlSize, half }
}
