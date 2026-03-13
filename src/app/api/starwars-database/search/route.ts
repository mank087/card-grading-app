import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/starwars-database/search
 *
 * Search Star Wars cards in the local database
 *
 * Query params:
 * - name: Search by card name (fuzzy match)
 * - card_number: Search by card number
 * - set_id: Filter by set ID (slug)
 * - page: Page number (default 1)
 * - limit: Results per page (default 50, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name')?.trim() || '';
    const cardNumber = searchParams.get('card_number')?.trim() || '';
    const setId = searchParams.get('set_id')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const supabase = supabaseServer();

    // Build query
    let query = supabase
      .from('starwars_cards')
      .select('*', { count: 'exact' });

    // Apply filters
    if (name) {
      query = query.ilike('card_name', `%${name}%`);
    }

    if (cardNumber) {
      query = query.eq('card_number', cardNumber);
    }

    if (setId) {
      query = query.eq('set_id', setId);
    }

    // Order by set_name (newest first) and card_name
    const { data, error, count } = await query
      .order('set_name', { ascending: false })
      .order('card_name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Star Wars Database API] Search error:', error);
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
    console.error('[Star Wars Database API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
