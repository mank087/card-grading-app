'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getStoredSession } from '../../lib/directAuth'
import { getConditionFromGrade } from '@/lib/conditionAssessment'

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
  conversational_card_info?: any  // JSON field containing card details
  dvg_decimal_grade?: number | null
}

// 🎯 Helper: Strip markdown formatting from text
const stripMarkdown = (text: string | null | undefined): string | null => {
  if (!text) return null;
  return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\#/g, '').replace(/\_/g, '');
};

// 🎯 Helper: Build card info object (matches detail page logic from line 1999)
const getCardInfo = (card: Card) => {
  const dvgGrading = card.ai_grading || {};
  return {
    card_name: stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || dvgGrading.card_info?.card_name,
    player_or_character: stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || dvgGrading.card_info?.player_or_character,
    set_name: stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || dvgGrading.card_info?.set_name,
    year: stripMarkdown(card.conversational_card_info?.year) || card.release_date || dvgGrading.card_info?.year,
    manufacturer: stripMarkdown(card.conversational_card_info?.manufacturer) || card.manufacturer_name || dvgGrading.card_info?.manufacturer,
    card_number: stripMarkdown(card.conversational_card_info?.card_number) || card.card_number || dvgGrading.card_info?.card_number,
    serial_number: stripMarkdown(card.conversational_card_info?.serial_number) || dvgGrading.card_info?.serial_number,
    rookie_or_first: card.conversational_card_info?.rookie_or_first || dvgGrading.card_info?.rookie_or_first,
    subset: stripMarkdown(card.conversational_card_info?.subset) || dvgGrading.card_info?.subset,
    autographed: card.conversational_card_info?.autographed || false,
  };
};

// 🎯 Helper functions - Use cardInfo object (maintained for sorting compatibility)
const getCardName = (card: Card) => {
  return getCardInfo(card).card_name || 'Unknown Card';
};

