'use client'

import { useState, useEffect } from 'react'
import AdminAuthGuard from '@/components/admin/AdminAuthGuard'
import Image from 'next/image'
import Link from 'next/link'

interface Flag {
  id: string
  card_id: string
  flagged_by: string
  reason: string
  severity: string
  status: string
  created_at: string
  resolved_at: string | null
  resolution_notes: string | null
  card: {
    id: string
    category: string
    front_path: string
    conversational_decimal_grade: number | null
    user_id: string
  } | null
  user_email: string | null
  flagged_by_admin: {
    email: string
    full_name: string | null
  }
}

interface PaginationData {
  page: number
  limit: number
  total: number
  total_pages: number
}

export default function AdminModerationPage() {
  return (
    <AdminAuthGuard>
      {(admin) => <ModerationContent />}
    </AdminAuthGuard>
  )
}

function ModerationContent() {
  const [flags, setFlags] = useState<Flag[]>([])
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0
  })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [selectedFlag, setSelectedFlag] = useState<Flag | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [resolutionNotes, setResolutionNotes] = useState('')

  useEffect(() => {
    fetchFlags()
  }, [pagination.page, statusFilter, severityFilter])

  const fetchFlags = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        status: statusFilter,
        severity: severityFilter
      })

      const response = await fetch(`/api/admin/moderation/flags?${params}`)
      const data = await response.json()

      if (response.ok) {
        setFlags(data.flags)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching flags:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolveFlag = async (flagId: string) => {
    try {
      const response = await fetch(`/api/admin/moderation/flags/${flagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', notes: resolutionNotes })
      })

      if (response.ok) {
        alert('Flag resolved successfully')
        setShowDetailsModal(false)
        setSelectedFlag(null)
        setResolutionNotes('')
        fetchFlags()
      }
    } catch (error) {
      console.error('Error resolving flag:', error)
      alert('Failed to resolve flag')
    }
  }

  const handleDismissFlag = async (flagId: string) => {
    try {
      const response = await fetch(`/api/admin/moderation/flags/${flagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', notes: resolutionNotes })
      })

      if (response.ok) {
        alert('Flag dismissed successfully')
        setShowDetailsModal(false)
        setSelectedFlag(null)
        setResolutionNotes('')
        fetchFlags()
      }
    } catch (error) {
      console.error('Error dismissing flag:', error)
      alert('Failed to dismiss flag')
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800'
      case 'medium':
        return 'bg-orange-100 text-orange-800'
      case 'low':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'dismissed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Content Moderation</h1>
        <p className="text-gray-600">Review and manage flagged content</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Pending Flags</div>
          <div className="text-3xl font-bold text-orange-600">
            {flags.filter(f => f.status === 'pending').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Resolved Today</div>
          <div className="text-3xl font-bold text-green-600">
            {flags.filter(f =>
              f.status === 'resolved' &&
              f.resolved_at &&
              new Date(f.resolved_at).toDateString() === new Date().toDateString()
            ).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">High Severity</div>
          <div className="text-3xl font-bold text-red-600">
            {flags.filter(f => f.severity === 'high' && f.status === 'pending').length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Status Filter */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
              <option value="all">All Flags</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Flags Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading flags...</div>
        ) : flags.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No flags found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Card
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Flagged By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {flags.map((flag) => (
                    <tr key={flag.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {flag.card ? (
                          <div className="flex items-center">
                            <div className="relative w-12 h-16 mr-3 flex-shrink-0">
                              {flag.card.front_path ? (
                                <Image
                                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/card-images/${flag.card.front_path}`}
                                  alt="Card"
                                  fill
                                  className="object-contain rounded"
                                />
                              ) : (
                                <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center">
                                  <span className="text-xs text-gray-400">No img</span>
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {flag.card.category}
                              </div>
                              <div className="text-xs text-gray-500">
                                {flag.user_email || 'Unknown user'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Card deleted</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {flag.reason}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(flag.severity)}`}>
                          {flag.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(flag.status)}`}>
                          {flag.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {flag.flagged_by_admin.full_name || flag.flagged_by_admin.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(flag.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedFlag(flag)
                            setShowDetailsModal(true)
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Review
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
                of <span className="font-medium">{pagination.total}</span> flags
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

      {/* Flag Details Modal */}
      {showDetailsModal && selectedFlag && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Flag Review</h2>
                <button
                  onClick={() => {
                    setShowDetailsModal(false)
                    setSelectedFlag(null)
                    setResolutionNotes('')
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-6">
                {/* Card Preview */}
                {selectedFlag.card && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Flagged Card</h3>
                    <div className="flex gap-4">
                      <div className="relative w-48 h-64 flex-shrink-0">
                        {selectedFlag.card.front_path ? (
                          <Image
                            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/card-images/${selectedFlag.card.front_path}`}
                            alt="Card front"
                            fill
                            className="object-contain rounded-lg"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                            <span className="text-gray-400">No image</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                          <div><strong>Category:</strong> {selectedFlag.card.category}</div>
                          <div>
                            <strong>Grade:</strong>{' '}
                            {selectedFlag.card.conversational_decimal_grade ? (
                              <span className="font-bold text-green-600">
                                {selectedFlag.card.conversational_decimal_grade}
                              </span>
                            ) : (
                              <span className="text-gray-400">Not graded</span>
                            )}
                          </div>
                          <div><strong>User:</strong> {selectedFlag.user_email || 'Unknown'}</div>
                          <div>
                            <Link
                              href={`/admin/cards?card_id=${selectedFlag.card_id}`}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              View full card details →
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Flag Info */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Flag Information</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                    <div>
                      <strong>Reason:</strong> {selectedFlag.reason}
                    </div>
                    <div>
                      <strong>Severity:</strong>{' '}
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(selectedFlag.severity)}`}>
                        {selectedFlag.severity.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <strong>Flagged by:</strong>{' '}
                      {selectedFlag.flagged_by_admin.full_name || selectedFlag.flagged_by_admin.email}
                    </div>
                    <div>
                      <strong>Flagged on:</strong>{' '}
                      {new Date(selectedFlag.created_at).toLocaleString()}
                    </div>
                    <div>
                      <strong>Status:</strong>{' '}
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedFlag.status)}`}>
                        {selectedFlag.status}
                      </span>
                    </div>
                    {selectedFlag.resolution_notes && (
                      <div>
                        <strong>Resolution Notes:</strong> {selectedFlag.resolution_notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Resolution */}
                {selectedFlag.status === 'pending' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Resolution</h3>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Resolution notes (optional):
                      </label>
                      <textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        placeholder="Add any notes about your decision..."
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleResolveFlag(selectedFlag.id)}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        Resolve (Action Taken)
                      </button>
                      <button
                        onClick={() => handleDismissFlag(selectedFlag.id)}
                        className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                      >
                        Dismiss (No Action)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
