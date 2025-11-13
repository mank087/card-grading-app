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
 * - front_url (for thumbnail)
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

    // Build query
    let query = supabase
      .from('cards')
      .select(`
        id,
        serial,
        sport_type,
        visibility,
        front_url,
        player_name,
        year,
        manufacturer,
        set_name,
        subset,
        dvg_decimal_grade,
        user_id,
        created_at
      `);

    // Search by serial number (case-insensitive, partial match)
    query = query.ilike('serial', `%${serial}%`);

    // Filter by sport if specified
    if (sport && sport !== 'all') {
      query = query.eq('sport_type', sport);
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
    const { data: cards, error: searchError } = await query
      .order('created_at', { ascending: false })
      .limit(50); // Limit to 50 results

    if (searchError) {
      console.error('Error searching cards:', searchError);
      return NextResponse.json(
        { error: "Failed to search cards" },
        { status: 500 }
      );
    }

    // Filter out user_id from results (privacy)
    const sanitizedCards = cards?.map(card => {
      const { user_id, ...cardWithoutUserId } = card;
      return cardWithoutUserId;
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

  } catch (error) {
    console.error('Error in card search:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
