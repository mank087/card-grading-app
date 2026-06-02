'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getStoredSession } from '@/lib/directAuth';
import { EbayListingModal } from '@/components/ebay/EbayListingModal';
import StatsStrip from './components/StatsStrip';
import ListNewTab from './components/ListNewTab';
import MyListingsTab from './components/MyListingsTab';
import SoldTab from './components/SoldTab';
import EndedTab from './components/EndedTab';
import MarketplaceInfo from './components/MarketplaceInfo';
import type { MarketplaceCard, MarketplaceListing, MarketplaceStats } from './types';

type TabId = 'list' | 'active' | 'sold' | 'ended';

// Map DCM category strings to the cardType the EbayListingModal expects.
function categoryToCardType(category: string | null | undefined): 'pokemon' | 'sports' | 'mtg' | 'lorcana' | 'onepiece' | 'other' {
  if (!category) return 'other';
  const c = category.toLowerCase();
  if (c === 'pokemon') return 'pokemon';
  if (c === 'mtg') return 'mtg';
  if (c === 'lorcana') return 'lorcana';
  if (c === 'one piece' || c === 'onepiece') return 'onepiece';
  if (['sports', 'football', 'baseball', 'basketball', 'hockey', 'soccer', 'wrestling'].includes(c)) return 'sports';
  return 'other';
}

/**
 * Top-level page state machine:
 *
 *   - 'loading'   — checking session + initial fetches
 *   - 'guest'     — not authenticated; show info page with signup/login CTAs
 *   - 'no-cards'  — authenticated but zero graded cards; show info page with "grade a card" CTA
 *   - 'connect'   — has cards but not connected to eBay; show info page with "connect" CTA
 *   - 'marketplace' — fully provisioned; show the dashboard tabs + footer info section
 */
type PageState = 'loading' | 'guest' | 'no-cards' | 'connect' | 'marketplace';

