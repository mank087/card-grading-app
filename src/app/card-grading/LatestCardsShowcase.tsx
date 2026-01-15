'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { CardSlabGrid } from '@/components/CardSlab'
import { getCardLabelData } from '@/lib/useLabelData'

// Get card detail page link based on category
const getCardLink = (card: any) => {
  const sportCategories = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports']
  if (card.category && sportCategories.includes(card.category)) return `/sports/${card.id}`
  if (card.category === 'Pokemon') return `/pokemon/${card.id}`
  if (card.category === 'MTG') return `/mtg/${card.id}`
  if (card.category === 'Lorcana') return `/lorcana/${card.id}`
  if (card.category === 'Other') return `/other/${card.id}`
  return `/card/${card.id}`
}

// Category badge colors and labels
const getCategoryColor = (category: string) => {
  if (category === 'Pokemon') return 'bg-yellow-500 text-gray-900'
  if (['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'].includes(category)) return 'bg-emerald-500 text-white'
  if (category === 'MTG') return 'bg-blue-500 text-white'
  if (category === 'Lorcana') return 'bg-purple-500 text-white'
  return 'bg-gray-500 text-white'
}

const getCategoryLabel = (category: string) => {
  if (['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling'].includes(category)) return 'Sports'
  return category
}

export default function FeaturedCardsShowcase() {
  const [cards, setCards] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch featured cards (admin-selected showcase cards)
  useEffect(() => {
    const fetchCards = async () => {
      try {
        const response = await fetch('/api/cards/featured')
        const data = await response.json()
        if (data.cards && data.cards.length > 0) {
          setCards(data.cards)
        }
      } catch (err) {
        console.error('Error fetching featured cards:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCards()
  }, [])

  // Auto-rotate every 3 seconds
  useEffect(() => {
    if (cards.length <= 1 || isPaused) return

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % cards.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [cards.length, isPaused])

  // Get visible cards (2 on each side + center)
  const getVisibleCards = useCallback(() => {
    if (cards.length === 0) return []

    const visible: { card: any; position: number; index: number }[] = []
    const positions = [-2, -1, 0, 1, 2] // far-left, left, center, right, far-right

    positions.forEach(pos => {
      let idx = (currentIndex + pos + cards.length) % cards.length
      visible.push({ card: cards[idx], position: pos, index: idx })
    })

    return visible
  }, [cards, currentIndex])

  const goToCard = useCallback((index: number) => {
    setCurrentIndex(index)
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-3" />
        <p className="text-gray-400 text-sm">Loading featured cards...</p>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-gray-400">No featured cards available</p>
      </div>
    )
  }

  const visibleCards = getVisibleCards()

  return (
    <div className="flex flex-col items-center w-full">
      {/* Header */}
      <div className="text-center mb-4">
        <h3 className="text-lg sm:text-xl font-bold text-white mb-0.5">
          Featured Grades
        </h3>
        <p className="text-purple-300 text-xs sm:text-sm">
          Professionally graded cards from our community
        </p>
      </div>

      {/* Carousel Container */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden"
        style={{ height: '440px' }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Gradient Fades on Edges */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-purple-900/80 to-transparent z-30 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-purple-900/80 to-transparent z-30 pointer-events-none" />

        {/* Cards */}
        <div className="absolute inset-0 flex items-center justify-center">
          {visibleCards.map(({ card, position, index }) => {
            const isCenter = position === 0
            const isAdjacent = Math.abs(position) === 1
            const isFar = Math.abs(position) === 2

            // Calculate transform based on position
            let translateX = position * (isCenter ? 0 : position > 0 ? 130 : 130)
            let scale = isCenter ? 1 : isAdjacent ? 0.75 : 0.55
            let opacity = isCenter ? 1 : isAdjacent ? 0.7 : 0.4
            let zIndex = isCenter ? 20 : isAdjacent ? 15 : 10

            // Adjust translateX for smooth spacing with wider cards
            if (isAdjacent) translateX = position * 165
            if (isFar) translateX = position * 260

            // Get label data for modern display
            const labelData = getCardLabelData(card)

            return (
              <div
                key={`${card.id}-${position}`}
                className="absolute transition-all duration-500 ease-out"
                style={{
                  transform: `translateX(${translateX}px) scale(${scale})`,
                  opacity,
                  zIndex,
                }}
              >
                {isCenter ? (
                  <Link href={getCardLink(card)} target="_blank" rel="noopener noreferrer" className="block relative">
                    <div className="w-[220px]">
                      <CardSlabGrid
                        displayName={labelData.primaryName}
                        setLineText={labelData.contextLine}
                        features={labelData.features}
                        serial={labelData.serial}
                        grade={labelData.grade}
                        condition={labelData.condition}
                        frontImageUrl={card.front_url}
                        isAlteredAuthentic={labelData.isAlteredAuthentic}
                        className="hover:shadow-xl transition-shadow duration-200"
                      />
                    </div>
                    {/* Category Badge */}
                    <div className="absolute -top-2 -right-2 z-30">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg ${getCategoryColor(card.category)}`}>
                        {getCategoryLabel(card.category)}
                      </span>
                    </div>
                  </Link>
                ) : (
                  <div
                    className="cursor-pointer hover:opacity-90 transition-opacity w-[220px]"
                    onClick={() => goToCard(index)}
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
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={() => setCurrentIndex(prev => (prev - 1 + cards.length) % cards.length)}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-40 w-8 h-8 bg-gray-800/80 hover:bg-gray-700 rounded-full flex items-center justify-center text-white transition-colors"
          aria-label="Previous card"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={() => setCurrentIndex(prev => (prev + 1) % cards.length)}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-40 w-8 h-8 bg-gray-800/80 hover:bg-gray-700 rounded-full flex items-center justify-center text-white transition-colors"
          aria-label="Next card"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-1.5 mt-3">
        {cards.map((_, index) => (
          <button
            key={index}
            onClick={() => goToCard(index)}
            className={`transition-all duration-300 rounded-full ${
              index === currentIndex
                ? 'w-4 h-1.5 bg-purple-500'
                : 'w-1.5 h-1.5 bg-gray-600 hover:bg-gray-500'
            }`}
            aria-label={`Go to card ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
