'use client';

import React, { useState, useEffect } from 'react';
import { EbayListingModal } from './EbayListingModal';
import { getStoredSession } from '@/lib/directAuth';
import type { InitialListingDraft } from '@/lib/ebay/listingSeed';
import { buildEbayConnectHref } from '@/lib/ebay/connectRedirect';

interface EbayListingButtonProps {
  card: any;
  cardType?: 'pokemon' | 'sports' | 'mtg' | 'lorcana' | 'onepiece' | 'yugioh' | 'starwars' | 'other';
  showFounderEmblem?: boolean;
  labelStyle?: string;
  customLabelConfig?: import('@/lib/labelPresets').CustomLabelConfig | null;
  variant?: 'default' | 'compact' | 'icon';
  className?: string;
  /**
   * ADDITIVE (card detail V2, finding 4/F). A counter the caller increments to
   * perform this button's own action from outside — the mobile action bar taps
   * "InstaList" and the connect-or-create flow opens right there, instead of
   * scrolling the reader to a second button to tap. It runs the SAME
   * `handleClick`: redirect to /ebay/connect when disconnected, open
   * `EbayListingModal` when connected.
   *
   * Absent (or 0) and nothing happens: existing callers are unaffected.
   */
  openSignal?: number;
  /**
   * ADDITIVE. Fired when the modal reports a listing was published, so a
   * caller holding listing state can re-check instead of going stale.
   */
  onListed?: () => void;
  /**
   * ADDITIVE. Render nothing but keep the modal and the `openSignal` handler
   * mounted — for a caller that shows its own trigger (the mobile bar) and
   * only wants this component's flow.
   */
  triggerHidden?: boolean;
  /**
   * ADDITIVE. Reports whether the listing modal is open, so a page with its
   * own fixed chrome (the card detail mobile action bar) can get out of its
   * way. Existing callers omit it and nothing changes.
   */
  onModalOpenChange?: (open: boolean) => void;
  /**
   * ADDITIVE (card detail V2, InstaList tab). Passed straight through to
   * `EbayListingModal.initialDraft`: the fields the caller's own pre-listing
   * editor has ALREADY changed, which override the modal's seed for those
   * fields only. Omitted, the modal seeds exactly as before.
   *
   * This also covers the mobile action bar for free: the bar bumps `openSignal`
   * on this same instance, so a phone user who edited the InstaList tab opens
   * the modal with their edits.
   */
  initialDraft?: InitialListingDraft | null;
  /**
   * ADDITIVE (card detail V2, InstaList tab). Reports whether this account has
   * an eBay connection, once the status check has answered.
   *
   * It exists so a caller can LABEL its own trigger ("Begin listing" vs
   * "Connect eBay to continue") without re-fetching `/api/ebay/status` or
   * re-deriving the `/ebay/connect?redirect=…` hop. The action itself stays
   * here: the caller bumps `openSignal` and `handleClick` decides.
   */
  onConnectionChange?: (connected: boolean) => void;
}

