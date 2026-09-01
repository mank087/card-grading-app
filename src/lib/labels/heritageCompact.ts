/**
 * Heritage Compact — the Heritage design fitted to the two small holders.
 *
 * Standard Heritage is authored for the 2.8" x 0.8" slab slot (aspect 3.50).
 * The small holders need their own layouts rather than a scale-down:
 *
 *   One-Touch  (Avery 6871)  2.375" x 0.625" per folded panel, aspect 3.80.
 *     Within 8% of Heritage's aspect, so the FULL layout survives — band,
 *     gold rule, name, context, divider, serial, grade chip, wordmark. The
 *     context line is nudged up because a direct map lands it at 3.4pt,
 *     under the size where an inkjet dithers small type into noise.
 *
 *   Toploader  (Avery 8167)  1.75" x 0.5", aspect 3.50 — the SAME aspect as
 *     Heritage but at 62.5% scale, which puts the context at 2.7pt and the
 *     serial at 3.1pt. So this is a REDUCTION: the divider and the FRONT's
 *     serial are dropped, the name takes the reclaimed vertical, and the
 *     context shortens to set + year. The BACK still prints the serial under
 *     its grade — front and back are separate stickers here, and the printed
 *     number is the only way to match a stack of one to a stack of the other.
 *
 *   Toploader fold-over  folds on the label's CENTRE VERTICAL and each half
 *     is rotated 90 degrees by drawFoldOverLabel, so the READING area is
 *     PORTRAIT 0.5" x 0.875". At half an inch wide nothing sits beside
 *     anything else: band across the top, grade chip, wordmark, serial.
 *
 * Everything renders to a canvas so the existing jsPDF Avery sheets (with
 * their calibration offsets and position pickers) can place it as an image —
 * no rewrite of the sheet machinery.
 *
 * The mark is the DCM wordmark WITHOUT the logo's card outline: at these
 * sizes the outline closes into a smudge and only the letterforms read.
 */
import { bandGeometry, type BandPattern } from '@/lib/labelLab/bandGeometry'
import { EMBLEMS, EMBLEM_ORDER } from '@/lib/labelLab/emblemShapes'
import { resolveGradeChip, GRADE_10_FOIL_STOPS, GRADE_CHIP_WHITE_LABEL_INK, type GradeChipTheme } from '@/lib/labelPresets'
import { applyTextTransform, type TextTransform } from '@/lib/labels/orgLabelDesign'

/** Print-hardened Heritage theme — these labels exist to be printed. */
const FIELD = '#FFFFFF'
const INK = '#1F2937'
const INK_SOFT = '#4B5563'
const RULE = '#101014'
const DIVIDER = '#101014'
const FONT = 'Helvetica, Arial, sans-serif'

/** Wordmark asset (letterforms only, transparent). */
export const WORDMARK_BLACK = '/DCM-wordmark-black.png'
/** Natural aspect of the wordmark asset (830 x 322). */
const WORDMARK_AR = 830 / 322

export interface HeritageCompactInputs {
  primaryName: string
  /** Full context line — used on One-Touch. */
  contextLine: string
  /** Short context (set + year) — used on the Toploader front. */
  contextShort?: string
  serial: string
  /** '1'..'10', 'A', or '—'. */
  grade: string
  condition: string
  subgrades?: { centering?: number | null; corners?: number | null; edges?: number | null; surface?: number | null }
  bandColors: string[]
  pattern: BandPattern
  /** Data URL of the DCM/store wordmark (black variant). */
  wordmarkDataUrl?: string | null
  /** Data URL of the QR code. */
  qrDataUrl?: string | null
  showFounderEmblem?: boolean
  showVipEmblem?: boolean
  showCardLoversEmblem?: boolean
  /**
   * Enterprise Label Designer chip colourway. The small holders have no room
   * for the designer's band/logo moves, so the chip theme is the one design
   * choice they honour; absent = the stock black chip.
   */
  chipTheme?: GradeChipTheme
  /**
   * Enterprise Label Designer house type case (design.text.transform). Applied
   * at render time to the name / context / condition / sub-grade labels;
   * absent = draw the strings exactly as stored, which is every consumer card.
   */
  textTransform?: TextTransform | null
}

