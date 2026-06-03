'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getStoredSession } from '@/lib/directAuth';
import MarketPricingGate from '@/components/market-pricing/MarketPricingGate';
import CategoryBreakdownChart from '@/components/market-pricing/CategoryBreakdownChart';
import TopCardsTable from '@/components/market-pricing/TopCardsTable';
import MoversTable from '@/components/market-pricing/MoversTable';
import GradeDistributionChart from '@/components/market-pricing/GradeDistributionChart';
import ValueDistributionChart from '@/components/market-pricing/ValueDistributionChart';
import ValueByGradeChart from '@/components/market-pricing/ValueByGradeChart';
import TopSetsChart from '@/components/market-pricing/TopSetsChart';
import PriceSourceChart from '@/components/market-pricing/PriceSourceChart';
import GradeVsValueChart from '@/components/market-pricing/GradeVsValueChart';


interface PortfolioData {
  totalValue: number;
  totalCards: number;
  cardsWithValue: number;
  categoryBreakdown: Array<{ category: string; count: number; value: number; percentage: number }>;
  topCards: Array<{
    id: string; name: string; category: string; grade: number; value: number;
    imageUrl: string | null; cardPath: string; cardSet?: string; cardNumber?: string;
  }>;
  movers: {
    gainers: Array<{ id: string; name: string; category: string; value: number; gradingValue: number; changePercent: number; cardPath: string }>;
    losers: Array<{ id: string; name: string; category: string; value: number; gradingValue: number; changePercent: number; cardPath: string }>;
    totalGradingValue: number;
    totalCurrentValue: number;
    cardsWithGradingPrice: number;
  };
  gradeDistribution: Array<{ grade: string; count: number }>;
  valueDistribution: Array<{ label: string; count: number }>;
  valueByGrade: Array<{ grade: string; totalValue: number; avgValue: number; count: number }>;
  topSets: Array<{ set: string; category: string; value: number; count: number }>;
  priceSourceBreakdown: Array<{ source: string; count: number }>;
  gradeVsValue: Array<{ grade: number; value: number; name: string; cardPath: string }>;

}

