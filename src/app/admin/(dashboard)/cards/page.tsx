'use client'

import { useState, useEffect } from 'react'
import AdminAuthGuard from '@/components/admin/AdminAuthGuard'
import Link from 'next/link'
import Image from 'next/image'

interface Card {
  id: string
  user_id: string
  user_email: string
  serial: string
  card_name: string | null
  category: string | null
  conversational_decimal_grade: number | null
  conversational_whole_grade: number | null
  conversational_condition_label: string | null
  conversational_card_info: any
  conversational_grading: any
  ai_grading: any
  featured: string | null
  pokemon_featured: string | null
  card_set: string | null
  release_date: string | null
  manufacturer_name: string | null
  card_number: string | null
  front_path: string
  back_path: string | null
  front_url: string | null
  visibility: 'public' | 'private'
  is_featured: boolean
  created_at: string
  dvg_decimal_grade: number | null
  dcm_grade_whole: number | null
  grade_numeric: number | null
  ebay_price_median: number | null
  ebay_price_listing_count: number | null
  ebay_price_updated_at: string | null
  is_foil: boolean | null
  scryfall_price_usd: number | null
  scryfall_price_usd_foil: number | null
}

interface PaginationData {
  page: number
  limit: number
  total: number
  total_pages: number
}

interface StatsData {
  total: number
  graded: number
  byCategory: Record<string, number>
}

type SortColumn = 'name' | 'series' | 'year' | 'grade' | 'date' | 'price' | 'visibility'

// Helper functions - EXACT MATCH to My Collection page logic
const stripMarkdown = (text: string | null | undefined): string | null => {
  if (!text) return null
  return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\#/g, '').replace(/\_/g, '')
}

// Build card info object (matches collection page)
const getCardInfo = (card: Card) => {
  const dvgGrading = card.ai_grading || {}
  // Legacy ai_grading uses "Card Information" (with spaces), newer uses card_info
  const legacyCardInfo = dvgGrading["Card Information"] || dvgGrading.card_info || {}
  return {
    card_name: stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || legacyCardInfo.card_name,
    player_or_character: stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || card.pokemon_featured || legacyCardInfo.player_or_character,
    set_name: stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || legacyCardInfo.set_name,
    year: stripMarkdown(card.conversational_card_info?.year) || card.release_date || legacyCardInfo.year,
    manufacturer: stripMarkdown(card.conversational_card_info?.manufacturer) || card.manufacturer_name || legacyCardInfo.manufacturer,
    card_number: stripMarkdown(card.conversational_card_info?.card_number_raw) || stripMarkdown(card.conversational_card_info?.card_number) || card.card_number || legacyCardInfo.card_number,
  }
}

const getPlayerName = (card: Card) => {
  const cardInfo = getCardInfo(card)
  // For sports cards AND Other cards: show player/character name first
  // For TCG cards (MTG, Pokemon, Lorcana): show card name first
  const isSportsCard = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'].includes(card.category || '')
  const isOtherCard = card.category === 'Other'
  return (isSportsCard || isOtherCard)
    ? (cardInfo.player_or_character || cardInfo.card_name || 'Unknown')
    : (cardInfo.card_name || cardInfo.player_or_character || 'Unknown Card')
}

const getCardSet = (card: Card) => {
  return getCardInfo(card).set_name || 'Unknown Set'
}

const getYear = (card: Card) => {
  return getCardInfo(card).year || 'N/A'
}

const getCardNumber = (card: Card) => {
  return getCardInfo(card).card_number || null
}

// Get grade with fallbacks (matches My Collection logic)
const getCardGrade = (card: Card): number | null => {
  // PRIMARY: Use conversational AI grade if available
  if (card.conversational_decimal_grade !== null && card.conversational_decimal_grade !== undefined) {
    return card.conversational_decimal_grade
  }
  // FALLBACK: DVG v1 grade
  if (card.dvg_decimal_grade !== null && card.dvg_decimal_grade !== undefined) {
    return card.dvg_decimal_grade
  }
  // LEGACY: Old grade fields
  if (card.dcm_grade_whole) return card.dcm_grade_whole
  if (card.grade_numeric) return card.grade_numeric
  return null
}

