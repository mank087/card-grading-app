'use client';

/**
 * "Is this card listed on eBay?" — as an explicit state (review finding F).
 *
 * WHAT WAS WRONG. `InstaListPanel` ran the check itself and treated EVERY
 * non-listing outcome the same: no listing, a 401, a network failure and eBay
 * being unreachable all rendered the plain "list this card" button. A failed
 * check is not evidence that the card is unlisted, and offering to create a
 * second listing on that basis is the wrong default.
 *
 * WHAT IT IS NOW. One hook, one state, shared by the hero panel and the mobile
 * action bar so the two cannot disagree:
 *
 *   'not-owner'   nothing to say; the panel renders nothing.
 *   'sold'        the record is locked. Decided before any network call.
 *   'checking'    the request is in flight. No create action is offered yet.
 *   'listed'      a verified active listing, with its URL.
 *   'unlisted'    the API said so: `hasListing: false`, 200.
 *   'unverified'  the check failed, was rejected, or returned nothing usable.
 *                 NEVER rendered as 'unlisted'.
 *
 * `/api/ebay/listing/check` shape (src/app/api/ebay/listing/check/route.ts):
 *   { hasListing: true,  listing: {...}, verified: true }
 *   { hasListing: false, listing: null }
 *   { hasListing: false, listing: null, previousListing: {...}, verified?: false }
 */

import { useCallback, useEffect, useState } from 'react';
import { getStoredSession } from '@/lib/directAuth';

export type InstaListState =
  | 'checking'
  | 'listed'
  | 'unlisted'
  | 'unverified'
  | 'sold'
  | 'not-owner';

export interface ActiveListing {
  listing_url?: string | null;
  listing_id?: string | null;
  status?: string | null;
}

export interface InstaListStatus {
  state: InstaListState;
  listing: ActiveListing | null;
  /** Re-run the check — after a listing is published, or on the reader's ask. */
  refresh: () => void;
}

export function useInstaListStatus(
  cardId: string,
  { isOwner, isSold }: { isOwner: boolean; isSold: boolean },
): InstaListStatus {
  const [state, setState] = useState<InstaListState>('checking');
  const [listing, setListing] = useState<ActiveListing | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!isOwner) {
      setState('not-owner');
      return;
    }
    if (isSold) {
      setState('sold');
      return;
    }

    const session = getStoredSession();
    if (!session?.access_token) {
      // An owner by the client-side check but with no usable token: we cannot
      // know, so we say we cannot know.
      setState('unverified');
      return;
    }

    let cancelled = false;
    setState('checking');

    fetch(`/api/ebay/listing/check?cardId=${encodeURIComponent(cardId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`listing check ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.hasListing && data.listing) {
          setListing(data.listing as ActiveListing);
          setState('listed');
          return;
        }
        // `verified: false` is the route's own way of saying it could not
        // reach eBay to confirm. Honour it.
        if (data && data.hasListing === false && data.verified !== false) {
          setListing(null);
          setState('unlisted');
          return;
        }
        setListing(null);
        setState('unverified');
      })
      .catch(() => {
        if (!cancelled) {
          setListing(null);
          setState('unverified');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cardId, isOwner, isSold, nonce]);

  return { state, listing, refresh };
}
