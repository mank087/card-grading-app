/**
 * GET /api/admin/analytics/cards
 *
 * Card upload analytics with platform breakdown via cards.graded_from.
 * Accepts ?from / ?to for the weekly_uploads + daily_uploads window.
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

    const { data: cards, error: cardsError } = await supabaseAdmin
      .from('cards')
      .select('id, category, created_at, is_public, visibility, graded_from')
      .limit(100000)
    if (cardsError) throw cardsError

    const totalCards = cards?.length || 0

    // By category
    const byCategory: Record<string, number> = {}
    cards?.forEach((c) => {
      const category = c.category || 'Other'
      byCategory[category] = (byCategory[category] || 0) + 1
    })
    const categoryData = Object.keys(byCategory)
      .map((category) => ({
        category,
        count: byCategory[category],
        percentage: ((byCategory[category] / (totalCards || 1)) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count)

    // All-time by platform
    const totalByPlatform: Record<Platform, number> = { web: 0, ios_app: 0, android_app: 0 }
    cards?.forEach((c) => { totalByPlatform[normalizePlatform(c.graded_from)] += 1 })

    // Weekly uploads stacked by platform across the requested range
    type WeekRow = { week: string; web: number; ios_app: number; android_app: number; total: number }
    const weeklyUploads: WeekRow[] = []
    const weekStart = new Date(from)
    weekStart.setUTCHours(0, 0, 0, 0)
    while (weekStart <= to) {
      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
      const bucket = { web: 0, ios_app: 0, android_app: 0, total: 0 }
      cards?.forEach((c) => {
        const d = new Date(c.created_at)
        if (d >= weekStart && d < weekEnd) {
          bucket[normalizePlatform(c.graded_from)] += 1
          bucket.total += 1
        }
      })
      weeklyUploads.push({
        week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ...bucket,
      })
      weekStart.setUTCDate(weekStart.getUTCDate() + 7)
    }

    // Daily uploads for last 30 days (always, regardless of range)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const dailyUploads: Record<string, number> = {}
    cards
      ?.filter((c) => new Date(c.created_at) >= thirtyDaysAgo)
      .forEach((card) => {
        const date = new Date(card.created_at).toISOString().split('T')[0]
        dailyUploads[date] = (dailyUploads[date] || 0) + 1
      })
    const dailyData = Object.keys(dailyUploads)
      .sort()
      .map((date) => ({ date, uploads: dailyUploads[date] }))

    const publicCards = cards?.filter((c) => c.is_public === true || c.visibility === 'public').length || 0
    const privateCards = totalCards - publicCards

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000)
    const cardsLast7Days = cards?.filter((c) => new Date(c.created_at) >= sevenDaysAgo).length || 0
    const cardsLast30Days = cards?.filter((c) => new Date(c.created_at) >= thirtyDaysAgo).length || 0

    return NextResponse.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      overview: {
        total_cards: totalCards,
        public_cards: publicCards,
        private_cards: privateCards,
        cards_last_7_days: cardsLast7Days,
        cards_last_30_days: cardsLast30Days,
        avg_cards_per_day_last_30: Math.round((cardsLast30Days / 30) * 10) / 10,
      },
      by_platform: totalByPlatform,
      by_category: categoryData,
      top_categories: categoryData.slice(0, 5),
      weekly_uploads: weeklyUploads,
      daily_uploads: dailyData,
      visibility: {
        public: publicCards,
        private: privateCards,
        public_percentage: ((publicCards / (totalCards || 1)) * 100).toFixed(1),
      },
    })
  } catch (error) {
    console.error('Error fetching card analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
