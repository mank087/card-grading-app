'use client';

import Link from 'next/link';

interface Mover {
  id: string;
  name: string;
  category: string;
  value: number;
  changePercent: number;
  cardPath: string;
}

interface MoversTableProps {
  gainers: Mover[];
  losers: Mover[];
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
          ${mover.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

export default function MoversTable({ gainers, losers }: MoversTableProps) {
  const hasData = gainers.length > 0 || losers.length > 0;

  if (!hasData) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        Price change data requires at least two weekly snapshots. Prices update every Sunday — check back next week!
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Gainers */}
      <div>
        <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Biggest Gainers
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
          Biggest Losers
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
  );
}
