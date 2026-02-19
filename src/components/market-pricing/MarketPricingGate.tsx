'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getStoredSession } from '@/lib/directAuth';
import CategoryBreakdownChart from '@/components/market-pricing/CategoryBreakdownChart';
import GradeDistributionChart from '@/components/market-pricing/GradeDistributionChart';
import ValueDistributionChart from '@/components/market-pricing/ValueDistributionChart';
import TopSetsChart from '@/components/market-pricing/TopSetsChart';
import PriceSourceChart from '@/components/market-pricing/PriceSourceChart';

interface MarketPricingGateProps {
  children: React.ReactNode;
}

// Static mock data — never from the API, purely decorative
const MOCK_CATEGORIES = [
  { category: 'Pokemon', count: 42, value: 3840.50, percentage: 38.2 },
  { category: 'Sports', count: 28, value: 2950.00, percentage: 29.3 },
  { category: 'MTG', count: 18, value: 1620.75, percentage: 16.1 },
  { category: 'Lorcana', count: 12, value: 980.25, percentage: 9.7 },
  { category: 'One Piece', count: 8, value: 670.00, percentage: 6.7 },
];

const MOCK_GRADES = [
  { grade: '10', count: 8 },
  { grade: '9.5', count: 14 },
  { grade: '9', count: 22 },
  { grade: '8.5', count: 18 },
  { grade: '8', count: 15 },
  { grade: '7.5', count: 10 },
  { grade: '7', count: 8 },
  { grade: '6', count: 5 },
];

const MOCK_VALUES = [
  { label: '$0-10', count: 18, min: 0.01, max: 10 },
  { label: '$10-25', count: 24, min: 10, max: 25 },
  { label: '$25-50', count: 20, min: 25, max: 50 },
  { label: '$50-100', count: 16, min: 50, max: 100 },
  { label: '$100-250', count: 12, min: 100, max: 250 },
  { label: '$250-500', count: 6, min: 250, max: 500 },
  { label: '$500+', count: 4, min: 500, max: 999999 },
];

const MOCK_SETS = [
  { set: 'Prismatic Evolutions', category: 'Pokemon', value: 1240.00, count: 8 },
  { set: 'Gold Standard Football', category: 'Sports', value: 980.00, count: 5 },
  { set: 'Modern Horizons 3', category: 'MTG', value: 720.50, count: 6 },
  { set: 'The First Chapter', category: 'Lorcana', value: 540.25, count: 4 },
  { set: 'Topps Chrome', category: 'Sports', value: 480.00, count: 7 },
];

const MOCK_SOURCES = [
  { source: 'PriceCharting', count: 78 },
  { source: 'eBay', count: 14 },
  { source: 'Scryfall', count: 10 },
  { source: 'Unpriced', count: 6 },
];

export default function MarketPricingGate({ children }: MarketPricingGateProps) {
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const session = getStoredSession();
    const authenticated = !!session?.access_token;
    setIsAuthenticated(authenticated);

    if (!authenticated) {
      setIsActive(false);
      return;
    }

    async function checkSubscription() {
      try {
        const session = getStoredSession();
        const response = await fetch('/api/subscription/status', {
          headers: { 'Authorization': `Bearer ${session?.access_token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setIsActive(data.isActive === true);
        } else {
          setIsActive(false);
        }
      } catch {
        setIsActive(false);
      }
    }

    checkSubscription();
  }, []);

  // Loading state
  if (isActive === null) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading Market Pricing...</p>
        </div>
      </main>
    );
  }

  // Not authenticated or not a Card Lover — show blurred preview with upsell
  if (!isActive) {
    return (
      <main className="min-h-screen bg-gray-50 relative overflow-hidden">
        {/* Blurred mock dashboard background — forced desktop layout so shapes are visible on mobile */}
        <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
          <div className="origin-top scale-[0.55] sm:scale-75 md:scale-100" style={{ width: '100%', minWidth: '900px' }}>
            {/* Mock header */}
            <div className="bg-gradient-to-r from-purple-600 via-rose-500 to-orange-500 text-white">
              <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="text-sm font-medium text-rose-200 mb-2">Card Lovers Exclusive</div>
                <h1 className="text-3xl font-bold">Market Pricing</h1>
              </div>
            </div>

            {/* Mock summary cards — always 3-col */}
            <div className="max-w-7xl mx-auto px-4 -mt-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-md p-5">
                  <div className="text-sm text-gray-500 mb-1">Total Portfolio Value</div>
                  <div className="text-2xl font-bold text-gray-900">$10,061.50</div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-5">
                  <div className="text-sm text-gray-500 mb-1">Cards With Value Data</div>
                  <div className="text-2xl font-bold text-gray-900">92 <span className="text-lg text-gray-400 font-normal">/ 108</span></div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-5">
                  <div className="text-sm text-gray-500 mb-1">Average Card Value</div>
                  <div className="text-2xl font-bold text-gray-900">$109.36</div>
                </div>
              </div>
            </div>

            {/* Mock charts — always 2-col */}
            <div className="max-w-7xl mx-auto px-4 mt-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Collection Value by Category</h3>
                    <CategoryBreakdownChart data={MOCK_CATEGORIES} />
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Grade Distribution</h3>
                    <GradeDistributionChart data={MOCK_GRADES} />
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Value Distribution</h3>
                    <ValueDistributionChart data={MOCK_VALUES} />
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Sets by Value</h3>
                    <TopSetsChart data={MOCK_SETS} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 mt-6">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Data Sources</h3>
                  <PriceSourceChart data={MOCK_SOURCES} />
                </div>
              </div>
            </div>
          </div>

          {/* Blur overlay */}
          <div className="absolute inset-0 backdrop-blur-md bg-white/30" />
        </div>

        {/* Foreground upsell content */}
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <div className="max-w-xl w-full text-center">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-semibold mb-6">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              Card Lovers Exclusive
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Market Pricing Dashboard
            </h1>

            <p className="text-lg text-gray-600 mb-8 max-w-lg mx-auto">
              Unlock powerful portfolio analytics and real-time market data for your entire collection.
            </p>

            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-8 text-left">
              <h3 className="font-semibold text-gray-900 mb-5 text-center">Everything included with Card Lovers:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 font-bold text-sm">$</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Portfolio Valuation</p>
                    <p className="text-xs text-gray-500">Total value across all graded cards</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Value Tracking</p>
                    <p className="text-xs text-gray-500">See price changes since grading</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Interactive Charts</p>
                    <p className="text-xs text-gray-500">Grade, value, and category breakdowns</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Top Cards & Sets</p>
                    <p className="text-xs text-gray-500">Your most valuable cards ranked</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">eBay Integration</p>
                    <p className="text-xs text-gray-500">List and manage cards directly</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Price Refresh</p>
                    <p className="text-xs text-gray-500">Auto-updates every 7 days + manual</p>
                  </div>
                </div>
              </div>
            </div>

            {!isAuthenticated ? (
              <Link
                href="/login?mode=signup&redirect=/card-lovers"
                className="inline-block bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl"
              >
                Join Card Lovers
              </Link>
            ) : (
              <Link
                href="/card-lovers"
                className="inline-block bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl"
              >
                Join Card Lovers
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
