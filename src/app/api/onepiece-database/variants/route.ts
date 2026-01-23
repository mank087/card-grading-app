import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/onepiece-database/variants
 *
 * Get all variants of a card by base_card_id
 *
 * Query params:
 * - base_card_id: The base card ID to look up all variants (e.g., "OP01-120")
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const baseCardId = searchParams.get('base_card_id')?.trim();

    if (!baseCardId) {
      return NextResponse.json(
        { error: 'base_card_id parameter is required' },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Fetch all cards with this base_card_id OR the base card itself
    const { data, error } = await supabase
      .from('onepiece_cards')
      .select('*')
      .or(`id.eq.${baseCardId},base_card_id.eq.${baseCardId}`)
      .order('variant_type', { nullsFirst: true })
      .order('market_price', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('[One Piece Variants API] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch variants', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      variants: data || [],
      total: data?.length || 0
    });

  } catch (error: any) {
    console.error('[One Piece Variants API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
