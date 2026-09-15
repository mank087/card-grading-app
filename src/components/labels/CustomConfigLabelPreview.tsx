'use client'

/**
 * A saved custom label config (custom-N), rendered exactly the way it prints.
 *
 * Custom slots are drawn by customSlabLabelGenerator's canvas renderer, not by
 * any of the built-in React labels, so every surface that previews one has to
 * go through that renderer or it shows the customer a label they will not get.
 * This is that one shared piece: the Label Wizard's preview and the card
 * Edit Label modal both use it.
 */
import React, { useRef } from 'react'
import { useLabelPreview } from '@/hooks/useLabelPreview'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'
import type { CustomLabelConfig } from '@/lib/labelPresets'

export interface CustomConfigLabelPreviewProps {
  data: SlabLabelData | null
  config: CustomLabelConfig
  className?: string
  /** Debounce for the canvas render; the wizard uses 150ms for a live slider. */
  debounceMs?: number
}

export function CustomConfigLabelPreview({
  data,
  config,
  className = 'w-full',
  debounceMs = 150,
}: CustomConfigLabelPreviewProps) {
  // The hook copies its result into this canvas for desktop display; the
  // data URL is what we actually render, so a detached ref is fine.
  const dummyRef = useRef<HTMLCanvasElement | null>(null)
  const { previewDataUrl, isRendering } = useLabelPreview({ config, data, canvasRef: dummyRef, debounceMs })

  if (!previewDataUrl) {
    return <div className={`${className} bg-gray-200 animate-pulse rounded`} style={{ aspectRatio: '3.5 / 1' }} />
  }
  return (
    <div className="relative w-full">
      <img src={previewDataUrl} alt="Label preview" className={`${className} h-auto`} />
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/40">
          <div className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}

export default CustomConfigLabelPreview
