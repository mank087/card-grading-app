'use client'

import { useState, useEffect } from 'react'
import AdminAuthGuard from '@/components/admin/AdminAuthGuard'
import Image from 'next/image'

interface Card {
  id: string
  user_id: string
  user_email: string
  category: string
  created_at: string
  conversational_decimal_grade: number | null
  front_image_url: string
  back_image_url: string
}

interface CardDetails {
  card: Card & {
    user: { id: string; email: string; created_at: string } | null
    is_flagged: boolean
    flag_details: any | null
  }
}

interface PaginationData {
  page: number
  limit: number
  total: number
  total_pages: number
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
    limit: 20,
    total: 0,
    total_pages: 0
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [graded, setGraded] = useState<'all' | 'graded' | 'ungraded'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [selectedCard, setSelectedCard] = useState<CardDetails | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null)
  const [deleteReason, setDeleteReason] = useState('')

  useEffect(() => {
    fetchCards()
  }, [pagination.page, search, category, graded])

  const fetchCards = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search,
        category,
        graded
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

  const fetchCardDetails = async (cardId: string) => {
    try {
      const response = await fetch(`/api/admin/cards/${cardId}`)
      const data = await response.json()

      if (response.ok) {
        setSelectedCard(data)
        setShowDetailsModal(true)
      }
    } catch (error) {
      console.error('Error fetching card details:', error)
    }
  }

  const handleFlagCard = async (cardId: string) => {
    const reason = prompt('Enter reason for flagging this card:')
    if (!reason) return

    const severity = prompt('Enter severity (low/medium/high):', 'medium')

    try {
      const response = await fetch(`/api/admin/cards/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'flag', reason, severity })
      })

      if (response.ok) {
        alert('Card flagged successfully')
        fetchCards()
      }
    } catch (error) {
      console.error('Error flagging card:', error)
      alert('Failed to flag card')
    }
  }

  const handleUnflagCard = async (cardId: string) => {
    try {
      const response = await fetch(`/api/admin/cards/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unflag' })
      })

      if (response.ok) {
        alert('Card unflagged successfully')
        fetchCards()
        if (selectedCard?.card.id === cardId) {
          setShowDetailsModal(false)
          setSelectedCard(null)
        }
      }
    } catch (error) {
      console.error('Error unflagging card:', error)
      alert('Failed to unflag card')
    }
  }

  const handleDeleteCard = async () => {
    if (!deleteCardId || !deleteReason.trim()) {
      alert('Please provide a reason for deletion')
      return
    }

    try {
      const response = await fetch(
        `/api/admin/cards/${deleteCardId}?reason=${encodeURIComponent(deleteReason)}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        alert('Card deleted successfully')
        setShowDeleteModal(false)
        setDeleteCardId(null)
        setDeleteReason('')
        fetchCards()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete card')
      }
    } catch (error) {
      console.error('Error deleting card:', error)
      alert('Failed to delete card')
    }
  }

  const openDeleteModal = (cardId: string) => {
    setDeleteCardId(cardId)
    setShowDeleteModal(true)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Card Management</h1>
        <p className="text-gray-600">View and manage all graded cards across the platform</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
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

          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded-lg ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-lg ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Cards Display */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">Loading cards...</div>
      ) : cards.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No cards found</div>
      ) : viewMode === 'grid' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
            {cards.map((card) => (
              <div key={card.id} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative aspect-[3/4] bg-gray-100">
                  {card.front_image_url ? (
                    <Image
                      src={card.front_image_url}
                      alt="Card front"
                      fill
                      className="object-contain"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      {card.category}
                    </span>
                    {card.conversational_decimal_grade && (
                      <span className="text-lg font-bold text-green-600">
                        {card.conversational_decimal_grade}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">{card.user_email}</div>
                  <div className="text-xs text-gray-400 mb-3">
                    {new Date(card.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchCardDetails(card.id)}
                      className="flex-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleFlagCard(card.id)}
                      className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                    >
                      Flag
                    </button>
                    <button
                      onClick={() => openDeleteModal(card.id)}
                      className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="bg-white rounded-lg shadow px-6 py-4 flex items-center justify-between">
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
        </>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Card ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cards.map((card) => (
                  <tr key={card.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900">{card.id.substring(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{card.user_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {card.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {card.conversational_decimal_grade ? (
                        <span className="text-sm font-bold text-green-600">
                          {card.conversational_decimal_grade}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Not graded</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(card.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => fetchCardDetails(card.id)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleFlagCard(card.id)}
                        className="text-orange-600 hover:text-orange-900 mr-3"
                      >
                        Flag
                      </button>
                      <button
                        onClick={() => openDeleteModal(card.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
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

      {/* Card Details Modal */}
      {showDetailsModal && selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Card Details</h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  &times;
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* Front Image */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Front</h3>
                  <div className="relative aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden">
                    {selectedCard.card.front_image_url ? (
                      <Image
                        src={selectedCard.card.front_image_url}
                        alt="Card front"
                        fill
                        className="object-contain"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        No image
                      </div>
                    )}
                  </div>
                </div>

                {/* Back Image */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Back</h3>
                  <div className="relative aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden">
                    {selectedCard.card.back_image_url ? (
                      <Image
                        src={selectedCard.card.back_image_url}
                        alt="Card back"
                        fill
                        className="object-contain"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        No image
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Info */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <strong>Card ID:</strong> {selectedCard.card.id}
                    </div>
                    <div>
                      <strong>Category:</strong> {selectedCard.card.category}
                    </div>
                    <div>
                      <strong>Grade:</strong>{' '}
                      {selectedCard.card.conversational_decimal_grade ? (
                        <span className="font-bold text-green-600">
                          {selectedCard.card.conversational_decimal_grade}
                        </span>
                      ) : (
                        <span className="text-gray-400">Not graded</span>
                      )}
                    </div>
                    <div>
                      <strong>Created:</strong>{' '}
                      {new Date(selectedCard.card.created_at).toLocaleString()}
                    </div>
                    {selectedCard.card.user && (
                      <>
                        <div>
                          <strong>User:</strong> {selectedCard.card.user.email}
                        </div>
                        <div>
                          <strong>User ID:</strong> {selectedCard.card.user.id.substring(0, 8)}...
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Flag Status */}
                {selectedCard.card.is_flagged && selectedCard.card.flag_details && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-900 mb-2">Flagged Content</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <strong>Reason:</strong> {selectedCard.card.flag_details.reason}
                      </div>
                      <div>
                        <strong>Severity:</strong>{' '}
                        <span className="uppercase">{selectedCard.card.flag_details.severity}</span>
                      </div>
                      <div>
                        <strong>Flagged:</strong>{' '}
                        {new Date(selectedCard.card.flag_details.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  {selectedCard.card.is_flagged ? (
                    <button
                      onClick={() => handleUnflagCard(selectedCard.card.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Unflag Card
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setShowDetailsModal(false)
                        handleFlagCard(selectedCard.card.id)
                      }}
                      className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                    >
                      Flag Card
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowDetailsModal(false)
                      openDeleteModal(selectedCard.card.id)
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Delete Card
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Delete Card</h2>
            <p className="text-gray-600 mb-4">
              This will permanently delete this card. This action cannot be undone.
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
                  setDeleteReason('')
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCard}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
