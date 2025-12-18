import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/pokemon-database/search
 *
 * Search Pokemon cards in the local database
 *
 * Query params:
 * - name: Search by card name (fuzzy match)
 * - set_id: Filter by set ID
 * - number: Filter by card number
 * - set_total: Filter by set printed total (e.g., 102 for Base Set)
 * - language: 'en' (English only, default), 'ja' (Japanese only), 'all' (both)
 * - page: Page number (default 1)
 * - limit: Results per page (default 50, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name')?.trim() || '';
    const setId = searchParams.get('set_id')?.trim() || '';
    const number = searchParams.get('number')?.trim() || '';
    const setTotal = searchParams.get('set_total')?.trim() || '';
    const language = searchParams.get('language')?.trim() || 'en'; // 'en', 'ja', or 'all'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const supabase = supabaseServer();

    // Helper function to build English cards query
    function buildEnglishQuery() {
      let query = supabase
        .from('pokemon_cards')
        .select('*', { count: 'exact' });

      if (name) {
        query = query.ilike('name', `%${name}%`);
      }
      if (setId) {
        query = query.eq('set_id', setId);
      }
      if (number) {
        const hasLetters = /[a-zA-Z]/.test(number);
        if (hasLetters) {
          query = query.ilike('number', `%${number}%`);
        } else {
          const normalizedNumber = number.replace(/^0+/, '') || '0';
          query = query.or(`number.eq.${number},number.eq.${normalizedNumber},number.ilike.%${normalizedNumber}`);
        }
      }
      if (setTotal) {
        const totalNum = parseInt(setTotal);
        if (!isNaN(totalNum)) {
          query = query.eq('set_printed_total', totalNum);
        }
      }

      return query;
    }

    // Helper function to build Japanese cards query
    function buildJapaneseQuery() {
      let query = supabase
        .from('pokemon_cards_ja')
        .select('*', { count: 'exact' });

      if (name) {
        // Search both Japanese name and English name fields
        query = query.or(`name.ilike.%${name}%,name_english.ilike.%${name}%`);
      }
      if (setId) {
        query = query.eq('set_id', setId);
      }
      if (number) {
        const hasLetters = /[a-zA-Z]/.test(number);
        if (hasLetters) {
          query = query.ilike('local_id', `%${number}%`);
        } else {
          const normalizedNumber = number.replace(/^0+/, '') || '0';
          query = query.or(`local_id.eq.${number},local_id.eq.${normalizedNumber},local_id.ilike.%${normalizedNumber}`);
        }
      }
      if (setTotal) {
        const totalNum = parseInt(setTotal);
        if (!isNaN(totalNum)) {
          query = query.eq('set_printed_total', totalNum);
        }
      }

      return query;
    }

    let cards: any[] = [];
    let totalCount = 0;

    if (language === 'en') {
      // English only
      const { data, error, count } = await buildEnglishQuery()
        .order('set_release_date', { ascending: false, nullsFirst: false })
        .order('number', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('[Pokemon Database API] English search error:', error);
        return NextResponse.json(
          { error: 'Search failed', details: error.message },
          { status: 500 }
        );
      }

      cards = (data || []).map(card => ({ ...card, language: 'en' }));
      totalCount = count || 0;

    } else if (language === 'ja') {
      // Japanese only
      const { data, error, count } = await buildJapaneseQuery()
        .order('set_release_date', { ascending: false, nullsFirst: false })
        .order('local_id', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('[Pokemon Database API] Japanese search error:', error);
        return NextResponse.json(
          { error: 'Search failed', details: error.message },
          { status: 500 }
        );
      }

      // Transform Japanese cards to match English card structure for consistent UI
      cards = (data || []).map(card => ({
        ...card,
        language: 'ja',
        number: card.local_id, // Map local_id to number for UI consistency
        name_display: card.name_english ? `${card.name} (${card.name_english})` : card.name
      }));
      totalCount = count || 0;

    } else {
      // Both languages ('all')
      // First get counts from both tables
      const [enResult, jaResult] = await Promise.all([
        buildEnglishQuery()
          .order('set_release_date', { ascending: false, nullsFirst: false })
          .order('number', { ascending: true }),
        buildJapaneseQuery()
          .order('set_release_date', { ascending: false, nullsFirst: false })
          .order('local_id', { ascending: true })
      ]);

      const enCount = enResult.count || 0;
      const jaCount = jaResult.count || 0;
      totalCount = enCount + jaCount;

      // Calculate how many from each table based on offset
      let enCards: any[] = [];
      let jaCards: any[] = [];

      if (offset < enCount) {
        // We need some English cards
        const enLimit = Math.min(limit, enCount - offset);
        const { data } = await buildEnglishQuery()
          .order('set_release_date', { ascending: false, nullsFirst: false })
          .order('number', { ascending: true })
          .range(offset, offset + enLimit - 1);
        enCards = (data || []).map(card => ({ ...card, language: 'en' }));
      }

      // If we have room for Japanese cards
      const remainingSlots = limit - enCards.length;
      if (remainingSlots > 0) {
        const jaOffset = Math.max(0, offset - enCount);
        const { data } = await buildJapaneseQuery()
          .order('set_release_date', { ascending: false, nullsFirst: false })
          .order('local_id', { ascending: true })
          .range(jaOffset, jaOffset + remainingSlots - 1);
        jaCards = (data || []).map(card => ({
          ...card,
          language: 'ja',
          number: card.local_id,
          name_display: card.name_english ? `${card.name} (${card.name_english})` : card.name
        }));
      }

      cards = [...enCards, ...jaCards];
    }

    return NextResponse.json({
      cards,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      language
    });

  } catch (error: any) {
    console.error('[Pokemon Database API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pokemon-database/sets
 *
 * Get all Pokemon sets for the dropdown filter
 */
export async function OPTIONS(request: NextRequest) {
  // This is a workaround - we'll create a separate route for sets
  return NextResponse.json({ message: 'Use GET for search' });
}
