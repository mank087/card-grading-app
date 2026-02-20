/**
 * One Piece Card Pricing API Route
 *
 * Fetches market pricing data from PriceCharting for One Piece TCG cards.
 * Implements 7-day caching to reduce API calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  searchOnePieceCardPrices,
  estimateOnePieceDcmValue,
  isOnePiecePricingEnabled,
  getAvailableOnePieceVariants,
  getOnePiecePricesForProductId,
  type OnePieceCardSearchParams,
  type NormalizedOnePiecePrices,
} from '@/lib/onepiecePricing';
import { mapPricingErrorToHttpStatus } from '@/lib/pricingFetch';

// Cache duration: 7 days in milliseconds
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export interface AvailableVariant {
  id: string;
  name: string;
  setName: string;
  hasPrice: boolean;
}

export interface CachedOnePiecePriceData {
  prices: NormalizedOnePiecePrices;
  estimatedValue: number | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  queryUsed: string;
  availableVariants?: AvailableVariant[];
}

export interface OnePiecePricingResponse {
  success: boolean;
  data?: CachedOnePiecePriceData;
  error?: string;
  cached?: boolean;
  cacheAge?: number;
}

/**
 * Check if cached pricing data is still fresh
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
 * Saves to both dcm_cached_prices (full data) and dcm_price_* columns (for collection page display)
 */
async function savePriceCache(cardId: string, data: CachedOnePiecePriceData): Promise<void> {
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
        dcm_price_updated_at: now,
        dcm_price_match_confidence: data.matchConfidence,
        dcm_price_product_id: data.prices?.productId ?? null,
        dcm_price_product_name: data.prices?.productName ?? null,
      })
      .eq('id', cardId);

    if (error) {
      console.error('[OnePiecePricing Cache] Failed to save cache:', error);
    } else {
      console.log(`[OnePiecePricing Cache] Saved pricing cache for card ${cardId}`);
    }
  } catch (err) {
    console.error('[OnePiecePricing Cache] Error saving cache:', err);
  }
}

/**
 * Get cached pricing data if fresh
 */
async function getCachedPrices(cardId: string): Promise<{ data: CachedOnePiecePriceData; cachedAt: string } | null> {
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
        data: card.dcm_cached_prices as CachedOnePiecePriceData,
        cachedAt: card.dcm_prices_cached_at,
      };
    }

    return null;
  } catch (err) {
    console.error('[OnePiecePricing Cache] Error reading cache:', err);
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<OnePiecePricingResponse>> {
  // Check if pricing is enabled
  if (!isOnePiecePricingEnabled()) {
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
      cardName,
      setName,
      collectorNumber,
      year,
      variant,
      dcmGrade,
      selectedProductId,
      includeVariants,
      cardId,
      forceRefresh,
    } = body as OnePieceCardSearchParams & {
      dcmGrade?: number;
      selectedProductId?: string;
      includeVariants?: boolean;
      cardId?: string;
      forceRefresh?: boolean;
    };

    // Check cache first (if cardId provided and not forcing refresh)
    if (cardId && !forceRefresh && !selectedProductId) {
      const cached = await getCachedPrices(cardId);
      if (cached) {
        console.log(`[OnePiecePricing Cache] Using cached data for card ${cardId} (${getCacheAgeDays(cached.cachedAt)} days old)`);

        // Recalculate DCM estimate with current grade
        let estimatedValue = cached.data.estimatedValue;
        if (dcmGrade && cached.data.prices) {
          estimatedValue = estimateOnePieceDcmValue(cached.data.prices, dcmGrade);
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
      console.log('[OnePiecePricing API] Fetching selected product:', selectedProductId);

      const prices = await getOnePiecePricesForProductId(selectedProductId);
      if (!prices) {
        return NextResponse.json(
          {
            success: false,
            error: 'Could not fetch prices for selected product',
          },
          { status: 404 }
        );
      }

      let estimatedValue: number | null = null;
      if (dcmGrade && prices) {
        estimatedValue = estimateOnePieceDcmValue(prices, dcmGrade);
      }

      const responseData: CachedOnePiecePriceData = {
        prices,
        estimatedValue,
        matchConfidence: 'high',
        queryUsed: `Selected: ${prices.productName}`,
      };

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
    if (!cardName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Card name is required',
        },
        { status: 400 }
      );
    }

    console.log('[OnePiecePricing API] Searching for:', {
      cardName,
      setName,
      collectorNumber,
      variant,
      year,
      forceRefresh: forceRefresh || false,
    });

    // Search for prices
    const result = await searchOnePieceCardPrices({
      cardName,
      setName,
      collectorNumber,
      year,
      variant,
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

    // Calculate estimated value for DCM grade
    let estimatedValue: number | null = null;
    if (dcmGrade && result.prices) {
      estimatedValue = estimateOnePieceDcmValue(result.prices, dcmGrade);
    }

    // Optionally fetch available variants
    let availableVariants: AvailableVariant[] | undefined;
    if (includeVariants) {
      availableVariants = await getAvailableOnePieceVariants({
        cardName,
        setName,
        collectorNumber,
        year,
      });
    }

    const responseData: CachedOnePiecePriceData = {
      prices: result.prices,
      estimatedValue,
      matchConfidence: result.matchConfidence,
      queryUsed: result.queryUsed,
      availableVariants,
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
    console.error('[OnePiecePricing API] Error:', error);
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
  if (!isOnePiecePricingEnabled()) {
    return NextResponse.json(
      {
        success: false,
        error: 'PriceCharting API is not configured',
      },
      { status: 503 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const cardName = searchParams.get('card');
  const setName = searchParams.get('set');
  const collectorNumber = searchParams.get('number');
  const variant = searchParams.get('variant');

  if (!cardName) {
    return NextResponse.json(
      {
        success: false,
        error: 'Card name is required (use ?card=Name)',
      },
      { status: 400 }
    );
  }

  try {
    const result = await searchOnePieceCardPrices({
      cardName,
      setName: setName || undefined,
      collectorNumber: collectorNumber || undefined,
      variant: variant || undefined,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[OnePiecePricing API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch prices',
      },
      { status: mapPricingErrorToHttpStatus(error) }
    );
  }
}
