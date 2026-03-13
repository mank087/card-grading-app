import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/starwars-database/sets
 *
 * Get all Star Wars card sets for the dropdown filter
 * Ordered by total cards (largest first)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from('starwars_sets')
      .select('id, name, set_type, total_cards, release_date, genre')
      .order('total_cards', { ascending: false });

    if (error) {
      console.error('[Star Wars Database API] Sets fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sets', details: error.message },
        { status: 500 }
      );
    }

    const sets = data || [];

    // Group sets by era/type for better UX
    const setsByType: Record<string, any[]> = {
      'Trading Cards': [],
      'CCG / TCG': [],
      'Chrome / Premium': [],
      'Stickers': [],
      'Other': [],
    };

    for (const set of sets) {
      const name = (set.name || '').toLowerCase();

      if (name.includes('unlimited') || name.includes('ccg') || name.includes('young jedi')) {
        setsByType['CCG / TCG'].push(set);
      } else if (name.includes('chrome') || name.includes('masterwork') || name.includes('high-tek') || name.includes('finest') || name.includes('sapphire') || name.includes('stellar')) {
        setsByType['Chrome / Premium'].push(set);
      } else if (name.includes('sticker')) {
        setsByType['Stickers'].push(set);
      } else if (name.includes('star wars') || name.includes('1977') || name.includes('1980') || name.includes('1983') || name.includes('topps')) {
        setsByType['Trading Cards'].push(set);
      } else {
        setsByType['Other'].push(set);
      }
    }

    // Remove empty categories
    Object.keys(setsByType).forEach(key => {
      if (setsByType[key].length === 0) {
        delete setsByType[key];
      }
    });

    return NextResponse.json({
      sets,
      setsByType,
      total: sets.length
    });

  } catch (error: any) {
    console.error('[Star Wars Database API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
