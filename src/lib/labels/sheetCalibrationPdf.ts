/**
 * Printable duplex alignment test + vendor spec for the TRUE-SIZE
 * pre-perforated slab label sheets (sheetGeometry 'up26' and 'up30').
 *
 *   Page 1 (FRONT)  — every 2.8" × 0.8" label outline in black, drawn the way
 *                     the label sits on the sheet (sideways on the 30-up),
 *                     numbered and marked "TOP" along the label's reading top
 *                     edge, with a centre cross + circle; margin ticks at
 *                     every perforation line.
 *   Page 2 (BACK)   — the outlines where the backs print (sheetGeometry
 *                     slotPlacement: flipped for the chosen edge, turned per
 *                     label, calibration applied), dashed red, each with a red
 *                     1/32" scale through the centre and "BACK n" written the
 *                     way the back reads. Held to a light, the black front
 *                     cross reads off the red scale; once cut, turning a label
 *                     over left-to-right shows "BACK n" upright.
 *   Page 3 (SPEC)   — exact dimensions and every perforation line for the
 *                     vendor, loading / flip instructions, the measuring
 *                     steps, and the calibration this sheet used.
 *
 * Print pages 1-2 duplex at 100% scale; page 3 prints on its own sheet.
 * Uses the SAME geometry + calibration code path as the label generators, so
 * what lines up here lines up on the real labels.
 */
import { jsPDF } from 'jspdf'
import {
  resolveSheetGeometry,
  slotPlacement,
  designToPage,
  perforationLinesIn,
  duplexFlipText,
  backRotationDeg,
  type DuplexFlip,
  type SheetGeometry,
  type SheetOffsetsIn,
  type SlotPlacement,
} from './sheetGeometry'

const INCH = 72
const PAGE_W = 612
const PAGE_H = 792
const TICK = INCH / 32

export type TrueSizeDensity = 'up26' | 'up30'

export interface PerforatedCalibrationOptions {
  /** Which true-size sheet to test. Default 'up30' (sideways). */
  density?: TrueSizeDensity
  duplexFlip?: DuplexFlip
  offsetsIn?: Partial<SheetOffsetsIn> | null
}

const fmt = (v: number) => `${(Math.round(v * 10000) / 10000).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}"`
const mm = (v: number) => `${(v * 25.4).toFixed(2)} mm`

/** Human description of a layout, for headers and the spec page. */
export function trueSizeLayoutText(g: SheetGeometry): string {
  return g.labelRotation === 90
    ? `${g.labelsPerPage} per sheet — ${g.cols} columns × ${g.rows} rows, labels SIDEWAYS (0.8" wide × 2.8" tall on the sheet)`
    : `${g.labelsPerPage} per sheet — ${g.cols} columns × ${g.rows} rows, labels upright (2.8" wide × 0.8" tall)`
}

/** Text drawn in a label's own reading frame (jsPDF angles are counter-clockwise). */
function labelText(doc: jsPDF, g: SheetGeometry, p: SlotPlacement, text: string, u: number, v: number, align: 'left' | 'right' = 'left') {
  // jsPDF's own `align` works along the PAGE x axis, not the rotated
  // baseline, so right-alignment is done here in label coordinates.
  const start = align === 'right' ? u - doc.getTextWidth(text) : u
  const pt = designToPage(g, p, start, v)
  doc.text(text, pt.x, pt.y, { angle: -p.rotation })
}

function labelLine(doc: jsPDF, g: SheetGeometry, p: SlotPlacement, u1: number, v1: number, u2: number, v2: number) {
  const a = designToPage(g, p, u1, v1)
  const b = designToPage(g, p, u2, v2)
  doc.line(a.x, a.y, b.x, b.y)
}

