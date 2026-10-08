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

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const liveCardsHead = () =>
      supabaseAdmin
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)

    // All queries run in parallel. Card counts exclude soft-deleted cards.
    // Average grade is computed from exact per-grade head counts (a plain
    // select is capped at 1000 rows by PostgREST and gave a wrong average).
    const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const [
      usersResult,
      cardsResult,
      recentUsersResult,
      recentCardsResult,
      perGradeResults,
      recentActivityResult
    ] = await Promise.all([
      // Total users
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),

      // Total live cards
      liveCardsHead(),

      // Users registered in last 7 days
      supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekAgo),

      // Live cards graded in last 7 days
      liveCardsHead().gte('created_at', weekAgo),

      // Per-grade counts (grade 10 doubles as the Perfect 10s count)
      Promise.all(GRADES.map(g => liveCardsHead().eq('conversational_whole_grade', g))),

      // Recent activity (matches collection page fields; ai_grading is only
      // fetched below as a legacy fallback for rows without conversational_card_info)
      supabaseAdmin
        .from('cards')
        .select(`
          id,
          serial,
          card_name,
          category,
          conversational_decimal_grade,
          conversational_condition_label,
          conversational_card_info,
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
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10)
    ])

    let gradedCount = 0
    let gradeSum = 0
    GRADES.forEach((g, i) => {
      const c = perGradeResults[i].count || 0
      gradedCount += c
      gradeSum += c * g
    })
    const avgGrade = gradedCount > 0 ? gradeSum / gradedCount : 0
    const perfectTens = perGradeResults[GRADES.indexOf(10)].count || 0

    // Legacy fallback: only rows without conversational_card_info need ai_grading
    let recentActivity: any[] = recentActivityResult.data || []
    const legacyIds = recentActivity.filter(c => !c.conversational_card_info).map(c => c.id)
    if (legacyIds.length > 0) {
      const { data: legacyRows } = await supabaseAdmin
        .from('cards')
        .select('id, ai_grading')
        .in('id', legacyIds)
      const byId = new Map((legacyRows || []).map((r: any) => [r.id, r.ai_grading]))
      recentActivity = recentActivity.map(c =>
        byId.has(c.id) ? { ...c, ai_grading: byId.get(c.id) } : c
      )
    }

    const stats = {
      totalUsers: usersResult.count || 0,
      totalCards: cardsResult.count || 0,
      newUsersLast7Days: recentUsersResult.count || 0,
      newCardsLast7Days: recentCardsResult.count || 0,
      perfectTens,
      averageGrade: Math.round(avgGrade * 100) / 100,
      recentActivity
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
