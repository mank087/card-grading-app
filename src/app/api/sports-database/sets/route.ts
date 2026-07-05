import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/sports-database/sets
 *
 * Browse sports card sets (SportsCardsPro "consoles") in the local database.
 * Public endpoint — powers the /sports-database sets browser.
 *
 * Query params:
 * - sport: Filter by sport (e.g. "basketball")
 * - manufacturer: Filter by manufacturer (e.g. "Topps")
 * - year: Filter by year (e.g. 1986)
 * - q: Fuzzy search on console_name (e.g. "prizm")
 * - page: Page number (default 1)
 * - limit: Results per page (default 100, max 500)
 *
 * Response also includes distinct filter options (sports, manufacturers, years)
 * derived from sports_sets and cached in-process for 10 minutes.
 */

interface FilterOptions {
  sports: string[];
  manufacturers: string[];
  years: number[];
}

let cachedFilterOptions: { options: FilterOptions; fetchedAt: number } | null = null;
const FILTER_CACHE_TTL_MS = 10 * 60 * 1000;
const FILTER_SCAN_CHUNK = 1000;
const FILTER_SCAN_MAX_CHUNKS = 50;

async function loadFilterOptions(
  supabase: ReturnType<typeof supabaseServer>
): Promise<FilterOptions> {
  if (cachedFilterOptions && Date.now() - cachedFilterOptions.fetchedAt < FILTER_CACHE_TTL_MS) {
    return cachedFilterOptions.options;
  }

  const sports = new Set<string>();
  const manufacturers = new Set<string>();
  const years = new Set<number>();

  // PostgREST has no DISTINCT, so scan the (small) sets table in chunks and
  // dedupe here. Only 3 light columns per row; result is cached per instance.
  for (let chunk = 0; chunk < FILTER_SCAN_MAX_CHUNKS; chunk++) {
    const from = chunk * FILTER_SCAN_CHUNK;
    const { data, error } = await supabase
      .from('sports_sets')
      .select('sport, manufacturer, year')
      .order('uid', { ascending: true })
      .range(from, from + FILTER_SCAN_CHUNK - 1);

    if (error) {
      console.error('[Sports Database API] Filter options scan error:', error);
      break;
    }

    for (const row of data || []) {
      if (row.sport) sports.add(row.sport);
      if (row.manufacturer) manufacturers.add(row.manufacturer);
      if (row.year) years.add(row.year);
    }

    if (!data || data.length < FILTER_SCAN_CHUNK) break;
  }

  const options: FilterOptions = {
    sports: Array.from(sports).sort(),
    manufacturers: Array.from(manufacturers).sort(),
    years: Array.from(years).sort((a, b) => b - a),
  };

  cachedFilterOptions = { options, fetchedAt: Date.now() };
  return options;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sport = searchParams.get('sport')?.trim() || '';
    const manufacturer = searchParams.get('manufacturer')?.trim() || '';
    const yearParam = searchParams.get('year')?.trim() || '';
    const q = searchParams.get('q')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100')));
    const offset = (page - 1) * limit;

    const supabase = supabaseServer();

    let query = supabase
      .from('sports_sets')
      .select('uid, slug, console_name, sport, year, manufacturer, set_name, product_count', {
        count: 'estimated',
      });

    if (sport) {
      query = query.eq('sport', sport);
    }
    if (manufacturer) {
      query = query.eq('manufacturer', manufacturer);
    }
    if (yearParam) {
      const yearNum = parseInt(yearParam);
      if (!isNaN(yearNum)) {
        query = query.eq('year', yearNum);
      }
    }
    if (q) {
      query = query.ilike('console_name', `%${q}%`);
    }

    const [setsResult, filters] = await Promise.all([
      query
        .order('year', { ascending: false, nullsFirst: false })
        .order('manufacturer', { ascending: true, nullsFirst: false })
        .order('set_name', { ascending: true, nullsFirst: false })
        .range(offset, offset + limit - 1),
      loadFilterOptions(supabase),
    ]);

    const { data, error, count } = setsResult;

    if (error) {
      console.error('[Sports Database API] Sets fetch error:', error);
      return NextResponse.json(
        { error: 'Sets fetch failed', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sets: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      filters,
    });
  } catch (error: any) {
    console.error('[Sports Database API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