/** House type case for one string on a compact label. */
const tc = (i: HeritageCompactInputs, s: string) => applyTextTransform(i.textTransform, s)

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------
function makeCanvas(wIn: number, hIn: number, dpi: number) {
  const c = document.createElement('canvas')
  c.width = Math.round(wIn * dpi)
  c.height = Math.round(hIn * dpi)
  const ctx = c.getContext('2d')!
  ctx.textBaseline = 'alphabetic'
  return { c, ctx, W: c.width, H: c.height }
}

const imgCache = new Map<string, Promise<HTMLImageElement | null>>()
function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = src
    }))
  }
  return imgCache.get(src)!
}

/** Largest font size at or below `start` that fits `text` in `maxW`. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, start: number, min: number, weight = '700') {
  let size = start
  while (size > min) {
    ctx.font = `${weight} ${size}px ${FONT}`
    if (ctx.measureText(text).width <= maxW) break
    size -= Math.max(0.5, size * 0.03)
  }
  ctx.font = `${weight} ${size}px ${FONT}`
  return size
}

/**
 * Fit like `fitFont`, then hand back the string that should actually be drawn.
 *
 * `fitFont` stops shrinking at its floor — below that an inkjet dithers the
 * type into noise — so a very long card name still overflowed its box and ran
 * into the grade chip. Past the floor, trim to the last WHOLE word that fits
 * and mark the cut with an ellipsis; a name that is visibly shortened reads,
 * a name that collides with the chip does not. Leaves ctx.font at the fitted
 * size, so callers just fillText the returned string.
 */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  start: number,
  min: number,
  weight = '700',
): string {
  fitFont(ctx, text, maxW, start, min, weight)
  if (ctx.measureText(text).width <= maxW) return text
  const ELL = '…'
  const words = text.split(/\s+/).filter(Boolean)
  for (let n = words.length - 1; n > 0; n--) {
    const candidate = `${words.slice(0, n).join(' ')}${ELL}`
    if (ctx.measureText(candidate).width <= maxW) return candidate
  }
  // One unbreakable word wider than the box — fall back to a character cut.
  const chars = [...text]
  while (chars.length > 1) {
    chars.pop()
    const candidate = `${chars.join('')}${ELL}`
    if (ctx.measureText(candidate).width <= maxW) return candidate
  }
  return ELL
}

/** Draw letter-spaced text; returns the drawn width. */
function trackedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number, align: 'left' | 'center' = 'left') {
  const chars = [...text]
  const total = chars.reduce((w, ch) => w + ctx.measureText(ch).width + tracking, 0) - tracking
  let cx = align === 'center' ? x - total / 2 : x
  for (const ch of chars) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + tracking
  }
  return total
}

