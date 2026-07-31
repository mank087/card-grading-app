'use client';

import { useState } from 'react';

/**
 * Mark-as-sold dialog. Shared by the collection page and the card detail page
 * so the two can't drift apart.
 *
 * Sale price and date are optional — plenty of people won't want to record
 * them, and demanding a price would push users back toward deleting. The
 * dialog's real job is to make clear that selling ISN'T deleting: the buyer
 * keeps a working QR code, and the seller keeps the record.
 */
export interface SaleDetails {
  sold_price?: string;
  sold_at?: string;
  sold_note?: string;
}

export function MarkAsSoldDialog({
  cardName,
  serial,
  busy,
  onCancel,
  onConfirm,
}: {
  cardName: string;
  serial?: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (details: SaleDetails) => void;
}) {
  const [price, setPrice] = useState('');
  const [soldAt, setSoldAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900">Mark as sold</h2>
        <p className="text-sm text-gray-600 mt-1">
          {cardName}
          {serial ? <span className="text-gray-400"> · {serial}</span> : null}
        </p>

        <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
          This removes the card from your collection and from the eBay listing picker —
          but <strong>keeps its grade page online</strong>, so the buyer can still scan the
          QR code on the label and verify it.
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Sale price <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Sale date</label>
            <input
              type="date"
              value={soldAt}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setSoldAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Note <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Sold at the Portland show"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={() => onConfirm({
              sold_price: price || undefined,
              sold_at: soldAt ? new Date(soldAt).toISOString() : undefined,
              sold_note: note || undefined,
            })}
            disabled={busy}
            className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Mark as sold'}
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default MarkAsSoldDialog;
