'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getStoredSession } from '@/lib/directAuth';
import MarketPricingGate from '@/components/market-pricing/MarketPricingGate';
import CategoryBreakdownChart from '@/components/market-pricing/CategoryBreakdownChart';
import TopCardsTable from '@/components/market-pricing/TopCardsTable';
import MoversTable from '@/components/market-pricing/MoversTable';
import MyEbayListings from '@/components/market-pricing/MyEbayListings';

type TabId = 'overview' | 'listings' | 'insights';

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
    gainers: Array<{ id: string; name: string; category: string; value: number; changePercent: number; cardPath: string }>;
    losers: Array<{ id: string; name: string; category: string; value: number; changePercent: number; cardPath: string }>;
  };
}

export default function MarketPricingPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [ebayConnected, setEbayConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPortfolio();
    checkEbayStatus();
  }, []);

  async function fetchPortfolio() {
    setLoading(true);
    setError(null);
    try {
      const session = getStoredSession();
      if (!session?.access_token) return;

      const response = await fetch('/api/market-pricing/portfolio', {
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

  async function fetchListings() {
    setListingsLoading(true);
    try {
      const session = getStoredSession();
      if (!session?.access_token) return;

      const response = await fetch('/api/market-pricing/listings', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setListings(data.listings || []);
      }
    } catch (err) {
      console.error('Failed to fetch listings:', err);
    } finally {
      setListingsLoading(false);
    }
  }

  async function checkEbayStatus() {
    try {
      const session = getStoredSession();
      if (!session?.access_token) return;

      const response = await fetch('/api/ebay/status', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setEbayConnected(data.connected === true);
      }
    } catch {
      // Ignore — default false
    }
  }

  async function handleRefreshPrices() {
    setRefreshing(true);
    try {
      const session = getStoredSession();
      if (!session?.access_token) return;

      await fetch('/api/ebay/batch-refresh-prices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force: false }),
      });

      // Re-fetch portfolio after refresh
      await fetchPortfolio();
    } catch (err) {
      console.error('Failed to refresh prices:', err);
    } finally {
      setRefreshing(false);
    }
  }

  // Lazy-load listings when tab is first activated
  useEffect(() => {
    if (activeTab === 'listings' && listings.length === 0 && !listingsLoading) {
      fetchListings();
    }
  }, [activeTab]);

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    {
      id: 'overview',
      label: 'Overview',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: 'listings',
      label: 'My eBay Listings',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
      ),
    },
    {
      id: 'insights',
      label: 'Market Insights',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
  ];

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
            <p className="text-white/80 mt-1">Track your collection&apos;s market value and manage listings</p>
          </div>
        </section>

        {/* Value Summary */}
        <section className="max-w-7xl mx-auto px-4 -mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Value */}
            <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
              <div className="text-sm text-gray-500 mb-1">Total Portfolio Value</div>
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

            {/* Refresh */}
            <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100 flex flex-col justify-center items-center">
              <button
                onClick={handleRefreshPrices}
                disabled={refreshing}
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                {refreshing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Prices
                  </>
                )}
              </button>
              <p className="text-xs text-gray-400 mt-2">Updates stale prices via PriceCharting &amp; eBay</p>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <section className="max-w-7xl mx-auto px-4 mt-6">
          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* Tab Content */}
        <section className="max-w-7xl mx-auto px-4 py-6">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
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
                    {/* Category Breakdown */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Collection Value by Category</h3>
                      <CategoryBreakdownChart data={portfolio?.categoryBreakdown || []} />
                    </div>

                    {/* Top 10 Cards */}
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

                  {/* Movers */}
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Movers</h3>
                    <MoversTable
                      gainers={portfolio?.movers.gainers || []}
                      losers={portfolio?.movers.losers || []}
                    />
                  </div>

                  {/* Pricing footnote */}
                  <p className="text-xs text-gray-400 text-center">
                    Prices are updated weekly every Sunday. Trend data and price changes will populate automatically as more snapshots are collected.
                  </p>
                </>
              )}
            </div>
          )}

          {/* LISTINGS TAB */}
          {activeTab === 'listings' && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">My eBay Listings</h3>
                {ebayConnected && (
                  <Link
                    href="/collection"
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    List a Card from Collection
                  </Link>
                )}
              </div>
              {listingsLoading ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin" />
                </div>
              ) : (
                <MyEbayListings listings={listings} ebayConnected={ebayConnected} />
              )}
            </div>
          )}

          {/* INSIGHTS TAB */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              {/* Category performance */}
              {portfolio && portfolio.categoryBreakdown.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Breakdown</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {portfolio.categoryBreakdown.map((cat) => (
                      <div key={cat.category} className="bg-gray-50 rounded-lg p-4">
                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                          {cat.category}
                        </div>
                        <div className="text-lg font-bold text-gray-900">
                          ${cat.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-400">{cat.count} cards</span>
                          <span className="text-xs font-medium text-gray-500">{cat.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pricing coverage */}
              {portfolio && (
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Coverage</h3>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-rose-500 rounded-full transition-all"
                        style={{ width: `${portfolio.totalCards > 0 ? (portfolio.cardsWithValue / portfolio.totalCards) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {portfolio.totalCards > 0 ? Math.round((portfolio.cardsWithValue / portfolio.totalCards) * 100) : 0}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {portfolio.cardsWithValue} of {portfolio.totalCards} cards have market value data.
                    {portfolio.cardsWithValue < portfolio.totalCards && (
                      <> Visit card detail pages or use <button onClick={handleRefreshPrices} className="text-purple-600 hover:text-purple-700 font-medium">Refresh Prices</button> to update missing values.</>
                    )}
                  </p>
                </div>
              )}

              {/* Price Alerts — Coming Soon */}
              <div className="bg-gradient-to-br from-purple-50 to-rose-50 rounded-xl p-6 border border-purple-100">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Price Alerts — Coming Soon</h4>
                    <p className="text-sm text-gray-600">
                      Set alerts for your cards and get notified when values cross your target thresholds. Stay ahead of the market without checking every day.
                    </p>
                  </div>
                </div>
              </div>

              {/* Historical Tracking — Coming Soon */}
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Portfolio History Charts — Coming Soon</h4>
                    <p className="text-sm text-gray-600">
                      Track your total portfolio value over time with interactive charts. See how your collection&apos;s worth has changed week-by-week.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </MarketPricingGate>
  );
}