/** Patterned Heritage band. Horizontal (`vertical: false`) puts it across the top. */
function drawBand(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colors: string[], pattern: BandPattern) {
  const g = bandGeometry(pattern, colors, w, h)
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.translate(x, y)
  if (g.gradientStops && g.gradientStops.length) {
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    g.gradientStops.forEach((c, i) => grad.addColorStop(g.gradientStops!.length > 1 ? i / (g.gradientStops!.length - 1) : 0, c))
    ctx.fillStyle = grad
  } else {
    ctx.fillStyle = g.base
  }
  ctx.fillRect(0, 0, w, h)
  for (const f of g.fills) {
    try { ctx.fillStyle = f.fill; ctx.fill(new Path2D(f.d)) } catch { /* skip malformed */ }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.lineWidth = g.strokeWidth
  for (const s of g.strokes) {
    try { ctx.stroke(new Path2D(s.d)) } catch { /* skip */ }
  }
  ctx.restore()
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Grade chip: black plate, grade-coloured numeral + keyline (print ramp). */
function drawChip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, grade: string, theme: GradeChipTheme = 'black') {
  const chipSpec = resolveGradeChip(grade, true, theme)
  const numeral = chipSpec.grade === 0 ? 'A' : String(chipSpec.grade)
  const isTen = chipSpec.grade === 10
  const stroke = Math.max(w * 0.025, 1)
  let paint: string | CanvasGradient = chipSpec.ink
  if (isTen) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h)
    GRADE_10_FOIL_STOPS.forEach((c, i) => g.addColorStop(i / (GRADE_10_FOIL_STOPS.length - 1), c))
    paint = g
  }
  roundRectPath(ctx, x + stroke / 2, y + stroke / 2, w - stroke, h - stroke, h * 0.11)
  ctx.fillStyle = chipSpec.fill
  ctx.fill()
  ctx.strokeStyle = paint as any
  ctx.lineWidth = stroke
  ctx.stroke()

  ctx.textAlign = 'center'
  const numSize = fitFont(ctx, numeral, w * 0.8, h * 0.6, h * 0.3)
  ctx.fillStyle = paint as any
  ctx.fillText(numeral, x + w / 2, y + h * 0.63)

  const labSize = Math.max(h * 0.125, 4)
  ctx.font = `700 ${labSize}px ${FONT}`
  // Stock: ivory knockout on black. White theme: dark ink, the numeral's own
  // colour for a solid grade, near-black under a foil 10.
  ctx.fillStyle = chipSpec.keyline ? (isTen ? GRADE_CHIP_WHITE_LABEL_INK : chipSpec.ink) : '#F4EFE4'
  const label = chipSpec.label
  // Shrink the label rather than let it run outside the chip.
  let ls = labSize
  while (ls > 3 && ctx.measureText(label).width + label.length * ls * 0.14 > w * 0.92) {
    ls -= 0.3
    ctx.font = `700 ${ls}px ${FONT}`
  }
  trackedText(ctx, label, x + w / 2, y + h * 0.87, ls * 0.14, 'center')
  ctx.textAlign = 'left'
}

function shownEmblems(i: HeritageCompactInputs) {
  const flags: Record<string, boolean | undefined> = {
    founder: i.showFounderEmblem, cardLover: i.showCardLoversEmblem, vip: i.showVipEmblem,
  }
  return EMBLEM_ORDER.filter(id => flags[id])
}

function drawEmblem(ctx: CanvasRenderingContext2D, id: keyof typeof EMBLEMS, x: number, y: number, size: number) {
  const e = EMBLEMS[id]
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 100, size / 100)
  try { ctx.fillStyle = e.color; ctx.fill(new Path2D(e.path)) } catch { /* skip */ }
  ctx.restore()
}

async function drawWordmark(ctx: CanvasRenderingContext2D, src: string | null | undefined, x: number, y: number, h: number) {
  const img = await loadImage(src || WORDMARK_BLACK)
  if (!img) return 0
  const w = h * WORDMARK_AR
  ctx.drawImage(img, x, y, w, h)
  return w
}

// ---------------------------------------------------------------------------
// A. ONE-TOUCH — 2.375" x 0.625" per folded panel
// ---------------------------------------------------------------------------
export const ONETOUCH_PANEL = { w: 2.375, h: 0.625 }

export async function renderOneTouchFront(i: HeritageCompactInputs, dpi: number): Promise<HTMLCanvasElement> {
  const { c, ctx, W, H } = makeCanvas(ONETOUCH_PANEL.w, ONETOUCH_PANEL.h, dpi)
  ctx.fillStyle = FIELD; ctx.fillRect(0, 0, W, H)

  const bw = W * 0.064, rw = Math.max(W * 0.0043, 1)
  drawBand(ctx, 0, 0, bw, H, i.bandColors, i.pattern)
  ctx.fillStyle = RULE; ctx.fillRect(bw, 0, rw, H)

  const tx = W * 0.107
  const textBox = W * 0.671

  ctx.fillStyle = INK
  ctx.fillText(fitText(ctx, tc(i, i.primaryName), textBox, H * 0.20, H * 0.11), tx, H * 0.30)

  const contextLine = tc(i, i.contextLine)
  const ctxSize = H * 0.082
  ctx.font = `400 ${ctxSize}px ${FONT}`
  ctx.fillStyle = INK_SOFT
  let cs = ctxSize
  while (cs > H * 0.055 && ctx.measureText(contextLine).width + contextLine.length * cs * 0.12 > textBox) {
    cs -= 0.3; ctx.font = `400 ${cs}px ${FONT}`
  }
  trackedText(ctx, contextLine, tx, H * 0.455, cs * 0.12)

  ctx.fillStyle = DIVIDER
  ctx.fillRect(tx, H * 0.53, textBox, Math.max(H * 0.016, 1))

  const serSize = H * 0.088
  ctx.font = `400 ${serSize}px ${FONT}`
  ctx.fillStyle = INK_SOFT
  trackedText(ctx, `Serial: ${i.serial}`, tx, H * 0.675, serSize * 0.06)

  const chipW = W * 0.171, chipH = H * 0.63
  drawChip(ctx, W - chipW - W * 0.021, (H - chipH) / 2 - H * 0.03, chipW, chipH, i.grade, i.chipTheme)

  const markH = H * 0.135
  const markW = markH * WORDMARK_AR
  const markX = (W - markW) / 2, markY = H - markH - H * 0.045
  await drawWordmark(ctx, i.wordmarkDataUrl, markX, markY, markH)
  ctx.fillStyle = RULE
  const barY = markY + markH / 2 - Math.max(H * 0.008, 0.5)
  const barH = Math.max(H * 0.016, 1)
  ctx.fillRect(markX - W * 0.062, barY, W * 0.05, barH)
  ctx.fillRect(markX + markW + W * 0.012, barY, W * 0.05, barH)

  return c
}

