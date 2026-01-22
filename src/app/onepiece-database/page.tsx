'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getStoredSession } from '@/lib/directAuth'

interface OnePieceCard {
  id: string
  card_name: string
  card_number: string
  set_id: string
  set_name: string
  card_type: string | null
  card_color: string | null
  rarity: string | null
  card_cost: number | null
  card_power: number | null
  life: number | null
  counter_amount: number | null
  attribute: string | null
  sub_types: string | null
  card_text: string | null
  card_image: string | null
  market_price: number | null
  inventory_price: number | null
}

interface OnePieceSet {
  id: string
  name: string
  set_type: string
  total_cards: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function OnePieceDatabasePage() {
  // Auth state
  const [user, setUser] = useState<any>(null)
  const [credits, setCredits] = useState<number>(0)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)

  // Search state
  const [searchName, setSearchName] = useState('')
  const [searchCardId, setSearchCardId] = useState('')
  const [selectedSetId, setSelectedSetId] = useState('')
  const [selectedColor, setSelectedColor] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [debouncedName, setDebouncedName] = useState('')

  // Results state
  const [cards, setCards] = useState<OnePieceCard[]>([])
  const [sets, setSets] = useState<OnePieceSet[]>([])
  const [setsByType, setSetsByType] = useState<Record<string, OnePieceSet[]>>({})
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Detail panel state
  const [selectedCard, setSelectedCard] = useState<OnePieceCard | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Color options for One Piece TCG
  const colorOptions = ['Red', 'Blue', 'Green', 'Purple', 'Black', 'Yellow']

