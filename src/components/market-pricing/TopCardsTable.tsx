'use client';

import Image from 'next/image';
import Link from 'next/link';

interface TopCard {
  id: string;
  name: string;
  category: string;
  grade: number;
  value: number;
  imageUrl: string | null;
  cardPath: string;
  cardSet?: string;
  cardNumber?: string;
}

interface TopCardsTableProps {
  cards: TopCard[];
}

const CATEGORY_BADGES: Record<string, string> = {
  pokemon: 'bg-red-100 text-red-700',
  sports: 'bg-blue-100 text-blue-700',
  mtg: 'bg-purple-100 text-purple-700',
  lorcana: 'bg-indigo-100 text-indigo-700',
  onepiece: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-700',
};

export default function TopCardsTable({ cards }: TopCardsTableProps) {
  if (!cards || cards.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No cards with market value data yet.
        <br />
        <span className="text-gray-500">Grade cards and visit their detail pages to load pricing.</span>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {cards.map((card, index) => (
        <Link
          key={card.id}
          href={card.cardPath}
          className="flex items-center gap-3 py-3 px-2 hover:bg-gray-50 rounded-lg transition-colors group"
        >
          {/* Rank */}
          <span className="text-sm font-bold text-gray-400 w-6 text-right flex-shrink-0">
            {index + 1}
          </span>

          {/* Thumbnail */}
          <div className="w-10 h-14 bg-gray-100 rounded overflow-hidden flex-shrink-0 relative">
            {card.imageUrl ? (
              <Image
                src={card.imageUrl}
                alt={card.name}
                fill
                sizes="40px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">?</div>
            )}
          </div>

          {/* Card info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-purple-600 transition-colors">
              {card.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {card.cardSet && (
                <span className="text-xs text-gray-500 truncate max-w-[120px]">{card.cardSet}</span>
              )}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_BADGES[card.category] || CATEGORY_BADGES.other}`}>
                {card.category}
              </span>
            </div>
          </div>

          {/* Grade */}
          {card.grade > 0 && (
            <div className="text-center flex-shrink-0">
              <div className={`text-sm font-bold ${card.grade >= 9 ? 'text-green-600' : card.grade >= 7 ? 'text-blue-600' : 'text-amber-600'}`}>
                {card.grade}
              </div>
              <div className="text-[10px] text-gray-400">grade</div>
            </div>
          )}

          {/* Value */}
          <div className="text-right flex-shrink-0">
            <div className="text-sm font-bold text-gray-900">
              ${card.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-gray-400">est. value</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
