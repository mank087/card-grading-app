'use client';

/**
 * Everything the page needs to know about listing this card, in one place.
 *
 * FOUR SURFACES read the same state and must never disagree: the hero
 * InstaList panel, the mobile action bar, the InstaList tab, and the listing
 * modal the three of them open. This hook is that single source — it bundles
 * the shared status check, the session-only draft, the open signal and the
 * connection flag, so `CardDetailShell` stays composition and does not grow a
 * fifth cluster of listing state.
 *
 * ONE `/api/ebay/listing/check` PER PAGE VIEW. `useInstaListStatus` is called
 * exactly once, here, and handed down. The modal re-checks on its own when it
 * opens, which is a different question at a different moment (it is the
 * duplicate guard, EbayListingModal.tsx:627-671) and is left alone.
 */

import { useCallback, useEffect, useState } from 'react';
import { useInstaListStatus, type InstaListStatus } from './useInstaListStatus';
import { useListingDraft, type UseListingDraftResult } from './useListingDraft';

export interface CardDetailInstaList {
  status: InstaListStatus;
  draft: UseListingDraftResult;
  /** Bumped to run `EbayListingButton`'s own connect-or-open action. */
  openSignal: number;
  /** True while the listing modal is open, so the mobile bar can stand down. */
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  /** Null until `/api/ebay/status` has answered. */
  ebayConnected: boolean | null;
  setEbayConnected: (connected: boolean) => void;
  /** The mobile bar's single tap: view, re-check, or open the flow. */
  onAct: () => void;
  /** The InstaList tab's "Begin listing". */
  beginListing: () => void;
}

export function useCardDetailInstaList({
  cardId,
  card,
  cardType,
  isOwner,
  isSold,
  instaListActive,
}: {
  cardId: string;
  card: any;
  cardType: string;
  isOwner: boolean;
  isSold: boolean;
  /** True whenever the InstaList tab is the active section. */
  instaListActive: boolean;
}): CardDetailInstaList {
  const status = useInstaListStatus(cardId, { isOwner, isSold });

  // The draft's saved-defaults fetch is deferred until the tab has been opened
  // at least once — an owner who never opens InstaList costs no extra request.
  // It stays enabled afterwards so the draft survives switching tabs.
  const [draftEnabled, setDraftEnabled] = useState(false);
  useEffect(() => {
    if (instaListActive) setDraftEnabled(true);
  }, [instaListActive]);

  const draft = useListingDraft(card, cardType, { enabled: isOwner && draftEnabled });

  const [openSignal, setOpenSignal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [ebayConnected, setEbayConnectedState] = useState<boolean | null>(null);

  const setEbayConnected = useCallback((connected: boolean) => {
    setEbayConnectedState((prev) => (prev === connected ? prev : connected));
  }, []);

  const beginListing = useCallback(() => setOpenSignal((n) => n + 1), []);

  const onAct = useCallback(() => {
    if (status.state === 'listed' && status.listing?.listing_url) {
      window.open(status.listing.listing_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (status.state === 'unverified') {
      status.refresh();
      return;
    }
    // 'unlisted' — open the existing connect-or-create flow where we stand.
    beginListing();
  }, [status, beginListing]);

  return {
    status,
    draft,
    openSignal,
    modalOpen,
    setModalOpen,
    ebayConnected,
    setEbayConnected,
    onAct,
    beginListing,
  };
}

export default useCardDetailInstaList;
