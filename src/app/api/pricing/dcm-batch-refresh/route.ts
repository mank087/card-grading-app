/**
 * DCM Batch Refresh API
 *
 * POST endpoint to batch refresh DCM prices for multiple sports cards.
 * Rate-limited to prevent API abuse.
 *
 * Request body:
 * - card_ids: string[] (max 10 cards per request)
 * - force: boolean (optional, refresh even if cache is fresh, but use cached product ID)
 * - force_new_search: boolean (optional, ignore cached product IDs and do fresh API searches)
 *                     Use this when card info like subset/parallel has been updated
 *
 * Response:
 * - success: boolean
 * - refreshed: number
 * - failed: number
 * - skipped: number
 * - results: Array<{ cardId, success, error? }>
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { batchRefreshDcmPrices } from '@/lib/pricing/dcmPriceTracker';
import { mapPricingErrorToHttpStatus } from '@/lib/pricingFetch';

const MAX_CARDS_PER_REQUEST = 10;
const DELAY_BETWEEN_CARDS_MS = 500;

export interface DcmBatchRefreshRequest {
  card_ids: string[];
  force?: boolean;
  force_new_search?: boolean;
}

export interface DcmBatchRefreshResponse {
  success: boolean;
  refreshed: number;
  failed: number;
  skipped: number;
  results: Array<{ cardId: string; success: boolean; estimate?: number | null; error?: string }>;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<DcmBatchRefreshResponse>> {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          refreshed: 0,
          failed: 0,
          skipped: 0,
          results: [],
          error: 'Unauthorized',
        },
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
        {
          success: false,
          refreshed: 0,
          failed: 0,
          skipped: 0,
          results: [],
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body: DcmBatchRefreshRequest = await request.json();
    const { card_ids, force = false, force_new_search = false } = body;

    if (!card_ids || !Array.isArray(card_ids) || card_ids.length === 0) {
      return NextResponse.json(
        {
          success: false,
          refreshed: 0,
          failed: 0,
          skipped: 0,
          results: [],
          error: 'card_ids array is required',
        },
        { status: 400 }
      );
    }

    // Limit number of cards per request
    if (card_ids.length > MAX_CARDS_PER_REQUEST) {
      return NextResponse.json(
        {
          success: false,
          refreshed: 0,
          failed: 0,
          skipped: 0,
          results: [],
          error: `Maximum ${MAX_CARDS_PER_REQUEST} cards per request`,
        },
        { status: 400 }
      );
    }

    // Verify user owns all these cards
    const { data: ownedCards, error: ownerError } = await supabase
      .from('cards')
      .select('id')
      .in('id', card_ids)
      .eq('user_id', user.id);

    if (ownerError) {
      console.error('[DCM Batch Refresh] Error verifying card ownership:', ownerError);
      return NextResponse.json(
        {
          success: false,
          refreshed: 0,
          failed: 0,
          skipped: 0,
          results: [],
          error: 'Failed to verify card ownership',
        },
        { status: 500 }
      );
    }

    const ownedCardIds = new Set(ownedCards?.map(c => c.id) || []);
    const validCardIds = card_ids.filter(id => ownedCardIds.has(id));

    if (validCardIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          refreshed: 0,
          failed: 0,
          skipped: card_ids.length,
          results: card_ids.map(id => ({
            cardId: id,
            success: false,
            error: 'Card not found or not owned by user',
          })),
          error: 'No valid cards to refresh',
        },
        { status: 400 }
      );
    }

    console.log(`[DCM Batch Refresh] Refreshing ${validCardIds.length} cards for user ${user.id} (force: ${force}, forceNewSearch: ${force_new_search})`);

    // Batch refresh
    const result = await batchRefreshDcmPrices(validCardIds, {
      force,
      forceNewSearch: force_new_search,
      delayMs: DELAY_BETWEEN_CARDS_MS,
    });

    // Add results for cards that weren't owned
    const notOwnedCards = card_ids.filter(id => !ownedCardIds.has(id));
    for (const cardId of notOwnedCards) {
      result.results.push({
        cardId,
        success: false,
        error: 'Card not found or not owned by user',
      });
      result.skipped++;
    }

    return NextResponse.json({
      success: result.success,
      refreshed: result.refreshed,
      failed: result.failed,
      skipped: result.skipped,
      results: result.results,
    });
  } catch (error) {
    console.error('[DCM Batch Refresh] Error:', error);
    return NextResponse.json(
      {
        success: false,
        refreshed: 0,
        failed: 0,
        skipped: 0,
        results: [],
        error: error instanceof Error ? error.message : 'Failed to batch refresh prices',
      },
      { status: mapPricingErrorToHttpStatus(error) }
    );
  }
}
