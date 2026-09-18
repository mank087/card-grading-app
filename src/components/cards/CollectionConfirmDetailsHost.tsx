'use client';

/**
 * Confirm a card's details from My Collection without leaving the page.
 *
 * The "Confirm details" tags in the grid, list and table views fire
 * `requestConfirmDetails(cardId)`; this host, mounted once on the page, loads
 * that card's review state and opens the same dialog the card page uses. The
 * tags sit inside links and clickable tiles, so they go through a window event
 * instead of threading a callback through three views.
 */

import { useCallback, useEffect, useState } from 'react';
import { getStoredSession } from '@/lib/directAuth';
import ConfirmCardDetailsDialog, { type IdentityReviewState } from './ConfirmCardDetailsDialog';

const EVENT = 'dcm:confirm-card-details';

export function requestConfirmDetails(cardId: string): void {
  if (typeof window === 'undefined' || !cardId) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { cardId } }));
}

interface HostCard { id: string; front_url?: string | null; back_url?: string | null }

interface Props {
  cards: HostCard[];
  /** Called after a save or a "Review later" so the list can refresh that card. */
  onChanged: (cardId: string) => void;
  /** Where "More details" goes: the card's own page, which has the full editor. */
  hrefFor: (cardId: string) => string | null;
}

export default function CollectionConfirmDetailsHost({ cards, onChanged, hrefFor }: Props) {
  const [cardId, setCardId] = useState<string | null>(null);
  const [state, setState] = useState<IdentityReviewState | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (id: string): Promise<IdentityReviewState | null> => {
    try {
      const session = getStoredSession();
      if (!session?.access_token) return null;
      const response = await fetch(`/api/cards/${id}/identity-review`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) return null;
      const data = (await response.json()) as IdentityReviewState;
      return Array.isArray(data?.fields) ? data : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const onRequest = (event: Event) => {
      const id = (event as CustomEvent<{ cardId?: string }>).detail?.cardId;
      if (!id) return;
      setCardId(id);
      setState(null);
      setFailed(false);
      load(id).then(data => { if (data) setState(data); else setFailed(true); });
    };
    window.addEventListener(EVENT, onRequest);
    return () => window.removeEventListener(EVENT, onRequest);
  }, [load]);

  const close = () => { setCardId(null); setState(null); setFailed(false); };
  if (!cardId) return null;

  if (!state) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40" onClick={close} role="status">
        <div className="bg-white rounded-xl shadow-xl px-5 py-4 text-sm text-slate-700" onClick={event => event.stopPropagation()}>
          {failed ? 'We could not open this card just now. Please try again, or open the card to confirm its details.' : 'Opening your card details...'}
        </div>
      </div>
    );
  }

  const card = cards.find(c => c.id === cardId);
  return (
    <ConfirmCardDetailsDialog
      cardId={cardId}
      review={state}
      frontUrl={card?.front_url}
      backUrl={card?.back_url}
      fetchFirstLook={!state.first_look_present && process.env.NEXT_PUBLIC_FIRST_LOOK_ON_DEMAND === '1'}
      onClose={close}
      onDismissed={() => { onChanged(cardId); close(); }}
      onSaved={() => { onChanged(cardId); close(); }}
      onOpenMoreDetails={() => { const href = hrefFor(cardId); if (href) window.location.href = href; }}
      onReload={() => load(cardId)}
    />
  );
}
