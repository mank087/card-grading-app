/**
 * eBay Price Lookup API
 *
 * Searches eBay for active listings matching a card and returns price data.
 * Uses Application tokens (client credentials) - no user auth required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchEbayPrices, buildSportsCardQuery } from '@/lib/ebay/browseApi';
import { EBAY_CATEGORIES } from '@/lib/ebay/constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { card, query: customQuery, category, limit = 10 } = body;

    console.log('[eBay Prices] Request:', { card, customQuery, category, limit });

    // Build search query
    let searchQuery: string;
    if (customQuery) {
      searchQuery = customQuery;
    } else if (card) {
      searchQuery = buildSportsCardQuery(card);
    } else {
      return NextResponse.json(
        { error: 'Either card or query is required' },
        { status: 400 }
      );
    }

    console.log('[eBay Prices] Search query:', searchQuery);

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

    // Search eBay
    const result = await searchEbayPrices(searchQuery, {
      categoryId,
      limit,
    });

    console.log('[eBay Prices] Result:', {
      total: result.total,
      items: result.items.length,
      lowestPrice: result.lowestPrice,
      highestPrice: result.highestPrice,
      averagePrice: result.averagePrice,
    });

    return NextResponse.json({
      success: true,
      query: searchQuery,
      ...result,
    });
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

    console.log('[eBay Prices GET] Query:', query, 'Category:', category);

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
