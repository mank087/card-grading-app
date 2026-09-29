/**
 * Printable duplex alignment test + vendor spec for the 30-up pre-perforated
 * slab label sheet (sheetGeometry 'up30', Avery 5160 geometry).
 *
 *   Page 1 (FRONT)  — the 30 label outlines in black, numbered, each with a
 *                     centre cross and circle; margin ticks at every
 *                     perforation line; the margins labelled with their size.
 *   Page 2 (BACK)   — the same 30 outlines where the backs will print
 *                     (mirrored for the flip edge, turned 180° for short-edge,
 *                     calibration applied), dashed red, each with a red
 *                     1/32" scale through the centre. Held to a light, the
 *                     black front cross reads directly off the red scale.
 *   Page 3 (SPEC)   — exact dimensions for the perforation vendor, the
 *                     measuring steps, and the calibration this sheet used.
 *
 * Print pages 1-2 duplex at 100% scale; page 3 prints on its own sheet.
 * Uses the SAME geometry + calibration code path as the label generators, so
 * what lines up here lines up on the real labels.
 */
import { jsPDF } from 'jspdf'
import {
  resolveSheetGeometry,
  labelPos,
  backPlacement,
  duplexFlipText,
  UP30_PRESET,
  type DuplexFlip,
  type SheetOffsetsIn,
} from './sheetGeometry'

const INCH = 72
const PAGE_W = 612
const PAGE_H = 792
const TICK = INCH / 32

export interface PerforatedCalibrationOptions {
  duplexFlip?: DuplexFlip
  offsetsIn?: Partial<SheetOffsetsIn> | null
}

const fmt = (v: number) => `${(Math.round(v * 10000) / 10000).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}"`
const mm = (v: number) => `${(v * 25.4).toFixed(2)} mm`

