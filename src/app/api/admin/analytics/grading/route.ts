import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabase } from '@/lib/supabaseClient'

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

    // Fetch all graded cards
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('conversational_decimal_grade, category, created_at')
      .not('conversational_decimal_grade', 'is', null)

    if (cardsError) {
      throw cardsError
    }

    // Calculate grade distribution
    const gradeDistribution: Record<number, number> = {}
    const gradesByCategory: Record<string, Record<number, number>> = {}

    cards?.forEach(card => {
      const grade = Math.round(card.conversational_decimal_grade)
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1

      // By category
      const category = card.category || 'Other'
      if (!gradesByCategory[category]) {
        gradesByCategory[category] = {}
      }
      gradesByCategory[category][grade] = (gradesByCategory[category][grade] || 0) + 1
    })

    // Format for charts
    const distributionData = Object.keys(gradeDistribution)
      .sort((a, b) => parseInt(b) - parseInt(a))
      .map(grade => ({
        grade: parseInt(grade),
        count: gradeDistribution[parseInt(grade)],
        percentage: ((gradeDistribution[parseInt(grade)] / (cards?.length || 1)) * 100).toFixed(1)
      }))

    // Calculate average grade
    const totalCards = cards?.length || 0
    const avgGrade = totalCards > 0
      ? cards.reduce((sum, card) => sum + card.conversational_decimal_grade, 0) / totalCards
      : 0

    // Calculate quality metrics
    const perfectTens = cards?.filter(c => c.conversational_decimal_grade === 10).length || 0
    const perfectTenRate = totalCards > 0 ? (perfectTens / totalCards) * 100 : 0

    const highGrades = cards?.filter(c => c.conversational_decimal_grade >= 9).length || 0
    const highGradeRate = totalCards > 0 ? (highGrades / totalCards) * 100 : 0

    // Grade trends over time (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentCards = cards?.filter(c => new Date(c.created_at) >= thirtyDaysAgo) || []
    const avgGradeLast30Days = recentCards.length > 0
      ? recentCards.reduce((sum, card) => sum + card.conversational_decimal_grade, 0) / recentCards.length
      : 0

    // Grade distribution by category
    const categoryData = Object.keys(gradesByCategory).map(category => {
      const categoryCards = cards?.filter(c => (c.category || 'Other') === category) || []
      const categoryAvg = categoryCards.length > 0
        ? categoryCards.reduce((sum, c) => sum + c.conversational_decimal_grade, 0) / categoryCards.length
        : 0

      return {
        category,
        total_cards: categoryCards.length,
        average_grade: Math.round(categoryAvg * 10) / 10,
        grade_distribution: gradesByCategory[category]
      }
    }).sort((a, b) => b.total_cards - a.total_cards)

    // Grade trends by week (last 12 weeks)
    const weeklyTrends: Array<{ week: string; avg_grade: number; cards_graded: number }> = []
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - (i * 7))
      weekStart.setHours(0, 0, 0, 0)

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const weekCards = cards?.filter(c => {
        const cardDate = new Date(c.created_at)
        return cardDate >= weekStart && cardDate < weekEnd
      }) || []

      const weekAvg = weekCards.length > 0
        ? weekCards.reduce((sum, c) => sum + c.conversational_decimal_grade, 0) / weekCards.length
        : 0

      weeklyTrends.push({
        week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        avg_grade: Math.round(weekAvg * 10) / 10,
        cards_graded: weekCards.length
      })
    }

    const analytics = {
      overview: {
        total_graded: totalCards,
        average_grade: Math.round(avgGrade * 10) / 10,
        perfect_tens: perfectTens,
        perfect_ten_rate: Math.round(perfectTenRate * 10) / 10,
        high_grades_9_plus: highGrades,
        high_grade_rate: Math.round(highGradeRate * 10) / 10,
        avg_grade_last_30_days: Math.round(avgGradeLast30Days * 10) / 10
      },
      distribution: distributionData,
      by_category: categoryData,
      weekly_trends: weeklyTrends,
      quality_control: {
        is_perfect_ten_rate_normal: perfectTenRate < 1.5, // Should be < 1.5%
        is_high_grade_rate_normal: highGradeRate < 20, // Should be < 20%
        alert: perfectTenRate > 2 ? 'Perfect 10 rate is unusually high' : null
      }
    }

    return NextResponse.json(analytics, { status: 200 })
  } catch (error) {
    console.error('Error fetching grading analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
