'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getStoredSession } from '@/lib/directAuth'

interface MtgCard {
  id: string
  oracle_id: string | null
  name: string
  mana_cost: string | null
  cmc: number | null
  type_line: string | null
  oracle_text: string | null
  flavor_text: string | null
  colors: string[] | null
  color_identity: string[] | null
  power: string | null
  toughness: string | null
  loyalty: string | null
  defense: string | null
  keywords: string[] | null
  set_id: string | null
  set_code: string
  set_name: string | null
  collector_number: string
  rarity: string | null
  artist: string | null
  released_at: string | null
  layout: string | null
  frame: string | null
  border_color: string | null
  full_art: boolean | null
  promo: boolean | null
  reprint: boolean | null
  card_faces: any | null
  image_small: string | null
  image_normal: string | null
  image_large: string | null
  image_art_crop: string | null
  price_usd: number | null
  price_usd_foil: number | null
  price_eur: number | null
  legalities: Record<string, string> | null
  tcgplayer_id: number | null
  cardmarket_id: number | null
}

interface MtgSet {
  id: string
  code: string
  name: string
  set_type: string | null
  released_at: string
  card_count: number
  icon_svg_uri: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function MtgDatabasePage() {
  // Auth state
  const [user, setUser] = useState<any>(null)
  const [credits, setCredits] = useState<number>(0)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)

  // Search state
  const [searchName, setSearchName] = useState('')
  const [searchNumber, setSearchNumber] = useState('')
  const [selectedSetCode, setSelectedSetCode] = useState('')
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [selectedRarity, setSelectedRarity] = useState('')
  const [selectedTypeLine, setSelectedTypeLine] = useState('')
  const [debouncedName, setDebouncedName] = useState('')

