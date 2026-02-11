'use client'

import { useState, useEffect } from 'react'
import AdminAuthGuard from '@/components/admin/AdminAuthGuard'

interface Affiliate {
  id: string
  name: string
  email: string
  code: string
  status: 'active' | 'paused' | 'deactivated'
  commission_rate: number
  commission_type: string
  total_referrals: number
  total_commission_earned: number
  total_commission_paid: number
  created_at: string
}

interface AffiliateDetail {
  affiliate: Affiliate
  totalClicks: number
  totalCommissions: number
  pendingCommissions: number
  approvedCommissions: number
  paidCommissions: number
  reversedCommissions: number
  pendingAmount: number
  approvedAmount: number
  paidAmount: number
  conversionRate: number
  commissions: Commission[]
}

interface Commission {
  id: string
  affiliate_id: string
  referred_user_id: string | null
  stripe_session_id: string | null
  order_amount: number
  net_amount: number
  commission_rate: number
  commission_amount: number
  status: string
  hold_until: string | null
  approved_at: string | null
  paid_at: string | null
  payout_reference: string | null
  reversal_reason: string | null
  created_at: string
}

export default function AdminAffiliatesPage() {
  return (
    <AdminAuthGuard>
      {(admin) => <AffiliatesContent adminRole={admin.role} />}
    </AdminAuthGuard>
  )
}

