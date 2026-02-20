/**
 * PriceCharting API Route
 *
 * Fetches market pricing data from SportsCardsPro for sports cards.
 * Implements 7-day caching to reduce API calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  searchSportsCardPrices,
  estimateDcmValue,
  isPriceChartingEnabled,
  getAvailableParallels,
  getPricesForProductId,
  type SportsCardSearchParams,
  type NormalizedPrices,
} from '@/lib/priceCharting';
import { mapPricingErrorToHttpStatus } from '@/lib/pricingFetch';

// Cache duration: 7 days in milliseconds
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export interface AvailableParallel {
  id: string;
  name: string;
  setName: string;
  hasPrice: boolean;
}

export interface CachedPriceData {
  prices: NormalizedPrices;
  estimatedValue: number | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  queryUsed: string;
  availableParallels?: AvailableParallel[];
}

export interface PriceChartingResponse {
  success: boolean;
  data?: CachedPriceData;
  error?: string;
  cached?: boolean;  // Indicates if data came from cache
  cacheAge?: number; // Age of cache in days
}

/**
 * Check if cached pricing data is still fresh (less than 7 days old)
 */
function isCacheFresh(cachedAt: string | null): boolean {
  if (!cachedAt) return false;
  const cacheTime = new Date(cachedAt).getTime();
  const now = Date.now();
  return (now - cacheTime) < CACHE_DURATION_MS;
}

/**
 * Get cache age in days
 */
function getCacheAgeDays(cachedAt: string): number {
  const cacheTime = new Date(cachedAt).getTime();
  const now = Date.now();
  return Math.round((now - cacheTime) / (24 * 60 * 60 * 1000) * 10) / 10;
}

/**
 * Save pricing data to cache
 * Also saves dcm_price_estimate so collection page can display without re-fetching
 */
async function savePriceCache(cardId: string, data: CachedPriceData): Promise<void> {
  try {
    const supabase = supabaseServer();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('cards')
      .update({
        // Full cached data for detail page
        dcm_cached_prices: data,
        dcm_prices_cached_at: now,
        // Individual columns for collection page display
        dcm_price_estimate: data.estimatedValue,
        dcm_price_raw: data.prices?.raw ?? null,
        dcm_price_match_confidence: data.matchConfidence,
        dcm_price_product_name: data.prices?.productName ?? null,
        dcm_price_product_id: data.prices?.productId ?? null,
        dcm_price_updated_at: now,
      })
      .eq('id', cardId);

    if (error) {
      console.error('[PriceCharting Cache] Failed to save cache:', error);
    } else {
      console.log(`[PriceCharting Cache] Saved pricing cache for card ${cardId}`);
    }
  } catch (err) {
    console.error('[PriceCharting Cache] Error saving cache:', err);
  }
}

/**
 * Get cached pricing data if fresh
 */
