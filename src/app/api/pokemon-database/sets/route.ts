import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/pokemon-database/sets
 *
 * Get all Pokemon sets for the dropdown filter
 * Ordered by release date (newest first)
 *
 * Query params:
 * - language: 'en' (default), 'ja', or 'all'
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const language = searchParams.get('language')?.trim() || 'en';

    const supabase = supabaseServer();

    let englishSets: any[] = [];
    let japaneseSets: any[] = [];

    // Fetch English sets
    if (language === 'en' || language === 'all') {
      const { data, error } = await supabase
        .from('pokemon_sets')
        .select('id, name, series, printed_total, release_date, logo_url, symbol_url')
        .order('release_date', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('[Pokemon Database API] English sets fetch error:', error);
      } else {
        englishSets = (data || []).map(set => ({ ...set, language: 'en' }));
      }
    }

    // Fetch Japanese sets
    if (language === 'ja' || language === 'all') {
      const { data, error } = await supabase
        .from('pokemon_sets_ja')
        .select('id, name, series, printed_total, release_date, logo_url, symbol_url')
        .order('release_date', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('[Pokemon Database API] Japanese sets fetch error:', error);
      } else {
        japaneseSets = (data || []).map(set => ({ ...set, language: 'ja' }));
      }
    }

    // Combine sets based on language
    let sets: any[] = [];
    if (language === 'en') {
      sets = englishSets;
    } else if (language === 'ja') {
      sets = japaneseSets;
    } else {
      sets = [...englishSets, ...japaneseSets];
    }

    // Group sets by series for better UX
    const setsBySeries: Record<string, any[]> = {};
    for (const set of sets) {
      const series = set.series || 'Other';
      if (!setsBySeries[series]) {
        setsBySeries[series] = [];
      }
      setsBySeries[series].push(set);
    }

    return NextResponse.json({
      sets,
      setsBySeries,
      total: sets.length,
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
