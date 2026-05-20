'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface ConversionAnalytics {
  overview: {
    total_users: number
    users_used_free_credit: number
    users_made_purchase: number
    converted_users: number
    conversion_rate: number
    overall_purchase_rate: number
    total_founders: number
  }
  time_to_purchase: {
    average_days: number
    median_days: number
    min_days: number
    max_days: number
  }
  purchase_timing: {
    same_day: number
    within_3_days: number
    within_7_days: number
    within_30_days: number
    over_30_days: number
    total: number
  }
  package_breakdown: {
    counts: Record<string, number>
    revenue: Record<string, number>
    total_purchases: number
    total_revenue: number
  }
  weekly_trends: Array<{ week: string; signups: number; conversions: number; rate: number }>
  by_platform: Array<{
    platform: 'web' | 'ios_app' | 'android_app'
    signups: number
    graded: number
    purchased: number
    graded_rate: number
    purchase_rate: number
    grader_to_buyer_rate: number
  }>
}

interface UserAnalytics {
  overview: {
    total_users: number
    active_users_7d: number
    active_users_30d: number
    active_users_90d: number
    engagement_rate: number
    users_with_cards: number
  }
  by_platform: { web: number; ios_app: number; android_app: number }
  growth: Array<{ date: string; web: number; ios_app: number; android_app: number; total: number; cumulative: number }>
  weekly_acquisition: Array<{ week: string; web: number; ios_app: number; android_app: number; total: number }>
}

interface GradingAnalytics {
  overview: {
    total_graded: number
    average_grade: number
    perfect_tens: number
    perfect_ten_rate: number
    high_grades_9_plus: number
    high_grade_rate: number
  }
  by_platform: { web: number; ios_app: number; android_app: number }
  distribution: Array<{ grade: number; count: number; percentage: string }>
  by_category: Array<{ category: string; total_cards: number; average_grade: number }>
  weekly_trends: Array<{ week: string; web: number; ios_app: number; android_app: number; total: number; avg_grade: number }>
}

interface CardAnalytics {
  overview: {
    total_cards: number
    public_cards: number
    private_cards: number
    cards_last_7_days: number
    cards_last_30_days: number
  }
  by_platform: { web: number; ios_app: number; android_app: number }
  by_category: Array<{ category: string; count: number; percentage: string }>
  weekly_uploads: Array<{ week: string; web: number; ios_app: number; android_app: number; total: number }>
}

// FinancialAnalytics removed — superseded by /admin/costs (which pulls
// actual OpenAI + Stripe + IAP fees + manual fixed costs and computes
// real gross / net margin instead of the old cards-table cost estimate).

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#f97316']
const PACKAGE_COLORS: Record<string, string> = {
  basic: '#3b82f6',
  pro: '#8b5cf6',
  elite: '#f59e0b',
  vip: '#dc2626',
  card_lovers_monthly: '#ec4899',
  card_lovers_annual: '#be185d',
  founders: '#fbbf24'
}

// Default range: last 30 days
function defaultDateRange() {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 3600 * 1000)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

const PLATFORM_LABELS = {
  web: 'Web',
  ios_app: 'iOS',
  android_app: 'Android',
} as const

const PLATFORM_COLORS = {
  web: '#635bff',     // purple
  ios_app: '#1f2937', // charcoal
  android_app: '#34a853', // google green
} as const

