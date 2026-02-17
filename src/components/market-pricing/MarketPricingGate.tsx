'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getStoredSession } from '@/lib/directAuth';

interface MarketPricingGateProps {
  children: React.ReactNode;
}

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

  // Not authenticated or not a Card Lover — show upsell
  if (!isActive) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 via-rose-50 to-orange-50">
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
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
            Track your collection&apos;s market value, view price trends, manage eBay listings, and discover which cards are gaining value — all in one place.
          </p>

          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 text-left">
            <h3 className="font-semibold text-gray-900 mb-4">What you get with Market Pricing:</h3>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">$</span>
                Total portfolio value across all your graded cards
              </li>
              <li className="flex items-center gap-3">
                <svg className="w-6 h-6 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                Price trends and biggest movers in your collection
              </li>
              <li className="flex items-center gap-3">
                <svg className="w-6 h-6 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Category breakdown with interactive charts
              </li>
              <li className="flex items-center gap-3">
                <svg className="w-6 h-6 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                Quick eBay listing and listing management
              </li>
            </ul>
          </div>

          {!isAuthenticated ? (
            <Link
              href="/login?mode=signup&redirect=/market-pricing"
              className="inline-block bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl"
            >
              Sign Up to Get Started
            </Link>
          ) : (
            <Link
              href="/card-lovers"
              className="inline-block bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl"
            >
              Join Card Lovers — Starting at $49.99/mo
            </Link>
          )}
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
