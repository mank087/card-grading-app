/**
 * GET /api/admin/analytics/users
 *
 * Per-platform user analytics. Adds signup_source (web | ios_app | android_app)
 * dimensions to total user counts and weekly acquisition.
 * Accepts ?from=YYYY-MM-DD&?to=YYYY-MM-DD for the trend windows.
 *
 * "Active" = a user who has uploaded at least one card. Active counts are
 * still platform-agnostic — the dimension here is signup_source, not
 * platform-of-the-most-recent-card.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const PLATFORMS = ['web', 'ios_app', 'android_app'] as const
type Platform = (typeof PLATFORMS)[number]

function normalizePlatform(s: string | null | undefined): Platform {
  if (s === 'ios_app' || s === 'android_app' || s === 'web') return s
  return 'web'
}

function parseRange(searchParams: URLSearchParams): { from: Date; to: Date } {
  const now = new Date()
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
  const from = searchParams.get('from')
    ? new Date(searchParams.get('from')!)
    : defaultFrom
  const to = searchParams.get('to')
    ? new Date(searchParams.get('to')!)
    : now
  to.setUTCHours(23, 59, 59, 999)
  return { from, to }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await verifyAdminSession(token)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { from, to } = parseRange(request.nextUrl.searchParams)

    const { data: allUsers, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, created_at, signup_source')
      .order('created_at', { ascending: true })
      .limit(100000)
    if (usersError) throw usersError

    const totalUsers = allUsers?.length || 0

    const totalByPlatform: Record<Platform, number> = { web: 0, ios_app: 0, android_app: 0 }
    allUsers?.forEach((u) => {
      const p = normalizePlatform(u.signup_source)
      totalByPlatform[p] += 1
    })

    // Daily growth across full history, tagged by platform (stacked-bar shape).
    type DailyRow = { date: string; web: number; ios_app: number; android_app: number; total: number; cumulative: number }
    const dailyMap: Record<string, Omit<DailyRow, 'cumulative'>> = {}
    allUsers?.forEach((u) => {
      const date = new Date(u.created_at).toISOString().slice(0, 10)
      if (!dailyMap[date]) {
        dailyMap[date] = { date, web: 0, ios_app: 0, android_app: 0, total: 0 }
      }
      const p = normalizePlatform(u.signup_source)
      dailyMap[date][p] += 1
      dailyMap[date].total += 1
    })
    let cumulative = 0
    const growthData: DailyRow[] = Object.keys(dailyMap)
      .sort()
      .map((date) => {
        cumulative += dailyMap[date].total
        return { ...dailyMap[date], cumulative }
      })

    // Active-user counts based on card uploads.
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 3600 * 1000)

    const { data: cards7 } = await supabaseAdmin
      .from('cards')
      .select('user_id')
      .gte('created_at', sevenDaysAgo.toISOString())
      .limit(100000)
    const { data: cards30 } = await supabaseAdmin
      .from('cards')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .limit(100000)
    const { data: cards90 } = await supabaseAdmin
      .from('cards')
      .select('user_id')
      .gte('created_at', ninetyDaysAgo.toISOString())
      .limit(100000)

    const activeUsers7Days = new Set(cards7?.map((c) => c.user_id) || []).size
    const activeUsers30Days = new Set(cards30?.map((c) => c.user_id) || []).size
    const activeUsers90Days = new Set(cards90?.map((c) => c.user_id) || []).size

    const { data: allCardUserIds } = await supabaseAdmin
      .from('cards')
      .select('user_id')
      .limit(100000)
    const usersWithCards = new Set(allCardUserIds?.map((c) => c.user_id) || []).size
    const engagementRate = totalUsers > 0 ? (usersWithCards / totalUsers) * 100 : 0

    // Weekly acquisition for the requested range, stacked by platform.
    const weeklyData: Array<{ week: string; web: number; ios_app: number; android_app: number; total: number }> = []
    const weekStart = new Date(from)
    weekStart.setUTCHours(0, 0, 0, 0)
    while (weekStart <= to) {
      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
      const bucket = { web: 0, ios_app: 0, android_app: 0, total: 0 }
      allUsers?.forEach((u) => {
        const d = new Date(u.created_at)
        if (d >= weekStart && d < weekEnd) {
          bucket[normalizePlatform(u.signup_source)] += 1
          bucket.total += 1
        }
      })
      weeklyData.push({
        week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ...bucket,
      })
      weekStart.setUTCDate(weekStart.getUTCDate() + 7)
    }

    return NextResponse.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      overview: {
        total_users: totalUsers,
        active_users_7d: activeUsers7Days,
        active_users_30d: activeUsers30Days,
        active_users_90d: activeUsers90Days,
        engagement_rate: Math.round(engagementRate * 10) / 10,
        users_with_cards: usersWithCards,
      },
      by_platform: totalByPlatform,
      growth: growthData.slice(-90),
      weekly_acquisition: weeklyData,
      retention: {
        seven_day_active: activeUsers7Days,
        thirty_day_active: activeUsers30Days,
        ninety_day_active: activeUsers90Days,
      },
    })
  } catch (error) {
    console.error('Error fetching user analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
