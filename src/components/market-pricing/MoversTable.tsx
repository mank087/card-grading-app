'use client';

import Link from 'next/link';

interface Mover {
  id: string;
  name: string;
  category: string;
  value: number;
  gradingValue: number;
  changePercent: number;
  cardPath: string;
}

interface MoversTableProps {
  gainers: Mover[];
  losers: Mover[];
  totalGradingValue: number;
  totalCurrentValue: number;
  cardsWithGradingPrice: number;
  onRefresh: () => void;
  refreshing: boolean;
  refreshLimitReached: boolean;
  refreshCount: number;
  maxRefreshesPerDay: number;
}

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MoverRow({ mover, isGainer }: { mover: Mover; isGainer: boolean }) {
  return (
    <Link
      href={mover.cardPath}
      className="flex items-center justify-between py-2.5 px-2 hover:bg-gray-50 rounded-lg transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{mover.name}</p>
        <p className="text-xs text-gray-500">
          <span className="text-gray-400">Graded:</span> ${formatUsd(mover.gradingValue)}
          <span className="mx-1 text-gray-300">&rarr;</span>
          <span className="text-gray-400">Now:</span> ${formatUsd(mover.value)}
        </p>
      </div>
      <span
        className={`text-sm font-bold flex-shrink-0 ml-3 ${
          isGainer ? 'text-green-600' : 'text-red-500'
        }`}
      >
        {isGainer ? '+' : ''}{mover.changePercent}%
      </span>
    </Link>
  );
}

function RefreshButton({ onRefresh, refreshing, refreshLimitReached, refreshCount, maxRefreshesPerDay }: {
  onRefresh: () => void;
  refreshing: boolean;
  refreshLimitReached: boolean;
  refreshCount: number;
  maxRefreshesPerDay: number;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onRefresh}
        disabled={refreshing || refreshLimitReached}
        className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
      >
        {refreshing ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Refreshing Prices...
          </>
        ) : refreshLimitReached ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Daily Limit Reached
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Prices Now
          </>
        )}
      </button>
      <p className="text-xs text-gray-400">
        {refreshCount}/{maxRefreshesPerDay} refreshes used today
      </p>
    </div>
  );
}

export default function MoversTable({
  gainers, losers, totalGradingValue, totalCurrentValue, cardsWithGradingPrice,
  onRefresh, refreshing, refreshLimitReached, refreshCount, maxRefreshesPerDay,
}: MoversTableProps) {
  const hasMovers = gainers.length > 0 || losers.length > 0;
  const totalChange = totalGradingValue > 0
    ? ((totalCurrentValue - totalGradingValue) / totalGradingValue) * 100
    : 0;
  const totalChangeDollar = totalCurrentValue - totalGradingValue;

  return (
    <div className="space-y-5">
      {/* Summary row: Grading Value vs Current Value */}
      {cardsWithGradingPrice > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">Value at Grading</div>
            <div className="text-lg font-bold text-gray-900">${formatUsd(totalGradingValue)}</div>
            <div className="text-xs text-gray-400">{cardsWithGradingPrice} cards tracked</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">Current Value</div>
            <div className="text-lg font-bold text-gray-900">${formatUsd(totalCurrentValue)}</div>
            <div className="text-xs text-gray-400">Based on latest prices</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">Net Change</div>
            <div className={`text-lg font-bold ${totalChangeDollar > 0 ? 'text-green-600' : totalChangeDollar < 0 ? 'text-red-500' : 'text-gray-900'}`}>
              {totalChangeDollar >= 0 ? '+' : ''}${formatUsd(totalChangeDollar)}
            </div>
            <div className={`text-xs ${totalChange > 0 ? 'text-green-500' : totalChange < 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {totalChange >= 0 ? '+' : ''}{Math.round(totalChange * 10) / 10}% overall
            </div>
          </div>
        </div>
      )}

      {/* Movers lists or empty state with refresh */}
      {hasMovers ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gainers */}
            <div>
              <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Gained Value Since Grading
              </h4>
              {gainers.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {gainers.map(g => <MoverRow key={g.id} mover={g} isGainer />)}
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-2">No gainers detected yet</p>
              )}
            </div>

            {/* Losers */}
            <div>
              <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
                Lost Value Since Grading
              </h4>
              {losers.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {losers.map(l => <MoverRow key={l.id} mover={l} isGainer={false} />)}
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-2">No losers detected yet</p>
              )}
            </div>
          </div>

          {/* Refresh below movers */}
          <div className="pt-2 border-t border-gray-100">
            <RefreshButton
              onRefresh={onRefresh}
              refreshing={refreshing}
              refreshLimitReached={refreshLimitReached}
              refreshCount={refreshCount}
              maxRefreshesPerDay={maxRefreshesPerDay}
            />
          </div>
        </>
      ) : (
        <div className="text-center py-6 space-y-4">
          <p className="text-gray-500 text-sm">
            Prices are automatically updated every 7 days when you view a card, or you can manually refresh all prices below. Value changes will appear here once updated prices differ from their grading-time values.
          </p>
          <RefreshButton
            onRefresh={onRefresh}
            refreshing={refreshing}
            refreshLimitReached={refreshLimitReached}
            refreshCount={refreshCount}
            maxRefreshesPerDay={maxRefreshesPerDay}
          />
        </div>
      )}
    </div>
  );
}
