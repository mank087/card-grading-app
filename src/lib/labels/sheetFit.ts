/**
 * Fitting a slab label design into a sheet slot of a different shape.
 *
 * Every slab design is authored at 2.8" × 0.8" (3.5 : 1). The 30-up
 * pre-perforated sheet (sheetGeometry 'up30') has 2.625" × 1" slots
 * (2.625 : 1), so the design is scaled UNIFORMLY — never stretched — by
 * min(2.625 / 2.8, 1 / 0.8) = 0.9375 to 2.625" × 0.75", centred, and the
 * 0.125" left above and below is filled with the design's own background
 * (painted at the true slot size, not scaled). All text keeps 93.75% of its
 * 2.8" size, so grade, name, set line and serial stay legible and the QR stays
 * ~0.49" square.
 *
 * react-pdf gotcha (see heritageSlabGenerator ScaledPanel, Sept 14 2026):
 * scale() shrinks the transformed node's OWN background/border by the Y factor
 * twice. The vector renderers therefore put the transform on a bare wrapper
 * with no background or border, render the design `bare` inside it, and paint
 * background + border outside the transform at the slot size.
 */

export interface SlotFit {
  /** Uniform scale applied to the design. */
  s: number
  /** Scaled design size, points. */
  w: number
  h: number
  /** Offset of the scaled design inside the slot, points. */
  padX: number
  padY: number
}

export function fitDesignToSlot(designW: number, designH: number, slotW: number, slotH: number): SlotFit {
  const s = Math.min(slotW / designW, slotH / designH)
  const w = designW * s
  const h = designH * s
  return { s, w, h, padX: (slotW - w) / 2, padY: (slotH - h) / 2 }
}

/**
 * Raster paths (jsPDF, browser only): turn a label image that carries
 * `srcBleedIn` of bleed on every side of a `srcWIn × srcHIn` label into an
 * image of the slot plus `outBleedXIn/outBleedYIn`, with the design fitted
 * uniformly and the letterbox filled by extending the image's own top and
 * bottom rows (a clean continuation of solid and gradient backgrounds).
 * `rotate180` turns the result for short-edge duplex backs.
 */
export async function fitLabelImageToSlot(opts: {
  dataUrl: string
  srcWIn: number
  srcHIn: number
  srcBleedIn: number
  slotWIn: number
  slotHIn: number
  outBleedXIn: number
  outBleedYIn: number
  dpi?: number
  rotate180?: boolean
}): Promise<string> {
  const dpi = opts.dpi ?? 300
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = opts.dataUrl
  })
  const outW = Math.round((opts.slotWIn + opts.outBleedXIn * 2) * dpi)
  const outH = Math.round((opts.slotHIn + opts.outBleedYIn * 2) * dpi)
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')!
  if (opts.rotate180) {
    ctx.translate(outW, outH)
    ctx.rotate(Math.PI)
  }

  const fit = fitDesignToSlot(opts.srcWIn, opts.srcHIn, opts.slotWIn, opts.slotHIn)
  // Where the source IMAGE (label + its bleed) lands, in output pixels.
  const srcTotalW = opts.srcWIn + opts.srcBleedIn * 2
  const srcTotalH = opts.srcHIn + opts.srcBleedIn * 2
  const dx = (opts.outBleedXIn + fit.padX - opts.srcBleedIn * fit.s) * dpi
  const dy = (opts.outBleedYIn + fit.padY - opts.srcBleedIn * fit.s) * dpi
  const dw = srcTotalW * fit.s * dpi
  const dh = srcTotalH * fit.s * dpi

  // Letterbox: stretch the first / last pixel rows over the gap.
  if (dy > 0) ctx.drawImage(img, 0, 0, img.width, 1, dx, 0, dw, Math.ceil(dy) + 1)
  if (dy + dh < outH) ctx.drawImage(img, 0, img.height - 1, img.width, 1, dx, Math.floor(dy + dh) - 1, dw, outH - (dy + dh) + 2)
  // Pillarbox (only when a design is taller than the slot's aspect).
  if (dx > 0) ctx.drawImage(img, 0, 0, 1, img.height, 0, dy, Math.ceil(dx) + 1, dh)
  if (dx + dw < outW) ctx.drawImage(img, img.width - 1, 0, 1, img.height, Math.floor(dx + dw) - 1, dy, outW - (dx + dw) + 2, dh)
  ctx.drawImage(img, dx, dy, dw, dh)
  return canvas.toDataURL('image/jpeg', 0.92)
}

