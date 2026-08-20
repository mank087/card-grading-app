/**
 * Heritage Compact preview — the same canvas renderers the print sheets use.
 *
 * Rendering through the print path (rather than a separate DOM mock-up) means
 * the preview cannot drift from the sheet: if a name wraps or a chip shrinks
 * on paper, it does the same here.
 *
 * Both sides render up front so the holder mockup's own front/back toggle can
 * flip between them with no re-render latency.
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import {
  renderOneTouchFront, renderOneTouchBack,
  renderToploaderFront, renderToploaderBack,
  renderFoldFront, renderFoldBack,
  type HeritageCompactInputs,
} from '@/lib/labels/heritageCompact'

export type CompactFormat = 'onetouch' | 'toploader' | 'foldover'

/** Screen preview DPI — enough to read 4pt type when zoomed on a phone. */
const PREVIEW_DPI = 260

const RENDERERS: Record<CompactFormat, {
  front: (i: HeritageCompactInputs, dpi: number) => Promise<HTMLCanvasElement>
  back: (i: HeritageCompactInputs, dpi: number) => Promise<HTMLCanvasElement>
}> = {
  onetouch: { front: renderOneTouchFront, back: renderOneTouchBack },
  toploader: { front: renderToploaderFront, back: renderToploaderBack },
  foldover: { front: renderFoldFront, back: renderFoldBack },
}

export interface CompactImages { front: string | null; back: string | null }

/** Both label faces as PNG data URLs, re-rendered whenever the design changes. */
export function useHeritageCompactImages(
  inputs: HeritageCompactInputs | null,
  format: CompactFormat,
): CompactImages {
  const [images, setImages] = useState<CompactImages>({ front: null, back: null })
  const reqRef = useRef(0)

  useEffect(() => {
    if (!inputs) { setImages({ front: null, back: null }); return }
    const id = ++reqRef.current
    let cancelled = false
    ;(async () => {
      try {
        const r = RENDERERS[format]
        const [f, b] = await Promise.all([r.front(inputs, PREVIEW_DPI), r.back(inputs, PREVIEW_DPI)])
        if (!cancelled && id === reqRef.current) {
          setImages({ front: f.toDataURL('image/png'), back: b.toDataURL('image/png') })
        }
      } catch {
        if (!cancelled && id === reqRef.current) setImages({ front: null, back: null })
      }
    })()
    return () => { cancelled = true }
    // Serialised so any field change re-renders, matching useLabelPreview's rule.
  }, [
    format,
    inputs?.primaryName, inputs?.contextLine, inputs?.contextShort, inputs?.serial,
    inputs?.grade, inputs?.condition, inputs?.pattern,
    inputs?.bandColors?.join(','), inputs?.qrDataUrl?.length, inputs?.wordmarkDataUrl?.length,
    inputs?.showFounderEmblem, inputs?.showVipEmblem, inputs?.showCardLoversEmblem,
    inputs?.subgrades?.centering, inputs?.subgrades?.corners, inputs?.subgrades?.edges, inputs?.subgrades?.surface,
  ])

  return images
}

interface Props {
  inputs: HeritageCompactInputs | null
  format: CompactFormat
  side: 'front' | 'back'
  className?: string
}

/** The bare label artwork, no holder — used where the slot is already framed. */
export function HeritageCompactPreview({ inputs, format, side, className }: Props) {
  const images = useHeritageCompactImages(inputs, format)
  const url = side === 'front' ? images.front : images.back
  if (!url) {
    const ar = format === 'onetouch' ? 3.8 : format === 'toploader' ? 3.5 : 0.571
    return <div className={`bg-gray-200 animate-pulse rounded ${className || ''}`} style={{ aspectRatio: String(ar) }} />
  }
  return <img src={url} alt={`Heritage ${format} ${side} label`} className={className} />
}

export default HeritageCompactPreview
