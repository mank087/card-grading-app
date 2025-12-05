'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getStoredSession, getAuthenticatedClient } from '../lib/directAuth'
import ScrollingCardBackground from './ui/ScrollingCardBackground'
import { getConditionFromGrade } from '@/lib/conditionAssessment'
import { CardSlabGrid } from '@/components/CardSlab'

// Helper functions to extract card info (matching collection page)
const stripMarkdown = (text: string | null | undefined): string | null => {
  if (!text) return null
  return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\#/g, '').replace(/\_/g, '')
}

const getCardInfo = (card: any) => {
  const dvgGrading = card.ai_grading || {}
  const setNameRaw = stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || dvgGrading.card_info?.set_name
  const subset = stripMarkdown(card.conversational_card_info?.subset) || card.subset || dvgGrading.card_info?.subset
  // Combine set name with subset if available (matching foldable label format)
  const setNameWithSubset = subset ? `${setNameRaw} - ${subset}` : setNameRaw
  return {
    card_name: stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || dvgGrading.card_info?.card_name,
    player_or_character: stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || dvgGrading.card_info?.player_or_character,
    set_name: setNameWithSubset,
    year: stripMarkdown(card.conversational_card_info?.year) || card.release_date || dvgGrading.card_info?.year,
    manufacturer: stripMarkdown(card.conversational_card_info?.manufacturer) || card.manufacturer_name || dvgGrading.card_info?.manufacturer,
    card_number: stripMarkdown(card.conversational_card_info?.card_number) || card.card_number || dvgGrading.card_info?.card_number,
    serial_number: stripMarkdown(card.conversational_card_info?.serial_number) || dvgGrading.card_info?.serial_number,
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
  if (card.dcm_grade_whole) return card.dcm_grade_whole
  if (card.grade_numeric) return card.grade_numeric
  return null
}

const formatGrade = (grade: number): string => {
  if (grade % 1 === 0.5) {
    return grade.toFixed(1)
  }
  return Math.round(grade).toString()
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

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [recentCards, setRecentCards] = useState<any[]>([])
  const [featuredCards, setFeaturedCards] = useState<any[]>([])

  useEffect(() => {
    const getUser = async () => {
      // Use direct auth session instead of Supabase client
      const session = getStoredSession()
      const sessionUser = session?.user

      setUser(sessionUser)

      if (sessionUser) {
        try {
          // Use authenticated client for database queries
          const authClient = getAuthenticatedClient()
          const { data } = await authClient
            .from('cards')
            .select('id, card_name, category, grade_numeric, ai_confidence_score, created_at')
            .eq('user_id', sessionUser.id)
            .order('created_at', { ascending: false })
            .limit(4)

          setRecentCards(data || [])
        } catch (err) {
          console.error('Error fetching recent cards:', err)
        }
      }
    }

    getUser()
  }, [])

  // Fetch featured cards (public for everyone)
  useEffect(() => {
    const getFeaturedCards = async () => {
      try {
        const response = await fetch('/api/cards/featured')
        const data = await response.json()
        setFeaturedCards(data.cards || [])
      } catch (err) {
        console.error('Error fetching featured cards:', err)
      }
    }

    getFeaturedCards()
  }, [])

  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 to-purple-700 text-white py-20 overflow-hidden">
        {/* Scrolling Card Background */}
        <ScrollingCardBackground opacity={40} blur={2} speed={1} />

        {/* Gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/70 to-purple-700/70 z-0"></div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="flex justify-center mb-6">
            <Image
              src="/DCM Logo white.png"
              alt="DCM Logo"
              width={100}
              height={100}
              className="object-contain"
            />
          </div>
          <h1 className="text-5xl font-bold mb-4">Dynamic Collectibles Management</h1>
          <p className="text-xl mb-8 max-w-3xl mx-auto leading-relaxed">
            Powered by <span className="font-semibold">DCM Optic™</span>, our proprietary artificial intelligence
            grading system featuring comprehensive 30-point inspection across centering, corners, edges, and surface
            with variable confidence scoring for precise analysis of trading cards including Sports, Pokémon®,
            Magic: The Gathering®, Disney Lorcana®, and more.
          </p>

          {user ? (
            <div className="space-x-4">
              <Link
                href="/upload"
                className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block"
              >
                Grade a Card
              </Link>
              <Link
                href="/collection"
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors inline-block"
              >
                View Collection
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block"
            >
              Get Started
            </Link>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose DCM?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Machine Learning Accuracy</h3>
              <p className="text-gray-600">Advanced AI technology delivers consistent, detailed, and reliable condition assessments you can trust.</p>
            </div>
            <div className="text-center">
              <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Showcase Card Condition</h3>
              <p className="text-gray-600">Whether collecting, reselling, or enjoying the hobby, get instant physical card condition analysis at your fingertips.</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Accurate Market Pricing</h3>
              <p className="text-gray-600">Graded cards include direct links to eBay and TCGPlayer for real-time, up-to-date market pricing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Cards Section - Auto-Scrolling Carousel */}
      {featuredCards.length > 0 && (
        <FeaturedCardsCarousel
          featuredCards={featuredCards}
          getCardInfo={getCardInfo}
          getCardGrade={getCardGrade}
          formatGrade={formatGrade}
          getCardLink={getCardLink}
        />
      )}

      {/* Recent Cards Section */}
      {user && recentCards.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold">Recent Grades</h2>
              <Link
                href="/collection"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                View All →
              </Link>
            </div>
            <div className="grid md:grid-cols-4 gap-6">
              {recentCards.map((card) => (
                <Link
                  key={card.id}
                  href={`/card/${card.id}`}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4"
                >
                  <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium mb-2 ${
                    card.category === 'Pokemon'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {card.category || 'Sports'}
                  </div>
                  <h3 className="font-semibold text-gray-900 truncate">
                    {card.card_name || 'Untitled Card'}
                  </h3>
                  {card.grade_numeric && (
                    <p className="text-lg font-bold text-blue-600 mt-2">
                      Grade: {card.grade_numeric}/{card.ai_confidence_score}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

// Featured Cards Carousel Component with auto-scroll and manual navigation
function FeaturedCardsCarousel({
  featuredCards,
  getCardInfo,
  getCardGrade,
  formatGrade,
  getCardLink
}: {
  featuredCards: any[]
  getCardInfo: (card: any) => any
  getCardGrade: (card: any) => number | null
  formatGrade: (grade: number) => string
  getCardLink: (card: any) => string
}) {
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
    <section className="py-16 bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Featured Grades</h2>
            <p className="text-gray-600 mt-2">Professionally graded cards from our community</p>
          </div>
          {/* Navigation Arrows */}
          <div className="flex gap-2">
            <button
              onClick={scrollLeft}
              className="p-2 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-700 transition-colors"
              aria-label="Scroll left"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={scrollRight}
              className="p-2 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-700 transition-colors"
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
            const cardInfo = getCardInfo(card)
            const isSportsCard = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'].includes(card.category || '')
            const displayName = isSportsCard
              ? (cardInfo.player_or_character || cardInfo.card_name || "Unknown Player")
              : (cardInfo.card_name || cardInfo.player_or_character || "Unknown Card")

            // Build special features string
            const features: string[] = []
            if (cardInfo.rookie_or_first === true || cardInfo.rookie_or_first === 'true') features.push('RC')
            if (cardInfo.autographed) features.push('Auto')
            const serialNum = cardInfo.serial_number
            if (serialNum && serialNum !== 'N/A' && !serialNum.toLowerCase().includes('not present') && !serialNum.toLowerCase().includes('none')) {
              features.push(serialNum)
            }

            // Build set details for Line 2 (Set Name • Card # • Year)
            const setName = cardInfo.set_name || "Unknown Set"
            const cardNumber = cardInfo.card_number
            const year = cardInfo.year
            const setLineText = [setName, cardNumber, year].filter(p => p).join(' • ')

            // Get grade and condition
            const grade = getCardGrade(card)
            const condition = card.conversational_condition_label
              ? card.conversational_condition_label.replace(/\s*\([A-Z]+\)/, '')
              : (grade ? getConditionFromGrade(grade) : '')

            return (
              <Link
                key={card.id}
                href={getCardLink(card)}
                className="flex-shrink-0 w-[280px] cursor-pointer block"
              >
                <CardSlabGrid
                  displayName={displayName}
                  setLineText={setLineText}
                  features={features}
                  serial={card.serial}
                  grade={grade}
                  condition={condition}
                  frontImageUrl={card.front_url}
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
