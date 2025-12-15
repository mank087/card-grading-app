'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getStoredSession } from '../../lib/directAuth'
import { getConditionFromGrade } from '@/lib/conditionAssessment'
import { CardSlabGrid } from '@/components/CardSlab'
import { getCardLabelData } from '@/lib/useLabelData'
import { useToast } from '@/hooks/useToast'

type Card = {
  id: string
  serial: string
  front_path: string
  back_path: string
  front_url?: string | null  // 🎯 Signed URL from API
  back_url?: string | null   // 🎯 Signed URL from API
  card_name?: string
  featured?: string  // 🎯 Player/character name
  category?: string
  card_set?: string
  manufacturer_name?: string  // 🎯 Manufacturer
  release_date?: string  // 🎯 Year
  card_number?: string  // 🎯 Card number
  grade_numeric?: number
  ai_confidence_score?: string
  ai_grading?: any
  dcm_grade_whole?: number
  dvg_image_quality?: string
  created_at?: string
  visibility?: 'public' | 'private'
  // 🎯 PRIMARY: Conversational AI grading (2025-10-21)
  conversational_decimal_grade?: number | null
  conversational_whole_grade?: number | null
  conversational_image_confidence?: string | null
  conversational_condition_label?: string | null
  conversational_card_info?: any  // JSON field containing card details
  dvg_decimal_grade?: number | null
  // 🎯 Unified label data (pre-generated)
  label_data?: any
  // 🃏 MTG Scryfall API fields
  is_foil?: boolean
  foil_type?: string | null
  is_double_faced?: boolean
  mtg_api_verified?: boolean
  mtg_rarity?: string | null
  mtg_set_code?: string | null
  card_language?: string | null
  scryfall_price_usd?: number | null
  scryfall_price_usd_foil?: number | null
}

// 🎯 Helper: Strip markdown formatting from text
const stripMarkdown = (text: string | null | undefined): string | null => {
  if (!text) return null;
  return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\#/g, '').replace(/\_/g, '');
};

// 🎯 Helper: Build card info object (matches detail page logic from line 1999)
const getCardInfo = (card: Card) => {
  const dvgGrading = card.ai_grading || {};
  const setNameRaw = stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || dvgGrading.card_info?.set_name;
  const subset = stripMarkdown(card.conversational_card_info?.subset) || card.subset || dvgGrading.card_info?.subset;
  // Combine set name with subset if available (matching foldable label format)
  const setNameWithSubset = subset ? `${setNameRaw} - ${subset}` : setNameRaw;
  return {
    card_name: stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || dvgGrading.card_info?.card_name,
    player_or_character: stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || dvgGrading.card_info?.player_or_character,
    set_name: setNameWithSubset,
    year: stripMarkdown(card.conversational_card_info?.year) || card.release_date || dvgGrading.card_info?.year,
    manufacturer: stripMarkdown(card.conversational_card_info?.manufacturer) || card.manufacturer_name || dvgGrading.card_info?.manufacturer,
    card_number: stripMarkdown(card.conversational_card_info?.card_number_raw) || stripMarkdown(card.conversational_card_info?.card_number) || card.card_number || dvgGrading.card_info?.card_number,
    serial_number: stripMarkdown(card.conversational_card_info?.serial_number) || dvgGrading.card_info?.serial_number,
    rookie_or_first: card.conversational_card_info?.rookie_or_first || dvgGrading.card_info?.rookie_or_first,
    subset: subset, // Keep separate for special features display
    autographed: card.conversational_card_info?.autographed || false,
    facsimile_autograph: card.conversational_card_info?.facsimile_autograph || false,
    official_reprint: card.conversational_card_info?.official_reprint || false,
    special_features: card.conversational_card_info?.special_features || null,
  };
};

// 🎯 Helper functions - Use cardInfo object (maintained for sorting compatibility)
const getCardName = (card: Card) => {
  return getCardInfo(card).card_name || 'Unknown Card';
};

const getPlayerName = (card: Card) => {
  const cardInfo = getCardInfo(card);
  // For sports cards AND Other cards: show player/character name first (primary subject)
  // For TCG cards (MTG, Pokemon, Lorcana): show card name first
  const isSportsCard = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'].includes(card.category || '');
  const isOtherCard = card.category === 'Other';
  // Other cards prioritize player_or_character (person, character, or subject featured)
  return (isSportsCard || isOtherCard)
    ? (cardInfo.player_or_character || cardInfo.card_name || 'Unknown')
    : (cardInfo.card_name || cardInfo.player_or_character || 'Unknown Card');
};

