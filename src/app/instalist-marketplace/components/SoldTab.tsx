import { useCallback } from 'react';
import type { MarketplaceListing } from '../types';
import { useSortableRows, SortableTh } from './useSortableRows';

interface Props {
  listings: MarketplaceListing[];
}

type SoldCol = 'card' | 'title' | 'price' | 'qty' | 'soldAt' | 'url';

/**
 * Sold tab. Shows GROSS sale price (v1 spec). Phase 4 will add net via
 * Sell Finances API to surface fees and final payout.
 */
export default function SoldTab({ listings }: Props) {
  const getValue = useCallback((row: MarketplaceListing, key: SoldCol) => {
    switch (key) {
      case 'card': return row.cardName ?? '';
      case 'title': return row.title ?? '';
      case 'price': return row.price * Math.max(1, row.quantitySold);
      case 'qty': return row.quantitySold || 1;
      case 'soldAt': return row.soldAt ? new Date(row.soldAt).getTime() : null;
      case 'url': return row.listingUrl ?? '';
      default: return null;
    }
  }, []);

  const { sortedRows, toggleSort, sortIndicator } = useSortableRows<MarketplaceListing, SoldCol>(
    listings,
    getValue,
    'soldAt',
    'desc'
  );

  if (listings.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <h2 className="text-lg font-bold text-gray-900 mb-2">No sales yet</h2>
        <p className="text-gray-600">
          Your sold listings will show up here once buyers complete purchases.
        </p>
      </div>
    );
  }

  const totalGross = listings.reduce((sum, l) => sum + (l.price * Math.max(1, l.quantitySold)), 0);

  return (
    <div className="space-y-4">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Lifetime gross</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">${totalGross.toFixed(2)}</p>
      </div>

      <div className="overflow-hidden bg-white border border-gray-200 rounded-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableTh col="card" toggleSort={toggleSort} sortIndicator={sortIndicator}>Card</SortableTh>
                <SortableTh col="title" toggleSort={toggleSort} sortIndicator={sortIndicator}>Title</SortableTh>
                <SortableTh col="price" align="right" defaultDir="desc" toggleSort={toggleSort} sortIndicator={sortIndicator}>Sale price</SortableTh>
                <SortableTh col="qty" align="right" defaultDir="desc" toggleSort={toggleSort} sortIndicator={sortIndicator}>Qty sold</SortableTh>
                <SortableTh col="soldAt" defaultDir="desc" toggleSort={toggleSort} sortIndicator={sortIndicator}>Sold</SortableTh>
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
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-700">
                    ${l.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{l.quantitySold || 1}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(l.soldAt)}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    {l.listingUrl ? (
                      <a
                        href={l.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        Open
                      </a>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}
