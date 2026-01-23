'use client';

import { useState, useEffect } from 'react';
import { PriceDistributionChart, PriceHistoryChart } from './charts';

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
  queryStrategy?: 'specific' | 'moderate' | 'broad' | 'minimal' | 'custom';
  total: number;
  items: EbayPriceResult[];
  lowestPrice?: number;
  highestPrice?: number;
  averagePrice?: number;
  medianPrice?: number;
  error?: string;
}

interface PriceHistoryDataPoint {
  recorded_at: string;
  lowest_price: number | null;
  median_price: number | null;
  highest_price: number | null;
  average_price: number | null;
  listing_count: number;
}

interface PriceHistoryData {
  success: boolean;
  has_history: boolean;
  history?: PriceHistoryDataPoint[];
  latest?: {
    recorded_at: string;
    median_price: number | null;
    listing_count: number;
    price_change: number | null;
    price_change_percent: number | null;
  };
  trend?: {
    current_median: number | null;
    oldest_median: number | null;
    overall_change: number | null;
    overall_change_percent: number | null;
    data_points: number;
  };
}

interface CachedPriceData {
  lowest_price: number | null;
  median_price: number | null;
  average_price: number | null;
  highest_price: number | null;
  listing_count: number | null;
  updated_at: string | null;
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
    serial_numbering?: string;
    rookie_card?: boolean;
    // Game type for specialized search strategies
    game_type?: 'pokemon' | 'mtg' | 'lorcana' | 'onepiece' | 'other';
    is_foil?: boolean;
    foil_type?: string;
    ink_color?: string;  // Lorcana-specific
    variant_type?: string;  // One Piece-specific (parallel, manga, sp, etc.)
  };
  cardId?: string;
  category?: 'sports' | 'ccg' | 'other';
}