async function getCachedPrices(cardId: string): Promise<{ data: CachedPriceData; cachedAt: string } | null> {
  try {
    const supabase = supabaseServer();
    const { data: card, error } = await supabase
      .from('cards')
      .select('dcm_cached_prices, dcm_prices_cached_at')
      .eq('id', cardId)
      .single();

    if (error || !card) {
      return null;
    }

    if (card.dcm_cached_prices && isCacheFresh(card.dcm_prices_cached_at)) {
      return {
        data: card.dcm_cached_prices as CachedPriceData,
        cachedAt: card.dcm_prices_cached_at,
      };
    }

    return null;
  } catch (err) {
    console.error('[PriceCharting Cache] Error reading cache:', err);
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<PriceChartingResponse>> {
  // Check if PriceCharting is enabled
  if (!isPriceChartingEnabled()) {
    return NextResponse.json(
      {
        success: false,
        error: 'PriceCharting API is not configured',
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();

    const {
      playerName,
      year,
      setName,
      cardNumber,
      variant,
      rookie,
      sport,
      serialNumbering,
      dcmGrade,
      selectedProductId,  // Optional: if user manually selected a parallel
      includeParallels,   // Optional: request available parallels list
      cardId,             // Optional: card ID for caching
      forceRefresh,       // Optional: bypass cache and fetch fresh data
    } = body as SportsCardSearchParams & {
      dcmGrade?: number;
      selectedProductId?: string;
      includeParallels?: boolean;
      cardId?: string;
      forceRefresh?: boolean;
    };

    // Check cache first (if cardId provided and not forcing refresh)
    if (cardId && !forceRefresh && !selectedProductId) {
      const cached = await getCachedPrices(cardId);
      if (cached) {
        console.log(`[PriceCharting Cache] Using cached data for card ${cardId} (${getCacheAgeDays(cached.cachedAt)} days old)`);

        // Recalculate DCM estimate with current grade (in case grade changed)
        let estimatedValue = cached.data.estimatedValue;
        if (dcmGrade && cached.data.prices) {
          estimatedValue = estimateDcmValue(cached.data.prices, dcmGrade);
        }

        return NextResponse.json({
          success: true,
          data: {
            ...cached.data,
            estimatedValue,
          },
          cached: true,
          cacheAge: getCacheAgeDays(cached.cachedAt),
        });
      }
    }

    // If user selected a specific product, fetch prices for that product
    if (selectedProductId) {
      console.log('[SportsCardsPro API] Fetching selected product:', selectedProductId);

      const prices = await getPricesForProductId(selectedProductId);
      if (!prices) {
        return NextResponse.json(
          {
            success: false,
            error: 'Could not fetch prices for selected product',
          },
          { status: 404 }
        );
      }

      // Calculate estimated value for DCM grade if provided
      let estimatedValue: number | null = null;
      if (dcmGrade && prices) {
        estimatedValue = estimateDcmValue(prices, dcmGrade);
      }

      const responseData: CachedPriceData = {
        prices,
        estimatedValue,
        matchConfidence: 'high' as const, // Manual selection is considered high confidence
        queryUsed: `Selected: ${prices.productName}`,
      };

      // Save to cache if cardId provided
      if (cardId) {
        await savePriceCache(cardId, responseData);
      }

      return NextResponse.json({
        success: true,
        data: responseData,
        cached: false,
      });
    }

    // Validate required fields
    if (!playerName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Player name is required',
        },
        { status: 400 }
      );
    }

    console.log('[SportsCardsPro API] Searching for:', {
      playerName,
      cardNumber,
      cardNumberType: typeof cardNumber,
      serialNumbering,
      sport,
      year,
      setName,
      forceRefresh: forceRefresh || false,
    });

    // Search for prices
    const result = await searchSportsCardPrices({
      playerName,
      year,
      setName,
      cardNumber,
      variant,
      rookie,
      sport,
      serialNumbering,
    });

    if (!result.prices) {
      return NextResponse.json(
        {
          success: false,
          error: 'No matching products found',
        },
        { status: 404 }
      );
    }

    // Calculate estimated value for DCM grade if provided
    let estimatedValue: number | null = null;
    if (dcmGrade && result.prices) {
      estimatedValue = estimateDcmValue(result.prices, dcmGrade);
    }

    // Optionally fetch available parallels
    let availableParallels: AvailableParallel[] | undefined;
    if (includeParallels) {
      availableParallels = await getAvailableParallels({
        playerName,
        year,
        setName,
        cardNumber,
        variant: undefined, // Don't filter by variant when getting all parallels
        rookie,
        sport,
        serialNumbering: undefined,
      });
    }

    const responseData: CachedPriceData = {
      prices: result.prices,
      estimatedValue,
      matchConfidence: result.matchConfidence,
      queryUsed: result.queryUsed,
      availableParallels,
    };

    // Save to cache if cardId provided
    if (cardId) {
      await savePriceCache(cardId, responseData);
    }

    return NextResponse.json({
      success: true,
      data: responseData,
      cached: false,
    });
  } catch (error) {
    console.error('[PriceCharting API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch prices',
      },
      { status: mapPricingErrorToHttpStatus(error) }
    );
  }
}

// GET endpoint for simple testing
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isPriceChartingEnabled()) {
    return NextResponse.json(
      {
        success: false,
        error: 'PriceCharting API is not configured',
      },
      { status: 503 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const playerName = searchParams.get('player');
  const year = searchParams.get('year');
  const setName = searchParams.get('set');

  if (!playerName) {
    return NextResponse.json(
      {
        success: false,
        error: 'Player name is required (use ?player=Name)',
      },
      { status: 400 }
    );
  }

  try {
    const result = await searchSportsCardPrices({
      playerName,
      year: year || undefined,
      setName: setName || undefined,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[PriceCharting API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch prices',
      },
      { status: mapPricingErrorToHttpStatus(error) }
    );
  }
}