export const EbayListingButton: React.FC<EbayListingButtonProps> = ({
  card,
  cardType = 'sports',
  showFounderEmblem = false,
  labelStyle = 'modern',
  customLabelConfig = null,
  variant = 'default',
  className = '',
  openSignal,
  onListed,
  triggerHidden = false,
  onModalOpenChange,
  initialDraft = null,
  onConnectionChange,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ebayStatus, setEbayStatus] = useState<{
    connected: boolean;
    username?: string;
    loading: boolean;
  }>({ connected: false, loading: true });

  // Check eBay connection status
  useEffect(() => {
    const checkEbayStatus = async () => {
      const session = getStoredSession();
      if (!session?.access_token) {
        setEbayStatus({ connected: false, loading: false });
        return;
      }

      try {
        const response = await fetch('/api/ebay/status', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // /api/ebay/status nests the account under `connection`; the old
          // `data.username` was always undefined.
          setEbayStatus({
            connected: data.connected,
            username: data.connection?.ebay_username ?? undefined,
            loading: false,
          });
        } else {
          setEbayStatus({ connected: false, loading: false });
        }
      } catch {
        setEbayStatus({ connected: false, loading: false });
      }
    };

    checkEbayStatus();
  }, []);

  /**
   * ADDITIVE (review 2026-09-22, finding 3). The draft is SNAPSHOT at the
   * moment the flow is begun, and that snapshot is what the modal receives for
   * the whole of this open.
   *
   * `initialDraft` is a live memo in the card-detail tab: it is recomputed
   * whenever the draft state changes, including when the tab's saved-defaults
   * fetch lands a second or two after the modal was opened. Passing the live
   * value through meant a late background change could reach the modal's seed.
   * A caller that passes nothing still gets null, exactly as before.
   */
  const liveInitialDraft = React.useRef<InitialListingDraft | null>(initialDraft);
  liveInitialDraft.current = initialDraft;
  const [openedDraft, setOpenedDraft] = useState<InitialListingDraft | null>(null);

  const handleClick = React.useCallback(() => {
    if (!ebayStatus.connected) {
      // Redirect to the eBay connect page, and come back to exactly where the
      // seller was standing — including the FRAGMENT, which is what names the
      // InstaList tab on the card detail page. See lib/ebay/connectRedirect.ts
      // for the round trip through /api/ebay/auth and /api/ebay/callback; a
      // page with no fragment builds the identical URL it always did.
      window.location.href = buildEbayConnectHref(window.location);
      return;
    }
    setOpenedDraft(liveInitialDraft.current ?? null);
    setIsModalOpen(true);
  }, [ebayStatus.connected]);

  // ADDITIVE: perform this button's action when the caller bumps the signal.
  // The first render is skipped so mounting with a non-zero value does not
  // open anything by itself.
  const lastOpenSignal = React.useRef(0);
  React.useEffect(() => {
    if (!openSignal || openSignal === lastOpenSignal.current) return;
    lastOpenSignal.current = openSignal;
    // While the connection status is still loading, handleClick would read
    // `connected: false` and redirect to /ebay/connect for an account that IS
    // connected. Wait for the status instead.
    if (ebayStatus.loading) return;
    handleClick();
  }, [openSignal, ebayStatus.loading, handleClick]);

  React.useEffect(() => {
    onModalOpenChange?.(isModalOpen);
  }, [isModalOpen, onModalOpenChange]);

  // ADDITIVE: only once the check has answered, so a caller never labels its
  // trigger "Connect eBay" for a connected account on the strength of the
  // loading default.
  React.useEffect(() => {
    if (ebayStatus.loading) return;
    onConnectionChange?.(ebayStatus.connected);
  }, [ebayStatus.loading, ebayStatus.connected, onConnectionChange]);

  const modal = (
    <EbayListingModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      card={card}
      cardType={cardType}
      showFounderEmblem={showFounderEmblem}
      labelStyle={labelStyle}
      customLabelConfig={customLabelConfig}
      onListed={onListed}
      initialDraft={openedDraft}
    />
  );

  // Loading state
  if (ebayStatus.loading) {
    return null;
  }

  // ADDITIVE: no trigger of our own, but the flow stays reachable via openSignal.
  if (triggerHidden) {
    return modal;
  }

  // Icon variant (for use in card actions)
  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={handleClick}
          className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${className}`}
          title={ebayStatus.connected ? 'List on eBay' : 'Connect eBay to list'}
        >
          <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.5 9.5h3v5h-3v-5zm5 0h3v5h-3v-5zm5 0h3v5h-3v-5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          </svg>
        </button>

        {modal}
      </>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleClick}
          className={`flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium ${className}`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
          </svg>
          {ebayStatus.connected ? 'List on eBay' : 'Connect eBay'}
        </button>

        {modal}
      </>
    );
  }

  // Default variant
  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-md font-semibold ${className}`}
      >
        {/* eBay-style icon */}
        <svg className="w-5 h-5" viewBox="0 0 120 48" fill="currentColor">
          <text x="0" y="36" fontSize="40" fontWeight="bold" fontFamily="Arial">
            <tspan fill="#e53238">e</tspan>
            <tspan fill="#0064d2">b</tspan>
            <tspan fill="#f5af02">a</tspan>
            <tspan fill="#86b817">y</tspan>
          </text>
        </svg>
        <span>{ebayStatus.connected ? 'List on eBay' : 'Connect eBay to List'}</span>
      </button>

        {modal}
    </>
  );
};
