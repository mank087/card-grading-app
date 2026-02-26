'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AdminAuthGuard from '@/components/admin/AdminAuthGuard'

interface User {
  id: string
  email: string
  created_at: string
  updated_at: string
  card_count: number
  credits_balance: number
  is_suspended: boolean
}

interface UserDetails {
  user: User
  statistics: {
    total_cards: number
    graded_cards: number
    average_grade: number
  }
  recent_cards: Array<{
    id: string
    serial: string | null
    card_name: string | null
    category: string
    created_at: string
    conversational_decimal_grade: number | null
    conversational_whole_grade: number | null
    conversational_condition_label: string | null
    conversational_card_info: any
    ai_grading: any
    featured: string | null
    pokemon_featured: string | null
    card_set: string | null
    release_date: string | null
    manufacturer_name: string | null
    card_number: string | null
  }>
}

interface PaginationData {
  page: number
  limit: number
  total: number
  total_pages: number
}

export default function AdminUsersPage() {
  return (
    <AdminAuthGuard>
      {(admin) => <UsersContent adminRole={admin.role} />}
    </AdminAuthGuard>
  )
}

// Helper functions for card display
const stripMarkdown = (text: string | null | undefined): string | null => {
  if (text === null || text === undefined) return null
  const str = typeof text === 'string' ? text : String(text)
  if (!str) return null
  return str.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\#/g, '').replace(/\_/g, '')
}

const getCardInfo = (card: UserDetails['recent_cards'][0]) => {
  const dvgGrading = card.ai_grading || {}
  const legacyCardInfo = dvgGrading["Card Information"] || dvgGrading.card_info || {}
  return {
    card_name: stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || legacyCardInfo.card_name,
    player_or_character: stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || card.pokemon_featured || legacyCardInfo.player_or_character,
    set_name: stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || legacyCardInfo.set_name,
    year: stripMarkdown(card.conversational_card_info?.year) || card.release_date || legacyCardInfo.year,
  }
}

const getPlayerName = (card: UserDetails['recent_cards'][0]) => {
  const cardInfo = getCardInfo(card)
  const isSportsCard = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'].includes(card.category || '')
  const isOtherCard = card.category === 'Other'
  return (isSportsCard || isOtherCard)
    ? (cardInfo.player_or_character || cardInfo.card_name || 'Unknown')
    : (cardInfo.card_name || cardInfo.player_or_character || 'Unknown Card')
}

const categoryRoutes: Record<string, string> = {
  'Football': '/sports', 'Baseball': '/sports', 'Basketball': '/sports',
  'Hockey': '/sports', 'Soccer': '/sports', 'Wrestling': '/sports',
  'Sports': '/sports', 'Pokemon': '/pokemon', 'MTG': '/mtg',
  'Lorcana': '/lorcana', 'One Piece': '/onepiece', 'Other': '/other'
}

const getCategoryBadge = (category: string | null) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
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
    'One Piece': { bg: 'bg-rose-100', text: 'text-rose-800', label: '🏴‍☠️ One Piece' },
    'Other': { bg: 'bg-gray-100', text: 'text-gray-800', label: '📦 Other' },
  }
  return config[category || ''] || { bg: 'bg-gray-100', text: 'text-gray-600', label: category || 'Unknown' }
}

