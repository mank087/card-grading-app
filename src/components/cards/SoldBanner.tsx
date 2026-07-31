'use client';

import { useState } from 'react';
import { soldChannelLabel } from '@/lib/cards/ownership';
import { getStoredSession } from '@/lib/directAuth';

/**
 * Banner shown on a card's detail page once it has been sold on.
 *
 * Two audiences, one component:
 *  - the BUYER (or anyone who scanned the slab's QR) sees confirmation that
 *    this record is final and hasn't been edited since the sale
 *  - the OWNER additionally sees the sale details and why the page is locked
 *
 * The card is deliberately still here. Deleting it would leave the buyer with
 * a slab whose QR 404s — see the ownership migration for the full rationale.
 */
export function SoldBanner({
  cardId,
  soldAt,
  soldPrice,
  soldChannel,
  soldNote,
  isOwner,
}: {
  /** Needed for the owner's "Still mine" action. */
  cardId?: string;
  soldAt?: string | null;
  soldPrice?: number | null;
  soldChannel?: string | null;
  soldNote?: string | null;
  isOwner?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const when = soldAt ? new Date(soldAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  }) : null;

  /**
   * Sale fell through. This is the ONLY way to unlock a sold card — while it's
   * sold, edits, label changes, going private and deletion are all refused —
   * so it belongs right here on the record, not only back on the collection.
   */
  const stillMine = async () => {
    if (!cardId) return;
    setBusy(true);
    setError(null);
    try {
      const session = getStoredSession();
      const res = await fetch(`/api/cards/${cardId}/ownership`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ownership_status: 'owned' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not move it back');
      // Full reload: the page was rendered from a locked card, so every
      // edit affordance on it needs to come back.
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-xs">
          ✓
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-bold tracking-wide">
              SOLD
            </span>
            {when && <span className="text-sm text-emerald-900 font-medium">{when}</span>}
            {isOwner && typeof soldPrice === 'number' && (
              <span className="text-sm font-bold text-emerald-900">
                ${soldPrice.toFixed(2)}
              </span>
            )}
            {isOwner && soldChannel && (
              <span className="text-xs text-emerald-700">
                · {soldChannelLabel(soldChannel)}
              </span>
            )}
          </div>

          <p className="text-sm text-emerald-800 mt-1.5">
            {isOwner ? (
              <>
                This card is no longer in your collection, but its grade report stays
                online so the buyer can verify it by scanning the label. The record is
                locked — move it back with <strong>&ldquo;Still mine&rdquo;</strong> in
                your collection if you need to edit it.
              </>
            ) : (
              <>
                This card has been sold. Its grade and card details are locked and
                cannot be changed — what you see here is the record as it was graded.
              </>
            )}
          </p>

          {isOwner && soldNote && (
            <p className="text-sm text-emerald-700 italic mt-1">{soldNote}</p>
          )}

          {isOwner && cardId && (
            <div className="mt-3">
              <button
                onClick={stillMine}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-white border-2 border-emerald-600 text-emerald-800 text-sm font-bold hover:bg-emerald-100 disabled:opacity-50"
              >
                {busy ? 'Moving back…' : 'Sale fell through — still mine'}
              </button>
              <p className="text-xs text-emerald-700 mt-1.5">
                Moves it back into your collection and unlocks editing. The sale
                price and date are cleared.
              </p>
              {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SoldBanner;
