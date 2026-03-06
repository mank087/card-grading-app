/**
 * PriceCharting Search API Route
 *
 * Exposes raw product search from SportsCardsPro so users can manually
 * search for their card when automatic matching fails.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  searchProducts,
  isPriceChartingEnabled,
  type PriceChartingProduct,
} from '@/lib/priceCharting';
import { mapPricingErrorToHttpStatus } from '@/lib/pricingFetch';

export interface SearchResult {
  id: string;
  name: string;
  setName: string;
  hasPrice: boolean;
}

export interface PriceChartingSearchResponse {
  success: boolean;
  results?: SearchResult[];
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<PriceChartingSearchResponse>> {
  if (!isPriceChartingEnabled()) {
    return NextResponse.json(
      { success: false, error: 'PriceCharting API is not configured' },
      { status: 503 }
    );
  }

  const query = request.nextUrl.searchParams.get('q');
  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { success: false, error: 'Search query must be at least 2 characters' },
      { status: 400 }
    );
  }

  try {
    const products = await searchProducts(query.trim(), { limit: 25 });

    const results: SearchResult[] = products.map((p: PriceChartingProduct) => ({
      id: p.id,
      name: p['product-name'],
      setName: p['console-name'] || '',
      hasPrice: !!(
        p['loose-price'] ||
        p['cib-price'] ||
        p['new-price'] ||
        p['graded-price'] ||
        p['manual-only-price']
      ),
    }));

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('[PriceCharting Search] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      },
      { status: mapPricingErrorToHttpStatus(error) }
    );
  }
}
