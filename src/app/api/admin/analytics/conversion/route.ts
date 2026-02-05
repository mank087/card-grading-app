import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await verifyAdminSession(token)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get date range from query params
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build date filter
    let dateFilter = {}
    if (startDate) {
      dateFilter = { ...dateFilter, gte: startDate }
    }
    if (endDate) {
      dateFilter = { ...dateFilter, lte: endDate }
    }

    // Get all users (with optional date filter on signup)
    let usersQuery = supabaseAdmin
      .from('user_credits')
      .select('user_id, created_at, is_founder, total_purchased, first_purchase_bonus_claimed')

    if (startDate) {
      usersQuery = usersQuery.gte('created_at', startDate)
    }
    if (endDate) {
      usersQuery = usersQuery.lte('created_at', endDate)
    }

    const { data: users, error: usersError } = await usersQuery

    if (usersError) {
      console.error('Error fetching users:', usersError)
      throw usersError
    }

    // Get all grade transactions (users who used credits)
    const gradesQuery = supabaseAdmin
      .from('credit_transactions')
      .select('user_id, created_at')
      .eq('type', 'grade')

    const { data: grades, error: gradesError } = await gradesQuery

    if (gradesError) {
      console.error('Error fetching grades:', gradesError)
      throw gradesError
    }

    // Get all purchase transactions
    const purchasesQuery = supabaseAdmin
      .from('credit_transactions')
      .select('user_id, created_at, amount, description, metadata')
      .eq('type', 'purchase')

    const { data: purchases, error: purchasesError } = await purchasesQuery

    if (purchasesError) {
      console.error('Error fetching purchases:', purchasesError)
      throw purchasesError
    }

    // Create lookup maps
    const userSignupMap: Record<string, Date> = {}
    users?.forEach(u => {
      userSignupMap[u.user_id] = new Date(u.created_at)
    })

    // Get unique users who graded
    const usersWhoGraded = new Set(grades?.map(g => g.user_id) || [])

    // Get first purchase per user
    const firstPurchaseMap: Record<string, { date: Date; amount: number; description: string }> = {}
    purchases?.forEach(p => {
      if (!firstPurchaseMap[p.user_id] || new Date(p.created_at) < firstPurchaseMap[p.user_id].date) {
        firstPurchaseMap[p.user_id] = {
          date: new Date(p.created_at),
          amount: p.amount,
          description: p.description || ''
        }
      }
    })

    const usersWhoPurchased = new Set(Object.keys(firstPurchaseMap))

    // Users who graded AND purchased
    const convertedUsers = [...usersWhoGraded].filter(u => usersWhoPurchased.has(u))

    // Calculate time to purchase for each converted user
    const timeToPurchase: number[] = []
    convertedUsers.forEach(userId => {
      const signup = userSignupMap[userId]
      const purchase = firstPurchaseMap[userId]?.date
      if (signup && purchase) {
        const days = (purchase.getTime() - signup.getTime()) / (1000 * 60 * 60 * 24)
        timeToPurchase.push(days)
      }
    })

    // Sort for percentile calculations
    timeToPurchase.sort((a, b) => a - b)

    // Time buckets
    const sameDay = timeToPurchase.filter(d => d < 1).length
    const within3Days = timeToPurchase.filter(d => d <= 3).length
    const within7Days = timeToPurchase.filter(d => d <= 7).length
    const within30Days = timeToPurchase.filter(d => d <= 30).length
    const over30Days = timeToPurchase.filter(d => d > 30).length

    // Package breakdown
    const packageCounts: Record<string, number> = { basic: 0, pro: 0, elite: 0, founders: 0 }
    const packageRevenue: Record<string, number> = { basic: 0, pro: 0, elite: 0, founders: 0 }

    purchases?.forEach(p => {
      const desc = (p.description || '').toLowerCase()
      const meta = p.metadata || {}

      if (desc.includes('founder') || meta.package === 'founders') {
        packageCounts.founders++
        packageRevenue.founders += 99
      } else if (desc.includes('elite') || meta.tier === 'elite' || p.amount === 20) {
        packageCounts.elite++
        packageRevenue.elite += 19.99
      } else if (desc.includes('pro') || meta.tier === 'pro' || p.amount === 5) {
        packageCounts.pro++
        packageRevenue.pro += 9.99
      } else if (desc.includes('basic') || meta.tier === 'basic' || p.amount === 1) {
        packageCounts.basic++
        packageRevenue.basic += 2.99
      }
    })

    // Weekly conversion trend (last 12 weeks)
    const weeklyConversions: Array<{ week: string; signups: number; conversions: number; rate: number }> = []
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - (i * 7))
      weekStart.setHours(0, 0, 0, 0)

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const weekSignups = users?.filter(u => {
        const signupDate = new Date(u.created_at)
        return signupDate >= weekStart && signupDate < weekEnd
      }) || []

      const weekSignupIds = new Set(weekSignups.map(u => u.user_id))
      const weekConversions = [...weekSignupIds].filter(id => usersWhoPurchased.has(id)).length

      weeklyConversions.push({
        week: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        signups: weekSignups.length,
        conversions: weekConversions,
        rate: weekSignups.length > 0 ? Math.round((weekConversions / weekSignups.length) * 1000) / 10 : 0
      })
    }

    // Founder count
    const founderCount = users?.filter(u => u.is_founder).length || 0

    const totalUsers = users?.length || 0
    const totalRevenue = Object.values(packageRevenue).reduce((a, b) => a + b, 0)

    const analytics = {
      overview: {
        total_users: totalUsers,
        users_used_free_credit: usersWhoGraded.size,
        users_made_purchase: usersWhoPurchased.size,
        converted_users: convertedUsers.length,
        conversion_rate: usersWhoGraded.size > 0
          ? Math.round((convertedUsers.length / usersWhoGraded.size) * 1000) / 10
          : 0,
        overall_purchase_rate: totalUsers > 0
          ? Math.round((usersWhoPurchased.size / totalUsers) * 1000) / 10
          : 0,
        total_founders: founderCount
      },
      time_to_purchase: {
        average_days: timeToPurchase.length > 0
          ? Math.round(timeToPurchase.reduce((a, b) => a + b, 0) / timeToPurchase.length * 10) / 10
          : 0,
        median_days: timeToPurchase.length > 0
          ? Math.round(timeToPurchase[Math.floor(timeToPurchase.length / 2)] * 10) / 10
          : 0,
        min_days: timeToPurchase.length > 0 ? Math.round(timeToPurchase[0] * 10) / 10 : 0,
        max_days: timeToPurchase.length > 0 ? Math.round(timeToPurchase[timeToPurchase.length - 1] * 10) / 10 : 0
      },
      purchase_timing: {
        same_day: sameDay,
        within_3_days: within3Days,
        within_7_days: within7Days,
        within_30_days: within30Days,
        over_30_days: over30Days,
        total: timeToPurchase.length
      },
      package_breakdown: {
        counts: packageCounts,
        revenue: packageRevenue,
        total_purchases: Object.values(packageCounts).reduce((a, b) => a + b, 0),
        total_revenue: Math.round(totalRevenue * 100) / 100
      },
      weekly_trends: weeklyConversions
    }

    return NextResponse.json(analytics, { status: 200 })
  } catch (error) {
    console.error('Error fetching conversion analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
