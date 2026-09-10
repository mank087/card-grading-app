'use client';

/**
 * "Your batches" — a way back into a bulk run from the List tab.
 *
 * A batch survives the tab that started it (the drain publishes with nobody
 * watching), so without this the only route back to a running batch is the URL
 * the seller happened to still have open. Deliberately small: recent batches,
 * what state each is in, and a link.
 *
 * Only batches that still need the seller: drafts, running, paused, and
 * finished ones with rows to retry (the API filters; a batch whose cards all
 * went live is just "My Listings" now).
 *
 * Silent when the seller has never started one, and silent on any error — this
 * is a convenience strip, not something worth an error state on a page that
 * already has four tabs of its own.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { BulkBatchSummary } from '../bulk/types';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  running: 'Publishing',
  paused: 'Paused',
  complete: 'Finished',
  failed: 'Finished with failures',
  cancelled: 'Cancelled',
};

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  running: 'bg-indigo-100 text-indigo-800',
  paused: 'bg-amber-100 text-amber-800',
  complete: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function BulkBatchesStrip({ token }: { token: string | null }) {
  const [batches, setBatches] = useState<BulkBatchSummary[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteBatch = async (id: string) => {
    if (!token) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/ebay/bulk/batches/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBatches(prev => prev.filter(b => b.id !== id));
    } catch {
      // Leave the row in place; the seller can retry.
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };
  // A running batch publishes without this page: the counts here are stale the
  // moment they land, so the strip refreshes while one is in flight and stops
  // the moment nothing is (and while the tab is hidden — nobody is reading it).
  const running = batches.some(b => b.status === 'running');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetch('/api/ebay/bulk/batches?limit=5', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => (r.ok ? r.json() : null))
        .then(json => {
          if (!cancelled && Array.isArray(json?.batches)) setBatches(json.batches);
        })
        .catch(() => { /* convenience only */ });
    };
    load();
    if (!running) return () => { cancelled = true; };
    const id = window.setInterval(load, 10_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [token, running]);

  if (batches.length === 0) return null;

  return (
    <div className="mb-5 bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Your batches</h3>
      </div>
      <ul className="divide-y divide-gray-100">
        {batches.map(batch => (
          <li key={batch.id} className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                STATUS_STYLE[batch.status] ?? 'bg-gray-100 text-gray-700'
              }`}
            >
              {STATUS_LABEL[batch.status] ?? batch.status}
            </span>
            <span className="text-sm text-gray-800">
              {batch.total_count} card{batch.total_count === 1 ? '' : 's'}
              {batch.live_count > 0 && (
                <span className="text-emerald-700"> &middot; {batch.live_count} live</span>
              )}
              {batch.failed_count > 0 && (
                <span className="text-red-700"> &middot; {batch.failed_count} failed</span>
              )}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(batch.created_at).toLocaleDateString()}
            </span>
            <Link
              href={`/instalist-marketplace/bulk/${batch.id}`}
              className="ml-auto text-sm font-semibold text-indigo-600 hover:text-indigo-800"
            >
              {batch.status === 'draft' ? 'Continue review' : 'Open'}
            </Link>
            {['draft', 'complete', 'failed', 'cancelled'].includes(batch.status) && (
              confirmId === batch.id ? (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-red-800">Delete?</span>
                  <button
                    onClick={() => deleteBatch(batch.id)}
                    disabled={deletingId === batch.id}
                    className="px-2 py-1 bg-red-600 text-white rounded font-semibold hover:bg-red-700 disabled:opacity-50"
                  >
                    {deletingId === batch.id ? 'Deleting…' : 'Yes'}
                  </button>
                  <button onClick={() => setConfirmId(null)} className="text-gray-600 hover:text-gray-900">No</button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmId(batch.id)}
                  className="text-xs text-gray-400 hover:text-red-700"
                  title={batch.status === 'draft' ? 'Delete this draft batch' : 'Delete this batch'}
                >
                  Delete
                </button>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
