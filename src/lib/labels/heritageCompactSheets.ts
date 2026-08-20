/**
 * Heritage Compact — Avery sheet generators.
 *
 * These sit alongside the existing Modern generators rather than inside them:
 * the Heritage panels render to a canvas (heritageCompact.ts) and are placed
 * as images at the same grid positions, so the calibration offsets, position
 * pickers and pagination behave identically for both styles.
 *
 * Sheet geometry is duplicated from averyLabelGenerator / avery8167LabelGenerator
 * because those constants are module-private. They are Avery product specs and
 * do not drift — but if a margin is ever corrected there, correct it here too.
 */
import jsPDF from 'jspdf'
import {
  renderOneTouchFoldSheet,
  renderToploaderFront,
  renderToploaderBack,
  renderFoldOverSheet,
  type HeritageCompactInputs,
} from './heritageCompact'

const INCH = 72
/** Canvas render resolution. 600dpi keeps 4pt type crisp at these sizes. */
const DPI = 600

export interface CalibrationOffsets { x: number; y: number }

// ---------------------------------------------------------------------------
// Avery 6871 — One-Touch. 3 x 6 = 18 labels, each 2.375" x 1.25".
// ---------------------------------------------------------------------------
const A6871 = {
  labelW: 2.375 * INCH, labelH: 1.25 * INCH,
  top: 1.125 * INCH, left: 0.375 * INCH,
  gapX: 0.3125 * INCH, gapY: 0.25 * INCH,
  cols: 3, rows: 6,
}
export const AVERY_6871_PER_PAGE = A6871.cols * A6871.rows

function xy6871(index: number, offsets?: CalibrationOffsets) {
  const col = index % A6871.cols
  const row = Math.floor(index / A6871.cols)
  return {
    x: A6871.left + col * (A6871.labelW + A6871.gapX) + (offsets?.x || 0) * INCH,
    y: A6871.top + row * (A6871.labelH + A6871.gapY) + (offsets?.y || 0) * INCH,
  }
}

/**
 * Heritage One-Touch sheet. Each label is the full 2.375" x 1.25" fold sheet:
 * back on the top half rotated 180 degrees, front below.
 */
export async function generateHeritageOneTouchSheet(
  items: HeritageCompactInputs[],
  offsets?: CalibrationOffsets,
  globalPositions?: number[],
): Promise<Blob> {
  if (items.length === 0) throw new Error('No labels to generate')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })

  const placements = items.map((data, i) => ({
    data,
    global: globalPositions?.[i] ?? i,
  })).sort((a, b) => a.global - b.global)

  let currentPage = -1
  for (const p of placements) {
    const page = Math.floor(p.global / AVERY_6871_PER_PAGE)
    const slot = p.global % AVERY_6871_PER_PAGE
    if (page !== currentPage) {
      if (currentPage !== -1) doc.addPage()
      currentPage = page
    }
    const { x, y } = xy6871(slot, offsets)
    const canvas = await renderOneTouchFoldSheet(p.data, DPI)
    doc.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', x, y, A6871.labelW, A6871.labelH)
    // Fold hint outside the label edge — the seam itself stays clean.
    const foldY = y + A6871.labelH / 2
    doc.setDrawColor('#bbbbbb'); doc.setLineWidth(0.5)
    doc.line(x - 10, foldY, x - 3, foldY)
    doc.line(x + A6871.labelW + 3, foldY, x + A6871.labelW + 10, foldY)
  }
  return doc.output('blob')
}

// ---------------------------------------------------------------------------
// Avery 8167 — Toploader. 4 x 20 = 80 labels, each 1.75" x 0.5".
// ---------------------------------------------------------------------------
const A8167 = {
  labelW: 1.75 * INCH, labelH: 0.5 * INCH,
  top: 0.5 * INCH, left: 0.28125 * INCH,
  gapX: 0.3125 * INCH, gapY: 0,
  cols: 4, rows: 20,
}
export const AVERY_8167_LABELS_PER_PAGE = A8167.cols * A8167.rows
/** Front+back pairs per page — each card consumes two labels. */
export const AVERY_8167_CARDS_PER_PAGE = AVERY_8167_LABELS_PER_PAGE / 2