export async function renderOneTouchBack(i: HeritageCompactInputs, dpi: number): Promise<HTMLCanvasElement> {
  const { c, ctx, W, H } = makeCanvas(ONETOUCH_PANEL.w, ONETOUCH_PANEL.h, dpi)
  ctx.fillStyle = FIELD; ctx.fillRect(0, 0, W, H)

  const bw = W * 0.064, rw = Math.max(W * 0.0043, 1)
  drawBand(ctx, 0, 0, bw, H, i.bandColors, i.pattern)
  ctx.fillStyle = RULE; ctx.fillRect(bw, 0, rw, H)

  const qrS = H * 0.74, qrX = W * 0.10, qrY = (H - qrS) / 2
  const qr = await loadImage(i.qrDataUrl || '')
  ctx.fillStyle = '#fff'; ctx.fillRect(qrX - H * 0.02, qrY - H * 0.02, qrS + H * 0.04, qrS + H * 0.04)
  if (qr) ctx.drawImage(qr, qrX, qrY, qrS, qrS)

  // Serial under the QR. The front and back of a One-Touch label are the two
  // halves of one folded strip, but they are applied to opposite faces of the
  // holder and the QR cannot be eyeball-sorted, so the number is printed here
  // too. H*0.088 matches the front's serial size (~4pt at 0.625" tall) and the
  // baseline at 0.97H clears the QR's white pad, which ends at 0.89H.
  ctx.textAlign = 'center'
  ctx.font = `400 ${H * 0.088}px ${FONT}`
  ctx.fillStyle = INK_SOFT
  ctx.fillText(i.serial, qrX + qrS / 2, H * 0.97)
  ctx.textAlign = 'left'

  const em = shownEmblems(i)
  em.forEach((id, n) => drawEmblem(ctx, id, qrX + qrS + W * 0.035 + n * H * 0.20, H * 0.12, H * 0.15))

  const gx = W * 0.60
  ctx.textAlign = 'center'
  ctx.fillStyle = INK
  const gradeText = i.grade === '—' ? 'A' : i.grade
  fitFont(ctx, gradeText, W * 0.2, H * 0.38, H * 0.2)
  ctx.fillText(gradeText, gx, H * 0.52)
  const condSize = H * 0.095
  ctx.font = `700 ${condSize}px ${FONT}`
  trackedText(ctx, (i.condition || '').toUpperCase(), gx, H * 0.70, condSize * 0.18, 'center')
  ctx.textAlign = 'left'

  const subs: [string, number | null | undefined][] = [
    ['Centering', i.subgrades?.centering], ['Corners', i.subgrades?.corners],
    ['Edges', i.subgrades?.edges], ['Surface', i.subgrades?.surface],
  ]
  const shown = subs.filter(([, v]) => v != null && isFinite(Number(v)))
  ctx.textAlign = 'right'
  ctx.fillStyle = INK_SOFT
  ctx.font = `400 ${H * 0.09}px ${FONT}`
  shown.forEach(([k, v], n) => ctx.fillText(`${tc(i, k)}: ${Math.round(Number(v) * 2) / 2}`, W - W * 0.028, H * 0.24 + n * H * 0.20))
  ctx.textAlign = 'left'

  return c
}

