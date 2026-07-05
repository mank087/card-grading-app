'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getStoredSession } from '@/lib/directAuth'

interface SportsSet {
  uid: string
  slug: string
  console_name: string
  sport: string | null
  year: number | null
  manufacturer: string | null
  set_name: string | null
  product_count: number | null
}

interface SportsCard {
  id: string
  product_name: string
  console_name: string
  set_uid: string | null
  player_name: string | null
  card_number: string | null
  variant_text: string | null
  serial_denominator: number | null
  is_rookie: boolean | null
  loose_price: number | null
  graded_price: number | null
  manual_only_price: number | null
  sales_volume: number | null
  release_date: string | null
}

interface FilterOptions {
  sports: string[]
  manufacturers: string[]
  years: number[]
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface CardGroup {
  key: string
  base: SportsCard
  parallels: SportsCard[]
}

const EMPTY_PAGINATION: Pagination = { page: 1, limit: 50, total: 0, totalPages: 0 }

// Group a page of card rows into base-card + parallels families by card_number.
// The API orders variant_text nulls-first, so the base row leads its family.
function groupCards(cards: SportsCard[]): CardGroup[] {
  const groups: CardGroup[] = []
  const byKey = new Map<string, CardGroup>()

  for (const card of cards) {
    const key = card.card_number ? `${card.set_uid || ''}#${card.card_number}` : `id:${card.id}`
    const existing = byKey.get(key)
    if (!existing) {
      const group: CardGroup = { key, base: card, parallels: [] }
      byKey.set(key, group)
      groups.push(group)
    } else if (!card.variant_text && existing.base.variant_text) {
      existing.parallels.unshift(existing.base)
      existing.base = card
    } else {
      existing.parallels.push(card)
    }
  }

  return groups
}

export default function SportsDatabasePage() {
  // Auth state (public page — auth only alters the Grade CTA)
  const [user, setUser] = useState<any>(null)
  const [credits, setCredits] = useState<number>(0)

  // Sets view state
  const [setQuery, setSetQuery] = useState('')
  const [debouncedSetQuery, setDebouncedSetQuery] = useState('')
  const [sportFilter, setSportFilter] = useState('')
  const [manufacturerFilter, setManufacturerFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [sets, setSets] = useState<SportsSet[]>([])
  const [setsPagination, setSetsPagination] = useState<Pagination>({ ...EMPTY_PAGINATION, limit: 100 })
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ sports: [], manufacturers: [], years: [] })
  const [isLoadingSets, setIsLoadingSets] = useState(true)
  const [dbEmpty, setDbEmpty] = useState(false)

