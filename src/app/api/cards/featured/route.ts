import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  try {
    // Fetch featured cards (public, graded, and marked as featured)
    const { data: cards, error } = await supabaseAdmin
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
        back_path,
        created_at
      `)
      .eq('visibility', 'public')
      .eq('is_featured', true)
      .not('conversational_decimal_grade', 'is', null)
      .order('created_at', { ascending: false })
      .limit(8)

    if (error) {
      console.error('Error fetching featured cards:', error)
      throw error
    }

    // Create signed URLs for each card's images (like my-collection API)
    const cardsWithUrls = await Promise.all(
      (cards || []).map(async (card) => {
        // Create signed URLs for front and back images
        const { data: frontData } = await supabaseAdmin.storage
          .from('cards')
          .createSignedUrl(card.front_path, 60 * 60) // 1 hour

        const { data: backData } = await supabaseAdmin.storage
          .from('cards')
          .createSignedUrl(card.back_path, 60 * 60) // 1 hour

        return {
          ...card,
          front_url: frontData?.signedUrl || null,
          back_url: backData?.signedUrl || null
        }
      })
    )

    return NextResponse.json({ cards: cardsWithUrls }, { status: 200 })
  } catch (error) {
    console.error('Error in featured cards API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch featured cards', cards: [] },
      { status: 500 }
    )
  }
}
