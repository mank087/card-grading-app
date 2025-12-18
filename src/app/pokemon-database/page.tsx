'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getStoredSession } from '@/lib/directAuth'
import { CardSlabGrid } from '@/components/CardSlab'
import { getCardLabelData } from '@/lib/useLabelData'

interface PokemonCard {
  id: string
  name: string
  name_display?: string // For Japanese cards with English translation appended
  name_english?: string // English name for Japanese cards
  number: string
  local_id?: string // Japanese cards use local_id
  set_id: string
  set_name: string
  set_series: string
  set_printed_total: number
  set_release_date: string
  supertype: string
  subtypes: string[]
  types: string[]
  hp: string
  rarity: string
  artist?: string
  illustrator?: string // Japanese cards use illustrator instead of artist
  evolves_from: string
  flavor_text: string
  image_small?: string
  image_large?: string
  image_url?: string // Japanese cards use image_url
  tcgplayer_url: string
  cardmarket_url: string
  language?: 'en' | 'ja' // Language indicator
}

interface PokemonSet {
  id: string
  name: string
  series: string
  printed_total: number
  release_date: string
  logo_url: string
  symbol_url: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function PokemonDatabasePage() {
  // Auth state
  const [user, setUser] = useState<any>(null)
  const [credits, setCredits] = useState<number>(0)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)

  // Search state
  const [searchName, setSearchName] = useState('')
  const [searchNumber, setSearchNumber] = useState('')
  const [searchSetTotal, setSearchSetTotal] = useState('')
  const [selectedSetId, setSelectedSetId] = useState('')
  const [debouncedName, setDebouncedName] = useState('')
  const [searchLanguage, setSearchLanguage] = useState<'en' | 'ja' | 'all'>('en')

  // Results state
  const [cards, setCards] = useState<PokemonCard[]>([])
  const [sets, setSets] = useState<PokemonSet[]>([])
  const [setsBySeries, setSetsBySeries] = useState<Record<string, PokemonSet[]>>({})
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Detail panel state
  const [selectedCard, setSelectedCard] = useState<PokemonCard | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  // Latest DCM grades state
  const [latestGrades, setLatestGrades] = useState<any[]>([])
  const [isLoadingGrades, setIsLoadingGrades] = useState(true)