/**
 * Raster (jsPDF) duplex sheets for pre-perforated stock (30-up). Shared by the
 * Modern/Traditional and custom raster fallbacks: every count fills the grid
 * from slot 1, each label image is fitted into its slot (fitLabelImageToSlot),
 * backs are mirrored for the flip edge and turned 180° for short-edge, and
 * the only guides are registration ticks in the paper margins.
 */
export async function drawPerforatedRasterSheets(
  doc: import('jspdf').jsPDF,
  opts: {
    count: number
    geometry: import('./sheetGeometry').SheetGeometry
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
  const { backPlacement, labelPos, duplexFlipText } = await import('./sheetGeometry')
  const g = opts.geometry
  const INCH = 72
  const bx = Math.min(0.08 * INCH, g.maxBleedX)
  const by = Math.min(0.08 * INCH, g.maxBleedY)
  const perPage = g.labelsPerPage
  const totalSheets = Math.max(1, Math.ceil(opts.count / perPage))
  const slotWIn = g.labelW / INCH
  const slotHIn = g.labelH / INCH
  const fitted = (dataUrl: string, rotate180 = false) => fitLabelImageToSlot({
    dataUrl,
    srcWIn: opts.srcWIn,
    srcHIn: opts.srcHIn,
    srcBleedIn: opts.srcBleedIn,
    slotWIn,
    slotHIn,
    outBleedXIn: bx / INCH,
    outBleedYIn: by / INCH,
    rotate180,
  })
  const header = (side: 'front' | 'back', sheet: number) => {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#9ca3af')
    const y = Math.max(10, g.firstLabelY - 14)
    doc.text(`${side === 'front' ? 'FRONT' : 'BACK'} — Page ${sheet + 1} of ${totalSheets}`, g.firstLabelX, y)
    doc.text(`${side === 'front' ? 'Print duplex' : 'BACK SIDE • Print duplex'} (${duplexFlipText(g)}) • 100% scale • pre-perforated sheet`,
      612 / 2, y, { align: 'center' })
    doc.text(opts.dims || g.summary, 612 - g.firstLabelX, y, { align: 'right' })
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
        doc.line(x, Math.max(1, first.y - 12), x, first.y - 3)
        doc.line(x, bottom + 3, x, Math.min(791, bottom + 12))
      }
    }
    for (let r = 0; r <= g.rows; r++) {
      const y = first.y + r * g.cellH - (r === g.rows ? g.gapY : 0)
      doc.line(Math.max(1, first.x - 11), y, first.x - 3, y)
      doc.line(right + 3, y, Math.min(611, right + 11), y)
    }
  }

  for (let sheet = 0; sheet < totalSheets; sheet++) {
    const start = sheet * perPage
    const end = Math.min(start + perPage, opts.count)
    if (sheet > 0) doc.addPage('letter', 'portrait')
    header('front', sheet)
    for (let i = start; i < end; i++) {
      const p = labelPos(g, i - start, false)
      const img = await fitted(await opts.renderFront(i))
      doc.addImage(img, 'JPEG', p.x - bx, p.y - by, g.labelW + bx * 2, g.labelH + by * 2)
    }
    ticks()

    doc.addPage('letter', 'portrait')
    header('back', sheet)
    for (let i = start; i < end; i++) {
      const p = backPlacement(g, i - start, g.labelW, g.labelH)
      const img = await fitted(await opts.renderBack(i), p.rotate180)
      doc.addImage(img, 'JPEG', p.x - bx, p.y - by, g.labelW + bx * 2, g.labelH + by * 2)
    }
  }
}

/** Turns a label image 180° (short-edge duplex backs on the raster paths). */
export async function rotateDataUrl180(dataUrl: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = dataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.translate(img.width, img.height)
  ctx.rotate(Math.PI)
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.92)
}
