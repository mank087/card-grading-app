'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface MonthBreakdown {
  month: string
  revenue_total: number
  revenue_stripe_credits: number
  revenue_stripe_subscription: number
  revenue_apple_iap: number
  revenue_google_iap: number
  openai_cost: number
  openai_source: 'actual' | 'estimate'
  stripe_fees: number
  stripe_fees_source: 'actual' | 'estimate'
  apple_iap_fee: number
  google_iap_fee: number
  variable_cost_total: number
  fixed_cost_total: number
  gross_margin: number
  gross_margin_pct: number
  net_margin: number
  net_margin_pct: number
  card_count: number
}

interface FixedRow {
  id: string
  vendor: string
  category: string
  amount_usd: number
  cost_type: 'recurring' | 'one_time'
  effective_from: string
  effective_to: string | null
  notes: string | null
}

interface SummaryResponse {
  month: string
  iap_fee_rate_pct: number
  selected: MonthBreakdown
  trend: MonthBreakdown[]
  fixed_by_category: Array<{ category: string; total: number; vendors: string[] }>
  fixed_rows: FixedRow[]
}

const CATEGORIES = [
  'hosting', 'database', 'email', 'monitoring', 'dev_tools',
  'legal', 'marketing', 'apple_dev', 'google_dev', 'domain', 'ai_apis', 'other',
] as const

const CATEGORY_LABELS: Record<string, string> = {
  hosting: 'Hosting',
  database: 'Database',
  email: 'Email',
  monitoring: 'Monitoring',
  dev_tools: 'Dev Tools',
  legal: 'Legal',
  marketing: 'Marketing',
  apple_dev: 'Apple Developer',
  google_dev: 'Google Developer',
  domain: 'Domain',
  ai_apis: 'AI APIs',
  other: 'Other',
}

