import type { MarketplaceListing } from '../types';

interface Props {
  listings: MarketplaceListing[];
}

/**
 * Sold tab. Shows GROSS sale price (v1 spec). Phase 4 will add net via
 * Sell Finances API to surface fees and final payout.
 */
export default function SoldTab({ listings }: Props) {
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
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Lifetime gross</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">${totalGross.toFixed(2)}</p>
        </div>
        <p className="text-xs text-gray-500 max-w-[260px] text-right">
          Gross sale price before eBay fees and shipping costs. Net payout breakdown coming in Phase 4.
        </p>
      </div>

      <div className="overflow-hidden bg-white border border-gray-200 rounded-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>Card</Th>
                <Th>Title</Th>
                <Th align="right">Sale price</Th>
                <Th align="right">Qty sold</Th>
                <Th>Sold</Th>
                <Th align="right">View on eBay</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {listings.map(l => (
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

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
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
