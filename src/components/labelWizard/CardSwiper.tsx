/**
 * Label Wizard — card preview pager.
 *
 * v2: a single contained preview (no horizontal scroll track — the v1
 * scroll-snap strip bled off the page on desktop and mobile) with:
 *   - arrow buttons INSIDE the preview box
 *   - touch swipe on the preview itself
 *   - a numbered thumbnail rail to jump straight to any card (this is also
 *     how Step 5 picks which card's text you're editing)
 * Only the active card's preview mounts, which keeps ten-card selections
 * cheap on mobile.
 */
'use client'

import React, { useRef } from 'react'

interface CardSwiperProps {
  count: number
  activeIndex: number
  onIndexChange: (index: number) => void
  renderItem: (index: number) => React.ReactNode
  /** Caption under the rail, e.g. the visible card's name. */
  caption?: (index: number) => React.ReactNode
  /** Thumbnail image for the rail; falls back to a numbered chip. */
  thumbSrc?: (index: number) => string | null | undefined
}

export function CardSwiper({ count, activeIndex, onIndexChange, renderItem, caption, thumbSrc }: CardSwiperProps) {
  const touchStartX = useRef<number | null>(null)

  if (count === 0) return null

  const prev = () => onIndexChange(Math.max(0, activeIndex - 1))
  const next = () => onIndexChange(Math.min(count - 1, activeIndex + 1))

  return (
    <div className="w-full">
      {/* Single preview, swipeable, arrows inside the box */}
      <div
        className="relative w-full max-w-[280px] mx-auto select-none"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current
          touchStartX.current = null
          if (start === null) return
          const dx = (e.changedTouches[0]?.clientX ?? start) - start
          if (dx < -40) next()
          else if (dx > 40) prev()
        }}
      >
        {renderItem(activeIndex)}
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous card"
              onClick={prev}
              disabled={activeIndex === 0}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 shadow border border-gray-200 text-gray-600 hover:text-purple-700 disabled:opacity-0 disabled:pointer-events-none flex items-center justify-center"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next card"
              onClick={next}
              disabled={activeIndex === count - 1}
              className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 shadow border border-gray-200 text-gray-600 hover:text-purple-700 disabled:opacity-0 disabled:pointer-events-none flex items-center justify-center"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Thumbnail rail — contained, scrolls inside itself, never the page */}
      {count > 1 && (
        <div className="mt-3 max-w-full overflow-x-auto">
          <div className="flex gap-1.5 justify-center min-w-max px-2 pb-1" role="tablist" aria-label="Selected cards">
            {Array.from({ length: count }, (_, i) => {
              const src = thumbSrc?.(i)
              const active = i === activeIndex
              return (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`Card ${i + 1} of ${count}`}
                  onClick={() => onIndexChange(i)}
                  className={`relative shrink-0 w-9 h-12 rounded-md overflow-hidden border-2 transition-all ${
                    active ? 'border-purple-600 ring-2 ring-purple-200' : 'border-gray-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  {src ? (
                    <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center bg-gray-100 text-[11px] font-bold text-gray-500">
                      {i + 1}
                    </span>
                  )}
                  <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] font-semibold text-center leading-tight">
                    {i + 1}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {caption && <div className="text-center mt-1.5">{caption(activeIndex)}</div>}
    </div>
  )
}

export default CardSwiper
