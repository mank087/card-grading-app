import type { MarketplaceListing } from '../types';

interface Props {
  listings: MarketplaceListing[];
  onRelist: (cardId: string) => void;
}

/**
 * Ended tab — listings that finished without selling. The Relist button
 * jumps to the List a Card tab with that card preselected (parent handles
 * the navigation + modal open).
 */
export default function EndedTab({ listings, onRelist }: Props) {
  if (listings.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <h2 className="text-lg font-bold text-gray-900 mb-2">No ended listings</h2>
        <p className="text-gray-600">
          Listings that end without selling will appear here. You can relist them in one click.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-white border border-gray-200 rounded-xl">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <Th>Card</Th>
              <Th>Title</Th>
              <Th align="right">Last price</Th>
              <Th>Ended</Th>
              <Th align="right">Action</Th>
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
                <td className="px-4 py-3 text-sm text-right text-gray-700">${l.price.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{formatDate(l.endedAt)}</td>
                <td className="px-4 py-3 text-sm text-right">
                  <button
                    onClick={() => onRelist(l.cardId)}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm"
                  >
                    Relist
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
