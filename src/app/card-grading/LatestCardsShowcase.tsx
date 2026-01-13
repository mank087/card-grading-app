'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getConditionFromGrade } from '@/lib/conditionAssessment'

// Helper functions to extract card info
const stripMarkdown = (text: string | null | undefined): string | null => {
  if (!text) return null
  return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\#/g, '').replace(/\_/g, '')
}

const getCardInfo = (card: any) => {
  const dvgGrading = card.ai_grading || {}
  const setNameRaw = stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || dvgGrading.card_info?.set_name
  const subset = stripMarkdown(card.conversational_card_info?.subset) || card.subset || dvgGrading.card_info?.subset
  const setNameWithSubset = subset ? `${setNameRaw} - ${subset}` : setNameRaw
  return {
    card_name: stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || dvgGrading.card_info?.card_name,
    player_or_character: stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || dvgGrading.card_info?.player_or_character,
    set_name: setNameWithSubset,
    year: stripMarkdown(card.conversational_card_info?.year) || card.release_date || dvgGrading.card_info?.year,
    card_number: stripMarkdown(card.conversational_card_info?.card_number_raw) || stripMarkdown(card.conversational_card_info?.card_number) || card.card_number || dvgGrading.card_info?.card_number,
    rookie_or_first: card.conversational_card_info?.rookie_or_first || dvgGrading.card_info?.rookie_or_first,
    autographed: card.conversational_card_info?.autographed || false,
  }
}

const getPlayerName = (card: any) => {
  const cardInfo = getCardInfo(card)
  const isSportsCard = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'].includes(card.category || '')
  return isSportsCard
    ? (cardInfo.player_or_character || cardInfo.card_name || 'Unknown Player')
    : (cardInfo.card_name || cardInfo.player_or_character || 'Unknown Card')
}

const getCardGrade = (card: any) => {
  if (card.conversational_decimal_grade !== null && card.conversational_decimal_grade !== undefined) {
    return card.conversational_decimal_grade
  }
  if (card.dvg_decimal_grade !== null && card.dvg_decimal_grade !== undefined) {
    return card.dvg_decimal_grade
  }
  return null
}

const getCardLink = (card: any) => {
  const sportCategories = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports']
  if (card.category && sportCategories.includes(card.category)) return `/sports/${card.id}`
  if (card.category === 'Pokemon') return `/pokemon/${card.id}`
  if (card.category === 'MTG') return `/mtg/${card.id}`
  if (card.category === 'Lorcana') return `/lorcana/${card.id}`
  if (card.category === 'Other') return `/other/${card.id}`
  return `/card/${card.id}`
}

const buildSetLineText = (card: any) => {
  const cardInfo = getCardInfo(card)
  const parts: string[] = []
  if (cardInfo.set_name) parts.push(cardInfo.set_name)
  if (cardInfo.card_number) parts.push(`#${cardInfo.card_number}`)
  if (cardInfo.year) parts.push(cardInfo.year)
  return parts.join(' • ') || 'Unknown Set'
}

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