export default function MarketPricingPage() {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const stored = localStorage.getItem('dcm_refresh_data');
    if (!stored) return 0;
    try {
      const { count, date } = JSON.parse(stored);
      // Reset if it's a new day
      if (date !== new Date().toISOString().slice(0, 10)) return 0;
      return count || 0;
    } catch { return 0; }
  });
  const maxRefreshesPerDay = 2;
  const refreshLimitReached = refreshCount >= maxRefreshesPerDay;

  useEffect(() => {
    fetchPortfolio();
  }, []);

  // Re-fetch when category filter changes
  useEffect(() => {
    fetchPortfolio();
  }, [selectedCategory]);

  async function fetchPortfolio() {
    setLoading(true);
    setError(null);
    try {
      const session = getStoredSession();
      if (!session?.access_token) return;

      const params = new URLSearchParams();
      if (selectedCategory) params.set('category', selectedCategory);
      const qs = params.toString();

      const response = await fetch(`/api/market-pricing/portfolio${qs ? `?${qs}` : ''}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPortfolio(data);
      } else {
        setError('Failed to load portfolio data. Please try again.');
      }
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
      setError('Unable to connect. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshPrices() {
    if (refreshLimitReached) return;
    setRefreshing(true);
    try {
      const session = getStoredSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/market-pricing/refresh-prices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('Refresh failed:', data.error || res.statusText);
      }

      // Track refresh count (2 per day limit)
      const newCount = refreshCount + 1;
      setRefreshCount(newCount);
      localStorage.setItem('dcm_refresh_data', JSON.stringify({
        count: newCount,
        date: new Date().toISOString().slice(0, 10),
      }));

      // Re-fetch portfolio after refresh
      await fetchPortfolio();
    } catch (err) {
      console.error('Failed to refresh prices:', err);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <MarketPricingGate>
      <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <section className="bg-gradient-to-r from-purple-600 via-rose-500 to-orange-500 text-white">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-rose-200" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-rose-200">Card Lovers Exclusive</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">Market Pricing</h1>
            <p className="text-white/80 mt-1">Track your collection&apos;s market value in real time</p>
          </div>
        </section>

        {/* Value Summary */}
        <section className="max-w-7xl mx-auto px-4 -mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Value */}
            <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
              <div className="text-sm text-gray-500 mb-1">
                {selectedCategory ? `${selectedCategory} Value` : 'Total Portfolio Value'}
              </div>
              {loading ? (
                <div className="h-8 bg-gray-100 rounded animate-pulse w-32" />
              ) : (
                <div className="text-2xl md:text-3xl font-bold text-gray-900">
                  ${(portfolio?.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">Based on DCM estimates &amp; eBay data</div>
            </div>

            {/* Cards Priced */}
            <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
              <div className="text-sm text-gray-500 mb-1">Cards With Value Data</div>
              {loading ? (
                <div className="h-8 bg-gray-100 rounded animate-pulse w-24" />
              ) : (
                <div className="text-2xl md:text-3xl font-bold text-gray-900">
                  {portfolio?.cardsWithValue || 0}
                  <span className="text-lg text-gray-400 font-normal"> / {portfolio?.totalCards || 0}</span>
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">
                {portfolio && portfolio.totalCards > 0 && portfolio.cardsWithValue < portfolio.totalCards
                  ? `${portfolio.totalCards - portfolio.cardsWithValue} cards need pricing`
                  : 'All cards priced'}
              </div>
            </div>

            {/* Average Card Value */}
            <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
              <div className="text-sm text-gray-500 mb-1">Average Card Value</div>
              {loading ? (
                <div className="h-8 bg-gray-100 rounded animate-pulse w-24" />
              ) : (
                <div className="text-2xl md:text-3xl font-bold text-gray-900">
                  ${portfolio && portfolio.cardsWithValue > 0
                    ? (portfolio.totalValue / portfolio.cardsWithValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '0.00'}
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">Across {portfolio?.cardsWithValue || 0} priced cards</div>
            </div>
          </div>
        </section>

        {/* Category Filter Pills */}
        {portfolio && portfolio.categoryBreakdown.length > 1 && (
          <section className="max-w-7xl mx-auto px-4 mt-5">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <span className="text-xs text-gray-400 font-medium flex-shrink-0 mr-1">Filter:</span>
              {/* "All" pill */}
              <button
                onClick={() => setSelectedCategory(null)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === null
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All ({portfolio.categoryBreakdown.reduce((sum, c) => sum + c.count, 0)})
              </button>
              {/* Category pills derived from breakdown data */}
              {portfolio.categoryBreakdown.map(cat => (
                <button
                  key={cat.category}
                  onClick={() => setSelectedCategory(
                    selectedCategory === cat.category ? null : cat.category
                  )}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedCategory === cat.category
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat.category} ({cat.count})
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Content */}
        <section className="max-w-7xl mx-auto px-4 py-6">
          <div className="space-y-6">
              {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 h-80 animate-pulse" />
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 h-80 animate-pulse" />
                </div>
              ) : error ? (
                <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
                  <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-gray-600 mb-3">{error}</p>
                  <button
                    onClick={fetchPortfolio}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left column: Category + Grade + Value Distribution */}
                    <div className="space-y-6">
                      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Collection Value by Category</h3>
                        <CategoryBreakdownChart data={portfolio?.categoryBreakdown || []} />
                      </div>

                      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Grade Distribution</h3>
                        <GradeDistributionChart data={portfolio?.gradeDistribution || []} />
                      </div>

                      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Value Distribution</h3>
                        <ValueDistributionChart data={portfolio?.valueDistribution || []} />
                      </div>
                    </div>

                    {/* Right column: Most Valuable Cards */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Most Valuable Cards</h3>
                        <Link href="/collection" className="text-sm text-purple-600 hover:text-purple-700">
                          View All
                        </Link>
                      </div>
                      <TopCardsTable cards={portfolio?.topCards || []} />
                    </div>
                  </div>

                  {/* Row 3: Value by Grade (full width) */}
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Value by Grade</h3>
                    <p className="text-xs text-gray-400 mb-4">Total and average card value at each grade tier</p>
                    <ValueByGradeChart data={portfolio?.valueByGrade || []} />
                  </div>

                  {/* Row 4: Top Sets + Price Source */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Sets by Value</h3>
                      <TopSetsChart data={portfolio?.topSets || []} />
                    </div>

                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Data Sources</h3>
                      <PriceSourceChart data={portfolio?.priceSourceBreakdown || []} />
                    </div>
                  </div>

                  {/* Row 5: Grade vs Value Scatter (full width) */}
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Grade vs Value</h3>
                    <p className="text-xs text-gray-400 mb-4">Each dot is a card — see how grade correlates with market value</p>
                    <GradeVsValueChart data={portfolio?.gradeVsValue || []} />
                  </div>

                  {/* Movers */}
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Value Changes Since Grading</h3>
                    <p className="text-xs text-gray-400 mb-4">Comparing current market value to the price when each card was graded</p>
                    <MoversTable
                      gainers={portfolio?.movers.gainers || []}
                      losers={portfolio?.movers.losers || []}
                      totalGradingValue={portfolio?.movers.totalGradingValue || 0}
                      totalCurrentValue={portfolio?.movers.totalCurrentValue || 0}
                      cardsWithGradingPrice={portfolio?.movers.cardsWithGradingPrice || 0}
                      onRefresh={handleRefreshPrices}
                      refreshing={refreshing}
                      refreshLimitReached={refreshLimitReached}
                      refreshCount={refreshCount}
                      maxRefreshesPerDay={maxRefreshesPerDay}
                    />
                  </div>

                </>
              )}
          </div>

        </section>
      </main>
    </MarketPricingGate>
  );
}
