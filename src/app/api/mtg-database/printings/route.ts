import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/mtg-database/printings
 *
 * Get all printings of a card by oracle_id
 *
 * Query params:
 * - oracle_id: The oracle ID to look up all printings
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const oracleId = searchParams.get('oracle_id')?.trim();

    if (!oracleId) {
      return NextResponse.json(
        { error: 'oracle_id parameter is required' },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Fetch all cards with this oracle_id
    const { data, error } = await supabase
      .from('mtg_cards')
      .select('*')
      .eq('oracle_id', oracleId)
      .order('released_at', { ascending: false });

    if (error) {
      console.error('[MTG Printings API] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch printings', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      printings: data || [],
      total: data?.length || 0
    });

  } catch (error: any) {
    console.error('[MTG Printings API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