export default function AdminAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'acquisition' | 'grading' | 'cards' | 'conversion'>('users')
  const [loading, setLoading] = useState(true)
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null)
  const [gradingAnalytics, setGradingAnalytics] = useState<GradingAnalytics | null>(null)
  const [cardAnalytics, setCardAnalytics] = useState<CardAnalytics | null>(null)
  const [conversionAnalytics, setConversionAnalytics] = useState<ConversionAnalytics | null>(null)
  const [conversionLoading, setConversionLoading] = useState(false)

  // Shared date range — applies to every tab. Default last 30 days.
  const initial = defaultDateRange()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ from, to }).toString()
      const [usersRes, gradingRes, cardsRes] = await Promise.all([
        fetch(`/api/admin/analytics/users?${qs}`),
        fetch(`/api/admin/analytics/grading?${qs}`),
        fetch(`/api/admin/analytics/cards?${qs}`),
      ])
      if (usersRes.ok) setUserAnalytics(await usersRes.json())
      if (gradingRes.ok) setGradingAnalytics(await gradingRes.json())
      if (cardsRes.ok) setCardAnalytics(await cardsRes.json())
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Conversion is fetched lazily when the tab is opened (or when the date
  // range changes while it's the active tab).
  const fetchConversionAnalytics = useCallback(async () => {
    setConversionLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('startDate', from)
      params.append('endDate', to)
      const res = await fetch(`/api/admin/analytics/conversion?${params.toString()}`)
      if (res.ok) setConversionAnalytics(await res.json())
    } catch (error) {
      console.error('Error fetching conversion analytics:', error)
    } finally {
      setConversionLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    if (activeTab === 'conversion') {
      fetchConversionAnalytics()
    }
  }, [activeTab, fetchConversionAnalytics])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header + shared date range */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Platform Analytics</h1>
          <p className="text-gray-600 mt-1">
            User acquisition, grading volume, and conversion — split by Web / iOS / Android.
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
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {[
            { key: 'users' as const, label: 'Users', icon: '👥' },
            { key: 'acquisition' as const, label: 'Acquisition', icon: '🚀' },
            { key: 'grading' as const, label: 'Grading', icon: '⭐' },
            { key: 'cards' as const, label: 'Cards', icon: '🎴' },
            { key: 'conversion' as const, label: 'Conversion', icon: '📈' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* User Analytics Tab */}
      {activeTab === 'users' && userAnalytics && (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{userAnalytics.overview.total_users.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-2">All registered users</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Active Users (30d)</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{userAnalytics.overview.active_users_30d}</p>
              <p className="text-sm text-gray-500 mt-2">Users who uploaded cards</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Engagement Rate</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{userAnalytics.overview.engagement_rate}%</p>
              <p className="text-sm text-gray-500 mt-2">{userAnalytics.overview.users_with_cards} users with cards</p>
            </div>
          </div>

          {/* Platform split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {(['web', 'ios_app', 'android_app'] as const).map((p) => (
              <div key={p} className="bg-white rounded-lg shadow p-6 flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex-shrink-0"
                  style={{ background: PLATFORM_COLORS[p] }}
                />
                <div>
                  <p className="text-sm text-gray-600">{PLATFORM_LABELS[p]} signups</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {userAnalytics.by_platform[p].toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">
                    {userAnalytics.overview.total_users > 0
                      ? ((userAnalytics.by_platform[p] / userAnalytics.overview.total_users) * 100).toFixed(1)
                      : '0'}% of total
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Weekly Acquisition — stacked by platform */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Acquisition (by platform)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={userAnalytics.weekly_acquisition}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip formatter={(v: number, name: string) => [v, PLATFORM_LABELS[name as keyof typeof PLATFORM_LABELS] || name]} />
                <Legend formatter={(v) => PLATFORM_LABELS[v as keyof typeof PLATFORM_LABELS] || v} />
                <Bar dataKey="web" stackId="users" fill={PLATFORM_COLORS.web} />
                <Bar dataKey="ios_app" stackId="users" fill={PLATFORM_COLORS.ios_app} />
                <Bar dataKey="android_app" stackId="users" fill={PLATFORM_COLORS.android_app} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cumulative User Growth */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cumulative User Growth (Last 90 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userAnalytics.growth.slice(-90)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="cumulative" stroke="#3b82f6" name="Total Users" dot={false} />
                <Line type="monotone" dataKey="total" stroke="#10b981" name="New Users (daily)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Acquisition Tab */}
      {activeTab === 'acquisition' && userAnalytics && (
        <div className="space-y-6">
          {/* Platform headline cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(['web', 'ios_app', 'android_app'] as const).map((p) => {
              // New users in selected range, per platform
              const inRange = userAnalytics.weekly_acquisition.reduce((s, w) => s + w[p], 0)
              return (
                <div key={p} className="bg-white rounded-lg shadow p-6 border-l-4" style={{ borderLeftColor: PLATFORM_COLORS[p] }}>
                  <p className="text-sm text-gray-600">{PLATFORM_LABELS[p]} — new in range</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{inRange.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-2">{userAnalytics.by_platform[p].toLocaleString()} total all-time</p>
                </div>
              )
            })}
          </div>

          {/* Acquisition trend (stacked bars) */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Acquisition trend (in range)</h3>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={userAnalytics.weekly_acquisition}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip formatter={(v: number, name: string) => [v, PLATFORM_LABELS[name as keyof typeof PLATFORM_LABELS] || name]} />
                <Legend formatter={(v) => PLATFORM_LABELS[v as keyof typeof PLATFORM_LABELS] || v} />
                <Bar dataKey="web" stackId="users" fill={PLATFORM_COLORS.web} />
                <Bar dataKey="ios_app" stackId="users" fill={PLATFORM_COLORS.ios_app} />
                <Bar dataKey="android_app" stackId="users" fill={PLATFORM_COLORS.android_app} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Platform share pie */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">All-time signup share by platform</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={(['web', 'ios_app', 'android_app'] as const).map((p) => ({
                    name: PLATFORM_LABELS[p],
                    value: userAnalytics.by_platform[p],
                    platform: p,
                  }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {(['web', 'ios_app', 'android_app'] as const).map((p) => (
                    <Cell key={p} fill={PLATFORM_COLORS[p]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Grading Analytics Tab */}
      {activeTab === 'grading' && gradingAnalytics && (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Total Graded</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{gradingAnalytics.overview.total_graded.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Average Grade</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{gradingAnalytics.overview.average_grade}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Perfect 10s</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{gradingAnalytics.overview.perfect_tens}</p>
              <p className="text-sm text-gray-500 mt-1">{gradingAnalytics.overview.perfect_ten_rate}%</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">High Grades (9+)</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{gradingAnalytics.overview.high_grades_9_plus}</p>
              <p className="text-sm text-gray-500 mt-1">{gradingAnalytics.overview.high_grade_rate}%</p>
            </div>
          </div>

          {/* Grade Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Grade Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={gradingAnalytics.distribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grade" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" name="Cards" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Grade Distribution (Pie)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={gradingAnalytics.distribution}
                    dataKey="count"
                    nameKey="grade"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {gradingAnalytics.distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Average Grade by Category */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Average Grade by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={gradingAnalytics.by_category}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Bar dataKey="average_grade" fill="#10b981" name="Avg Grade" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Grading by platform — headline cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(['web', 'ios_app', 'android_app'] as const).map((p) => (
              <div key={p} className="bg-white rounded-lg shadow p-6 border-l-4" style={{ borderLeftColor: PLATFORM_COLORS[p] }}>
                <p className="text-sm text-gray-600">{PLATFORM_LABELS[p]} — cards graded</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{gradingAnalytics.by_platform[p].toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {gradingAnalytics.overview.total_graded > 0
                    ? ((gradingAnalytics.by_platform[p] / gradingAnalytics.overview.total_graded) * 100).toFixed(1)
                    : '0'}% of total
                </p>
              </div>
            ))}
          </div>

          {/* Weekly Grading Volume — stacked by platform */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Grading Volume (by platform)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={gradingAnalytics.weekly_trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip formatter={(v: number, name: string) => [v, PLATFORM_LABELS[name as keyof typeof PLATFORM_LABELS] || name]} />
                <Legend formatter={(v) => PLATFORM_LABELS[v as keyof typeof PLATFORM_LABELS] || v} />
                <Bar dataKey="web" stackId="cards" fill={PLATFORM_COLORS.web} />
                <Bar dataKey="ios_app" stackId="cards" fill={PLATFORM_COLORS.ios_app} />
                <Bar dataKey="android_app" stackId="cards" fill={PLATFORM_COLORS.android_app} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Weekly Average Grade */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Average Grade</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={gradingAnalytics.weekly_trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Line type="monotone" dataKey="avg_grade" stroke="#8b5cf6" name="Avg Grade" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Card Analytics Tab */}
      {activeTab === 'cards' && cardAnalytics && (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Total Cards</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{cardAnalytics.overview.total_cards.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Public Cards</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{cardAnalytics.overview.public_cards.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Last 7 Days</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{cardAnalytics.overview.cards_last_7_days}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Last 30 Days</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">{cardAnalytics.overview.cards_last_30_days}</p>
            </div>
          </div>

          {/* Category Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cards by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={cardAnalytics.by_category}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {cardAnalytics.by_category.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Categories</h3>
              <div className="space-y-3">
                {cardAnalytics.by_category.slice(0, 5).map((cat, idx) => (
                  <div key={cat.category} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm mr-3"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                        {idx + 1}
                      </span>
                      <span className="font-medium text-gray-900">{cat.category}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{cat.count.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{cat.percentage}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Platform split for cards */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cards by Platform</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={(['web', 'ios_app', 'android_app'] as const).map((p) => ({
                    name: PLATFORM_LABELS[p],
                    value: cardAnalytics.by_platform[p],
                  }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {(['web', 'ios_app', 'android_app'] as const).map((p) => (
                    <Cell key={p} fill={PLATFORM_COLORS[p]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Upload Trends — stacked by platform */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Uploads (by platform)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cardAnalytics.weekly_uploads}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip formatter={(v: number, name: string) => [v, PLATFORM_LABELS[name as keyof typeof PLATFORM_LABELS] || name]} />
                <Legend formatter={(v) => PLATFORM_LABELS[v as keyof typeof PLATFORM_LABELS] || v} />
                <Bar dataKey="web" stackId="cards" fill={PLATFORM_COLORS.web} />
                <Bar dataKey="ios_app" stackId="cards" fill={PLATFORM_COLORS.ios_app} />
                <Bar dataKey="android_app" stackId="cards" fill={PLATFORM_COLORS.android_app} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Conversion Analytics Tab */}
      {activeTab === 'conversion' && (
        <div className="space-y-6">
          {conversionLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : conversionAnalytics ? (
            <>
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{conversionAnalytics.overview.total_users.toLocaleString()}</p>
                  <p className="text-sm text-gray-500 mt-2">All registered users</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm text-gray-600">Used Free Credit</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">{conversionAnalytics.overview.users_used_free_credit.toLocaleString()}</p>
                  <p className="text-sm text-gray-500 mt-2">Users who graded cards</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm text-gray-600">Made Purchase</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{conversionAnalytics.overview.users_made_purchase.toLocaleString()}</p>
                  <p className="text-sm text-gray-500 mt-2">{conversionAnalytics.overview.overall_purchase_rate}% of users</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6 border-2 border-purple-200">
                  <p className="text-sm text-gray-600">Conversion Rate</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">{conversionAnalytics.overview.conversion_rate}%</p>
                  <p className="text-sm text-gray-500 mt-2">{conversionAnalytics.overview.converted_users} converted users</p>
                </div>
              </div>

              {/* Platform funnel comparison — "Free vs Paid by platform" */}
              {conversionAnalytics.by_platform && conversionAnalytics.by_platform.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Funnel by Platform</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Of users who signed up from each platform, how many graded a card (used free credit) and how many made a purchase (Stripe or IAP).
                  </p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="py-2 pr-4 font-medium">Platform</th>
                          <th className="py-2 pr-4 font-medium text-right">Signups</th>
                          <th className="py-2 pr-4 font-medium text-right">Graded</th>
                          <th className="py-2 pr-4 font-medium text-right">Purchased</th>
                          <th className="py-2 pr-4 font-medium text-right">Graded %</th>
                          <th className="py-2 pr-4 font-medium text-right">Purchase %</th>
                          <th className="py-2 pr-4 font-medium text-right">Grader → Buyer %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conversionAnalytics.by_platform.map((row) => (
                          <tr key={row.platform} className="border-b last:border-b-0">
                            <td className="py-2 pr-4">
                              <span className="inline-flex items-center gap-2">
                                <span className="w-3 h-3 rounded" style={{ background: PLATFORM_COLORS[row.platform] }} />
                                <span className="font-medium text-gray-900">{PLATFORM_LABELS[row.platform]}</span>
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-right text-gray-900 font-semibold">{row.signups.toLocaleString()}</td>
                            <td className="py-2 pr-4 text-right text-gray-700">{row.graded.toLocaleString()}</td>
                            <td className="py-2 pr-4 text-right text-gray-900 font-semibold">{row.purchased.toLocaleString()}</td>
                            <td className="py-2 pr-4 text-right text-gray-500">{row.graded_rate}%</td>
                            <td className="py-2 pr-4 text-right text-emerald-700 font-semibold">{row.purchase_rate}%</td>
                            <td className="py-2 pr-4 text-right text-gray-500">{row.grader_to_buyer_rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    Signups = users with a row in user_credits attributed to this platform via signup_source.
                    Graded = used at least one credit. Purchased = at least one Stripe or production IAP transaction.
                  </p>
                </div>
              )}

              {/* Time to Purchase Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Time to First Purchase</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Average</p>
                      <p className="text-2xl font-bold text-gray-900">{conversionAnalytics.time_to_purchase.average_days} days</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Median</p>
                      <p className="text-2xl font-bold text-gray-900">{conversionAnalytics.time_to_purchase.median_days} days</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Minimum</p>
                      <p className="text-2xl font-bold text-green-600">{conversionAnalytics.time_to_purchase.min_days} days</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Maximum</p>
                      <p className="text-2xl font-bold text-orange-600">{conversionAnalytics.time_to_purchase.max_days} days</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchase Timing Breakdown</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Same Day', value: conversionAnalytics.purchase_timing.same_day, color: 'bg-green-500' },
                      { label: 'Within 3 Days', value: conversionAnalytics.purchase_timing.within_3_days - conversionAnalytics.purchase_timing.same_day, color: 'bg-blue-500' },
                      { label: 'Within 7 Days', value: conversionAnalytics.purchase_timing.within_7_days - conversionAnalytics.purchase_timing.within_3_days, color: 'bg-purple-500' },
                      { label: 'Within 30 Days', value: conversionAnalytics.purchase_timing.within_30_days - conversionAnalytics.purchase_timing.within_7_days, color: 'bg-orange-500' },
                      { label: 'Over 30 Days', value: conversionAnalytics.purchase_timing.over_30_days, color: 'bg-gray-500' }
                    ].map(item => {
                      const percentage = conversionAnalytics.purchase_timing.total > 0
                        ? Math.round((item.value / conversionAnalytics.purchase_timing.total) * 100)
                        : 0
                      return (
                        <div key={item.label} className="flex items-center">
                          <span className="w-28 text-sm text-gray-600">{item.label}</span>
                          <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${item.color}`} style={{ width: `${percentage}%` }}></div>
                          </div>
                          <span className="w-16 text-right text-sm font-medium text-gray-900">{item.value} ({percentage}%)</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Package Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Package Sales</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={Object.entries(conversionAnalytics.package_breakdown.counts).filter(([, v]) => v > 0).map(([name, value]) => ({
                          name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                          value
                        }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {Object.keys(conversionAnalytics.package_breakdown.counts).map((pkg, index) => (
                          <Cell key={`cell-${index}`} fill={PACKAGE_COLORS[pkg] || COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Package</h3>
                  <div className="space-y-4">
                    {Object.entries(conversionAnalytics.package_breakdown.revenue).filter(([, rev]) => rev > 0).map(([pkg, revenue]) => (
                      <div key={pkg} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: PACKAGE_COLORS[pkg] || '#6b7280' }}></div>
                          <span className="font-medium text-gray-900">{pkg.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">${revenue.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">{conversionAnalytics.package_breakdown.counts[pkg]} purchases</p>
                        </div>
                      </div>
                    ))}
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900">Total Revenue</span>
                        <span className="font-bold text-green-600">${conversionAnalytics.package_breakdown.total_revenue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekly Conversion Trends */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Conversion Trends (Last 12 Weeks)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={conversionAnalytics.weekly_trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="signups" fill="#3b82f6" name="Signups" />
                    <Bar yAxisId="left" dataKey="conversions" fill="#10b981" name="Conversions" />
                    <Line yAxisId="right" type="monotone" dataKey="rate" stroke="#8b5cf6" strokeWidth={2} name="Conversion Rate %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Founders Count */}
              {conversionAnalytics.overview.total_founders > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-amber-900">Founders Members</h3>
                      <p className="text-sm text-amber-700 mt-1">Lifetime unlimited grading members</p>
                    </div>
                    <div className="text-4xl font-bold text-amber-600">
                      {conversionAnalytics.overview.total_founders}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No conversion data available
            </div>
          )}
        </div>
      )}
    </div>
  )
}