function dollars(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function defaultMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function AdminCostsPage() {
  const [data, setData] = useState<SummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(defaultMonth())
  const [showEditor, setShowEditor] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  // When the editor opens, scroll it into view. The editor sits below the
  // 12-month chart so without this clicking "Add some" or "Edit fixed costs"
  // appears to do nothing — the new section is below the fold.
  const openEditor = useCallback(() => {
    setShowEditor(true)
    // Defer one tick so the editor mounts before we scroll.
    setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }, [])

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/costs/summary?month=${month}`)
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`)
      setData(await res.json())
    } catch (err: any) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  if (loading && !data) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
  }
  if (error) return <div className="p-6 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>
  if (!data) return null

  const s = data.selected

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Costs &amp; P&amp;L</h1>
          <p className="text-gray-600 mt-1">
            Revenue, variable costs, fixed costs, and margins. IAP fee rate currently {data.iap_fee_rate_pct}% (Small Business Program pending).
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <a
            href={`/api/admin/costs/export?month=${month}`}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-1.5 rounded"
          >
            Export CSV
          </a>
          <button
            onClick={() => showEditor ? setShowEditor(false) : openEditor()}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium px-4 py-1.5 rounded border border-gray-300"
          >
            {showEditor ? 'Hide' : 'Edit'} fixed costs
          </button>
        </div>
      </div>

      {/* Headline */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card label="Revenue" value={dollars(s.revenue_total)} accent="emerald" />
        <Card label="Variable cost" value={dollars(s.variable_cost_total)} accent="amber" />
        <Card label="Fixed cost" value={dollars(s.fixed_cost_total)} accent="purple" />
        <Card
          label="Gross margin"
          value={dollars(s.gross_margin) + ` (${s.gross_margin_pct.toFixed(1)}%)`}
          accent={s.gross_margin >= 0 ? 'blue' : 'red'}
        />
        <Card
          label="Net margin"
          value={dollars(s.net_margin) + ` (${s.net_margin_pct.toFixed(1)}%)`}
          accent={s.net_margin >= 0 ? 'blue' : 'red'}
        />
      </div>

      {/* Runway widget */}
      <RunwayWidget monthlyBurn={Math.max(0, s.variable_cost_total + s.fixed_cost_total - s.revenue_total)} />

      {/* Cost breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Variable costs (this month)">
          <table className="min-w-full text-sm">
            <tbody>
              <Row label="OpenAI grading" amount={s.openai_cost} badge={s.openai_source} />
              <Row label="Stripe processing fees" amount={s.stripe_fees} badge={s.stripe_fees_source} />
              <Row label="Apple IAP fee" amount={s.apple_iap_fee} sub={`${data.iap_fee_rate_pct}% of ${dollars(s.revenue_apple_iap)}`} />
              <Row label="Google IAP fee" amount={s.google_iap_fee} sub={`${data.iap_fee_rate_pct}% of ${dollars(s.revenue_google_iap)}`} />
              <Row label="Total" amount={s.variable_cost_total} bold />
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-3">
            {s.openai_source === 'estimate' && '⚠️ OpenAI cost is estimated from token counts. Add an OPENAI_ADMIN_API_KEY to pull actuals. '}
            {s.stripe_fees_source === 'estimate' && '⚠️ Stripe fees use 2.9% + $0.30 per charge formula. Nightly sync will replace with actuals.'}
          </p>
        </Panel>

        <Panel title="Fixed costs by category">
          {data.fixed_by_category.length === 0 ? (
            <div className="text-sm text-gray-400 py-6 text-center">
              No fixed costs configured.{' '}
              <button onClick={openEditor} className="text-blue-600 hover:underline">Add some</button>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <tbody>
                {data.fixed_by_category.map((c) => (
                  <tr key={c.category} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-medium text-gray-900">{CATEGORY_LABELS[c.category] || c.category}</td>
                    <td className="py-2 pr-4 text-xs text-gray-500">{c.vendors.join(', ')}</td>
                    <td className="py-2 pr-4 text-right text-gray-900 font-semibold">{dollars(c.total)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 pr-4 font-bold text-gray-900">Total</td>
                  <td></td>
                  <td className="py-2 pr-4 text-right font-bold text-gray-900">{dollars(s.fixed_cost_total)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {/* Revenue source split for selected month */}
      <Panel title="Revenue source split (this month)">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <RevenueSplit label="Stripe credit packs" amount={s.revenue_stripe_credits} total={s.revenue_total} />
          <RevenueSplit label="Stripe Card Lovers" amount={s.revenue_stripe_subscription} total={s.revenue_total} />
          <RevenueSplit label="Apple IAP" amount={s.revenue_apple_iap} total={s.revenue_total} />
          <RevenueSplit label="Google IAP" amount={s.revenue_google_iap} total={s.revenue_total} />
        </div>
      </Panel>

      {/* 12-month trend chart */}
      <Panel title="12-month trend">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => '$' + v} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => dollars(v)} />
            <Legend />
            <Line type="monotone" dataKey="revenue_total" name="Revenue" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="variable_cost_total" name="Variable cost" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="fixed_cost_total" name="Fixed cost" stroke="#a78bfa" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="net_margin" name="Net" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="12-month gross + net margin">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data.trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => '$' + v} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => dollars(v)} />
            <Legend />
            <Bar dataKey="gross_margin" name="Gross" fill="#3b82f6" />
            <Bar dataKey="net_margin" name="Net" fill="#8b5cf6" />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      {/* Fixed cost editor */}
      {showEditor && (
        <div ref={editorRef}>
          <FixedCostEditor onChanged={fetchSummary} />
        </div>
      )}
    </div>
  )
}

