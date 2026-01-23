'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getStoredSession } from '@/lib/directAuth'

interface LorcanaCard {
  id: string
  name: string
  version: string | null
  full_name: string
  collector_number: string
  set_id: string
  set_code: string
  set_name: string
  ink: string | null
  inkwell: boolean
  card_type: string[] | null
  classifications: string[] | null
  cost: number | null
  strength: number | null
  willpower: number | null
  lore: number | null
  card_text: string | null
  flavor_text: string | null
  keywords: string[] | null
  rarity: string | null
  image_small: string | null
  image_normal: string | null
  image_large: string | null
  illustrators: string[] | null
  price_usd: number | null
  price_usd_foil: number | null
}

interface LorcanaSet {
  id: string
  code: string
  name: string
  released_at: string
  total_cards: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function LorcanaDatabasePage() {
  // Auth state
  const [user, setUser] = useState<any>(null)
  const [credits, setCredits] = useState<number>(0)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)

  // Search state
  const [searchName, setSearchName] = useState('')
  const [searchNumber, setSearchNumber] = useState('')
  const [selectedSetCode, setSelectedSetCode] = useState('')
  const [selectedInk, setSelectedInk] = useState('')
  const [selectedRarity, setSelectedRarity] = useState('')
  const [debouncedName, setDebouncedName] = useState('')

