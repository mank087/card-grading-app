'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getStoredSession } from '@/lib/directAuth'

interface StarWarsCard {
  id: string
  card_name: string
  card_number: string | null
  set_id: string | null
  console_name: string | null
  genre: string | null
  release_date: string | null
  loose_price: number | null
  cib_price: number | null
  new_price: number | null
  graded_price: number | null
  box_only_price: number | null
  manual_only_price: number | null
  bgs_10_price: number | null
  sales_volume: string | null
  set_name: string | null
  pricecharting_id: string | null
}

interface StarWarsSet {
  id: string
  name: string
  set_type: string | null
  total_cards: number
  release_date: string | null
  genre: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function StarWarsDatabasePage() {
  // Auth state
  const [user, setUser] = useState<any>(null)
  const [credits, setCredits] = useState<number>(0)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)

  // Search state
  const [searchName, setSearchName] = useState('')
  const [searchNumber, setSearchNumber] = useState('')
  const [selectedSetId, setSelectedSetId] = useState('')
  const [debouncedName, setDebouncedName] = useState('')

  // Results state
  const [cards, setCards] = useState<StarWarsCard[]>([])
  const [sets, setSets] = useState<StarWarsSet[]>([])
  const [setsByType, setSetsByType] = useState<Record<string, StarWarsSet[]>>({})
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Detail panel state
  const [selectedCard, setSelectedCard] = useState<StarWarsCard | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Mobile filter toggle
  const [showMobileFilters, setShowMobileFilters] = useState(false)

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
        const res = await fetch('/api/starwars-database/sets')
        const data = await res.json()
        setSets(data.sets || [])
        setSetsByType(data.setsByType || {})

        // Auto-select the largest set on load
        if (data.sets?.length > 0) {
          setSelectedSetId(data.sets[0].id)
        }
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
      if (selectedSetId) params.set('set_id', selectedSetId)
      if (searchNumber) params.set('card_number', searchNumber)
      params.set('page', page.toString())
      params.set('limit', '20')

      const res = await fetch(`/api/starwars-database/search?${params}`)
      const data = await res.json()

