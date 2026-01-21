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
import { BatchAveryLabelModal } from '@/components/reports/BatchAveryLabelModal'
import { BatchDownloadModal } from '@/components/reports/BatchDownloadModal'

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
  // 💰 eBay Price Cache fields
  ebay_price_lowest?: number | null
  ebay_price_median?: number | null
  ebay_price_average?: number | null
  ebay_price_highest?: number | null
  ebay_price_listing_count?: number | null
  ebay_price_updated_at?: string | null
}

// 🎯 Helper: Strip markdown formatting from text
const stripMarkdown = (text: string | null | undefined): string | null => {
  if (!text) return null;
  return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\#/g, '').replace(/\_/g, '');
};

// 🎯 Helper: Build card info object (matches detail page logic from line 1999)
const getCardInfo = (card: Card) => {
  const dvgGrading = card.ai_grading || {};
  // Legacy ai_grading uses "Card Information" (with spaces), newer uses card_info
  const legacyCardInfo = dvgGrading["Card Information"] || dvgGrading.card_info || {};
  const setNameRaw = stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || legacyCardInfo.set_name;
  const subset = stripMarkdown(card.conversational_card_info?.subset) || card.subset || legacyCardInfo.subset;
  // Combine set name with subset if available (matching foldable label format)
  const setNameWithSubset = subset ? `${setNameRaw} - ${subset}` : setNameRaw;
  return {
    card_name: stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || legacyCardInfo.card_name,
    player_or_character: stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || legacyCardInfo.player_or_character,
    set_name: setNameWithSubset,
    year: stripMarkdown(card.conversational_card_info?.year) || card.release_date || legacyCardInfo.year,
    manufacturer: stripMarkdown(card.conversational_card_info?.manufacturer) || card.manufacturer_name || legacyCardInfo.manufacturer,
    card_number: stripMarkdown(card.conversational_card_info?.card_number_raw) || stripMarkdown(card.conversational_card_info?.card_number) || card.card_number || legacyCardInfo.card_number,
    serial_number: stripMarkdown(card.conversational_card_info?.serial_number) || legacyCardInfo.serial_number,
    rookie_or_first: card.conversational_card_info?.rookie_or_first || legacyCardInfo.rookie_or_first,
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

// 💰 Helper: Format price for display
const formatPrice = (price: number | null | undefined): string | null => {
  if (price === null || price === undefined) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
};

// 💰 Helper: Get card's market value (median price from eBay cache)
const getMarketValue = (card: Card): number | null => {
  // Use eBay median price if available
  if (card.ebay_price_median !== null && card.ebay_price_median !== undefined) {
    return card.ebay_price_median;
  }
  // Fallback to Scryfall price for MTG cards
  if (card.category === 'MTG') {
    if (card.is_foil && card.scryfall_price_usd_foil) {
      return card.scryfall_price_usd_foil;
    }
    if (card.scryfall_price_usd) {
      return card.scryfall_price_usd;
    }
  }
  return null;
};

// 💰 Helper: Check if price data is stale (> 7 days)
const isPriceStale = (updatedAt: string | null | undefined): boolean => {
  if (!updatedAt) return true;
  const updated = new Date(updatedAt);
  const now = new Date();
  const diffDays = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > 7;
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
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [isFounder, setIsFounder] = useState(false)
  const [isBatchLabelModalOpen, setIsBatchLabelModalOpen] = useState(false)
  const [isBatchDownloadModalOpen, setIsBatchDownloadModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [labelStyle, setLabelStyle] = useState<'modern' | 'traditional'>('modern')
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false)
  const [priceRefreshCount, setPriceRefreshCount] = useState(0)
  const searchParams = useSearchParams()
  const searchQuery = searchParams?.get('search')
  const toast = useToast()

  // Fetch label style preference
  useEffect(() => {
    const session = getStoredSession()
    if (!session?.access_token) return

    fetch('/api/user/label-style', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.labelStyle) {
          setLabelStyle(data.labelStyle)
        }
      })
      .catch(err => console.error('Error fetching label style:', err))
  }, [])

  // Check founder status
  useEffect(() => {
    const session = getStoredSession()
    if (!session?.access_token) return

    fetch('/api/founders/status', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.isFounder) {
          setIsFounder(true)
        }
      })
      .catch(err => console.error('Error checking founder status:', err))
  }, [])

  // Multi-select handlers
  const toggleCardSelection = (cardId: string) => {
    setSelectedCardIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(cardId)) {
        newSet.delete(cardId)
      } else {
        newSet.add(cardId)
      }
      return newSet
    })
  }

  const selectAllDisplayed = (cardsToSelect: Card[]) => {
    const allIds = new Set(cardsToSelect.map(card => card.id))
    setSelectedCardIds(allIds)
  }

  const deselectAll = () => {
    setSelectedCardIds(new Set())
  }

  // Clear selection when category or search changes
  useEffect(() => {
    setSelectedCardIds(new Set())
    setDisplayLimit(20) // Reset display limit when filtering
  }, [selectedCategory, searchTerm])

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

  // Background price refresh for stale cards (>= 7 days old)
  useEffect(() => {
    // Only run when we have cards and not currently loading
    if (loading || cards.length === 0) return;

    const refreshStalePrices = async () => {
      const session = getStoredSession();
      if (!session?.access_token) {
        console.log('[Collection] No session token, skipping price refresh');
        return;
      }

      // Find cards with stale prices OR null prices that might benefit from retry
      // Include cards with null prices that were attempted recently (our improved search might find them now)
      const staleCards = cards.filter(card => {
        const isStale = isPriceStale(card.ebay_price_updated_at);
        const hasNullPrice = card.ebay_price_median === null || card.ebay_price_median === undefined;
        // Refresh if: stale OR (null price AND is Pokemon/CCG card that might benefit from improved search)
        const isPokemonOrCCG = card.category === 'Pokemon' || card.category === 'MTG' || card.category === 'Lorcana';
        return isStale || (hasNullPrice && isPokemonOrCCG);
      });
      const staleCardIds = staleCards.map(card => card.id);

      console.log(`[Collection] Found ${staleCardIds.length} cards to refresh out of ${cards.length} total`);

      if (staleCardIds.length === 0) return;

      setIsRefreshingPrices(true);
      setPriceRefreshCount(staleCardIds.length);

      try {
        // Process in batches of 10
        const batchSize = 10;
        let totalRefreshed = 0;

        // Check if any cards need force refresh (Pokemon/CCG with null prices)
        const cardsNeedingForceRefresh = staleCards.filter(card => {
          const hasNullPrice = card.ebay_price_median === null || card.ebay_price_median === undefined;
          const isPokemonOrCCG = card.category === 'Pokemon' || card.category === 'MTG' || card.category === 'Lorcana';
          return hasNullPrice && isPokemonOrCCG && card.ebay_price_updated_at; // Has updatedAt but null price
        });
        const forceRefreshIds = new Set(cardsNeedingForceRefresh.map(c => c.id));

        for (let i = 0; i < staleCardIds.length; i += batchSize) {
          const batch = staleCardIds.slice(i, i + batchSize);
          // Force refresh if any card in batch needs it
          const needsForce = batch.some(id => forceRefreshIds.has(id));

          const response = await fetch('/api/ebay/batch-refresh-prices', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ card_ids: batch, force: needsForce }),
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`[Collection] Batch refresh response:`, data);

            // Update cards state with new prices
            if (data.results && data.results.length > 0) {
              setCards(prevCards => {
                const updatedCards = [...prevCards];
                data.results.forEach((result: { id: string; success: boolean; median_price?: number | null }) => {
                  if (result.success) {
                    const cardIndex = updatedCards.findIndex(c => c.id === result.id);
                    if (cardIndex !== -1) {
                      updatedCards[cardIndex] = {
                        ...updatedCards[cardIndex],
                        ebay_price_median: result.median_price ?? null,
                        ebay_price_updated_at: new Date().toISOString(),
                      };
                    }
                  }
                });
                return updatedCards;
              });
              totalRefreshed += data.refreshed || 0;
            }
          }

          // Update remaining count
          setPriceRefreshCount(prev => Math.max(0, prev - batch.length));

          // Small delay between batches to avoid overwhelming the API
          if (i + batchSize < staleCardIds.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (totalRefreshed > 0) {
          console.log(`[Collection] Refreshed prices for ${totalRefreshed} cards`);
        }
      } catch (err) {
        console.error('Error refreshing prices:', err);
      } finally {
        setIsRefreshingPrices(false);
        setPriceRefreshCount(0);
      }
    };

    // Delay the refresh slightly to let the page render first
    const timeoutId = setTimeout(refreshStalePrices, 2000);
    return () => clearTimeout(timeoutId);
  }, [loading, cards.length]); // Re-run when cards are loaded

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
      case 'price':
        aValue = getMarketValue(a) || 0
        bValue = getMarketValue(b) || 0
        break
      default:
        return 0
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  // Filter cards by selected category and search term
  const filteredCards = sortedCards.filter(card => {
    // Category filter
    let categoryMatch = true;
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'Sports') {
        categoryMatch = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'].includes(card.category || '');
      } else {
        categoryMatch = card.category === selectedCategory;
      }
    }
    if (!categoryMatch) return false;

    // Search term filter (case-insensitive)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const cardInfo = getCardInfo(card);

      // Search across multiple fields
      const searchableFields = [
        cardInfo.player_or_character,
        cardInfo.card_name,
        cardInfo.set_name,
        cardInfo.card_number,
        cardInfo.year,
        cardInfo.manufacturer,
        card.serial,
        card.category,
      ].filter(Boolean).map(f => f?.toString().toLowerCase());

      return searchableFields.some(field => field?.includes(term));
    }

    return true;
  })

  // Limit displayed cards for performance
  const displayedCards = filteredCards.slice(0, displayLimit)
  const hasMore = filteredCards.length > displayLimit

  // Multi-select helper calculations (must be after displayedCards is defined)
  const isAllSelected = displayedCards.length > 0 && displayedCards.every(card => selectedCardIds.has(card.id))
  const isSomeSelected = selectedCardIds.size > 0

  // Load more handler
  const loadMore = () => {
    setDisplayLimit(prev => prev + 20)
  }

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedCardIds.size === 0) return

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedCardIds.size} card${selectedCardIds.size !== 1 ? 's' : ''}?\n\nThis action cannot be undone.`
    )

    if (!confirmDelete) return

    setIsDeleting(true)

    try {
      const session = getStoredSession()
      if (!session || !session.user || !session.access_token) {
        throw new Error('You must be logged in to delete cards')
      }

      // Delete cards one by one
      const deletePromises = Array.from(selectedCardIds).map(async (cardId) => {
        const response = await fetch(`/api/cards/${cardId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || `Failed to delete card ${cardId}`)
        }

        return cardId
      })

      const deletedIds = await Promise.all(deletePromises)

      // Remove deleted cards from local state
      setCards(prevCards => prevCards.filter(card => !deletedIds.includes(card.id)))
      setSelectedCardIds(new Set())

      toast.success(`Successfully deleted ${deletedIds.length} card${deletedIds.length !== 1 ? 's' : ''}!`)
    } catch (error: any) {
      console.error('Bulk delete error:', error)
      toast.error(`Failed to delete cards: ${error.message}`)
    } finally {
      setIsDeleting(false)
    }
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
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold">My Collection</h1>
              {isFounder && (
                <span className="inline-flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 text-sm font-semibold px-3 py-1 rounded-full shadow">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Founder
                </span>
              )}
            </div>
            {searchQuery && (
              <p className="text-gray-600 mt-2">
                Search results for: "{searchQuery}"
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* Price Refresh Indicator */}
            {isRefreshingPrices && (
              <div className="hidden sm:flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 animate-pulse">
                <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-xs font-medium text-blue-600">
                  Updating {priceRefreshCount} price{priceRefreshCount !== 1 ? 's' : ''}...
                </span>
              </div>
            )}
            {/* Collection Value Summary */}
            {!isRefreshingPrices && (() => {
              const cardsWithPrices = filteredCards.filter(c => getMarketValue(c) !== null);
              if (cardsWithPrices.length === 0) return null;

              const totalValue = cardsWithPrices.reduce((sum, c) => sum + (getMarketValue(c) || 0), 0);

              return (
                <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg px-3 py-1.5">
                  <span className="text-xs font-medium text-gray-600">Est. Value:</span>
                  <span className="text-sm font-bold text-green-600">{formatPrice(totalValue)}</span>
                  <span className="text-xs text-gray-400">({cardsWithPrices.length} priced)</span>
                </div>
              );
            })()}
            {/* View Toggle */}
            <div className="flex items-center gap-1 sm:gap-2 bg-gray-100 rounded-lg p-1">
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
            {/* Label Style Toggle */}
            <div className="flex items-center gap-1 sm:gap-2">
              <span className={`text-xs font-medium ${labelStyle === 'traditional' ? 'text-purple-600' : 'text-gray-400'}`}>
                <span className="hidden sm:inline">Traditional</span>
                <span className="sm:hidden">Trad</span>
              </span>
              <button
                onClick={async () => {
                  const newStyle = labelStyle === 'modern' ? 'traditional' : 'modern';
                  setLabelStyle(newStyle);
                  const session = getStoredSession();
                  if (session?.access_token) {
                    try {
                      await fetch('/api/user/label-style', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({ labelStyle: newStyle }),
                      });
                    } catch (err) {
                      console.error('Failed to update label style:', err);
                    }
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  labelStyle === 'modern' ? 'bg-purple-600' : 'bg-gray-300'
                }`}
                title="Toggle between modern and traditional label style"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    labelStyle === 'modern' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-xs font-medium ${labelStyle === 'modern' ? 'text-purple-600' : 'text-gray-400'}`}>
                Modern
              </span>
            </div>
            <div className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">
              {cards.length} card{cards.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by player, card name, set, number, year..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Clear search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchTerm && (
            <p className="mt-2 text-sm text-gray-500">
              Found {filteredCards.length} card{filteredCards.length !== 1 ? 's' : ''} matching "{searchTerm}"
            </p>
          )}
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
                  labelStyle={labelStyle}
                  className="hover:shadow-xl transition-shadow duration-200"
                >
                  {/* Visibility & Price Badges */}
                  <div className="relative">
                    {/* Visibility Badge - Left */}
                    <div className={`absolute -top-8 left-2 px-2 py-1 rounded-full text-xs font-semibold border-2 ${
                      card.visibility === 'public'
                        ? 'bg-green-100 text-green-800 border-green-500'
                        : 'bg-gray-100 text-gray-800 border-gray-400'
                    }`} title={card.visibility === 'public' ? 'This card is public (anyone can view)' : 'This card is private (only you can view)'}>
                      {card.visibility === 'public' ? '🌐 Public' : '🔒 Private'}
                    </div>

                    {/* Price Badge - Right */}
                    {(() => {
                      const marketValue = getMarketValue(card);
                      const priceStr = formatPrice(marketValue);
                      if (!priceStr) return null;

                      const isStale = isPriceStale(card.ebay_price_updated_at);
                      return (
                        <div
                          className={`absolute -top-8 right-2 px-2 py-1 rounded-full text-xs font-semibold border-2 flex items-center gap-1 ${
                            isStale
                              ? 'bg-amber-50 text-amber-700 border-amber-400'
                              : 'bg-green-50 text-green-700 border-green-400'
                          }`}
                          title={`eBay median price${isStale ? ' (stale - updating soon)' : ''}`}
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                          </svg>
                          {priceStr}
                        </div>
                      );
                    })()}
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
                {/* Bulk Action Bar - Responsive */}
                {isSomeSelected && viewMode === 'list' && (
                  <div className="bg-indigo-50 border-b border-indigo-200 px-3 py-3 md:px-4">
                    {/* Mobile: Stack vertically */}
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center justify-between md:justify-start gap-3">
                        <span className="text-sm font-medium text-indigo-700">
                          {selectedCardIds.size} card{selectedCardIds.size !== 1 ? 's' : ''} selected
                        </span>
                        <button
                          onClick={deselectAll}
                          className="text-sm text-indigo-600 hover:text-indigo-800 underline"
                        >
                          Clear
                        </button>
                      </div>
                      {/* Action buttons - wrap on mobile */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Print Labels Button */}
                        {selectedCardIds.size > 0 && selectedCardIds.size <= 18 && (
                          <button
                            onClick={() => setIsBatchLabelModalOpen(true)}
                            disabled={isDeleting}
                            className="flex-1 md:flex-none min-w-[44px] h-[44px] md:h-auto md:px-4 md:py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            title="Print Labels"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            <span className="hidden md:inline">Print ({selectedCardIds.size})</span>
                          </button>
                        )}
                        {selectedCardIds.size > 18 && (
                          <span className="text-amber-600 text-xs md:text-sm font-medium">
                            Max 18 for labels
                          </span>
                        )}
                        {/* Download Reports Button */}
                        {selectedCardIds.size > 0 && (
                          <button
                            onClick={() => setIsBatchDownloadModalOpen(true)}
                            disabled={isDeleting}
                            className="flex-1 md:flex-none min-w-[44px] h-[44px] md:h-auto md:px-4 md:py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            title="Download Reports"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="hidden md:inline">Download ({selectedCardIds.size})</span>
                          </button>
                        )}
                        <button
                          onClick={handleBulkDelete}
                          disabled={isDeleting}
                          className="flex-1 md:flex-none min-w-[44px] h-[44px] md:h-auto md:px-4 md:py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                          title="Delete Selected"
                        >
                          {isDeleting ? (
                            <div className="animate-spin rounded-full h-5 w-5 md:h-4 md:w-4 border-b-2 border-white"></div>
                          ) : (
                            <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                          <span className="hidden md:inline">{isDeleting ? 'Deleting...' : 'Delete'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {/* Mobile Card Layout */}
                <div className="md:hidden">
                  {/* Mobile Header with Select All */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectAllDisplayed(displayedCards)
                          } else {
                            deselectAll()
                          }
                        }}
                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Select All</span>
                    </label>
                    {/* Mobile Sort Dropdown */}
                    <select
                      value={sortColumn || ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleSort(e.target.value)
                        }
                      }}
                      className="text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Sort by...</option>
                      <option value="name">Name {sortColumn === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</option>
                      <option value="grade">Grade {sortColumn === 'grade' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</option>
                      <option value="price">Value {sortColumn === 'price' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</option>
                      <option value="date">Date {sortColumn === 'date' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</option>
                      <option value="series">Set {sortColumn === 'series' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</option>
                    </select>
                  </div>

                  {/* Mobile Card List */}
                  <div className="divide-y divide-gray-200">
                    {displayedCards.map((card) => {
                      const grade = getCardGrade(card);
                      const condition = card.conversational_condition_label
                        ? card.conversational_condition_label.replace(/\s*\([A-Z]+\)/, '')
                        : (grade ? getConditionFromGrade(grade) : '');
                      const isAlteredAuthentic = card.conversational_condition_label &&
                        (card.conversational_condition_label.toLowerCase().includes('altered') ||
                         card.conversational_condition_label.toLowerCase().includes('authentic altered') ||
                         card.conversational_condition_label.includes('(AA)'));

                      return (
                        <div
                          key={card.id}
                          className={`p-4 ${selectedCardIds.has(card.id) ? 'bg-indigo-50' : 'bg-white'}`}
                        >
                          <div className="flex gap-3">
                            {/* Checkbox */}
                            <div className="flex-shrink-0 pt-1">
                              <input
                                type="checkbox"
                                checked={selectedCardIds.has(card.id)}
                                onChange={() => toggleCardSelection(card.id)}
                                className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                            </div>

                            {/* Card Info */}
                            <div className="flex-1 min-w-0">
                              {/* Name - Primary */}
                              <div className="font-medium text-gray-900 truncate">
                                {getPlayerName(card)}
                              </div>

                              {/* Set & Year - Secondary */}
                              <div className="text-sm text-gray-500 truncate mt-0.5">
                                {getCardSet(card)} {getYear(card) ? `• ${getYear(card)}` : ''}
                              </div>

                              {/* Grade & Price Row */}
                              <div className="flex items-center gap-3 mt-2">
                                {/* Grade Badge */}
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-sm">
                                    {grade ? formatGrade(grade) : (isAlteredAuthentic ? 'A' : '-')}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {isAlteredAuthentic && !grade ? 'Authentic' : condition}
                                  </span>
                                </div>

                                {/* Market Value */}
                                {(() => {
                                  const marketValue = getMarketValue(card);
                                  const priceStr = formatPrice(marketValue);
                                  const isStale = isPriceStale(card.ebay_price_updated_at);
                                  if (priceStr) {
                                    return (
                                      <span className={`text-sm font-semibold px-2 py-0.5 rounded ${isStale ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50'}`}>
                                        {priceStr}
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}

                                {/* Visibility */}
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  card.visibility === 'public'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {card.visibility === 'public' ? '🌐' : '🔒'}
                                </span>
                              </div>

                              {/* Actions Row */}
                              <div className="flex items-center justify-end gap-2 mt-2">
                                  <Link
                                    href={getCardLink(card)}
                                    className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 transition-colors"
                                    title="View Details"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </Link>
                                  <button
                                    onClick={() => handleDeleteCard(card.id, getPlayerName(card))}
                                    disabled={deletingCardId === card.id}
                                    className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
                                    title="Delete card"
                                  >
                                    {deletingCardId === card.id ? (
                                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                                    ) : (
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    )}
                                  </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full table-fixed">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {/* Checkbox column */}
                        <th className="w-[4%] px-2 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                selectAllDisplayed(displayedCards)
                              } else {
                                deselectAll()
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            title={isAllSelected ? 'Deselect all' : 'Select all'}
                          />
                        </th>
                        <th
                          onClick={() => handleSort('name')}
                          className="w-[22%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                          className="w-[20%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                          className="w-[7%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                          className="w-[10%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                          className="w-[9%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                          onClick={() => handleSort('price')}
                          className="w-[10%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            Value
                            {sortColumn === 'price' && (
                              <span className="text-indigo-600">
                                {sortDirection === 'asc' ? '▲' : '▼'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('visibility')}
                          className="w-[6%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                        <th className="w-[8%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {displayedCards.map((card) => (
                        <tr
                          key={card.id}
                          className={`hover:bg-gray-50 transition-colors ${selectedCardIds.has(card.id) ? 'bg-indigo-50' : ''}`}
                        >
                          {/* Checkbox cell */}
                          <td className="px-2 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedCardIds.has(card.id)}
                              onChange={() => toggleCardSelection(card.id)}
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
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
                            {(() => {
                              const marketValue = getMarketValue(card);
                              const priceStr = formatPrice(marketValue);
                              const isStale = isPriceStale(card.ebay_price_updated_at);
                              const listingCount = card.ebay_price_listing_count;

                              if (!priceStr) {
                                return <span className="text-sm text-gray-400">-</span>;
                              }

                              return (
                                <div className="text-sm">
                                  <span className={`font-medium ${isStale ? 'text-amber-600' : 'text-green-600'}`}>
                                    {priceStr}
                                  </span>
                                  {listingCount !== null && listingCount !== undefined && (
                                    <div className="text-xs text-gray-400">
                                      {listingCount} listing{listingCount !== 1 ? 's' : ''}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
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

      {/* Batch Label Modal */}
      <BatchAveryLabelModal
        isOpen={isBatchLabelModalOpen}
        onClose={() => setIsBatchLabelModalOpen(false)}
        selectedCards={cards.filter(c => selectedCardIds.has(c.id)).map(c => ({
          ...c,
          front_image_url: c.front_url || undefined
        }))}
        cardType={selectedCategory === 'Pokemon' ? 'pokemon' : selectedCategory === 'MTG' ? 'mtg' : selectedCategory === 'Lorcana' ? 'lorcana' : selectedCategory === 'Sports' || ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling'].includes(selectedCategory) ? 'sports' : 'card'}
      />

      {/* Batch Download Modal */}
      <BatchDownloadModal
        isOpen={isBatchDownloadModalOpen}
        onClose={() => setIsBatchDownloadModalOpen(false)}
        selectedCards={cards.filter(c => selectedCardIds.has(c.id))}
        cardType={selectedCategory === 'Pokemon' ? 'pokemon' : selectedCategory === 'MTG' ? 'mtg' : selectedCategory === 'Lorcana' ? 'lorcana' : selectedCategory === 'Sports' || ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling'].includes(selectedCategory) ? 'sports' : 'card'}
      />
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
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAQMEAQUAAAAAAAAAAAAAAQIDBAAFBhEhEhMiMUH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBP/EABkRAAIDAQAAAAAAAAAAAAAAAAABAhEhMf/aAAwDAQACEQMRAD8AyTF8hv0O4W9q33S4wI1wjJkx0suq0tJWNdJPsb0djxSlVKlxCj0P/9k="
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
