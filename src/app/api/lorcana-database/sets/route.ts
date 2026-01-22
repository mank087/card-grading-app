import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/lorcana-database/sets
 *
 * Get all Lorcana sets for the dropdown filter
 * Ordered by release date (newest first)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from('lorcana_sets')
      .select('id, code, name, released_at, total_cards')
      .order('released_at', { ascending: false });

    if (error) {
      console.error('[Lorcana Database API] Sets fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sets', details: error.message },
        { status: 500 }
      );
    }

    const sets = data || [];

    // Group sets by type for better UX
    const setsByType: Record<string, any[]> = {
      'Main Sets': [],
      'Promo Sets': [],
      'Special Sets': []
    };

    for (const set of sets) {
      const code = set.code || '';
      // Main sets are numbered 1-10+
      if (/^\d+$/.test(code)) {
        setsByType['Main Sets'].push(set);
      }
      // Promo sets start with P
      else if (code.startsWith('P') || code.toLowerCase().includes('promo')) {
        setsByType['Promo Sets'].push(set);
      }
      // Everything else (D23, cp, etc.)
      else {
        setsByType['Special Sets'].push(set);
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
    console.error('[Lorcana Database API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
