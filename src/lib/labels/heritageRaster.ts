/**
 * Heritage label -> PNG raster (browser only).
 *
 * The image pipelines (card images, eBay/InstaList composites, fold-over
 * canvas pages) all composite label art with canvas drawImage. Heritage's
 * source of truth in the browser is the HeritageLabelPreview SVG, so this
 * renders that component to markup, loads it as an image, and rasterizes at
 * the caller's resolution.
 *
 * Two constraints shape the implementation:
 *  - External resources are BLOCKED inside an SVG rendered as an image, so
 *    the logo/QR hrefs must be data: URLs (the preview takes href overrides
 *    for exactly this reason). Callers should pass the data-URL logos they
 *    already carry on SlabLabelData.
 *  - react-dom/server is not importable from Next client bundles, so the
 *    markup comes from a detached createRoot + flushSync render instead.
 */
import React from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { HeritageLabelPreview } from '@/components/labels/HeritageLabelPreview'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'
import type { BandPattern } from '@/lib/labelLab/bandGeometry'
import { loadBlackLogoAsBase64 } from '@/lib/foldableLabelGenerator'
import { HERITAGE_PX, heritageMarkBox, fitHeritageFront } from '@/lib/labelLab/heritageLayout'

export interface HeritageRasterOptions {
  data: SlabLabelData
  side: 'front' | 'back'
  pattern: BandPattern
  bandColors: string[]
  /** Output raster width in px; height follows the 1400:400 aspect. Default 1400. */
  widthPx?: number
  gradeColors?: Record<string, string> | null
  /**
   * Org-branding override for the FRONT-label mark (black-variant data URL).
   * The back's QR-centre disc keeps data.logoDataUrl (the DCM verification
   * anchor). Absent = DCM mark, loaded internally, as before.
   */
  logoBlack?: string
  /** Mark size multiplier from Brand Setup; clamped per card by heritageMarkBox. */
  logoScale?: number
}

function svgMarkup(opts: HeritageRasterOptions, blackLogo: string | null): string {
  const el = React.createElement(HeritageLabelPreview, {
    data: opts.data,
    side: opts.side,
    pattern: opts.pattern,
    bandColors: opts.bandColors,
    gradeColors: opts.gradeColors ?? null,
    // Data URLs only — path hrefs silently vanish in SVG-as-image.
    blackLogoHref: blackLogo || opts.data.logoDataUrl || undefined,
    colorLogoHref: opts.data.logoDataUrl || undefined,
    // Engines drop nested <image> subresources when an SVG is drawn to a
    // canvas (QR + logos silently vanished from rasterized labels) — omit
    // them here; renderHeritageLabelPng composites the bitmaps natively.
    suppressImages: true,
    logoScale: opts.logoScale ?? 1,
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
  // Intrinsic size: the component sizes itself with CSS (width:100%), which
  // leaves the serialized SVG dimensionless. Desktop Chrome tolerates that
  // when drawing to canvas; Android WebView does NOT (decodes as 0x0 and
  // paints nothing — this is why mobile previews came back blank). Explicit
  // width/height attributes give every engine a real raster size.
  if (!/<svg[^>]*\swidth=/.test(markup)) {
    markup = markup.replace('<svg ', '<svg width="1400" height="400" ')
  }
  return markup
}

/** Render the Heritage label to a PNG data URL at the requested width. */
export async function renderHeritageLabelPng(opts: HeritageRasterOptions): Promise<string> {
  const blackLogo = opts.logoBlack ?? await loadBlackLogoAsBase64().catch(() => null)
  const markup = svgMarkup(opts, blackLogo)
  const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const w = opts.widthPx ?? 1400
    const h = Math.round(w * (400 / 1400))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    await compositeBitmaps(ctx, opts, blackLogo, w / 1400)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
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

/** contain-fit draw into a box. */
function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

/**
 * Native pass for the bitmaps the SVG omitted (see suppressImages): the
 * front's DCM mark, and the back's QR + white disc + colour mark. Geometry
 * mirrors HeritageLabelPreview exactly via HERITAGE_PX at the raster scale.
 */
async function compositeBitmaps(
  ctx: CanvasRenderingContext2D,
  opts: HeritageRasterOptions,
  blackLogo: string | null,
  k: number,
): Promise<void> {
  const PX = HERITAGE_PX
  if (opts.side === 'front') {
    const mark = await loadBitmap(blackLogo || opts.data.logoDataUrl || '')
    if (mark) {
      // Same geometry helper the SVG and the PDF use, so the rasterized
      // label matches what Brand Setup previewed.
      const fit = fitHeritageFront(opts.data.primaryName || 'Card', opts.data.contextLine || '', opts.data.serial)
      const box = heritageMarkBox(opts.logoScale ?? 1, fit)
      drawContain(ctx, mark, box.x * k, box.y * k, box.w * k, box.h * k)
    }
    return
  }
  if (!opts.data.qrCodeDataUrl) return
  const qr = await loadBitmap(opts.data.qrCodeDataUrl)
  if (qr) {
    ctx.drawImage(qr, (PX.QR_X + 8) * k, (PX.QR_Y + 8) * k, PX.QR_IMG * k, PX.QR_IMG * k)
  }
  const logo = await loadBitmap(opts.data.logoDataUrl || '')
  const cx = (PX.QR_X + PX.QR_BOX / 2) * k
  const cy = (PX.QR_Y + PX.QR_BOX / 2) * k
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.arc(cx, cy, (PX.QR_LOGO_DISC / 2) * k, 0, Math.PI * 2)
  ctx.fill()
  if (logo) {
    const box = PX.QR_LOGO * k
    drawContain(ctx, logo, cx - box / 2, cy - box / 2, box, box)
  }
}

/** Same raster, delivered as a canvas for callers that keep compositing. */
export async function renderHeritageLabelCanvas(opts: HeritageRasterOptions): Promise<HTMLCanvasElement> {
  const dataUrl = await renderHeritageLabelPng(opts)
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  canvas.getContext('2d')!.drawImage(img, 0, 0)
  return canvas
}
