import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/cards/search?serial=XXX&sport=all&visibility=all
 * Search for cards by serial number or other criteria
 *
 * Query parameters:
 * - serial (required): Serial number to search for (partial match supported)
 * - sport (optional): Filter by sport type (baseball, football, basketball, etc.)
 * - visibility (optional): Filter by visibility (public, private, all) - default: public only
 *
 * Security:
 * - Public cards: Anyone can see (logged in or not)
 * - Private cards: Only visible to owner (when authenticated and visibility=all)
 * - Default behavior: Only show public cards to everyone
 *
 * Returns:
 * Array of matching cards with basic info:
 * - id, serial, sport_type, visibility
 * - front_url (signed URL for thumbnail)
 * - player_name, year, manufacturer, set_name
 * - dvg_decimal_grade
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serial = searchParams.get('serial');
    const sport = searchParams.get('sport') || 'all';
    const visibilityParam = searchParams.get('visibility') || 'public';

    // Validate serial parameter
    if (!serial || serial.trim().length === 0) {
      return NextResponse.json(
        { error: "Serial number parameter is required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Check if user is authenticated (for private card search)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Build query - use correct column names from database (matching my-collection route)
    let query = supabase
      .from('cards')
      .select(`
        id,
        serial,
        category,
        visibility,
        front_path,
        featured,
        card_name,
        release_date,
        manufacturer_name,
        card_set,
        dvg_decimal_grade,
        conversational_decimal_grade,
        conversational_card_info,
        user_id,
        created_at
      `);

    // Search by serial number (case-insensitive, partial match)
    query = query.ilike('serial', `%${serial}%`);

    // Filter by category if specified
    if (sport && sport !== 'all') {
      query = query.eq('category', sport);
    }

    // Apply visibility filter
    if (visibilityParam === 'all' && user) {
      // Authenticated user requesting all cards - show their private cards + all public cards
      query = query.or(`visibility.eq.public,user_id.eq.${user.id}`);
    } else if (visibilityParam === 'private' && user) {
      // Authenticated user requesting only their private cards
      query = query.eq('visibility', 'private').eq('user_id', user.id);
    } else {
      // Default: Only show public cards (for anyone, logged in or not)
      query = query.eq('visibility', 'public');
    }

    // Execute query
    console.log(`🔍 [Search API] Searching for serial="${serial}", visibility="${visibilityParam}"`);

    const { data: cards, error: searchError } = await query
      .order('created_at', { ascending: false })
      .limit(50); // Limit to 50 results

    if (searchError) {
      console.error('❌ [Search API] Database error:', searchError);
      return NextResponse.json(
        { error: "Failed to search cards", details: searchError.message },
        { status: 500 }
      );
    }

    console.log(`🔍 [Search API] Found ${cards?.length || 0} cards matching serial="${serial}"`);
    if (cards && cards.length > 0) {
      console.log(`🔍 [Search API] First match: id=${cards[0].id}, serial=${cards[0].serial}, visibility=${cards[0].visibility}`);
    }

    // Generate signed URLs for card images
    const frontPaths = cards?.map(card => card.front_path).filter(Boolean) || [];
    let urlMap = new Map<string, string>();

    if (frontPaths.length > 0) {
      const { data: signedUrls } = await supabase.storage
        .from('cards')
        .createSignedUrls(frontPaths, 60 * 60); // 1 hour expiry

      if (signedUrls) {
        signedUrls.forEach((item) => {
          if (item.signedUrl && item.path) {
            urlMap.set(item.path, item.signedUrl);
          }
        });
      }
    }

    // Map database fields to frontend expected names, filter out user_id and front_path
    const sanitizedCards = cards?.map(card => {
      // Extract player name from conversational_card_info if available
      const convInfo = card.conversational_card_info as any;
      const playerOrCharacter = convInfo?.player_or_character || card.featured || card.card_name || 'Unknown';

      return {
        id: card.id,
        serial: card.serial,
        sport_type: card.category, // Map category to sport_type for frontend
        category: card.category,
        visibility: card.visibility,
        front_url: card.front_path ? urlMap.get(card.front_path) || null : null,
        player_name: playerOrCharacter, // Map to expected frontend field name
        year: convInfo?.year || card.release_date || '',
        manufacturer: convInfo?.manufacturer || card.manufacturer_name || '',
        set_name: convInfo?.set_name || card.card_set || '',
        subset: convInfo?.subset || '',
        dvg_decimal_grade: card.dvg_decimal_grade,
        conversational_decimal_grade: card.conversational_decimal_grade,
        created_at: card.created_at,
        // Special features for card display
        rookie_or_first: convInfo?.rookie_or_first || false,
        autographed: convInfo?.autographed || false,
        serial_number: convInfo?.serial_number || null,
        facsimile_autograph: convInfo?.facsimile_autograph || false,
        official_reprint: convInfo?.official_reprint || false,
      };
    }) || [];

    console.log(`🔍 Search: serial="${serial}", sport="${sport}", visibility="${visibilityParam}", results=${sanitizedCards.length}`);

    return NextResponse.json({
      success: true,
      count: sanitizedCards.length,
      cards: sanitizedCards,
      query: {
        serial,
        sport: sport === 'all' ? 'all sports' : sport,
        visibility: visibilityParam
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ [Search API] Unexpected error:', error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