  // Results state
  const [cards, setCards] = useState<LorcanaCard[]>([])
  const [sets, setSets] = useState<LorcanaSet[]>([])
  const [setsByType, setSetsByType] = useState<Record<string, LorcanaSet[]>>({})
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Detail panel state
  const [selectedCard, setSelectedCard] = useState<LorcanaCard | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  // Versions state (for "See All Versions" feature)
  const [versions, setVersions] = useState<LorcanaCard[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [showVersions, setShowVersions] = useState(false)

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Ink color options for Lorcana
  const inkOptions = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel']

  // Rarity options (must match database values exactly)
  const rarityOptions = ['Common', 'Uncommon', 'Rare', 'Super rare', 'Legendary', 'Enchanted', 'Promo']

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

  // Load sets on mount and auto-select latest main set
  useEffect(() => {
    const loadSets = async () => {
      try {
        const res = await fetch('/api/lorcana-database/sets')
        const data = await res.json()
        setSets(data.sets || [])
        setSetsByType(data.setsByType || {})

        // Auto-select the latest main set on page load
        const mainSets = data.setsByType?.['Main Sets'] || []
        if (mainSets.length > 0) {
          setSelectedSetCode(mainSets[0].code)
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
    if (!debouncedName && !selectedSetCode && !searchNumber && !selectedInk && !selectedRarity) {
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
      if (selectedInk) params.set('ink', selectedInk)
      if (selectedRarity) params.set('rarity', selectedRarity)
      params.set('page', page.toString())
      params.set('limit', '50')

      const res = await fetch(`/api/lorcana-database/search?${params}`)
      const data = await res.json()

      setCards(data.cards || [])
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
    } catch (err) {
      console.error('Search failed:', err)
      setCards([])
    } finally {
      setIsLoading(false)
    }
  }, [debouncedName, selectedSetCode, searchNumber, selectedInk, selectedRarity])

  // Trigger search on filter changes
  useEffect(() => {
    searchCards(1)
  }, [debouncedName, selectedSetCode, searchNumber, selectedInk, selectedRarity, searchCards])

  // Open card detail panel
  const openCardDetail = (card: LorcanaCard) => {
    setSelectedCard(card)
    setIsPanelOpen(true)
  }

  // Close card detail panel
  const closeCardDetail = () => {
    setIsPanelOpen(false)
    setShowVersions(false)
    setVersions([])
    setTimeout(() => setSelectedCard(null), 300)
  }

  // Fetch all versions of a card
  const fetchVersions = async (cardName: string) => {
    if (!cardName) return
    setIsLoadingVersions(true)
    try {
      const res = await fetch(`/api/lorcana-database/versions?name=${encodeURIComponent(cardName)}`)
      const data = await res.json()
      setVersions(data.versions || [])
      setShowVersions(true)
    } catch (err) {
      console.error('Failed to fetch versions:', err)
    } finally {
      setIsLoadingVersions(false)
    }
  }

  // Switch to a different version
  const switchToVersion = (card: LorcanaCard) => {
    setSelectedCard(card)
    setShowVersions(false)
  }

  // Get rarity badge color
  const getRarityBadgeStyle = (rarity: string | null) => {
    const styles: Record<string, string> = {
      'Common': 'bg-gray-600 text-white',
      'Uncommon': 'bg-green-600 text-white',
      'Rare': 'bg-blue-600 text-white',
      'Super rare': 'bg-purple-600 text-white',
      'Legendary': 'bg-amber-500 text-white',
      'Enchanted': 'bg-gradient-to-r from-pink-500 to-purple-500 text-white',
      'Promo': 'bg-red-600 text-white',
    }
    return styles[rarity || ''] || 'bg-gray-600 text-white'
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

  // Get ink color badge styles
  const getInkStyle = (ink: string | null) => {
    const styles: Record<string, string> = {
      'Amber': 'bg-amber-500 text-white',
      'Amethyst': 'bg-purple-600 text-white',
      'Emerald': 'bg-emerald-600 text-white',
      'Ruby': 'bg-red-600 text-white',
      'Sapphire': 'bg-blue-600 text-white',
      'Steel': 'bg-gray-500 text-white',
    }
    return styles[ink || ''] || 'bg-gray-600 text-white'
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
      <section className="bg-gradient-to-br from-purple-900 via-gray-900 to-amber-900 py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image src="/DCM Logo white.png" alt="DCM" width={40} height={40} />
            <h1 className="text-3xl md:text-4xl font-bold text-white">Lorcana Card Database</h1>
          </div>
          <p className="text-center text-gray-300 max-w-2xl mx-auto mb-8">
            Search and explore our database of Disney Lorcana TCG cards. Find card details, images, and market pricing — then grade your cards with DCM.
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
                <div className="text-2xl md:text-3xl font-bold text-white">6</div>
                <div className="text-xs md:text-sm text-gray-400">Ink Colors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">100%</div>
                <div className="text-xs md:text-sm text-gray-400">Official Data</div>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-gray-300 text-sm text-center leading-relaxed">
                <span className="text-purple-400 font-semibold">How DCM Identifies Your Cards:</span> When you upload a card for grading,
                DCM's AI cross-references the official Lorcana database using set code, collector number, and card name to ensure
                accurate identification. This database contains all Disney Lorcana TCG cards with verified details
                including ink color, stats, keywords, and TCGPlayer pricing.
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
            Enter a card name, collector number, or select filters to find any Lorcana card in our database.
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
                placeholder="Search by name (e.g., Elsa, Mickey, Maleficent)"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Collector Number Search */}
            <div className="w-full md:w-32">
              <label className="block text-xs text-gray-400 mb-1">Card #</label>
              <input
                type="text"
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
                placeholder="e.g. 207"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors text-sm"
              />
            </div>

            {/* Set Filter */}
            <div className="w-full md:w-52">
              <label className="block text-xs text-gray-400 mb-1">Set</label>
              <select
                value={selectedSetCode}
                onChange={(e) => setSelectedSetCode(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors"
              >
                <option value="">All Sets</option>
                {Object.entries(setsByType).map(([type, typeSets]) => (
                  <optgroup key={type} label={type}>
                    {typeSets.map((set) => (
                      <option key={set.id} value={set.code}>
                        {set.name} ({set.total_cards} cards)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Ink Filter */}
            <div className="w-full md:w-36">
              <label className="block text-xs text-gray-400 mb-1">Ink</label>
              <select
                value={selectedInk}
                onChange={(e) => setSelectedInk(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors"
              >
                <option value="">All Inks</option>
                {inkOptions.map((ink) => (
                  <option key={ink} value={ink}>{ink}</option>
                ))}
              </select>
            </div>

            {/* Rarity Filter */}
            <div className="w-full md:w-36">
              <label className="block text-xs text-gray-400 mb-1">Rarity</label>
              <select
                value={selectedRarity}
                onChange={(e) => setSelectedRarity(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors"
              >
                <option value="">All Rarities</option>
                {rarityOptions.map((rarity) => (
                  <option key={rarity} value={rarity}>{rarity}</option>
                ))}
              </select>
            </div>

            {/* Clear Button */}
            {(searchName || searchNumber || selectedSetCode || selectedInk || selectedRarity) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchName('')
                    setSearchNumber('')
                    setSelectedSetCode('')
                    setSelectedInk('')
                    setSelectedRarity('')
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
            <div className="text-6xl mb-4">✨</div>
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
                  className="group text-left bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-purple-500 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/10"
                >
                  {/* Card Image */}
                  <div className="relative aspect-[2.5/3.5] bg-gray-900">
                    <Image
                      src={card.image_normal || card.image_small || '/card-placeholder.png'}
                      alt={card.full_name || card.name}
                      fill
                      className="object-contain p-1"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                      unoptimized
                    />
                    {/* Ink Badge */}
                    {card.ink && (
                      <div className={`absolute top-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${getInkStyle(card.ink)}`}>
                        {card.ink}
                      </div>
                    )}
                  </div>

                  {/* Card Info */}
                  <div className="p-2">
                    <h3 className="text-white font-medium text-sm truncate group-hover:text-purple-400 transition-colors">
                      {card.full_name || card.name}
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
                alt={selectedCard.full_name || selectedCard.name}
                fill
                className="object-contain"
                sizes="280px"
                priority
                unoptimized
              />
            </div>

            {/* Card Name & Basic Info */}
            <h2 className="text-2xl font-bold text-white mb-1">
              {selectedCard.full_name || selectedCard.name}
            </h2>
            <p className="text-gray-400 mb-4">
              {selectedCard.set_name} · #{selectedCard.collector_number}
            </p>

            {/* Ink & Type badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedCard.ink && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getInkStyle(selectedCard.ink)}`}>
                  {selectedCard.ink}
                </span>
              )}
              {selectedCard.card_type?.map((type, i) => (
                <span key={i} className="px-3 py-1 rounded-full text-sm font-medium bg-gray-700 text-white">
                  {type}
                </span>
              ))}
              {selectedCard.inkwell && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-700 text-amber-400">
                  Inkable
                </span>
              )}
            </div>

            {/* Card Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {selectedCard.cost !== null && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Cost</div>
                  <div className="text-white font-medium text-lg">{selectedCard.cost}</div>
                </div>
              )}
              {selectedCard.strength !== null && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Strength</div>
                  <div className="text-white font-medium text-lg">{selectedCard.strength}</div>
                </div>
              )}
              {selectedCard.willpower !== null && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Willpower</div>
                  <div className="text-white font-medium text-lg">{selectedCard.willpower}</div>
                </div>
              )}
              {selectedCard.lore !== null && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Lore</div>
                  <div className="text-white font-medium text-lg">{selectedCard.lore}</div>
                </div>
              )}
              {selectedCard.rarity && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Rarity</div>
                  <div className="text-white font-medium">{selectedCard.rarity}</div>
                </div>
              )}
            </div>

            {/* Classifications */}
            {selectedCard.classifications && selectedCard.classifications.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Classifications</div>
                <div className="flex flex-wrap gap-2">
                  {selectedCard.classifications.map((c, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-700 rounded text-sm text-white">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords */}
            {selectedCard.keywords && selectedCard.keywords.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Keywords</div>
                <div className="flex flex-wrap gap-2">
                  {selectedCard.keywords.map((k, i) => (
                    <span key={i} className="px-2 py-1 bg-purple-600/30 border border-purple-500/50 rounded text-sm text-purple-300">{k}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Card Text */}
            {selectedCard.card_text && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Card Text</div>
                <div className="text-white text-sm leading-relaxed">{selectedCard.card_text}</div>
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
            {selectedCard.illustrators && selectedCard.illustrators.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Illustrator</div>
                <div className="text-white text-sm">{selectedCard.illustrators.join(', ')}</div>
              </div>
            )}

            {/* Set Info */}
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Set Information</div>
              <div className="text-white font-medium">{selectedCard.set_name}</div>
              <div className="text-gray-400 text-sm">
                Set {selectedCard.set_code} · Card #{selectedCard.collector_number}
              </div>
            </div>

            {/* See All Versions Button */}
            {!showVersions && (
              <button
                onClick={() => fetchVersions(selectedCard.name)}
                disabled={isLoadingVersions}
                className="w-full bg-gray-800 hover:bg-gray-700 text-purple-400 font-medium py-3 px-4 rounded-lg mb-4 transition-colors flex items-center justify-center gap-2"
              >
                {isLoadingVersions ? (
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
                    See All Versions (Enchanted, Promo, etc.)
                  </>
                )}
              </button>
            )}

            {/* All Versions View */}
            {showVersions && versions.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    All Versions ({versions.length})
                  </div>
                  <button
                    onClick={() => setShowVersions(false)}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Hide
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {versions.map((version) => (
                    <button
                      key={version.id}
                      onClick={() => switchToVersion(version)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                        version.id === selectedCard.id
                          ? 'bg-purple-600/30 border border-purple-500/50'
                          : 'bg-gray-700/50 hover:bg-gray-700'
                      }`}
                    >
                      <div className="relative w-10 h-14 flex-shrink-0 bg-gray-900 rounded overflow-hidden">
                        <Image
                          src={version.image_small || version.image_normal || '/card-placeholder.png'}
                          alt={version.full_name || version.name}
                          fill
                          className="object-contain"
                          sizes="40px"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getRarityBadgeStyle(version.rarity)}`}>
                            {version.rarity}
                          </span>
                        </div>
                        <div className="text-gray-400 text-xs mt-0.5">
                          {version.set_name} #{version.collector_number}
                        </div>
                        {version.price_usd && (
                          <div className="text-green-400 text-xs">
                            {formatPrice(version.price_usd)}
                          </div>
                        )}
                      </div>
                      {version.id === selectedCard.id && (
                        <div className="text-purple-400 text-xs">Current</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showVersions && versions.length === 1 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="text-center text-gray-400 text-sm">
                  No other versions found for this card.
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
              className="block w-full bg-gradient-to-r from-purple-600 to-amber-500 text-white font-bold text-lg px-6 py-4 rounded-xl hover:from-purple-500 hover:to-amber-400 transition-all text-center shadow-lg shadow-purple-500/20 mb-4"
            >
              {getGradeCtaText()}
            </Link>

            {/* Market Links */}
            <div className="flex gap-3">
              <a
                href={`https://www.tcgplayer.com/search/lorcana/product?q=${encodeURIComponent(selectedCard.full_name || selectedCard.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-3 rounded-lg transition-colors text-sm font-medium"
              >
                TCGPlayer
              </a>
              <a
                href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${selectedCard.full_name || selectedCard.name} Lorcana`)}&LH_Complete=1&LH_Sold=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-3 rounded-lg transition-colors text-sm font-medium"
              >
                eBay Sold
              </a>
            </div>

            {/* Card ID for reference */}
            <p className="text-center text-gray-600 text-xs mt-6">
              Set {selectedCard.set_code} · #{selectedCard.collector_number}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 border-t border-gray-800">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Data from Lorcast API. Disney Lorcana is a trademark of Disney.</p>
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
