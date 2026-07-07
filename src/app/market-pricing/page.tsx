'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getStoredSession } from '@/lib/directAuth';
import LoggedOutPreview from '@/components/market-pricing/LoggedOutPreview';
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
  /** Cards whose cached price is >7 days old (or never priced). Drives the
      background-refresh polling for Card Lovers. */
  stalePriceCount?: number;
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
  const [refreshFeedback, setRefreshFeedback] = useState<
    | null
    | { kind: 'success'; refreshed: number; failed: number; remaining: number }
    | { kind: 'error'; message: string }
    | { kind: 'rate-limited'; retryAfterSec: number }
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // Card Lovers status drives the on-demand Refresh button. Free users see
  // an "Auto-refreshes weekly" pill instead — they're still served the
  // fresh data from the Sunday cron, just not on-demand.
  const [isCardLover, setIsCardLover] = useState<boolean>(false);
  // Auth check resolved separately from the data fetch so we can render
  // the LoggedOutPreview immediately for guests rather than flashing a
  // loading spinner that resolves to a guest CTA.
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
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
    // Inspect the session once so we can decide between the logged-out
    // preview and the real dashboard before kicking off any fetches.
    const session = getStoredSession();
    const authed = !!session?.access_token;
    setIsAuthenticated(authed);
    setAuthChecked(true);
    if (!authed) {
      setLoading(false);
      return;
    }
    fetchPortfolio();
    checkCardLoverStatus();
    // Portfolio-open refresh (all users): top up stale prices in the
    // background. Server enforces stale-only + 150/batch + 60s cool-down,
    // so this is a cheap no-op when everything is fresh (or when the
    // app-mount trigger just ran). The polling effect below re-fetches
    // the numbers as the refresh lands.
    try {
      const s = getStoredSession();
      if (s?.access_token) {
        void fetch('/api/market-pricing/refresh-prices', {
          method: 'POST',
          headers: { Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger: 'portfolio-open' }),
          keepalive: true,
        }).catch(() => { /* fire-and-forget */ });
      }
    } catch { /* no-op */ }
  }, []);

  async function checkCardLoverStatus() {
    try {
      const session = getStoredSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/subscription/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsCardLover(data.isActive === true);
      }
    } catch { /* default false */ }
  }

  // Re-fetch when category filter changes — but only for authenticated
  // users; the guest preview never hits the API.
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchPortfolio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // Freshness race: the portfolio-open (and app-mount) background refresh
  // runs while this page's fetch usually wins the race and shows
  // pre-refresh numbers. While stale cards remain, silently re-poll with
  // backoff so fresh prices appear without a manual reload.
  const MAX_AUTO_POLLS = 3;
  const [autoRefreshPolls, setAutoRefreshPolls] = useState(0);
  useEffect(() => {
    if (!portfolio || refreshing || loading) return;
    if ((portfolio.stalePriceCount ?? 0) === 0 || autoRefreshPolls >= MAX_AUTO_POLLS) return;
    const delay = [10_000, 20_000, 40_000][autoRefreshPolls] ?? 40_000;
    const t = setTimeout(() => {
      setAutoRefreshPolls(n => n + 1);
      fetchPortfolio({ silent: true });
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio, autoRefreshPolls, refreshing, loading]);

  async function fetchPortfolio(opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoading(true);
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
    setRefreshFeedback(null);
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

      const data = await res.json().catch(() => ({} as any));

      if (res.status === 429) {
        setRefreshFeedback({ kind: 'rate-limited', retryAfterSec: data.retryAfterSec ?? 60 });
        // Don't burn one of the 2 daily clicks on a server-rejected one.
        return;
      }

      if (!res.ok || !data.success) {
        setRefreshFeedback({
          kind: 'error',
          message: typeof data.error === 'string' ? data.error : 'Refresh failed. Please try again in a moment.',
        });
        return;
      }

      setRefreshFeedback({
        kind: 'success',
        refreshed: Number(data.refreshed) || 0,
        failed: Number(data.failed) || 0,
        remaining: Number(data.remaining) || 0,
      });

      // Track refresh count (2 per day limit). Server also enforces a
      // 60s cool-down; the localStorage counter is just for the UI label.
      const newCount = refreshCount + 1;
      setRefreshCount(newCount);
      localStorage.setItem('dcm_refresh_data', JSON.stringify({
        count: newCount,
        date: new Date().toISOString().slice(0, 10),
      }));

      // Re-fetch portfolio after refresh
      await fetchPortfolio();
    } catch (err: any) {
      setRefreshFeedback({
        kind: 'error',
        message: err?.message?.length < 200 ? err.message : 'Refresh failed. Please try again.',
      });
    } finally {
      setRefreshing(false);
    }
  }

  // Logged-out marketing preview. Renders immediately for guests so they
  // see what the Portfolio is + a sign-in / sign-up CTA, instead of a
  // blank page while the data fetch decides it can't auth.
  if (authChecked && !isAuthenticated) {
    return <LoggedOutPreview />;
  }

  return (
    <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <section className="bg-gradient-to-r from-purple-600 via-rose-500 to-orange-500 text-white">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <h1 className="text-3xl md:text-4xl font-bold">Portfolio</h1>
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
              <div className="text-xs text-gray-400 mt-1">Based on DCM estimates &amp; eBay asking prices (active listings)</div>
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

        {/* Background-refresh pill — visible while the portfolio-open
            refresh is still working through stale cards. */}
        {!loading && (portfolio?.stalePriceCount ?? 0) > 0 && autoRefreshPolls < MAX_AUTO_POLLS && (
          <section className="max-w-7xl mx-auto px-4 mt-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 text-blue-800 px-4 py-2.5 text-sm flex items-center gap-2" role="status">
              <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Updating {portfolio!.stalePriceCount} stale price{portfolio!.stalePriceCount === 1 ? '' : 's'} in the background — figures refresh automatically.
            </div>
          </section>
        )}

        {/* Refresh feedback banner — appears after the user clicks Refresh
            Prices Now. Dismissible; auto-clears on next refresh attempt. */}
        {refreshFeedback && (
          <section className="max-w-7xl mx-auto px-4 mt-4">
            <div
              className={`rounded-xl border px-4 py-3 text-sm flex items-start justify-between gap-3 ${
                refreshFeedback.kind === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : refreshFeedback.kind === 'rate-limited'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
              role="status"
            >
              <div className="flex-1">
                {refreshFeedback.kind === 'success' && (
                  <>
                    <strong>Refresh complete.</strong>{' '}
                    {refreshFeedback.refreshed} card{refreshFeedback.refreshed === 1 ? '' : 's'} updated
                    {refreshFeedback.failed > 0 && `, ${refreshFeedback.failed} couldn't be priced`}
                    {refreshFeedback.remaining > 0 && (
                      <>
                        {' '}&middot; {refreshFeedback.remaining} more stale card{refreshFeedback.remaining === 1 ? '' : 's'} will refresh on the next click or weekly cron
                      </>
                    )}
                    .
                  </>
                )}
                {refreshFeedback.kind === 'rate-limited' && (
                  <>
                    <strong>Easy there.</strong> Please wait {refreshFeedback.retryAfterSec}s
                    before refreshing again so we don&apos;t hammer the pricing APIs.
                  </>
                )}
                {refreshFeedback.kind === 'error' && (
                  <>
                    <strong>Refresh didn&apos;t complete.</strong> {refreshFeedback.message}
                  </>
                )}
              </div>
              <button
                onClick={() => setRefreshFeedback(null)}
                className="text-current opacity-60 hover:opacity-100 flex-shrink-0"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </section>
        )}

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
                    onClick={() => fetchPortfolio()}
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
                      showRefreshButton={isCardLover}
                    />
                  </div>

                </>
              )}
          </div>

        </section>
      </main>
  );
}
