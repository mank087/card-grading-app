'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getStoredSession } from '@/lib/directAuth'

interface YuGiOhCard {
  id: number
  name: string
  type: string | null
  human_readable_card_type: string | null
  frame_type: string | null
  card_desc: string | null
  race: string | null
  attribute: string | null
  archetype: string | null
  atk: number | null
  def: number | null
  level: number | null
  scale: number | null
  linkval: number | null
  linkmarkers: string | null
  image_url: string | null
  image_url_small: string | null
  image_url_cropped: string | null
  tcgplayer_price: number | null
  cardmarket_price: number | null
  ebay_price: number | null
  amazon_price: number | null
  ygoprodeck_url: string | null
}

interface YuGiOhSet {
  set_code: string
  set_name: string
  num_of_cards: number
  tcg_date: string | null
}

interface Printing {
  set_code: string
  set_name: string
  set_rarity: string | null
  set_price: number | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function YuGiOhDatabasePage() {
  // Auth state
  const [user, setUser] = useState<any>(null)
  const [credits, setCredits] = useState<number>(0)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)

  // Search state
  const [searchName, setSearchName] = useState('')
  const [selectedSetCode, setSelectedSetCode] = useState('')
  const [selectedCardType, setSelectedCardType] = useState('')
  const [selectedAttribute, setSelectedAttribute] = useState('')
  const [selectedFrameType, setSelectedFrameType] = useState('')
  const [debouncedName, setDebouncedName] = useState('')

