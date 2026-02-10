/**
 * DCM Price Save API
 *
 * POST endpoint to save DCM price data to the cards table.
 * Used by the collection page after fetching prices from /api/pricing/pricecharting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export interface DcmSaveRequest {
  card_id: string;
  estimate: number | null;
  raw?: number | null;
  graded_high?: number | null;
  median?: number | null;
  average?: number | null;
  match_confidence?: string;
  product_id?: string;
  product_name?: string;
}

export interface DcmSaveResponse {
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<DcmSaveResponse>> {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify the user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: DcmSaveRequest = await request.json();
    const { card_id, estimate, raw, graded_high, median, average, match_confidence, product_id, product_name } = body;

    if (!card_id) {
      return NextResponse.json(
        { success: false, error: 'card_id is required' },
        { status: 400 }
      );
    }

    // Verify user owns this card
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id')
      .eq('id', card_id)
      .eq('user_id', user.id)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { success: false, error: 'Card not found or not owned by user' },
        { status: 404 }
      );
    }

    // Update the card with DCM price data
    const { error: updateError } = await supabase
      .from('cards')
      .update({
        dcm_price_estimate: estimate,
        dcm_price_raw: raw ?? null,
        dcm_price_graded_high: graded_high ?? null,
        dcm_price_median: median ?? null,
        dcm_price_average: average ?? null,
        dcm_price_updated_at: new Date().toISOString(),
        dcm_price_match_confidence: match_confidence ?? null,
        dcm_price_product_id: product_id ?? null,
        dcm_price_product_name: product_name ?? null,
      })
      .eq('id', card_id);

    if (updateError) {
      console.error('[DCM Save] Error updating card:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to save price data' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DCM Save] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to save price' },
      { status: 500 }
    );
  }
}