function UsersContent({ adminRole }: { adminRole: string }) {
  const [users, setUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'suspended'>('all')
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const [deleteReason, setDeleteReason] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [pagination.page, search, status])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search,
        status
      })

      const response = await fetch(`/api/admin/users?${params}`)
      const data = await response.json()

      console.log('Users API Response:', { status: response.status, ok: response.ok, data })

      if (response.ok) {
        setUsers(data.users || [])
        setPagination(data.pagination)
      } else {
        setError(data.error || 'Failed to fetch users')
        console.error('API Error:', data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      setError('Network error: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const fetchUserDetails = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`)
      const data = await response.json()

      if (response.ok) {
        setSelectedUser(data)
        setShowDetailsModal(true)
      }
    } catch (error) {
      console.error('Error fetching user details:', error)
    }
  }

  const handleSuspendUser = async (userId: string) => {
    const reason = prompt('Enter reason for suspension:')
    if (!reason) return

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suspend', reason })
      })

      if (response.ok) {
        alert('User suspended successfully')
        fetchUsers()
      }
    } catch (error) {
      console.error('Error suspending user:', error)
      alert('Failed to suspend user')
    }
  }

  const handleActivateUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' })
      })

      if (response.ok) {
        alert('User activated successfully')
        fetchUsers()
      }
    } catch (error) {
      console.error('Error activating user:', error)
      alert('Failed to activate user')
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteUserId || !deleteReason.trim()) {
      alert('Please provide a reason for deletion')
      return
    }

    try {
      const response = await fetch(
        `/api/admin/users/${deleteUserId}?reason=${encodeURIComponent(deleteReason)}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        alert('User deleted successfully')
        setShowDeleteModal(false)
        setDeleteUserId(null)
        setDeleteReason('')
        fetchUsers()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user')
    }
  }

  const openDeleteModal = (userId: string) => {
    setDeleteUserId(userId)
    setShowDeleteModal(true)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
        <p className="text-gray-600">Manage users, view activity, and moderate accounts</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as 'all' | 'active' | 'suspended')
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Users</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="text-red-800">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading users...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">Error loading users. Check console for details.</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No users found</p>
            <p className="text-xs text-gray-400 mt-2">Total: {pagination.total}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cards
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Credits
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Active
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{user.email}</div>
                        <div className="text-xs text-gray-500">{user.id.substring(0, 8)}...</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.card_count}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${user.credits_balance > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {user.credits_balance}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {user.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.is_suspended ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            Suspended
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => fetchUserDetails(user.id)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          View
                        </button>
                        {!user.is_suspended ? (
                          <button
                            onClick={() => handleSuspendUser(user.id)}
                            className="text-orange-600 hover:text-orange-900 mr-3"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivateUser(user.id)}
                            className="text-green-600 hover:text-green-900 mr-3"
                          >
                            Activate
                          </button>
                        )}
                        {adminRole === 'super_admin' && (
                          <button
                            onClick={() => openDeleteModal(user.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        )}
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
                of <span className="font-medium">{pagination.total}</span> users
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
        )}
      </div>

      {/* User Details Modal */}
      {showDetailsModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900">User Details</h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-6">
                {/* User Info */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Account Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div><strong>Email:</strong> {selectedUser.user.email}</div>
                    <div><strong>User ID:</strong> {selectedUser.user.id}</div>
                    <div>
                      <strong>Joined:</strong>{' '}
                      {new Date(selectedUser.user.created_at).toLocaleString()}
                    </div>
                    <div>
                      <strong>Status:</strong>{' '}
                      {selectedUser.user.is_suspended ? (
                        <span className="text-red-600 font-semibold">Suspended</span>
                      ) : (
                        <span className="text-green-600 font-semibold">Active</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Statistics</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {selectedUser.statistics.total_cards}
                      </div>
                      <div className="text-sm text-gray-600">Total Cards</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {selectedUser.statistics.graded_cards}
                      </div>
                      <div className="text-sm text-gray-600">Graded</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-purple-600">
                        {selectedUser.statistics.average_grade.toFixed(1)}
                      </div>
                      <div className="text-sm text-gray-600">Avg Grade</div>
                    </div>
                  </div>
                </div>

                {/* Recent Cards */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Recent Cards</h3>
                  <div className="space-y-2">
                    {selectedUser.recent_cards.length === 0 ? (
                      <p className="text-gray-500">No cards uploaded yet</p>
                    ) : (
                      selectedUser.recent_cards.map((card) => {
                        const route = categoryRoutes[card.category || ''] || '/other'
                        const badge = getCategoryBadge(card.category)
                        const cardInfo = getCardInfo(card)
                        const name = getPlayerName(card)
                        const grade = card.conversational_decimal_grade
                        const wholeGrade = grade !== null ? Math.round(grade) : null

                        return (
                          <Link
                            key={card.id}
                            href={`${route}/${card.id}`}
                            className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-lg p-3 transition-colors group"
                          >
                            {/* Grade circle */}
                            <div className="flex-shrink-0">
                              {wholeGrade !== null ? (
                                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-purple-100 text-purple-800 font-bold text-sm">
                                  {wholeGrade}
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-200 text-gray-400 text-xs">
                                  N/A
                                </span>
                              )}
                            </div>

                            {/* Card info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-semibold text-gray-900 truncate group-hover:text-purple-700">
                                  {name}
                                </span>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${badge.bg} ${badge.text}`}>
                                  {badge.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                {cardInfo.set_name && (
                                  <span className="truncate">{cardInfo.set_name}</span>
                                )}
                                {cardInfo.year && (
                                  <span>({cardInfo.year})</span>
                                )}
                                {card.conversational_condition_label && (
                                  <>
                                    <span className="text-gray-300">|</span>
                                    <span>{card.conversational_condition_label.replace(/\s*\([A-Z]+\)/, '')}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Serial */}
                            <div className="flex-shrink-0 text-right">
                              {card.serial && (
                                <div className="text-[10px] font-mono text-gray-400">{card.serial}</div>
                              )}
                              <div className="text-[10px] text-gray-400">
                                {new Date(card.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </Link>
                        )
                      })
                    )}
                  </div>
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
            <h2 className="text-xl font-bold text-gray-900 mb-4">Delete User</h2>
            <p className="text-gray-600 mb-4">
              This will permanently delete the user and all their cards. This action cannot be undone.
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
                  setDeleteUserId(null)
                  setDeleteReason('')
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
