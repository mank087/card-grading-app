'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { bulkUiEnabled } from '@/lib/ebay/bulkFlags';
import { MAX_BULK_ITEMS } from '@/lib/ebay/bulkReadiness';
import { getStoredSession } from '@/lib/directAuth';
import { categoryToRouteSlug } from '@/lib/postGradeEmailTemplates';
import StatsStrip from './components/StatsStrip';
import ListNewTab from './components/ListNewTab';
import BulkBatchesStrip from './components/BulkBatchesStrip';
import MyListingsTab from './components/MyListingsTab';
import SoldTab from './components/SoldTab';
import EndedTab from './components/EndedTab';
import EbayPolicySettings from '@/components/ebay/EbayPolicySettings';
import MarketplaceInfo from './components/MarketplaceInfo';
import type { MarketplaceCard, MarketplaceListing, MarketplaceStats } from './types';
import { useCustomLabelStyle } from '@/hooks/useCustomLabelStyle';

// Loaded on demand — the listing modal pulls in @react-pdf and the whole
// image-generation pipeline (~MBs of JS). Guests and users who never open
// a listing shouldn't download any of it.
const EbayListingModal = dynamic(
  () => import('@/components/ebay/EbayListingModal').then(m => m.EbayListingModal),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
      </div>
    ),
  }
);

type TabId = 'list' | 'active' | 'sold' | 'ended' | 'settings';

