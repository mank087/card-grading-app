'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getStoredSession } from '@/lib/directAuth'
import { useRouter } from 'next/navigation'

type AccountStats = {
  totalCards: number
  publicCards: number
  privateCards: number
  cardsByCategory: { [key: string]: number }
  averageGrade: number | null
  highestGrade: number | null
  highestGradeCardId: string | null
  highestGradeCategory: string | null
  gradeDistribution: { [key: string]: number }
  recentUploads: number // Last 30 days
}

export default function AccountPage() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<AccountStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchAccountData = async () => {
      try {
        // Get current user from stored session (same method as navigation/collection)
        const session = getStoredSession()

        if (!session || !session.user) {
          router.push('/login')
          return
        }

        const user = session.user
        setUser(user)

        // Fetch all user's cards
        const { data: cards, error: cardsError } = await supabase
          .from('cards')
          .select('*')
          .eq('user_id', user.id)

        if (cardsError) {
          throw cardsError
        }

        if (!cards) {
          setStats({
            totalCards: 0,
            publicCards: 0,
            privateCards: 0,
            cardsByCategory: {},
            averageGrade: null,
            highestGrade: null,
            highestGradeCardId: null,
            highestGradeCategory: null,
            gradeDistribution: {},
            recentUploads: 0
          })
          setLoading(false)
          return
        }

        // Calculate statistics
        const totalCards = cards.length
        const publicCards = cards.filter(c => c.is_public === true || c.visibility === 'public').length
        const privateCards = totalCards - publicCards

        // Cards by category
        const cardsByCategory: { [key: string]: number } = {}
        cards.forEach(card => {
          const category = card.category || 'Other'
          cardsByCategory[category] = (cardsByCategory[category] || 0) + 1
        })

        // Get grades (prefer conversational_decimal_grade, fallback to dvg_decimal_grade, then dcm_grade_whole)
        const grades = cards
          .map(card => {
            if (card.conversational_decimal_grade !== null && card.conversational_decimal_grade !== undefined) {
              return card.conversational_decimal_grade
            }
            if (card.dvg_decimal_grade !== null && card.dvg_decimal_grade !== undefined) {
              return card.dvg_decimal_grade
            }
            if (card.dcm_grade_whole) {
              return card.dcm_grade_whole
            }
            if (card.grade_numeric) {
              return card.grade_numeric
            }
            return null
          })
          .filter(grade => grade !== null) as number[]

        const averageGrade = grades.length > 0
          ? Math.round((grades.reduce((sum, g) => sum + g, 0) / grades.length) * 10) / 10
          : null

        // Find highest grade and its card
        let highestGrade: number | null = null
        let highestGradeCardId: string | null = null
        let highestGradeCategory: string | null = null

        cards.forEach(card => {
          const grade = card.conversational_decimal_grade ?? card.dvg_decimal_grade ?? card.dcm_grade_whole ?? card.grade_numeric
          if (grade !== null && grade !== undefined) {
            if (highestGrade === null || grade > highestGrade) {
              highestGrade = grade
              highestGradeCardId = card.id
              highestGradeCategory = card.category
            }
          }
        })

        // Grade distribution (rounded to whole numbers)
        const gradeDistribution: { [key: string]: number } = {}
        grades.forEach(grade => {
          const wholeGrade = Math.round(grade)
          gradeDistribution[wholeGrade] = (gradeDistribution[wholeGrade] || 0) + 1
        })

        // Recent uploads (last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const recentUploads = cards.filter(card => {
          if (!card.created_at) return false
          return new Date(card.created_at) > thirtyDaysAgo
        }).length

        setStats({
          totalCards,
          publicCards,
          privateCards,
          cardsByCategory,
          averageGrade,
          highestGrade,
          highestGradeCardId,
          highestGradeCategory,
          gradeDistribution,
          recentUploads
        })

        setLoading(false)
      } catch (err) {
        console.error('Error fetching account data:', err)
        setError('Failed to load account data. Please try again.')
        setLoading(false)
      }
    }

    fetchAccountData()
  }, [router])

  // Helper function to get card link based on category
  const getCardLink = (cardId: string, category: string | null) => {
    const sportCategories = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports']

    if (category && sportCategories.includes(category)) {
      return `/sports/${cardId}`
    }
    if (category === 'Pokemon') return `/pokemon/${cardId}`
    if (category === 'MTG') return `/mtg/${cardId}`
    if (category === 'Lorcana') return `/lorcana/${cardId}`
    if (category === 'Other') return `/other/${cardId}`

    return `/card/${cardId}`
  }

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center p-8">
        <div className="w-full max-w-6xl">
          <p className="text-center text-gray-600">Loading your account...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center p-8">
        <div className="w-full max-w-6xl">
          <p className="text-center text-red-600">{error}</p>
        </div>
      </main>
    )
  }

  if (!user || !stats) {
    return null
  }

  // Format date
  const joinDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown'

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      <div className="w-full max-w-6xl">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">My Account</h1>
          <p className="text-gray-600 mt-2">Manage your account settings and view your collection statistics</p>
        </div>

        {/* Account Information Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Account Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border-l-4 border-blue-600 pl-4">
              <p className="text-sm text-gray-600 font-medium">Email</p>
              <p className="text-lg text-gray-900">{user.email}</p>
            </div>
            <div className="border-l-4 border-blue-600 pl-4">
              <p className="text-sm text-gray-600 font-medium">Member Since</p>
              <p className="text-lg text-gray-900">{joinDate}</p>
            </div>
            <div className="border-l-4 border-blue-600 pl-4">
              <p className="text-sm text-gray-600 font-medium">User ID</p>
              <p className="text-lg text-gray-900 font-mono text-sm">{user.id}</p>
            </div>
            <div className="border-l-4 border-blue-600 pl-4">
              <p className="text-sm text-gray-600 font-medium">Account Status</p>
              <p className="text-lg text-green-600 font-semibold">Active</p>
            </div>
          </div>
        </div>

        {/* Card Statistics Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <svg className="w-6 h-6 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Card Statistics
          </h2>

          {/* Quick Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-2 border-blue-300">
              <p className="text-sm text-blue-700 font-medium mb-1">Total Cards</p>
              <p className="text-3xl font-bold text-blue-900">{stats.totalCards}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border-2 border-green-300">
              <p className="text-sm text-green-700 font-medium mb-1">Public Cards</p>
              <p className="text-3xl font-bold text-green-900">{stats.publicCards}</p>
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border-2 border-gray-300">
              <p className="text-sm text-gray-700 font-medium mb-1">Private Cards</p>
              <p className="text-3xl font-bold text-gray-900">{stats.privateCards}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border-2 border-purple-300">
              <p className="text-sm text-purple-700 font-medium mb-1">Recent Uploads</p>
              <p className="text-3xl font-bold text-purple-900">{stats.recentUploads}</p>
              <p className="text-xs text-purple-600 mt-1">Last 30 days</p>
            </div>
          </div>

          {/* Cards by Category */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Cards by Category</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {Object.entries(stats.cardsByCategory).map(([category, count]) => (
                <div key={category} className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-center">
                  <p className="text-sm text-gray-600 font-medium">{category}</p>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                </div>
              ))}
            </div>
            {Object.keys(stats.cardsByCategory).length === 0 && (
              <p className="text-gray-500 text-center py-4">No cards uploaded yet</p>
            )}
          </div>
        </div>

        {/* Grading Insights Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <svg className="w-6 h-6 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Grading Insights
          </h2>

          {stats.averageGrade !== null ? (
            <>
              {/* Average Grade & Highest Grade */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-6 border-2 border-yellow-300">
                  <p className="text-sm text-yellow-700 font-medium mb-2">Average Grade</p>
                  <p className="text-5xl font-bold text-yellow-900">{stats.averageGrade}</p>
                  <p className="text-xs text-yellow-600 mt-2">Across all graded cards</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border-2 border-green-300">
                  <p className="text-sm text-green-700 font-medium mb-2">Highest Grade</p>
                  <p className="text-5xl font-bold text-green-900">{stats.highestGrade}</p>
                  {stats.highestGradeCardId && (
                    <a
                      href={getCardLink(stats.highestGradeCardId, stats.highestGradeCategory)}
                      className="text-sm text-green-600 hover:text-green-800 underline mt-2 inline-block"
                    >
                      View this card →
                    </a>
                  )}
                </div>
              </div>

              {/* Grade Distribution Chart */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Grade Distribution</h3>
                <div className="space-y-2">
                  {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(grade => {
                    const count = stats.gradeDistribution[grade] || 0
                    const totalGraded = Object.values(stats.gradeDistribution).reduce((sum, c) => sum + c, 0)
                    const percentage = totalGraded > 0 ? (count / totalGraded) * 100 : 0

                    // Only show grades that have cards
                    if (count === 0) return null

                    return (
                      <div key={grade} className="flex items-center gap-3">
                        <div className="w-12 text-right">
                          <span className="text-sm font-semibold text-gray-700">Grade {grade}</span>
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden">
                          <div
                            className={`h-full rounded-full flex items-center justify-end pr-3 text-white text-sm font-medium ${
                              grade === 10 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                              grade === 9 ? 'bg-gradient-to-r from-green-400 to-green-600' :
                              grade >= 7 ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                              grade >= 5 ? 'bg-gradient-to-r from-purple-400 to-purple-600' :
                              'bg-gradient-to-r from-gray-400 to-gray-600'
                            }`}
                            style={{ width: `${Math.max(percentage, 5)}%` }}
                          >
                            {count} card{count !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="w-16 text-right">
                          <span className="text-sm text-gray-600">{percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No graded cards yet. Upload and grade your first card to see insights!</p>
            </div>
          )}
        </div>

        {/* Subscription & Billing Section (Placeholder) */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <svg className="w-6 h-6 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Subscription & Billing
          </h2>

          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-6 border-2 border-indigo-300">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold text-indigo-900 mb-2">Current Plan: Free</p>
                <p className="text-sm text-indigo-700 mb-4">
                  Unlimited card grading with AI-powered analysis
                </p>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-indigo-800">
                    <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Unlimited card uploads
                  </div>
                  <div className="flex items-center text-sm text-indigo-800">
                    <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    AI-powered grading
                  </div>
                  <div className="flex items-center text-sm text-indigo-800">
                    <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Public & private collections
                  </div>
                </div>
              </div>
              <div className="ml-4">
                <button
                  disabled
                  className="bg-gray-300 text-gray-500 px-6 py-2 rounded-lg font-semibold cursor-not-allowed"
                  title="Premium plans coming soon!"
                >
                  Upgrade (Coming Soon)
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 Premium plans coming soon!</strong> Get access to advanced features like bulk grading,
              market value tracking, collection insurance estimates, and more.
            </p>
          </div>
        </div>

        {/* Account Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <svg className="w-6 h-6 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </h2>

          <div className="space-y-3">
            <button
              disabled
              className="w-full sm:w-auto bg-gray-300 text-gray-500 px-6 py-2 rounded-lg font-medium cursor-not-allowed"
              title="Feature coming soon"
            >
              Change Password (Coming Soon)
            </button>
            <button
              disabled
              className="w-full sm:w-auto bg-gray-300 text-gray-500 px-6 py-2 rounded-lg font-medium ml-0 sm:ml-3 cursor-not-allowed"
              title="Feature coming soon"
            >
              Delete Account (Coming Soon)
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
