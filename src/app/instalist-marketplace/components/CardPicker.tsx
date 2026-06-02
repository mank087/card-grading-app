import { useMemo, useState } from 'react';
import type { MarketplaceCard } from '../types';

type SortKey = 'recent' | 'name' | 'grade' | 'value';

interface Props {
  cards: MarketplaceCard[];
  onSelect: (card: MarketplaceCard) => void;
}

/**
 * Left-rail card grid for the List a Card tab. Filters out cards that
 * already have active listings (the /api/ebay/eligible-cards endpoint
 * does the exclusion server-side, so everything in `cards` is fair game).
 */
export default function CardPicker({ cards, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('recent');

  const categories = useMemo(() => {
    const s = new Set<string>();
    cards.forEach(c => c.category && s.add(c.category));
    return ['all', ...Array.from(s).sort()];
  }, [cards]);

  const filtered = useMemo(() => {
    let result = cards;
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(c =>
        (c.cardName || '').toLowerCase().includes(q) ||
        (c.serial || '').toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') {
      result = result.filter(c => c.category === categoryFilter);
    }
    const sorted = [...result];
    if (sort === 'name') sorted.sort((a, b) => (a.cardName || '').localeCompare(b.cardName || ''));
    else if (sort === 'grade') sorted.sort((a, b) => (b.grade ?? 0) - (a.grade ?? 0));
    else if (sort === 'value') {
      sorted.sort((a, b) => {
        const av = a.ebayPriceMedian ?? a.dcmPriceEstimate ?? 0;
        const bv = b.ebayPriceMedian ?? b.dcmPriceEstimate ?? 0;
        return bv - av;
      });
    } // 'recent' = default order from the API
    return sorted;
  }, [cards, query, categoryFilter, sort]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-4 border-b border-gray-200 space-y-3">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or serial..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <div className="flex gap-2">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="recent">Recent first</option>
            <option value="name">Name (A-Z)</option>
            <option value="grade">Grade (high → low)</option>
            <option value="value">Value (high → low)</option>
          </select>
        </div>
      </div>

      <div className="p-3 text-xs text-gray-500 border-b border-gray-100">
        {filtered.length} {filtered.length === 1 ? 'card' : 'cards'} ready to list
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500">No matching cards.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 max-h-[640px] overflow-y-auto">
          {filtered.map(card => (
            <li key={card.id}>
              <button
                onClick={() => onSelect(card)}
                className="w-full flex items-center gap-3 p-3 hover:bg-indigo-50 text-left transition-colors"
              >
                <div className="flex-shrink-0 w-12 h-16 bg-gray-100 rounded overflow-hidden">
                  {card.thumbnailUrl ? (
                    <img src={card.thumbnailUrl} alt={card.cardName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">N/A</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{card.cardName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {card.category}{card.serial ? ` · #${card.serial}` : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {card.grade != null && (
                      <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-emerald-100 text-emerald-800">
                        Grade {card.grade}
                      </span>
                    )}
                    {(card.ebayPriceMedian ?? card.dcmPriceEstimate) != null && (
                      <span className="text-xs text-gray-600">
                        ~${(card.ebayPriceMedian ?? card.dcmPriceEstimate ?? 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-indigo-600 text-xs font-semibold flex-shrink-0">List →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