function xy8167(index: number, offsets?: CalibrationOffsets) {
  const col = index % A8167.cols
  const row = Math.floor(index / A8167.cols)
  return {
    x: A8167.left + col * (A8167.labelW + A8167.gapX) + (offsets?.x || 0) * INCH,
    y: A8167.top + row * (A8167.labelH + A8167.gapY) + (offsets?.y || 0) * INCH,
  }
}

/**
 * Heritage Toploader front+back pairs. Mirrors the Modern generator's slot
 * mapping: card position 0 -> labels 0,1; position 1 -> labels 2,3; i.e.
 * fronts in columns 0/2 and backs in columns 1/3 of the same row.
 */
export async function generateHeritageToploaderSheet(
  items: HeritageCompactInputs[],
  offsets?: CalibrationOffsets,
  globalPositions?: number[],
): Promise<Blob> {
  if (items.length === 0) throw new Error('No cards to generate labels for')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })

  const placements = items.map((data, i) => ({
    data,
    global: globalPositions?.[i] ?? i,
  })).sort((a, b) => a.global - b.global)

  let currentPage = -1
  for (const p of placements) {
    const page = Math.floor(p.global / AVERY_8167_CARDS_PER_PAGE)
    const cardPos = p.global % AVERY_8167_CARDS_PER_PAGE
    if (page !== currentPage) {
      if (currentPage !== -1) doc.addPage()
      currentPage = page
    }
    const row = Math.floor(cardPos / 2)
    const frontCol = (cardPos % 2) * 2
    const frontIdx = row * A8167.cols + frontCol
    const backIdx = frontIdx + 1

    const [frontCanvas, backCanvas] = await Promise.all([
      renderToploaderFront(p.data, DPI),
      renderToploaderBack(p.data, DPI),
    ])
    const f = xy8167(frontIdx, offsets)
    const b = xy8167(backIdx, offsets)
    doc.addImage(frontCanvas.toDataURL('image/jpeg', 0.94), 'JPEG', f.x, f.y, A8167.labelW, A8167.labelH)
    doc.addImage(backCanvas.toDataURL('image/jpeg', 0.94), 'JPEG', b.x, b.y, A8167.labelW, A8167.labelH)
  }
  return doc.output('blob')
}

/**
 * Heritage fold-over Toploader labels — one 1.75" x 0.5" label per card,
 * front in the left half (rotated 90 CW) and back in the right (90 CCW), so
 * both read upright once folded over the holder's edge. Prints sequentially
 * from the first slot; there is no position picker for this format.
 */
export async function generateHeritageFoldOverSheet(
  items: HeritageCompactInputs[],
  offsets?: CalibrationOffsets,
  startPosition = 0,
): Promise<Blob> {
  if (items.length === 0) throw new Error('No cards to generate labels for')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })

  let currentPage = -1
  for (let i = 0; i < items.length; i++) {
    const global = startPosition + i
    const page = Math.floor(global / AVERY_8167_LABELS_PER_PAGE)
    const slot = global % AVERY_8167_LABELS_PER_PAGE
    if (page !== currentPage) {
      if (currentPage !== -1) doc.addPage()
      currentPage = page
    }
    const { x, y } = xy8167(slot, offsets)
    const canvas = await renderFoldOverSheet(items[i], DPI)
    doc.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', x, y, A8167.labelW, A8167.labelH)
    // Fold hint above/below the vertical seam, outside the label.
    const foldX = x + A8167.labelW / 2
    doc.setDrawColor('#bbbbbb'); doc.setLineWidth(0.5)
    doc.line(foldX, y - 6, foldX, y - 1)
    doc.line(foldX, y + A8167.labelH + 1, foldX, y + A8167.labelH + 6)
  }
  return doc.output('blob')
}
