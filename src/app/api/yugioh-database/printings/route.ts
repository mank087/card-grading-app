import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/yugioh-database/printings
 *
 * Get all printings (set appearances) for a specific Yu-Gi-Oh! card
 *
 * Query params:
 * - card_id: The card's numeric ID from yugioh_cards table
 */
export async function GET(request: NextRequest) {
  try {
    const cardId = request.nextUrl.searchParams.get('card_id');

    if (!cardId) {
      return NextResponse.json(
        { error: 'card_id parameter is required' },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from('yugioh_card_printings')
      .select('*')
      .eq('card_id', parseInt(cardId))
      .order('set_name', { ascending: true })
      .order('set_code', { ascending: true });

    if (error) {
      console.error('[YuGiOh Database API] Printings fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch printings', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      printings: data || [],
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
