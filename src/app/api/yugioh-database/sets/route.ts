import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/yugioh-database/sets
 *
 * Get all Yu-Gi-Oh! sets for the dropdown filter
 * Ordered by release date (newest first)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from('yugioh_sets')
      .select('set_code, set_name, num_of_cards, tcg_date')
      .order('tcg_date', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('[YuGiOh Database API] Sets fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sets', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sets: data || [],
      total: (data || []).length
    });

  } catch (error: any) {
    console.error('[YuGiOh Database API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
