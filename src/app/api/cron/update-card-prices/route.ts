/**
 * Card Price Tracker Cron Job
 * Runs weekly to capture eBay price snapshots for all graded cards
 *
 * Vercel Cron: Configured in vercel.json
 * Schedule: Every Sunday at 3:00 AM UTC
 * Security: Validates CRON_SECRET header
 */

import { NextRequest, NextResponse } from 'next/server';
import { runPriceUpdateBatch } from '@/lib/ebay/priceTracker';

// Allow longer execution time for batch processing
// Vercel Pro allows up to 300s, Hobby up to 60s
export const maxDuration = 300;

// Cron secret for security (set in Vercel environment variables)
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/update-card-prices
 * Called by Vercel Cron weekly
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret (Vercel sends this in Authorization header)
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.warn('[Price Cron] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Price Cron] Starting weekly price update job...');

    // Run the batch job for ALL graded cards across all users
    // Time budget ensures we stop gracefully before Vercel's 5-minute timeout
    // Unprocessed cards will be first in queue next week (oldest snapshots first)
    const result = await runPriceUpdateBatch({
      limit: 10000,
      batchSize: 5,
      delayBetweenBatches: 2000,
      cardTypes: ['sports', 'pokemon', 'mtg', 'lorcana', 'other'],
      maxDurationMs: 270000, // 4.5 minutes — safe margin under 5 min Vercel limit
    });

    const duration = Date.now() - startTime;
    console.log(`[Price Cron] Job completed in ${duration}ms`);
    console.log(`[Price Cron] Results: ${result.succeeded}/${result.total_cards} succeeded, ${result.failed} failed, ${result.skipped} skipped`);

    if (result.errors.length > 0) {
      console.warn('[Price Cron] Errors:', result.errors.slice(0, 10)); // Log first 10 errors
    }

    return NextResponse.json({
      success: true,
      message: `Price update completed: ${result.succeeded}/${result.total_cards} cards updated`,
      stats: {
        total_cards: result.total_cards,
        succeeded: result.succeeded,
        failed: result.failed,
        skipped: result.skipped,
        duration_ms: duration,
        errors_count: result.errors.length,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Price Cron] Job failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: duration,
      },
      { status: 500 }
    );
  }
}