// Mini card slab for the carousel
function MiniCardSlab({ card, isCenter, onClick }: { card: any; isCenter: boolean; onClick: () => void }) {
  const displayName = getPlayerName(card)
  const grade = getCardGrade(card)
  const condition = grade !== null ? getConditionFromGrade(Math.round(grade)) : ''
  const setLineText = buildSetLineText(card)

  // Calculate scale for name
  const maxChars = isCenter ? 16 : 12
  const nameScaleX = displayName.length <= maxChars ? 1 : Math.max(0.5, maxChars / displayName.length)

  const slabBorderStyle = {
    background: 'linear-gradient(145deg, #9333ea 0%, #6b21a8 25%, #a855f7 50%, #7c3aed 75%, #581c87 100%)',
    boxShadow: isCenter
      ? '0 8px 30px rgba(147, 51, 234, 0.6), inset 0 1px 0 rgba(255,255,255,0.2)'
      : '0 4px 15px rgba(147, 51, 234, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
  }

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer transition-all duration-500 ${isCenter ? 'z-20' : 'z-10'}`}
    >
      <div
        className="rounded-xl p-1 overflow-hidden"
        style={{
          ...slabBorderStyle,
          width: isCenter ? '220px' : '160px',
        }}
      >
        <div className="bg-white rounded-lg overflow-hidden">
          {/* Compact Label */}
          <div className={`bg-gradient-to-b from-gray-50 to-white ${isCenter ? 'p-2.5 h-[70px]' : 'p-1.5 h-[50px]'}`}>
            <div className="flex items-center justify-between gap-1 h-full">
              {/* DCM Logo */}
              <div className="flex-shrink-0">
                <img
                  src="/DCM-logo.png"
                  alt="DCM"
                  className={isCenter ? 'h-6 w-auto' : 'h-4 w-auto'}
                />
              </div>

              {/* Card Info */}
              <div className="flex-1 min-w-0 mx-1">
                <div
                  className="font-bold text-gray-900 leading-tight whitespace-nowrap origin-left"
                  style={{
                    fontSize: isCenter ? '10px' : '8px',
                    transform: `scaleX(${nameScaleX})`,
                  }}
                >
                  {displayName}
                </div>
                {isCenter && (
                  <div
                    className="text-gray-600 leading-tight truncate"
                    style={{ fontSize: '8px' }}
                  >
                    {setLineText}
                  </div>
                )}
              </div>

              {/* Grade */}
              <div className="text-center flex-shrink-0">
                <div className={`font-bold text-purple-700 leading-none ${isCenter ? 'text-xl' : 'text-lg'}`}>
                  {grade !== null ? Math.round(grade).toString() : 'N/A'}
                </div>
                {isCenter && condition && (
                  <div className="text-purple-600 text-[7px] font-semibold">{condition}</div>
                )}
              </div>
            </div>
          </div>

          {/* Purple Separator */}
          <div
            className="h-0.5"
            style={{ background: 'linear-gradient(90deg, #9333ea 0%, #a855f7 50%, #9333ea 100%)' }}
          />

          {/* Card Image */}
          <div
            className="relative bg-gray-100"
            style={{ aspectRatio: '3/4' }}
          >
            {card.front_url ? (
              <Image
                src={card.front_url}
                alt={displayName}
                fill
                sizes={isCenter ? '220px' : '160px'}
                className="object-contain"
                unoptimized={card.front_url.includes('supabase')}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                No Image
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Badge - Center card only */}
      {isCenter && (
        <div className="absolute -top-2 -right-2 z-30">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg ${getCategoryColor(card.category)}`}>
            {getCategoryLabel(card.category)}
          </span>
        </div>
      )}
    </div>
  )
}

export default function LatestCardsShowcase() {
  const [cards, setCards] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch latest graded cards
  useEffect(() => {
    const fetchCards = async () => {
      try {
        const response = await fetch('/api/cards/latest-grades?limit=20')
        const data = await response.json()
        if (data.cards && data.cards.length > 0) {
          setCards(data.cards)
        }
      } catch (err) {
        console.error('Error fetching cards:', err)
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
        <p className="text-gray-400 text-sm">Loading latest grades...</p>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-gray-400">No graded cards available</p>
      </div>
    )
  }

  const visibleCards = getVisibleCards()
  const centerCard = cards[currentIndex]

  return (
    <div className="flex flex-col items-center w-full">
      {/* Header */}
      <div className="text-center mb-4">
        <h3 className="text-lg sm:text-xl font-bold text-white mb-0.5">
          Latest Cards Graded by DCM!
        </h3>
        <p className="text-purple-300 text-xs sm:text-sm">
          Click to View Card Reports
        </p>
      </div>

      {/* Carousel Container */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden"
        style={{ height: '380px' }}
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
            let scale = isCenter ? 1 : isAdjacent ? 0.8 : 0.6
            let opacity = isCenter ? 1 : isAdjacent ? 0.7 : 0.4
            let zIndex = isCenter ? 20 : isAdjacent ? 15 : 10

            // Adjust translateX for smooth spacing
            if (isAdjacent) translateX = position * 140
            if (isFar) translateX = position * 220

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
                    <MiniCardSlab card={card} isCenter={true} onClick={() => {}} />
                  </Link>
                ) : (
                  <div
                    className="cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => goToCard(index)}
                  >
                    <MiniCardSlab card={card} isCenter={false} onClick={() => goToCard(index)} />
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

      {/* "Live" indicator */}
      <div className="flex items-center gap-2 mt-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        <span className="text-green-400 text-xs font-medium">Live Feed</span>
      </div>
    </div>
  )
}