  // Cards view state
  const [selectedSet, setSelectedSet] = useState<SportsSet | null>(null)
  const [playerSearch, setPlayerSearch] = useState('')
  const [debouncedPlayer, setDebouncedPlayer] = useState('')
  const [cardNumberSearch, setCardNumberSearch] = useState('')
  const [cards, setCards] = useState<SportsCard[]>([])
  const [cardsPagination, setCardsPagination] = useState<Pagination>(EMPTY_PAGINATION)
  const [isLoadingCards, setIsLoadingCards] = useState(false)
  const [cardsUnavailable, setCardsUnavailable] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Mobile filter toggle
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  // Cards view is active when a set is selected or a global player search is running
  const isCardsView = selectedSet !== null || debouncedPlayer.length > 0

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
    }
    loadAuth()
  }, [])

  // Debounce set-name search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSetQuery(setQuery), 300)
    return () => clearTimeout(timer)
  }, [setQuery])

  // Debounce player search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPlayer(playerSearch.trim()), 300)
    return () => clearTimeout(timer)
  }, [playerSearch])

  // Fetch sets
  const fetchSets = useCallback(async (page = 1) => {
    setIsLoadingSets(true)
    try {
      const params = new URLSearchParams()
      if (sportFilter) params.set('sport', sportFilter)
      if (manufacturerFilter) params.set('manufacturer', manufacturerFilter)
      if (yearFilter) params.set('year', yearFilter)
      if (debouncedSetQuery) params.set('q', debouncedSetQuery)
      params.set('page', page.toString())
      params.set('limit', '100')

      const res = await fetch(`/api/sports-database/sets?${params}`)
      const data = await res.json()

      setSets(data.sets || [])
      setSetsPagination(data.pagination || { ...EMPTY_PAGINATION, limit: 100 })
      if (data.filters) setFilterOptions(data.filters)

      // Empty-DB detection: no rows with no filters means the import hasn't run
      const hasFilters = !!(sportFilter || manufacturerFilter || yearFilter || debouncedSetQuery)
      if (!hasFilters) setDbEmpty((data.pagination?.total || 0) === 0)
    } catch (err) {
      console.error('Failed to fetch sets:', err)
      setSets([])
    } finally {
      setIsLoadingSets(false)
    }
  }, [sportFilter, manufacturerFilter, yearFilter, debouncedSetQuery])

  useEffect(() => {
    fetchSets(1)
  }, [fetchSets])

  // Fetch cards (within selected set and/or global player search)
  const fetchCards = useCallback(async (page = 1) => {
    if (!selectedSet && !debouncedPlayer) return
    setIsLoadingCards(true)
    try {
      const params = new URLSearchParams()
      if (selectedSet) params.set('setUid', selectedSet.uid)
      if (debouncedPlayer) params.set('playerName', debouncedPlayer)
      if (cardNumberSearch.trim()) params.set('cardNumber', cardNumberSearch.trim())
      params.set('page', page.toString())
      params.set('limit', '50')

      const res = await fetch(`/api/sports-database/search?${params}`)
      const data = await res.json()

      setCardsUnavailable(!!data.unavailable)
      setCards(data.cards || [])
      setCardsPagination(data.pagination || EMPTY_PAGINATION)
      setExpandedGroups(new Set())
    } catch (err) {
      console.error('Card search failed:', err)
      setCards([])
    } finally {
      setIsLoadingCards(false)
    }
  }, [selectedSet, debouncedPlayer, cardNumberSearch])

  useEffect(() => {
    fetchCards(1)
  }, [fetchCards])

  const cardGroups = useMemo(() => groupCards(cards), [cards])

  const openSet = (set: SportsSet) => {
    setSelectedSet(set)
    setCards([])
    setCardsPagination(EMPTY_PAGINATION)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const backToSets = () => {
    setSelectedSet(null)
    setPlayerSearch('')
    setDebouncedPlayer('')
    setCardNumberSearch('')
    setCards([])
  }

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Grade CTA (auth only changes the destination — page itself is public)
  const getGradeCtaLink = () => {
    if (!user) return '/login?mode=signup&redirect=/upload/sports'
    if (credits <= 0) return '/account#credits'
    return '/upload/sports'
  }

  const getGradeCtaText = () => {
    if (!user) return 'Sign Up to Grade'
    if (credits <= 0) return 'Buy Credits to Grade'
    return 'Grade This Card'
  }

  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return '—'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price)
  }

  const setDisplayName = (set: SportsSet) =>
    set.console_name || [set.year, set.manufacturer, set.set_name].filter(Boolean).join(' ')

  const activeSetFilterCount = [sportFilter, manufacturerFilter, yearFilter].filter(Boolean).length

  // Price columns shared by header and rows
  const renderPriceCells = (card: SportsCard) => (
    <>
      <div className="w-20 sm:w-24 text-right text-green-400 font-medium text-sm tabular-nums">
        {formatPrice(card.loose_price)}
      </div>
      <div className="w-20 sm:w-24 text-right text-white font-medium text-sm tabular-nums">
        {formatPrice(card.graded_price)}
      </div>
      <div className="w-20 sm:w-24 text-right text-amber-400 font-semibold text-sm tabular-nums">
        {formatPrice(card.manual_only_price)}
      </div>
    </>
  )

  const renderBadges = (card: SportsCard) => (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
          card.variant_text
            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
            : 'bg-gray-700 text-gray-300'
        }`}
      >
        {card.variant_text || 'Base'}
      </span>
      {card.serial_denominator && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
          /{card.serial_denominator}
        </span>
      )}
      {card.is_rookie && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
          RC
        </span>
      )}
    </span>
  )

  return (
    <main className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-emerald-900 via-gray-900 to-blue-900 py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image src="/DCM Logo white.png" alt="DCM" width={40} height={40} />
            <h1 className="text-3xl md:text-4xl font-bold text-white">Sports Card Database</h1>
          </div>
          <p className="text-center text-gray-300 max-w-2xl mx-auto mb-8">
            Browse sports card sets and players across baseball, basketball, football, hockey, and more.
            Compare Ungraded, Grade 9, and PSA 10 market values — then grade your cards with DCM.
          </p>

          {/* Database Stats */}
          <div className="max-w-4xl mx-auto bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">
                  {setsPagination.total.toLocaleString()}
                </div>
                <div className="text-xs md:text-sm text-gray-400">Card Sets</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">{filterOptions.sports.length || '—'}</div>
                <div className="text-xs md:text-sm text-gray-400">Sports</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-emerald-400">
                  {filterOptions.years.length > 0 ? `${filterOptions.years[filterOptions.years.length - 1]}+` : '—'}
                </div>
                <div className="text-xs md:text-sm text-gray-400">Years of Cards</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">100%</div>
                <div className="text-xs md:text-sm text-gray-400">Market Data</div>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-gray-300 text-sm text-center leading-relaxed">
                <span className="text-emerald-400 font-semibold">How DCM Identifies Your Cards:</span> When you upload a
                sports card for grading, DCM&apos;s AI cross-references this database using set, player name, card number,
                and parallel details to ensure accurate identification. Every parallel and serial-numbered variant is
                tracked with SportsCardsPro market pricing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {dbEmpty ? (
        /* Empty-DB state: import hasn't run yet */
        <section className="container mx-auto px-4 py-24 text-center">
          <div className="text-6xl mb-6">🏗️</div>
          <h2 className="text-2xl font-semibold text-white mb-3">Sports card database is being built — check back soon</h2>
          <p className="text-gray-400 max-w-xl mx-auto mb-8">
            We&apos;re importing set checklists and market pricing for millions of sports cards across baseball,
            basketball, football, hockey, and more. In the meantime, you can still grade any sports card.
          </p>
          <Link
            href={getGradeCtaLink()}
            className="inline-block bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold px-8 py-3 rounded-xl hover:from-emerald-500 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20"
          >
            {getGradeCtaText()}
          </Link>
        </section>
      ) : !isCardsView ? (
        /* ============================== SETS VIEW ============================== */
        <>
          {/* Search Intro */}
          <section className="bg-gray-900 py-6">
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-xl font-semibold text-white mb-2">Browse Sets or Search Players</h2>
              <p className="text-gray-400 max-w-lg mx-auto text-sm">
                Pick a set to see its full checklist with parallels and pricing, or search for a player across every set.
              </p>
            </div>
          </section>

          {/* Filter Bar */}
          <section className="bg-gray-800 border-b border-gray-700 md:sticky md:top-0 z-30">
            <div className="container mx-auto px-4 py-3 md:py-4">
              {/* Mobile: searches + filter toggle */}
              <div className="flex flex-col gap-2 md:hidden">
                <input
                  type="text"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  placeholder="Search players (all sets)..."
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={setQuery}
                    onChange={(e) => setSetQuery(e.target.value)}
                    placeholder="Search sets (e.g. 1986 Fleer)..."
                    className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                    className={`px-3 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      showMobileFilters || activeSetFilterCount > 0
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <span className="text-sm">Filters</span>
                    {activeSetFilterCount > 0 && (
                      <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">{activeSetFilterCount}</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Mobile: collapsible filters */}
              <div className={`md:hidden overflow-hidden transition-all duration-300 ${showMobileFilters ? 'max-h-80 mt-3' : 'max-h-0'}`}>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Sport</label>
                    <select
                      value={sportFilter}
                      onChange={(e) => setSportFilter(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm capitalize"
                    >
                      <option value="">All</option>
                      {filterOptions.sports.map((s) => (
                        <option key={s} value={s} className="capitalize">{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Brand</label>
                    <select
                      value={manufacturerFilter}
                      onChange={(e) => setManufacturerFilter(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                    >
                      <option value="">All</option>
                      {filterOptions.manufacturers.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Year</label>
                    <select
                      value={yearFilter}
                      onChange={(e) => setYearFilter(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                    >
                      <option value="">All</option>
                      {filterOptions.years.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {(setQuery || activeSetFilterCount > 0) && (
                  <button
                    onClick={() => {
                      setSetQuery('')
                      setSportFilter('')
                      setManufacturerFilter('')
                      setYearFilter('')
                      setShowMobileFilters(false)
                    }}
                    className="mt-2 w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors text-sm"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>

              {/* Desktop: all filters in a row */}
              <div className="hidden md:flex md:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Player Search (all sets)</label>
                  <input
                    type="text"
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    placeholder="e.g. LeBron James, Mike Trout"
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Set Name</label>
                  <input
                    type="text"
                    value={setQuery}
                    onChange={(e) => setSetQuery(e.target.value)}
                    placeholder="e.g. 1986 Fleer, Prizm"
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="w-40">
                  <label className="block text-xs text-gray-400 mb-1">Sport</label>
                  <select
                    value={sportFilter}
                    onChange={(e) => setSportFilter(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors capitalize"
                  >
                    <option value="">All Sports</option>
                    {filterOptions.sports.map((s) => (
                      <option key={s} value={s} className="capitalize">{s}</option>
                    ))}
                  </select>
                </div>
                <div className="w-44">
                  <label className="block text-xs text-gray-400 mb-1">Manufacturer</label>
                  <select
                    value={manufacturerFilter}
                    onChange={(e) => setManufacturerFilter(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="">All Brands</option>
                    {filterOptions.manufacturers.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <label className="block text-xs text-gray-400 mb-1">Year</label>
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="">All</option>
                    {filterOptions.years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                {(setQuery || activeSetFilterCount > 0) && (
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setSetQuery('')
                        setSportFilter('')
                        setManufacturerFilter('')
                        setYearFilter('')
                      }}
                      className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Results count */}
              <div className="mt-2 md:mt-3 text-sm text-gray-400">
                {isLoadingSets ? (
                  'Loading sets...'
                ) : (
                  <>
                    <span className="text-white font-medium">{setsPagination.total.toLocaleString()}</span> sets
                    {sportFilter && <span className="capitalize"> in {sportFilter}</span>}
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Sets Grid */}
          <section className="container mx-auto px-4 py-8">
            {isLoadingSets ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-gray-800 rounded-lg h-20" />
                ))}
              </div>
            ) : sets.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🏟️</div>
                <h2 className="text-xl font-semibold text-white mb-2">No Sets Found</h2>
                <p className="text-gray-400">Try adjusting your filters or search a different set name.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sets.map((set) => (
                    <button
                      key={set.uid}
                      onClick={() => openSet(set)}
                      className="group text-left bg-gray-800 rounded-lg border border-gray-700 hover:border-emerald-500 transition-all hover:shadow-xl hover:shadow-emerald-500/10 p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <h3 className="text-white font-medium text-sm truncate group-hover:text-emerald-400 transition-colors">
                          {setDisplayName(set)}
                        </h3>
                        <p className="text-gray-500 text-xs mt-1">
                          {(set.product_count || 0).toLocaleString()} cards
                        </p>
                      </div>
                      {set.sport && (
                        <span className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 capitalize font-medium">
                          {set.sport}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Sets pagination */}
                {setsPagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <button
                      onClick={() => fetchSets(setsPagination.page - 1)}
                      disabled={setsPagination.page <= 1}
                      className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-gray-400 px-4">
                      Page {setsPagination.page} of {setsPagination.totalPages}
                    </span>
                    <button
                      onClick={() => fetchSets(setsPagination.page + 1)}
                      disabled={setsPagination.page >= setsPagination.totalPages}
                      className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      ) : (
        /* ============================== CARDS VIEW ============================== */
        <>
          {/* Cards header + filters */}
          <section className="bg-gray-800 border-b border-gray-700 md:sticky md:top-0 z-30">
            <div className="container mx-auto px-4 py-3 md:py-4">
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="flex-1 min-w-0">
                  <button
                    onClick={backToSets}
                    className="text-emerald-400 hover:text-emerald-300 text-sm transition-colors mb-1 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    All Sets
                  </button>
                  <h2 className="text-lg md:text-xl font-semibold text-white truncate">
                    {selectedSet ? setDisplayName(selectedSet) : `Player search: “${debouncedPlayer}”`}
                  </h2>
                </div>
                <div className="w-full md:w-64">
                  <label className="block text-xs text-gray-400 mb-1">Player Name</label>
                  <input
                    type="text"
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    placeholder={selectedSet ? 'Filter this set...' : 'Search players...'}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="w-full md:w-32">
                  <label className="block text-xs text-gray-400 mb-1">Card #</label>
                  <input
                    type="text"
                    value={cardNumberSearch}
                    onChange={(e) => setCardNumberSearch(e.target.value)}
                    placeholder="e.g. 57"
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                  />
                </div>
                <Link
                  href={getGradeCtaLink()}
                  className="shrink-0 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-semibold px-5 py-2.5 rounded-lg hover:from-emerald-500 hover:to-teal-400 transition-all text-center shadow-lg shadow-emerald-500/20"
                >
                  {getGradeCtaText()}
                </Link>
              </div>

              {/* Results count */}
              <div className="mt-2 md:mt-3 text-sm text-gray-400">
                {isLoadingCards ? (
                  'Searching...'
                ) : (
                  <>
                    Found <span className="text-white font-medium">{cardsPagination.total.toLocaleString()}</span> cards
                    <span className="text-gray-500"> (parallels grouped under their base card)</span>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Cards list */}
          <section className="container mx-auto px-4 py-8">
            {isLoadingCards ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-gray-800 rounded-lg h-14" />
                ))}
              </div>
            ) : cardsUnavailable ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🏆</div>
                <h2 className="text-xl font-semibold text-white mb-2">Full checklist on SportsCardsPro</h2>
                <p className="text-gray-400 max-w-md mx-auto mb-5">
                  Card-level listings and live prices for this set are available on SportsCardsPro.
                </p>
                <a
                  href={selectedSet
                    ? `https://www.sportscardspro.com/console/${selectedSet.slug}`
                    : `https://www.sportscardspro.com/search-products?q=${encodeURIComponent(debouncedPlayer)}&type=prices`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                >
                  View on SportsCardsPro
                </a>
              </div>
            ) : cards.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🏆</div>
                <h2 className="text-xl font-semibold text-white mb-2">No Cards Found</h2>
                <p className="text-gray-400">Try a different player name or card number.</p>
              </div>
            ) : (
              <>
                {/* Column headers */}
                <div className="hidden sm:flex items-center gap-3 px-4 pb-2 text-[10px] text-gray-500 uppercase tracking-wide">
                  <div className="flex-1">Card</div>
                  <div className="w-20 sm:w-24 text-right">Ungraded</div>
                  <div className="w-20 sm:w-24 text-right">Grade 9</div>
                  <div className="w-20 sm:w-24 text-right">PSA 10</div>
                  <div className="w-24" />
                </div>

                <div className="space-y-2">
                  {cardGroups.map((group) => {
                    const isExpanded = expandedGroups.has(group.key)
                    return (
                      <div key={group.key} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                        {/* Primary (base) row */}
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-medium text-sm truncate">
                                {group.base.player_name || group.base.product_name}
                              </span>
                              {group.base.card_number && (
                                <span className="text-gray-500 text-xs">#{group.base.card_number}</span>
                              )}
                              {renderBadges(group.base)}
                            </div>
                            {!selectedSet && (
                              <p className="text-gray-500 text-xs truncate mt-0.5">{group.base.console_name}</p>
                            )}
                          </div>
                          {renderPriceCells(group.base)}
                          <div className="w-24 text-right">
                            {group.parallels.length > 0 ? (
                              <button
                                onClick={() => toggleGroup(group.key)}
                                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
                              >
                                {isExpanded ? 'Hide' : `+${group.parallels.length} parallel${group.parallels.length > 1 ? 's' : ''}`}
                              </button>
                            ) : (
                              <span className="text-gray-700 text-xs">—</span>
                            )}
                          </div>
                        </div>

                        {/* Parallel rows */}
                        {isExpanded && group.parallels.map((parallel) => (
                          <div
                            key={parallel.id}
                            className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-700/60 bg-gray-800/50"
                          >
                            <div className="flex-1 min-w-0 pl-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-gray-300 text-sm truncate">
                                  {parallel.player_name || parallel.product_name}
                                </span>
                                {parallel.card_number && (
                                  <span className="text-gray-600 text-xs">#{parallel.card_number}</span>
                                )}
                                {renderBadges(parallel)}
                              </div>
                            </div>
                            {renderPriceCells(parallel)}
                            <div className="w-24" />
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>

                {/* Cards pagination */}
                {cardsPagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <button
                      onClick={() => fetchCards(cardsPagination.page - 1)}
                      disabled={cardsPagination.page <= 1}
                      className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-gray-400 px-4">
                      Page {cardsPagination.page} of {cardsPagination.totalPages}
                    </span>
                    <button
                      onClick={() => fetchCards(cardsPagination.page + 1)}
                      disabled={cardsPagination.page >= cardsPagination.totalPages}
                      className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      {/* Footer */}
      <footer className="py-8 bg-gray-900 border-t border-gray-800">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Market data from SportsCardsPro. Grade 9 values are cross-company aggregates; PSA 10 values are PSA-specific.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/upload/sports" className="hover:text-gray-300 transition-colors">Grade Cards</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
