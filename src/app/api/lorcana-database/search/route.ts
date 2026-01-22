import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/lorcana-database/search
 *
 * Search Lorcana cards in the local database
 *
 * Query params:
 * - name: Search by card name (fuzzy match)
 * - collector_number: Search by collector number
 * - set_code: Filter by set code (e.g., "1", "2", "P1")
 * - ink: Filter by ink color (Amber, Amethyst, Emerald, Ruby, Sapphire, Steel)
 * - rarity: Filter by rarity
 * - card_type: Filter by card type (Character, Action, Item, Location)
 * - page: Page number (default 1)
 * - limit: Results per page (default 50, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name')?.trim() || '';
    const collectorNumber = searchParams.get('collector_number')?.trim() || '';
    const setCode = searchParams.get('set_code')?.trim() || '';
    const ink = searchParams.get('ink')?.trim() || '';
    const rarity = searchParams.get('rarity')?.trim() || '';
    const cardType = searchParams.get('card_type')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const supabase = supabaseServer();

    // Build query
    let query = supabase
      .from('lorcana_cards')
      .select('*', { count: 'exact' });

    // Apply filters
    if (name) {
      // Search both name and full_name
      query = query.or(`name.ilike.%${name}%,full_name.ilike.%${name}%`);
    }

    if (collectorNumber) {
      query = query.eq('collector_number', collectorNumber);
    }

    if (setCode) {
      query = query.eq('set_code', setCode);
    }

    if (ink) {
      query = query.eq('ink', ink);
    }

    if (rarity) {
      query = query.eq('rarity', rarity);
    }

    if (cardType) {
      // card_type is an array, use contains
      query = query.contains('card_type', [cardType]);
    }

    // Order by set_code (newest first) and collector_number
    const { data, error, count } = await query
      .order('set_code', { ascending: false })
      .order('collector_number', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Lorcana Database API] Search error:', error);
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
    console.error('[Lorcana Database API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