export function EbayPriceLookup({ card, cardId, category = 'sports' }: EbayPriceLookupProps) {
  const [priceData, setPriceData] = useState<EbayPriceData | null>(null);
  const [cachedPrices, setCachedPrices] = useState<CachedPriceData | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showListings, setShowListings] = useState(false);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [selectedPriceRange, setSelectedPriceRange] = useState<'lowest' | 'median' | 'highest' | 'all'>('all');
  const [dataSource, setDataSource] = useState<'cache' | 'live' | null>(null);

  // Fetch price history if cardId is provided
  const fetchPriceHistory = async () => {
    if (!cardId) return;

    try {
      // Fetch full history for charts (up to 12 weeks)
      const response = await fetch(`/api/ebay/price-history?card_id=${cardId}&limit=12`);
      const data = await response.json();
      if (data.success) {
        setPriceHistory(data);
      }
    } catch (err) {
      // Silently fail - price history is optional
      console.error('[EbayPriceLookup] Error fetching price history:', err);
    }
  };

  // Get price confidence level based on listing count
  const getPriceConfidence = (count: number): { level: 'high' | 'medium' | 'low'; label: string; color: string } => {
    if (count >= 10) return { level: 'high', label: 'High confidence', color: 'text-green-600 bg-green-50' };
    if (count >= 5) return { level: 'medium', label: 'Medium confidence', color: 'text-yellow-600 bg-yellow-50' };
    return { level: 'low', label: 'Low confidence', color: 'text-red-600 bg-red-50' };
  };

  // Filter listings based on selected price range
  const getFilteredListings = () => {
    if (!priceData || selectedPriceRange === 'all') {
      return priceData?.items || [];
    }

    const prices = priceData.items.map(item => item.price);
    const lowest = priceData.lowestPrice || Math.min(...prices);
    const highest = priceData.highestPrice || Math.max(...prices);
    const priceRange = highest - lowest;
    const lowerThird = lowest + (priceRange / 3);
    const upperThird = lowest + (2 * priceRange / 3);

    return priceData.items.filter(item => {
      switch (selectedPriceRange) {
        case 'lowest':
          return item.price <= lowerThird;
        case 'median':
          return item.price > lowerThird && item.price <= upperThird;
        case 'highest':
          return item.price > upperThird;
        default:
          return true;
      }
    });
  };

  // Handle price range selection - auto-show listings when filtering
  const handlePriceRangeSelect = (range: 'lowest' | 'median' | 'highest' | 'all') => {
    setSelectedPriceRange(range);
    if (range !== 'all') {
      setShowListings(true);
    }
  };

  // Fetch cached prices first (auto-refreshes if stale > 7 days)
  const fetchCachedPrices = async (forceRefresh: boolean = false) => {
    if (!cardId) {
      // No cardId means we can't use cache, fall back to live
      await fetchLivePrices();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = `/api/ebay/cached-price?card_id=${cardId}${forceRefresh ? '&refresh=true' : ''}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch cached prices');
      }

      if (data.data) {
        setCachedPrices(data.data);
        setDataSource(data.source === 'fresh' ? 'live' : 'cache');

        // Also update priceData for chart compatibility (without items for cached data)
        setPriceData({
          success: true,
          query: '',
          total: data.data.listing_count || 0,
          items: [], // Cached data doesn't include individual listings
          lowestPrice: data.data.lowest_price,
          highestPrice: data.data.highest_price,
          averagePrice: data.data.average_price,
          medianPrice: data.data.median_price,
        });
      } else {
        // No cached data available, fetch live
        await fetchLivePrices();
      }
    } catch (err) {
      console.error('[EbayPriceLookup] Cache fetch error:', err);
      // Fall back to live fetch on cache error
      await fetchLivePrices();
    } finally {
      setLoading(false);
    }
  };

  // Fetch live prices from eBay (used for refresh and when no cache available)
  const fetchLivePrices = async () => {
    setLoading(true);
    setError(null);

    // Debug: Log what card data is being sent
    console.log('[EbayPriceLookup] Sending card data:', {
      card_name: card.card_name,
      featured: card.featured,
      card_number: card.card_number,
      card_set: card.card_set,
      subset: card.subset,
      game_type: card.game_type,
      variant_type: card.variant_type,
      is_foil: card.is_foil,
    });

    try {
      const response = await fetch('/api/ebay/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card: {
            ...card,
            serial_numbering: card.serial_numbering,
            rookie_card: card.rookie_card,
          },
          category,
          limit: 25,
          useFallback: true,
          minResults: 3,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch prices');
      }

      setPriceData(data);
      setDataSource('live');

      // Update cached prices state for consistency
      setCachedPrices({
        lowest_price: data.lowestPrice,
        median_price: data.medianPrice,
        average_price: data.averagePrice,
        highest_price: data.highestPrice,
        listing_count: data.total,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[EbayPriceLookup] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
    } finally {
      setLoading(false);
    }
  };

  // Refresh handler - always fetches live data with listings
  const handleRefresh = async () => {
    // Always use live fetch for refresh - this gets actual listings for charts
    await fetchLivePrices();

    // Also update the cache in background (if we have a cardId)
    if (cardId) {
      fetch(`/api/ebay/cached-price?card_id=${cardId}&refresh=true`)
        .catch(err => console.error('[EbayPriceLookup] Cache update error:', err));
    }
  };

  // Auto-fetch on mount - use cached prices first, then fetch live for full experience
  useEffect(() => {
    if (card.featured || card.card_name) {
      fetchCachedPrices();
      fetchPriceHistory();
    }
  }, [card.featured, card.card_name, card.card_set, cardId]);

  // Auto-fetch live data when we have cached prices but no listings (for charts)
  useEffect(() => {
    // Only auto-fetch if:
    // 1. We have cached price data (priceData exists)
    // 2. But no individual listings (items is empty)
    // 3. And we haven't already loaded live data
    // 4. And we're not currently loading
    if (priceData && priceData.items.length === 0 && priceData.total > 0 && dataSource === 'cache' && !loading) {
      // Delay slightly to avoid UI flash
      const timer = setTimeout(() => {
        fetchLivePrices();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [priceData, dataSource, loading]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  // Format relative time for "last updated"
  const formatLastUpdated = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 p-4 sm:p-6 shadow-lg">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-gray-800">Live Market Prices</h3>
            <p className="text-xs sm:text-sm text-gray-500">
              {cachedPrices?.updated_at ? (
                <>Updated {formatLastUpdated(cachedPrices.updated_at)}</>
              ) : (
                'Current active listings'
              )}
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
            <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm overflow-hidden">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Lowest</p>
              <p className="text-base sm:text-xl font-bold text-green-600 truncate">
                {priceData.lowestPrice ? formatPrice(priceData.lowestPrice) : 'N/A'}
              </p>
            </div>
            <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border-2 border-blue-200 overflow-hidden">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Median</p>
              <p className="text-base sm:text-xl font-bold text-blue-600 truncate">
                {priceData.medianPrice ? formatPrice(priceData.medianPrice) : 'N/A'}
              </p>
            </div>
            <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm overflow-hidden">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Average</p>
              <p className="text-base sm:text-xl font-bold text-indigo-600 truncate">
                {priceData.averagePrice ? formatPrice(priceData.averagePrice) : 'N/A'}
              </p>
            </div>
            <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm overflow-hidden">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Highest</p>
              <p className="text-base sm:text-xl font-bold text-purple-600 truncate">
                {priceData.highestPrice ? formatPrice(priceData.highestPrice) : 'N/A'}
              </p>
            </div>
          </div>

          {/* Price Confidence Indicator - Use items count if available, otherwise total from cache */}
          {(priceData.items.length > 0 || priceData.total > 0) && (
            <div className="mb-4">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getPriceConfidence(priceData.items.length || priceData.total).color}`}>
                <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  {getPriceConfidence(priceData.items.length || priceData.total).level === 'high' ? (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  ) : getPriceConfidence(priceData.items.length || priceData.total).level === 'medium' ? (
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  )}
                </svg>
                <span className="whitespace-nowrap">{getPriceConfidence(priceData.items.length || priceData.total).label}</span>
              </div>
            </div>
          )}

          {/* Price Distribution Chart - Shows when we have individual listings */}
          {priceData.items.length > 0 ? (
            <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm mb-4">
              <PriceDistributionChart
                prices={priceData.items.map(item => item.price)}
                lowestPrice={priceData.lowestPrice}
                medianPrice={priceData.medianPrice}
                highestPrice={priceData.highestPrice}
                listingCount={priceData.items.length}
                height={140}
                onPriceRangeSelect={handlePriceRangeSelect}
                selectedRange={selectedPriceRange}
              />
            </div>
          ) : priceData.total > 0 && dataSource === 'cache' && (
            <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm mb-4 text-center">
              <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Click <strong>Refresh</strong> to load price distribution chart</span>
              </div>
            </div>
          )}

          {/* Price History Toggle & Chart - Shows when we have price data (regardless of items) */}
          {(priceData.items.length > 0 || priceData.total > 0) && (
            <div className="mb-4">
              <button
                onClick={() => setShowPriceHistory(!showPriceHistory)}
                className="w-full flex items-center justify-between px-3 py-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors border border-gray-100"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Price History</span>
                  {priceHistory?.has_history && priceHistory.history && priceHistory.history.length > 0 && (
                    <span className="text-xs text-gray-400">({priceHistory.history.length} weeks)</span>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${showPriceHistory ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showPriceHistory && (
                <div className="mt-2 bg-white rounded-lg p-3 sm:p-4 shadow-sm">
                  {priceHistory?.has_history && priceHistory.history && priceHistory.history.length > 0 ? (
                    <PriceHistoryChart
                      data={priceHistory.history}
                      height={160}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-28 sm:h-32 text-gray-400 text-sm">
                      <div className="text-center px-4">
                        <svg className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs sm:text-sm">Historical data will appear after weekly tracking begins</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Listings Count & Toggle */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">
              {selectedPriceRange !== 'all' && priceData.items.length > 0 ? (
                <>
                  <span className="font-semibold text-gray-800">{getFilteredListings().length}</span> of {priceData.total.toLocaleString()} listings
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedPriceRange === 'lowest' ? 'bg-green-100 text-green-700' :
                    selectedPriceRange === 'median' ? 'bg-blue-100 text-blue-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {selectedPriceRange === 'lowest' ? 'Low Price' :
                     selectedPriceRange === 'median' ? 'Mid Price' : 'High Price'}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-gray-800">{priceData.total.toLocaleString()}</span> active listings found
                </>
              )}
            </p>
            {priceData.items.length > 0 ? (
              <button
                onClick={() => setShowListings(!showListings)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {showListings ? 'Hide Listings' : 'Show Listings'}
              </button>
            ) : priceData.total > 0 && dataSource === 'cache' && (
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Load Listings
              </button>
            )}
          </div>

          {/* Search Query & Strategy - Only show for live data with actual query */}
          {priceData.query ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-3 flex-wrap">
              <span>Search: "{priceData.query}"</span>
              {priceData.queryStrategy && priceData.queryStrategy !== 'custom' && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  priceData.queryStrategy === 'specific' ? 'bg-green-100 text-green-700' :
                  priceData.queryStrategy === 'moderate' ? 'bg-blue-100 text-blue-700' :
                  priceData.queryStrategy === 'broad' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {priceData.queryStrategy}
                </span>
              )}
            </div>
          ) : dataSource === 'cache' && (
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <span>Using cached prices • Click Refresh for live data</span>
            </div>
          )}

          {/* Individual Listings */}
          {showListings && (
            <>
              {getFilteredListings().length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {getFilteredListings().map((item) => (
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
              ) : selectedPriceRange !== 'all' && priceData.items.length > 0 ? (
                <div className="text-center py-4 bg-white rounded-lg">
                  <p className="text-gray-500 text-sm">No listings in this price range.</p>
                  <button
                    onClick={() => setSelectedPriceRange('all')}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium mt-2"
                  >
                    Show all listings
                  </button>
                </div>
              ) : null}
            </>
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
