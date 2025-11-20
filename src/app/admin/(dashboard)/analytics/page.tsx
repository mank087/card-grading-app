'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface UserAnalytics {
  overview: {
    total_users: number
    active_users_7d: number
    active_users_30d: number
    active_users_90d: number
    engagement_rate: number
    users_with_cards: number
  }
  growth: Array<{ date: string; new_users: number; total_users: number }>
  weekly_acquisition: Array<{ week: string; users: number }>
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
  distribution: Array<{ grade: number; count: number; percentage: string }>
  by_category: Array<{ category: string; total_cards: number; average_grade: number }>
  weekly_trends: Array<{ week: string; avg_grade: number; cards_graded: number }>
}

interface CardAnalytics {
  overview: {
    total_cards: number
    public_cards: number
    private_cards: number
    cards_last_7_days: number
    cards_last_30_days: number
  }
  by_category: Array<{ category: string; count: number; percentage: string }>
  weekly_uploads: Array<{ week: string; uploads: number }>
}

interface FinancialAnalytics {
  overview: {
    total_estimated_cost: number
    total_cards_graded: number
    avg_cost_per_card: number
    cost_last_30_days: number
    projected_monthly: number
    projected_annual: number
  }
  by_category: Array<{ category: string; total_cost: number; cards_graded: number }>
  monthly_trend: Array<{ month: string; cost: number; cards: number }>
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#f97316']

export default function AdminAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'grading' | 'cards' | 'financial'>('users')
  const [loading, setLoading] = useState(true)
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null)
  const [gradingAnalytics, setGradingAnalytics] = useState<GradingAnalytics | null>(null)
  const [cardAnalytics, setCardAnalytics] = useState<CardAnalytics | null>(null)
  const [financialAnalytics, setFinancialAnalytics] = useState<FinancialAnalytics | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true)
      try {
        const [usersRes, gradingRes, cardsRes, financialRes] = await Promise.all([
          fetch('/api/admin/analytics/users'),
          fetch('/api/admin/analytics/grading'),
          fetch('/api/admin/analytics/cards'),
          fetch('/api/admin/analytics/financial')
        ])

        if (usersRes.ok) setUserAnalytics(await usersRes.json())
        if (gradingRes.ok) setGradingAnalytics(await gradingRes.json())
        if (cardsRes.ok) setCardAnalytics(await cardsRes.json())
        if (financialRes.ok) setFinancialAnalytics(await financialRes.json())
      } catch (error) {
        console.error('Error fetching analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Platform Analytics</h1>
        <p className="text-gray-600 mt-1">Comprehensive insights into your platform's performance</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'users' as const, label: 'User Analytics', icon: '👥' },
            { key: 'grading' as const, label: 'Grading Analytics', icon: '⭐' },
            { key: 'cards' as const, label: 'Card Analytics', icon: '🎴' },
            { key: 'financial' as const, label: 'Financial', icon: '💰' }
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

          {/* User Growth Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Growth (Last 90 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userAnalytics.growth.slice(-90)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total_users" stroke="#3b82f6" name="Total Users" />
                <Line type="monotone" dataKey="new_users" stroke="#10b981" name="New Users" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Weekly Acquisition */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly User Acquisition</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={userAnalytics.weekly_acquisition}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="users" fill="#3b82f6" name="New Users" />
              </BarChart>
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

          {/* Weekly Trends */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Grading Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={gradingAnalytics.weekly_trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" domain={[0, 10]} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="avg_grade" stroke="#8b5cf6" name="Avg Grade" />
                <Line yAxisId="right" type="monotone" dataKey="cards_graded" stroke="#3b82f6" name="Cards Graded" />
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

          {/* Upload Trends */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Upload Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cardAnalytics.weekly_uploads}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="uploads" fill="#8b5cf6" name="Uploads" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Financial Analytics Tab */}
      {activeTab === 'financial' && financialAnalytics && (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Total API Cost</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">${financialAnalytics.overview.total_estimated_cost.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Estimated</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Cost Per Card</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">${financialAnalytics.overview.avg_cost_per_card.toFixed(3)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Monthly Projection</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">${financialAnalytics.overview.projected_monthly.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Annual Projection</p>
              <p className="text-3xl font-bold text-green-600 mt-2">${financialAnalytics.overview.projected_annual.toFixed(2)}</p>
            </div>
          </div>

          {/* Cost by Category */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={financialAnalytics.by_category}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_cost" fill="#10b981" name="Total Cost ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Cost Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={financialAnalytics.monthly_trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="cost" stroke="#8b5cf6" name="Cost ($)" />
                <Line yAxisId="right" type="monotone" dataKey="cards" stroke="#3b82f6" name="Cards Graded" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Note about estimates */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-yellow-800">Cost Estimates</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Costs are estimated based on card gradings. For accurate tracking, integrate API usage logging into your grading functions.
                  See the Monitoring dashboard for integration instructions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
