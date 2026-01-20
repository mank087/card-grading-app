/**
 * Admin API: Price Tracker Batch Job
 *
 * POST: Trigger a batch price update job
 * GET: Get batch job status and statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import {
  runPriceUpdateBatch,
  getCardsNeedingPriceUpdate,
} from '@/lib/ebay/priceTracker';

// Allow longer execution time for batch jobs
export const maxDuration = 300; // 5 minutes

/**
 * POST: Trigger a batch price update
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminToken = request.cookies.get('admin_token')?.value;
    if (!adminToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(adminToken);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request options
    const body = await request.json().catch(() => ({}));
    const {
      limit = 50,
      batchSize = 5,
      delayBetweenBatches = 2000,
      cardTypes,
    } = body;

    console.log(`[Price Tracker API] Admin ${admin.username} triggered batch job`);
    console.log(`[Price Tracker API] Options: limit=${limit}, batchSize=${batchSize}, cardTypes=${cardTypes?.join(',') || 'all'}`);

    // Run the batch job
    const result = await runPriceUpdateBatch({
      limit,
      batchSize,
      delayBetweenBatches,
      cardTypes,
    });

    return NextResponse.json({
      success: result.success,
      message: `Batch job completed: ${result.succeeded}/${result.total_cards} cards updated`,
      result,
    });
  } catch (error) {
    console.error('[Price Tracker API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Get statistics about cards needing price updates
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminToken = request.cookies.get('admin_token')?.value;
    if (!adminToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(adminToken);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get count of cards needing updates for each type
    const [sportsCards, pokemonCards, otherCards] = await Promise.all([
      getCardsNeedingPriceUpdate({ limit: 1000, cardTypes: ['sports'] }),
      getCardsNeedingPriceUpdate({ limit: 1000, cardTypes: ['pokemon'] }),
      getCardsNeedingPriceUpdate({ limit: 1000, cardTypes: ['other'] }),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        sports: {
          cards_needing_update: sportsCards.length,
        },
        pokemon: {
          cards_needing_update: pokemonCards.length,
        },
        other: {
          cards_needing_update: otherCards.length,
        },
        total: {
          cards_needing_update: sportsCards.length + pokemonCards.length + otherCards.length,
        },
      },
    });
  } catch (error) {
    console.error('[Price Tracker API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
