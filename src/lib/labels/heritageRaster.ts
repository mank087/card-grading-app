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

export interface HeritageRasterOptions {
  data: SlabLabelData
  side: 'front' | 'back'
  pattern: BandPattern
  bandColors: string[]
  /** Output raster width in px; height follows the 1400:400 aspect. Default 1400. */
  widthPx?: number
  gradeColors?: Record<string, string> | null
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
  })
  const host = document.createElement('div')
  const root = createRoot(host)
  flushSync(() => root.render(el))
  const markup = host.innerHTML
  root.unmount()
  // renderless namespace fix: an <svg> serialized from the DOM keeps xmlns,
  // but guard anyway — without it the blob renders as nothing.
  return markup.includes('xmlns=')
    ? markup
    : markup.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
}

/** Render the Heritage label to a PNG data URL at the requested width. */
export async function renderHeritageLabelPng(opts: HeritageRasterOptions): Promise<string> {
  const blackLogo = await loadBlackLogoAsBase64().catch(() => null)
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
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
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