  // Results state
  const [cards, setCards] = useState<YuGiOhCard[]>([])
  const [sets, setSets] = useState<YuGiOhSet[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Detail panel state
  const [selectedCard, setSelectedCard] = useState<YuGiOhCard | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  // Printings state (for "See All Printings" feature)
  const [printings, setPrintings] = useState<Printing[]>([])
  const [isLoadingPrintings, setIsLoadingPrintings] = useState(false)
  const [showPrintings, setShowPrintings] = useState(false)

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Mobile filter toggle
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  // Card type options for Yu-Gi-Oh
  const cardTypeOptions = [
    'Normal Monster',
    'Effect Monster',
    'Fusion Monster',
    'Synchro Monster',
    'XYZ Monster',
    'Link Monster',
    'Pendulum Normal Monster',
    'Pendulum Effect Monster',
    'Ritual Monster',
    'Spell Card',
    'Trap Card',
    'Token',
  ]

  // Attribute options
  const attributeOptions = ['DARK', 'LIGHT', 'FIRE', 'WATER', 'EARTH', 'WIND', 'DIVINE']

  // Frame type options
  const frameTypeOptions = ['normal', 'effect', 'fusion', 'synchro', 'xyz', 'link', 'pendulum', 'spell', 'trap']

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

  // Load sets on mount
  useEffect(() => {
    const loadSets = async () => {
      try {
        const res = await fetch('/api/yugioh-database/sets')
        const data = await res.json()
        setSets(data.sets || [])
      } catch (err) {
        console.error('Failed to fetch sets:', err)
      }
    }
    loadSets()
  }, [])

  // Debounce name search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedName(searchName)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchName])

  // Search when filters change
  const searchCards = useCallback(async (page = 1) => {
    setIsLoading(true)
    setHasSearched(true)

    try {
      const params = new URLSearchParams()
      if (debouncedName) params.set('name', debouncedName)
      if (selectedSetCode) params.set('set_code', selectedSetCode)
      if (selectedCardType) params.set('card_type', selectedCardType)
      if (selectedAttribute) params.set('attribute', selectedAttribute)
      if (selectedFrameType) params.set('frame_type', selectedFrameType)
      params.set('page', page.toString())
      params.set('limit', '20')

      const res = await fetch(`/api/yugioh-database/search?${params}`)
      const data = await res.json()

      setCards(data.cards || [])
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
    } catch (err) {
      console.error('Search failed:', err)
      setCards([])
    } finally {
      setIsLoading(false)
    }
  }, [debouncedName, selectedSetCode, selectedCardType, selectedAttribute, selectedFrameType])

  // Trigger search on filter changes
  useEffect(() => {
    searchCards(1)
  }, [debouncedName, selectedSetCode, selectedCardType, selectedAttribute, selectedFrameType, searchCards])

  // Open card detail panel
  const openCardDetail = (card: YuGiOhCard) => {
    setSelectedCard(card)
    setIsPanelOpen(true)
    setShowPrintings(false)
    setPrintings([])
  }

  // Close card detail panel
  const closeCardDetail = () => {
    setIsPanelOpen(false)
    setShowPrintings(false)
    setPrintings([])
    setTimeout(() => setSelectedCard(null), 300)
  }

  // Fetch all printings of a card
  const fetchPrintings = async (card: YuGiOhCard) => {
    setIsLoadingPrintings(true)
    try {
      const res = await fetch(`/api/yugioh-database/printings?card_id=${card.id}`)
      const data = await res.json()
      setPrintings(data.printings || [])
      setShowPrintings(true)
    } catch (err) {
      console.error('Failed to fetch printings:', err)
    } finally {
      setIsLoadingPrintings(false)
    }
  }

  // Get Grade CTA link based on auth state
  const getGradeCtaLink = () => {
    if (!user) {
      return '/login?mode=signup&redirect=/upload?category=Yu-Gi-Oh'
    }
    if (credits <= 0) {
      return '/account#credits'
    }
    return '/upload?category=Yu-Gi-Oh'
  }

  const getGradeCtaText = () => {
    if (!user) return 'Sign Up to Grade'
    if (credits <= 0) return 'Buy Credits to Grade'
    return 'Grade This Card'
  }

  // Get attribute badge styles
  const getAttributeStyle = (attribute: string | null) => {
    const styles: Record<string, string> = {
      'DARK': 'bg-purple-700 text-white',
      'LIGHT': 'bg-yellow-400 text-gray-900',
      'FIRE': 'bg-red-600 text-white',
      'WATER': 'bg-blue-600 text-white',
      'EARTH': 'bg-amber-700 text-white',
      'WIND': 'bg-green-600 text-white',
      'DIVINE': 'bg-yellow-600 text-white',
    }
    return styles[attribute || ''] || 'bg-gray-600 text-white'
  }

  // Get frame type badge styles
  const getFrameTypeStyle = (frameType: string | null) => {
    const styles: Record<string, string> = {
      'normal': 'bg-yellow-200 text-gray-900',
      'effect': 'bg-orange-400 text-gray-900',
      'fusion': 'bg-purple-500 text-white',
      'synchro': 'bg-gray-200 text-gray-900',
      'xyz': 'bg-gray-900 text-white border border-gray-600',
      'link': 'bg-blue-700 text-white',
      'pendulum': 'bg-gradient-to-r from-green-500 to-blue-500 text-white',
      'spell': 'bg-teal-600 text-white',
      'trap': 'bg-pink-700 text-white',
    }
    return styles[frameType || ''] || 'bg-gray-600 text-white'
  }

  // Format frame type for display
  const formatFrameType = (frameType: string | null) => {
    if (!frameType) return 'Unknown'
    return frameType.charAt(0).toUpperCase() + frameType.slice(1)
  }

  // Format price
  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return null
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price)
  }

  return (
    <main className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-900 via-gray-900 to-blue-900 py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image src="/DCM Logo white.png" alt="DCM" width={40} height={40} />
            <h1 className="text-3xl md:text-4xl font-bold text-white">Yu-Gi-Oh! Card Database</h1>
          </div>
          <p className="text-center text-gray-300 max-w-2xl mx-auto mb-8">
            Search and explore our database of over 14,000 Yu-Gi-Oh! TCG cards. Find card details, images, and market pricing — then grade your cards with DCM.
          </p>

          {/* Database Stats & Info */}
          <div className="max-w-4xl mx-auto bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">
                  14,000+
                </div>
                <div className="text-xs md:text-sm text-gray-400">Total Cards</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">{sets.length || '---'}</div>
                <div className="text-xs md:text-sm text-gray-400">Card Sets</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">25+ Years</div>
                <div className="text-xs md:text-sm text-gray-400">Of Yu-Gi-Oh!</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">100%</div>
                <div className="text-xs md:text-sm text-gray-400">Official Data</div>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-gray-300 text-sm text-center leading-relaxed">
                <span className="text-indigo-400 font-semibold">How DCM Identifies Your Cards:</span> When you upload a card for grading,
                DCM&apos;s AI cross-references the official Yu-Gi-Oh! database using card name, set information, and rarity to ensure
                accurate identification. This database contains all Yu-Gi-Oh! TCG cards with verified details
                including stats, effects, and TCGPlayer/Cardmarket pricing.
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
            Enter a card name or select filters to find any Yu-Gi-Oh! card in our database.
          </p>
        </div>
      </section>

      {/* Search Section - sticky on desktop only */}
      <section className="bg-gray-800 border-b border-gray-700 md:sticky md:top-0 z-30">
        <div className="container mx-auto px-4 py-3 md:py-4">
          {/* Mobile: Name search + Filter toggle button */}
          <div className="flex gap-2 md:hidden">
            <div className="flex-1">
              <input
                ref={searchInputRef}
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Search cards..."
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`px-3 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                showMobileFilters || selectedSetCode || selectedCardType || selectedAttribute || selectedFrameType
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="text-sm">Filters</span>
              {(selectedSetCode || selectedCardType || selectedAttribute || selectedFrameType) && (
                <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                  {[selectedSetCode, selectedCardType, selectedAttribute, selectedFrameType].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* Mobile: Collapsible filters */}
          <div className={`md:hidden overflow-hidden transition-all duration-300 ${showMobileFilters ? 'max-h-96 mt-3' : 'max-h-0'}`}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Set</label>
                <select
                  value={selectedSetCode}
                  onChange={(e) => setSelectedSetCode(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                >
                  <option value="">All Sets</option>
                  {sets.map((set) => (
                    <option key={set.set_code} value={set.set_code}>
                      {set.set_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Card Type</label>
                <select
                  value={selectedCardType}
                  onChange={(e) => setSelectedCardType(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                >
                  <option value="">All Types</option>
                  {cardTypeOptions.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Attribute</label>
                <select
                  value={selectedAttribute}
                  onChange={(e) => setSelectedAttribute(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                >
                  <option value="">All Attributes</option>
                  {attributeOptions.map((attr) => (
                    <option key={attr} value={attr}>{attr}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Frame Type</label>
                <select
                  value={selectedFrameType}
                  onChange={(e) => setSelectedFrameType(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                >
                  <option value="">All Frames</option>
                  {frameTypeOptions.map((frame) => (
                    <option key={frame} value={frame}>{formatFrameType(frame)}</option>
                  ))}
                </select>
              </div>
            </div>
            {(searchName || selectedSetCode || selectedCardType || selectedAttribute || selectedFrameType) && (
              <button
                onClick={() => {
                  setSearchName('')
                  setSelectedSetCode('')
                  setSelectedCardType('')
                  setSelectedAttribute('')
                  setSelectedFrameType('')
                  setShowMobileFilters(false)
                }}
                className="mt-2 w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors text-sm"
              >
                Clear All Filters
              </button>
            )}
          </div>

          {/* Desktop: All filters in a row */}
          <div className="hidden md:flex md:flex-row gap-3">
            {/* Name Search */}
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Card Name</label>
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Search by name (e.g., Dark Magician, Blue-Eyes)"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Set Filter */}
            <div className="w-52">
              <label className="block text-xs text-gray-400 mb-1">Set</label>
              <select
                value={selectedSetCode}
                onChange={(e) => setSelectedSetCode(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">All Sets</option>
                {sets.map((set) => (
                  <option key={set.set_code} value={set.set_code}>
                    {set.set_name} ({set.num_of_cards})
                  </option>
                ))}
              </select>
            </div>

            {/* Card Type Filter */}
            <div className="w-48">
              <label className="block text-xs text-gray-400 mb-1">Card Type</label>
              <select
                value={selectedCardType}
                onChange={(e) => setSelectedCardType(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">All Types</option>
                {cardTypeOptions.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Attribute Filter */}
            <div className="w-36">
              <label className="block text-xs text-gray-400 mb-1">Attribute</label>
              <select
                value={selectedAttribute}
                onChange={(e) => setSelectedAttribute(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">All</option>
                {attributeOptions.map((attr) => (
                  <option key={attr} value={attr}>{attr}</option>
                ))}
              </select>
            </div>

            {/* Frame Type Filter */}
            <div className="w-36">
              <label className="block text-xs text-gray-400 mb-1">Frame Type</label>
              <select
                value={selectedFrameType}
                onChange={(e) => setSelectedFrameType(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">All</option>
                {frameTypeOptions.map((frame) => (
                  <option key={frame} value={frame}>{formatFrameType(frame)}</option>
                ))}
              </select>
            </div>

            {/* Clear Button */}
            {(searchName || selectedSetCode || selectedCardType || selectedAttribute || selectedFrameType) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchName('')
                    setSelectedSetCode('')
                    setSelectedCardType('')
                    setSelectedAttribute('')
                    setSelectedFrameType('')
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
            <div className="mt-2 md:mt-3 text-sm text-gray-400">
              {isLoading ? (
                'Searching...'
              ) : (
                <>
                  Found <span className="text-white font-medium">{pagination.total.toLocaleString()}</span> cards
                  {selectedSetCode && sets.find(s => s.set_code === selectedSetCode) && (
                    <span className="hidden sm:inline"> in {sets.find(s => s.set_code === selectedSetCode)?.set_name}</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Results Section */}
      <section className="container mx-auto px-4 py-8">
        {isLoading ? (
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
            <div className="text-6xl mb-4">&#x1F0CF;</div>
            <h2 className="text-xl font-semibold text-white mb-2">No Cards Found</h2>
            <p className="text-gray-400">
              Try adjusting your search criteria or browse a different set.
            </p>
          </div>
        ) : (
          // Results grid
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {cards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => openCardDetail(card)}
                  className="group text-left bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-indigo-500 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-500/10"
                >
                  {/* Card Image */}
                  <div className="relative aspect-[2.5/3.5] bg-gray-900">
                    <Image
                      src={card.image_url_small || card.image_url || '/placeholder-card.png'}
                      alt={card.name}
                      fill
                      className="object-contain p-1"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                      unoptimized
                    />
                    {/* Attribute Badge */}
                    {card.attribute && (
                      <div className={`absolute top-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${getAttributeStyle(card.attribute)}`}>
                        {card.attribute}
                      </div>
                    )}
                  </div>

                  {/* Card Info */}
                  <div className="p-2">
                    <h3 className="text-white font-medium text-sm truncate group-hover:text-indigo-400 transition-colors">
                      {card.name}
                    </h3>
                    <p className="text-gray-500 text-xs truncate">
                      {card.human_readable_card_type || card.type || 'Unknown Type'}
                    </p>
                  </div>
                </button>
              ))}
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

            {/* Card Image */}
            <div className="relative aspect-[2.5/3.5] bg-gray-800 rounded-xl overflow-hidden mb-6 max-w-[280px] mx-auto">
              <Image
                src={selectedCard.image_url || selectedCard.image_url_small || '/placeholder-card.png'}
                alt={selectedCard.name}
                fill
                className="object-contain"
                sizes="280px"
                priority
                unoptimized
              />
            </div>

            {/* Card Name & Basic Info */}
            <h2 className="text-2xl font-bold text-white mb-1">
              {selectedCard.name}
            </h2>
            <p className="text-gray-400 mb-4">
              {selectedCard.human_readable_card_type || selectedCard.type || 'Unknown Type'}
            </p>

            {/* Attribute & Frame Type badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedCard.attribute && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getAttributeStyle(selectedCard.attribute)}`}>
                  {selectedCard.attribute}
                </span>
              )}
              {selectedCard.frame_type && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getFrameTypeStyle(selectedCard.frame_type)}`}>
                  {formatFrameType(selectedCard.frame_type)}
                </span>
              )}
            </div>

            {/* Card Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {selectedCard.atk !== null && selectedCard.atk !== undefined && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">ATK</div>
                  <div className="text-white font-medium">{selectedCard.atk}</div>
                </div>
              )}
              {selectedCard.def !== null && selectedCard.def !== undefined && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">DEF</div>
                  <div className="text-white font-medium">{selectedCard.def}</div>
                </div>
              )}
              {selectedCard.level !== null && selectedCard.level !== undefined && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    {selectedCard.frame_type === 'xyz' ? 'Rank' : 'Level'}
                  </div>
                  <div className="text-white font-medium">{selectedCard.level}</div>
                </div>
              )}
              {selectedCard.linkval !== null && selectedCard.linkval !== undefined && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Link Rating</div>
                  <div className="text-white font-medium">{selectedCard.linkval}</div>
                </div>
              )}
              {selectedCard.scale !== null && selectedCard.scale !== undefined && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Pendulum Scale</div>
                  <div className="text-white font-medium">{selectedCard.scale}</div>
                </div>
              )}
              {selectedCard.archetype && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Archetype</div>
                  <div className="text-white font-medium">{selectedCard.archetype}</div>
                </div>
              )}
              {selectedCard.race && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Race / Type</div>
                  <div className="text-white font-medium">{selectedCard.race}</div>
                </div>
              )}
            </div>

            {/* Link Markers */}
            {selectedCard.linkmarkers && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Link Markers</div>
                <div className="text-white text-sm">{selectedCard.linkmarkers}</div>
              </div>
            )}

            {/* Card Description */}
            {selectedCard.card_desc && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Card Text</div>
                <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">{selectedCard.card_desc}</div>
              </div>
            )}

            {/* See All Printings Button */}
            {!showPrintings && (
              <button
                onClick={() => fetchPrintings(selectedCard)}
                disabled={isLoadingPrintings}
                className="w-full bg-gray-800 hover:bg-gray-700 text-indigo-400 font-medium py-3 px-4 rounded-lg mb-4 transition-colors flex items-center justify-center gap-2"
              >
                {isLoadingPrintings ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    See All Printings
                  </>
                )}
              </button>
            )}

            {/* All Printings View */}
            {showPrintings && printings.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    All Printings ({printings.length})
                  </div>
                  <button
                    onClick={() => setShowPrintings(false)}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Hide
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {printings.map((printing, index) => (
                    <div
                      key={`${printing.set_code}-${index}`}
                      className="w-full flex items-center gap-3 p-2 rounded-lg bg-gray-700/50"
                    >
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-white text-sm font-medium truncate">
                          {printing.set_name}
                        </div>
                        <div className="text-gray-400 text-xs">
                          {printing.set_code}
                          {printing.set_rarity && (
                            <span className="ml-2 text-indigo-300">{printing.set_rarity}</span>
                          )}
                        </div>
                      </div>
                      {printing.set_price !== null && printing.set_price !== undefined && (
                        <div className="text-green-400 text-sm font-medium">
                          {formatPrice(printing.set_price)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showPrintings && printings.length === 0 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="text-center text-gray-400 text-sm">
                  No printings data found for this card.
                </div>
              </div>
            )}

            {/* Market Pricing */}
            {(selectedCard.tcgplayer_price || selectedCard.cardmarket_price || selectedCard.ebay_price || selectedCard.amazon_price) && (
              <div className="bg-gray-800 rounded-lg p-4 mb-6">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Market Pricing</div>
                <div className="grid grid-cols-2 gap-3">
                  {selectedCard.tcgplayer_price !== null && selectedCard.tcgplayer_price !== undefined && (
                    <div>
                      <div className="text-xs text-gray-500">TCGPlayer</div>
                      <div className="text-green-400 font-bold text-lg">{formatPrice(selectedCard.tcgplayer_price)}</div>
                    </div>
                  )}
                  {selectedCard.cardmarket_price !== null && selectedCard.cardmarket_price !== undefined && (
                    <div>
                      <div className="text-xs text-gray-500">Cardmarket</div>
                      <div className="text-blue-400 font-bold text-lg">{formatPrice(selectedCard.cardmarket_price)}</div>
                    </div>
                  )}
                  {selectedCard.ebay_price !== null && selectedCard.ebay_price !== undefined && (
                    <div>
                      <div className="text-xs text-gray-500">eBay</div>
                      <div className="text-white font-medium">{formatPrice(selectedCard.ebay_price)}</div>
                    </div>
                  )}
                  {selectedCard.amazon_price !== null && selectedCard.amazon_price !== undefined && (
                    <div>
                      <div className="text-xs text-gray-500">Amazon</div>
                      <div className="text-white font-medium">{formatPrice(selectedCard.amazon_price)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Grade This Card CTA */}
            <Link
              href={getGradeCtaLink()}
              className="block w-full bg-gradient-to-r from-indigo-600 to-blue-500 text-white font-bold text-lg px-6 py-4 rounded-xl hover:from-indigo-500 hover:to-blue-400 transition-all text-center shadow-lg shadow-indigo-500/20 mb-4"
            >
              {getGradeCtaText()}
            </Link>

            {/* Market Links */}
            <div className="flex gap-3">
              <a
                href={`https://www.tcgplayer.com/search/yugioh/product?q=${encodeURIComponent(selectedCard.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-3 rounded-lg transition-colors text-sm font-medium"
              >
                TCGPlayer
              </a>
              <a
                href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${selectedCard.name} Yu-Gi-Oh`)}&LH_Complete=1&LH_Sold=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-3 rounded-lg transition-colors text-sm font-medium"
              >
                eBay Sold
              </a>
              {selectedCard.ygoprodeck_url && (
                <a
                  href={selectedCard.ygoprodeck_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-3 rounded-lg transition-colors text-sm font-medium"
                >
                  YGOPRODeck
                </a>
              )}
            </div>

            {/* Card ID for reference */}
            <p className="text-center text-gray-600 text-xs mt-6">
              Card ID: {selectedCard.id}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 border-t border-gray-800">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Data from YGOPRODeck API. Card images from YGOPRODeck CDN. Yu-Gi-Oh! is a trademark of Kazuki Takahashi / Konami.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/upload?category=Yu-Gi-Oh" className="hover:text-gray-300 transition-colors">Grade Cards</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
