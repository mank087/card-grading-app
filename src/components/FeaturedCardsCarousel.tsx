'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { CardSlabGrid } from '@/components/CardSlab'
import { getCardLabelData } from '@/lib/useLabelData'
import { resolveHeritageBandColors } from '@/lib/labelLab/heritageLayout'
import { categoryToRouteSlug } from '@/lib/postGradeEmailTemplates'

const getCardLink = (card: any) => `/${categoryToRouteSlug(card.category)}/${card.id}`

/**
 * Auto-scrolling rail of recently graded cards.
 *
 * Extracted from src/app/page.tsx so the card show landing pages can show real
 * graded slabs instead of two static examples. Three of the four props it used
 * to take (getCardInfo, getCardGrade, formatGrade) were passed in and never
 * read, so they are gone; getCardLink is derived here instead of threaded
 * through, since it is a one-liner over the category slug.
 *
 * `theme` exists because the homepage section is light and the card show pages
 * are dark. Everything else about the rail is identical.
 */
export interface FeaturedCardsCarouselProps {
  featuredCards: any[]
  heading?: string
  subheading?: string
  showViewAll?: boolean
  theme?: 'light' | 'dark'
}

export default function FeaturedCardsCarousel({
  featuredCards,
  heading = 'Real Cards, Real Grades',
  subheading = 'Recently graded by collectors like you. Tap any card to see its full report.',
  showViewAll = true,
  theme = 'light',
}: FeaturedCardsCarouselProps) {
  const t = theme === 'dark'
    ? { section: 'py-12 bg-gray-900 border-t border-gray-800', h2: 'text-white', sub: 'text-gray-400', link: 'text-emerald-400 hover:text-emerald-300', btn: 'bg-gray-800 hover:bg-gray-700 text-gray-200' }
    : { section: 'py-16 bg-gradient-to-br from-purple-50 to-blue-50', h2: 'text-gray-900', sub: 'text-gray-600', link: 'text-purple-600 hover:text-purple-700', btn: 'bg-purple-100 hover:bg-purple-200 text-purple-700' }
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [scrollPosition, setScrollPosition] = useState(0)
  const animationRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const isTouchingRef = useRef(false)

  // Auto-scroll speed (pixels per second) - slow enough to read
  const scrollSpeed = 30

  // Handle auto-scrolling animation
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const animate = (currentTime: number) => {
      // Don't animate if paused or touching
      if (isPaused || isTouchingRef.current) {
        lastTimeRef.current = 0
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime
      }

      const deltaTime = (currentTime - lastTimeRef.current) / 1000
      lastTimeRef.current = currentTime

      const scrollAmount = scrollSpeed * deltaTime
      const maxScroll = container.scrollWidth - container.clientWidth

      // Only scroll if there's content to scroll
      if (maxScroll > 0) {
        setScrollPosition(prev => {
          let newPosition = prev + scrollAmount
          // Loop back to start when reaching the end
          if (newPosition >= maxScroll) {
            newPosition = 0
          }
          return newPosition
        })
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPaused])

  // Apply scroll position
  useEffect(() => {
    const container = scrollContainerRef.current
    if (container && !isTouchingRef.current) {
      container.scrollLeft = scrollPosition
    }
  }, [scrollPosition])

  // Manual scroll handlers
  const scrollLeft = useCallback(() => {
    const container = scrollContainerRef.current
    if (container) {
      const cardWidth = 280 + 24 // card width + gap
      const newPosition = Math.max(0, scrollPosition - cardWidth * 2)
      setScrollPosition(newPosition)
    }
  }, [scrollPosition])

  const scrollRight = useCallback(() => {
    const container = scrollContainerRef.current
    if (container) {
      const cardWidth = 280 + 24 // card width + gap
      const maxScroll = container.scrollWidth - container.clientWidth
      const newPosition = Math.min(maxScroll, scrollPosition + cardWidth * 2)
      setScrollPosition(newPosition)
    }
  }, [scrollPosition])

  // Pause auto-scroll on hover (desktop)
  const handleMouseEnter = () => {
    setIsPaused(true)
    lastTimeRef.current = 0
  }

  const handleMouseLeave = () => {
    setIsPaused(false)
    lastTimeRef.current = 0
  }

  // Handle touch events (mobile)
  const handleTouchStart = () => {
    isTouchingRef.current = true
    lastTimeRef.current = 0
  }

  const handleTouchEnd = () => {
    // Sync scroll position with actual container position after touch
    const container = scrollContainerRef.current
    if (container) {
      setScrollPosition(container.scrollLeft)
    }
    // Small delay before resuming auto-scroll to let user finish interaction
    setTimeout(() => {
      isTouchingRef.current = false
      lastTimeRef.current = 0
    }, 2000)
  }

  return (
    <section className={t.section}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className={`text-3xl font-bold ${t.h2}`}>{heading}</h2>
            {subheading && <p className={`mt-2 ${t.sub}`}>{subheading}</p>}
            {showViewAll && (
              <Link
                href="/featured"
                className={`inline-block mt-2 text-sm font-semibold transition-colors ${t.link}`}
              >
                View All &rarr;
              </Link>
            )}
          </div>
          {/* Navigation Arrows */}
          <div className="flex gap-2">
            <button
              onClick={scrollLeft}
              className={`p-2 rounded-full transition-colors ${t.btn}`}
              aria-label="Scroll left"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={scrollRight}
              className={`p-2 rounded-full transition-colors ${t.btn}`}
              aria-label="Scroll right"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrolling Container */}
        <div
          ref={scrollContainerRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide"
          style={{
            scrollBehavior: 'auto',
            WebkitOverflowScrolling: 'touch',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none'
          }}
        >
          {featuredCards.map((card) => {
            // 🎯 Use unified label data for consistent display
            const labelData = getCardLabelData(card)

            return (
              <Link
                key={card.id}
                href={getCardLink(card)}
                className="flex-shrink-0 w-[280px] cursor-pointer block"
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
                  heritage={{ pattern: 'diamond', bandColors: resolveHeritageBandColors(card.card_colors) }}
                  className="hover:shadow-xl transition-shadow duration-200"
                />
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
