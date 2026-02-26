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

    // Get date range from query params (default: last 90 days)
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '90')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Fetch all users for calculations (explicit limit to bypass Supabase 1000 default)
    const { data: allUsers, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, created_at')
      .order('created_at', { ascending: true })
      .limit(100000)

    if (usersError) {
      throw usersError
    }

    // Calculate user growth by day
    const usersByDay: Record<string, number> = {}
    let cumulativeUsers = 0

    allUsers?.forEach(user => {
      const date = new Date(user.created_at).toISOString().split('T')[0]
      usersByDay[date] = (usersByDay[date] || 0) + 1
    })

    // Build growth data
    const growthData = Object.keys(usersByDay)
      .sort()
      .map(date => {
        cumulativeUsers += usersByDay[date]
        return {
          date,
          new_users: usersByDay[date],
          total_users: cumulativeUsers
        }
      })

    // Calculate retention (7-day and 30-day)
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    // Get users who have uploaded cards (active users)
    // Explicit limits to bypass Supabase 1000 default
    const { data: activeUsersData } = await supabaseAdmin
      .from('cards')
      .select('user_id, created_at')
      .gte('created_at', sevenDaysAgo.toISOString())
      .limit(100000)

    const activeUsers7Days = new Set(activeUsersData?.map(c => c.user_id) || []).size

    const { data: activeUsers30Data } = await supabaseAdmin
      .from('cards')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .limit(100000)

    const activeUsers30Days = new Set(activeUsers30Data?.map(c => c.user_id) || []).size

    const { data: activeUsers90Data } = await supabaseAdmin
      .from('cards')
      .select('user_id')
      .gte('created_at', ninetyDaysAgo.toISOString())
      .limit(100000)

    const activeUsers90Days = new Set(activeUsers90Data?.map(c => c.user_id) || []).size

    // Calculate engagement metrics
    const totalUsers = allUsers?.length || 0
    const usersWithCards = await supabaseAdmin
      .from('cards')
      .select('user_id')
      .limit(100000)
      .then(({ data }) => new Set(data?.map(c => c.user_id) || []).size)

    const engagementRate = totalUsers > 0 ? (usersWithCards / totalUsers) * 100 : 0

    // User acquisition by week (last 12 weeks)
    const weeklyData: Array<{ week: string; users: number }> = []
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - (i * 7))
      weekStart.setHours(0, 0, 0, 0)

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const usersInWeek = allUsers?.filter(u => {
        const userDate = new Date(u.created_at)
        return userDate >= weekStart && userDate < weekEnd
      }).length || 0

      weeklyData.push({
        week: `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        users: usersInWeek
      })
    }

    const analytics = {
      overview: {
        total_users: totalUsers,
        active_users_7d: activeUsers7Days,
        active_users_30d: activeUsers30Days,
        active_users_90d: activeUsers90Days,
        engagement_rate: Math.round(engagementRate * 10) / 10,
        users_with_cards: usersWithCards
      },
      growth: growthData.slice(-90), // Last 90 days
      weekly_acquisition: weeklyData,
      retention: {
        seven_day_active: activeUsers7Days,
        thirty_day_active: activeUsers30Days,
        ninety_day_active: activeUsers90Days
      }
    }

    return NextResponse.json(analytics, { status: 200 })
  } catch (error) {
    console.error('Error fetching user analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
