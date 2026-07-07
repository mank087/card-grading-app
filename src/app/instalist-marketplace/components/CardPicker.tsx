import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStoredSession } from '@/lib/directAuth';
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
 *
 * Reads the raw snake_case card record (same shape the EbayListingModal
 * consumes), so we use card.card_name, card.conversational_whole_grade,
 * card.front_url, etc. directly.
 */
export default function CardPicker({ cards, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('recent');

  // Server-search state — the downloaded array is capped (2000 most recent),
  // so when local filtering comes up short we ask /api/ebay/eligible-cards?q=
  // to search the user's whole collection and merge the extras in.
  const [serverResults, setServerResults] = useState<MarketplaceCard[]>([]);
  const [serverSearching, setServerSearching] = useState(false);
  const searchSeq = useRef(0);

  const categories = useMemo(() => {
    const s = new Set<string>();
    cards.forEach(c => c.category && s.add(c.category));
    return ['all', ...Array.from(s).sort()];
  }, [cards]);

  const q = query.trim();

  // Instant client-side filter over the already-downloaded cards.
  const localMatches = useMemo(() => {
    const lq = q.toLowerCase();
    if (!lq) return cards;
    return cards.filter(c =>
      (c.card_name || '').toLowerCase().includes(lq) ||
      (c.serial || '').toLowerCase().includes(lq)
    );
  }, [cards, q]);

  const runServerSearch = useCallback(async (term: string) => {
    const seq = ++searchSeq.current;
    const session = getStoredSession();
    if (!session?.access_token) return;
    setServerSearching(true);
    try {
      const res = await fetch(`/api/ebay/eligible-cards?q=${encodeURIComponent(term)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (seq !== searchSeq.current) return; // stale — a newer search superseded this one
      setServerResults(json.cards ?? []);
    } catch {
      // Network failure is non-fatal — local matches are still shown.
    } finally {
      if (seq === searchSeq.current) setServerSearching(false);
    }
  }, []);

  // Debounced server search: only when the local result set is thin (<5
  // matches) so common searches stay instant and free. Enter forces one.
  useEffect(() => {
    // Invalidate any in-flight response for the previous query.
    searchSeq.current++;
    setServerResults([]);
    if (q.length < 2 || localMatches.length >= 5) {
      setServerSearching(false);
      return;
    }
    const timer = setTimeout(() => runServerSearch(q), 300);
    return () => clearTimeout(timer);
  }, [q, localMatches.length, runServerSearch]);

  const filtered = useMemo(() => {
    let result = localMatches;
    if (q && serverResults.length > 0) {
      const seen = new Set(result.map(c => c.id));
      const extras = serverResults.filter(c => !seen.has(c.id));
      if (extras.length > 0) result = [...result, ...extras];
    }
    if (categoryFilter !== 'all') {
      result = result.filter(c => c.category === categoryFilter);
    }
    const sorted = [...result];
    if (sort === 'name') sorted.sort((a, b) => (a.card_name || '').localeCompare(b.card_name || ''));
    else if (sort === 'grade') sorted.sort((a, b) => (b.conversational_whole_grade ?? 0) - (a.conversational_whole_grade ?? 0));
    else if (sort === 'value') {
      sorted.sort((a, b) => {
        const av = a.ebay_price_median ?? a.dcm_price_estimate ?? 0;
        const bv = b.ebay_price_median ?? b.dcm_price_estimate ?? 0;
        return bv - av;
      });
    } // 'recent' = default order from the API
    return sorted;
  }, [localMatches, serverResults, q, categoryFilter, sort]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-4 border-b border-gray-200 space-y-3">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            // Enter = search the whole collection right away, even if
            // plenty of local matches exist or the debounce hasn't fired.
            if (e.key === 'Enter' && q.length >= 2) runServerSearch(q);
          }}
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
        {serverSearching && (
          <span className="ml-2 text-indigo-600">Searching your full collection&hellip;</span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500">
            {serverSearching ? 'Searching your full collection…' : 'No matching cards.'}
          </p>
        </div>
      ) : (
        // No max-h on mobile — the page scrolls naturally and a nested
        // 640px scroll trap is a known mobile anti-pattern. On lg screens
        // we cap it so the right-side explainer panel stays visible.
        <ul className="divide-y divide-gray-100 lg:max-h-[640px] lg:overflow-y-auto">
          {filtered.map(card => (
            <li key={card.id}>
              <button
                onClick={() => onSelect(card)}
                className="w-full flex items-center gap-3 p-3 hover:bg-indigo-50 text-left transition-colors"
              >
                <div className="flex-shrink-0 w-12 h-16 bg-gray-100 rounded overflow-hidden">
                  {card.front_url ? (
                    <img src={card.front_url} alt={card.card_name ?? ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">N/A</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{card.card_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {card.category}{card.serial ? ` · #${card.serial}` : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {card.conversational_whole_grade != null && (
                      <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-emerald-100 text-emerald-800">
                        Grade {card.conversational_whole_grade}
                      </span>
                    )}
                    {(card.ebay_price_median ?? card.dcm_price_estimate) != null && (
                      <span className="text-xs text-gray-600">
                        ~${(card.ebay_price_median ?? card.dcm_price_estimate ?? 0).toFixed(2)}
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
