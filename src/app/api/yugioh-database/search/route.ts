import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/yugioh-database/search
 *
 * Search Yu-Gi-Oh! cards in the local database
 *
 * Query params:
 * - name: Search by card name (fuzzy match)
 * - set_code: Filter by set code from printings (e.g., LOB-005, or just LOB)
 * - card_type: Filter by card type (Normal Monster, Effect Monster, Spell Card, Trap Card, etc.)
 * - attribute: Filter by attribute (DARK, LIGHT, FIRE, WATER, EARTH, WIND)
 * - race: Filter by monster type (Spellcaster, Dragon, Warrior, etc.)
 * - frame_type: Filter by frame type (normal, effect, fusion, synchro, xyz, link, spell, trap)
 * - page: Page number (default 1)
 * - limit: Results per page (default 50, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name')?.trim() || '';
    const setCode = searchParams.get('set_code')?.trim() || '';
    const cardType = searchParams.get('card_type')?.trim() || '';
    const attribute = searchParams.get('attribute')?.trim() || '';
    const race = searchParams.get('race')?.trim() || '';
    const frameType = searchParams.get('frame_type')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const supabase = supabaseServer();

    // Build query on yugioh_cards
    let query = supabase
      .from('yugioh_cards')
      .select('*', { count: 'exact' });

    // Apply filters
    if (name) {
      query = query.ilike('name', `%${name}%`);
    }

    if (cardType) {
      query = query.eq('type', cardType);
    }

    if (attribute) {
      query = query.eq('attribute', attribute);
    }

    if (race) {
      query = query.eq('race', race);
    }

    if (frameType) {
      query = query.eq('frame_type', frameType);
    }

    const { data, error, count } = await query
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[YuGiOh Database API] Search error:', error);
      return NextResponse.json(
        { error: 'Search failed', details: error.message },
        { status: 500 }
      );
    }

    let cards = data || [];

    // If set_code filter is applied, we need to cross-reference printings
    // Do a secondary lookup to filter cards that appear in the requested set
    if (setCode && cards.length > 0) {
      const cardIds = cards.map(c => c.id);
      const { data: printings } = await supabase
        .from('yugioh_card_printings')
        .select('card_id, set_code, set_name, set_rarity, set_price')
        .in('card_id', cardIds)
        .ilike('set_code', `${setCode}%`);

      if (printings) {
        const matchingCardIds = new Set(printings.map(p => p.card_id));
        cards = cards.filter(c => matchingCardIds.has(c.id));
      }
    }

    return NextResponse.json({
      cards,
      pagination: {
        page,
        limit,
        total: setCode ? cards.length : (count || 0),
        totalPages: Math.ceil((setCode ? cards.length : (count || 0)) / limit)
      }
    });

  } catch (error: any) {
    console.error('[YuGiOh Database API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
