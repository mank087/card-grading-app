'use client';

import React, { useState, useEffect } from 'react';
import { EbayListingModal } from './EbayListingModal';
import { getStoredSession } from '@/lib/directAuth';

interface EbayListingButtonProps {
  card: any;
  cardType?: 'pokemon' | 'sports' | 'mtg' | 'lorcana' | 'other';
  showFounderEmblem?: boolean;
  labelStyle?: 'modern' | 'traditional';
  variant?: 'default' | 'compact' | 'icon';
  className?: string;
}

export const EbayListingButton: React.FC<EbayListingButtonProps> = ({
  card,
  cardType = 'sports',
  showFounderEmblem = false,
  labelStyle = 'modern',
  variant = 'default',
  className = '',
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
          setEbayStatus({
            connected: data.connected,
            username: data.username,
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

  const handleClick = () => {
    if (!ebayStatus.connected) {
      // Redirect to eBay connect page with current URL as redirect
      const currentUrl = window.location.pathname + window.location.search;
      window.location.href = `/ebay/connect?redirect=${encodeURIComponent(currentUrl)}`;
      return;
    }
    setIsModalOpen(true);
  };

  // Loading state
  if (ebayStatus.loading) {
    return null;
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

        <EbayListingModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          card={card}
          cardType={cardType}
          showFounderEmblem={showFounderEmblem}
          labelStyle={labelStyle}
        />
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

        <EbayListingModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          card={card}
          cardType={cardType}
          showFounderEmblem={showFounderEmblem}
          labelStyle={labelStyle}
        />
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

      <EbayListingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        card={card}
        cardType={cardType}
        showFounderEmblem={showFounderEmblem}
        labelStyle={labelStyle}
      />
    </>
  );
};