// Map DCM category strings to the cardType the EbayListingModal expects.
// The modal's cardType doubles as the card-detail route slug, so this defers to
// categoryToRouteSlug — the single source of truth for category → route.
function categoryToCardType(category: string | null | undefined): 'pokemon' | 'sports' | 'mtg' | 'lorcana' | 'onepiece' | 'yugioh' | 'starwars' | 'other' {
  return categoryToRouteSlug(category) as ReturnType<typeof categoryToCardType>;
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
  // The user's saved label style — without it the listing modal silently
  // rendered slab imagery as 'modern' even for Heritage/custom users,
  // diverging from the card-detail listing flow.
  const { labelStyle, activeConfig } = useCustomLabelStyle();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ebayUsername, setEbayUsername] = useState<string | null>(null);

  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [listings, setListings] = useState<{
    active: MarketplaceListing[];
    sold: MarketplaceListing[];
    ended: MarketplaceListing[];
  }>({ active: [], sold: [], ended: [] });

  const [cards, setCards] = useState<MarketplaceCard[]>([]);
  const [cardsTruncated, setCardsTruncated] = useState(false);
  // The marketplace shell renders before the (heavy) card list arrives —
  // this flag lets ListNewTab show a loader instead of a false empty state.
  const [cardsLoaded, setCardsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalCard, setModalCard] = useState<MarketplaceCard | null>(null);
  const [relistError, setRelistError] = useState<string | null>(null);

  // Bulk listing (feature-flagged). The single-card modal path above is
  // untouched — this is a second way out of the same picker.
  const router = useRouter();
  const bulkEnabled = bulkUiEnabled();
  const [bulkSelection, setBulkSelection] = useState<string[]>([]);
  const [startingBatch, setStartingBatch] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Connect-flow state
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // On-demand sync state ("Syncing 47 listings..." pill)
  const [syncState, setSyncState] = useState<
    | { kind: 'idle' }
    | { kind: 'syncing'; activeCount: number }
    | { kind: 'done'; transitions: number }
    | { kind: 'rate-limited'; retryAfterSec: number }
  >({ kind: 'idle' });

  // -------------------------------- Loading --------------------------------

  // Monotonic refresh counter — if a newer refresh starts while an older one
  // is still in flight, the older one's results are silently dropped so a
  // slow response can't clobber fresher data.
  const refreshSeq = useRef(0);
  // Timestamp of the last refresh that completed without an error — used to
  // throttle the window-focus refetch.
  const lastRefreshAt = useRef(0);

  const refreshAll = useCallback(async (token?: string) => {
    const t = token ?? accessToken;
    const seq = ++refreshSeq.current;
    const isStale = () => seq !== refreshSeq.current;
    setRefreshing(true);
    setError(null);
    try {
      if (!t) {
        setPageState('guest');
        return;
      }
      const headers = { Authorization: `Bearer ${t}` };

      // Fire all four requests concurrently. eligible-cards is by far the
      // heaviest payload (up to 2000 card rows + signed URLs) and must not
      // block the connect/marketplace decision or the dashboard numbers.
      // Each promise captures its own failure so one bad endpoint doesn't
      // discard the others' results.
      const settle = (p: Promise<Response>) =>
        p.then(
          res => ({ res, err: null as unknown }),
          err => ({ res: null as Response | null, err })
        );
      const cardsP = settle(fetch('/api/ebay/eligible-cards', { headers }));
      const statusP = settle(fetch('/api/ebay/status', { headers }));
      const statsP = settle(fetch('/api/ebay/stats', { headers }));
      const listingsP = settle(fetch('/api/ebay/my-listings', { headers }));

      // Connection status is a tiny payload and decides the whole page —
      // render the marketplace shell as soon as it lands instead of making
      // the user stare at a spinner while the card list downloads.
      const status = await statusP;
      if (isStale()) return;
      if (!status.res) {
        throw new Error("Couldn't check your eBay connection. Try again in a moment.");
      }
      const statusJson = await status.res.json();
      if (isStale()) return;
      const isConnected = !!statusJson.connected;
      setEbayUsername(statusJson.connection?.ebay_username ?? null);
      if (isConnected) setPageState('marketplace');

      // Deferred failure message — apply every successful payload first,
      // then surface the first failure (same crafted messages as before).
      let failure: string | null = null;

      if (isConnected) {
        // Surface stats/listings failures explicitly instead of silently
        // landing the user in an empty marketplace — a 401 on either
        // endpoint is almost always an expired session and the user needs
        // to know to reconnect.
        const [stats, listings] = await Promise.all([statsP, listingsP]);
        if (isStale()) return;
        if (stats.res?.ok) {
          const sj = await stats.res.json();
          if (isStale()) return;
          setStats(sj);
        }
        if (listings.res?.ok) {
          const lj = await listings.res.json();
          if (isStale()) return;
          setListings({ active: lj.active ?? [], sold: lj.sold ?? [], ended: lj.ended ?? [] });
        }
        if (!stats.res?.ok || !listings.res?.ok) {
          const failed = !stats.res?.ok ? 'stats' : 'listings';
          const httpStatus = !stats.res?.ok ? stats.res?.status : listings.res?.status;
          failure = httpStatus === 401
            ? "Your DCM session expired. Please refresh the page and sign in again."
            : `Couldn't load your eBay ${failed}${httpStatus ? ` (status ${httpStatus})` : ''}. Try again in a moment.`;
        }
      }

      // Card list — decides no-cards vs connect for unconnected users and
      // fills the List a Card picker for connected ones.
      const cards = await cardsP;
      if (isStale()) return;
      if (cards.res?.ok) {
        const cardsJson = await cards.res.json();
        if (isStale()) return;
        const eligibleCards: MarketplaceCard[] = cardsJson.cards ?? [];
        const alreadyListedCount: number = cardsJson.alreadyListedCount ?? 0;
        const totalGradedCards = eligibleCards.length + alreadyListedCount;
        setCards(eligibleCards);
        setCardsTruncated(!!cardsJson.truncated);
        setCardsLoaded(true);

        if (totalGradedCards === 0) {
          setPageState('no-cards');
          return;
        }
        if (!isConnected) {
          setPageState('connect');
          return;
        }
      } else if (!isConnected) {
        // Without the card list we can't tell no-cards from connect.
        throw new Error('Failed to load cards');
      } else {
        // Connected user — keep the dashboard data we already applied,
        // but tell them the picker didn't load.
        failure = failure ?? 'Failed to load cards';
      }

      if (failure) {
        setError(failure);
        return;
      }
      lastRefreshAt.current = Date.now();
    } catch (e: any) {
      if (isStale()) return;
      console.error('[Marketplace] refreshAll error', e);
      // Only surface our own crafted messages — never raw server error text
      // (could contain Supabase/eBay internals).
      const friendly = (e?.message && typeof e.message === 'string' && e.message.length < 200)
        ? e.message
        : 'Something went wrong loading your marketplace. Please try again.';
      setError(friendly);
    } finally {
      // A newer refresh owns the flag now — don't flicker it off mid-run.
      if (!isStale()) setRefreshing(false);
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

  // Refresh on tab focus when marketplace is active — but throttled: users
  // alt-tab constantly, and every focus used to re-download the full card
  // list. Skip if the last successful refresh was under a minute ago.
  useEffect(() => {
    if (pageState !== 'marketplace') return;
    const onFocus = () => {
      if (Date.now() - lastRefreshAt.current < 60_000) return;
      refreshAll();
    };
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

  // Fire the on-demand sync once when the marketplace renders. The endpoint
  // self-rate-limits (3-min window), so this is safe to run on every fresh
  // page load — it'll return skipped=true if a recent sync already covered it.
  // Once it completes, refetch the lists + stats so transitions surface
  // without a manual refresh.
  const fireSyncMe = useCallback(async () => {
    if (!accessToken) return;
    if (syncState.kind === 'syncing') return; // already in flight
    setSyncState({ kind: 'syncing', activeCount: stats?.activeCount ?? 0 });
    try {
      const res = await fetch('/api/ebay/sync-me', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const j = await res.json();
      if (j.skipped && j.retryAfterSec) {
        setSyncState({ kind: 'rate-limited', retryAfterSec: j.retryAfterSec });
        // Auto-dismiss after a few seconds.
        setTimeout(() => setSyncState({ kind: 'idle' }), 4000);
        return;
      }
      const transitions = (j.sold ?? 0) + (j.ended ?? 0);
      setSyncState({ kind: 'done', transitions });
      // Refresh dashboard data so the user sees the new state immediately.
      await refreshAll();
      // Auto-dismiss the "done" pill after a few seconds.
      setTimeout(() => setSyncState({ kind: 'idle' }), 4000);
    } catch (e) {
      console.error('[Marketplace] sync-me failed', e);
      setSyncState({ kind: 'idle' });
    }
  }, [accessToken, refreshAll, stats?.activeCount, syncState.kind]);

  useEffect(() => {
    if (pageState !== 'marketplace') return;
    // Fire once when state first becomes marketplace. The effect re-runs
    // if pageState changes (which is fine; the rate limiter handles dupe calls).
    fireSyncMe();
    // We intentionally only depend on pageState here — adding fireSyncMe to
    // deps would cause the sync to refire each render due to its own deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageState]);

  const startBatch = useCallback(async () => {
    if (!accessToken || bulkSelection.length === 0) return;
    setStartingBatch(true);
    setBatchError(null);
    try {
      const res = await fetch('/api/ebay/bulk/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ cardIds: bulkSelection }),
      });
      if (res.status === 404) {
        // Two different 404s: the feature flag being off (a bare 'Not found',
        // deliberately indistinguishable from a route that does not exist) and
        // a real reason, like none of the selected cards being yours. Show the
        // reason when the body carries one.
        const body = await res.json().catch(() => ({} as any));
        const reason: unknown = body?.message ?? body?.error;
        setBatchError(
          typeof reason === 'string' && reason && reason !== 'Not found'
            ? reason
            : 'Bulk listing is not switched on for your account yet.'
        );
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.batchId) {
        setBatchError(json.error || 'Could not start the batch. Please try again.');
        return;
      }
      setBulkSelection([]);
      router.push(`/instalist-marketplace/bulk/${json.batchId}`);
    } catch {
      setBatchError('Could not start the batch. Please try again.');
    } finally {
      setStartingBatch(false);
    }
  }, [accessToken, bulkSelection, router]);

  /**
   * Relist an ended listing's card.
   *
   * The picker's card list is capped at the 2,000 most recent, so a card that
   * ended a listing months ago can be perfectly relistable and still not be in
   * `cards` — the old lookup simply did nothing in that case, and the button
   * looked broken. Fall back to the server search, and say so plainly when the
   * card really is gone (sold, deleted, or listed again elsewhere).
   */
  const relistCard = useCallback(async (listing: MarketplaceListing) => {
    setRelistError(null);
    const local = cards.find(c => c.id === listing.cardId);
    if (local) {
      setActiveTab('list');
      setModalCard(local);
      return;
    }
    try {
      const session = getStoredSession();
      if (!session?.access_token) throw new Error('no session');
      const res = await fetch(
        `/api/ebay/eligible-cards?q=${encodeURIComponent(listing.cardName ?? '')}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const json = res.ok ? await res.json() : null;
      const found: MarketplaceCard | undefined = (json?.cards ?? []).find(
        (c: MarketplaceCard) => c.id === listing.cardId
      );
      if (!found) throw new Error('not eligible');
      setActiveTab('list');
      setModalCard(found);
    } catch {
      setRelistError('This card is no longer available to relist.');
    }
  }, [cards]);

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
      // return_url must be /ebay-auth-success — that page is the only one that
      // posts the EBAY_AUTH_COMPLETE message this handler waits for. Pointing
      // the popup back at /instalist-marketplace would just render the whole
      // marketplace inside the popup and leave the parent stuck.
      const res = await fetch('/api/ebay/auth?return_url=/ebay-auth-success', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        throw new Error(`Couldn't start the eBay connection (HTTP ${res.status}). Try again.`);
      }
      const j = await res.json();
      // The route returns { authUrl }, not { url } — accept both for safety.
      const authUrl = j.authUrl || j.url;
      if (!authUrl) throw new Error("Couldn't get an eBay sign-in link. Please try again.");

      const popup = window.open(authUrl, 'ebay-oauth', 'width=600,height=750');
      if (!popup || popup.closed) {
        // Popup blocked. Give the user a direct link as a fallback so they
        // aren't stuck staring at an unresponsive button.
        setConnectError(
          "Your browser blocked the eBay sign-in popup. Allow popups for this site or open the link manually."
        );
        try { window.location.href = authUrl; } catch { /* navigation failure is non-fatal here */ }
        return;
      }

      const onMessage = (e: MessageEvent) => {
        // Origin check — only trust messages from our own window.
        // Otherwise a hostile site could spoof a "connected" signal.
        if (e.origin !== window.location.origin) return;
        if (e.data?.type === 'EBAY_AUTH_COMPLETE') {
          window.removeEventListener('message', onMessage);
          popup.close();
          if (e.data.success) {
            refreshAll();
          } else {
            setConnectError(e.data.message || 'Failed to connect your eBay account. Please try again.');
          }
        }
      };
      window.addEventListener('message', onMessage);

      // Safety: auto-detach the listener if the user closes the popup
      // without completing OAuth, so we don't leak handlers across attempts.
      const closeWatcher = window.setInterval(() => {
        if (popup.closed) {
          window.removeEventListener('message', onMessage);
          window.clearInterval(closeWatcher);
        }
      }, 1000);
    } catch (e: any) {
      const friendly = (e?.message && typeof e.message === 'string' && e.message.length < 200)
        ? e.message
        : 'Connection failed. Please try again.';
      setConnectError(friendly);
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
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">InstaList: Sell Your Graded Cards on eBay</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              List your graded cards on eBay and track performance.
            </p>
          </div>
          {/* Right-side controls — wrap on narrow screens so the pill chips
              don't overflow the header on phones <360px wide. */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {ebayUsername && (
              <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {ebayUsername === 'eBay User'
                  ? 'Connected to eBay'
                  : <>Connected as <strong>{ebayUsername}</strong></>}
              </span>
            )}
            <SyncStatusPill syncState={syncState} />
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

        {/* Batches sit above the tabs, not inside one: a running batch is the
            most time-sensitive thing on this page and the seller is as likely
            to be on My Listings watching it land. */}
        {bulkEnabled && <div className="mt-6"><BulkBatchesStrip token={accessToken} /></div>}

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
            <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
              Settings
            </TabButton>
          </nav>
        </div>

        {/* Tab content */}
        <div className="mt-6">
          {activeTab === 'list' && (
            <ListNewTab
              cards={cards}
              truncated={cardsTruncated}
              loading={!cardsLoaded}
              onSelectCard={setModalCard}
              bulkEnabled={bulkEnabled}
              selectedIds={bulkSelection}
              onSelectionChange={setBulkSelection}
              onStartBatch={startBatch}
              startingBatch={startingBatch}
              batchError={batchError}
              selectionLimit={MAX_BULK_ITEMS}
            />
          )}
          {activeTab === 'active' && (
            <MyListingsTab listings={listings.active} />
          )}
          {activeTab === 'sold' && (
            <SoldTab listings={listings.sold} />
          )}
          {activeTab === 'ended' && (
            <>
              {relistError && (
                <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900">
                  {relistError}
                </div>
              )}
              <EndedTab listings={listings.ended} onRelist={relistCard} />
            </>
          )}
          {/* Seller-level listing settings. Only the eBay business-policy
              opt-in lives here today; it is an account-wide choice, so it
              belongs beside the listings rather than inside one listing's
              stepper. */}
          {activeTab === 'settings' && (
            <div className="space-y-5">
              <EbayPolicySettings />
              <DisconnectPanel username={ebayUsername} onDisconnected={() => refreshAll()} />
            </div>
          )}
        </div>

        {/* Footer info section — keeps the value-prop visible to existing users */}
        <MarketplaceInfo variant="footer" />
      </div>

      {/* Listing modal — reuses the same EbayListingModal as the card-detail page.
          We pass the raw card record (snake_case + signed front/back URLs) so the
          modal's image generation + item-specifics logic finds the same field
          shape it sees from the card-detail flow. */}
      {modalCard && (
        <EbayListingModal
          isOpen={true}
          onClose={handleListingPublished}
          card={modalCard}
          cardType={categoryToCardType(modalCard.category)}
          labelStyle={labelStyle}
          customLabelConfig={activeConfig}
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

function SyncStatusPill({ syncState }: { syncState:
  | { kind: 'idle' }
  | { kind: 'syncing'; activeCount: number }
  | { kind: 'done'; transitions: number }
  | { kind: 'rate-limited'; retryAfterSec: number }
}) {
  if (syncState.kind === 'idle') return null;
  if (syncState.kind === 'syncing') {
    return (
      <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full">
        <span className="inline-block w-3 h-3 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
        Syncing {syncState.activeCount > 0 ? `${syncState.activeCount} listing${syncState.activeCount === 1 ? '' : 's'}` : 'listings'}&hellip;
      </span>
    );
  }
  if (syncState.kind === 'done') {
    if (syncState.transitions === 0) {
      return (
        <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full">
          <span className="text-emerald-600">&#10003;</span>
          Already up to date
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
        <span>&#10003;</span>
        Synced &middot; {syncState.transitions} status change{syncState.transitions === 1 ? '' : 's'}
      </span>
    );
  }
  // rate-limited
  return (
    <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full">
      Sync available again in {syncState.retryAfterSec}s
    </span>
  );
}

/**
 * Disconnect the eBay account. Moved out of the listing modal's footer, where
 * it sat one misclick from the Publish button — this is account state, so it
 * belongs on the Settings tab beside the other account-wide choice.
 *
 * Two-step inline, the same posture as EbayPolicySettings: never window.confirm.
 */
function DisconnectPanel({
  username,
  onDisconnected,
}: {
  username: string | null;
  onDisconnected: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = getStoredSession();
      if (!session?.access_token) throw new Error('no session');
      const res = await fetch('/api/ebay/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('failed');
      setConfirming(false);
      onDisconnected();
    } catch {
      setError('Could not disconnect. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <header className="p-4 border-b border-gray-200">
        <h2 className="text-base font-bold text-gray-900">Your eBay connection</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {username ? <>Connected as <strong>{username}</strong>.</> : 'Connected.'} Listings you
          have already published stay on eBay either way.
        </p>
      </header>
      <div className="p-4 space-y-3">
        {confirming ? (
          <div className="p-3 rounded-lg border border-red-200 bg-red-50 space-y-3">
            <p className="text-sm text-red-900">
              Disconnect this eBay account? DCM stops syncing your listings and you will have to
              sign in to eBay again before you can list anything else.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={disconnect}
                disabled={busy}
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? 'Disconnecting…' : 'Yes, disconnect'}
              </button>
              <button
                type="button"
                onClick={() => { setConfirming(false); setError(null); }}
                disabled={busy}
                className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                Keep it connected
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm text-gray-600 hover:text-red-700 font-semibold"
          >
            Disconnect eBay
          </button>
        )}
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    </section>
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
