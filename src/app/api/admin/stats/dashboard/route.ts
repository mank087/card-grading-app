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

    // Fetch dashboard statistics
    const [
      usersResult,
      cardsResult,
      recentUsersResult,
      recentCardsResult,
      gradeDistResult
    ] = await Promise.all([
      // Total users
      supabase.from('users').select('id', { count: 'exact', head: true }),

      // Total cards
      supabase.from('cards').select('id', { count: 'exact', head: true }),

      // Users registered in last 7 days
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      // Cards graded in last 7 days
      supabase
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      // Grade distribution (perfect 10s)
      supabase
        .from('cards')
        .select('conversational_decimal_grade')
        .eq('conversational_decimal_grade', 10)
        .select('id', { count: 'exact', head: true })
    ])

    // Get average grade
    const { data: avgGradeData } = await supabase
      .from('cards')
      .select('conversational_decimal_grade')
      .not('conversational_decimal_grade', 'is', null)

    const avgGrade = avgGradeData && avgGradeData.length > 0
      ? avgGradeData.reduce((sum, card) => sum + (card.conversational_decimal_grade || 0), 0) / avgGradeData.length
      : 0

    // Get recent activity
    const { data: recentActivity } = await supabase
      .from('cards')
      .select('id, card_name, conversational_decimal_grade, created_at, category')
      .order('created_at', { ascending: false })
      .limit(10)

    const stats = {
      totalUsers: usersResult.count || 0,
      totalCards: cardsResult.count || 0,
      newUsersLast7Days: recentUsersResult.count || 0,
      newCardsLast7Days: recentCardsResult.count || 0,
      perfectTens: gradeDistResult.count || 0,
      averageGrade: Math.round(avgGrade * 10) / 10,
      recentActivity: recentActivity || []
    }

    return NextResponse.json(stats, { status: 200 })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