// ---------------------------------------------------------------------------
// B. TOPLOADER front + back — 1.75" x 0.5"
// ---------------------------------------------------------------------------
export const TOPLOADER_PANEL = { w: 1.75, h: 0.5 }

export async function renderToploaderFront(i: HeritageCompactInputs, dpi: number): Promise<HTMLCanvasElement> {
  const { c, ctx, W, H } = makeCanvas(TOPLOADER_PANEL.w, TOPLOADER_PANEL.h, dpi)
  ctx.fillStyle = FIELD; ctx.fillRect(0, 0, W, H)

  const bw = W * 0.064, rw = Math.max(W * 0.005, 1)
  drawBand(ctx, 0, 0, bw, H, i.bandColors, i.pattern)
  ctx.fillStyle = RULE; ctx.fillRect(bw, 0, rw, H)

  const tx = W * 0.105
  const textBox = W * 0.66

  ctx.fillStyle = INK
  ctx.fillText(fitText(ctx, tc(i, i.primaryName), textBox, H * 0.265, H * 0.15), tx, H * 0.46)

  const short = tc(i, i.contextShort || i.contextLine)
  const ctxSize = H * 0.105
  ctx.font = `400 ${ctxSize}px ${FONT}`
  ctx.fillStyle = INK_SOFT
  let cs = ctxSize
  while (cs > H * 0.075 && ctx.measureText(short).width + short.length * cs * 0.14 > textBox) {
    cs -= 0.3; ctx.font = `400 ${cs}px ${FONT}`
  }
  trackedText(ctx, short, tx, H * 0.68, cs * 0.14)

  await drawWordmark(ctx, i.wordmarkDataUrl, tx, H * 0.78, H * 0.15)

  const chipW = W * 0.185, chipH = H * 0.68
  drawChip(ctx, W - chipW - W * 0.022, (H - chipH) / 2, chipW, chipH, i.grade, i.chipTheme)

  // Serial, restored to the FRONT (Sep 1). The space reduction that shrank this
  // panel to 1.75x0.5 dropped it, which left the toploader front as the only
  // Heritage panel with no serial on it at all — and the owner batch-printed a
  // run and could not read a serial without flipping every label over. It goes
  // in the bottom strip right of the wordmark, right-aligned to the text box's
  // edge: that band (y 0.78H-1.0H, x ~0.22W-0.79W) is empty, and ending at
  // 0.765W keeps it clear of the grade chip, whose left edge is 0.793W.
  //
  // H * 0.085 at 0.5" tall is ~3.06pt — the same size the BACK prints it at,
  // and above the 2.5pt legibility floor. Same INK_SOFT as the back so the two
  // faces match. 0.92 (not 0.91 as on the back) because the front has no
  // condition line above it to crowd; the descenders still clear the trim.
  // Sept 1: bumped from 0.085H/INK_SOFT — at 3.06pt in soft grey the printed
  // serial did not survive the owner's printer. ~3.5pt in full ink does.
  const serialText = `Serial: ${i.serial}`
  ctx.font = `400 ${H * 0.098}px ${FONT}`
  ctx.fillStyle = INK
  ctx.textAlign = 'right'
  ctx.fillText(serialText, tx + textBox, H * 0.92)
  ctx.textAlign = 'left'

  return c
}

