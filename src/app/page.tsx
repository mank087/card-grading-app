'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getStoredSession, getAuthenticatedClient } from '../lib/directAuth'
import ScrollingCardBackground from './ui/ScrollingCardBackground'
import { getConditionFromGrade } from '@/lib/conditionAssessment'

// Helper functions to extract card info (matching collection page)
const stripMarkdown = (text: string | null | undefined): string | null => {
  if (!text) return null
  return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\#/g, '').replace(/\_/g, '')
}

const getCardInfo = (card: any) => {
  const dvgGrading = card.ai_grading || {}
  return {
    card_name: stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || dvgGrading.card_info?.card_name,
    player_or_character: stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || dvgGrading.card_info?.player_or_character,
    set_name: stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || dvgGrading.card_info?.set_name,
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
            grading system featuring comprehensive multi-point inspection across centering, corners, edges, and surface
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
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose Dynamic Collectibles Management?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">AI-Powered Accuracy</h3>
              <p className="text-gray-600">Advanced AI technology provides consistent and detailed condition assessments.</p>
            </div>
            <div className="text-center">
              <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Multiple Categories</h3>
              <p className="text-gray-600">Support for Sports cards, Pokémon, and other trading card categories.</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure & Reliable</h3>
              <p className="text-gray-600">Your collection data is safely stored and easily accessible.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Cards Section */}
      {featuredCards.length > 0 && (
        <section className="py-16 bg-gradient-to-br from-purple-50 to-blue-50">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Featured Grades</h2>
                <p className="text-gray-600 mt-2">Professionally graded cards from our community</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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

                // Dynamic sizing for player name (Line 1)
                const nameFontSize = displayName.length > 35 ? '11px' : displayName.length > 25 ? '12px' : '14px'

                // Dynamic sizing for set details (Line 2)
                const setFontSize = setName.length > 30 ? '10px' : '11px'

                return (
                  <div key={card.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
                    {/* Professional Label (PSA-Style) - ABOVE IMAGE */}
                    <div className="bg-gradient-to-b from-gray-50 to-white border-2 border-purple-600 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-1.5">
                        {/* Left: DCM Logo */}
                        <div className="flex-shrink-0 -ml-1">
                          <img
                            src="/DCM-logo.png"
                            alt="DCM"
                            className="h-9 w-auto"
                          />
                        </div>

                        {/* Center: Card Information - New 4-Line Structure */}
                        <div className="flex-1 min-w-0 mx-1 flex flex-col justify-center gap-0.5">
                          {/* Line 1: Player/Card Name - Dynamic Font Sizing */}
                          <div
                            className="font-bold text-gray-900 leading-tight truncate"
                            style={{ fontSize: nameFontSize }}
                            title={displayName}
                          >
                            {displayName}
                          </div>

                          {/* Line 2: Set Name • Card # • Year */}
                          <div
                            className="text-gray-700 leading-tight"
                            style={{
                              fontSize: setFontSize,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                            title={`${setName} • ${cardNumber || ''} • ${year || 'N/A'}`}
                          >
                            {[setName, cardNumber, year].filter(p => p).join(' • ')}
                          </div>

                          {/* Line 3: Special Features (RC, Auto, Serial #) - Only if present */}
                          {features.length > 0 && (
                            <div className="text-blue-600 font-semibold text-[10px] leading-tight truncate">
                              {features.join(' • ')}
                            </div>
                          )}

                          {/* Line 4: DCM Serial Number */}
                          <div className="text-gray-500 font-mono truncate text-[10px] leading-tight">
                            {card.serial}
                          </div>
                        </div>

                        {/* Right: Grade Display */}
                        <div className="text-center flex-shrink-0">
                          {(() => {
                            const grade = getCardGrade(card)
                            const condition = card.conversational_condition_label
                              ? card.conversational_condition_label.replace(/\s*\([A-Z]+\)/, '')
                              : (grade ? getConditionFromGrade(grade) : '')

                            return (
                              <>
                                <div className="font-bold text-purple-700 text-3xl leading-none">
                                  {grade ? formatGrade(grade) : '?'}
                                </div>
                                {condition && (
                                  <>
                                    <div className="border-t-2 border-purple-600 w-8 mx-auto my-1"></div>
                                    <div className="font-semibold text-purple-600 text-[0.65rem] leading-tight">
                                      {condition}
                                    </div>
                                  </>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Card Image */}
                    <div className="aspect-[3/4] relative">
                      <CardThumbnail url={card.front_url} />

                      {/* Visibility Badge */}
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full text-xs font-semibold border-2 bg-green-100 text-green-800 border-green-500">
                        🌐 Public
                      </div>
                    </div>

                    {/* View Details Button */}
                    <div className="p-3">
                      <Link
                        href={getCardLink(card)}
                        className="inline-block w-full text-center bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
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

function CardThumbnail({ url }: { url: string | null }) {
  const [imageError, setImageError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const maxRetries = 2

  // Reset error state when URL changes
  useEffect(() => {
    setImageError(false)
    setRetryCount(0)
    setIsLoading(true)
  }, [url])

  // Handle image load error with retry logic
  const handleError = () => {
    if (retryCount < maxRetries) {
      // Retry loading the image after a delay
      setTimeout(() => {
        setRetryCount(prev => prev + 1)
        setImageError(false)
        setIsLoading(true)
      }, 1000 * (retryCount + 1)) // Exponential backoff: 1s, 2s
    } else {
      setImageError(true)
      setIsLoading(false)
    }
  }

  if (!url) {
    return (
      <div className="w-full h-full border grid place-items-center text-sm text-gray-500 bg-gray-100">
        No image
      </div>
    )
  }

  if (imageError) {
    return (
      <div className="w-full h-full border grid place-items-center text-sm text-gray-500 bg-gray-100">
        <div className="text-center p-4">
          <div className="text-2xl mb-2">🖼️</div>
          <div className="text-xs">Image unavailable</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative bg-gray-100">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-pulse text-gray-400">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
      )}
      <Image
        src={`${url}${retryCount > 0 ? `&retry=${retryCount}` : ''}`}
        alt="Card"
        fill
        className="object-contain"
        onLoad={() => setIsLoading(false)}
        onError={handleError}
        unoptimized
      />
    </div>
  )
}