  // Card type options
  const typeOptions = ['Leader', 'Character', 'Event', 'Stage']

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
        const res = await fetch('/api/onepiece-database/sets')
        const data = await res.json()
        setSets(data.sets || [])
        setSetsByType(data.setsByType || {})
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
    // Don't search if no filters applied
    if (!debouncedName && !selectedSetId && !searchCardId && !selectedColor && !selectedType) {
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
      if (searchCardId) params.set('card_id', searchCardId)
      if (selectedColor) params.set('card_color', selectedColor)
      if (selectedType) params.set('card_type', selectedType)
      params.set('page', page.toString())
      params.set('limit', '50')

      const res = await fetch(`/api/onepiece-database/search?${params}`)
      const data = await res.json()

      setCards(data.cards || [])
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
    } catch (err) {
      console.error('Search failed:', err)
      setCards([])
    } finally {
      setIsLoading(false)
    }
  }, [debouncedName, selectedSetId, searchCardId, selectedColor, selectedType])

  // Trigger search on filter changes
  useEffect(() => {
    searchCards(1)
  }, [debouncedName, selectedSetId, searchCardId, selectedColor, selectedType, searchCards])

  // Open card detail panel
  const openCardDetail = (card: OnePieceCard) => {
    setSelectedCard(card)
    setIsPanelOpen(true)
  }

  // Close card detail panel
  const closeCardDetail = () => {
    setIsPanelOpen(false)
    setTimeout(() => setSelectedCard(null), 300)
  }

  // Get Grade CTA link based on auth state
  const getGradeCtaLink = () => {
    if (!user) {
      return '/login?mode=signup&redirect=/upload/other'
    }
    if (credits <= 0) {
      return '/account#credits'
    }
    return '/upload/other'
  }

  const getGradeCtaText = () => {
    if (!user) return 'Sign Up to Grade'
    if (credits <= 0) return 'Buy Credits to Grade'
    return 'Grade This Card'
  }

  // Get color badge styles
  const getColorStyle = (color: string | null) => {
    const styles: Record<string, string> = {
      'Red': 'bg-red-600 text-white',
      'Blue': 'bg-blue-600 text-white',
      'Green': 'bg-green-600 text-white',
      'Purple': 'bg-purple-600 text-white',
      'Black': 'bg-gray-900 text-white',
      'Yellow': 'bg-yellow-500 text-gray-900',
    }
    return styles[color || ''] || 'bg-gray-600 text-white'
  }

  // Get rarity display
  const getRarityDisplay = (rarity: string | null) => {
    const rarityMap: Record<string, string> = {
      'L': 'Leader',
      'C': 'Common',
      'UC': 'Uncommon',
      'R': 'Rare',
      'SR': 'Super Rare',
      'SEC': 'Secret Rare',
      'SP': 'Special',
      'P': 'Promo',
    }
    return rarityMap[rarity || ''] || rarity || 'Unknown'
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

  // Calculate total cards from sets
  const totalCards = sets.reduce((acc, set) => acc + (set.total_cards || 0), 0)

  return (
    <main className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-red-900 via-gray-900 to-blue-900 py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image src="/DCM Logo white.png" alt="DCM" width={40} height={40} />
            <h1 className="text-3xl md:text-4xl font-bold text-white">One Piece Card Database</h1>
          </div>
          <p className="text-center text-gray-300 max-w-2xl mx-auto mb-8">
            Search and explore our database of One Piece TCG cards. Find card details, images, and market pricing — then grade your cards with DCM.
          </p>

          {/* Database Stats & Info */}
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
                <div className="text-2xl md:text-3xl font-bold text-white">OP-01 to OP-12</div>
                <div className="text-xs md:text-sm text-gray-400">Booster Sets</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">100%</div>
                <div className="text-xs md:text-sm text-gray-400">Official Data</div>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-gray-300 text-sm text-center leading-relaxed">
                <span className="text-red-400 font-semibold">How DCM Identifies Your Cards:</span> When you upload a card for grading,
                DCM's AI cross-references the official One Piece TCG database using card ID (e.g., OP01-001), card name, and set information to ensure
                accurate identification. This database contains all English One Piece TCG cards with verified details
                including rarity, power, cost, and TCGPlayer pricing.
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
            Enter a card name, card ID, or select filters to find any One Piece card in our database.
          </p>
        </div>
      </section>

      {/* Search Section */}
      <section className="bg-gray-800 border-b border-gray-700 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Name Search */}
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Card Name</label>
              <input
                ref={searchInputRef}
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Search by name (e.g., Luffy, Zoro, Nami)"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>

            {/* Card ID Search */}
            <div className="w-full md:w-40">
              <label className="block text-xs text-gray-400 mb-1">Card ID</label>
              <input
                type="text"
                value={searchCardId}
                onChange={(e) => setSearchCardId(e.target.value.toUpperCase())}
                placeholder="e.g. OP01-001"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors text-sm"
              />
            </div>

            {/* Set Filter */}
            <div className="w-full md:w-52">
              <label className="block text-xs text-gray-400 mb-1">Set</label>
              <select
                value={selectedSetId}
                onChange={(e) => setSelectedSetId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors"
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

            {/* Color Filter */}
            <div className="w-full md:w-36">
              <label className="block text-xs text-gray-400 mb-1">Color</label>
              <select
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors"
              >
                <option value="">All Colors</option>
                {colorOptions.map((color) => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div className="w-full md:w-36">
              <label className="block text-xs text-gray-400 mb-1">Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors"
              >
                <option value="">All Types</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Clear Button */}
            {(searchName || searchCardId || selectedSetId || selectedColor || selectedType) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchName('')
                    setSearchCardId('')
                    setSelectedSetId('')
                    setSelectedColor('')
                    setSelectedType('')
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
          <p className="text-gray-500 text-sm">Use the fields above to search for cards</p>
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
            <div className="text-6xl mb-4">🏴‍☠️</div>
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
                  className="group text-left bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-red-500 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-red-500/10"
                >
                  {/* Card Image */}
                  <div className="relative aspect-[2.5/3.5] bg-gray-900">
                    {card.card_image ? (
                      <Image
                        src={card.card_image}
                        alt={card.card_name}
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
                    {/* Color Badge */}
                    {card.card_color && (
                      <div className={`absolute top-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${getColorStyle(card.card_color)}`}>
                        {card.card_color}
                      </div>
                    )}
                  </div>

                  {/* Card Info */}
                  <div className="p-2">
                    <h3 className="text-white font-medium text-sm truncate group-hover:text-red-400 transition-colors">
                      {card.card_name}
                    </h3>
                    <p className="text-gray-500 text-xs truncate">
                      {card.set_name} · {card.id}
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
              {selectedCard.card_image ? (
                <Image
                  src={selectedCard.card_image}
                  alt={selectedCard.card_name}
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
              {selectedCard.card_name}
            </h2>
            <p className="text-gray-400 mb-4">
              {selectedCard.set_name} · {selectedCard.id}
            </p>

            {/* Color & Type badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedCard.card_color && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getColorStyle(selectedCard.card_color)}`}>
                  {selectedCard.card_color}
                </span>
              )}
              {selectedCard.card_type && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-700 text-white">
                  {selectedCard.card_type}
                </span>
              )}
            </div>

            {/* Card Details Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {selectedCard.rarity && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Rarity</div>
                  <div className="text-white font-medium">{getRarityDisplay(selectedCard.rarity)}</div>
                </div>
              )}
              {selectedCard.card_power && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Power</div>
                  <div className="text-white font-medium">{selectedCard.card_power.toLocaleString()}</div>
                </div>
              )}
              {selectedCard.card_cost !== null && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Cost</div>
                  <div className="text-white font-medium">{selectedCard.card_cost}</div>
                </div>
              )}
              {selectedCard.life && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Life</div>
                  <div className="text-white font-medium">{selectedCard.life}</div>
                </div>
              )}
              {selectedCard.counter_amount && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Counter</div>
                  <div className="text-white font-medium">+{selectedCard.counter_amount.toLocaleString()}</div>
                </div>
              )}
              {selectedCard.attribute && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Attribute</div>
                  <div className="text-white font-medium">{selectedCard.attribute}</div>
                </div>
              )}
            </div>

            {/* Traits/Sub-types */}
            {selectedCard.sub_types && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Traits</div>
                <div className="text-white text-sm">{selectedCard.sub_types}</div>
              </div>
            )}

            {/* Card Text */}
            {selectedCard.card_text && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Card Text</div>
                <div className="text-white text-sm leading-relaxed">{selectedCard.card_text}</div>
              </div>
            )}

            {/* Set Info */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Set Information</div>
              <div className="text-white font-medium">{selectedCard.set_name}</div>
              <div className="text-gray-400 text-sm">
                Set ID: {selectedCard.set_id}
              </div>
            </div>

            {/* Market Price */}
            {(selectedCard.market_price || selectedCard.inventory_price) && (
              <div className="bg-gray-800 rounded-lg p-4 mb-6">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">TCGPlayer Pricing</div>
                <div className="flex justify-between items-center">
                  {selectedCard.market_price && (
                    <div>
                      <div className="text-xs text-gray-500">Market</div>
                      <div className="text-green-400 font-bold text-lg">{formatPrice(selectedCard.market_price)}</div>
                    </div>
                  )}
                  {selectedCard.inventory_price && (
                    <div>
                      <div className="text-xs text-gray-500">Listed</div>
                      <div className="text-white font-medium">{formatPrice(selectedCard.inventory_price)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Grade This Card CTA */}
            <Link
              href={getGradeCtaLink()}
              className="block w-full bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold text-lg px-6 py-4 rounded-xl hover:from-red-500 hover:to-orange-400 transition-all text-center shadow-lg shadow-red-500/20 mb-4"
            >
              {getGradeCtaText()}
            </Link>

            {/* Market Links */}
            <div className="flex gap-3">
              <a
                href={`https://www.tcgplayer.com/search/one-piece-card-game/product?q=${encodeURIComponent(selectedCard.card_name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-3 rounded-lg transition-colors text-sm font-medium"
              >
                TCGPlayer
              </a>
              <a
                href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${selectedCard.card_name} ${selectedCard.id} One Piece`)}&LH_Complete=1&LH_Sold=1`}
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

      {/* Footer */}
      <footer className="py-8 bg-gray-900 border-t border-gray-800">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Data from OPTCG API. One Piece is a trademark of Shueisha/Toei Animation.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/other" className="hover:text-gray-300 transition-colors">Grade Cards</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