export function buildPerforatedCalibrationDoc(opts: PerforatedCalibrationOptions = {}): jsPDF {
  const g = resolveSheetGeometry({
    labelWIn: UP30_PRESET.labelWIn,
    labelHIn: UP30_PRESET.labelHIn,
    density: 'up30',
    duplexFlip: opts.duplexFlip,
    offsetsIn: opts.offsetsIn,
  })
  const P = g.preset
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const w = g.labelW
  const h = g.labelH

  // ---------------- Page 1: FRONT ----------------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor('#111111')
  doc.text(`DCM 30-up alignment test — FRONT (page 1 of 2). Print pages 1-2 DUPLEX, ${duplexFlipText(g)}, scale 100% / Actual Size.`,
    PAGE_W / 2, 13, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor('#555555')
  doc.text('Each box must measure exactly 2.625" x 1.000". Margins: top 0.5", left/right 0.1875". Column gap 0.125". No row gap.',
    PAGE_W / 2, 22, { align: 'center' })

  doc.setDrawColor('#000000')
  for (let i = 0; i < g.labelsPerPage; i++) {
    const { x, y } = labelPos(g, i, false)
    doc.setLineWidth(0.5)
    doc.setLineDashPattern([], 0)
    doc.rect(x, y, w, h, 'S')
    const cx = x + w / 2
    const cy = y + h / 2
    doc.setLineWidth(0.35)
    doc.line(cx - 12, cy, cx + 12, cy)
    doc.line(cx, cy - 12, cx, cy + 12)
    doc.circle(cx, cy, 4, 'S')
    // Corner registration Ls inside each box.
    const L = 6
    doc.line(x + 2, y + 2, x + 2 + L, y + 2); doc.line(x + 2, y + 2, x + 2, y + 2 + L)
    doc.line(x + w - 2, y + h - 2, x + w - 2 - L, y + h - 2); doc.line(x + w - 2, y + h - 2, x + w - 2, y + h - 2 - L)
    doc.setFontSize(6)
    doc.setTextColor('#111111')
    doc.text(String(i + 1), x + 5, y + 14)
    doc.setTextColor('#777777')
    doc.setFontSize(5)
    doc.text('2.625" x 1"', x + w - 4, y + 9, { align: 'right' })
  }

  // Perforation ticks + margin callouts.
  const first = labelPos(g, 0, false)
  const bottom = first.y + g.rows * g.cellH
  const right = first.x + (g.cols - 1) * g.cellW + w
  doc.setDrawColor('#000000')
  doc.setLineWidth(0.4)
  for (let c = 0; c < g.cols; c++) {
    for (const x of [first.x + c * g.cellW, first.x + c * g.cellW + w]) {
      doc.line(x, 26, x, first.y - 2)
      doc.line(x, bottom + 2, x, PAGE_H - 4)
    }
  }
  for (let r = 0; r <= g.rows; r++) {
    const y = first.y + r * g.cellH
    doc.line(1, y, first.x - 2, y)
    doc.line(right + 2, y, PAGE_W - 1, y)
  }
  doc.setFontSize(6)
  doc.setTextColor('#333333')
  doc.text(`bottom margin ${fmt(P.marginTopIn)}  (${mm(P.marginTopIn)})`, PAGE_W / 2, bottom + 14, { align: 'center' })
  doc.text(`pitch 2.75" across · 1" down`, PAGE_W / 2, bottom + 22, { align: 'center' })

  // ---------------- Page 2: BACK ----------------
  doc.addPage('letter', 'portrait')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor('#dc2626')
  doc.text(`BACK (page 2 of 2) — hold to a light with THIS side facing you. Read where the black front cross falls on the red scale.`,
    PAGE_W / 2, 13, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('Scale ticks = 1/32" (0.79 mm); long ticks every 1/8". Cross right of centre by n ticks: Back X + n/32". Below centre: Back Y + n/32".',
    PAGE_W / 2, 22, { align: 'center' })

  doc.setDrawColor('#dc2626')
  doc.setTextColor('#dc2626')
  for (let i = 0; i < g.labelsPerPage; i++) {
    const p = backPlacement(g, i, w, h)
    doc.setLineWidth(0.5)
    doc.setLineDashPattern([2, 2], 0)
    doc.rect(p.x, p.y, w, h, 'S')
    doc.setLineDashPattern([], 0)
    const cx = p.x + w / 2
    const cy = p.y + h / 2
    doc.setLineWidth(0.3)
    doc.line(cx - 8 * TICK, cy, cx + 8 * TICK, cy)
    doc.line(cx, cy - 8 * TICK, cx, cy + 8 * TICK)
    for (let k = -8; k <= 8; k++) {
      if (k === 0) continue
      const len = k % 4 === 0 ? 4 : 2
      doc.line(cx + k * TICK, cy - len, cx + k * TICK, cy + len)
      doc.line(cx - len, cy + k * TICK, cx + len, cy + k * TICK)
    }
    doc.setFontSize(6)
    doc.text(`${i + 1}`, p.x + w - 5, p.y + 14, { align: 'right' })
  }

  // ---------------- Page 3: SPEC ----------------
  doc.addPage('letter', 'portrait')
  doc.setTextColor('#111111')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('DCM slab labels — 30 per sheet, pre-perforated duplex', 54, 60)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  const lines: string[] = [
    'SHEET FOR THE PERFORATION VENDOR',
    `  Paper: US Letter 8.5" x 11" (215.9 x 279.4 mm), portrait. Printed both sides.`,
    `  Grid: 3 columns x 10 rows = 30 labels (Avery 5160 / 8160 geometry).`,
    `  Label: ${fmt(P.labelWIn)} x ${fmt(P.labelHIn)} (${mm(P.labelWIn)} x ${mm(P.labelHIn)}).`,
    `  Top margin ${fmt(P.marginTopIn)} (${mm(P.marginTopIn)}); bottom margin ${fmt(g.marginBottomIn)}.`,
    `  Left margin ${fmt(P.marginLeftIn)} (${mm(P.marginLeftIn)}); right margin ${fmt(P.marginLeftIn)}.`,
    `  Column gap ${fmt(P.colGapIn)} (${mm(P.colGapIn)}); row gap 0 (rows share a perforation).`,
    `  Vertical perforations (from the left paper edge): 0.1875", 2.8125" | 2.9375", 5.5625" | 5.6875", 8.3125".`,
    `  Horizontal perforations (from the top paper edge): 0.5", 1.5", 2.5" ... 10.5" (11 lines, 1" apart).`,
    `  The grid is centred both ways, so the perforations are identical from either side of the sheet.`,
    '',
    'CHECKING PAGES 1-2',
    '  1. Print pages 1-2 duplex at 100% / Actual Size (not "Fit to page"), ' + duplexFlipText(g) + '.',
    '  2. Scale: every box on page 1 must measure 2.625" x 1.000". If not, fix the print scale first.',
    '  3. Front position: measure from the paper\'s top edge to the top line of box 1 (should be 0.500")',
    '     and from the left edge to the left line of box 1 (should be 0.1875").',
    '     Global Y += 0.500 - measured.   Global X += 0.1875 - measured.',
    '  4. Back registration: hold the sheet to a light, BACK (red) side facing you, and read where the',
    '     black front cross sits on the red 1/32" scale. Right of centre by n ticks: Back X += n/32".',
    '     Below centre by n ticks: Back Y += n/32" (left / above = negative).',
    '  5. Enter the values under "Duplex alignment" in the label print window, save, and print this',
    '     test again. When the crosses sit on the centre, print labels.',
    '',
    'CALIBRATION USED FOR THIS PRINT',
    `  Flip: ${duplexFlipText(g)}.`,
    `  Global X ${fmt(opts.offsetsIn?.globalX ?? 0)}, Global Y ${fmt(opts.offsetsIn?.globalY ?? 0)}; ` +
      `Back X ${fmt(opts.offsetsIn?.backX ?? 0)}, Back Y ${fmt(opts.offsetsIn?.backY ?? 0)}.`,
  ]
  let y = 90
  for (const line of lines) {
    if (line && !line.startsWith(' ')) doc.setFont('helvetica', 'bold')
    else doc.setFont('helvetica', 'normal')
    doc.text(line, 54, y)
    y += line ? 14 : 8
  }

  // Scaled diagram of the sheet (1:2.5).
  const k = 0.4
  const ox = 54
  const oy = y + 10
  doc.setDrawColor('#111111')
  doc.setLineWidth(0.6)
  doc.rect(ox, oy, PAGE_W * k, PAGE_H * k, 'S')
  doc.setLineWidth(0.3)
  const base = resolveSheetGeometry({ labelWIn: 2.625, labelHIn: 1, density: 'up30' })
  for (let i = 0; i < base.labelsPerPage; i++) {
    const p = labelPos(base, i, false)
    doc.rect(ox + p.x * k, oy + p.y * k, w * k, h * k, 'S')
  }
  doc.setFontSize(7)
  doc.text('Sheet diagram at 40% — see measurements above.', ox, oy + PAGE_H * k + 10)
  const tx = ox + PAGE_W * k + 16
  doc.setFontSize(8)
  const legend = [
    'Label  2.625 x 1.000 in',
    'Pitch  2.750 in across',
    '       1.000 in down',
    'Top / bottom  0.500 in',
    'Left / right  0.1875 in',
    'Column gap    0.125 in',
    'Row gap       0',
  ]
  legend.forEach((l, i) => doc.text(l, tx, oy + 12 + i * 12))
  return doc
}

/** Browser: download the test sheet. */
export function downloadPerforatedCalibrationSheet(opts: PerforatedCalibrationOptions = {}): void {
  buildPerforatedCalibrationDoc(opts).save('DCM-30up-Duplex-Alignment-Test.pdf')
}
