'use client';

import React, { useState, useEffect } from 'react';
import { EbayListingModal } from './EbayListingModal';
import { getStoredSession } from '@/lib/directAuth';

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

  const handleClick = React.useCallback(() => {
    if (!ebayStatus.connected) {
      // Redirect to eBay connect page with current URL as redirect
      const currentUrl = window.location.pathname + window.location.search;
      window.location.href = `/ebay/connect?redirect=${encodeURIComponent(currentUrl)}`;
      return;
    }
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