function RunwayWidget({ monthlyBurn }: { monthlyBurn: number }) {
  const [cash, setCash] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings?key=cash_on_hand_usd')
      .then((r) => r.json())
      .then((j) => {
        if (typeof j.value === 'number') setCash(j.value)
        setUpdatedAt(j.updated_at)
      })
      .catch(() => {})
  }, [])

  const save = async () => {
    const v = parseFloat(draft)
    if (isNaN(v) || v < 0) {
      alert('Enter a positive number')
      return
    }
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'cash_on_hand_usd', value: v }),
    })
    if (res.ok) {
      setCash(v)
      setUpdatedAt(new Date().toISOString())
      setEditing(false)
    }
  }

  const months = cash !== null && monthlyBurn > 0 ? cash / monthlyBurn : null
  const monthsLabel = months === null
    ? '—'
    : !isFinite(months) ? '∞ (profitable)'
    : months.toFixed(1) + ' months'

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Runway</h2>
          <p className="text-xs text-gray-500">
            Months of operation remaining at this month&rsquo;s burn rate.
            Cash-on-hand is manually entered. Last updated: {updatedAt ? new Date(updatedAt).toLocaleDateString() : 'never'}.
          </p>
        </div>
        {!editing ? (
          <button
            onClick={() => { setEditing(true); setDraft(cash !== null ? String(cash) : '') }}
            className="text-xs text-blue-600 hover:underline"
          >
            {cash === null ? 'Set cash on hand' : 'Update'}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="0.00"
              className="border border-gray-300 rounded px-2 py-1 text-sm w-32"
              autoFocus
            />
            <button onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-2 py-1 rounded">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:underline">Cancel</button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Cash on hand</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{cash !== null ? dollars(cash) : '—'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Monthly burn</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{dollars(monthlyBurn)}</div>
          <div className="text-xs text-gray-400 mt-0.5">net loss this month</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Runway</div>
          <div className={`text-2xl font-bold mt-1 ${months !== null && months < 6 && isFinite(months) ? 'text-red-700' : 'text-emerald-700'}`}>{monthsLabel}</div>
        </div>
      </div>
    </div>
  )
}

function Card({ label, value, accent }: { label: string; value: string; accent: string }) {
  const cls = {
    emerald: 'border-emerald-200 text-emerald-700',
    amber: 'border-amber-200 text-amber-700',
    purple: 'border-purple-200 text-purple-700',
    blue: 'border-blue-200 text-blue-700',
    red: 'border-red-200 text-red-700',
  }[accent] || 'border-gray-200 text-gray-700'
  return (
    <div className={`bg-white rounded-lg border ${cls} p-4`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-bold mt-1 ${cls.split(' ')[1]}`}>{value}</div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-3">{title}</h2>
      {children}
    </div>
  )
}

function Row({ label, amount, sub, badge, bold }: { label: string; amount: number; sub?: string; badge?: string; bold?: boolean }) {
  return (
    <tr className={`border-b last:border-b-0 ${bold ? 'font-bold' : ''}`}>
      <td className={`py-2 pr-4 ${bold ? 'font-bold text-gray-900' : 'text-gray-900'}`}>{label}</td>
      <td className="py-2 pr-4 text-xs text-gray-500">
        {badge && (
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${badge === 'actual' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {badge}
          </span>
        )}
        {sub}
      </td>
      <td className={`py-2 pr-4 text-right ${bold ? 'font-bold text-gray-900' : 'text-gray-900 font-semibold'}`}>{dollars(amount)}</td>
    </tr>
  )
}

function RevenueSplit({ label, amount, total }: { label: string; amount: number; total: number }) {
  const pct = total > 0 ? (amount / total) * 100 : 0
  return (
    <div className="bg-gray-50 rounded p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-900 mt-1">{dollars(amount)}</div>
      <div className="text-xs text-gray-400 mt-0.5">{pct.toFixed(1)}%</div>
    </div>
  )
}

// ============================================================
// Fixed cost editor
// ============================================================
function FixedCostEditor({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<FixedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Partial<FixedRow>>({
    vendor: '',
    category: 'hosting',
    amount_usd: 0,
    cost_type: 'recurring',
    effective_from: new Date().toISOString().slice(0, 7) + '-01',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const fetchRows = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/costs/fixed')
      if (res.ok) {
        const json = await res.json()
        setRows(json.costs || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRows() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/admin/costs/fixed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount_usd: Number(form.amount_usd) || 0,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed')
        return
      }
      setForm({
        vendor: '',
        category: 'hosting',
        amount_usd: 0,
        cost_type: 'recurring',
        effective_from: new Date().toISOString().slice(0, 7) + '-01',
        notes: '',
      })
      await fetchRows()
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this cost row?')) return
    await fetch(`/api/admin/costs/fixed?id=${id}`, { method: 'DELETE' })
    await fetchRows()
    onChanged()
  }

  const archive = async (id: string, effective_to: string) => {
    await fetch('/api/admin/costs/fixed', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, effective_to }),
    })
    await fetchRows()
    onChanged()
  }

  const save = async (id: string, patch: Partial<FixedRow>) => {
    const body: any = { id, ...patch }
    if (body.amount_usd !== undefined) body.amount_usd = Number(body.amount_usd)
    const res = await fetch('/api/admin/costs/fixed', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Update failed')
      return false
    }
    await fetchRows()
    onChanged()
    return true
  }

  return (
    <Panel title="Fixed cost rows">
      {/* Add form */}
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-7 gap-2 mb-4 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Vendor</label>
          <input
            value={form.vendor || ''}
            onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
            placeholder="Vercel"
            required
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <select
            value={form.category || 'hosting'}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount $</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.amount_usd ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, amount_usd: Number(e.target.value) }))}
            required
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Type</label>
          <select
            value={form.cost_type || 'recurring'}
            onChange={(e) => setForm((f) => ({ ...f, cost_type: e.target.value as any }))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="recurring">Recurring</option>
            <option value="one_time">One-time</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={form.effective_from || ''}
            onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))}
            required
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Add'}
        </button>
      </form>

      {loading ? (
        <div className="text-center text-gray-400 py-4">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-gray-400 py-4">No rows yet — add your first vendor above.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="py-2 pr-3 font-medium">Vendor</th>
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 pr-3 font-medium text-right">Amount</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">From</th>
                <th className="py-2 pr-3 font-medium">To</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <FixedCostRow
                  key={r.id}
                  row={r}
                  onSave={save}
                  onArchive={archive}
                  onDelete={remove}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

// ============================================================
// One row in the fixed-cost editor — toggles between view and edit mode.
// ============================================================
function FixedCostRow({
  row,
  onSave,
  onArchive,
  onDelete,
}: {
  row: FixedRow
  onSave: (id: string, patch: Partial<FixedRow>) => Promise<boolean>
  onArchive: (id: string, effective_to: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<FixedRow>>(row)

  // If the parent re-fetches and gives us a fresh row, reset the draft in
  // case we were in edit mode but values changed externally.
  useEffect(() => { if (!editing) setDraft(row) }, [row, editing])

  const cancel = () => {
    setDraft(row)
    setEditing(false)
  }

  const commit = async () => {
    setSaving(true)
    const patch: Partial<FixedRow> = {}
    if (draft.vendor !== row.vendor) patch.vendor = draft.vendor
    if (draft.category !== row.category) patch.category = draft.category
    if (Number(draft.amount_usd) !== Number(row.amount_usd)) patch.amount_usd = Number(draft.amount_usd)
    if (draft.cost_type !== row.cost_type) patch.cost_type = draft.cost_type
    if (draft.effective_from !== row.effective_from) patch.effective_from = draft.effective_from
    if ((draft.effective_to || null) !== (row.effective_to || null)) patch.effective_to = draft.effective_to || null
    if ((draft.notes || null) !== (row.notes || null)) patch.notes = draft.notes || null

    if (Object.keys(patch).length === 0) {
      setEditing(false)
      setSaving(false)
      return
    }
    const ok = await onSave(row.id, patch)
    setSaving(false)
    if (ok) setEditing(false)
  }

  if (!editing) {
    return (
      <tr className="border-b last:border-b-0">
        <td className="py-2 pr-3 text-gray-900 font-medium">{row.vendor}</td>
        <td className="py-2 pr-3 text-gray-700">{CATEGORY_LABELS[row.category] || row.category}</td>
        <td className="py-2 pr-3 text-right text-gray-900 font-semibold">{dollars(row.amount_usd)}</td>
        <td className="py-2 pr-3 text-xs text-gray-500">{row.cost_type}</td>
        <td className="py-2 pr-3 text-gray-500">{row.effective_from}</td>
        <td className="py-2 pr-3 text-gray-500">{row.effective_to || '—'}</td>
        <td className="py-2 pr-3 text-right space-x-2 whitespace-nowrap">
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            Edit
          </button>
          {!row.effective_to && (
            <button
              onClick={() => onArchive(row.id, new Date().toISOString().slice(0, 10))}
              className="text-xs text-amber-600 hover:underline"
              title="Set effective_to to today"
            >
              Archive
            </button>
          )}
          <button
            onClick={() => onDelete(row.id)}
            className="text-xs text-red-600 hover:underline"
          >
            Delete
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b last:border-b-0 bg-blue-50">
      <td className="py-2 pr-3">
        <input
          value={draft.vendor || ''}
          onChange={(e) => setDraft((d) => ({ ...d, vendor: e.target.value }))}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </td>
      <td className="py-2 pr-3">
        <select
          value={draft.category || 'other'}
          onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
      </td>
      <td className="py-2 pr-3 text-right">
        <input
          type="number"
          step="0.01"
          min="0"
          value={draft.amount_usd ?? 0}
          onChange={(e) => setDraft((d) => ({ ...d, amount_usd: Number(e.target.value) }))}
          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-right"
        />
      </td>
      <td className="py-2 pr-3">
        <select
          value={draft.cost_type || 'recurring'}
          onChange={(e) => setDraft((d) => ({ ...d, cost_type: e.target.value as 'recurring' | 'one_time' }))}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        >
          <option value="recurring">recurring</option>
          <option value="one_time">one_time</option>
        </select>
      </td>
      <td className="py-2 pr-3">
        <input
          type="date"
          value={draft.effective_from || ''}
          onChange={(e) => setDraft((d) => ({ ...d, effective_from: e.target.value }))}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </td>
      <td className="py-2 pr-3">
        <input
          type="date"
          value={draft.effective_to || ''}
          onChange={(e) => setDraft((d) => ({ ...d, effective_to: e.target.value || null }))}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
          placeholder="ongoing"
        />
      </td>
      <td className="py-2 pr-3 text-right space-x-2 whitespace-nowrap">
        <button
          onClick={commit}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-2 py-1 rounded disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={cancel}
          disabled={saving}
          className="text-xs text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </td>
    </tr>
  )
}
