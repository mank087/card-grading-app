/**
 * DCM Cached Price API
 *
 * GET endpoint to fetch DCM price estimates for sports cards.
 * Returns cached price if fresh, otherwise fetches from SportsCardsPro and caches.
 *
 * Parameters:
 * - card_id (required): The card UUID
 * - refresh (optional): Set to 'true' to force refresh (uses cached product ID)
 * - new_search (optional): Set to 'true' to force a completely new search
 *                          Use this when card info has changed (e.g., parallel/subset updated)
 *
 * Response:
 * - success: boolean
 * - source: 'cache' | 'fresh' | 'none'
 * - data: DcmCachedPrice | null
 * - is_stale: boolean
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  getCachedDcmPrice,
  getDcmPriceWithCache,
  isDcmPriceCacheStale,
  isSportsCardCategory,
  type DcmCachedPrice,
} from '@/lib/pricing/dcmPriceTracker';
import { mapPricingErrorToHttpStatus } from '@/lib/pricingFetch';

export interface DcmCachedPriceResponse {
  success: boolean;
  source: 'cache' | 'fresh' | 'none';
  data: DcmCachedPrice | null;
  is_stale: boolean;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<DcmCachedPriceResponse>> {
  const searchParams = request.nextUrl.searchParams;
  const cardId = searchParams.get('card_id');
  const forceRefresh = searchParams.get('refresh') === 'true';
  const forceNewSearch = searchParams.get('new_search') === 'true';

  if (!cardId) {
    return NextResponse.json(
      {
        success: false,
        source: 'none',
        data: null,
        is_stale: true,
        error: 'card_id parameter is required',
      },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();

  try {
    // Fetch card data
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select(`
        id,
        category,
        conversational_decimal_grade,
        conversational_card_info,
        dcm_price_updated_at
      `)
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        {
          success: false,
          source: 'none',
          data: null,
          is_stale: true,
          error: 'Card not found',
        },
        { status: 404 }
      );
    }

    // Check if this is a sports card
    if (!isSportsCardCategory(card.category)) {
      return NextResponse.json(
        {
          success: false,
          source: 'none',
          data: null,
          is_stale: true,
          error: 'DCM pricing is only available for sports cards',
        },
        { status: 400 }
      );
    }

    // If forcing a new search, skip cache entirely and do fresh search
    if (forceNewSearch) {
      console.log(`[DCM API] Force new search requested for card ${cardId}`);
      const freshPrice = await getDcmPriceWithCache(cardId, {
        category: card.category,
        conversational_decimal_grade: card.conversational_decimal_grade,
        conversational_card_info: card.conversational_card_info,
      }, { forceNewSearch: true });

      if (!freshPrice) {
        return NextResponse.json({
          success: true,
          source: 'none',
          data: null,
          is_stale: true,
        });
      }

      return NextResponse.json({
        success: true,
        source: 'fresh',
        data: freshPrice,
        is_stale: false,
      });
    }

    // Check for cached price first (unless force refresh)
    if (!forceRefresh) {
      const cached = await getCachedDcmPrice(cardId);
      const isStale = isDcmPriceCacheStale(cached?.updated_at || null);

      if (cached && !isStale) {
        return NextResponse.json({
          success: true,
          source: 'cache',
          data: cached,
          is_stale: false,
        });
      }

      // If stale but exists, try to refresh in background and return stale data
      if (cached && isStale) {
        // Start refresh in background (don't await)
        getDcmPriceWithCache(cardId, {
          category: card.category,
          conversational_decimal_grade: card.conversational_decimal_grade,
          conversational_card_info: card.conversational_card_info,
        }, { forceRefresh: true }).catch(err => {
          console.error(`[DCM API] Background refresh failed for ${cardId}:`, err);
        });

        return NextResponse.json({
          success: true,
          source: 'cache',
          data: cached,
          is_stale: true,
        });
      }
    }

    // Fetch fresh price
    const freshPrice = await getDcmPriceWithCache(cardId, {
      category: card.category,
      conversational_decimal_grade: card.conversational_decimal_grade,
      conversational_card_info: card.conversational_card_info,
    }, { forceRefresh: true });

    if (!freshPrice) {
      return NextResponse.json({
        success: true,
        source: 'none',
        data: null,
        is_stale: true,
      });
    }

    return NextResponse.json({
      success: true,
      source: 'fresh',
      data: freshPrice,
      is_stale: false,
    });
  } catch (error) {
    console.error('[DCM Cached Price API] Error:', error);

    // Try to return cached data on error
    try {
      const cached = await getCachedDcmPrice(cardId);
      if (cached) {
        return NextResponse.json({
          success: true,
          source: 'cache',
          data: cached,
          is_stale: isDcmPriceCacheStale(cached.updated_at),
        });
      }
    } catch {
      // Ignore cache fetch error
    }

    return NextResponse.json(
      {
        success: false,
        source: 'none',
        data: null,
        is_stale: true,
        error: error instanceof Error ? error.message : 'Failed to fetch DCM price',
      },
      { status: mapPricingErrorToHttpStatus(error) }
    );
  }
}
