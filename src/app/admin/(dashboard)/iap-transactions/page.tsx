'use client'

import { useCallback, useEffect, useState } from 'react'

interface Txn {
  id: string
  user_id: string
  email: string | null
  platform: 'apple' | 'google'
  product_id: string
  product_type: 'consumable' | 'subscription'
  transaction_id: string
  original_transaction_id: string | null
  credits_granted: number
  subscription_period_start: string | null
  subscription_period_end: string | null
  status: string
  environment: string
  created_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

interface Facets {
  platforms: string[]
  statuses: string[]
  products: Array<{ product_id: string; count: number }>
}

interface ListResponse {
  transactions: Txn[]
  pagination: Pagination
  facets: Facets
}

interface DetailResponse {
  transaction: Txn & { raw_receipt: any; purchase_token: string | null; auto_renew_status: boolean | null; is_in_grace_period: boolean; notification_count: number; updated_at: string }
  lineage: Array<{
    id: string
    transaction_id: string
    status: string
    credits_granted: number
    subscription_period_start: string | null
    subscription_period_end: string | null
    created_at: string
  }>
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-gray-100 text-gray-700',
  refunded: 'bg-amber-100 text-amber-800',
  revoked: 'bg-red-100 text-red-800',
  pending: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-200 text-gray-700',
}

const PLATFORM_COLORS: Record<string, string> = {
  apple: 'bg-slate-900 text-white',
  google: 'bg-green-600 text-white',
}

function formatDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleString()
}

