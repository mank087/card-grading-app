/**
 * Raster (jsPDF, browser only) sheets for the TRUE-SIZE pre-perforated slab
 * layouts (sheetGeometry 'up26' / 'up30'). Used by the Modern / Traditional
 * and custom raster fallbacks; the vector generators are the primary path.
 *
 * Every label prints at exactly its real size — never scaled, never padded
 * (owner decision Sept 30 2026; the Sept 28 2.625" × 1" fitted 30-up is gone).
 * Each label image is turned on a canvas by the slot's rotation
 * (sheetGeometry.slotPlacement: 90° on the sideways 30-up front, 270° / 90°
 * on its backs, 180° on short-edge 26-up backs) and placed at the slot's
 * footprint. The sheets are gapless, so no bleed is painted (it would land on
 * the neighbouring label); the only guides are registration ticks in the
 * paper margins at every perforation line.
 */
import type { jsPDF } from 'jspdf'
import type { SheetGeometry } from './sheetGeometry'

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const el = new Image()
  el.onload = () => resolve(el)
  el.onerror = reject
  el.src = src
})

/**
 * One label image → the slot's footprint image. The source carries
 * `srcBleedIn` of bleed round a `srcWIn × srcHIn` label; the label is centred
 * at its NATIVE size in a `designWIn × designHIn` frame (bleed cropped), and
 * the frame is turned `rotation` degrees clockwise.
 */
export async function trueSizeLabelImage(opts: {
  dataUrl: string
  srcWIn: number
  srcHIn: number
  srcBleedIn: number
  designWIn: number
  designHIn: number
  rotation: number
  dpi?: number
}): Promise<string> {
  const dpi = opts.dpi ?? 300
  const img = await loadImage(opts.dataUrl)
  const dw = Math.round(opts.designWIn * dpi)
  const dh = Math.round(opts.designHIn * dpi)
  const quarter = ((Math.round(opts.rotation / 90) % 4) + 4) % 4
  const outW = quarter % 2 ? dh : dw
  const outH = quarter % 2 ? dw : dh
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, outW, outH)
  ctx.translate(outW / 2, outH / 2)
  ctx.rotate((quarter * Math.PI) / 2)
  const totalW = (opts.srcWIn + opts.srcBleedIn * 2) * dpi
  const totalH = (opts.srcHIn + opts.srcBleedIn * 2) * dpi
  ctx.drawImage(img, -totalW / 2, -totalH / 2, totalW, totalH)
  return canvas.toDataURL('image/jpeg', 0.92)
}

export async function drawPerforatedRasterSheets(
  doc: jsPDF,
  opts: {
    count: number
    geometry: SheetGeometry
    /** The label images' own size and bleed, inches. */
    srcWIn: number
    srcHIn: number
    srcBleedIn: number
    renderFront: (index: number) => Promise<string>
    renderBack: (index: number) => Promise<string>
    /** Right-hand header text (layout / style name). */
    dims?: string
  },
): Promise<void> {
  const { slotPlacement, labelPos, duplexFlipText } = await import('./sheetGeometry')
  const g = opts.geometry
  const INCH = 72
  const perPage = g.labelsPerPage
  const totalSheets = Math.max(1, Math.ceil(opts.count / perPage))
  const place = async (dataUrl: string, index: number, side: 'front' | 'back') => {
    const p = slotPlacement(g, index, side)
    const img = await trueSizeLabelImage({
      dataUrl,
      srcWIn: opts.srcWIn,
      srcHIn: opts.srcHIn,
      srcBleedIn: opts.srcBleedIn,
      designWIn: g.designW / INCH,
      designHIn: g.designH / INCH,
      rotation: p.rotation,
    })
    doc.addImage(img, 'JPEG', p.x, p.y, p.w, p.h)
  }
  const header = (side: 'front' | 'back', sheet: number) => {
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#9ca3af')
    const y = Math.max(10, g.firstLabelY - 14)
    doc.text(`${side === 'front' ? 'FRONT' : 'BACK SIDE'} — Page ${sheet + 1} of ${totalSheets} • Print duplex, ${duplexFlipText(g)} • 100% scale • pre-perforated sheet`, 18, y)
    doc.text(opts.dims || g.summary, 612 - 18, y, { align: 'right' })
  }
  const ticks = () => {
    const first = labelPos(g, 0, false)
    const bottom = first.y + (g.rows - 1) * g.cellH + g.labelH
    const right = first.x + (g.cols - 1) * g.cellW + g.labelW
    doc.setDrawColor('#9ca3af')
    doc.setLineWidth(0.4)
    doc.setLineDashPattern([], 0)
    for (let c = 0; c < g.cols; c++) {
      for (const x of [first.x + c * g.cellW, first.x + c * g.cellW + g.labelW]) {
        doc.line(x, Math.max(15, first.y - 12), x, first.y - 3)
        doc.line(x, bottom + 3, x, Math.min(777, bottom + 12))
      }
    }
    for (let r = 0; r < g.rows; r++) {
      for (const y of [first.y + r * g.cellH, first.y + r * g.cellH + g.labelH]) {
        doc.line(Math.max(1, first.x - 11), y, first.x - 3, y)
        doc.line(right + 3, y, Math.min(611, right + 11), y)
      }
    }
  }

  for (let sheet = 0; sheet < totalSheets; sheet++) {
    const start = sheet * perPage
    const end = Math.min(start + perPage, opts.count)
    if (sheet > 0) doc.addPage('letter', 'portrait')
    header('front', sheet)
    for (let i = start; i < end; i++) await place(await opts.renderFront(i), i - start, 'front')
    ticks()

    doc.addPage('letter', 'portrait')
    header('back', sheet)
    for (let i = start; i < end; i++) await place(await opts.renderBack(i), i - start, 'back')
  }
}

/** Turns a label image 180° (short-edge duplex backs on the 10 / 20 raster paths). */
export async function rotateDataUrl180(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.translate(img.width, img.height)
  ctx.rotate(Math.PI)
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.92)
}