const formatGrade = (grade: number): string => {
  // v6.0: Always return whole number (no .5 grades)
  return Math.round(grade).toString()
}

// Format price for display
const formatPrice = (price: number | null | undefined): string | null => {
  if (price === null || price === undefined) return null
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price)
}

// Get market value (eBay median or Scryfall fallback)
const getMarketValue = (card: Card): number | null => {
  if (card.ebay_price_median !== null && card.ebay_price_median !== undefined) {
    return card.ebay_price_median
  }
  // Fallback to Scryfall price for MTG cards
  if (card.category === 'MTG') {
    if (card.is_foil && card.scryfall_price_usd_foil) {
      return card.scryfall_price_usd_foil
    }
    if (card.scryfall_price_usd) {
      return card.scryfall_price_usd
    }
  }
  return null
}

// Check if price is stale (>7 days old)
const isPriceStale = (updatedAt: string | null | undefined): boolean => {
  if (!updatedAt) return true
  const updated = new Date(updatedAt)
  const now = new Date()
  const diffDays = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays > 7
}

// Category badge colors
const getCategoryBadge = (category: string | null) => {
  const categoryConfig: Record<string, { bg: string; text: string; label: string }> = {
    'Football': { bg: 'bg-orange-100', text: 'text-orange-800', label: '🏈 Football' },
    'Baseball': { bg: 'bg-red-100', text: 'text-red-800', label: '⚾ Baseball' },
    'Basketball': { bg: 'bg-amber-100', text: 'text-amber-800', label: '🏀 Basketball' },
    'Hockey': { bg: 'bg-sky-100', text: 'text-sky-800', label: '🏒 Hockey' },
    'Soccer': { bg: 'bg-green-100', text: 'text-green-800', label: '⚽ Soccer' },
    'Wrestling': { bg: 'bg-purple-100', text: 'text-purple-800', label: '🤼 Wrestling' },
    'Sports': { bg: 'bg-blue-100', text: 'text-blue-800', label: '🏆 Sports' },
    'Pokemon': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '⚡ Pokemon' },
    'MTG': { bg: 'bg-indigo-100', text: 'text-indigo-800', label: '🎴 MTG' },
    'Lorcana': { bg: 'bg-pink-100', text: 'text-pink-800', label: '✨ Lorcana' },
    'Other': { bg: 'bg-gray-100', text: 'text-gray-800', label: '📦 Other' },
  }
  return categoryConfig[category || ''] || { bg: 'bg-gray-100', text: 'text-gray-600', label: category || 'Unknown' }
}

export default function AdminCardsPage() {
  return (
    <AdminAuthGuard>
      {(admin) => <CardsContent />}
    </AdminAuthGuard>
  )
}

