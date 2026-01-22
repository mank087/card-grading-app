import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/onepiece-database/sets
 *
 * Get all One Piece sets for the dropdown filter
 * Ordered by set ID (newest first based on set number)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from('onepiece_sets')
      .select('id, name, set_type, total_cards')
      .order('id', { ascending: false });

    if (error) {
      console.error('[OnePiece Database API] Sets fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sets', details: error.message },
        { status: 500 }
      );
    }

    const sets = data || [];

    // Group sets by type for better UX
    const setsByType: Record<string, any[]> = {
      'Booster Sets': [],
      'Starter Decks': [],
      'Extra Boosters': [],
      'Promo': [],
      'Other': []
    };

    for (const set of sets) {
      const type = set.set_type || 'other';
      if (type === 'booster') {
        setsByType['Booster Sets'].push(set);
      } else if (type === 'starter') {
        setsByType['Starter Decks'].push(set);
      } else if (type === 'extra') {
        setsByType['Extra Boosters'].push(set);
      } else if (type === 'promo') {
        setsByType['Promo'].push(set);
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
    console.error('[OnePiece Database API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
