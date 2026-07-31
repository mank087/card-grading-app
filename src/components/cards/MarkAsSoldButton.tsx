'use client';

import { useState } from 'react';
import { getStoredSession } from '@/lib/directAuth';
import MarkAsSoldDialog, { type SaleDetails } from './MarkAsSoldDialog';

/**
 * "Mark as sold" for a card's own detail page.
 *
 * Marking a sale was previously only possible from the collection list, so
 * anyone looking at the card they'd just sold had to navigate away to record
 * it. This is the obvious place to do it.
 *
 * Renders nothing for non-owners, or for a card that's already sold — that
 * case is the SoldBanner's job, and it carries the "Still mine" reversal.
 */
export function MarkAsSoldButton({
  cardId,
  cardName,
  serial,
  isOwner,
  ownershipStatus,
}: {
  cardId: string;
  cardName: string;
  serial?: string | null;
  isOwner: boolean;
  ownershipStatus?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOwner || ownershipStatus === 'sold') return null;

  const confirm = async (details: SaleDetails) => {
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
        body: JSON.stringify({ ownership_status: 'sold', ...details }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not mark as sold');
      // Reload: the page was rendered for an owned card, and selling locks
      // every edit affordance on it.
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-bold text-gray-900">Sold this card?</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          It leaves your collection and stops being offered for eBay listings, but its
          grade report stays online so the buyer can verify it.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-3 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
        >
          Mark as sold
        </button>
        {error && <p className="text-xs text-red-700 mt-2">{error}</p>}
      </div>

      {open && (
        <MarkAsSoldDialog
          cardName={cardName}
          serial={serial}
          busy={busy}
          onCancel={() => setOpen(false)}
          onConfirm={confirm}
        />
      )}
    </>
  );
}

export default MarkAsSoldButton;
