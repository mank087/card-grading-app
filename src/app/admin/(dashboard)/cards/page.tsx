'use client'

import { useState, useEffect } from 'react'
import AdminAuthGuard from '@/components/admin/AdminAuthGuard'
import Link from 'next/link'

interface Card {
  id: string
  user_id: string
  user_email: string
  serial: string
  card_name: string | null
  category: string | null
  conversational_decimal_grade: number | null
  conversational_condition_label: string | null
  conversational_card_info: any
  ai_grading: any
  featured: string | null
  card_set: string | null
  release_date: string | null
  manufacturer_name: string | null
  card_number: string | null
  front_path: string
  visibility: 'public' | 'private'
  is_featured: boolean
  created_at: string
}

interface PaginationData {
  page: number
  limit: number
  total: number
  total_pages: number
}

// Helper functions - EXACT MATCH to dashboard/collection page logic
const stripMarkdown = (text: string | null | undefined): string | null => {
  if (!text) return null
  return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\#/g, '').replace(/\_/g, '')
}

// Build card info object (matches collection page from line 46)
const getCardInfo = (card: any) => {
  const dvgGrading = card.ai_grading || {}
  return {
    card_name: stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || dvgGrading.card_info?.card_name,
    player_or_character: stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || dvgGrading.card_info?.player_or_character,
    set_name: stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || dvgGrading.card_info?.set_name,
    year: stripMarkdown(card.conversational_card_info?.year) || card.release_date || dvgGrading.card_info?.year,
    manufacturer: stripMarkdown(card.conversational_card_info?.manufacturer) || card.manufacturer_name || dvgGrading.card_info?.manufacturer,
    card_number: stripMarkdown(card.conversational_card_info?.card_number_raw) || stripMarkdown(card.conversational_card_info?.card_number) || card.card_number || dvgGrading.card_info?.card_number,
  }
}

const getPlayerName = (card: any) => {
  const cardInfo = getCardInfo(card)
  const isSportsCard = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'].includes(card.category || '')
  return isSportsCard
    ? (cardInfo.player_or_character || cardInfo.card_name || 'Unknown Player')
    : (cardInfo.card_name || cardInfo.player_or_character || 'Unknown Card')
}

const getManufacturer = (card: any) => {
  return getCardInfo(card).manufacturer || 'Unknown'
}

const getCardSet = (card: any) => {
  return getCardInfo(card).set_name || 'Unknown Set'
}

const getYear = (card: any) => {
  return getCardInfo(card).year || 'N/A'
}

const formatGrade = (grade: number): string => {
  // v6.0: Always return whole number (no .5 grades)
  return Math.round(grade).toString()
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

  // Selection state for bulk actions
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set())
  const [regeneratingLabels, setRegeneratingLabels] = useState(false)
  const [regenerateResult, setRegenerateResult] = useState<{ success: number; errors: number } | null>(null)

  useEffect(() => {
    fetchCards()
  }, [pagination.page, search, category, graded, featured])

  const fetchCards = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search,
        category,
        graded,
        featured
      })

      const response = await fetch(`/api/admin/cards?${params}`)
      const data = await response.json()

      if (response.ok) {
        setCards(data.cards)
        setPagination(data.pagination)
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Card Management</h1>
        <p className="text-gray-600">View and manage all graded cards across the platform</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by card ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="Sports">Sports</option>
              <option value="Pokemon">Pokemon</option>
              <option value="MTG">MTG</option>
              <option value="Lorcana">Lorcana</option>
              <option value="Other">Other</option>
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
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <option value="featured">Featured Only</option>
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
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">Loading cards...</div>
      ) : cards.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No cards found</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={cards.length > 0 && cards.every(c => selectedCards.has(c.id))}
                      onChange={(e) => e.target.checked ? selectAllOnPage() : clearSelection()}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                      title="Select all on page"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Card Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Manufacturer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Series
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Year
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Graded Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Visibility
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Featured
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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

                  return (
                    <tr key={card.id} className={`hover:bg-gray-50 transition-colors ${selectedCards.has(card.id) ? 'bg-purple-50' : ''}`}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedCards.has(card.id)}
                          onChange={() => toggleCardSelection(card.id)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
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
                            const grade = card.conversational_decimal_grade
                            // Use actual AI-generated condition label, stripping abbreviation (matches collection page line 751-753)
                            const condition = card.conversational_condition_label
                              ? card.conversational_condition_label.replace(/\s*\([A-Z]+\)/, '')
                              : ''

                            return (
                              <>
                                {grade ? formatGrade(grade) : '-'}
                                {condition && (
                                  <span className="text-xs text-gray-500 ml-1">
                                    / {condition}
                                  </span>
                                )}
                              </>
                            )
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {card.user_email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={card.is_featured || false}
                          onChange={() => handleToggleFeatured(card.id, card.is_featured || false)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                          title="Feature this card on the home page"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-3 flex-nowrap">
                          <Link
                            href={`${route}/${card.id}`}
                            className="text-purple-600 hover:text-purple-800 font-medium whitespace-nowrap"
                          >
                            View Details
                          </Link>
                          <button
                            onClick={() => openDeleteModal(card.id, getPlayerName(card))}
                            disabled={deletingCardId === card.id}
                            className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                            title="Delete card"
                          >
                            {deletingCardId === card.id ? 'Deleting...' : 'Delete'}
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