export async function renderToploaderBack(i: HeritageCompactInputs, dpi: number): Promise<HTMLCanvasElement> {
  const { c, ctx, W, H } = makeCanvas(TOPLOADER_PANEL.w, TOPLOADER_PANEL.h, dpi)
  ctx.fillStyle = FIELD; ctx.fillRect(0, 0, W, H)

  const bw = W * 0.064, rw = Math.max(W * 0.005, 1)
  drawBand(ctx, 0, 0, bw, H, i.bandColors, i.pattern)
  ctx.fillStyle = RULE; ctx.fillRect(bw, 0, rw, H)

  const qrS = H * 0.80, qrX = W * 0.105, qrY = (H - qrS) / 2
  const qr = await loadImage(i.qrDataUrl || '')
  ctx.fillStyle = '#fff'; ctx.fillRect(qrX - H * 0.03, qrY - H * 0.03, qrS + H * 0.06, qrS + H * 0.06)
  if (qr) ctx.drawImage(qr, qrX, qrY, qrS, qrS)

  // Emblems right-align against the trim edge; the grade column then centres in
  // whatever the QR and that stack leave, so the panel never reads half-empty.
  const em = shownEmblems(i)
  const emSize = H * 0.20, emStep = H * 0.26
  const emX0 = W * 0.94 - emSize - Math.max(0, em.length - 1) * emStep
  const gx = ((qrX + qrS) + (em.length ? emX0 - W * 0.03 : W)) / 2
  ctx.textAlign = 'center'
  ctx.fillStyle = INK
  const gradeText = i.grade === '—' ? 'A' : i.grade
  fitFont(ctx, gradeText, W * 0.2, H * 0.42, H * 0.22)
  ctx.fillText(gradeText, gx, H * 0.50)
  const condSize = H * 0.11
  ctx.font = `700 ${condSize}px ${FONT}`
  trackedText(ctx, (i.condition || '').toUpperCase(), gx, H * 0.72, condSize * 0.2, 'center')
  // 0.91 keeps the serial's descenders inside a 0.5"-tall panel.
  // Sept 1: bumped from 0.085H/INK_SOFT — see the matching note on the front.
  ctx.font = `400 ${H * 0.098}px ${FONT}`
  ctx.fillStyle = INK
  ctx.fillText(`Serial: ${i.serial}`, gx, H * 0.91)
  ctx.textAlign = 'left'

  em.forEach((id, n) => drawEmblem(ctx, id, emX0 + n * emStep, H * 0.30, emSize))

  return c
}

// ---------------------------------------------------------------------------
// C. TOPLOADER FOLD-OVER — portrait reading area, 0.5" x 0.875"
// ---------------------------------------------------------------------------
export const FOLD_PANEL = { w: 0.5, h: 0.875 }

export async function renderFoldFront(i: HeritageCompactInputs, dpi: number): Promise<HTMLCanvasElement> {
  const { c, ctx, W, H } = makeCanvas(FOLD_PANEL.w, FOLD_PANEL.h, dpi)
  ctx.fillStyle = FIELD; ctx.fillRect(0, 0, W, H)

  const bh = H * 0.09, rh = Math.max(H * 0.011, 1)
  drawBand(ctx, 0, 0, W, bh, i.bandColors, i.pattern)
  ctx.fillStyle = RULE; ctx.fillRect(0, bh, W, rh)

  const chipW = W * 0.66, chipH = chipW * 1.05
  drawChip(ctx, (W - chipW) / 2, H * 0.16, chipW, chipH, i.grade, i.chipTheme)

  // Wordmark sits high enough that its box clears the serial's ascenders —
  // at 0.5" wide there is no room to recover from a collision.
  const wmW = W * 0.60, wmH = wmW / WORDMARK_AR
  await drawWordmark(ctx, i.wordmarkDataUrl, (W - wmW) / 2, H * 0.68, wmH)

  ctx.textAlign = 'center'
  ctx.font = `400 ${H * 0.045}px ${FONT}`
  ctx.fillStyle = INK_SOFT
  ctx.fillText(i.serial, W / 2, H * 0.90)
  ctx.textAlign = 'left'

  return c
}

export async function renderFoldBack(i: HeritageCompactInputs, dpi: number): Promise<HTMLCanvasElement> {
  const { c, ctx, W, H } = makeCanvas(FOLD_PANEL.w, FOLD_PANEL.h, dpi)
  ctx.fillStyle = FIELD; ctx.fillRect(0, 0, W, H)

  const bh = H * 0.09, rh = Math.max(H * 0.011, 1)
  drawBand(ctx, 0, 0, W, bh, i.bandColors, i.pattern)
  ctx.fillStyle = RULE; ctx.fillRect(0, bh, W, rh)

  const qrS = Math.min(W * 0.86, H * 0.5)
  const qr = await loadImage(i.qrDataUrl || '')
  if (qr) ctx.drawImage(qr, (W - qrS) / 2, H * 0.20, qrS, qrS)

  ctx.textAlign = 'center'
  ctx.fillStyle = INK
  const condSize = H * 0.05
  ctx.font = `700 ${condSize}px ${FONT}`
  trackedText(ctx, (i.condition || '').toUpperCase(), W / 2, H * 0.80, condSize * 0.16, 'center')
  ctx.font = `400 ${H * 0.04}px ${FONT}`
  ctx.fillStyle = INK_SOFT
  ctx.fillText(`Serial: ${i.serial}`, W / 2, H * 0.88)
  ctx.textAlign = 'left'

  return c
}

