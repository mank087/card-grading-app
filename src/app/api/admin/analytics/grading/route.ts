/**
 * GET /api/admin/analytics/grading
 *
 * Grading volume + quality metrics with platform breakdown by cards.graded_from.
 * Accepts ?from / ?to for the weekly_trends window.
 *
 * Overview totals (total_graded, average_grade, etc.) are all-time; range
 * only affects the weekly_trends chart and the "in_range" breakdown.
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
      .select('conversational_decimal_grade, category, created_at, graded_from')
      .not('conversational_decimal_grade', 'is', null)
      .limit(100000)
    if (cardsError) throw cardsError

    const totalCards = cards?.length || 0

    // Grade distribution
    const gradeDistribution: Record<number, number> = {}
    const gradesByCategory: Record<string, Record<number, number>> = {}
    cards?.forEach((card) => {
      const grade = Math.round(card.conversational_decimal_grade)
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1
      const category = card.category || 'Other'
      if (!gradesByCategory[category]) gradesByCategory[category] = {}
      gradesByCategory[category][grade] = (gradesByCategory[category][grade] || 0) + 1
    })
    const distributionData = Object.keys(gradeDistribution)
      .sort((a, b) => parseInt(b) - parseInt(a))
      .map((grade) => ({
        grade: parseInt(grade),
        count: gradeDistribution[parseInt(grade)],
        percentage: ((gradeDistribution[parseInt(grade)] / (totalCards || 1)) * 100).toFixed(1),
      }))

    const avgGrade = totalCards > 0
      ? cards!.reduce((sum, c) => sum + c.conversational_decimal_grade, 0) / totalCards
      : 0

    const perfectTens = cards?.filter((c) => c.conversational_decimal_grade === 10).length || 0
    const perfectTenRate = totalCards > 0 ? (perfectTens / totalCards) * 100 : 0
    const highGrades = cards?.filter((c) => c.conversational_decimal_grade >= 9).length || 0
    const highGradeRate = totalCards > 0 ? (highGrades / totalCards) * 100 : 0

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const recentCards = cards?.filter((c) => new Date(c.created_at) >= thirtyDaysAgo) || []
    const avgGradeLast30Days = recentCards.length > 0
      ? recentCards.reduce((sum, c) => sum + c.conversational_decimal_grade, 0) / recentCards.length
      : 0

    // By category (all-time)
    const categoryData = Object.keys(gradesByCategory)
      .map((category) => {
        const categoryCards = cards?.filter((c) => (c.category || 'Other') === category) || []
        const categoryAvg = categoryCards.length > 0
          ? categoryCards.reduce((sum, c) => sum + c.conversational_decimal_grade, 0) / categoryCards.length
          : 0
        return {
          category,
          total_cards: categoryCards.length,
          average_grade: Math.round(categoryAvg * 10) / 10,
          grade_distribution: gradesByCategory[category],
        }
      })
      .sort((a, b) => b.total_cards - a.total_cards)

    // All-time by platform
    const totalByPlatform: Record<Platform, number> = { web: 0, ios_app: 0, android_app: 0 }
    cards?.forEach((c) => { totalByPlatform[normalizePlatform(c.graded_from)] += 1 })

    // Weekly trend for the requested range, stacked by platform.
    type WeekRow = { week: string; web: number; ios_app: number; android_app: number; total: number; avg_grade: number }
    const weeklyTrends: WeekRow[] = []
    const weekStart = new Date(from)
    weekStart.setUTCHours(0, 0, 0, 0)
    while (weekStart <= to) {
      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
      const bucket = { web: 0, ios_app: 0, android_app: 0, total: 0, gradeSum: 0 }
      cards?.forEach((c) => {
        const d = new Date(c.created_at)
        if (d >= weekStart && d < weekEnd) {
          bucket[normalizePlatform(c.graded_from)] += 1
          bucket.total += 1
          bucket.gradeSum += c.conversational_decimal_grade
        }
      })
      weeklyTrends.push({
        week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        web: bucket.web,
        ios_app: bucket.ios_app,
        android_app: bucket.android_app,
        total: bucket.total,
        avg_grade: bucket.total > 0 ? Math.round((bucket.gradeSum / bucket.total) * 10) / 10 : 0,
      })
      weekStart.setUTCDate(weekStart.getUTCDate() + 7)
    }

    return NextResponse.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      overview: {
        total_graded: totalCards,
        average_grade: Math.round(avgGrade * 10) / 10,
        perfect_tens: perfectTens,
        perfect_ten_rate: Math.round(perfectTenRate * 10) / 10,
        high_grades_9_plus: highGrades,
        high_grade_rate: Math.round(highGradeRate * 10) / 10,
        avg_grade_last_30_days: Math.round(avgGradeLast30Days * 10) / 10,
      },
      by_platform: totalByPlatform,
      distribution: distributionData,
      by_category: categoryData,
      weekly_trends: weeklyTrends,
      quality_control: {
        is_perfect_ten_rate_normal: perfectTenRate < 1.5,
        is_high_grade_rate_normal: highGradeRate < 20,
        alert: perfectTenRate > 2 ? 'Perfect 10 rate is unusually high' : null,
      },
    })
  } catch (error) {
    console.error('Error fetching grading analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