const getCardSet = (card: Card) => {
  return getCardInfo(card).set_name || 'Unknown Set';
};

const getManufacturer = (card: Card) => {
  return getCardInfo(card).manufacturer || 'Unknown';
};

const getYear = (card: Card) => {
  return getCardInfo(card).year || 'N/A';
};

const getCardGrade = (card: Card) => {
  // 🎯 PRIMARY: Use conversational AI grade if available
  if (card.conversational_decimal_grade !== null && card.conversational_decimal_grade !== undefined) {
    return card.conversational_decimal_grade;
  }
  // FALLBACK: DVG v1 grade
  if (card.dvg_decimal_grade !== null && card.dvg_decimal_grade !== undefined) {
    return card.dvg_decimal_grade;
  }
  // LEGACY: Old grade fields
  if (card.dcm_grade_whole) return card.dcm_grade_whole;
  if (card.grade_numeric) return card.grade_numeric;
  return null;
};

// Format grade for display - v6.0: Always whole numbers
const formatGrade = (grade: number): string => {
  // v6.0: Always return whole number (no .5 grades)
  return Math.round(grade).toString();
};

const getGradeSource = (card: Card): 'conversational' | 'structured' | null => {
  // Determine which grading system was used
  if (card.conversational_decimal_grade !== null && card.conversational_decimal_grade !== undefined) {
    return 'conversational';
  }
  if (card.dvg_decimal_grade !== null && card.dvg_decimal_grade !== undefined) {
    return 'structured';
  }
  return null;
};

const getImageQualityGrade = (card: Card) => {
  // Match the exact logic from the detail page (line 2267, 3508)
  // 🎯 PRIMARY: Try conversational AI confidence first (current system)
  if (card.conversational_image_confidence) {
    return card.conversational_image_confidence;
  }
  // Try database column (for DVG v1 graded cards)
  if (card.dvg_image_quality) {
    return card.dvg_image_quality;
  }
  // Try DVG v1 format in ai_grading JSON
  if (card.ai_grading?.image_quality?.grade) {
    return card.ai_grading.image_quality.grade;
  }
  // Try old ai_confidence_score column
  if (card.ai_confidence_score) {
    return card.ai_confidence_score;
  }
  // Try old format in AI Confidence Assessment
  if (card.ai_grading?.["AI Confidence Assessment"]?.["Confidence Level"]) {
    const confidence = card.ai_grading["AI Confidence Assessment"]["Confidence Level"];
    // Map old confidence levels to letter grades
    if (confidence === "High") return "A";
    if (confidence === "Medium") return "B";
    if (confidence === "Low") return "C";
    if (confidence === "Very Low") return "D";
  }
  return null; // Return null if no confidence data available
};


const getCardLink = (card: Card) => {
  // Route to category-specific pages
  const sportCategories = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];

  // Sports cards → /sports/[id]
  if (card.category && sportCategories.includes(card.category)) {
    return `/sports/${card.id}`;
  }

  // Pokemon cards → /pokemon/[id] (uses conversational grading v4.2)
  if (card.category === 'Pokemon') {
    return `/pokemon/${card.id}`;
  }

  // MTG cards → /mtg/[id]
  if (card.category === 'MTG') {
    return `/mtg/${card.id}`;
  }

  // Lorcana cards → /lorcana/[id]
  if (card.category === 'Lorcana') {
    return `/lorcana/${card.id}`;
  }

  // Other cards → /other/[id]
  if (card.category === 'Other') {
    return `/other/${card.id}`;
  }

  // Default to general card page for other types
  return `/card/${card.id}`;
};

