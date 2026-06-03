import { useCallback } from 'react';
import type { MarketplaceListing } from '../types';
import { useSortableRows, SortableTh } from './useSortableRows';

interface Props {
  listings: MarketplaceListing[];
}

type ActiveCol = 'card' | 'title' | 'price' | 'publishedAt' | 'url';

export default function MyListingsTab({ listings }: Props) {
  const getValue = useCallback((row: MarketplaceListing, key: ActiveCol) => {
    switch (key) {
      case 'card': return row.cardName ?? '';
      case 'title': return row.title ?? '';
      case 'price': return row.price;
      case 'publishedAt': return row.publishedAt ? new Date(row.publishedAt).getTime() : null;
      case 'url': return row.listingUrl ?? '';
      default: return null;
    }
  }, []);

  const { sortedRows, toggleSort, sortIndicator } = useSortableRows<MarketplaceListing, ActiveCol>(
    listings,
    getValue,
    'publishedAt',
    'desc'
  );

  if (listings.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <h2 className="text-lg font-bold text-gray-900 mb-2">No active listings yet</h2>
        <p className="text-gray-600 mb-6">
          Pick a card from the &ldquo;List a Card&rdquo; tab to publish your first listing.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile card layout — tables don't fit on phones without horizontal
          scroll, which hides every column except Card. Below md we render a
          stack of cards instead. */}
      <div className="md:hidden space-y-3">
        {sortedRows.map(l => (
          <div key={l.id} className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-14 h-20 bg-gray-100 rounded overflow-hidden">
                {l.thumbnailUrl ? (
                  <img src={l.thumbnailUrl} alt="" className="w-full h-full object-contain" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 truncate">{l.cardName}</p>
                <p className="text-xs text-gray-500">{l.cardCategory}{l.cardGrade != null ? ` · Grade ${l.cardGrade}` : ''}</p>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2" title={l.title}>{l.title}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-semibold text-gray-900">${safePrice(l.price)}</span>
                  <span className="text-xs text-gray-500">{formatDate(l.publishedAt)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-gray-400">{l.listingFormat === 'AUCTION' ? 'Auction' : 'Fixed'} · {labelForDuration(l.duration)}</span>
                  {l.listingUrl ? (
                    <a
                      href={l.listingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                    >
                      Open
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden bg-white border border-gray-200 rounded-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableTh col="card" toggleSort={toggleSort} sortIndicator={sortIndicator}>Card</SortableTh>
                <SortableTh col="title" toggleSort={toggleSort} sortIndicator={sortIndicator}>Title</SortableTh>
                <SortableTh col="price" align="right" defaultDir="desc" toggleSort={toggleSort} sortIndicator={sortIndicator}>Price</SortableTh>
                <SortableTh col="publishedAt" defaultDir="desc" toggleSort={toggleSort} sortIndicator={sortIndicator}>Published</SortableTh>
                <SortableTh col="url" align="right" toggleSort={toggleSort} sortIndicator={sortIndicator}>View on eBay</SortableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedRows.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-14 h-20 bg-gray-100 rounded overflow-hidden">
                        {l.thumbnailUrl ? (
                          <img src={l.thumbnailUrl} alt="" className="w-full h-full object-contain" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate max-w-[180px]">{l.cardName}</p>
                        <p className="text-xs text-gray-500">{l.cardCategory}{l.cardGrade != null ? ` · Grade ${l.cardGrade}` : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-[280px]">
                    <div className="truncate" title={l.title}>{l.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{l.listingFormat === 'AUCTION' ? 'Auction' : 'Fixed price'} · {labelForDuration(l.duration)}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                    ${safePrice(l.price)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(l.publishedAt)}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    {l.listingUrl ? (
                      <a
                        href={l.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        Open
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    ) : (
                      <span className="text-gray-400">&mdash;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function safePrice(n: number): string {
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

function labelForDuration(d: string): string {
  switch (d) {
    case 'Days_3': case 'DAYS_3': return '3d';
    case 'Days_5': case 'DAYS_5': return '5d';
    case 'Days_7': case 'DAYS_7': return '7d';
    case 'Days_10': case 'DAYS_10': return '10d';
    case 'Days_30': case 'DAYS_30': return '30d';
    case 'GTC': return 'GTC';
    default: return d || '';
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}
