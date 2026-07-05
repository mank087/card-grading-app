import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/sports-database/search
 *
 * Search sports card products (every parallel is its own row) in the local
 * database. Public endpoint — powers the /sports-database cards view.
 *
 * Query params:
 * - setUid: Filter by set UID (sports_sets.uid, e.g. "G155")
 * - sport: Filter by sport (joins through sports_sets)
 * - manufacturer: Filter by manufacturer (joins through sports_sets)
 * - year: Filter by year (joins through sports_sets)
 * - playerName: Fuzzy match on player_name
 * - cardNumber: Exact match on card_number (leading # / zeros normalized)
 * - page: Page number (default 1)
 * - limit: Results per page (default 50, max 200 — rows are light, no images)
 *
 * Order: card_number asc (nulls last), then variant_text asc (nulls first) so
 * the base card leads its parallel family on each page.
 */
export async function GET(request: NextRequest) {
  try {
    // Card-level listings require the local product table, which was dropped
    // to reclaim Supabase storage (sports matching/pricing use the live
    // SportsCardsPro API now). The sets browser still works from sports_sets.
    if (process.env.SPORTS_LOCAL_DB_ENABLED !== 'true') {
      return NextResponse.json({
        cards: [],
        unavailable: true,
        message: 'Card-level listings are available on SportsCardsPro. Browse sets here and follow the link for full checklists and prices.',
        pagination: { page: 1, limit: 0, total: 0, totalPages: 0 },
      });
    }

    const searchParams = request.nextUrl.searchParams;
    const setUid = searchParams.get('setUid')?.trim() || '';
    const sport = searchParams.get('sport')?.trim() || '';
    const manufacturer = searchParams.get('manufacturer')?.trim() || '';
    const yearParam = searchParams.get('year')?.trim() || '';
    const playerName = searchParams.get('playerName')?.trim() || '';
    const cardNumberRaw = searchParams.get('cardNumber')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const yearNum = yearParam ? parseInt(yearParam) : NaN;
    const needsSetJoin = !!(sport || manufacturer || (yearParam && !isNaN(yearNum)));

    const supabase = supabaseServer();

    let query = supabase
      .from('sports_card_products')
      .select(
        needsSetJoin ? '*, sports_sets!inner(sport, year, manufacturer)' : '*',
        { count: 'estimated' }
      );

    if (setUid) {
      query = query.eq('set_uid', setUid);
    }
    if (playerName) {
      query = query.ilike('player_name', `%${playerName}%`);
    }
    if (cardNumberRaw) {
      // Import strips leading "#" and zeros and uppercases card_number
      const normalized = cardNumberRaw.replace(/^#/, '').replace(/^0+(?=.)/, '').toUpperCase();
      query = query.eq('card_number', normalized);
    }
    if (sport) {
      query = query.eq('sports_sets.sport', sport);
    }
    if (manufacturer) {
      query = query.eq('sports_sets.manufacturer', manufacturer);
    }
    if (yearParam && !isNaN(yearNum)) {
      query = query.eq('sports_sets.year', yearNum);
    }

    const { data, error, count } = await query
      .order('card_number', { ascending: true, nullsFirst: false })
      .order('variant_text', { ascending: true, nullsFirst: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Sports Database API] Search error:', error);
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
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('[Sports Database API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