export default function MarketplaceClient() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ebayUsername, setEbayUsername] = useState<string | null>(null);

  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [listings, setListings] = useState<{
    active: MarketplaceListing[];
    sold: MarketplaceListing[];
    ended: MarketplaceListing[];
  }>({ active: [], sold: [], ended: [] });

  const [cards, setCards] = useState<MarketplaceCard[]>([]);
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalCard, setModalCard] = useState<MarketplaceCard | null>(null);

  // Connect-flow state
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // -------------------------------- Loading --------------------------------

  const refreshAll = useCallback(async (token?: string) => {
    const t = token ?? accessToken;
    setRefreshing(true);
    setError(null);
    try {
      if (!t) {
        setPageState('guest');
        return;
      }
      const headers = { Authorization: `Bearer ${t}` };

      // First check whether the user has any graded cards. If they don't,
      // skip the marketplace fetches entirely — they're not ready to list.
      const cardsRes = await fetch('/api/ebay/eligible-cards', { headers });
      if (!cardsRes.ok) {
        throw new Error('Failed to load cards');
      }
      const cardsJson = await cardsRes.json();
      const eligibleCards: MarketplaceCard[] = cardsJson.cards ?? [];
      const alreadyListedCount: number = cardsJson.alreadyListedCount ?? 0;
      const totalGradedCards = eligibleCards.length + alreadyListedCount;
      setCards(eligibleCards);

      if (totalGradedCards === 0) {
        setPageState('no-cards');
        return;
      }

      // User has cards. Now check eBay connection.
      const statusRes = await fetch('/api/ebay/status', { headers });
      const statusJson = await statusRes.json();
      const isConnected = !!statusJson.connected;
      setEbayUsername(statusJson.connection?.ebay_username ?? null);

      if (!isConnected) {
        setPageState('connect');
        return;
      }

      // Fully provisioned — load the dashboard payloads.
      const [statsRes, listingsRes] = await Promise.all([
        fetch('/api/ebay/stats', { headers }),
        fetch('/api/ebay/my-listings', { headers }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (listingsRes.ok) {
        const j = await listingsRes.json();
        setListings({ active: j.active ?? [], sold: j.sold ?? [], ended: j.ended ?? [] });
      }
      setPageState('marketplace');
    } catch (e: any) {
      console.error('[Marketplace] refreshAll error', e);
      setError(e.message || 'Failed to load marketplace');
    } finally {
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const session = getStoredSession();
    if (session?.user && session.access_token) {
      setAccessToken(session.access_token);
      refreshAll(session.access_token);
    } else {
      setPageState('guest');
    }
    // intentionally only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh on tab focus when marketplace is active.
  useEffect(() => {
    if (pageState !== 'marketplace') return;
    const onFocus = () => refreshAll();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [pageState, refreshAll]);

  // Default tab: My Listings if any active, else List a Card.
  useEffect(() => {
    if (pageState !== 'marketplace') return;
    if (activeTab !== null) return;
    if (!stats) return;
    setActiveTab(stats.activeCount > 0 ? 'active' : 'list');
  }, [pageState, stats, activeTab]);

  const handleListingPublished = useCallback(() => {
    setModalCard(null);
    refreshAll();
  }, [refreshAll]);

  // -------------------------------- eBay OAuth --------------------------------

  const startEbayConnect = useCallback(async () => {
    if (!accessToken) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch('/api/ebay/auth?return_url=/instalist-marketplace', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const j = await res.json();
      // The route returns { authUrl }, not { url } — earlier draft used the
      // wrong key and surfaced "No auth URL returned" even when the API was
      // working fine. Accept both shapes defensively.
      const authUrl = j.authUrl || j.url;
      if (!authUrl) throw new Error(j.error || 'No auth URL returned');
      const popup = window.open(authUrl, 'ebay-oauth', 'width=600,height=750');
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === 'EBAY_AUTH_COMPLETE') {
          window.removeEventListener('message', onMessage);
          popup?.close();
          refreshAll();
        }
      };
      window.addEventListener('message', onMessage);
    } catch (e: any) {
      setConnectError(e.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  }, [accessToken, refreshAll]);

  // -------------------------------- Render --------------------------------

  if (pageState === 'loading') {
    return <FullPageLoader message="Loading marketplace..." />;
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-md p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Couldn&rsquo;t load marketplace</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => refreshAll()}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (pageState === 'guest') {
    return <MarketplaceInfo variant="hero" ctaMode="signup" />;
  }

  if (pageState === 'no-cards') {
    return <MarketplaceInfo variant="hero" ctaMode="grade" />;
  }

  if (pageState === 'connect') {
    return (
      <MarketplaceInfo
        variant="hero"
        ctaMode="connect"
        onConnect={startEbayConnect}
        isConnecting={connecting}
        connectError={connectError}
      />
    );
  }

  // ------------------- Full marketplace (pageState === 'marketplace') -------------------

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">InstaList Marketplace</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              List your graded cards on eBay and track performance.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {ebayUsername && (
              <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {ebayUsername === 'eBay User'
                  ? 'Connected to eBay'
                  : <>Connected as <strong>{ebayUsername}</strong></>}
              </span>
            )}
            <button
              onClick={() => refreshAll()}
              disabled={refreshing}
              className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
              title="Refresh"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <StatsStrip stats={stats} />

        {/* Tabs — scrollable on mobile so the row doesn't wrap awkwardly */}
        <div className="mt-6 border-b border-gray-200 overflow-x-auto">
          <nav className="-mb-px flex gap-4 sm:gap-6 min-w-max">
            <TabButton active={activeTab === 'list'} onClick={() => setActiveTab('list')}>
              List a Card
            </TabButton>
            <TabButton active={activeTab === 'active'} onClick={() => setActiveTab('active')}>
              My Listings <Count value={stats?.activeCount ?? 0} />
            </TabButton>
            <TabButton active={activeTab === 'sold'} onClick={() => setActiveTab('sold')}>
              Sold <Count value={stats?.soldCount ?? 0} />
            </TabButton>
            <TabButton active={activeTab === 'ended'} onClick={() => setActiveTab('ended')}>
              Ended <Count value={stats?.endedCount ?? 0} />
            </TabButton>
          </nav>
        </div>

        {/* Tab content */}
        <div className="mt-6">
          {activeTab === 'list' && (
            <ListNewTab cards={cards} onSelectCard={setModalCard} />
          )}
          {activeTab === 'active' && (
            <MyListingsTab listings={listings.active} />
          )}
          {activeTab === 'sold' && (
            <SoldTab listings={listings.sold} />
          )}
          {activeTab === 'ended' && (
            <EndedTab
              listings={listings.ended}
              onRelist={(cardId) => {
                const card = cards.find(c => c.id === cardId);
                if (card) {
                  setActiveTab('list');
                  setModalCard(card);
                }
              }}
            />
          )}
        </div>

        {/* Footer info section — keeps the value-prop visible to existing users */}
        <MarketplaceInfo variant="footer" />
      </div>

      {/* Listing modal — reuses the same EbayListingModal as the card-detail page */}
      {modalCard && (
        <EbayListingModal
          isOpen={true}
          onClose={handleListingPublished}
          card={modalCard}
          cardType={categoryToCardType(modalCard.category)}
        />
      )}
    </main>
  );
}

// ---------------------------- Subcomponents ----------------------------

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
        active
          ? 'border-indigo-600 text-indigo-700'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

function Count({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
      {value}
    </span>
  );
}

function FullPageLoader({ message }: { message: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3" />
        <p className="text-gray-600">{message}</p>
      </div>
    </main>
  );
}