const getPlayerName = (card: Card) => {
  const cardInfo = getCardInfo(card);
  // For sports cards: show player name first
  // For TCG cards (MTG, Pokemon, Lorcana): show card name first
  const isSportsCard = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'].includes(card.category || '');
  return isSportsCard
    ? (cardInfo.player_or_character || cardInfo.card_name || 'Unknown Player')
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

// Format grade for display (matches detail page formatting)
const formatGrade = (grade: number): string => {
  // Show .5 grades, otherwise show whole numbers
  if (grade % 1 === 0.5) {
    return grade.toFixed(1);
  }
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
        const url = `/api/cards/my-collection?user_id=${user.id}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`
        const res = await fetch(url)

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
      if (!session || !session.user) {
        throw new Error('You must be logged in to delete cards')
      }

      const response = await fetch(`/api/cards/${cardId}?user_id=${session.user.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete card')
      }

      // Remove card from local state
      setCards(prevCards => prevCards.filter(card => card.id !== cardId))

      // Show success message
      alert('Card deleted successfully!')
    } catch (error: any) {
      console.error('Delete error:', error)
      alert(`Failed to delete card: ${error.message}`)
    } finally {
      setDeletingCardId(null)
    }
  }

  if (loading) return <p className="p-6 text-center">Loading your collection...</p>
  if (error) return <p className="p-6 text-center text-red-600">{error}</p>
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
              // Get card info (matches detail page line 1999)
              const cardInfo = getCardInfo(card);

              // Build player/card name for display
              // For sports cards: show player name first
              // For TCG cards (MTG, Pokemon, Lorcana): show card name first
              const isSportsCard = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'].includes(card.category || '');
              const displayName = isSportsCard
                ? (cardInfo.player_or_character || cardInfo.card_name || "Unknown Player")
                : (cardInfo.card_name || cardInfo.player_or_character || "Unknown Card");

              // Build special features string (matches detail page line 2223-2230)
              const features: string[] = [];
              if (cardInfo.rookie_or_first === true || cardInfo.rookie_or_first === 'true') features.push('RC');
              if (cardInfo.autographed) features.push('Auto');
              const serialNum = cardInfo.serial_number;
              if (serialNum && serialNum !== 'N/A' && !serialNum.toLowerCase().includes('not present') && !serialNum.toLowerCase().includes('none')) {
                features.push(serialNum);
              }
              const specialFeatures = features.length > 0 ? features.join(' ') : '';

              // Build set details for Line 2 (Set Name • Card # • Year)
              const setName = cardInfo.set_name || cardInfo.set_era || "Unknown Set";
              const cardNumber = cardInfo.card_number;
              const year = cardInfo.year || cardInfo.card_date || card.card_date;

              // Dynamic sizing for player name (Line 1)
              const nameFontSize = displayName.length > 35 ? '11px' : displayName.length > 25 ? '12px' : '14px';

              // Dynamic sizing for set details (Line 2)
              const setFontSize = setName.length > 30 ? '10px' : '11px';

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
                          const grade = getCardGrade(card);
                          // Use actual AI-generated condition label, stripping abbreviation
                          const condition = card.conversational_condition_label
                            ? card.conversational_condition_label.replace(/\s*\([A-Z]+\)/, '')
                            : (grade ? getConditionFromGrade(grade) : '');

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
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Card Image */}
                  <div className="aspect-[3/4] relative">
                    <CardThumbnail url={card.front_url} />

                    {/* Visibility Badge */}
                    <div className={`absolute bottom-2 left-2 px-2 py-1 rounded-full text-xs font-semibold border-2 ${
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
                </div>
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
                {/* Mobile scroll hint */}
                <div className="md:hidden bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-700">
                  ← Swipe to see all columns including Actions →
                </div>
                <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
                  <table className="w-full" style={{ minWidth: '1200px' }}>
                    <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      onClick={() => handleSort('name')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                      onClick={() => handleSort('manufacturer')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Manufacturer
                        {sortColumn === 'manufacturer' && (
                          <span className="text-indigo-600">
                            {sortDirection === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('series')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Series
                        {sortColumn === 'series' && (
                          <span className="text-indigo-600">
                            {sortDirection === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('year')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Graded Date
                        {sortColumn === 'date' && (
                          <span className="text-indigo-600">
                            {sortDirection === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('visibility')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Visibility
                        {sortColumn === 'visibility' && (
                          <span className="text-indigo-600">
                            {sortDirection === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider md:static sticky right-0 bg-gray-50 shadow-md md:shadow-none" style={{ minWidth: '200px' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayedCards.map((card) => (
                    <tr key={card.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900">
                            {getPlayerName(card)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {getManufacturer(card) || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {getCardSet(card)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {getYear(card) || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {(() => {
                            const grade = getCardGrade(card);
                            // Use actual AI-generated condition label, stripping abbreviation
                            const condition = card.conversational_condition_label
                              ? card.conversational_condition_label.replace(/\s*\([A-Z]+\)/, '')
                              : (grade ? getConditionFromGrade(grade) : '');

                            return (
                              <>
                                {grade ? formatGrade(grade) : '-'}
                                {condition && (
                                  <span className="text-xs text-gray-500 ml-1">
                                    / {condition}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {card.created_at ? new Date(card.created_at).toLocaleDateString() : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          card.visibility === 'public'
                            ? 'bg-green-100 text-green-800 border-green-500'
                            : 'bg-gray-100 text-gray-800 border-gray-400'
                        }`}>
                          {card.visibility === 'public' ? '🌐 Public' : '🔒 Private'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm md:static sticky right-0 bg-white shadow-md md:shadow-none" style={{ minWidth: '200px' }}>
                        <div className="flex items-center gap-3 flex-nowrap">
                          <Link
                            href={getCardLink(card)}
                            className="text-purple-600 hover:text-purple-800 font-medium whitespace-nowrap"
                          >
                            View Details
                          </Link>
                          <button
                            onClick={() => handleDeleteCard(card.id, getPlayerName(card))}
                            disabled={deletingCardId === card.id}
                            className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                            title="Delete card"
                          >
                            {deletingCardId === card.id ? 'Deleting...' : 'Delete'}
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
