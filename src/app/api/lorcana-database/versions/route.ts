import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/lorcana-database/versions
 *
 * Get all versions of a card by name (finds Enchanted, Promo, and other versions)
 *
 * Query params:
 * - name: The base card name to look up all versions
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name')?.trim();

    if (!name) {
      return NextResponse.json(
        { error: 'name parameter is required' },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Fetch all cards with this exact name (different versions have same name)
    const { data, error } = await supabase
      .from('lorcana_cards')
      .select('*')
      .eq('name', name)
      .order('rarity', { ascending: true })
      .order('set_code', { ascending: true })
      .order('collector_number', { ascending: true });

    if (error) {
      console.error('[Lorcana Versions API] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch versions', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      versions: data || [],
      total: data?.length || 0
    });

  } catch (error: any) {
    console.error('[Lorcana Versions API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