// ---------------------------------------------------------------------------
// Rotation — the fold formats print rotated so they read upright once folded.
// ---------------------------------------------------------------------------
/** Rotate a canvas by 90 / 180 / 270 degrees, returning a new canvas. */
export function rotateCanvas(src: HTMLCanvasElement, deg: 90 | 180 | 270): HTMLCanvasElement {
  const out = document.createElement('canvas')
  const swap = deg === 90 || deg === 270
  out.width = swap ? src.height : src.width
  out.height = swap ? src.width : src.height
  const ctx = out.getContext('2d')!
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.drawImage(src, -src.width / 2, -src.height / 2)
  return out
}

/**
 * The full One-Touch 6871 label as printed flat: 2.375" x 1.25", BACK on the
 * top half rotated 180 degrees, FRONT on the bottom. Fold the top panel down
 * behind the front and the back reads upright on the case.
 */
export async function renderOneTouchFoldSheet(i: HeritageCompactInputs, dpi: number): Promise<HTMLCanvasElement> {
  const front = await renderOneTouchFront(i, dpi)
  const back = await renderOneTouchBack(i, dpi)
  const flipped = rotateCanvas(back, 180)
  const out = document.createElement('canvas')
  out.width = front.width
  out.height = front.height * 2
  const ctx = out.getContext('2d')!
  ctx.fillStyle = FIELD
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(flipped, 0, 0)
  ctx.drawImage(front, 0, front.height)
  return out
}

/**
 * The full fold-over 8167 label as printed flat: 1.75" x 0.5", FRONT in the
 * left half rotated 90 CW, BACK in the right half rotated 90 CCW — matching
 * drawFoldOverLabel, so both stand upright once folded over the edge.
 */
export async function renderFoldOverSheet(i: HeritageCompactInputs, dpi: number): Promise<HTMLCanvasElement> {
  const front = rotateCanvas(await renderFoldFront(i, dpi), 90)
  const back = rotateCanvas(await renderFoldBack(i, dpi), 270)
  const out = document.createElement('canvas')
  out.width = Math.round(TOPLOADER_PANEL.w * dpi)
  out.height = Math.round(TOPLOADER_PANEL.h * dpi)
  const ctx = out.getContext('2d')!
  ctx.fillStyle = FIELD
  ctx.fillRect(0, 0, out.width, out.height)
  const half = Math.round(out.width / 2)
  ctx.drawImage(front, 0, 0, half, out.height)
  ctx.drawImage(back, half, 0, out.width - half, out.height)

  // Bleed across the fold.
  //
  // Both halves carry their band on the edge that meets the seam, and until
  // now they were butted with nothing between them: a rounded half, a JPEG
  // seam or a fold a hair off centre showed a white hairline down the middle
  // of the band. Extend each half's seam column a small margin PAST the fold
  // line into its neighbour — ~2.5% of the label height, well inside the band
  // on either side — so any slip lands on band colour, never on bare paper.
  // Sampled one pixel IN from each seam edge — the outermost column can carry
  // an antialiased sliver from the 90-degree rotation. Smoothing off so the
  // stretched column stays a flat colour instead of fading at its edges.
  const bleed = Math.max(2, Math.round(out.height * 0.025))
  const smoothing = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(front, Math.max(0, front.width - 2), 0, 1, front.height, half, 0, bleed, out.height)
  ctx.drawImage(back, Math.min(1, back.width - 1), 0, 1, back.height, half - bleed, 0, bleed, out.height)
  ctx.imageSmoothingEnabled = smoothing
  return out
}