  // Results state
  const [cards, setCards] = useState<MtgCard[]>([])
  const [sets, setSets] = useState<MtgSet[]>([])
  const [setsByType, setSetsByType] = useState<Record<string, MtgSet[]>>({})
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Detail panel state
  const [selectedCard, setSelectedCard] = useState<MtgCard | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)

  // MTG color options (WUBRG)
  const colorOptions = [
    { code: 'W', name: 'White', bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-300' },
    { code: 'U', name: 'Blue', bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-600' },
    { code: 'B', name: 'Black', bg: 'bg-gray-800', text: 'text-white', border: 'border-gray-900' },
    { code: 'R', name: 'Red', bg: 'bg-red-600', text: 'text-white', border: 'border-red-700' },
    { code: 'G', name: 'Green', bg: 'bg-green-600', text: 'text-white', border: 'border-green-700' },
  ]

  // Rarity options
  const rarityOptions = ['common', 'uncommon', 'rare', 'mythic']

  // Type line options
  const typeOptions = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land']

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
        const res = await fetch('/api/mtg-database/sets')
        const data = await res.json()
        setSets(data.sets || [])
        setSetsByType(data.setsByType || {})

        // Auto-select the first Standard-legal set on page load
        const standardSets = data.setsByType?.['Standard Legal'] || []
        if (standardSets.length > 0) {
          setSelectedSetCode(standardSets[0].code)
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
    // Don't search if no filters applied
    if (!debouncedName && !selectedSetCode && !searchNumber && selectedColors.length === 0 && !selectedRarity && !selectedTypeLine) {
      setCards([])
      setHasSearched(false)
      return
    }

    setIsLoading(true)
    setHasSearched(true)

    try {
      const params = new URLSearchParams()
      if (debouncedName) params.set('name', debouncedName)
      if (selectedSetCode) params.set('set_code', selectedSetCode)
      if (searchNumber) params.set('collector_number', searchNumber)
      if (selectedColors.length > 0) params.set('colors', selectedColors.join(','))
      if (selectedRarity) params.set('rarity', selectedRarity)
      if (selectedTypeLine) params.set('type_line', selectedTypeLine)
      params.set('page', page.toString())
      params.set('limit', '50')

      const res = await fetch(`/api/mtg-database/search?${params}`)
      const data = await res.json()

      setCards(data.cards || [])
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
    } catch (err) {
      console.error('Search failed:', err)
      setCards([])
    } finally {
      setIsLoading(false)
    }
  }, [debouncedName, selectedSetCode, searchNumber, selectedColors, selectedRarity, selectedTypeLine])

  // Trigger search on filter changes
  useEffect(() => {
    searchCards(1)
  }, [debouncedName, selectedSetCode, searchNumber, selectedColors, selectedRarity, selectedTypeLine, searchCards])

  // Toggle color filter
  const toggleColor = (colorCode: string) => {
    setSelectedColors(prev =>
      prev.includes(colorCode)
        ? prev.filter(c => c !== colorCode)
        : [...prev, colorCode]
    )
  }

  // Open card detail panel
  const openCardDetail = (card: MtgCard) => {
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
      return '/login?mode=signup&redirect=/upload/mtg'
    }
    if (credits <= 0) {
      return '/account#credits'
    }
    return '/upload/mtg'
  }

  const getGradeCtaText = () => {
    if (!user) return 'Sign Up to Grade'
    if (credits <= 0) return 'Buy Credits to Grade'
    return 'Grade This Card'
  }

  // Get rarity badge styles
  const getRarityStyle = (rarity: string | null) => {
    const styles: Record<string, string> = {
      'common': 'bg-gray-600 text-white',
      'uncommon': 'bg-gray-400 text-gray-900',
      'rare': 'bg-amber-500 text-white',
      'mythic': 'bg-orange-600 text-white',
      'special': 'bg-purple-600 text-white',
      'bonus': 'bg-pink-600 text-white',
    }
    return styles[rarity?.toLowerCase() || ''] || 'bg-gray-600 text-white'
  }

  // Get color badge for card
  const getColorBadges = (colors: string[] | null) => {
    if (!colors || colors.length === 0) return null
    return colors.map(c => {
      const colorInfo = colorOptions.find(opt => opt.code === c)
      if (!colorInfo) return null
      return (
        <span
          key={c}
          className={`px-2 py-0.5 rounded text-xs font-medium ${colorInfo.bg} ${colorInfo.text}`}
        >
          {colorInfo.name}
        </span>
      )
    })
  }

  // Format mana cost with symbols (basic text version)
  const formatManaCost = (manaCost: string | null) => {
    if (!manaCost) return null
    // Replace {X} symbols with cleaner display
    return manaCost
      .replace(/\{W\}/g, '○')  // White
      .replace(/\{U\}/g, '◆')  // Blue
      .replace(/\{B\}/g, '●')  // Black
      .replace(/\{R\}/g, '◇')  // Red
      .replace(/\{G\}/g, '◈')  // Green
      .replace(/\{(\d+)\}/g, '($1)')  // Generic
      .replace(/\{X\}/g, '(X)')
      .replace(/\{C\}/g, '◎')  // Colorless
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

  // Get legality badge
  const getLegalityBadge = (status: string) => {
    const styles: Record<string, string> = {
      'legal': 'bg-green-600 text-white',
      'not_legal': 'bg-gray-600 text-gray-300',
      'banned': 'bg-red-600 text-white',
      'restricted': 'bg-amber-600 text-white',
    }
    return styles[status] || 'bg-gray-600 text-gray-300'
  }

  // Calculate total cards from sets
  const totalCards = sets.reduce((acc, set) => acc + (set.card_count || 0), 0)

  return (
    <main className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-900 via-gray-900 to-purple-900 py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image src="/DCM Logo white.png" alt="DCM" width={40} height={40} />
            <h1 className="text-3xl md:text-4xl font-bold text-white">Magic: The Gathering Database</h1>
          </div>
          <p className="text-center text-gray-300 max-w-2xl mx-auto mb-8">
            Search and explore our database of Magic: The Gathering cards. Find card details, images, and market pricing — then grade your cards with DCM.
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
                <div className="text-2xl md:text-3xl font-bold text-white">5</div>
                <div className="text-xs md:text-sm text-gray-400">Colors (WUBRG)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">100%</div>
                <div className="text-xs md:text-sm text-gray-400">Scryfall Data</div>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-gray-300 text-sm text-center leading-relaxed">
                <span className="text-indigo-400 font-semibold">How DCM Identifies Your Cards:</span> When you upload a card for grading,
                DCM's AI cross-references the official Scryfall database using set code, collector number, and card name to ensure
                accurate identification. This database contains all Magic: The Gathering cards with verified details
                including mana cost, type line, keywords, and TCGPlayer pricing.
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
            Enter a card name, collector number, or select filters to find any MTG card in our database.
          </p>
        </div>
      </section>

      {/* Search Section */}
      <section className="bg-gray-800 border-b border-gray-700 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-3">
            {/* Row 1: Name, Number, Set */}
            <div className="flex flex-col md:flex-row gap-3">
              {/* Name Search */}
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Card Name</label>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="Search by name (e.g., Lightning Bolt, Counterspell)"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Collector Number Search */}
              <div className="w-full md:w-32">
                <label className="block text-xs text-gray-400 mb-1">Card #</label>
                <input
                  type="text"
                  value={searchNumber}
                  onChange={(e) => setSearchNumber(e.target.value)}
                  placeholder="e.g. 234"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                />
              </div>

              {/* Set Filter */}
              <div className="w-full md:w-64">
                <label className="block text-xs text-gray-400 mb-1">Set</label>
                <select
                  value={selectedSetCode}
                  onChange={(e) => setSelectedSetCode(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="">All Sets</option>
                  {Object.entries(setsByType).map(([type, typeSets]) => (
                    <optgroup key={type} label={type}>
                      {typeSets.map((set) => (
                        <option key={set.id} value={set.code}>
                          {set.name} ({set.card_count} cards)
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Colors, Rarity, Type, Clear */}
            <div className="flex flex-col md:flex-row gap-3 items-end">
              {/* Color Filter (toggle buttons) */}
              <div className="w-full md:w-auto">
                <label className="block text-xs text-gray-400 mb-1">Colors</label>
                <div className="flex gap-1">
                  {colorOptions.map((color) => (
                    <button
                      key={color.code}
                      onClick={() => toggleColor(color.code)}
                      className={`w-9 h-9 rounded-lg font-bold text-sm transition-all ${
                        selectedColors.includes(color.code)
                          ? `${color.bg} ${color.text} ring-2 ring-white`
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                      title={color.name}
                    >
                      {color.code}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rarity Filter */}
              <div className="w-full md:w-36">
                <label className="block text-xs text-gray-400 mb-1">Rarity</label>
                <select
                  value={selectedRarity}
                  onChange={(e) => setSelectedRarity(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors capitalize"
                >
                  <option value="">All Rarities</option>
                  {rarityOptions.map((rarity) => (
                    <option key={rarity} value={rarity} className="capitalize">{rarity}</option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div className="w-full md:w-40">
                <label className="block text-xs text-gray-400 mb-1">Card Type</label>
                <select
                  value={selectedTypeLine}
                  onChange={(e) => setSelectedTypeLine(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="">All Types</option>
                  {typeOptions.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Clear Button */}
              {(searchName || searchNumber || selectedSetCode || selectedColors.length > 0 || selectedRarity || selectedTypeLine) && (
                <button
                  onClick={() => {
                    setSearchName('')
                    setSearchNumber('')
                    setSelectedSetCode('')
                    setSelectedColors([])
                    setSelectedRarity('')
                    setSelectedTypeLine('')
                    searchInputRef.current?.focus()
                  }}
                  className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors whitespace-nowrap"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Results count */}
          {hasSearched && (
            <div className="mt-3 text-sm text-gray-400">
              {isLoading ? (
                'Searching...'
              ) : (
                <>
                  Found <span className="text-white font-medium">{pagination.total.toLocaleString()}</span> cards
                  {selectedSetCode && sets.find(s => s.code === selectedSetCode) && (
                    <span> in {sets.find(s => s.code === selectedSetCode)?.name}</span>
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
            <div className="text-6xl mb-4">🔮</div>
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
                      src={card.image_normal || card.image_small || '/card-placeholder.png'}
                      alt={card.name}
                      fill
                      className="object-contain p-1"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                      unoptimized
                    />
                    {/* Rarity Badge */}
                    {card.rarity && (
                      <div className={`absolute top-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded capitalize ${getRarityStyle(card.rarity)}`}>
                        {card.rarity}
                      </div>
                    )}
                  </div>

                  {/* Card Info */}
                  <div className="p-2">
                    <h3 className="text-white font-medium text-sm truncate group-hover:text-indigo-400 transition-colors">
                      {card.name}
                    </h3>
                    <p className="text-gray-500 text-xs truncate">
                      {card.set_name} · #{card.collector_number}
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
                src={selectedCard.image_large || selectedCard.image_normal || '/card-placeholder.png'}
                alt={selectedCard.name}
                fill
                className="object-contain"
                sizes="280px"
                priority
                unoptimized
              />
            </div>

            {/* Card Name & Mana Cost */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <h2 className="text-2xl font-bold text-white">
                {selectedCard.name}
              </h2>
              {selectedCard.mana_cost && (
                <span className="text-lg font-mono text-gray-400 whitespace-nowrap">
                  {selectedCard.mana_cost}
                </span>
              )}
            </div>

            {/* Type Line */}
            {selectedCard.type_line && (
              <p className="text-gray-300 mb-4">{selectedCard.type_line}</p>
            )}

            {/* Color & Rarity badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {getColorBadges(selectedCard.colors)}
              {selectedCard.rarity && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getRarityStyle(selectedCard.rarity)}`}>
                  {selectedCard.rarity}
                </span>
              )}
              {selectedCard.promo && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-600 text-white">
                  Promo
                </span>
              )}
              {selectedCard.full_art && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-600 text-white">
                  Full Art
                </span>
              )}
            </div>

            {/* Card Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {selectedCard.cmc !== null && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Mana Value</div>
                  <div className="text-white font-medium text-lg">{selectedCard.cmc}</div>
                </div>
              )}
              {selectedCard.power !== null && selectedCard.toughness !== null && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Power/Toughness</div>
                  <div className="text-white font-medium text-lg">{selectedCard.power}/{selectedCard.toughness}</div>
                </div>
              )}
              {selectedCard.loyalty && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Loyalty</div>
                  <div className="text-white font-medium text-lg">{selectedCard.loyalty}</div>
                </div>
              )}
              {selectedCard.defense && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Defense</div>
                  <div className="text-white font-medium text-lg">{selectedCard.defense}</div>
                </div>
              )}
            </div>

            {/* Keywords */}
            {selectedCard.keywords && selectedCard.keywords.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Keywords</div>
                <div className="flex flex-wrap gap-2">
                  {selectedCard.keywords.map((k, i) => (
                    <span key={i} className="px-2 py-1 bg-indigo-600/30 border border-indigo-500/50 rounded text-sm text-indigo-300">{k}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Oracle Text */}
            {selectedCard.oracle_text && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Card Text</div>
                <div className="text-white text-sm leading-relaxed whitespace-pre-line">{selectedCard.oracle_text}</div>
              </div>
            )}

            {/* Flavor Text */}
            {selectedCard.flavor_text && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Flavor Text</div>
                <div className="text-gray-400 text-sm italic leading-relaxed">{selectedCard.flavor_text}</div>
              </div>
            )}

            {/* Artist */}
            {selectedCard.artist && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Illustrator</div>
                <div className="text-white text-sm">{selectedCard.artist}</div>
              </div>
            )}

            {/* Set Info */}
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Set Information</div>
              <div className="text-white font-medium">{selectedCard.set_name}</div>
              <div className="text-gray-400 text-sm">
                {selectedCard.set_code.toUpperCase()} · Card #{selectedCard.collector_number}
              </div>
              {selectedCard.released_at && (
                <div className="text-gray-500 text-xs mt-1">
                  Released: {new Date(selectedCard.released_at).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Legalities */}
            {selectedCard.legalities && Object.keys(selectedCard.legalities).length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Format Legalities</div>
                <div className="flex flex-wrap gap-2">
                  {['standard', 'modern', 'pioneer', 'legacy', 'vintage', 'commander'].map(format => {
                    const status = selectedCard.legalities?.[format]
                    if (!status) return null
                    return (
                      <span
                        key={format}
                        className={`px-2 py-1 rounded text-xs font-medium capitalize ${getLegalityBadge(status)}`}
                      >
                        {format}: {status.replace('_', ' ')}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Market Price */}
            {(selectedCard.price_usd || selectedCard.price_usd_foil) && (
              <div className="bg-gray-800 rounded-lg p-4 mb-6">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">TCGPlayer Pricing</div>
                <div className="flex justify-between items-center">
                  {selectedCard.price_usd && (
                    <div>
                      <div className="text-xs text-gray-500">Regular</div>
                      <div className="text-green-400 font-bold text-lg">{formatPrice(selectedCard.price_usd)}</div>
                    </div>
                  )}
                  {selectedCard.price_usd_foil && (
                    <div>
                      <div className="text-xs text-gray-500">Foil</div>
                      <div className="text-amber-400 font-medium">{formatPrice(selectedCard.price_usd_foil)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Grade This Card CTA */}
            <Link
              href={getGradeCtaLink()}
              className="block w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg px-6 py-4 rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all text-center shadow-lg shadow-indigo-500/20 mb-4"
            >
              {getGradeCtaText()}
            </Link>

            {/* Market Links */}
            <div className="flex gap-3">
              {selectedCard.tcgplayer_id && (
                <a
                  href={`https://www.tcgplayer.com/product/${selectedCard.tcgplayer_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-3 rounded-lg transition-colors text-sm font-medium"
                >
                  TCGPlayer
                </a>
              )}
              {!selectedCard.tcgplayer_id && (
                <a
                  href={`https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(selectedCard.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-3 rounded-lg transition-colors text-sm font-medium"
                >
                  TCGPlayer
                </a>
              )}
              <a
                href={`https://www.cardkingdom.com/catalog/search?search=header&filter%5Bname%5D=${encodeURIComponent(selectedCard.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-3 rounded-lg transition-colors text-sm font-medium"
              >
                Card Kingdom
              </a>
              <a
                href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${selectedCard.name} MTG`)}&LH_Complete=1&LH_Sold=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-3 rounded-lg transition-colors text-sm font-medium"
              >
                eBay Sold
              </a>
            </div>

            {/* Card ID for reference */}
            <p className="text-center text-gray-600 text-xs mt-6">
              {selectedCard.set_code.toUpperCase()} · #{selectedCard.collector_number}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 border-t border-gray-800">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Data from Scryfall API. Magic: The Gathering is a trademark of Wizards of the Coast.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/mtg" className="hover:text-gray-300 transition-colors">Grade Cards</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
