'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getStoredSession } from '@/lib/directAuth';

/**
 * Realised sales view for the portfolio page.
 *
 * REVENUE ONLY. There is no cost basis in the system — nothing records what a
 * card was bought for — so no figure here is framed as profit or gain, and the
 * page says outright that totals are before fees. Getting that wrong would be
 * worse than not shipping the tab.
 *
 * Sales with no recorded price are shown, not hidden: they're the ones the
 * owner most needs to act on, and dropping them would understate the total
 * silently. Each offers an inline price field.
 */

interface Sale {
  id: string;
  serial: string | null;
  name: string;
  category: string | null;
  cardSet: string | null;
  cardNumber: string | null;
  grade: number | null;
  condition: string | null;
  soldAt: string | null;
  soldPrice: number | null;
  soldChannel: string | null;
  soldNote: string | null;
  frontUrl: string | null;
}

interface SoldData {
  available: boolean;
  totals: {
    salesCount: number;
    pricedCount: number;
    missingPriceCount: number;
    revenue: number;
    averageSale: number;
    medianSale: number;
    medianDaysToSell: number | null;
  } | null;
  byCategory: { name: string; count: number; revenue: number }[];
  byChannel: { name: string; count: number; revenue: number }[];
  byMonth: { month: string; count: number; revenue: number }[];
  sales: Sale[];
}

const money = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

/** A group where nothing has a price yet reads as "sold for $0" otherwise. */
const groupMoney = (n: number) => (n > 0 ? money(n) : '—');

const routeFor = (category: string | null, id: string) => {
  const sports = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];
  if (category && sports.includes(category)) return `/sports/${id}`;
  if (category === 'Pokemon') return `/pokemon/${id}`;
  if (category === 'MTG') return `/mtg/${id}`;
  if (category === 'Lorcana') return `/lorcana/${id}`;
  if (category === 'One Piece') return `/onepiece/${id}`;
  if (category === 'Yu-Gi-Oh') return `/yugioh/${id}`;
  return `/other/${id}`;
};

export function SoldTab() {
  const [data, setData] = useState<SoldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const session = getStoredSession();
    if (!session?.access_token) { setLoading(false); return; }
    try {
      const res = await fetch('/api/market-pricing/sold', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * Fill in a missing sale price. Sends only the price — the API keeps the
   * existing sale date and channel, so recording a price later never re-dates
   * the sale or relabels an eBay sale as private.
   */
  const savePrice = async (sale: Sale) => {
    const value = Number(draft);
    if (!isFinite(value) || value < 0) return;
    setSaving(true);
    try {
      const session = getStoredSession();
      const res = await fetch(`/api/cards/${sale.id}/ownership`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ownership_status: 'sold', sold_price: value }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not save');
      setEditing(null);
      setDraft('');
      await load();
    } catch {
      /* left in edit mode so the value isn't lost */
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Loading your sales…</div>;

  if (!data?.available || !data.totals || data.totals.salesCount === 0) {
    return (
      <div className="p-10 text-center">
        <p className="font-semibold text-gray-800">No sales yet</p>
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
          When you mark a card as sold it appears here with what it sold for. Cards stay
          verifiable for the buyer after the sale.
        </p>
        <Link
          href="/collection"
          className="inline-block mt-4 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700"
        >
          Go to my collection
        </Link>
      </div>
    );
  }

  const t = data.totals;
  const maxMonth = Math.max(...data.byMonth.map(m => m.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total sales</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{money(t.revenue)}</p>
          <p className="text-xs text-gray-400 mt-0.5">before fees &amp; shipping</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cards sold</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{t.salesCount}</p>
          {t.missingPriceCount > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">{t.missingPriceCount} without a price</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Average sale</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{money(t.averageSale)}</p>
          <p className="text-xs text-gray-400 mt-0.5">median {money(t.medianSale)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Typical time to sell</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {t.medianDaysToSell != null ? `${t.medianDaysToSell}d` : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">from grading to sale</p>
        </div>
      </div>

      {t.missingPriceCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>{t.missingPriceCount}</strong> of your {t.salesCount} sales don&apos;t have a
          price recorded, so they aren&apos;t in the total. Add them below to see the full picture.
        </div>
      )}

      {/* Sales over time */}
      {data.byMonth.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Sales by month</h3>
          <div className="flex items-end gap-2 h-32">
            {data.byMonth.map(m => (
              <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${m.count} sale${m.count === 1 ? '' : 's'} · ${money(m.revenue)}`}>
                <span className="text-[10px] text-gray-500">{money(m.revenue)}</span>
                <div
                  className="w-full bg-emerald-500 rounded-t"
                  style={{ height: `${Math.max(4, (m.revenue / maxMonth) * 100)}%` }}
                />
                <span className="text-[10px] text-gray-400">{m.month.slice(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdowns */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">By category</h3>
          {data.byCategory.map(c => (
            <div key={c.name} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700">{c.name} <span className="text-gray-400">({c.count})</span></span>
              <span className="text-sm font-semibold text-gray-900">{groupMoney(c.revenue)}</span>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Where they sold</h3>
          {data.byChannel.map(c => (
            <div key={c.name} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700">{c.name} <span className="text-gray-400">({c.count})</span></span>
              <span className="text-sm font-semibold text-gray-900">{groupMoney(c.revenue)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Every sale */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <h3 className="font-semibold text-gray-900 p-5 pb-3">All sales</h3>
        <div className="divide-y divide-gray-100">
          {data.sales.map(sale => (
            <div key={sale.id} className="flex items-center gap-3 p-4">
              {sale.frontUrl ? (
                <img src={sale.frontUrl} alt="" className="w-10 h-14 object-cover rounded shrink-0" />
              ) : (
                <div className="w-10 h-14 rounded bg-gray-100 shrink-0" />
              )}

              <div className="min-w-0 flex-1">
                <Link href={routeFor(sale.category, sale.id)} className="font-semibold text-gray-900 hover:text-purple-700 truncate block">
                  {sale.name}
                </Link>
                <p className="text-xs text-gray-500 truncate">
                  {[sale.cardSet, sale.cardNumber && `#${sale.cardNumber}`, sale.grade && `Grade ${sale.grade}`]
                    .filter(Boolean).join(' · ')}
                </p>
                <p className="text-xs text-gray-400">
                  {sale.soldAt ? new Date(sale.soldAt).toLocaleDateString() : 'date unknown'}
                  {sale.soldChannel === 'ebay' ? ' · eBay' : ' · Private sale'}
                </p>
              </div>

              <div className="shrink-0 text-right">
                {sale.soldPrice != null ? (
                  <span className="font-bold text-emerald-700">{money(sale.soldPrice)}</span>
                ) : editing === sale.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') savePrice(sale);
                        if (e.key === 'Escape') { setEditing(null); setDraft(''); }
                      }}
                      placeholder="0.00"
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <button
                      onClick={() => savePrice(sale)}
                      disabled={saving || !draft}
                      className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      {saving ? '…' : 'Save'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditing(sale.id); setDraft(''); }}
                    className="px-2.5 py-1 rounded-lg border border-dashed border-gray-300 text-xs font-semibold text-gray-500 hover:border-emerald-500 hover:text-emerald-700"
                  >
                    ＋ Add price
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center pb-4">
        Totals are what these cards sold for, before eBay fees, shipping and postage.
      </p>
    </div>
  );
}

export default SoldTab;
