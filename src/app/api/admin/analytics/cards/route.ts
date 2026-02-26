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

    // Fetch all cards (explicit limit to bypass Supabase 1000 default)
    const { data: cards, error: cardsError } = await supabaseAdmin
      .from('cards')
      .select('id, category, created_at, is_public, visibility')
      .limit(100000)

    if (cardsError) {
      throw cardsError
    }

    // Cards by category
    const byCategory: Record<string, number> = {}
    cards?.forEach(card => {
      const category = card.category || 'Other'
      byCategory[category] = (byCategory[category] || 0) + 1
    })

    const categoryData = Object.keys(byCategory).map(category => ({
      category,
      count: byCategory[category],
      percentage: ((byCategory[category] / (cards?.length || 1)) * 100).toFixed(1)
    })).sort((a, b) => b.count - a.count)

    // Upload trends over time (last 12 weeks)
    const weeklyUploads: Array<{ week: string; uploads: number }> = []
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - (i * 7))
      weekStart.setHours(0, 0, 0, 0)

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const uploadsInWeek = cards?.filter(c => {
        const cardDate = new Date(c.created_at)
        return cardDate >= weekStart && cardDate < weekEnd
      }).length || 0

      weeklyUploads.push({
        week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        uploads: uploadsInWeek
      })
    }

    // Daily uploads (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const dailyUploads: Record<string, number> = {}
    cards?.filter(c => new Date(c.created_at) >= thirtyDaysAgo).forEach(card => {
      const date = new Date(card.created_at).toISOString().split('T')[0]
      dailyUploads[date] = (dailyUploads[date] || 0) + 1
    })

    const dailyData = Object.keys(dailyUploads).sort().map(date => ({
      date,
      uploads: dailyUploads[date]
    }))

    // Public vs Private
    const publicCards = cards?.filter(c => c.is_public === true || c.visibility === 'public').length || 0
    const privateCards = (cards?.length || 0) - publicCards

    // Upload frequency metrics
    const totalCards = cards?.length || 0
    const cardsLast7Days = cards?.filter(c => {
      const cardDate = new Date(c.created_at)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      return cardDate >= sevenDaysAgo
    }).length || 0

    const cardsLast30Days = cards?.filter(c => {
      const cardDate = new Date(c.created_at)
      return cardDate >= thirtyDaysAgo
    }).length || 0

    // Most popular categories (top 5)
    const topCategories = categoryData.slice(0, 5)

    const analytics = {
      overview: {
        total_cards: totalCards,
        public_cards: publicCards,
        private_cards: privateCards,
        cards_last_7_days: cardsLast7Days,
        cards_last_30_days: cardsLast30Days,
        avg_cards_per_day_last_30: Math.round((cardsLast30Days / 30) * 10) / 10
      },
      by_category: categoryData,
      top_categories: topCategories,
      weekly_uploads: weeklyUploads,
      daily_uploads: dailyData,
      visibility: {
        public: publicCards,
        private: privateCards,
        public_percentage: ((publicCards / (totalCards || 1)) * 100).toFixed(1)
      }
    }

    return NextResponse.json(analytics, { status: 200 })
  } catch (error) {
    console.error('Error fetching card analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