export function buildPerforatedCalibrationDoc(opts: PerforatedCalibrationOptions = {}): jsPDF {
  const density: TrueSizeDensity = opts.density === 'up26' ? 'up26' : 'up30'
  const g = resolveSheetGeometry({
    labelWIn: 2.8,
    labelHIn: 0.8,
    density,
    duplexFlip: opts.duplexFlip,
    offsetsIn: opts.offsetsIn,
  })
  const nominal = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density })
  const P = g.preset
  const perf = perforationLinesIn(nominal)
  const DW = g.designW
  const DH = g.designH
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const n = g.labelsPerPage
  const sideways = g.labelRotation === 90

  // ---------------- Page 1: FRONT ----------------
  const headY = Math.max(10, g.firstLabelY - 14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor('#111111')
  doc.text(`DCM ${n}-up TRUE-SIZE alignment test — FRONT (page 1 of 2). Print pages 1-2 DUPLEX, ${duplexFlipText(g)}, 100% / Actual Size.`,
    PAGE_W / 2, headY - (sideways ? 9 : 0), { align: 'center' })
  if (sideways) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor('#555555')
    doc.text(`Every box must measure exactly 2.8" x 0.8" (sideways: 0.8" across, 2.8" down). Margins ${fmt(P.marginLeftIn)} left/right, ${fmt(P.marginTopIn)} top/bottom. No gaps.`,
      PAGE_W / 2, headY, { align: 'center' })
  }

  doc.setDrawColor('#000000')
  doc.setTextColor('#111111')
  for (let i = 0; i < n; i++) {
    const p = slotPlacement(g, i, 'front')
    doc.setLineWidth(0.5)
    doc.setLineDashPattern([], 0)
    doc.rect(p.x, p.y, p.w, p.h, 'S')
    const cx = p.x + p.w / 2
    const cy = p.y + p.h / 2
    doc.setLineWidth(0.35)
    doc.line(cx - 12, cy, cx + 12, cy)
    doc.line(cx, cy - 12, cx, cy + 12)
    doc.circle(cx, cy, 4, 'S')
    // Reading-frame marks: number + "TOP" along the label's top edge, a bar
    // under the top edge so orientation is obvious once cut.
    doc.setFontSize(7)
    labelText(doc, g, p, `${i + 1} FRONT`, 5, 11)
    doc.setFontSize(5.5)
    labelText(doc, g, p, 'TOP', DW - 5, 9, 'right')
    labelText(doc, g, p, '2.8" x 0.8"', DW - 5, DH - 5, 'right')
    labelLine(doc, g, p, DW / 2 - 30, 3, DW / 2 + 30, 3)
  }

  // Perforation lines extended into the margins (vendor check) + labels.
  const firstF = slotPlacement(g, 0, 'front')
  const blockL = firstF.x
  const blockT = firstF.y
  const blockR = blockL + (g.cols - 1) * g.cellW + g.labelW
  const blockB = blockT + (g.rows - 1) * g.cellH + g.labelH
  doc.setDrawColor('#000000')
  doc.setLineWidth(0.4)
  const offX = g.offsets.frontX
  const offY = g.offsets.frontY
  for (const xin of perf.verticalIn) {
    const x = xin * INCH + offX
    doc.line(x, Math.max(1, blockT - 10), x, blockT - 2)
    doc.line(x, blockB + 2, x, Math.min(PAGE_H - 1, blockB + 10))
  }
  for (const yin of perf.horizontalIn) {
    const y = yin * INCH + offY
    doc.line(Math.max(1, blockL - 10), y, blockL - 2, y)
    doc.line(blockR + 2, y, Math.min(PAGE_W - 1, blockR + 10), y)
  }
  if (sideways) {
    doc.setFontSize(6)
    doc.setTextColor('#333333')
    doc.text(`bottom margin ${fmt(nominal.marginBottomIn)} (${mm(nominal.marginBottomIn)}) · pitch 0.8" across · 2.8" down`,
      PAGE_W / 2, blockB + 22, { align: 'center' })
  }

  // ---------------- Page 2: BACK ----------------
  doc.addPage('letter', 'portrait')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor('#dc2626')
  doc.text('BACK (page 2 of 2) — hold to a light, THIS side facing you; read where the black front cross falls on the red scale.',
    PAGE_W / 2, headY - (sideways ? 9 : 0), { align: 'center' })
  if (sideways) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.text('Ticks = 1/32" (0.79 mm), long every 1/8". Cross right of centre by n ticks: Back X + n/32". Below centre: Back Y + n/32".',
      PAGE_W / 2, headY, { align: 'center' })
  }

  doc.setDrawColor('#dc2626')
  doc.setTextColor('#dc2626')
  for (let i = 0; i < n; i++) {
    const p = slotPlacement(g, i, 'back')
    doc.setLineWidth(0.5)
    doc.setLineDashPattern([2, 2], 0)
    doc.rect(p.x, p.y, p.w, p.h, 'S')
    doc.setLineDashPattern([], 0)
    const cx = p.x + p.w / 2
    const cy = p.y + p.h / 2
    doc.setLineWidth(0.3)
    doc.line(cx - 8 * TICK, cy, cx + 8 * TICK, cy)
    doc.line(cx, cy - 8 * TICK, cx, cy + 8 * TICK)
    for (let k = -8; k <= 8; k++) {
      if (k === 0) continue
      const len = k % 4 === 0 ? 4 : 2
      doc.line(cx + k * TICK, cy - len, cx + k * TICK, cy + len)
      doc.line(cx - len, cy + k * TICK, cx + len, cy + k * TICK)
    }
    doc.setFontSize(7)
    labelText(doc, g, p, `BACK ${i + 1}`, 5, 11)
    doc.setFontSize(5.5)
    labelText(doc, g, p, 'TOP', DW - 5, 9, 'right')
    labelLine(doc, g, p, DW / 2 - 30, 3, DW / 2 + 30, 3)
  }

  // ---------------- Page 3: SPEC ----------------
  doc.addPage('letter', 'portrait')
  doc.setTextColor('#111111')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(`DCM slab labels — ${n} per sheet, true size, pre-perforated duplex`, 54, 52)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const vList = perf.verticalIn.map(v => `${fmt(v)}`).join(', ')
  const hList = perf.horizontalIn.map(v => `${fmt(v)}`).join(', ')
  const vListMm = perf.verticalIn.map(v => (v * 25.4).toFixed(2)).join(', ') + ' mm'
  const hListMm = perf.horizontalIn.map(v => (v * 25.4).toFixed(2)).join(', ') + ' mm'
  const lines: string[] = [
    'SHEET FOR THE PERFORATION VENDOR',
    `  Paper: US Letter 8.5" x 11" (215.9 x 279.4 mm), portrait. Printed both sides.`,
    `  Grid: ${trueSizeLayoutText(nominal)}.`,
    `  Label: 2.8" x 0.8" (71.12 x 20.32 mm) — the slab label's true size. Footprint on the sheet ${fmt(P.labelWIn)} x ${fmt(P.labelHIn)}.`,
    `  Margins: top ${fmt(P.marginTopIn)} (${mm(P.marginTopIn)}), bottom ${fmt(nominal.marginBottomIn)} (${mm(nominal.marginBottomIn)}), ` +
      `left ${fmt(P.marginLeftIn)} (${mm(P.marginLeftIn)}), right ${fmt(P.marginLeftIn)}.`,
    `  Gaps: column ${fmt(P.colGapIn)}, row ${fmt(P.rowGapIn)} — neighbouring labels share one perforation.`,
    `  Vertical perforations from the LEFT paper edge (${perf.verticalIn.length}):`,
    ...wrap(vList, 100).map(l => `    ${l}`),
    ...wrap(vListMm, 100).map(l => `    ${l}`),
    `  Horizontal perforations from the TOP paper edge (${perf.horizontalIn.length}):`,
    ...wrap(hList, 100).map(l => `    ${l}`),
    ...wrap(hListMm, 100).map(l => `    ${l}`),
    '  The grid is centred both ways, so the sheet is the same from either side and either end:',
    '  it can be loaded any way round.',
    '',
    'PRINTING',
    `  Print duplex at 100% / Actual Size (never "Fit to page"). The app is set to: ${duplexFlipText(g)}.`,
    '  The printer\'s duplex setting must match the app\'s "Printer flips on" setting (Label print window >',
    '  Duplex alignment). Long edge is the usual default.',
    sideways
      ? '  Labels print sideways: each front reads with the sheet turned 90° counter-clockwise (label top toward the right edge).'
      : '  Labels print upright, 2 across.',
    `  Backs: ${backText(g)}`,
    '',
    'CHECKING PAGES 1-2',
    '  1. Scale: every box on page 1 must measure 2.8" x 0.8". If not, fix the print scale first.',
    `  2. Front position: paper top edge to the top line of box 1 should be ${fmt(P.marginTopIn)};`,
    `     left edge to the left line of box 1 should be ${fmt(P.marginLeftIn)}. Global Y += ${fmt(P.marginTopIn)} minus measured;`,
    `     Global X += ${fmt(P.marginLeftIn)} minus measured.`,
    '  3. Back registration: hold the sheet to a light, BACK (red) side facing you, read where the black',
    '     front cross sits on the red 1/32" scale. Right of centre by n ticks: Back X += n/32".',
    '     Below centre by n ticks: Back Y += n/32" (left / above = negative).',
    '  4. Cut or tear out one label and turn it over left-to-right: "BACK n" must read upright with',
    '     TOP at the top. If it reads upside down, the printer flips on the other edge — change',
    '     "Printer flips on" and print the test again.',
    '  5. Enter the values under "Duplex alignment", save, and print this test again.',
    '',
    'CALIBRATION USED FOR THIS PRINT',
    `  Flip: ${duplexFlipText(g)}. Global X ${fmt(opts.offsetsIn?.globalX ?? 0)}, Global Y ${fmt(opts.offsetsIn?.globalY ?? 0)}; ` +
      `Back X ${fmt(opts.offsetsIn?.backX ?? 0)}, Back Y ${fmt(opts.offsetsIn?.backY ?? 0)}.`,
  ]
  let y = 76
  for (const line of lines) {
    if (line && !line.startsWith(' ')) doc.setFont('helvetica', 'bold')
    else doc.setFont('helvetica', 'normal')
    doc.text(line, 54, y)
    y += line ? 11.5 : 6
  }

  // Scaled diagram of the sheet (35%).
  const k = 0.35
  const ox = 54
  const oy = y + 8
  doc.setDrawColor('#111111')
  doc.setLineWidth(0.6)
  doc.rect(ox, oy, PAGE_W * k, PAGE_H * k, 'S')
  doc.setLineWidth(0.3)
  for (let i = 0; i < nominal.labelsPerPage; i++) {
    const p = slotPlacement(nominal, i, 'front')
    doc.rect(ox + p.x * k, oy + p.y * k, p.w * k, p.h * k, 'S')
  }
  doc.setFontSize(7)
  doc.text('Sheet diagram at 35% — see measurements above.', ox, oy + PAGE_H * k + 10)
  const tx = ox + PAGE_W * k + 16
  doc.setFontSize(8)
  const legend = [
    `Label  2.8 x 0.8 in${sideways ? ' (sideways)' : ''}`,
    `Grid   ${nominal.cols} across x ${nominal.rows} down`,
    `Pitch  ${fmt(nominal.cellW / INCH)} across, ${fmt(nominal.cellH / INCH)} down`,
    `Top / bottom  ${fmt(P.marginTopIn)}`,
    `Left / right  ${fmt(P.marginLeftIn)}`,
    `Gaps   ${fmt(P.colGapIn)} col, ${fmt(P.rowGapIn)} row`,
  ]
  legend.forEach((l, i) => doc.text(l, tx, oy + 12 + i * 12))
  return doc
}

function wrap(text: string, max: number): string[] {
  const parts = text.split(', ')
  const out: string[] = []
  let cur = ''
  for (const part of parts) {
    const next = cur ? `${cur}, ${part}` : part
    if (next.length > max && cur) { out.push(`${cur},`); cur = part } else cur = next
  }
  if (cur) out.push(cur)
  return out
}

function backText(g: SheetGeometry): string {
  const phi = backRotationDeg(g.labelRotation, g.duplexFlip)
  const where = g.duplexFlip === 'short' ? 'rows mirror top-to-bottom' : 'columns mirror left-to-right'
  const turn = phi === g.labelRotation ? 'drawn the same way round as the fronts' : `turned ${(phi - g.labelRotation + 360) % 360}° from the fronts`
  return `${where}; each back is ${turn}, so a cut label turned over left-to-right reads upright.`
}

/** Browser: download the test sheet. */
export function downloadPerforatedCalibrationSheet(opts: PerforatedCalibrationOptions = {}): void {
  const n = opts.density === 'up26' ? 26 : 30
  buildPerforatedCalibrationDoc(opts).save(`DCM-${n}up-TrueSize-Duplex-Alignment-Test.pdf`)
}
