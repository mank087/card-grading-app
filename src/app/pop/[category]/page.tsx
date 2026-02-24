'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { GRADE_COLUMNS, isTcgCategory } from '@/lib/popReport';

interface CardData {
  cardName: string;
  cardNumber: string;
  featured: string | null;
  cardSet: string | null;
  thumbnailUrl: string | null;
  total: number;
  grades: Record<number, number>;
}

interface CategoryInfo {
  slug: string;
  dbCategory: string;
  displayName: string;
  icon: string;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

type SortField = 'cardName' | 'featured' | 'cardSet' | 'total';
type SortDir = 'asc' | 'desc';

export default function PopCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = use(params);
  const isTcg = isTcgCategory(category);
  const [cards, setCards] = useState<CardData[]>([]);
  const [categoryInfo, setCategoryInfo] = useState<CategoryInfo | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({ total: 0, limit: 50, offset: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCards = useCallback(
    (offset: number) => {
      setLoading(true);
      const qp = new URLSearchParams({
        limit: String(itemsPerPage),
        offset: String(offset),
      });
      if (debouncedSearch) qp.set('search', debouncedSearch);

      fetch(`/api/pop/${category}/sets?${qp}`)
        .then((res) => res.json())
        .then((data) => {
          setCategoryInfo(data.category || null);
          setCards(data.cards || []);
          setPagination(data.pagination || { total: 0, limit: itemsPerPage, offset, hasMore: false });
        })
        .catch((err) => console.error('Failed to load cards:', err))
        .finally(() => setLoading(false));
    },
    [category, debouncedSearch, itemsPerPage]
  );

  useEffect(() => {
    fetchCards(0);
  }, [fetchCards]);

  // Client-side sort
  const sortedCards = [...cards].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'cardName') {
      cmp = (a.cardName || '').localeCompare(b.cardName || '');
    } else if (sortField === 'featured') {
      cmp = (a.featured || '').localeCompare(b.featured || '');
    } else if (sortField === 'cardSet') {
      cmp = (a.cardSet || '').localeCompare(b.cardSet || '');
    } else {
      cmp = a.total - b.total;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'total' ? 'desc' : 'asc');
    }
  };

  const currentPage = Math.floor(pagination.offset / itemsPerPage) + 1;
  const totalPages = Math.max(1, Math.ceil(pagination.total / itemsPerPage));

  // Column count for empty state colspan
  const colCount = (isTcg ? 3 : 4) + GRADE_COLUMNS.length + 1;

  const gradeColor = (grade: number) => {
    const colors: Record<number, string> = {
      1: 'bg-red-50 text-red-700',
      2: 'bg-red-50 text-red-600',
      3: 'bg-orange-50 text-orange-700',
      4: 'bg-orange-50 text-orange-600',
      5: 'bg-yellow-50 text-yellow-700',
      6: 'bg-yellow-50 text-yellow-600',
      7: 'bg-lime-50 text-lime-700',
      8: 'bg-green-50 text-green-700',
      9: 'bg-emerald-50 text-emerald-700',
      10: 'bg-emerald-50 text-emerald-800',
    };
    return colors[grade] || '';
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">&uarr;&darr;</span>;
    return <span className="text-purple-500 ml-1">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>;
  };

  const searchPlaceholder = isTcg
    ? 'Search by card name or set...'
    : 'Search by card name, player, or set...';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 via-purple-900 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Breadcrumb */}
          <nav className="flex items-center text-sm text-gray-400 mb-4">
            <Link href="/pop" className="hover:text-white transition-colors">
              Pop Report
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white">{categoryInfo?.displayName || category}</span>
          </nav>

          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{categoryInfo?.icon}</span>
            <h1 className="text-3xl sm:text-4xl font-bold">{categoryInfo?.displayName || category}</h1>
          </div>
          <p className="text-gray-300">
            {pagination.total.toLocaleString()} unique cards &middot;{' '}
            {cards.reduce((sum, c) => sum + c.total, 0).toLocaleString()} total graded
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          >
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th
                    className="text-left px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:text-purple-600 sticky left-0 bg-gray-50 z-10 min-w-[200px]"
                    onClick={() => handleSort('cardName')}
                  >
                    Card <SortIcon field="cardName" />
                  </th>
                  {!isTcg && (
                    <th
                      className="text-left px-3 py-3 font-semibold text-gray-700 cursor-pointer hover:text-purple-600 min-w-[120px]"
                      onClick={() => handleSort('featured')}
                    >
                      Player / Character <SortIcon field="featured" />
                    </th>
                  )}
                  <th
                    className="text-left px-3 py-3 font-semibold text-gray-700 cursor-pointer hover:text-purple-600 min-w-[120px]"
                    onClick={() => handleSort('cardSet')}
                  >
                    Set <SortIcon field="cardSet" />
                  </th>
                  <th className="px-3 py-3 font-semibold text-center text-gray-700 min-w-[48px]">#</th>
                  {GRADE_COLUMNS.map((g) => (
                    <th key={g} className={`px-3 py-3 font-semibold text-center min-w-[48px] ${gradeColor(g)}`}>
                      {g}
                    </th>
                  ))}
                  <th
                    className="px-4 py-3 font-semibold text-center text-gray-700 cursor-pointer hover:text-purple-600"
                    onClick={() => handleSort('total')}
                  >
                    Total <SortIcon field="total" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-4 py-3 sticky left-0 bg-white">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-14 bg-gray-200 rounded animate-pulse flex-shrink-0" />
                          <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
                        </div>
                      </td>
                      {!isTcg && (
                        <td className="px-3 py-3"><div className="h-4 w-24 bg-gray-100 rounded animate-pulse" /></td>
                      )}
                      <td className="px-3 py-3"><div className="h-4 w-28 bg-gray-100 rounded animate-pulse" /></td>
                      <td className="px-3 py-3 text-center"><div className="h-4 w-8 bg-gray-100 rounded animate-pulse mx-auto" /></td>
                      {GRADE_COLUMNS.map((g) => (
                        <td key={g} className="px-3 py-3 text-center">
                          <div className="h-4 w-6 bg-gray-100 rounded animate-pulse mx-auto" />
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center"><div className="h-4 w-8 bg-gray-200 rounded animate-pulse mx-auto" /></td>
                    </tr>
                  ))
                ) : sortedCards.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="px-4 py-12 text-center text-gray-500">
                      {debouncedSearch ? 'No cards match your search.' : 'No graded cards found for this category.'}
                    </td>
                  </tr>
                ) : (
                  sortedCards.map((card, idx) => (
                    <tr key={`${card.cardName}-${card.cardNumber}-${idx}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 sticky left-0 bg-white">
                        <div className="flex items-center gap-3">
                          {card.thumbnailUrl ? (
                            <Image
                              src={card.thumbnailUrl}
                              alt={card.cardName || 'Card'}
                              width={40}
                              height={56}
                              className="rounded object-cover flex-shrink-0"
                              unoptimized
                            />
                          ) : (
                            <div className="w-10 h-14 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <span className="font-medium text-gray-900">{card.cardName || 'Unknown'}</span>
                        </div>
                      </td>
                      {!isTcg && (
                        <td className="px-3 py-3 text-gray-600">
                          {card.featured || '\u2014'}
                        </td>
                      )}
                      <td className="px-3 py-3 text-gray-600 max-w-[200px] truncate" title={card.cardSet || undefined}>
                        {card.cardSet || '\u2014'}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-500 tabular-nums">
                        {card.cardNumber || '\u2014'}
                      </td>
                      {GRADE_COLUMNS.map((g) => (
                        <td key={g} className="px-3 py-3 text-center tabular-nums">
                          {card.grades[g] ? (
                            <span className="font-medium">{card.grades[g]}</span>
                          ) : (
                            <span className="text-gray-300">&mdash;</span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center font-semibold tabular-nums">{card.total}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {!loading && pagination.total > itemsPerPage && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => fetchCards(Math.max(0, pagination.offset - itemsPerPage))}
              disabled={pagination.offset === 0}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => fetchCards(pagination.offset + itemsPerPage)}
              disabled={!pagination.hasMore}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
