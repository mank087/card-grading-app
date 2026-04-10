import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    // Look up user by username
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name')
      .eq('username', username.toLowerCase())
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    // Fetch public cards for this user (same fields as featured API)
    const { data: cards, error } = await supabaseAdmin
      .from('cards')
      .select(`
        id, serial, card_name, category, front_path, back_path, created_at,
        featured, pokemon_featured, card_set, release_date, manufacturer_name, card_number,
        conversational_decimal_grade, conversational_whole_grade,
        conversational_condition_label, conversational_card_info,
        conversational_sub_scores, conversational_weighted_sub_scores,
        conversational_image_confidence, conversational_limiting_factor,
        dvg_decimal_grade,
        is_foil, foil_type, is_double_faced, mtg_rarity, holofoil,
        serial_numbering, rarity_tier, rarity_description,
        autographed, autograph_type, memorabilia_type,
        rookie_card, first_print_rookie
      `)
      .eq('user_id', profile.id)
      .eq('visibility', 'public')
      .or('conversational_decimal_grade.not.is.null,conversational_grading.not.is.null')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Public Collection] Error fetching cards:', error)
      throw error
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({
        profile: { username: profile.username, displayName: profile.display_name },
        cards: [],
        stats: { totalCards: 0, avgGrade: 0, gradeDistribution: {} },
      })
    }

    // Batch create signed URLs
    const allPaths = cards.flatMap(card => [card.front_path, card.back_path])
    const { data: signedUrls, error: signError } = await supabaseAdmin.storage
      .from('cards')
      .createSignedUrls(allPaths, 60 * 60)

    const urlMap = new Map<string, string>()
    if (!signError && signedUrls) {
      signedUrls.forEach(item => {
        if (item.signedUrl && item.path) {
          urlMap.set(item.path, item.signedUrl)
        }
      })
    }

    // Enrich cards (same logic as featured API)
    const cardsWithUrls = cards.map(card => {
      const enrichedCard: any = {
        ...card,
        front_url: urlMap.get(card.front_path) || null,
        back_url: urlMap.get(card.back_path) || null,
      }

      return enrichedCard
    })

    // Calculate collection stats
    const grades = cardsWithUrls
      .map((c: any) => c.conversational_decimal_grade)
      .filter((g: any) => g != null && !isNaN(g)) as number[]

    const avgGrade = grades.length > 0
      ? Math.round((grades.reduce((a: number, b: number) => a + b, 0) / grades.length) * 10) / 10
      : 0

    const gradeDistribution: Record<string, number> = {}
    grades.forEach(g => {
      const whole = Math.round(g)
      gradeDistribution[whole] = (gradeDistribution[whole] || 0) + 1
    })

    // Count category breakdown
    const categoryBreakdown: Record<string, number> = {}
    cardsWithUrls.forEach((c: any) => {
      const cat = c.category || 'Other'
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1
    })

    return NextResponse.json({
      profile: { username: profile.username, displayName: profile.display_name },
      cards: cardsWithUrls,
      stats: {
        totalCards: cardsWithUrls.length,
        avgGrade,
        gradeDistribution,
        categoryBreakdown,
        highestGrade: grades.length > 0 ? Math.max(...grades) : 0,
        gem10Count: grades.filter(g => g === 10).length,
      },
    })
  } catch (error) {
    console.error('[Public Collection] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collection', cards: [] },
      { status: 500 }
    )
  }
}
