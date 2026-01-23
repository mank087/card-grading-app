import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/mtg-database/search
 *
 * Search MTG cards in the local database
 *
 * Query params:
 * - name: Search by card name (fuzzy match)
 * - collector_number: Search by collector number
 * - set_code: Filter by set code (e.g., "mkm", "one", "dmu")
 * - colors: Filter by colors (comma-separated: W,U,B,R,G)
 * - rarity: Filter by rarity (common, uncommon, rare, mythic)
 * - type_line: Filter by type line (partial match)
 * - page: Page number (default 1)
 * - limit: Results per page (default 50, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name')?.trim() || '';
    const collectorNumber = searchParams.get('collector_number')?.trim() || '';
    const setCode = searchParams.get('set_code')?.trim().toLowerCase() || '';
    const colors = searchParams.get('colors')?.trim() || '';
    const rarity = searchParams.get('rarity')?.trim().toLowerCase() || '';
    const typeLine = searchParams.get('type_line')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const supabase = supabaseServer();

    // Build query
    let query = supabase
      .from('mtg_cards')
      .select('*', { count: 'exact' });

    // Apply filters
    if (name) {
      // Search name field with case-insensitive partial match
      query = query.ilike('name', `%${name}%`);
    }

    if (collectorNumber) {
      // Normalize collector number (remove leading zeros for numeric)
      const normalized = /^\d+$/.test(collectorNumber)
        ? collectorNumber.replace(/^0+/, '') || '0'
        : collectorNumber.toLowerCase();
      query = query.eq('collector_number', normalized);
    }

    if (setCode) {
      query = query.eq('set_code', setCode);
    }

    if (colors) {
      // Colors is comma-separated (e.g., "W,U" for white and blue)
      const colorArray = colors.split(',').map(c => c.trim().toUpperCase());
      // Use contains for array matching
      query = query.contains('colors', colorArray);
    }

    if (rarity) {
      query = query.eq('rarity', rarity);
    }

    if (typeLine) {
      // Partial match on type line
      query = query.ilike('type_line', `%${typeLine}%`);
    }

    // Order by release date (newest first) and collector number
    const { data, error, count } = await query
      .order('released_at', { ascending: false })
      .order('collector_number', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[MTG Database API] Search error:', error);
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
    console.error('[MTG Database API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
