'use client'

import { ReactNode, useLayoutEffect, useRef, useState } from 'react'

/**
 * Scale-to-fit wrapper for HTML slab labels.
 *
 * The heritage label never breaks on mobile because it's an SVG: the whole
 * design scales as one unit. HTML labels (modern/traditional) are px-based
 * layouts that fall apart piecewise at narrow widths — fonts shrink out of
 * proportion to the grade numeral, the condition wraps, spacing drifts.
 *
 * This gives them the SVG property: at or above designWidth the children
 * render normally (full-width, byte-identical to the desktop design); below
 * it, the children render AT designWidth and the whole block is transform-
 * scaled down, so every width shows an exact miniature of the real label.
 */
export function ScaleToFit({
  designWidth,
  children,
  className,
}: {
  designWidth: number
  children: ReactNode
  className?: string
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [designHeight, setDesignHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    const measure = () => {
      const w = outer.clientWidth
      if (w > 0) setScale(Math.min(1, w / designWidth))
      const inner = innerRef.current
      if (inner) setDesignHeight(inner.offsetHeight)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(outer)
    if (innerRef.current) ro.observe(innerRef.current)
    return () => ro.disconnect()
  }, [designWidth])

  if (scale >= 1) {
    // Full size: children own the width like they always did.
    return <div ref={outerRef} className={className}>{children}</div>
  }

  return (
    <div
      ref={outerRef}
      className={className}
      style={{ height: designHeight != null ? designHeight * scale : undefined, overflow: 'hidden' }}
    >
      <div
        ref={innerRef}
        style={{ width: designWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
  )
}
