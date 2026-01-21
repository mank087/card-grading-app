/**
 * eBay Cached Price API
 *
 * Returns cached price data for a card, refreshing if stale (> 7 days)
 * This reduces API calls by serving cached data when fresh
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCachedCardPrice,
  getCardPriceWithCache,
  isPriceCacheStale,
  type CachedPrice
} from '@/lib/ebay/priceTracker';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cardId = searchParams.get('card_id');
  const forceRefresh = searchParams.get('refresh') === 'true';

  if (!cardId) {
    return NextResponse.json(
      { success: false, error: 'card_id is required' },
      { status: 400 }
    );
  }

  try {
    const supabase = supabaseServer();

    // Get card data for potential refresh
    // Include direct fields as fallback for conversational_card_info
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select(`
        id,
        category,
        conversational_card_info,
        card_name,
        card_number,
        card_set,
        featured,
        pokemon_featured,
        release_date,
        manufacturer_name,
        ebay_price_lowest,
        ebay_price_median,
        ebay_price_average,
        ebay_price_highest,
        ebay_price_listing_count,
        ebay_price_updated_at
      `)
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { success: false, error: 'Card not found' },
        { status: 404 }
      );
    }

    // Check if we have cached data and if it's fresh
    const hasCachedData = card.ebay_price_updated_at !== null;
    const isStale = isPriceCacheStale(card.ebay_price_updated_at, 7);

    // If we have fresh cached data and not forcing refresh, return it
    if (hasCachedData && !isStale && !forceRefresh) {
      return NextResponse.json({
        success: true,
        source: 'cache',
        data: {
          lowest_price: card.ebay_price_lowest,
          median_price: card.ebay_price_median,
          average_price: card.ebay_price_average,
          highest_price: card.ebay_price_highest,
          listing_count: card.ebay_price_listing_count,
          updated_at: card.ebay_price_updated_at,
        },
        is_stale: false,
      });
    }

    // Need to refresh - fetch fresh prices from eBay
    // Merge direct card fields as fallback for conversational_card_info
    const cardInfo = card.conversational_card_info || {};
    const mergedCardInfo = {
      ...cardInfo,
      // Use direct fields as fallback if not in conversational_card_info
      card_name: cardInfo.card_name || card.card_name,
      card_number: cardInfo.card_number || cardInfo.card_number_raw || card.card_number,
      set_name: cardInfo.set_name || card.card_set,
      player_or_character: cardInfo.player_or_character || card.featured || card.pokemon_featured,
      year: cardInfo.year || card.release_date,
      manufacturer: cardInfo.manufacturer || card.manufacturer_name,
    };

    const freshPrice = await getCardPriceWithCache(
      cardId,
      {
        category: card.category || 'Other',
        conversational_card_info: mergedCardInfo,
      },
      { forceRefresh: true }
    );

    if (!freshPrice) {
      // No price data available (card may not have enough info)
      // Return cached data if we have it, otherwise null
      if (hasCachedData) {
        return NextResponse.json({
          success: true,
          source: 'cache',
          data: {
            lowest_price: card.ebay_price_lowest,
            median_price: card.ebay_price_median,
            average_price: card.ebay_price_average,
            highest_price: card.ebay_price_highest,
            listing_count: card.ebay_price_listing_count,
            updated_at: card.ebay_price_updated_at,
          },
          is_stale: true,
          refresh_failed: true,
          message: 'Could not refresh prices - insufficient card info',
        });
      }

      return NextResponse.json({
        success: true,
        source: 'none',
        data: null,
        message: 'No price data available for this card',
      });
    }

    return NextResponse.json({
      success: true,
      source: 'fresh',
      data: freshPrice,
      is_stale: false,
    });
  } catch (error) {
    console.error('[Cached Price API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch price data'
      },
      { status: 500 }
    );
  }
}
