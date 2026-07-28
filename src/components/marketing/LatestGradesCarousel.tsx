'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { CardSlabGrid } from '@/components/CardSlab'
import { getCardLabelData } from '@/lib/useLabelData'

/**
 * Auto-scrolling feed of recently graded cards.
 *
 * Extracted from /pokemon-database so the category landing pages can reuse it
 * instead of carrying a second copy of the animation logic. Behaviour is
 * unchanged from the original: 30px/sec auto-scroll, loop back at the end,
 * pause on hover, pause for 2s after a touch, and arrow buttons that jump
 * two cards at a time.
 */
export interface LatestGradesCarouselProps {
  /** API returning { cards: [...] } — e.g. /api/pokemon-database/latest-grades */
  apiPath: string
  title: string
  subtitle?: string
  /** Route prefix for a card link, e.g. "/pokemon" */
  cardHrefPrefix: string
  /** Optional CTA rendered under the feed */
  cta?: { href: string; label: string; onClick?: () => void }
  /** Section wrapper classes (lets each page match its own background) */
  className?: string
}

const CARD_WIDTH = 280
const GAP = 24
const SCROLL_SPEED = 30 // pixels per second

export default function LatestGradesCarousel({
  apiPath,
  title,
  subtitle,
  cardHrefPrefix,
  cta,
  className = 'py-12 bg-gradient-to-br from-purple-900/30 via-gray-900 to-blue-900/30',
}: LatestGradesCarouselProps) {
  const [cards, setCards] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isScrollPaused, setIsScrollPaused] = useState(false)
  const [scrollPosition, setScrollPosition] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const isTouchingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetch(apiPath)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (!cancelled) setCards(data?.cards || []) })
      .catch(err => console.error('[LatestGrades] fetch failed:', err))
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [apiPath])

  // Auto-scroll animation
  useEffect(() => {
    const container = containerRef.current
    if (!container || cards.length === 0) return

    const animate = (currentTime: number) => {
      if (isScrollPaused || isTouchingRef.current) {
        lastTimeRef.current = 0
        animationRef.current = requestAnimationFrame(animate)
        return
      }
      if (lastTimeRef.current === 0) lastTimeRef.current = currentTime

      const deltaTime = (currentTime - lastTimeRef.current) / 1000
      lastTimeRef.current = currentTime

      const scrollAmount = SCROLL_SPEED * deltaTime
      const maxScroll = container.scrollWidth - container.clientWidth

      if (maxScroll > 0) {
        setScrollPosition(prev => {
          const next = prev + scrollAmount
          return next >= maxScroll ? 0 : next
        })
      }
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [isScrollPaused, cards.length])

  // Apply scroll position
  useEffect(() => {
    const container = containerRef.current
    if (container && !isTouchingRef.current) container.scrollLeft = scrollPosition
  }, [scrollPosition])

  const scrollBy = (direction: 'left' | 'right') => {
    const container = containerRef.current
    if (!container) return
    const step = (CARD_WIDTH + GAP) * 2
    const maxScroll = container.scrollWidth - container.clientWidth
    setScrollPosition(direction === 'left'
      ? Math.max(0, scrollPosition - step)
      : Math.min(maxScroll, scrollPosition + step))
  }

  const handleTouchEnd = () => {
    const container = containerRef.current
    if (container) setScrollPosition(container.scrollLeft)
    setTimeout(() => {
      isTouchingRef.current = false
      lastTimeRef.current = 0
    }, 2000)
  }

  // Hide entirely rather than render an empty shell
  if (!isLoading && cards.length === 0) return null

  return (
    <section className={className}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-end gap-4 mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">{title}</h2>
            {subtitle && <p className="text-gray-400 mt-2">{subtitle}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => scrollBy('left')}
              className="p-2 rounded-full bg-purple-900/50 hover:bg-purple-800 text-white transition-colors border border-purple-700"
              aria-label="Scroll left"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => scrollBy('right')}
              className="p-2 rounded-full bg-purple-900/50 hover:bg-purple-800 text-white transition-colors border border-purple-700"
              aria-label="Scroll right"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          onMouseEnter={() => { setIsScrollPaused(true); lastTimeRef.current = 0 }}
          onMouseLeave={() => { setIsScrollPaused(false); lastTimeRef.current = 0 }}
          onTouchStart={() => { isTouchingRef.current = true; lastTimeRef.current = 0 }}
          onTouchEnd={handleTouchEnd}
          className="flex flex-nowrap gap-6 overflow-x-auto pb-4 -mx-4 px-4"
          style={{
            scrollBehavior: 'auto',
            WebkitOverflowScrolling: 'touch',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}
        >
          {isLoading
            ? [...Array(5)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[280px] min-w-[280px] animate-pulse">
                  <div className="bg-gray-800 rounded-xl h-[420px]" />
                </div>
              ))
            : cards.map((card) => {
                const labelData = getCardLabelData(card)
                return (
                  <Link
                    key={card.id}
                    href={`${cardHrefPrefix}/${card.id}`}
                    className="flex-shrink-0 w-[280px] min-w-[280px] cursor-pointer block"
                  >
                    <CardSlabGrid
                      displayName={labelData.primaryName}
                      setLineText={labelData.contextLine}
                      features={labelData.features}
                      serial={labelData.serial}
                      grade={labelData.grade}
                      condition={labelData.condition}
                      frontImageUrl={card.front_url}
                      isAlteredAuthentic={labelData.isAlteredAuthentic}
                      className="hover:shadow-xl hover:shadow-purple-500/20 transition-shadow duration-200"
                    />
                  </Link>
                )
              })}
        </div>

        {cta && (
          <div className="mt-8 text-center">
            <Link
              href={cta.href}
              onClick={cta.onClick}
              className="inline-block bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 font-bold px-8 py-3 rounded-lg hover:from-yellow-400 hover:to-orange-400 transition-all shadow-lg hover:shadow-orange-500/25"
            >
              {cta.label}
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
