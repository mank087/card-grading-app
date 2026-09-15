'use client'

/**
 * An image that expands to a full-screen lightbox on tap or click. Used for
 * the package artwork so a phone reader can actually inspect the slab montage
 * and the package sheet. Closes on backdrop tap, the close button or Escape.
 */
import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'

interface ZoomableImageProps {
  src: string
  alt: string
  width: number
  height: number
  sizes: string
  priority?: boolean
  className?: string
  style?: React.CSSProperties
  /** Larger image to show in the lightbox; defaults to `src`. */
  zoomSrc?: string
  zoomWidth?: number
  zoomHeight?: number
  zoomAlt?: string
  zoomLabel?: string
}

export default function ZoomableImage({ src, alt, width, height, sizes, priority = false, className, style, zoomSrc, zoomWidth, zoomHeight, zoomAlt, zoomLabel = 'Expand image' }: ZoomableImageProps) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={zoomLabel}
        className="dcm-zoomable"
        style={{ display: 'block', width: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'zoom-in' }}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          className={className}
          style={style}
        />
      </button>
      {open && (
        // data-dcm-keep: the native app's WebView sweeps away fixed-position
        // elements shaped like the floating help bot (bottom/right near 0,
        // high z-index), which is exactly this overlay. The attribute is the
        // opt-out the app honours, for the element and everything inside it.
        <div
          role="dialog"
          aria-modal="true"
          data-dcm-keep="1"
          aria-label={zoomAlt ?? alt}
          onClick={close}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(12, 10, 24, 0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', cursor: 'zoom-out', overflow: 'auto' }}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{ position: 'fixed', top: 12, right: 12, width: 44, height: 44, borderRadius: 22, border: 0, background: 'rgba(255,255,255,0.14)', color: 'white', fontSize: 22, lineHeight: '44px', cursor: 'pointer' }}
          >
            ×
          </button>
          <Image
            src={zoomSrc ?? src}
            alt={zoomAlt ?? alt}
            width={zoomWidth ?? width}
            height={zoomHeight ?? height}
            sizes="100vw"
            onClick={(event) => event.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', borderRadius: 12, background: 'white', cursor: 'default' }}
          />
        </div>
      )}
    </>
  )
}
