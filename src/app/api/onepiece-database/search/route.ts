import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/onepiece-database/search
 *
 * Search One Piece cards in the local database
 *
 * Query params:
 * - name: Search by card name (fuzzy match)
 * - card_id: Search by card ID (e.g., OP01-001)
 * - set_id: Filter by set ID (e.g., OP-01)
 * - card_type: Filter by card type (Leader, Character, Event, Stage)
 * - card_color: Filter by color (Red, Blue, Green, Purple, Black, Yellow)
 * - page: Page number (default 1)
 * - limit: Results per page (default 50, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name')?.trim() || '';
    const cardId = searchParams.get('card_id')?.trim() || '';
    const setId = searchParams.get('set_id')?.trim() || '';
    const cardType = searchParams.get('card_type')?.trim() || '';
    const cardColor = searchParams.get('card_color')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const supabase = supabaseServer();

    // Build query
    let query = supabase
      .from('onepiece_cards')
      .select('*', { count: 'exact' });

    // Apply filters
    if (name) {
      query = query.ilike('card_name', `%${name}%`);
    }

    if (cardId) {
      // Allow partial card ID matching (e.g., "OP01" matches all OP01-xxx cards)
      query = query.ilike('id', `%${cardId}%`);
    }

    if (setId) {
      query = query.eq('set_id', setId);
    }

    if (cardType) {
      query = query.eq('card_type', cardType);
    }

    if (cardColor) {
      query = query.eq('card_color', cardColor);
    }

    // Order by set_id and card_number
    const { data, error, count } = await query
      .order('set_id', { ascending: false })
      .order('card_number', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[OnePiece Database API] Search error:', error);
      return NextResponse.json(
        { error: 'Search failed', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      cards: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error: any) {
    console.error('[OnePiece Database API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
