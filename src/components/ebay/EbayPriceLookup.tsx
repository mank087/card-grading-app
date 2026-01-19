'use client';

import { useState, useEffect } from 'react';

interface EbayPriceResult {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  condition: string;
  itemWebUrl: string;
  imageUrl?: string;
  seller?: {
    username: string;
    feedbackScore: number;
    feedbackPercentage: string;
  };
  shippingCost?: number;
  buyingOptions: string[];
}

interface EbayPriceData {
  success: boolean;
  query: string;
  total: number;
  items: EbayPriceResult[];
  lowestPrice?: number;
  highestPrice?: number;
  averagePrice?: number;
  error?: string;
}

interface EbayPriceLookupProps {
  card: {
    card_name?: string;
    featured?: string;
    card_set?: string;
    card_number?: string;
    release_date?: string;
    category?: string;
    subset?: string;
    rarity_or_variant?: string;
    manufacturer?: string;
  };
  category?: 'sports' | 'ccg' | 'other';
}

export function EbayPriceLookup({ card, category = 'sports' }: EbayPriceLookupProps) {
  const [priceData, setPriceData] = useState<EbayPriceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showListings, setShowListings] = useState(false);

  const fetchPrices = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ebay/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card, category, limit: 10 }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch prices');
      }

      setPriceData(data);
    } catch (err) {
      console.error('[EbayPriceLookup] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount
  useEffect(() => {
    if (card.featured || card.card_name) {
      fetchPrices();
    }
  }, [card.featured, card.card_name, card.card_set]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">eBay Live Prices</h3>
            <p className="text-sm text-gray-500">Current active listings</p>
          </div>
        </div>
        <button
          onClick={fetchPrices}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading && !priceData && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Searching eBay...</span>
        </div>
      )}

      {priceData && (
        <>
          {/* Price Summary */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Lowest</p>
              <p className="text-2xl font-bold text-green-600">
                {priceData.lowestPrice ? formatPrice(priceData.lowestPrice) : 'N/A'}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Average</p>
              <p className="text-2xl font-bold text-blue-600">
                {priceData.averagePrice ? formatPrice(priceData.averagePrice) : 'N/A'}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Highest</p>
              <p className="text-2xl font-bold text-purple-600">
                {priceData.highestPrice ? formatPrice(priceData.highestPrice) : 'N/A'}
              </p>
            </div>
          </div>

          {/* Listings Count & Toggle */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-800">{priceData.total.toLocaleString()}</span> active listings found
            </p>
            {priceData.items.length > 0 && (
              <button
                onClick={() => setShowListings(!showListings)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {showListings ? 'Hide Listings' : 'Show Listings'}
              </button>
            )}
          </div>

          {/* Search Query Used */}
          <p className="text-xs text-gray-400 mb-3">
            Search: "{priceData.query}"
          </p>

          {/* Individual Listings */}
          {showListings && priceData.items.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {priceData.items.map((item) => (
                <a
                  key={item.itemId}
                  href={item.itemWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-white rounded-lg p-3 hover:bg-gray-50 transition-colors border border-gray-100"
                >
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.condition} • {item.seller?.username || 'Unknown seller'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      {formatPrice(item.price)}
                    </p>
                    {item.shippingCost !== undefined && (
                      <p className="text-xs text-gray-500">
                        +{formatPrice(item.shippingCost)} shipping
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}

          {priceData.total === 0 && (
            <div className="text-center py-4">
              <p className="text-gray-500">No active listings found for this card.</p>
              <p className="text-sm text-gray-400 mt-1">Try the eBay search links below for manual search.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