      setCards(data.cards || [])
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
    } catch (err) {
      console.error('Search failed:', err)
      setCards([])
    } finally {
      setIsLoading(false)
    }
  }, [debouncedName, selectedSetId, searchNumber])

  // Trigger search on filter changes
  useEffect(() => {
    searchCards(1)
  }, [debouncedName, selectedSetId, searchNumber, searchCards])

  // Open card detail panel
  const openCardDetail = (card: StarWarsCard) => {
    setSelectedCard(card)
    setIsPanelOpen(true)
  }

  // Close card detail panel
  const closeCardDetail = () => {
    setIsPanelOpen(false)
    setTimeout(() => setSelectedCard(null), 300)
  }

  // Get Grade CTA link
  const getGradeCtaLink = () => {
    if (!user) return '/login?mode=signup&redirect=/upload/other'
    if (credits <= 0) return '/account#credits'
    return '/upload/other'
  }

  const getGradeCtaText = () => {
    if (!user) return 'Sign Up to Grade'
    if (credits <= 0) return 'Buy Credits to Grade'
    return 'Grade This Card'
  }

  // Format price from dollars
  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return null
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price)
  }

  // Calculate total cards from sets
  const totalCards = sets.reduce((acc, set) => acc + (set.total_cards || 0), 0)

  return (
    <main className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-yellow-900 via-gray-900 to-blue-900 py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image src="/DCM Logo white.png" alt="DCM" width={40} height={40} />
            <h1 className="text-3xl md:text-4xl font-bold text-white">Star Wars Card Database</h1>
          </div>
          <p className="text-center text-gray-300 max-w-2xl mx-auto mb-8">
            Search and explore our database of Star Wars trading cards. Find card details, market pricing, and graded values — then grade your cards with DCM.
          </p>

          {/* Database Stats */}
          <div className="max-w-4xl mx-auto bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">
                  {totalCards.toLocaleString()}+
                </div>
                <div className="text-xs md:text-sm text-gray-400">Total Cards</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">{sets.length}</div>
                <div className="text-xs md:text-sm text-gray-400">Card Sets</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-yellow-400">1977+</div>
                <div className="text-xs md:text-sm text-gray-400">Years of Cards</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">100%</div>
                <div className="text-xs md:text-sm text-gray-400">Market Data</div>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-gray-300 text-sm text-center leading-relaxed">
                <span className="text-yellow-400 font-semibold">How DCM Identifies Your Cards:</span> When you upload a card for grading,
                DCM&apos;s AI cross-references our Star Wars card database using set name, card number, and card name to ensure
                accurate identification. This database contains Star Wars trading cards with verified details
                and PriceCharting market pricing.
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
            Enter a card name, card number, or select a set to find any Star Wars card in our database.
          </p>
        </div>
      </section>

      {/* Search Section */}
      <section className="bg-gray-800 border-b border-gray-700 md:sticky md:top-0 z-30">
        <div className="container mx-auto px-4 py-3 md:py-4">
          {/* Mobile: Name search + Filter toggle */}
          <div className="flex gap-2 md:hidden">
            <div className="flex-1">
              <input
                ref={searchInputRef}
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Search cards..."
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
              />
            </div>
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`px-3 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                showMobileFilters || selectedSetId || searchNumber
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="text-sm">Filters</span>
              {(selectedSetId || searchNumber) && (
                <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                  {[selectedSetId, searchNumber].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* Mobile: Collapsible filters */}
          <div className={`md:hidden overflow-hidden transition-all duration-300 ${showMobileFilters ? 'max-h-80 mt-3' : 'max-h-0'}`}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Card #</label>
                <input
                  type="text"
                  value={searchNumber}
                  onChange={(e) => setSearchNumber(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Set</label>
                <select
                  value={selectedSetId}
                  onChange={(e) => setSelectedSetId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-yellow-500 transition-colors text-sm"
                >
                  <option value="">All Sets</option>
                  {Object.entries(setsByType).map(([type, typeSets]) => (
                    <optgroup key={type} label={type}>
                      {typeSets.map((set) => (
                        <option key={set.id} value={set.id}>{set.name} ({set.total_cards})</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            {(searchName || searchNumber || selectedSetId) && (
              <button
                onClick={() => {
                  setSearchName('')
                  setSearchNumber('')
                  setSelectedSetId('')
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
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Card Name</label>
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Search by name (e.g., Luke Skywalker, Darth Vader)"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
              />
            </div>

            <div className="w-32">
              <label className="block text-xs text-gray-400 mb-1">Card #</label>
              <input
                type="text"
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
                placeholder="e.g. 1"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors text-sm"
              />
            </div>

            <div className="w-72">
              <label className="block text-xs text-gray-400 mb-1">Set</label>
              <select
                value={selectedSetId}
                onChange={(e) => setSelectedSetId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500 transition-colors"
              >
                <option value="">All Sets</option>
                {Object.entries(setsByType).map(([type, typeSets]) => (
                  <optgroup key={type} label={type}>
                    {typeSets.map((set) => (
                      <option key={set.id} value={set.id}>
                        {set.name} ({set.total_cards} cards)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {(searchName || searchNumber || selectedSetId) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchName('')
                    setSearchNumber('')
                    setSelectedSetId('')
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
                  {selectedSetId && sets.find(s => s.id === selectedSetId) && (
                    <span className="hidden sm:inline"> in {sets.find(s => s.id === selectedSetId)?.name}</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Search Hint */}
      {/* Results Section */}
      <section className="container mx-auto px-4 py-8">
        {isLoading ? (
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
          <div className="text-center py-16">
            <div className="text-6xl mb-4">⭐</div>
            <h2 className="text-xl font-semibold text-white mb-2">No Cards Found</h2>
            <p className="text-gray-400">
              Try adjusting your search criteria or browse a different set.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {cards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => openCardDetail(card)}
                  className="group text-left bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-yellow-500 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-yellow-500/10 p-4"
                >
                  {/* Card Name */}
                  <h3 className="text-white font-medium text-sm truncate group-hover:text-yellow-400 transition-colors mb-1">
                    {card.card_name}
                  </h3>
                  <p className="text-gray-500 text-xs truncate mb-3">
                    {card.set_name || card.console_name}
                    {card.card_number && <> · #{card.card_number}</>}
                  </p>

                  {/* Price Info */}
                  <div className="flex items-center justify-between">
                    {card.loose_price ? (
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase">Ungraded</div>
                        <div className="text-green-400 font-bold text-sm">{formatPrice(card.loose_price)}</div>
                      </div>
                    ) : (
                      <div className="text-gray-600 text-xs">No price data</div>
                    )}
                    {card.graded_price && (
                      <div className="text-right">
                        <div className="text-[10px] text-gray-500 uppercase">PSA 9</div>
                        <div className="text-yellow-400 font-bold text-sm">{formatPrice(card.graded_price)}</div>
                      </div>
                    )}
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
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
          isPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeCardDetail}
      />

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

            {/* Card Name & Basic Info */}
            <h2 className="text-2xl font-bold text-white mb-1 pr-8">
              {selectedCard.card_name}
            </h2>
            <p className="text-gray-400 mb-6">
              {selectedCard.set_name || selectedCard.console_name}
              {selectedCard.card_number && <> · #{selectedCard.card_number}</>}
            </p>

            {/* Card Details Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {selectedCard.set_name && (
                <div className="bg-gray-800 rounded-lg p-3 col-span-2">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Set</div>
                  <div className="text-white font-medium">{selectedCard.set_name}</div>
                </div>
              )}
              {selectedCard.card_number && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Card #</div>
                  <div className="text-white font-medium">#{selectedCard.card_number}</div>
                </div>
              )}
              {selectedCard.release_date && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Release</div>
                  <div className="text-white font-medium">{selectedCard.release_date}</div>
                </div>
              )}
            </div>

            {/* Pricing Section */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Market Pricing</div>

              {/* Ungraded */}
              {selectedCard.loose_price && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400 text-sm">Ungraded (Raw)</span>
                  <span className="text-green-400 font-bold">{formatPrice(selectedCard.loose_price)}</span>
                </div>
              )}

              {/* Graded prices */}
              {selectedCard.cib_price && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400 text-sm">Graded 7 / 7.5</span>
                  <span className="text-white font-medium">{formatPrice(selectedCard.cib_price)}</span>
                </div>
              )}
              {selectedCard.new_price && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400 text-sm">Graded 8 / 8.5</span>
                  <span className="text-white font-medium">{formatPrice(selectedCard.new_price)}</span>
                </div>
              )}
              {selectedCard.graded_price && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400 text-sm">PSA 9</span>
                  <span className="text-yellow-400 font-bold">{formatPrice(selectedCard.graded_price)}</span>
                </div>
              )}
              {selectedCard.box_only_price && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400 text-sm">PSA 9.5</span>
                  <span className="text-yellow-400 font-bold">{formatPrice(selectedCard.box_only_price)}</span>
                </div>
              )}
              {selectedCard.manual_only_price && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400 text-sm">PSA 10</span>
                  <span className="text-amber-400 font-bold text-lg">{formatPrice(selectedCard.manual_only_price)}</span>
                </div>
              )}
              {selectedCard.bgs_10_price && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-400 text-sm">BGS 10</span>
                  <span className="text-amber-400 font-bold">{formatPrice(selectedCard.bgs_10_price)}</span>
                </div>
              )}

              {!selectedCard.loose_price && !selectedCard.graded_price && !selectedCard.manual_only_price && (
                <div className="text-center text-gray-500 text-sm py-2">
                  No pricing data available
                </div>
              )}
            </div>

            {/* Grade This Card CTA */}
            <Link
              href={getGradeCtaLink()}
              className="block w-full bg-gradient-to-r from-yellow-600 to-amber-500 text-white font-bold text-lg px-6 py-4 rounded-xl hover:from-yellow-500 hover:to-amber-400 transition-all text-center shadow-lg shadow-yellow-500/20 mb-4"
            >
              {getGradeCtaText()}
            </Link>

            {/* Market Links */}
            <div className="flex gap-3">
              <a
                href={`https://www.pricecharting.com/search-products?q=${encodeURIComponent(selectedCard.card_name + ' ' + (selectedCard.set_name || ''))}&type=prices`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-3 rounded-lg transition-colors text-sm font-medium"
              >
                PriceCharting
              </a>
              <a
                href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${selectedCard.card_name} ${selectedCard.set_name || 'Star Wars'} card`)}&LH_Complete=1&LH_Sold=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-3 rounded-lg transition-colors text-sm font-medium"
              >
                eBay Sold
              </a>
            </div>

            {/* Card ID */}
            <p className="text-center text-gray-600 text-xs mt-6">
              PriceCharting ID: {selectedCard.pricecharting_id || selectedCard.id}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 border-t border-gray-800">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Data from PriceCharting. Star Wars is a trademark of Lucasfilm Ltd.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/upload/other" className="hover:text-gray-300 transition-colors">Grade Cards</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