  // Auto-scroll state for latest grades
  const [isScrollPaused, setIsScrollPaused] = useState(false)
  const [scrollPosition, setScrollPosition] = useState(0)
  const animationRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const isTouchingRef = useRef(false)

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)
  const latestGradesRef = useRef<HTMLDivElement>(null)

  // Load auth and credits
  useEffect(() => {
    const loadAuth = async () => {
      const session = getStoredSession()
      setUser(session?.user || null)

      if (session?.user) {
        try {
          const res = await fetch('/api/credits')
          const data = await res.json()
          setCredits(data.credits || 0)
        } catch (err) {
          console.error('Failed to fetch credits:', err)
        }
      }
      setIsLoadingAuth(false)
    }
    loadAuth()
  }, [])

  // Load sets when language changes
  useEffect(() => {
    const loadSets = async () => {
      try {
        const res = await fetch(`/api/pokemon-database/sets?language=${searchLanguage}`)
        const data = await res.json()
        setSets(data.sets || [])
        setSetsBySeries(data.setsBySeries || {})
        // Clear selected set when language changes (sets are different)
        setSelectedSetId('')
      } catch (err) {
        console.error('Failed to fetch sets:', err)
      }
    }
    loadSets()
  }, [searchLanguage])

  // Load latest DCM Pokemon grades on mount
  useEffect(() => {
    const loadLatestGrades = async () => {
      try {
        const res = await fetch('/api/pokemon-database/latest-grades')
        const data = await res.json()
        setLatestGrades(data.cards || [])
      } catch (err) {
        console.error('Failed to fetch latest grades:', err)
      } finally {
        setIsLoadingGrades(false)
      }
    }
    loadLatestGrades()
  }, [])

  // Auto-scroll animation for latest grades
  const scrollSpeed = 30 // pixels per second

  useEffect(() => {
    const container = latestGradesRef.current
    if (!container || latestGrades.length === 0) return

    const animate = (currentTime: number) => {
      // Don't animate if paused or touching
      if (isScrollPaused || isTouchingRef.current) {
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
  }, [isScrollPaused, latestGrades.length])

  // Apply scroll position to container
  useEffect(() => {
    const container = latestGradesRef.current
    if (container && !isTouchingRef.current) {
      container.scrollLeft = scrollPosition
    }
  }, [scrollPosition])

  // Debounce name search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedName(searchName)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchName])

  // Search when filters change
  const searchCards = useCallback(async (page = 1) => {
    // Don't search if no filters applied
    if (!debouncedName && !selectedSetId && !searchNumber && !searchSetTotal) {
      setCards([])
      setHasSearched(false)
      return
    }

    setIsLoading(true)
    setHasSearched(true)

    try {
      const params = new URLSearchParams()
      if (debouncedName) params.set('name', debouncedName)
      if (selectedSetId) params.set('set_id', selectedSetId)
      if (searchNumber) params.set('number', searchNumber)
      if (searchSetTotal) params.set('set_total', searchSetTotal)
      params.set('language', searchLanguage)
      params.set('page', page.toString())
      params.set('limit', '50')

      const res = await fetch(`/api/pokemon-database/search?${params}`)
      const data = await res.json()

      setCards(data.cards || [])
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
    } catch (err) {
      console.error('Search failed:', err)
      setCards([])
    } finally {
      setIsLoading(false)
    }
  }, [debouncedName, selectedSetId, searchNumber, searchSetTotal, searchLanguage])

  // Trigger search on filter changes
  useEffect(() => {
    searchCards(1)
  }, [debouncedName, selectedSetId, searchNumber, searchSetTotal, searchLanguage, searchCards])

  // Open card detail panel
  const openCardDetail = (card: PokemonCard) => {
    setSelectedCard(card)
    setIsPanelOpen(true)
  }

  // Close card detail panel
  const closeCardDetail = () => {
    setIsPanelOpen(false)
    setTimeout(() => setSelectedCard(null), 300) // Clear after animation
  }

  // Get Grade CTA link based on auth state
  const getGradeCtaLink = () => {
    if (!user) {
      return '/login?mode=signup&redirect=/upload/pokemon'
    }
    if (credits <= 0) {
      return '/account#credits'
    }
    return '/upload/pokemon'
  }

  const getGradeCtaText = () => {
    if (!user) return 'Sign Up to Grade'
    if (credits <= 0) return 'Buy Credits to Grade'
    return 'Grade This Card'
  }

  // Format release year from date
  const getYear = (dateStr: string) => {
    if (!dateStr) return ''
    return dateStr.split('-')[0]
  }

  // Scroll handlers for latest grades carousel
  const scrollLatestGrades = (direction: 'left' | 'right') => {
    const container = latestGradesRef.current
    if (!container) return
    const cardWidth = 280 + 24 // card width + gap
    const maxScroll = container.scrollWidth - container.clientWidth
    if (direction === 'left') {
      const newPosition = Math.max(0, scrollPosition - cardWidth * 2)
      setScrollPosition(newPosition)
    } else {
      const newPosition = Math.min(maxScroll, scrollPosition + cardWidth * 2)
      setScrollPosition(newPosition)
    }
  }

  // Pause/resume handlers for auto-scroll
  const handleScrollMouseEnter = () => {
    setIsScrollPaused(true)
    lastTimeRef.current = 0
  }

  const handleScrollMouseLeave = () => {
    setIsScrollPaused(false)
    lastTimeRef.current = 0
  }

  const handleScrollTouchStart = () => {
    isTouchingRef.current = true
    lastTimeRef.current = 0
  }

  const handleScrollTouchEnd = () => {
    const container = latestGradesRef.current
    if (container) {
      setScrollPosition(container.scrollLeft)
    }
    // Resume auto-scroll after 2 seconds
    setTimeout(() => {
      isTouchingRef.current = false
      lastTimeRef.current = 0
    }, 2000)
  }

  // Get type color
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Fire: 'bg-red-500',
      Water: 'bg-blue-500',
      Grass: 'bg-green-500',
      Electric: 'bg-yellow-500',
      Psychic: 'bg-purple-500',
      Fighting: 'bg-orange-700',
      Darkness: 'bg-gray-800',
      Metal: 'bg-gray-500',
      Fairy: 'bg-pink-400',
      Dragon: 'bg-indigo-600',
      Colorless: 'bg-gray-400',
      Lightning: 'bg-yellow-400',
    }
    return colors[type] || 'bg-gray-500'
  }

  return (
    <main className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image src="/DCM Logo white.png" alt="DCM" width={40} height={40} />
            <h1 className="text-3xl md:text-4xl font-bold text-white">Pokemon Card Database</h1>
          </div>
          <p className="text-center text-gray-300 max-w-2xl mx-auto mb-8">
            Search and explore our database of Pokemon TCG cards. Find card details, images, and market links — then grade your cards with DCM.
          </p>

          {/* Database Stats & Info */}
          <div className="max-w-4xl mx-auto bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">
                  {sets.reduce((acc, set) => acc + (set.printed_total || 0), 0).toLocaleString()}+
                </div>
                <div className="text-xs md:text-sm text-gray-400">Total Cards</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">{sets.length}</div>
                <div className="text-xs md:text-sm text-gray-400">Card Sets</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">1999-2025</div>
                <div className="text-xs md:text-sm text-gray-400">Year Coverage</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">100%</div>
                <div className="text-xs md:text-sm text-gray-400">Official Data</div>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-gray-300 text-sm text-center leading-relaxed">
                <span className="text-purple-400 font-semibold">How DCM Identifies Your Cards:</span> When you upload a card for grading,
                DCM's AI cross-references the official Pokemon TCG database using card name, card number, and set information to ensure
                accurate identification. This database contains English and Japanese Pokemon TCG cards with verified details
                including rarity, artist, HP, and market pricing links.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Search Intro */}
      <section className="bg-gray-900 py-6">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Search the Database</h2>
          <p className="text-gray-400 max-w-lg mx-auto text-sm">
            Enter a card name, card number, or select a set to find any Pokemon card in our database.
          </p>
        </div>
      </section>

      {/* Search Section */}
      <section className="bg-gray-800 border-b border-gray-700 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          {/* Language Toggle */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex bg-gray-900 rounded-lg p-1 border border-gray-700">
              <button
                onClick={() => setSearchLanguage('en')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  searchLanguage === 'en'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setSearchLanguage('ja')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  searchLanguage === 'ja'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Japanese
              </button>
              <button
                onClick={() => setSearchLanguage('all')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  searchLanguage === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            {/* Name Search */}
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Card Name</label>
              <input
                ref={searchInputRef}
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder={searchLanguage === 'ja' ? "Search by name (e.g., リザードン, Charizard)" : "Search by name (e.g., Charizard, Pikachu)"}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Card Number / Set Total */}
            <div className="w-full md:w-52">
              <label className="block text-xs text-gray-400 mb-1 text-center">Card # / Set Total</label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={searchNumber}
                  onChange={(e) => setSearchNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. 4, SM228"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2.5 text-white placeholder-gray-600 placeholder:text-xs focus:outline-none focus:border-purple-500 transition-colors text-center text-sm"
                />
                <span className="text-gray-500 text-lg font-bold">/</span>
                <input
                  type="text"
                  value={searchSetTotal}
                  onChange={(e) => setSearchSetTotal(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 102"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2.5 text-white placeholder-gray-600 placeholder:text-xs focus:outline-none focus:border-purple-500 transition-colors text-center text-sm"
                />
              </div>
            </div>

            {/* Set Filter */}
            <div className="w-full md:w-64">
              <label className="block text-xs text-gray-400 mb-1">
                Set {searchLanguage === 'ja' && <span className="text-red-400">(Japanese)</span>}
                {searchLanguage === 'all' && <span className="text-purple-400">(All Languages)</span>}
              </label>
              <select
                value={selectedSetId}
                onChange={(e) => setSelectedSetId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors"
              >
                <option value="">All Sets</option>
                {Object.entries(setsBySeries).map(([series, seriesSets]) => (
                  <optgroup key={series} label={series}>
                    {seriesSets.map((set) => (
                      <option key={set.id} value={set.id}>
                        {set.name} ({set.printed_total} cards)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Clear Button */}
            {(searchName || searchNumber || searchSetTotal || selectedSetId) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchName('')
                    setSearchNumber('')
                    setSearchSetTotal('')
                    setSelectedSetId('')
                    searchInputRef.current?.focus()
                  }}
                  className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Results count */}
          {hasSearched && (
            <div className="mt-3 text-sm text-gray-400">
              {isLoading ? (
                'Searching...'
              ) : (
                <>
                  Found <span className="text-white font-medium">{pagination.total.toLocaleString()}</span> cards
                  {selectedSetId && sets.find(s => s.id === selectedSetId) && (
                    <span> in {sets.find(s => s.id === selectedSetId)?.name}</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Search Hint */}
      {!hasSearched && (
        <div className="container mx-auto px-4 py-4 text-center">
          <p className="text-gray-500 text-sm">🔍 Use the fields above to search for cards</p>
        </div>
      )}

      {/* Results Section */}
      <section className="container mx-auto px-4 py-8">
        {!hasSearched ? null : isLoading ? (
          // Loading state
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-800 rounded-lg aspect-[2.5/3.5]" />
                <div className="mt-2 h-4 bg-gray-800 rounded w-3/4" />
                <div className="mt-1 h-3 bg-gray-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : cards.length === 0 ? (
          // No results
          <div className="text-center py-16">
            <div className="text-6xl mb-4">😕</div>
            <h2 className="text-xl font-semibold text-white mb-2">No Cards Found</h2>
            <p className="text-gray-400">
              Try adjusting your search criteria or browse a different set.
            </p>
          </div>
        ) : (
          // Results grid
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {cards.map((card) => {
                const cardImage = card.image_small || card.image_url
                const displayName = card.name_display || card.name
                const cardNumber = card.number || card.local_id
                const isJapanese = card.language === 'ja'

                return (
                  <button
                    key={card.id}
                    onClick={() => openCardDetail(card)}
                    className="group text-left bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-purple-500 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/10"
                  >
                    {/* Card Image */}
                    <div className="relative aspect-[2.5/3.5] bg-gray-900">
                      {cardImage ? (
                        <Image
                          src={cardImage}
                          alt={card.name}
                          fill
                          className="object-contain p-1"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      {/* Language Badge */}
                      {isJapanese && (
                        <div className="absolute top-1 right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                          JP
                        </div>
                      )}
                    </div>

                    {/* Card Info */}
                    <div className="p-2">
                      <h3 className="text-white font-medium text-sm truncate group-hover:text-purple-400 transition-colors">
                        {displayName}
                      </h3>
                      <p className="text-gray-500 text-xs truncate">
                        {card.set_name} · #{cardNumber}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => searchCards(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                >
                  Previous
                </button>
                <span className="text-gray-400 px-4">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => searchCards(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Slide-out Card Detail Panel */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
          isPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeCardDetail}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-gray-900 border-l border-gray-700 z-50 transform transition-transform duration-300 ease-out overflow-y-auto ${
          isPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {selectedCard && (
          <div className="p-6">
            {/* Close button */}
            <button
              onClick={closeCardDetail}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Language Badge for Japanese Cards */}
            {selectedCard.language === 'ja' && (
              <div className="flex justify-center mb-4">
                <span className="bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                  Japanese Card
                </span>
              </div>
            )}

            {/* Card Image */}
            <div className="relative aspect-[2.5/3.5] bg-gray-800 rounded-xl overflow-hidden mb-6 max-w-[280px] mx-auto">
              {(selectedCard.image_large || selectedCard.image_url) ? (
                <Image
                  src={selectedCard.image_large || selectedCard.image_url || ''}
                  alt={selectedCard.name}
                  fill
                  className="object-contain"
                  sizes="280px"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                  <span>No Image</span>
                </div>
              )}
            </div>

            {/* Card Name & Basic Info */}
            <h2 className="text-2xl font-bold text-white mb-1">
              {selectedCard.name_display || selectedCard.name}
            </h2>
            {selectedCard.language === 'ja' && selectedCard.name_english && !selectedCard.name_display && (
              <p className="text-purple-400 text-sm mb-1">({selectedCard.name_english})</p>
            )}
            <p className="text-gray-400 mb-4">
              {selectedCard.set_name} · #{selectedCard.number || selectedCard.local_id}/{selectedCard.set_printed_total} · {getYear(selectedCard.set_release_date)}
            </p>

            {/* Type badges */}
            {selectedCard.types && selectedCard.types.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedCard.types.map((type) => (
                  <span
                    key={type}
                    className={`px-3 py-1 rounded-full text-white text-sm font-medium ${getTypeColor(type)}`}
                  >
                    {type}
                  </span>
                ))}
              </div>
            )}

            {/* Card Details Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {selectedCard.supertype && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Type</div>
                  <div className="text-white font-medium">{selectedCard.supertype}</div>
                </div>
              )}
              {selectedCard.hp && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">HP</div>
                  <div className="text-white font-medium">{selectedCard.hp}</div>
                </div>
              )}
              {selectedCard.rarity && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Rarity</div>
                  <div className="text-white font-medium text-sm">{selectedCard.rarity}</div>
                </div>
              )}
              {selectedCard.subtypes && selectedCard.subtypes.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Stage</div>
                  <div className="text-white font-medium text-sm">{selectedCard.subtypes.join(', ')}</div>
                </div>
              )}
              {selectedCard.evolves_from && (
                <div className="bg-gray-800 rounded-lg p-3 col-span-2">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Evolves From</div>
                  <div className="text-white font-medium">{selectedCard.evolves_from}</div>
                </div>
              )}
              {(selectedCard.artist || selectedCard.illustrator) && (
                <div className="bg-gray-800 rounded-lg p-3 col-span-2">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Artist</div>
                  <div className="text-white font-medium">{selectedCard.artist || selectedCard.illustrator}</div>
                </div>
              )}
            </div>

            {/* Set Info */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Set Information</div>
              <div className="text-white font-medium">{selectedCard.set_name}</div>
              <div className="text-gray-400 text-sm">
                {selectedCard.set_series} · {selectedCard.set_printed_total} cards · Released {getYear(selectedCard.set_release_date)}
              </div>
            </div>

            {/* Grade This Card CTA */}
            <Link
              href={getGradeCtaLink()}
              className="block w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 font-bold text-lg px-6 py-4 rounded-xl hover:from-yellow-400 hover:to-orange-400 transition-all text-center shadow-lg shadow-orange-500/20 mb-4"
            >
              🎯 {getGradeCtaText()}
            </Link>

            {/* Market Links */}
            <div className="flex gap-3">
              {selectedCard.tcgplayer_url && (
                <a
                  href={selectedCard.tcgplayer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-3 rounded-lg transition-colors text-sm font-medium"
                >
                  TCGPlayer
                </a>
              )}
              <a
                href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${selectedCard.name} ${selectedCard.number}/${selectedCard.set_printed_total} Pokemon`)}&LH_Complete=1&LH_Sold=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-3 rounded-lg transition-colors text-sm font-medium"
              >
                eBay Sold
              </a>
            </div>

            {/* Card ID for reference */}
            <p className="text-center text-gray-600 text-xs mt-6">
              Card ID: {selectedCard.id}
            </p>
          </div>
        )}
      </div>

      {/* Latest DCM Pokemon Grades Section */}
      {latestGrades.length > 0 && (
        <section className="py-12 bg-gradient-to-br from-purple-900/30 via-gray-900 to-blue-900/30">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">Latest DCM Pokemon Grades</h2>
                <p className="text-gray-400 mt-2">Recently graded Pokemon cards from our community</p>
              </div>
              {/* Navigation Arrows */}
              <div className="flex gap-2">
                <button
                  onClick={() => scrollLatestGrades('left')}
                  className="p-2 rounded-full bg-purple-900/50 hover:bg-purple-800 text-white transition-colors border border-purple-700"
                  aria-label="Scroll left"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => scrollLatestGrades('right')}
                  className="p-2 rounded-full bg-purple-900/50 hover:bg-purple-800 text-white transition-colors border border-purple-700"
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
              ref={latestGradesRef}
              onMouseEnter={handleScrollMouseEnter}
              onMouseLeave={handleScrollMouseLeave}
              onTouchStart={handleScrollTouchStart}
              onTouchEnd={handleScrollTouchEnd}
              className="flex flex-nowrap gap-6 overflow-x-auto pb-4 -mx-4 px-4"
              style={{
                scrollBehavior: 'auto',
                WebkitOverflowScrolling: 'touch',
                msOverflowStyle: 'none',
                scrollbarWidth: 'none'
              }}
            >
              {isLoadingGrades ? (
                // Loading skeletons
                [...Array(5)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-[280px] min-w-[280px] animate-pulse">
                    <div className="bg-gray-800 rounded-xl h-[420px]" />
                  </div>
                ))
              ) : (
                latestGrades.map((card) => {
                  const labelData = getCardLabelData(card)
                  return (
                    <Link
                      key={card.id}
                      href={`/pokemon/${card.id}`}
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
                })
              )}
            </div>

            {/* CTA */}
            <div className="mt-8 text-center">
              <Link
                href="/login?mode=signup&redirect=/upload/pokemon"
                className="inline-block bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 font-bold px-8 py-3 rounded-lg hover:from-yellow-400 hover:to-orange-400 transition-all shadow-lg hover:shadow-orange-500/25"
              >
                Grade Your Pokemon Cards
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 bg-gray-900 border-t border-gray-800">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>English data from Pokemon TCG API. Japanese data from TCGdex. Pokemon is a trademark of Nintendo.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/pokemon-grading" className="hover:text-gray-300 transition-colors">Grade Cards</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
