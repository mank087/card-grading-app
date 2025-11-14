import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();

    // Get user_id from query params (passed from client)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const search = searchParams.get('search');

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    // Query cards for this user
    let query = supabase
      .from('cards')
      .select('id, serial, front_path, back_path, card_name, featured, category, card_set, manufacturer_name, release_date, card_number, grade_numeric, ai_confidence_score, ai_grading, dcm_grade_whole, dvg_image_quality, created_at, visibility, conversational_decimal_grade, conversational_whole_grade, conversational_image_confidence, conversational_card_info, dvg_decimal_grade')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply search filter if provided
    if (search) {
      query = query.or(`serial.ilike.%${search}%,card_name.ilike.%${search}%`);
    }

    const { data: cards, error } = await query;

    if (error) {
      console.error('[Collection API] Error fetching cards:', error);
      return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 });
    }

    // Create signed URLs for each card's images
    const cardsWithUrls = await Promise.all(
      (cards || []).map(async (card) => {
        // Create signed URLs for front and back images
        const { data: frontData } = await supabase.storage
          .from('cards')
          .createSignedUrl(card.front_path, 60 * 60); // 1 hour

        const { data: backData } = await supabase.storage
          .from('cards')
          .createSignedUrl(card.back_path, 60 * 60); // 1 hour

        return {
          ...card,
          front_url: frontData?.signedUrl || null,
          back_url: backData?.signedUrl || null
        };
      })
    );

    return NextResponse.json({ cards: cardsWithUrls });
  } catch (error: any) {
    console.error('[Collection API] Unexpected error:', error);
    return NextResponse.json({
      error: "Internal server error",
      details: error.message
    }, { status: 500 });
  }
}
