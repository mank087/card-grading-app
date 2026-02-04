'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getStoredSession, signOut } from '@/lib/directAuth'
import { useRouter } from 'next/navigation'
import { useCredits } from '@/contexts/CreditsContext'
import Link from 'next/link'

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
  const { balance, isLoading: creditsLoading, isFirstPurchase } = useCredits()

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Founder state
  const [isFounder, setIsFounder] = useState(false)
  const [showFounderBadge, setShowFounderBadge] = useState(true)
  const [isTogglingBadge, setIsTogglingBadge] = useState(false)

  // Label style preference
  const [labelStyle, setLabelStyle] = useState<'modern' | 'traditional'>('modern')
  const [isTogglingLabelStyle, setIsTogglingLabelStyle] = useState(false)

  // Card Lovers subscription state
  const [isCardLover, setIsCardLover] = useState(false)
  const [cardLoverPlan, setCardLoverPlan] = useState<'monthly' | 'annual' | null>(null)
  const [cardLoverPeriodEnd, setCardLoverPeriodEnd] = useState<string | null>(null)
  const [cardLoverMonthsActive, setCardLoverMonthsActive] = useState(0)
  const [nextLoyaltyBonus, setNextLoyaltyBonus] = useState<{ atMonth: number; credits: number; monthsUntil: number } | null>(null)
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false)
  const [isUpgradingSubscription, setIsUpgradingSubscription] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

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
        // Priority: visibility field (if set) takes precedence over is_public
        // visibility='private' means private, visibility='public' or (no visibility + is_public=true) means public
        const publicCards = cards.filter(c => {
          // If visibility field is set, use it
          if (c.visibility === 'private') return false;
          if (c.visibility === 'public') return true;
          // Fallback to is_public for older cards without visibility field
          return c.is_public === true;
        }).length
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

        // Fetch founder status
        try {
          const founderRes = await fetch('/api/founders/status', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })
          if (founderRes.ok) {
            const founderData = await founderRes.json()
            setIsFounder(founderData.isFounder)
            setShowFounderBadge(founderData.showFounderBadge)
          }
        } catch (err) {
          console.error('Error fetching founder status:', err)
        }

        // Fetch label style preference
        try {
          const labelRes = await fetch('/api/user/label-style', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })
          if (labelRes.ok) {
            const labelData = await labelRes.json()
            setLabelStyle(labelData.labelStyle || 'modern')
          }
        } catch (err) {
          console.error('Error fetching label style:', err)
        }

        // Fetch Card Lovers subscription status
        try {
          const subscriptionRes = await fetch('/api/subscription/status', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })
          if (subscriptionRes.ok) {
            const subData = await subscriptionRes.json()
            setIsCardLover(subData.isActive)
            setCardLoverPlan(subData.plan)
            setCardLoverPeriodEnd(subData.currentPeriodEnd)
            setCardLoverMonthsActive(subData.monthsActive || 0)
            setNextLoyaltyBonus(subData.nextLoyaltyBonus)
          }
        } catch (err) {
          console.error('Error fetching subscription status:', err)
        }

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

  // Handle password change
  const handleChangePassword = async () => {
    setPasswordError(null)
    setPasswordSuccess(false)

    // Validation
    if (!newPassword || !confirmPassword) {
      setPasswordError('Please fill in all fields')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }

    // Check password strength
    const hasUppercase = /[A-Z]/.test(newPassword)
    const hasLowercase = /[a-z]/.test(newPassword)
    const hasNumber = /[0-9]/.test(newPassword)

    if (!hasUppercase || !hasLowercase || !hasNumber) {
      setPasswordError('Password must contain uppercase, lowercase, and a number')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setIsChangingPassword(true)

    try {
      const session = getStoredSession()
      if (!session?.access_token) {
        setPasswordError('Not authenticated')
        setIsChangingPassword(false)
        return
      }

      // Call the change password API
      const response = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ newPassword }),
      })

      const data = await response.json()

      if (!response.ok) {
        setPasswordError(data.error || 'Failed to change password')
      } else {
        setPasswordSuccess(true)
        setNewPassword('')
        setConfirmPassword('')
        setCurrentPassword('')
        // Close modal after 2 seconds
        setTimeout(() => {
          setShowPasswordModal(false)
          setPasswordSuccess(false)
        }, 2000)
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password')
    } finally {
      setIsChangingPassword(false)
    }
  }

  // Handle founder badge toggle
  const handleFounderBadgeToggle = async () => {
    setIsTogglingBadge(true)
    try {
      const session = getStoredSession()
      if (!session?.access_token) {
        return
      }

      const response = await fetch('/api/founders/toggle-badge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ showBadge: !showFounderBadge }),
      })

      if (response.ok) {
        setShowFounderBadge(!showFounderBadge)
      }
    } catch (err) {
      console.error('Error toggling founder badge:', err)
    } finally {
      setIsTogglingBadge(false)
    }
  }

  // Handle label style toggle
  const handleLabelStyleToggle = async () => {
    setIsTogglingLabelStyle(true)
    try {
      const session = getStoredSession()
      if (!session?.access_token) {
        return
      }

      const newStyle = labelStyle === 'modern' ? 'traditional' : 'modern'
      const response = await fetch('/api/user/label-style', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ labelStyle: newStyle }),
      })

      if (response.ok) {
        setLabelStyle(newStyle)
      }
    } catch (err) {
      console.error('Error toggling label style:', err)
    } finally {
      setIsTogglingLabelStyle(false)
    }
  }

  // Handle subscription cancellation
  const handleCancelSubscription = async () => {
    setIsCancellingSubscription(true)
    try {
      const session = getStoredSession()
      if (!session?.access_token) {
        return
      }

      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        // Update UI to show cancellation pending
        setShowCancelModal(false)
        alert(`Your subscription will remain active until ${new Date(data.cancelAt).toLocaleDateString()}. You won't be charged again.`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to cancel subscription')
      }
    } catch (err) {
      console.error('Error cancelling subscription:', err)
      alert('Failed to cancel subscription. Please try again.')
    } finally {
      setIsCancellingSubscription(false)
    }
  }

  // Handle subscription upgrade to annual
  const handleUpgradeSubscription = async () => {
    setIsUpgradingSubscription(true)
    try {
      const session = getStoredSession()
      if (!session?.access_token) {
        return
      }

      const response = await fetch('/api/stripe/upgrade-subscription', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        // Update UI
        setCardLoverPlan('annual')
        setCardLoverMonthsActive(12)
        setNextLoyaltyBonus(null)
        alert(`Upgraded to annual! ${data.creditsAdded} credits have been added to your account.`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to upgrade subscription')
      }
    } catch (err) {
      console.error('Error upgrading subscription:', err)
      alert('Failed to upgrade subscription. Please try again.')
    } finally {
      setIsUpgradingSubscription(false)
    }
  }

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm')
      return
    }

    if (!deletePassword) {
      setDeleteError('Please enter your password')
      return
    }

    setDeleteError(null)
    setIsDeleting(true)

    try {
      const session = getStoredSession()
      if (!session?.access_token) {
        setDeleteError('Not authenticated')
        return
      }

      // Call the delete account API with password confirmation
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: deletePassword }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete account')
      }

      // Sign out and redirect to home
      signOut()
      router.push('/?deleted=true')
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account')
      setIsDeleting(false)
    }
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
              {/* Grade Distribution Chart */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Grade Distribution</h3>
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
                            className={`h-full rounded-full ${
                              grade === 10 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                              grade === 9 ? 'bg-gradient-to-r from-green-400 to-green-600' :
                              grade >= 7 ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                              grade >= 5 ? 'bg-gradient-to-r from-purple-400 to-purple-600' :
                              'bg-gradient-to-r from-gray-400 to-gray-600'
                            }`}
                            style={{ width: `${Math.max(percentage, 5)}%` }}
                          />
                          <div className="absolute inset-0 flex items-center justify-end pr-3 text-sm font-medium text-white pointer-events-none">
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

        {/* Grading Credits Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <svg className="w-6 h-6 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Grading Credits
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Credit Balance Card */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-100 rounded-xl p-6 border-2 border-purple-300">
              <p className="text-sm text-purple-700 font-medium mb-2">Available Credits</p>
              {creditsLoading ? (
                <div className="animate-pulse bg-purple-200 rounded h-12 w-24"></div>
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-purple-900">{balance}</span>
                  <span className="text-xl text-purple-700">credit{balance !== 1 ? 's' : ''}</span>
                </div>
              )}
              <p className="text-sm text-purple-600 mt-3">
                1 credit = 1 card grade or re-grade
              </p>
            </div>

            {/* Buy Credits CTA */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200 flex flex-col justify-between">
              <div>
                <p className="text-lg font-semibold text-gray-900 mb-2">Need More Credits?</p>
                <p className="text-sm text-gray-600 mb-4">
                  Purchase credits to grade more cards with our AI-powered system.
                </p>
                {isFirstPurchase && (
                  <div className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full mb-4">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    First purchase bonus: +1 FREE credit
                  </div>
                )}
              </div>
              <Link
                href="/credits"
                className="inline-block text-center bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Buy Credits
              </Link>
            </div>
          </div>

          {/* Pricing Info */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-medium mb-2">Credit Packages:</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="font-bold text-blue-900">Basic</p>
                <p className="text-sm text-blue-700">1 credit - $2.99</p>
              </div>
              <div>
                <p className="font-bold text-blue-900">Pro</p>
                <p className="text-sm text-blue-700">5 credits - $9.99</p>
              </div>
              <div>
                <p className="font-bold text-blue-900">Elite</p>
                <p className="text-sm text-blue-700">20 credits - $19.99</p>
              </div>
            </div>
          </div>
        </div>

        {/* Label Style Settings */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <svg className="w-6 h-6 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            Label Style
          </h2>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Card Label Design</h3>
              <p className="text-sm text-gray-600">
                Choose between the modern dark style or traditional light style for your card labels
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${labelStyle === 'traditional' ? 'text-purple-600' : 'text-gray-400'}`}>
                Traditional
              </span>
              <button
                onClick={handleLabelStyleToggle}
                disabled={isTogglingLabelStyle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  labelStyle === 'modern' ? 'bg-purple-600' : 'bg-gray-300'
                } ${isTogglingLabelStyle ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    labelStyle === 'modern' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${labelStyle === 'modern' ? 'text-purple-600' : 'text-gray-400'}`}>
                Modern
              </span>
            </div>
          </div>

          {/* Style Preview */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className={`p-3 rounded-lg border-2 ${labelStyle === 'traditional' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="text-center">
                <div className="bg-gradient-to-b from-gray-50 to-white rounded-lg p-2 mb-2 shadow-sm">
                  <p className="text-xs font-bold text-gray-700">Traditional</p>
                </div>
                <p className="text-xs text-gray-500">Light background with purple accents</p>
              </div>
            </div>
            <div className={`p-3 rounded-lg border-2 ${labelStyle === 'modern' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="text-center">
                <div className="rounded-lg p-2 mb-2 shadow-sm" style={{ background: 'linear-gradient(135deg, #1a1625 0%, #2d1f47 50%, #1a1625 100%)' }}>
                  <p className="text-xs font-bold text-white">Modern</p>
                </div>
                <p className="text-xs text-gray-500">Dark background with glow effects</p>
              </div>
            </div>
          </div>
        </div>

        {/* Founder Settings - Only show for founders */}
        {isFounder && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg shadow-md p-6 border border-yellow-200 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Founder Settings
            </h2>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Show Founder Badge on Labels</h3>
                <p className="text-sm text-gray-600">
                  Display the founder emblem on your graded card labels
                </p>
              </div>
              <button
                onClick={handleFounderBadgeToggle}
                disabled={isTogglingBadge}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 ${
                  showFounderBadge ? 'bg-yellow-500' : 'bg-gray-300'
                } ${isTogglingBadge ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showFounderBadge ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

          </div>
        )}

        {/* Card Lovers Subscription Section */}
        {isCardLover ? (
          <div className="bg-gradient-to-r from-purple-50 to-rose-50 rounded-lg shadow-md p-6 border border-purple-200 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              Card Lovers Subscription
            </h2>

            {/* Subscription Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <p className="text-sm text-gray-600 font-medium">Current Plan</p>
                <p className="text-xl font-bold text-purple-700">
                  {cardLoverPlan === 'monthly' ? 'Monthly' : 'Annual'}
                </p>
                <p className="text-sm text-gray-500">
                  {cardLoverPlan === 'monthly' ? '$49.99/month' : '$449/year'}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <p className="text-sm text-gray-600 font-medium">Next Billing Date</p>
                <p className="text-xl font-bold text-purple-700">
                  {cardLoverPeriodEnd ? new Date(cardLoverPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                </p>
                <p className="text-sm text-gray-500">
                  {cardLoverPlan === 'monthly' ? '70 credits' : '900 credits'}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <p className="text-sm text-gray-600 font-medium">Months Active</p>
                <p className="text-xl font-bold text-purple-700">{cardLoverMonthsActive}</p>
                <p className="text-sm text-gray-500">consecutive months</p>
              </div>
            </div>

            {/* Loyalty Progress (Monthly only) */}
            {cardLoverPlan === 'monthly' && nextLoyaltyBonus && (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4 border border-yellow-200 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-semibold text-yellow-800">Loyalty Progress</span>
                </div>
                <p className="text-sm text-yellow-700">
                  <strong>+{nextLoyaltyBonus.credits} bonus credits</strong> coming at month {nextLoyaltyBonus.atMonth}!
                  {nextLoyaltyBonus.monthsUntil === 1
                    ? ' Just 1 more month to go!'
                    : ` Only ${nextLoyaltyBonus.monthsUntil} months away.`}
                </p>
                <div className="mt-2 bg-yellow-200 rounded-full h-2">
                  <div
                    className="bg-yellow-500 h-2 rounded-full transition-all"
                    style={{ width: `${((cardLoverMonthsActive % 3) / 3) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Perks Reminder */}
            <div className="bg-white rounded-lg p-4 border border-purple-200 mb-6">
              <p className="font-semibold text-gray-900 mb-2">Your Active Perks:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Card Lovers emblem on labels
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  20% off credit purchases
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Badge on collection page
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Credits roll over forever
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              {cardLoverPlan === 'monthly' && (
                <button
                  onClick={handleUpgradeSubscription}
                  disabled={isUpgradingSubscription}
                  className="bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-700 hover:to-rose-700 text-white font-semibold px-6 py-2 rounded-lg transition-all disabled:opacity-50"
                >
                  {isUpgradingSubscription ? 'Upgrading...' : 'Upgrade to Annual (Save $150/yr)'}
                </button>
              )}
              <button
                onClick={() => setShowCancelModal(true)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-6 py-2 rounded-lg transition-all"
              >
                Cancel Subscription
              </button>
            </div>
          </div>
        ) : (
          /* Card Lovers Promo for non-subscribers */
          <div className="bg-gradient-to-r from-purple-50 to-rose-50 rounded-lg shadow-md p-6 border border-purple-200 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
              <svg className="w-6 h-6 mr-2 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              Become a Card Lover
            </h2>
            <p className="text-gray-600 mb-4">
              Get 70 credits/month, 20% off purchases, exclusive badge & label emblem, and loyalty bonuses!
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/card-lovers"
                className="inline-block bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-700 hover:to-rose-700 text-white font-semibold px-6 py-2 rounded-lg transition-all"
              >
                Learn More
              </Link>
              <p className="text-sm text-gray-500 self-center">Starting at $49.99/month</p>
            </div>
          </div>
        )}

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
              onClick={() => setShowPasswordModal(true)}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Change Password
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium ml-0 sm:ml-3 transition-colors"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Change Password</h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setPasswordError(null)
                  setPasswordSuccess(false)
                  setNewPassword('')
                  setConfirmPassword('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {passwordSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-gray-900">Password Changed!</p>
                <p className="text-gray-600 mt-1">Your password has been updated successfully.</p>
              </div>
            ) : (
              <>
                <p className="text-gray-600 mb-4">
                  Enter your new password below. It must be at least 6 characters long.
                </p>

                {passwordError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{passwordError}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter new password"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowPasswordModal(false)
                      setPasswordError(null)
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isChangingPassword ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full">
              <svg className="w-8 h-8 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
            </div>

            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Cancel Subscription?</h3>
            <p className="text-gray-600 text-center mb-4">
              Are you sure you want to cancel your Card Lovers subscription?
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 font-medium mb-2">What happens when you cancel:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Your credits are kept forever
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Access until current period ends
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  No more monthly credits
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Lose 20% discount & badge
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Loyalty progress resets
                </li>
              </ul>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={isCancellingSubscription}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancellingSubscription ? 'Cancelling...' : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Delete Account</h3>
            <p className="text-gray-600 text-center mb-4">
              This action is <strong>permanent and cannot be undone</strong>. All your data including:
            </p>

            <ul className="text-sm text-gray-600 mb-4 space-y-1">
              <li className="flex items-center">
                <svg className="w-4 h-4 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                All your graded cards ({stats?.totalCards || 0} cards)
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Your remaining credits ({balance} credits)
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Your account information
              </li>
            </ul>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{deleteError}</p>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="deletePassword" className="block text-sm font-medium text-gray-700 mb-1">
                Enter your password
              </label>
              <input
                type="password"
                id="deletePassword"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Your password"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="deleteConfirm" className="block text-sm font-medium text-gray-700 mb-1">
                Type <strong>DELETE</strong> to confirm
              </label>
              <input
                type="text"
                id="deleteConfirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="DELETE"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmText('')
                  setDeletePassword('')
                  setDeleteError(null)
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
