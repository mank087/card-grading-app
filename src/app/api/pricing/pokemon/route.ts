/**
 * Pokemon Card Pricing API Route
 *
 * Fetches market pricing data from PriceCharting for Pokemon cards.
 * Implements 7-day caching to reduce API calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  searchPokemonCardPrices,
  estimatePokemonDcmValue,
  isPokemonPricingEnabled,
  getAvailablePokemonVariants,
  getPokemonPricesForProductId,
  type PokemonCardSearchParams,
  type NormalizedPokemonPrices,
} from '@/lib/pokemonPricing';

// Cache duration: 7 days in milliseconds
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export interface AvailableVariant {
  id: string;
  name: string;
  setName: string;
  hasPrice: boolean;
}

export interface CachedPokemonPriceData {
  prices: NormalizedPokemonPrices;
  estimatedValue: number | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  queryUsed: string;
  availableVariants?: AvailableVariant[];
}

export interface PokemonPricingResponse {
  success: boolean;
  data?: CachedPokemonPriceData;
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
async function savePriceCache(cardId: string, data: CachedPokemonPriceData): Promise<void> {
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
      console.error('[PokemonPricing Cache] Failed to save cache:', error);
    } else {
      console.log(`[PokemonPricing Cache] Saved pricing cache for card ${cardId}`);
    }
  } catch (err) {
    console.error('[PokemonPricing Cache] Error saving cache:', err);
  }
}

/**
 * Get cached pricing data if fresh
 */
async function getCachedPrices(cardId: string): Promise<{ data: CachedPokemonPriceData; cachedAt: string } | null> {
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
        data: card.dcm_cached_prices as CachedPokemonPriceData,
        cachedAt: card.dcm_prices_cached_at,
      };
    }

    return null;
  } catch (err) {
    console.error('[PokemonPricing Cache] Error reading cache:', err);
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<PokemonPricingResponse>> {
  // Check if pricing is enabled
  if (!isPokemonPricingEnabled()) {
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
      pokemonName,
      setName,
      cardNumber,
      year,
      variant,
      isHolo,
      isFirstEdition,
      isReverseHolo,
      dcmGrade,
      selectedProductId,
      includeVariants,
      cardId,
      forceRefresh,
    } = body as PokemonCardSearchParams & {
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
        console.log(`[PokemonPricing Cache] Using cached data for card ${cardId} (${getCacheAgeDays(cached.cachedAt)} days old)`);

        // Recalculate DCM estimate with current grade
        let estimatedValue = cached.data.estimatedValue;
        if (dcmGrade && cached.data.prices) {
          estimatedValue = estimatePokemonDcmValue(cached.data.prices, dcmGrade);
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
      console.log('[PokemonPricing API] Fetching selected product:', selectedProductId);

      const prices = await getPokemonPricesForProductId(selectedProductId);
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
        estimatedValue = estimatePokemonDcmValue(prices, dcmGrade);
      }

      const responseData: CachedPokemonPriceData = {
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
    if (!pokemonName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pokemon name is required',
        },
        { status: 400 }
      );
    }

    console.log('[PokemonPricing API] Searching for:', {
      pokemonName,
      setName,
      cardNumber,
      variant,
      year,
      forceRefresh: forceRefresh || false,
    });

    // Search for prices
    const result = await searchPokemonCardPrices({
      pokemonName,
      setName,
      cardNumber,
      year,
      variant,
      isHolo,
      isFirstEdition,
      isReverseHolo,
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
      estimatedValue = estimatePokemonDcmValue(result.prices, dcmGrade);
    }

    // Optionally fetch available variants
    let availableVariants: AvailableVariant[] | undefined;
    if (includeVariants) {
      availableVariants = await getAvailablePokemonVariants({
        pokemonName,
        setName,
        cardNumber,
        year,
      });
    }

    const responseData: CachedPokemonPriceData = {
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
    console.error('[PokemonPricing API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch prices',
      },
      { status: 500 }
    );
  }
}

// GET endpoint for simple testing
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isPokemonPricingEnabled()) {
    return NextResponse.json(
      {
        success: false,
        error: 'PriceCharting API is not configured',
      },
      { status: 503 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const pokemonName = searchParams.get('pokemon');
  const setName = searchParams.get('set');
  const cardNumber = searchParams.get('number');

  if (!pokemonName) {
    return NextResponse.json(
      {
        success: false,
        error: 'Pokemon name is required (use ?pokemon=Name)',
      },
      { status: 400 }
    );
  }

  try {
    const result = await searchPokemonCardPrices({
      pokemonName,
      setName: setName || undefined,
      cardNumber: cardNumber || undefined,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[PokemonPricing API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch prices',
      },
      { status: 500 }
    );
  }
}
