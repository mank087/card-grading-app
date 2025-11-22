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

    // Fetch dashboard statistics using admin client for proper permissions
    const [
      usersResult,
      cardsResult,
      recentUsersResult,
      recentCardsResult,
      gradeDistResult
    ] = await Promise.all([
      // Total users
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),

      // Total cards
      supabaseAdmin.from('cards').select('id', { count: 'exact', head: true }),

      // Users registered in last 7 days
      supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      // Cards graded in last 7 days
      supabaseAdmin
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      // Grade distribution (perfect 10s)
      supabaseAdmin
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('conversational_decimal_grade', 10)
    ])

    // Get average grade
    const { data: avgGradeData } = await supabaseAdmin
      .from('cards')
      .select('conversational_decimal_grade')
      .not('conversational_decimal_grade', 'is', null)

    const avgGrade = avgGradeData && avgGradeData.length > 0
      ? avgGradeData.reduce((sum, card) => sum + (card.conversational_decimal_grade || 0), 0) / avgGradeData.length
      : 0

    // Get recent activity with detailed card information (matches collection page fields)
    const { data: recentActivity } = await supabaseAdmin
      .from('cards')
      .select(`
        id,
        serial,
        card_name,
        category,
        conversational_decimal_grade,
        conversational_condition_label,
        conversational_card_info,
        ai_grading,
        featured,
        card_set,
        release_date,
        manufacturer_name,
        card_number,
        front_path,
        visibility,
        user_id,
        created_at
      `)
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
