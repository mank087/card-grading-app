/**
 * eBay Price Lookup API
 *
 * Searches eBay for active listings matching a card and returns price data.
 * Uses Application tokens (client credentials) - no user auth required.
 *
 * Features:
 * - Multi-query fallback strategy (specific → moderate → broad → minimal)
 * - Median price calculation (more accurate than average)
 * - Bracket format for parallels to match eBay listing conventions
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  searchEbayPrices,
  searchEbayPricesWithFallback,
  buildSportsCardQuery,
  type SportsCardQueryOptions,
} from '@/lib/ebay/browseApi';
import { EBAY_CATEGORIES } from '@/lib/ebay/constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      card,
      query: customQuery,
      category,
      limit = 25,  // Increased default for better price statistics
      useFallback = true,  // Enable multi-query fallback by default
      minResults = 3,  // Minimum results before trying next query strategy
    } = body;

    // Determine category ID
    let categoryId: string | undefined;
    if (category) {
      categoryId = category === 'sports'
        ? EBAY_CATEGORIES.SPORTS_TRADING_CARDS
        : category === 'ccg'
        ? EBAY_CATEGORIES.CCG_INDIVIDUAL_CARDS
        : category === 'other'
        ? EBAY_CATEGORIES.NON_SPORT_TRADING_CARDS
        : undefined;
    }

    // If custom query provided, use direct search (no fallback)
    if (customQuery) {
      const result = await searchEbayPrices(customQuery, { categoryId, limit });
      return NextResponse.json({
        success: true,
        query: customQuery,
        queryStrategy: 'custom',
        ...result,
      });
    }

    // If card object provided, use fallback strategy for better results
    if (card) {
      const cardOptions: SportsCardQueryOptions = {
        card_name: card.card_name,
        featured: card.featured,
        card_set: card.card_set,
        card_number: card.card_number,
        release_date: card.release_date,
        subset: card.subset,
        rarity_or_variant: card.rarity_or_variant,
        manufacturer: card.manufacturer,
        serial_numbering: card.serial_numbering,
        rookie_card: card.rookie_card,
      };

      if (useFallback) {
        // Use multi-query fallback strategy
        const result = await searchEbayPricesWithFallback(cardOptions, {
          categoryId,
          limit,
          minResults,
        });

        return NextResponse.json({
          success: true,
          query: result.queryUsed,
          queryStrategy: result.queryStrategy,
          ...result,
        });
      } else {
        // Use single query (legacy behavior)
        const searchQuery = buildSportsCardQuery(cardOptions);
        const result = await searchEbayPrices(searchQuery, { categoryId, limit });

        return NextResponse.json({
          success: true,
          query: searchQuery,
          queryStrategy: 'moderate',
          ...result,
        });
      }
    }

    return NextResponse.json(
      { error: 'Either card or query is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[eBay Prices] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support GET for simple queries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    // Determine category ID
    let categoryId: string | undefined;
    if (category) {
      categoryId = category === 'sports'
        ? EBAY_CATEGORIES.SPORTS_TRADING_CARDS
        : category === 'ccg'
        ? EBAY_CATEGORIES.CCG_INDIVIDUAL_CARDS
        : category === 'other'
        ? EBAY_CATEGORIES.NON_SPORT_TRADING_CARDS
        : undefined;
    }

    const result = await searchEbayPrices(query, {
      categoryId,
      limit,
    });

    return NextResponse.json({
      success: true,
      query,
      ...result,
    });
  } catch (error) {
    console.error('[eBay Prices GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
