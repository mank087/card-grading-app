/**
 * Classic label -> PNG raster (browser only).
 *
 * Same job, same constraints, same shape as heritageRaster: the image
 * pipelines (card images, eBay/InstaList composites, the jsPDF raster
 * fallback) composite label art with canvas drawImage, and the browser's
 * source of truth for the Classic label is the ClassicLabelPreview SVG. This
 * renders that component to markup, loads it as an image, and rasterizes at
 * the caller's resolution.
 *
 *  - External resources are BLOCKED inside an SVG rendered as an image, and
 *    engines drop nested <image> subresources entirely, so the mark and the QR
 *    are suppressed in the SVG and composited natively afterwards, at the same
 *    CLASSIC_PX geometry the SVG and the PDF use.
 *  - react-dom/server is not importable from Next client bundles, so the
 *    markup comes from a detached createRoot + flushSync render.
 */
import React from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { ClassicLabelPreview } from '@/components/labels/ClassicLabelPreview'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'
import { CLASSIC_PX, classicBackMark } from '@/lib/labelLab/classicLayout'
import { loadBlackLogoAsBase64 } from '@/lib/foldableLabelGenerator'

export interface ClassicRasterOptions {
  data: SlabLabelData
  side: 'front' | 'back'
  /** Output raster width in px; height follows the 1400:400 aspect. Default 1400. */
  widthPx?: number
  /**
   * The mark drawn on the front plate and down the left of the back, as a
   * data URL. Org cards pass the store's Brand Setup mark. Absent = the DCM
   * black mark, loaded internally.
   */
  logoBlack?: string | null
  /** Back QR, as a data URL. Falls back to data.qrCodeDataUrl. */
  qrDataUrl?: string | null
  /** Verify URL printed under the cert serial; defaults to dcmgrading.com. */
  verifyUrl?: string | null
}

function svgMarkup(opts: ClassicRasterOptions): string {
  const el = React.createElement(ClassicLabelPreview, {
    data: opts.data,
    side: opts.side,
    // The bitmaps are composited natively below (see suppressImages).
    suppressImages: true,
    verifyUrl: opts.verifyUrl ?? null,
  })
  const host = document.createElement('div')
  const root = createRoot(host)
  flushSync(() => root.render(el))
  let markup = host.innerHTML
  root.unmount()
  // Namespace guard — without xmlns the blob renders as nothing.
  if (!markup.includes('xmlns=')) {
    markup = markup.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
  }
  // Intrinsic size: the component sizes itself with CSS, which leaves the
  // serialized SVG dimensionless. Android WebView decodes that as 0x0 and
  // paints nothing, so give every engine a real raster size.
  if (!/<svg[^>]*\swidth=/.test(markup)) {
    markup = markup.replace('<svg ', `<svg width="${CLASSIC_PX.W}" height="${CLASSIC_PX.H}" `)
  }
  return markup
}

async function loadBitmap(src: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image()
    img.src = src
    await img.decode()
    return img
  } catch {
    return null
  }
}

/** contain-fit draw into a box (matches preserveAspectRatio="xMidYMid meet"). */
function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

/**
 * Native pass for the bitmaps the SVG omitted: the front plate's mark, and the
 * back's left mark + QR. Geometry mirrors ClassicLabelPreview exactly via
 * CLASSIC_PX at the raster scale `k`.
 */
async function compositeBitmaps(
  ctx: CanvasRenderingContext2D,
  opts: ClassicRasterOptions,
  blackLogo: string | null,
  k: number,
): Promise<void> {
  const P = CLASSIC_PX
  const mark = blackLogo ? await loadBitmap(blackLogo) : null
  if (opts.side === 'front') {
    if (mark) drawContain(ctx, mark, P.MARK_X * k, P.MARK_Y * k, P.MARK_W * k, P.MARK_H * k)
    return
  }
  const box = classicBackMark()
  if (mark) drawContain(ctx, mark, box.x * k, box.y * k, box.w * k, box.h * k)
  const qrSrc = opts.qrDataUrl || opts.data.qrCodeDataUrl || ''
  if (!qrSrc) return
  const qr = await loadBitmap(qrSrc)
  if (qr) ctx.drawImage(qr, P.QR_X * k, P.QR_Y * k, P.QR_BOX * k, P.QR_BOX * k)
}

/**
 * Same raster, delivered as a canvas for callers that keep compositing.
 *
 * This is the real renderer; the PNG entry point below just encodes what this
 * returns. (It used to be the other way round, which meant a canvas caller
 * paid for a PNG encode plus a decode plus a second canvas for nothing.)
 */
export async function renderClassicLabelCanvas(opts: ClassicRasterOptions): Promise<HTMLCanvasElement> {
  const blackLogo = opts.logoBlack ?? await loadBlackLogoAsBase64().catch(() => null)
  const markup = svgMarkup(opts)
  const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const w = opts.widthPx ?? CLASSIC_PX.W
    const h = Math.round(w * (CLASSIC_PX.H / CLASSIC_PX.W))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    await compositeBitmaps(ctx, opts, blackLogo, w / CLASSIC_PX.W)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Render the Classic label to a PNG data URL at the requested width. */
export async function renderClassicLabelPng(opts: ClassicRasterOptions): Promise<string> {
  const canvas = await renderClassicLabelCanvas(opts)
  return canvas.toDataURL('image/png')
}
