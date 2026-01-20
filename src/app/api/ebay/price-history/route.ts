/**
 * eBay Price History API
 *
 * GET: Retrieve price history for a specific card
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCardPriceHistory,
  getLatestCardPrice,
} from '@/lib/ebay/priceTracker';

/**
 * GET: Get price history for a card
 *
 * Query params:
 * - card_id: The card ID (required)
 * - limit: Max number of records to return (default: 52 for ~1 year)
 * - latest_only: If true, only return the most recent snapshot
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get('card_id');
    const limit = parseInt(searchParams.get('limit') || '52');
    const latestOnly = searchParams.get('latest_only') === 'true';

    if (!cardId) {
      return NextResponse.json(
        { error: 'card_id is required' },
        { status: 400 }
      );
    }

    if (latestOnly) {
      // Return only the most recent price snapshot
      const latest = await getLatestCardPrice(cardId);

      if (!latest) {
        return NextResponse.json({
          success: true,
          card_id: cardId,
          has_history: false,
          latest: null,
        });
      }

      // Calculate price change if we have history
      const history = await getCardPriceHistory(cardId, { limit: 2 });
      let priceChange = null;
      let priceChangePercent = null;

      if (history.length >= 2 && history[0].median_price && history[1].median_price) {
        priceChange = history[0].median_price - history[1].median_price;
        priceChangePercent = ((priceChange / history[1].median_price) * 100).toFixed(1);
      }

      return NextResponse.json({
        success: true,
        card_id: cardId,
        has_history: true,
        latest: {
          ...latest,
          price_change: priceChange,
          price_change_percent: priceChangePercent ? parseFloat(priceChangePercent) : null,
        },
      });
    }

    // Return full price history
    const history = await getCardPriceHistory(cardId, { limit });

    if (history.length === 0) {
      return NextResponse.json({
        success: true,
        card_id: cardId,
        has_history: false,
        history: [],
      });
    }

    // Calculate trend metrics
    const latestMedian = history[0]?.median_price;
    const oldestMedian = history[history.length - 1]?.median_price;
    let overallChange = null;
    let overallChangePercent = null;

    if (latestMedian && oldestMedian) {
      overallChange = latestMedian - oldestMedian;
      overallChangePercent = parseFloat(((overallChange / oldestMedian) * 100).toFixed(1));
    }

    return NextResponse.json({
      success: true,
      card_id: cardId,
      has_history: true,
      history,
      trend: {
        current_median: latestMedian,
        oldest_median: oldestMedian,
        overall_change: overallChange,
        overall_change_percent: overallChangePercent,
        data_points: history.length,
      },
    });
  } catch (error) {
    console.error('[Price History API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
