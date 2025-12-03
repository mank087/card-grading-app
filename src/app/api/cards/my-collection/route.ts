import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyAuth } from "@/lib/serverAuth";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication - user must be logged in
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Authentication required" }, { status: 401 });
    }

    const supabase = supabaseServer();

    // Use the authenticated user's ID - NOT from query params
    const userId = auth.userId;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    // Query cards for this user
    let query = supabase
      .from('cards')
      .select('id, serial, front_path, back_path, card_name, featured, category, card_set, manufacturer_name, release_date, card_number, grade_numeric, ai_confidence_score, ai_grading, dcm_grade_whole, dvg_image_quality, created_at, visibility, conversational_decimal_grade, conversational_whole_grade, conversational_image_confidence, conversational_card_info, dvg_decimal_grade, is_foil, foil_type, is_double_faced, mtg_api_verified, mtg_rarity, mtg_set_code, card_language, scryfall_price_usd, scryfall_price_usd_foil')
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

    if (!cards || cards.length === 0) {
      return NextResponse.json({ cards: [] });
    }

    // 🚀 PERFORMANCE: Batch create signed URLs instead of one-by-one
    // Collect all paths for batch signing
    const allPaths = cards.flatMap(card => [card.front_path, card.back_path]);

    // Create all signed URLs in a single batch request
    const { data: signedUrls, error: signError } = await supabase.storage
      .from('cards')
      .createSignedUrls(allPaths, 60 * 60); // 1 hour expiry

    if (signError) {
      console.error('[Collection API] Error creating signed URLs:', signError);
      // Fall back to returning cards without URLs
      return NextResponse.json({
        cards: cards.map(card => ({ ...card, front_url: null, back_url: null }))
      });
    }

    // Build a map of path -> signedUrl for quick lookup
    const urlMap = new Map<string, string>();
    signedUrls?.forEach(item => {
      if (item.signedUrl) {
        urlMap.set(item.path, item.signedUrl);
      }
    });

    // Map URLs back to cards
    const cardsWithUrls = cards.map(card => ({
      ...card,
      front_url: urlMap.get(card.front_path) || null,
      back_url: urlMap.get(card.back_path) || null
    }));

    return NextResponse.json({ cards: cardsWithUrls });
  } catch (error: any) {
    console.error('[Collection API] Unexpected error:', error);
    return NextResponse.json({
      error: "Internal server error",
      details: error.message
    }, { status: 500 });
  }
}