function CollectionPageContent() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [displayLimit, setDisplayLimit] = useState(20) // Initial display limit
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const searchQuery = searchParams?.get('search')
  const toast = useToast()


  useEffect(() => {
    const fetchCards = async () => {
      setLoading(true)
      setError(null)

      try {
        // Check for stored session from direct auth
        const session = getStoredSession()

        if (!session || !session.user) {
          setError('❌ You must be logged in to see your collection.')
          setLoading(false)
          return
        }

        const user = session.user

        // Call server-side API that creates signed URLs (same approach as card detail pages)
        // Pass the access token in Authorization header for secure authentication
        const url = `/api/cards/my-collection${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`
        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })

        if (!res.ok) {
          throw new Error('Failed to load cards.')
        }

        const { cards } = await res.json()
        setCards(cards || [])
      } catch (err) {
        console.error(err)
        setError('Failed to load cards. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    fetchCards()
  }, [searchQuery])

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column and default to ascending
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Sort cards based on current sort settings
  const sortedCards = [...cards].sort((a, b) => {
    if (!sortColumn) return 0

    let aValue: any
    let bValue: any

    switch (sortColumn) {
      case 'name':
        aValue = getPlayerName(a).toLowerCase()
        bValue = getPlayerName(b).toLowerCase()
        break
      case 'manufacturer':
        aValue = (getManufacturer(a) || '').toLowerCase()
        bValue = (getManufacturer(b) || '').toLowerCase()
        break
      case 'series':
        aValue = getCardSet(a).toLowerCase()
        bValue = getCardSet(b).toLowerCase()
        break
      case 'year':
        aValue = getYear(a) || ''
        bValue = getYear(b) || ''
        break
      case 'grade':
        aValue = getCardGrade(a) || 0
        bValue = getCardGrade(b) || 0
        break
      case 'date':
        aValue = a.created_at || ''
        bValue = b.created_at || ''
        break
      case 'visibility':
        aValue = a.visibility || 'private'
        bValue = b.visibility || 'private'
        break
      default:
        return 0
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  // Filter cards by selected category
  const filteredCards = sortedCards.filter(card => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'Sports') {
      // Include all sport categories
      return ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'].includes(card.category || '');
    }
    return card.category === selectedCategory;
  })

  // Limit displayed cards for performance
  const displayedCards = filteredCards.slice(0, displayLimit)
  const hasMore = filteredCards.length > displayLimit

  // Load more handler
  const loadMore = () => {
    setDisplayLimit(prev => prev + 20)
  }

  // Delete card handler
  const handleDeleteCard = async (cardId: string, cardName: string) => {
    // Confirmation dialog
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${cardName}"?\n\nThis action cannot be undone.`
    )

    if (!confirmDelete) {
      return
    }

    setDeletingCardId(cardId)

    try {
      // Get user session
      const session = getStoredSession()
      if (!session || !session.user || !session.access_token) {
        throw new Error('You must be logged in to delete cards')
      }

      const response = await fetch(`/api/cards/${cardId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete card')
      }

      // Remove card from local state
      setCards(prevCards => prevCards.filter(card => card.id !== cardId))

      // Show success message
      toast.success('Card deleted successfully!')
    } catch (error: any) {
      console.error('Delete error:', error)
      toast.error(`Failed to delete card: ${error.message}`)
    } finally {
      setDeletingCardId(null)
    }
  }

  if (loading) return <p className="p-6 text-center">Loading your collection...</p>
  if (error) {
    // Check if error is about not being logged in
    const isAuthError = error.includes('logged in');
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-6">{error}</p>
        {isAuthError && (
          <Link
            href="/login"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Login or Create Account
          </Link>
        )}
      </div>
    );
  }
  if (cards.length === 0) return <p className="p-6 text-center">You have not uploaded any cards yet.</p>

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Collection</h1>
            {searchQuery && (
              <p className="text-gray-600 mt-2">
                Search results for: "{searchQuery}"
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Grid view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="List view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            <div className="text-sm text-gray-500">
              {cards.length} card{cards.length !== 1 ? 's' : ''} found
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All Cards', icon: '🎴' },
            { id: 'Sports', label: 'Sports', icon: '⚾' },
            { id: 'Pokemon', label: 'Pokemon', icon: '⚡' },
            { id: 'MTG', label: 'Magic', icon: '🎴' },
            { id: 'Lorcana', label: 'Lorcana', icon: '✨' },
            { id: 'Other', label: 'Other', icon: '🃏' }
          ].map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedCategory === category.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="mr-2">{category.icon}</span>
              {category.label}
            </button>
          ))}
        </div>

        {/* Grid View */}
        {viewMode === 'grid' && (
          <>
            {filteredCards.length === 0 ? (
              <p className="p-6 text-center text-gray-600">
                {selectedCategory === 'all'
                  ? 'You have not uploaded any cards yet.'
                  : `You have no ${selectedCategory} cards in your collection.`}
              </p>
            ) : (
              <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {displayedCards.map((card) => {
              // 🎯 Use unified label data for consistent display
              const labelData = getCardLabelData(card);

              return (
                <CardSlabGrid
                  key={card.id}
                  displayName={labelData.primaryName}
                  setLineText={labelData.contextLine}
                  features={labelData.features}
                  serial={labelData.serial}
                  grade={labelData.grade}
                  condition={labelData.condition}
                  frontImageUrl={card.front_url || null}
                  isAlteredAuthentic={labelData.isAlteredAuthentic}
                  className="hover:shadow-xl transition-shadow duration-200"
                >
                  {/* Visibility Badge */}
                  <div className="relative">
                    <div className={`absolute -top-8 left-2 px-2 py-1 rounded-full text-xs font-semibold border-2 ${
                      card.visibility === 'public'
                        ? 'bg-green-100 text-green-800 border-green-500'
                        : 'bg-gray-100 text-gray-800 border-gray-400'
                    }`} title={card.visibility === 'public' ? 'This card is public (anyone can view)' : 'This card is private (only you can view)'}>
                      {card.visibility === 'public' ? '🌐 Public' : '🔒 Private'}
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
                </CardSlabGrid>
              );
                })}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="mt-8 text-center">
                  <button
                    onClick={loadMore}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition-colors"
                  >
                    Load More Cards ({filteredCards.length - displayLimit} remaining)
                  </button>
                </div>
              )}
              </>
            )}
          </>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <>
            {filteredCards.length === 0 ? (
              <p className="p-6 text-center text-gray-600">
                {selectedCategory === 'all'
                  ? 'You have not uploaded any cards yet.'
                  : `You have no ${selectedCategory} cards in your collection.`}
              </p>
            ) : (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed">
                    <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      onClick={() => handleSort('name')}
                      className="w-[28%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Card Name
                        {sortColumn === 'name' && (
                          <span className="text-indigo-600">
                            {sortDirection === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('series')}
                      className="w-[24%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Set
                        {sortColumn === 'series' && (
                          <span className="text-indigo-600">
                            {sortDirection === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('year')}
                      className="w-[8%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Year
                        {sortColumn === 'year' && (
                          <span className="text-indigo-600">
                            {sortDirection === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('grade')}
                      className="w-[12%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Grade
                        {sortColumn === 'grade' && (
                          <span className="text-indigo-600">
                            {sortDirection === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('date')}
                      className="w-[10%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Date
                        {sortColumn === 'date' && (
                          <span className="text-indigo-600">
                            {sortDirection === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('visibility')}
                      className="w-[8%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Status
                        {sortColumn === 'visibility' && (
                          <span className="text-indigo-600">
                            {sortDirection === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="w-[10%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayedCards.map((card) => (
                    <tr key={card.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3">
                        <div className="text-sm font-medium text-gray-900 truncate" title={getPlayerName(card)}>
                          {getPlayerName(card)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-sm text-gray-900 truncate" title={getCardSet(card)}>
                          {getCardSet(card)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-sm text-gray-900">
                          {getYear(card) || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {(() => {
                            const grade = getCardGrade(card);
                            const condition = card.conversational_condition_label
                              ? card.conversational_condition_label.replace(/\s*\([A-Z]+\)/, '')
                              : (grade ? getConditionFromGrade(grade) : '');

                            // Check if this is an Altered/Authentic card
                            const isAlteredAuthentic = card.conversational_condition_label &&
                              (card.conversational_condition_label.toLowerCase().includes('altered') ||
                               card.conversational_condition_label.toLowerCase().includes('authentic altered') ||
                               card.conversational_condition_label.includes('(AA)'));

                            return (
                              <div>
                                <span>{grade ? formatGrade(grade) : (isAlteredAuthentic ? 'A' : '-')}</span>
                                {(condition || isAlteredAuthentic) && (
                                  <div className="text-xs text-gray-500 truncate" title={isAlteredAuthentic && !grade ? 'Authentic' : condition}>
                                    {isAlteredAuthentic && !grade ? 'Authentic' : condition}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-sm text-gray-500">
                          {card.created_at ? new Date(card.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                          card.visibility === 'public'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {card.visibility === 'public' ? '🌐' : '🔒'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Link
                            href={getCardLink(card)}
                            className="text-purple-600 hover:text-purple-800 font-medium"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => handleDeleteCard(card.id, getPlayerName(card))}
                            disabled={deletingCardId === card.id}
                            className="text-red-500 hover:text-red-700 font-medium disabled:opacity-50 cursor-pointer"
                            title="Delete card"
                          >
                            {deletingCardId === card.id ? '...' : '✕'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load More Button for List View */}
            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={loadMore}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition-colors"
                >
                  Load More Cards ({filteredCards.length - displayLimit} remaining)
                </button>
              </div>
            )}
          </div>
            )}
          </>
        )}
      </div>
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
        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className="object-cover"
        loading="lazy"
        onLoadingComplete={() => setIsLoading(false)}
        onError={handleError}
        unoptimized={url.includes('supabase')} // Skip Next.js optimization for Supabase signed URLs
      />
    </div>
  )
}
// Wrap in Suspense for Next.js 15 useSearchParams() requirement
export default function CollectionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading collection...</div>}>
      <CollectionPageContent />
    </Suspense>
  )
}