function AffiliatesContent({ adminRole }: { adminRole: string }) {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedAffiliate, setSelectedAffiliate] = useState<AffiliateDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Payout modal state
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [selectedCommissions, setSelectedCommissions] = useState<string[]>([])
  const [payoutReference, setPayoutReference] = useState('')

  useEffect(() => {
    loadAffiliates()
  }, [])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  const loadAffiliates = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/affiliates')
      const data = await res.json()
      setAffiliates(data.affiliates || [])
    } catch (err) {
      setError('Failed to load affiliates')
    } finally {
      setLoading(false)
    }
  }

  const loadAffiliateDetail = async (id: string) => {
    try {
      setLoadingDetail(true)
      setSelectedAffiliate(null)
      const res = await fetch(`/api/admin/affiliates/${id}`)
      const data = await res.json()
      setSelectedAffiliate(data)
    } catch (err) {
      setError('Failed to load affiliate details')
    } finally {
      setLoadingDetail(false)
    }
  }

  const approveCommissions = async () => {
    try {
      setActionLoading('approve')
      const res = await fetch('/api/admin/affiliates/approve-commissions', { method: 'POST' })
      const data = await res.json()
      setSuccessMessage(data.message || `${data.approvedCount} commissions approved`)
      loadAffiliates()
      if (selectedAffiliate) {
        loadAffiliateDetail(selectedAffiliate.affiliate.id)
      }
    } catch (err) {
      setError('Failed to approve commissions')
    } finally {
      setActionLoading(null)
    }
  }

  const handlePayout = async () => {
    if (!payoutReference.trim() || selectedCommissions.length === 0) return
    try {
      setActionLoading('payout')
      const res = await fetch('/api/admin/affiliates/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commission_ids: selectedCommissions,
          payout_reference: payoutReference.trim(),
        }),
      })
      const data = await res.json()
      setSuccessMessage(data.message || `${data.paidCount} commissions paid`)
      setShowPayoutModal(false)
      setSelectedCommissions([])
      setPayoutReference('')
      loadAffiliates()
      if (selectedAffiliate) {
        loadAffiliateDetail(selectedAffiliate.affiliate.id)
      }
    } catch (err) {
      setError('Failed to process payout')
    } finally {
      setActionLoading(null)
    }
  }

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    try {
      setActionLoading(id)
      await fetch(`/api/admin/affiliates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      loadAffiliates()
      if (selectedAffiliate?.affiliate.id === id) {
        loadAffiliateDetail(id)
      }
    } catch (err) {
      setError('Failed to update status')
    } finally {
      setActionLoading(null)
    }
  }

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      deactivated: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      reversed: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Affiliates</h1>
          <p className="text-gray-500 text-sm mt-1">Manage affiliate partners and commissions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={approveCommissions}
            disabled={actionLoading === 'approve'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {actionLoading === 'approve' ? 'Approving...' : 'Approve Pending'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            + Add Affiliate
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">x</button>
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {successMessage}
        </div>
      )}

      {/* Affiliates Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading affiliates...</div>
      ) : affiliates.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No affiliates yet. Click &quot;Add Affiliate&quot; to create one.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Referrals</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Earned</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {affiliates.map((aff) => (
                <tr
                  key={aff.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => loadAffiliateDetail(aff.id)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 text-sm">{aff.name}</div>
                    <div className="text-xs text-gray-500">{aff.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="bg-gray-100 px-2 py-0.5 rounded text-sm font-mono">{aff.code}</code>
                  </td>
                  <td className="px-4 py-3">{statusBadge(aff.status)}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    {aff.commission_type === 'percentage'
                      ? `${(aff.commission_rate * 100).toFixed(0)}%`
                      : formatCurrency(aff.commission_rate)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">{aff.total_referrals}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(aff.total_commission_earned)}</td>
                  <td className="px-4 py-3 text-right text-sm text-green-600">{formatCurrency(aff.total_commission_paid)}</td>
                  <td className="px-4 py-3 text-right text-sm text-yellow-600">
                    {formatCurrency(aff.total_commission_earned - aff.total_commission_paid)}
                  </td>
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => toggleStatus(aff.id, aff.status)}
                      disabled={actionLoading === aff.id}
                      className="text-xs px-2 py-1 rounded border hover:bg-gray-100 disabled:opacity-50"
                    >
                      {aff.status === 'active' ? 'Pause' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Affiliate Detail Panel */}
      {(selectedAffiliate || loadingDetail) && (
        <div className="mt-6 bg-white rounded-xl shadow p-6">
          {loadingDetail ? (
            <div className="text-center py-8 text-gray-500">Loading details...</div>
          ) : selectedAffiliate && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedAffiliate.affiliate.name}</h2>
                  <p className="text-sm text-gray-500">
                    Code: <code className="bg-gray-100 px-2 py-0.5 rounded font-mono">{selectedAffiliate.affiliate.code}</code>
                    {' '} | {selectedAffiliate.affiliate.email}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAffiliate(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase">Clicks</div>
                  <div className="text-lg font-bold">{selectedAffiliate.totalClicks}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase">Conversions</div>
                  <div className="text-lg font-bold">{selectedAffiliate.totalCommissions}</div>
                  <div className="text-xs text-gray-400">{selectedAffiliate.conversionRate}% rate</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3">
                  <div className="text-xs text-yellow-600 uppercase">Pending</div>
                  <div className="text-lg font-bold text-yellow-700">{formatCurrency(selectedAffiliate.pendingAmount)}</div>
                  <div className="text-xs text-yellow-500">{selectedAffiliate.pendingCommissions} commissions</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-xs text-blue-600 uppercase">Approved</div>
                  <div className="text-lg font-bold text-blue-700">{formatCurrency(selectedAffiliate.approvedAmount)}</div>
                  <div className="text-xs text-blue-500">{selectedAffiliate.approvedCommissions} commissions</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs text-green-600 uppercase">Paid</div>
                  <div className="text-lg font-bold text-green-700">{formatCurrency(selectedAffiliate.paidAmount)}</div>
                  <div className="text-xs text-green-500">{selectedAffiliate.paidCommissions} commissions</div>
                </div>
              </div>

              {/* Pay Out Button */}
              {selectedAffiliate.approvedCommissions > 0 && (
                <div className="mb-4">
                  <button
                    onClick={() => {
                      // Pre-select all approved commissions for this affiliate
                      const approvedIds = selectedAffiliate.commissions
                        .filter(c => c.status === 'approved')
                        .map(c => c.id)
                      setSelectedCommissions(approvedIds)
                      setShowPayoutModal(true)
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    Pay Out {formatCurrency(selectedAffiliate.approvedAmount)} ({selectedAffiliate.approvedCommissions} commissions)
                  </button>
                </div>
              )}

              {/* Commission History */}
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Commission History</h3>
              {selectedAffiliate.commissions.length === 0 ? (
                <p className="text-gray-400 text-sm">No commissions yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Order</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Net</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Commission</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Hold Until</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedAffiliate.commissions.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-600">{formatDate(c.created_at)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(c.order_amount)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(c.net_amount)}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(c.commission_amount)}</td>
                          <td className="px-3 py-2">{statusBadge(c.status)}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">
                            {c.hold_until ? formatDate(c.hold_until) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add Affiliate Modal */}
      {showAddModal && (
        <AddAffiliateModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            loadAffiliates()
            setSuccessMessage('Affiliate created successfully')
          }}
        />
      )}

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Mark Commissions as Paid</h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedCommissions.length} commission(s) selected
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payout Reference (PayPal transaction ID, etc.)
              </label>
              <input
                type="text"
                value={payoutReference}
                onChange={(e) => setPayoutReference(e.target.value)}
                placeholder="e.g., PP-12345678"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowPayoutModal(false); setPayoutReference(''); setSelectedCommissions([]); }}
                className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handlePayout}
                disabled={!payoutReference.trim() || actionLoading === 'payout'}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
              >
                {actionLoading === 'payout' ? 'Processing...' : 'Confirm Payout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Add Affiliate Modal
// ============================================================================

function AddAffiliateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    code: '',
    commission_rate: '20',
    commission_type: 'percentage',
    payout_method: 'manual',
    payout_details: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/admin/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          code: form.code,
          commission_rate: parseFloat(form.commission_rate) / 100,
          commission_type: form.commission_type,
          payout_method: form.payout_method,
          payout_details: form.payout_details || null,
          notes: form.notes || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create affiliate')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Add New Affiliate</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Doug the Card Guy"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="doug@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Referral Code *</label>
            <input
              type="text"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="DOUG"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase"
            />
            <p className="text-xs text-gray-400 mt-1">
              This will be used in referral links (?ref={form.code || 'CODE'}) and as a Stripe promo code
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commission Type</label>
              <select
                value={form.commission_type}
                onChange={(e) => setForm({ ...form, commission_type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="percentage">Percentage</option>
                <option value="flat">Flat Amount</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Commission Rate {form.commission_type === 'percentage' ? '(%)' : '($)'}
              </label>
              <input
                type="number"
                value={form.commission_rate}
                onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                min="0"
                max={form.commission_type === 'percentage' ? '100' : undefined}
                step="1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payout Method</label>
              <select
                value={form.payout_method}
                onChange={(e) => setForm({ ...form, payout_method: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="manual">Manual (PayPal/Venmo)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payout Details</label>
              <input
                type="text"
                value={form.payout_details}
                onChange={(e) => setForm({ ...form, payout_details: e.target.value })}
                placeholder="PayPal email or Venmo handle"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Internal notes about this affiliate..."
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
            >
              {submitting ? 'Creating...' : 'Create Affiliate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
