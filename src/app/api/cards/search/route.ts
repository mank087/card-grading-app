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

    // Build query - includes all fields needed for label generation
    let query = supabase
      .from('cards')
      .select(`
        id, serial, category, visibility, front_path, featured, pokemon_featured,
        card_name, release_date, manufacturer_name, card_set, card_number,
        dvg_decimal_grade, conversational_decimal_grade,
        conversational_whole_grade, conversational_card_info, conversational_condition_label, conversational_grading,
        user_id, created_at,
        is_foil, foil_type, is_double_faced, mtg_rarity, holofoil,
        serial_numbering, rarity_tier, rarity_description,
        autographed, autograph_type, memorabilia_type,
        rookie_card, first_print_rookie
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

    // Map database fields to frontend - include all raw fields for label generation
    const sanitizedCards = cards?.map(card => {
      // Parse conversational_grading JSON if conversational_card_info is missing
      let enrichedCard = { ...card };
      if (!card.conversational_card_info && card.conversational_grading) {
        try {
          const parsed = typeof card.conversational_grading === 'string'
            ? JSON.parse(card.conversational_grading)
            : card.conversational_grading;

          if (parsed.card_info) {
            enrichedCard.conversational_card_info = parsed.card_info;
            if (!card.featured && parsed.card_info.player_or_character) {
              enrichedCard.featured = parsed.card_info.player_or_character;
            }
            if (!card.card_name && parsed.card_info.card_name) {
              enrichedCard.card_name = parsed.card_info.card_name;
            }
            if (!card.card_set && parsed.card_info.set_name) {
              enrichedCard.card_set = parsed.card_info.set_name;
            }
            if (!card.card_number && parsed.card_info.card_number) {
              enrichedCard.card_number = parsed.card_info.card_number;
            }
            if (!card.release_date && parsed.card_info.year) {
              enrichedCard.release_date = parsed.card_info.year;
            }
          }
          if (!card.conversational_decimal_grade) {
            const grade = parsed.grading_passes?.averaged_rounded?.final ?? parsed.final_grade?.decimal_grade;
            if (grade !== undefined && grade !== null) {
              enrichedCard.conversational_decimal_grade = grade;
              enrichedCard.conversational_whole_grade = Math.floor(grade);
            }
          }
          if (!card.conversational_condition_label && parsed.final_grade?.condition_label) {
            enrichedCard.conversational_condition_label = parsed.final_grade.condition_label;
          }
        } catch (e) {
          // Parsing failed, continue with original data
        }
      }

      const convInfo = enrichedCard.conversational_card_info as any;
      const playerOrCharacter = convInfo?.player_or_character || enrichedCard.featured || enrichedCard.card_name || 'Unknown';

      return {
        // Core identifiers
        id: enrichedCard.id,
        serial: enrichedCard.serial,
        sport_type: enrichedCard.category,
        category: enrichedCard.category,
        visibility: enrichedCard.visibility,
        front_url: enrichedCard.front_path ? urlMap.get(enrichedCard.front_path) || null : null,
        created_at: enrichedCard.created_at,
        // Friendly mapped names for backward compatibility
        player_name: playerOrCharacter,
        year: convInfo?.year || enrichedCard.release_date || '',
        manufacturer: convInfo?.manufacturer || enrichedCard.manufacturer_name || '',
        set_name: convInfo?.set_name || enrichedCard.card_set || '',
        subset: convInfo?.subset || '',
        // Raw fields needed for getCardLabelData()
        featured: enrichedCard.featured,
        pokemon_featured: enrichedCard.pokemon_featured,
        card_name: enrichedCard.card_name,
        card_set: enrichedCard.card_set,
        card_number: enrichedCard.card_number,
        release_date: enrichedCard.release_date,
        conversational_decimal_grade: enrichedCard.conversational_decimal_grade,
        conversational_whole_grade: enrichedCard.conversational_whole_grade,
        conversational_condition_label: enrichedCard.conversational_condition_label,
        conversational_card_info: enrichedCard.conversational_card_info,
        dvg_decimal_grade: enrichedCard.dvg_decimal_grade,
        // Features for label
        serial_numbering: enrichedCard.serial_numbering,
        rarity_tier: enrichedCard.rarity_tier,
        rarity_description: enrichedCard.rarity_description,
        autographed: enrichedCard.autographed,
        autograph_type: enrichedCard.autograph_type,
        memorabilia_type: enrichedCard.memorabilia_type,
        rookie_card: enrichedCard.rookie_card,
        first_print_rookie: enrichedCard.first_print_rookie,
        holofoil: enrichedCard.holofoil,
        // MTG-specific
        is_foil: enrichedCard.is_foil || false,
        foil_type: enrichedCard.foil_type || null,
        is_double_faced: enrichedCard.is_double_faced || false,
        mtg_rarity: enrichedCard.mtg_rarity || null,
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