export default function IapTransactionsPage() {
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [platform, setPlatform] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [productId, setProductId] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')

  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sp = new URLSearchParams({
        page: String(page),
        limit: '25',
      })
      if (platform !== 'all') sp.set('platform', platform)
      if (status !== 'all') sp.set('status', status)
      if (productId) sp.set('product_id', productId)
      if (email.trim()) sp.set('email', email.trim())
      if (from) sp.set('from', from)
      if (to) sp.set('to', to)
      const res = await fetch(`/api/admin/iap/transactions?${sp}`)
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`)
      setData(await res.json())
    } catch (err: any) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [page, platform, status, productId, email, from, to])

  useEffect(() => { fetchList() }, [fetchList])

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1)
  }, [platform, status, productId, email, from, to])

  const openDetail = async (id: string) => {
    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await fetch(`/api/admin/iap/transactions?id=${id}`)
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`)
      setDetail(await res.json())
    } catch (err: any) {
      alert(err.message || 'Failed to load detail')
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => setDetail(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">IAP Transactions</h1>
        <p className="text-gray-600 mt-1">
          Apple App Store + Google Play purchases. Use for support tickets like
          &ldquo;I bought credits in the app but they didn&rsquo;t arrive.&rdquo;
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Field label="Platform">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="all">All</option>
            {data?.facets.platforms.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="all">All</option>
            {data?.facets.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Product">
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {data?.facets.products.map((p) => (
              <option key={p.product_id} value={p.product_id}>{p.product_id} ({p.count})</option>
            ))}
          </select>
        </Field>
        <Field label="Email contains">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="From">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </Field>
        <Field label="To">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </Field>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : error ? (
          <div className="p-6 bg-red-50 text-red-700 text-sm">{error}</div>
        ) : !data || data.transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No transactions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-gray-500">
                  <th className="py-2.5 px-3 font-medium">When</th>
                  <th className="py-2.5 px-3 font-medium">Platform</th>
                  <th className="py-2.5 px-3 font-medium">User</th>
                  <th className="py-2.5 px-3 font-medium">Product</th>
                  <th className="py-2.5 px-3 font-medium text-right">Credits</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium">Env</th>
                  <th className="py-2.5 px-3 font-medium">Transaction ID</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => openDetail(t.id)}
                    className="border-b last:border-b-0 hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3 whitespace-nowrap text-gray-500">{formatDate(t.created_at)}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLATFORM_COLORS[t.platform]}`}>
                        {t.platform}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-900 truncate max-w-[180px]" title={t.email || t.user_id}>
                      {t.email || <span className="text-gray-400">{t.user_id.slice(0, 8)}…</span>}
                    </td>
                    <td className="py-2 px-3 text-gray-700">{t.product_id}</td>
                    <td className="py-2 px-3 text-right font-semibold text-gray-900">{t.credits_granted}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-700'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-500 text-xs">{t.environment}</td>
                    <td className="py-2 px-3 text-gray-400 font-mono text-xs">{t.transaction_id.slice(0, 14)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.pagination.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              {(data.pagination.page - 1) * data.pagination.limit + 1}-
              {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of {data.pagination.total}
            </div>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 text-sm rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <button
                disabled={page >= data.pagination.total_pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 text-sm rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {(detail || detailLoading) && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeDetail}
        >
          <div
            className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Transaction detail</h2>
              <button onClick={closeDetail} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            {detailLoading || !detail ? (
              <div className="p-8 text-center text-gray-400">Loading…</div>
            ) : (
              <div className="p-5 space-y-5">
                <DetailGrid txn={detail.transaction} />

                {detail.lineage.length > 1 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Subscription lineage</h3>
                    <table className="min-w-full text-xs border border-gray-200 rounded">
                      <thead className="bg-gray-50">
                        <tr className="text-left text-gray-500">
                          <th className="py-1.5 px-2 font-medium">When</th>
                          <th className="py-1.5 px-2 font-medium">Status</th>
                          <th className="py-1.5 px-2 font-medium text-right">Credits</th>
                          <th className="py-1.5 px-2 font-medium">Period end</th>
                          <th className="py-1.5 px-2 font-medium">Txn ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.lineage.map((l) => (
                          <tr
                            key={l.id}
                            className={`border-t border-gray-200 ${l.id === detail.transaction.id ? 'bg-blue-50' : ''}`}
                          >
                            <td className="py-1.5 px-2 text-gray-600">{formatDate(l.created_at)}</td>
                            <td className="py-1.5 px-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-700'}`}>
                                {l.status}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-right text-gray-700">{l.credits_granted}</td>
                            <td className="py-1.5 px-2 text-gray-500">{formatDate(l.subscription_period_end)}</td>
                            <td className="py-1.5 px-2 font-mono text-gray-400">{l.transaction_id.slice(0, 14)}…</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Raw receipt</h3>
                  <pre className="bg-gray-900 text-gray-100 text-xs p-3 rounded overflow-x-auto max-h-96">
                    {JSON.stringify(detail.transaction.raw_receipt, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function DetailGrid({ txn }: { txn: DetailResponse['transaction'] }) {
  const rows: Array<[string, React.ReactNode]> = [
    ['Row ID', <span key="id" className="font-mono text-xs">{txn.id}</span>],
    ['User', <span key="u">{txn.email || <span className="text-gray-400 font-mono text-xs">{txn.user_id}</span>}</span>],
    ['Platform', txn.platform],
    ['Product', txn.product_id],
    ['Product type', txn.product_type],
    ['Status', <span key="s" className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[txn.status] || 'bg-gray-100 text-gray-700'}`}>{txn.status}</span>],
    ['Environment', txn.environment],
    ['Credits granted', txn.credits_granted],
    ['Transaction ID', <span key="t" className="font-mono text-xs">{txn.transaction_id}</span>],
    ['Original transaction ID', txn.original_transaction_id ? <span key="ot" className="font-mono text-xs">{txn.original_transaction_id}</span> : '—'],
    ['Purchase token', txn.purchase_token ? <span key="pt" className="font-mono text-xs break-all">{txn.purchase_token}</span> : '—'],
    ['Subscription period', txn.subscription_period_start || txn.subscription_period_end
      ? `${formatDate(txn.subscription_period_start)} → ${formatDate(txn.subscription_period_end)}`
      : '—'],
    ['Auto-renew', txn.auto_renew_status === null ? '—' : (txn.auto_renew_status ? 'yes' : 'no')],
    ['Grace period', txn.is_in_grace_period ? 'yes' : 'no'],
    ['Notifications received', txn.notification_count],
    ['Created', formatDate(txn.created_at)],
    ['Updated', formatDate(txn.updated_at)],
  ]
  return (
    <table className="min-w-full text-sm">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-gray-100 last:border-b-0">
            <td className="py-1.5 pr-4 text-gray-500 w-48">{k}</td>
            <td className="py-1.5 text-gray-900">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