function CardsContent() {
  const [cards, setCards] = useState<Card[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 50,
    total: 0,
    total_pages: 0
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [graded, setGraded] = useState<'all' | 'graded' | 'ungraded'>('all')
  const [featured, setFeatured] = useState<'all' | 'featured' | 'not_featured'>('all')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null)
  const [deleteCardName, setDeleteCardName] = useState<string>('')
  const [deleteReason, setDeleteReason] = useState('')
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null)

  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Selection state for bulk actions
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set())
  const [regeneratingLabels, setRegeneratingLabels] = useState(false)
  const [regenerateResult, setRegenerateResult] = useState<{ success: number; errors: number } | null>(null)

  // Handle column sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  useEffect(() => {
    fetchCards()
  }, [pagination.page, search, category, graded, featured, sortColumn, sortDirection])

  const fetchCards = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search,
        category,
        graded,
        featured,
        sortBy: sortColumn,
        sortOrder: sortDirection,
      })

      const response = await fetch(`/api/admin/cards?${params}`)
      const data = await response.json()

      if (response.ok) {
        setCards(data.cards)
        setPagination(data.pagination)
        if (data.stats) {
          setStats(data.stats)
        }
      }
    } catch (error) {
      console.error('Error fetching cards:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCard = async () => {
    if (!deleteCardId || !deleteReason.trim()) {
      alert('Please provide a reason for deletion')
      return
    }

    setDeletingCardId(deleteCardId)

    try {
      const response = await fetch(
        `/api/admin/cards/${deleteCardId}?reason=${encodeURIComponent(deleteReason)}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        alert('Card deleted successfully')
        setShowDeleteModal(false)
        setDeleteCardId(null)
        setDeleteCardName('')
        setDeleteReason('')
        fetchCards()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete card')
      }
    } catch (error) {
      console.error('Error deleting card:', error)
      alert('Failed to delete card')
    } finally {
      setDeletingCardId(null)
    }
  }

  const openDeleteModal = (cardId: string, cardName: string) => {
    setDeleteCardId(cardId)
    setDeleteCardName(cardName)
    setShowDeleteModal(true)
  }

  // Selection handlers
  const toggleCardSelection = (cardId: string) => {
    setSelectedCards(prev => {
      const newSet = new Set(prev)
      if (newSet.has(cardId)) {
        newSet.delete(cardId)
      } else {
        newSet.add(cardId)
      }
      return newSet
    })
  }

  const selectAllOnPage = () => {
    const allIds = cards.map(c => c.id)
    setSelectedCards(new Set(allIds))
  }

  const clearSelection = () => {
    setSelectedCards(new Set())
  }

  // Regenerate labels for selected cards
  const handleRegenerateLabels = async () => {
    if (selectedCards.size === 0) {
      alert('Please select at least one card')
      return
    }

    setRegeneratingLabels(true)
    setRegenerateResult(null)

    let success = 0
    let errors = 0

    for (const cardId of selectedCards) {
      try {
        const response = await fetch(`/api/admin/cards/${cardId}/regenerate-label`, {
          method: 'POST'
        })
        if (response.ok) {
          success++
        } else {
          errors++
        }
      } catch {
        errors++
      }
    }

    setRegenerateResult({ success, errors })
    setRegeneratingLabels(false)

    // Clear selection after successful regeneration
    if (errors === 0) {
      setSelectedCards(new Set())
    }
  }

  const handleToggleFeatured = async (cardId: string, currentFeatured: boolean) => {
    try {
      const response = await fetch(`/api/admin/cards/${cardId}/featured`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_featured: !currentFeatured })
      })

      if (response.ok) {
        // Update local state
        setCards(cards.map(card =>
          card.id === cardId ? { ...card, is_featured: !currentFeatured } : card
        ))
      } else {
        alert('Failed to update featured status')
      }
    } catch (error) {
      console.error('Error toggling featured status:', error)
      alert('Failed to update featured status')
    }
  }

  return (
    <div className="p-6">
      {/* Header with Stats */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Card Management</h1>
        <p className="text-gray-600 mb-4">View and manage all graded cards across the platform</p>

        {/* Quick Stats Bar */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-lg shadow p-3 border-l-4 border-purple-500">
              <div className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</div>
              <div className="text-xs text-gray-500 uppercase">Total Cards</div>
            </div>
            <div className="bg-white rounded-lg shadow p-3 border-l-4 border-green-500">
              <div className="text-2xl font-bold text-gray-900">{stats.graded.toLocaleString()}</div>
              <div className="text-xs text-gray-500 uppercase">Graded</div>
            </div>
            {Object.entries(stats.byCategory).slice(0, 4).map(([cat, count]) => {
              const badge = getCategoryBadge(cat)
              return (
                <div key={cat} className={`bg-white rounded-lg shadow p-3 border-l-4 ${badge.bg.replace('bg-', 'border-').replace('-100', '-500')}`}>
                  <div className="text-2xl font-bold text-gray-900">{count.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 uppercase">{cat}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, set, manufacturer, card number..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="Football">🏈 Football</option>
              <option value="Baseball">⚾ Baseball</option>
              <option value="Basketball">🏀 Basketball</option>
              <option value="Hockey">🏒 Hockey</option>
              <option value="Soccer">⚽ Soccer</option>
              <option value="Pokemon">⚡ Pokemon</option>
              <option value="MTG">🎴 MTG</option>
              <option value="Lorcana">✨ Lorcana</option>
              <option value="Other">📦 Other</option>
            </select>
          </div>

          {/* Graded Filter */}
          <div>
            <select
              value={graded}
              onChange={(e) => {
                setGraded(e.target.value as 'all' | 'graded' | 'ungraded')
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Cards</option>
              <option value="graded">Graded Only</option>
              <option value="ungraded">Ungraded Only</option>
            </select>
          </div>

          {/* Featured Filter */}
          <div>
            <select
              value={featured}
              onChange={(e) => {
                setFeatured(e.target.value as 'all' | 'featured' | 'not_featured')
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Featured Status</option>
              <option value="featured">⭐ Featured Only</option>
              <option value="not_featured">Not Featured</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedCards.size > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-purple-800 font-medium">
              {selectedCards.size} card{selectedCards.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={clearSelection}
              className="text-sm text-purple-600 hover:text-purple-800 underline"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRegenerateLabels}
              disabled={regeneratingLabels}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {regeneratingLabels ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Regenerating...
                </>
              ) : (
                'Regenerate Labels'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Regenerate Result */}
      {regenerateResult && (
        <div className={`rounded-lg p-4 mb-4 ${regenerateResult.errors > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
          <p className={regenerateResult.errors > 0 ? 'text-yellow-800' : 'text-green-800'}>
            Labels regenerated: {regenerateResult.success} success, {regenerateResult.errors} errors
          </p>
          <button
            onClick={() => setRegenerateResult(null)}
            className="text-sm underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Cards Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-purple-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading cards...
        </div>
      ) : cards.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No cards found</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {/* Checkbox */}
                  <th className="w-[3%] px-2 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={cards.length > 0 && cards.every(c => selectedCards.has(c.id))}
                      onChange={(e) => e.target.checked ? selectAllOnPage() : clearSelection()}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                      title="Select all on page"
                    />
                  </th>
                  {/* Thumbnail */}
                  <th className="w-[5%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Image
                  </th>
                  {/* Category */}
                  <th className="w-[8%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  {/* Card Name - Sortable */}
                  <th
                    onClick={() => handleSort('name')}
                    className="w-[16%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Card Name
                      {sortColumn === 'name' && (
                        <span className="text-purple-600">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  {/* Set - Sortable */}
                  <th
                    onClick={() => handleSort('series')}
                    className="w-[14%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Set
                      {sortColumn === 'series' && (
                        <span className="text-purple-600">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  {/* Card # */}
                  <th className="w-[7%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Card #
                  </th>
                  {/* Year - Sortable */}
                  <th
                    onClick={() => handleSort('year')}
                    className="w-[5%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Year
                      {sortColumn === 'year' && (
                        <span className="text-purple-600">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  {/* Grade - Sortable */}
                  <th
                    onClick={() => handleSort('grade')}
                    className="w-[7%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Grade
                      {sortColumn === 'grade' && (
                        <span className="text-purple-600">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  {/* Value - Sortable */}
                  <th
                    onClick={() => handleSort('price')}
                    className="w-[7%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Value
                      {sortColumn === 'price' && (
                        <span className="text-purple-600">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  {/* Date - Sortable */}
                  <th
                    onClick={() => handleSort('date')}
                    className="w-[6%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Date
                      {sortColumn === 'date' && (
                        <span className="text-purple-600">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  {/* User */}
                  <th className="w-[10%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  {/* Featured */}
                  <th className="w-[4%] px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ⭐
                  </th>
                  {/* Actions */}
                  <th className="w-[8%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cards.map((card) => {
                  // Get category route for link
                  const categoryRoutes: Record<string, string> = {
                    'Football': '/sports',
                    'Baseball': '/sports',
                    'Basketball': '/sports',
                    'Hockey': '/sports',
                    'Soccer': '/sports',
                    'Wrestling': '/sports',
                    'Sports': '/sports',
                    'Pokemon': '/pokemon',
                    'MTG': '/mtg',
                    'Lorcana': '/lorcana',
                    'Other': '/other'
                  }
                  const route = categoryRoutes[card.category || ''] || '/other'
                  const badge = getCategoryBadge(card.category)
                  const grade = getCardGrade(card)
                  const marketValue = getMarketValue(card)
                  const cardNumber = getCardNumber(card)

                  return (
                    <tr key={card.id} className={`hover:bg-gray-50 transition-colors ${selectedCards.has(card.id) ? 'bg-purple-50' : ''}`}>
                      {/* Checkbox */}
                      <td className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCards.has(card.id)}
                          onChange={() => toggleCardSelection(card.id)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
                      {/* Thumbnail */}
                      <td className="px-2 py-2">
                        <div className="w-10 h-14 relative rounded overflow-hidden bg-gray-100 flex-shrink-0">
                          {card.front_url ? (
                            <Image
                              src={card.front_url}
                              alt={getPlayerName(card)}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                              No img
                            </div>
                          )}
                        </div>
                      </td>
                      {/* Category Badge */}
                      <td className="px-2 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </td>
                      {/* Card Name */}
                      <td className="px-2 py-3">
                        <div className="text-sm font-medium text-gray-900 truncate" title={getPlayerName(card)}>
                          {getPlayerName(card)}
                        </div>
                      </td>
                      {/* Set */}
                      <td className="px-2 py-3">
                        <div className="text-sm text-gray-600 truncate" title={getCardSet(card)}>
                          {getCardSet(card)}
                        </div>
                      </td>
                      {/* Card # */}
                      <td className="px-2 py-3">
                        <div className="text-sm text-gray-600 font-mono">
                          {cardNumber || '-'}
                        </div>
                      </td>
                      {/* Year */}
                      <td className="px-2 py-3">
                        <div className="text-sm text-gray-600">
                          {getYear(card)}
                        </div>
                      </td>
                      {/* Grade with fallback */}
                      <td className="px-2 py-3">
                        {grade !== null ? (
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-100 text-purple-800 font-bold text-sm">
                              {formatGrade(grade)}
                            </span>
                            {card.conversational_condition_label && (
                              <span className="text-xs text-gray-500 truncate max-w-[60px]" title={card.conversational_condition_label.replace(/\s*\([A-Z]+\)/, '')}>
                                {card.conversational_condition_label.replace(/\s*\([A-Z]+\)/, '').split(' ')[0]}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      {/* Market Value */}
                      <td className="px-2 py-3">
                        {marketValue !== null ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-green-700">
                              {formatPrice(marketValue)}
                            </span>
                            {isPriceStale(card.ebay_price_updated_at) && (
                              <span className="text-[10px] text-yellow-600" title="Price data is over 7 days old">
                                ⚠ stale
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      {/* Date */}
                      <td className="px-2 py-3">
                        <div className="text-xs text-gray-500">
                          {card.created_at ? new Date(card.created_at).toLocaleDateString() : '-'}
                        </div>
                      </td>
                      {/* User */}
                      <td className="px-2 py-3">
                        <div className="text-xs text-gray-600 truncate" title={card.user_email}>
                          {card.user_email.split('@')[0]}
                        </div>
                      </td>
                      {/* Featured */}
                      <td className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={card.is_featured || false}
                          onChange={() => handleToggleFeatured(card.id, card.is_featured || false)}
                          className="w-4 h-4 text-yellow-500 border-gray-300 rounded focus:ring-yellow-400 cursor-pointer"
                          title="Feature this card on the home page"
                        />
                      </td>
                      {/* Actions */}
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`${route}/${card.id}`}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                            title="View card details"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => openDeleteModal(card.id, getPlayerName(card))}
                            disabled={deletingCardId === card.id}
                            className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            title="Delete card"
                          >
                            {deletingCardId === card.id ? '...' : 'Del'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-medium">{pagination.total}</span> cards
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.total_pages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Delete Card</h2>
            <p className="text-gray-600 mb-2">
              This will permanently delete <strong>{deleteCardName}</strong>. This action cannot be undone.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for deletion (required):
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                rows={3}
                placeholder="Enter reason for deletion..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteCardId(null)
                  setDeleteCardName('')
                  setDeleteReason('')
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCard}
                disabled={deletingCardId !== null}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingCardId ? 'Deleting...' : 'Delete Card'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
