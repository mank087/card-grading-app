'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface RevenueResponse {
  range: { from: string; to: string }
  headline: {
    total_revenue: number
    total_transactions: number
    today: number
    last_7_days: number
    last_30_days: number
  }
  source_breakdown: Array<{ source: string; revenue: number; count: number }>
  platform_breakdown: Array<{ platform: string; revenue: number; count: number }>
  product_breakdown: Array<{ product: string; revenue: number; count: number }>
  daily_trend: Array<{
    date: string
    stripe_credits: number
    stripe_subscription: number
    apple_iap: number
    google_iap: number
    total: number
  }>
  top_spenders: Array<{ user_id: string; email: string; revenue: number; transactions: number }>
  recent_transactions: Array<{
    id: string
    source: string
    platform: string
    user_id: string
    email: string
    product: string
    amount_usd: number
    created_at: string
  }>
  note?: string
}

const SOURCE_COLORS: Record<string, string> = {
  stripe_credits: '#635bff',      // Stripe purple
  stripe_subscription: '#a78bfa', // Card Lovers
  apple_iap: '#1f2937',           // Apple charcoal
  google_iap: '#34a853',          // Google green
}

const SOURCE_LABELS: Record<string, string> = {
  stripe_credits: 'Stripe Credit Packs',
  stripe_subscription: 'Stripe Card Lovers',
  apple_iap: 'Apple IAP',
  google_iap: 'Google IAP',
}

const PLATFORM_COLORS: Record<string, string> = {
  web: '#635bff',
  ios: '#1f2937',
  android: '#34a853',
}

function dollars(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function defaultRange() {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 3600 * 1000)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<RevenueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState(defaultRange().from)
  const [to, setTo] = useState(defaultRange().to)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ from, to })
      const res = await fetch(`/api/admin/analytics/revenue?${params.toString()}`)
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || `HTTP ${res.status}`)
      }
      setData(await res.json())
    } catch (err: any) {
      setError(err.message || 'Failed to load revenue data')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return <div className="p-6 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>
  }

  if (!data) return null

  const totalInRange = data.daily_trend.reduce((s, d) => s + d.total, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Revenue</h1>
          <p className="text-gray-600 mt-1">
            Combined view across Stripe (web) and Apple / Google IAP (mobile).
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={fetchData}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <HeadlineCard label="Today" value={dollars(data.headline.today)} accent="emerald" />
        <HeadlineCard label="Last 7 days" value={dollars(data.headline.last_7_days)} accent="blue" />
        <HeadlineCard label="Last 30 days" value={dollars(data.headline.last_30_days)} accent="purple" />
        <HeadlineCard label="In range" value={dollars(totalInRange)} accent="amber" />
        <HeadlineCard
          label="Transactions"
          value={data.headline.total_transactions.toLocaleString()}
          accent="gray"
        />
      </div>

      {/* Daily stacked-by-source chart */}
      <Card title="Daily revenue by source">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={data.daily_trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => '$' + v} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: number, name: string) => [dollars(v), SOURCE_LABELS[name] || name]}
              labelFormatter={(l) => `Date: ${l}`}
            />
            <Legend formatter={(v) => SOURCE_LABELS[v] || v} />
            <Bar dataKey="stripe_credits" stackId="rev" fill={SOURCE_COLORS.stripe_credits} />
            <Bar dataKey="stripe_subscription" stackId="rev" fill={SOURCE_COLORS.stripe_subscription} />
            <Bar dataKey="apple_iap" stackId="rev" fill={SOURCE_COLORS.apple_iap} />
            <Bar dataKey="google_iap" stackId="rev" fill={SOURCE_COLORS.google_iap} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Source + Platform breakdowns side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="By source">
          <BreakdownTable
            rows={data.source_breakdown.map((s) => ({
              label: SOURCE_LABELS[s.source] || s.source,
              color: SOURCE_COLORS[s.source] || '#94a3b8',
              revenue: s.revenue,
              count: s.count,
            }))}
            total={data.headline.total_revenue}
          />
        </Card>

        <Card title="By platform">
          <BreakdownTable
            rows={data.platform_breakdown.map((p) => ({
              label: p.platform.toUpperCase(),
              color: PLATFORM_COLORS[p.platform] || '#94a3b8',
              revenue: p.revenue,
              count: p.count,
            }))}
            total={data.headline.total_revenue}
          />
        </Card>
      </div>

      {/* By product */}
      <Card title="By product">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Product</th>
                <th className="py-2 pr-4 text-right">Transactions</th>
                <th className="py-2 pr-4 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.product_breakdown.map((p) => (
                <tr key={p.product} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 font-medium text-gray-900">{p.product}</td>
                  <td className="py-2 pr-4 text-right text-gray-700">{p.count}</td>
                  <td className="py-2 pr-4 text-right text-gray-900 font-semibold">{dollars(p.revenue)}</td>
                </tr>
              ))}
              {data.product_breakdown.length === 0 && (
                <tr><td colSpan={3} className="py-4 text-center text-gray-400">No revenue in range</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top spenders + Recent transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Top spenders (in range)">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4 text-right">Txns</th>
                <th className="py-2 pr-4 text-right">Spent</th>
              </tr>
            </thead>
            <tbody>
              {data.top_spenders.map((u) => (
                <tr key={u.user_id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 text-gray-900 truncate max-w-[180px]">{u.email}</td>
                  <td className="py-2 pr-4 text-right text-gray-700">{u.transactions}</td>
                  <td className="py-2 pr-4 text-right text-gray-900 font-semibold">{dollars(u.revenue)}</td>
                </tr>
              ))}
              {data.top_spenders.length === 0 && (
                <tr><td colSpan={3} className="py-4 text-center text-gray-400">No spenders in range</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card title="Recent transactions">
          <div className="max-h-[420px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_transactions.map((t) => (
                  <tr key={t.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString()}{' '}
                      <span className="text-gray-400">
                        {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-gray-900 truncate max-w-[140px]">{t.email}</td>
                    <td className="py-2 pr-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          background: (SOURCE_COLORS[t.source] || '#94a3b8') + '20',
                          color: SOURCE_COLORS[t.source] || '#475569',
                        }}
                      >
                        {t.product}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-900 font-semibold">{dollars(t.amount_usd)}</td>
                  </tr>
                ))}
                {data.recent_transactions.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-gray-400">No transactions in range</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {data.note && (
        <p className="text-xs text-gray-500 italic">{data.note}</p>
      )}
    </div>
  )
}

function HeadlineCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  const accentClass = {
    emerald: 'border-emerald-200 text-emerald-700',
    blue: 'border-blue-200 text-blue-700',
    purple: 'border-purple-200 text-purple-700',
    amber: 'border-amber-200 text-amber-700',
    gray: 'border-gray-200 text-gray-700',
  }[accent] || 'border-gray-200 text-gray-700'
  return (
    <div className={`bg-white rounded-lg border ${accentClass} p-4`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accentClass.split(' ')[1]}`}>{value}</div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-3">{title}</h2>
      {children}
    </div>
  )
}

function BreakdownTable({
  rows,
  total,
}: {
  rows: Array<{ label: string; color: string; revenue: number; count: number }>
  total: number
}) {
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b">
          <th className="py-2 pr-4"></th>
          <th className="py-2 pr-4">Source</th>
          <th className="py-2 pr-4 text-right">Txns</th>
          <th className="py-2 pr-4 text-right">Revenue</th>
          <th className="py-2 pr-4 text-right">%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b last:border-b-0">
            <td className="py-2 pr-2 w-3">
              <div className="w-3 h-3 rounded" style={{ background: r.color }} />
            </td>
            <td className="py-2 pr-4 font-medium text-gray-900">{r.label}</td>
            <td className="py-2 pr-4 text-right text-gray-700">{r.count}</td>
            <td className="py-2 pr-4 text-right text-gray-900 font-semibold">{dollars(r.revenue)}</td>
            <td className="py-2 pr-4 text-right text-gray-500">
              {total > 0 ? ((r.revenue / total) * 100).toFixed(1) + '%' : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
