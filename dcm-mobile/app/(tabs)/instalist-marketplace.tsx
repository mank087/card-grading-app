import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, BackHandler, Platform,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { type WebViewNavigation } from 'react-native-webview'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Colors } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'
import {
  fetchEligibleCards, fetchMarketplaceStats, fetchMyListings, triggerSyncMe,
  type EligibleCard, type MarketplaceStats, type MarketplaceListing,
} from '@/lib/marketplaceApi'
import { checkEbayStatus, getOAuthUrl, type EbayConnectionStatus } from '@/lib/ebayApi'
import { classifyEbayOAuthNavigation } from '@/lib/ebayOAuth'
import { createBatch, probeBulkAvailable, BulkApiError } from '@/lib/ebayBulkApi'
import { MAX_BULK_ITEMS } from '@/lib/ebayBulkTypes'

import StatsStrip from '@/components/marketplace/StatsStrip'
import SyncStatusPill, { type SyncState } from '@/components/marketplace/SyncStatusPill'
import InfoView from '@/components/marketplace/InfoView'
import CardPicker from '@/components/marketplace/CardPicker'
import ListingsTab from '@/components/marketplace/ListingsTab'
import IntroModal from '@/components/marketplace/IntroModal'
import BulkBatchesStrip from '@/components/marketplace/BulkBatchesStrip'
import OAuthModal from '@/components/marketplace/OAuthModal'

type PageState = 'loading' | 'guest' | 'no-cards' | 'connect' | 'marketplace' | 'error'
type TabId = 'list' | 'active' | 'sold' | 'ended'

const TABS: { id: TabId; label: string }[] = [
  { id: 'list', label: 'List a Card' },
  { id: 'active', label: 'My Listings' },
  { id: 'sold', label: 'Sold' },
  { id: 'ended', label: 'Ended' },
]

/**
 * Native InstaList Marketplace tab.
 *
 * Lives in (tabs)/ so it gets the standard tab chrome (AppHeaderBar +
 * bottom Tabs nav). Uses the same backend endpoints as the web
 * /instalist-marketplace page so mobile and web see identical data.
 *
 * Contains NO purchase UI. Any credit/subscription paths go through
 * pages/credits which already forks iOS native StoreKit IAP vs Android
 * Stripe-in-WebView. Don't add a "buy credits" CTA here.
 */
export default function InstalistMarketplaceTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user, session, isLoading: authLoading } = useAuth()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [cards, setCards] = useState<EligibleCard[]>([])
  const [cardsTruncated, setCardsTruncated] = useState(false)
  const [pickerSearchQuery, setPickerSearchQuery] = useState('')
  const [pickerSearchInFlight, setPickerSearchInFlight] = useState(false)

  const [stats, setStats] = useState<MarketplaceStats | null>(null)
  const [listings, setListings] = useState<{ active: MarketplaceListing[]; sold: MarketplaceListing[]; ended: MarketplaceListing[] }>({
    active: [], sold: [], ended: [],
  })

  const [ebayStatus, setEbayStatus] = useState<EbayConnectionStatus | null>(null)
  const [activeTab, setActiveTab] = useState<TabId | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // OAuth modal — reuses the same native WebView modal pattern as ebay-list.tsx.
  const [showOAuth, setShowOAuth] = useState(false)
  const [oauthUrl, setOauthUrl] = useState('')
  const [connecting, setConnecting] = useState(false)

  // Sync pill state
  const [syncState, setSyncState] = useState<SyncState>({ kind: 'idle' })
  const syncInFlight = useRef(false)

  // ─── Bulk listing ─────────────────────────────────────────────────────
  // There is no client feature flag on mobile, so availability is probed
  // (a cheap batches list; 404 = the server flag is off). False simply hides
  // every bulk affordance and leaves the single-card flow untouched.
  const [bulkAvailable, setBulkAvailable] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  /** Bumped once a batch is started — tells the picker to leave selection mode. */
  const [selectionResetKey, setSelectionResetKey] = useState(0)
  /**
   * Picking cards for a batch collapses everything above the list. The
   * connection row, stats, tab row and batches strip are all read-only here,
   * and together with the action bar they left a phone a few hundred pixels
   * for the one thing the seller is doing: scrolling their cards.
   */
  const [picking, setPicking] = useState(false)
  const [startingBatch, setStartingBatch] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)

  // ─── Hardware back on Android — only intercept for OAuth modal ────────
  // As a tab screen the default back behavior (exit app) is fine; we only
  // need to dismiss the OAuth modal cleanly when it's open.
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showOAuth) { setShowOAuth(false); return true }
      return false
    })
    return () => sub.remove()
  }, [showOAuth])

  // ─── Main data load ───────────────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    if (!session?.access_token) {
      setPageState('guest')
      return
    }
    setRefreshing(true)
    setErrorMessage(null)
    try {
      // Eligible cards first — they double as the "do you have cards?" check.
      // No query on the bulk refresh; server-side search uses a separate
      // fetch wired below via onSearchQueryChange.
      const cardsRes = await fetchEligibleCards()
      const totalGraded = cardsRes.cards.length + cardsRes.alreadyListedCount
      setCards(cardsRes.cards)
      setCardsTruncated(cardsRes.truncated ?? false)

      if (totalGraded === 0) {
        setPageState('no-cards')
        return
      }

      // eBay connection check
      const status = await checkEbayStatus().catch(() => null)
      setEbayStatus(status)
      if (!status?.connected) {
        setPageState('connect')
        return
      }

      // Fully provisioned — pull dashboard data. The bulk probe rides along
      // unawaited: it must never delay (or fail) the marketplace render.
      probeBulkAvailable().then(setBulkAvailable).catch(() => setBulkAvailable(false))

      const [statsRes, listingsRes] = await Promise.all([
        fetchMarketplaceStats(),
        fetchMyListings(),
      ])
      setStats(statsRes)
      setListings(listingsRes)
      setPageState('marketplace')
    } catch (e: any) {
      const msg = (e?.message && typeof e.message === 'string' && e.message.length < 200)
        ? e.message
        : "Something went wrong loading your marketplace. Please try again."
      setErrorMessage(msg)
      setPageState('error')
    } finally {
      setRefreshing(false)
    }
  }, [session?.access_token])

  // ─── On mount + when auth resolves ────────────────────────────────────
  useEffect(() => {
    if (authLoading) return
    refreshAll()
  }, [authLoading, refreshAll])

  // ─── Auto-refresh on focus — fires when returning from ebay-list.tsx ──
  // Skip the first run since the mount effect already covers it.
  const isFirstFocus = useRef(true)
  useFocusEffect(useCallback(() => {
    if (isFirstFocus.current) { isFirstFocus.current = false; return }
    if (pageState === 'marketplace') {
      refreshAll()
      fireSyncMe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageState]))

  // The picker reports selection mode on its own transitions, but it cannot
  // report one it never made: unmounted by a page-state change or a tab switch,
  // it left this screen collapsed with no way back. Collapsing is a view state,
  // so it is safe to drop whenever the picker is not on screen.
  useEffect(() => {
    if (pageState !== 'marketplace' || activeTab !== 'list') setPicking(false)
  }, [pageState, activeTab])

  // ─── Default tab selection once marketplace is provisioned ────────────
  // Always default to "List a Card" — that's the action-oriented entry
  // point users expect, even if they already have active listings to
  // monitor. They can switch to My Listings with one tap if that's
  // what they came for.
  useEffect(() => {
    if (pageState !== 'marketplace') return
    if (activeTab !== null) return
    setActiveTab('list')
  }, [pageState, activeTab])

  // ─── Picker server-side search — fires after the debounce in CardPicker
  const handlePickerSearchQueryChange = useCallback(async (q: string) => {
    setPickerSearchQuery(q)
    if (!session?.access_token) return
    setPickerSearchInFlight(true)
    try {
      const res = await fetchEligibleCards(q || undefined)
      setCards(res.cards)
      setCardsTruncated(res.truncated ?? false)
    } catch (e) {
      // Search failure shouldn't tear down the screen — just stop the spinner.
      console.warn('[marketplace] search failed', e)
    } finally {
      setPickerSearchInFlight(false)
    }
  }, [session?.access_token])

  // ─── On-demand sync ───────────────────────────────────────────────────
  const fireSyncMe = useCallback(async () => {
    if (syncInFlight.current) return
    syncInFlight.current = true
    setSyncState({ kind: 'syncing', activeCount: stats?.activeCount ?? 0 })
    try {
      const result = await triggerSyncMe()
      if (result.skipped && result.retryAfterSec) {
        setSyncState({ kind: 'rate-limited', retryAfterSec: result.retryAfterSec })
        setTimeout(() => setSyncState({ kind: 'idle' }), 4000)
        return
      }
      const transitions = result.transitions ?? 0
      setSyncState({ kind: 'done', transitions })
      if (transitions > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
        await refreshAll()
      }
      setTimeout(() => setSyncState({ kind: 'idle' }), 4000)
    } catch {
      setSyncState({ kind: 'idle' })
    } finally {
      syncInFlight.current = false
    }
  }, [refreshAll, stats?.activeCount])

  useEffect(() => {
    if (pageState !== 'marketplace') return
    fireSyncMe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageState])

  // ─── eBay OAuth — reuses the native modal pattern from ebay-list.tsx ──
  const startOAuth = useCallback(async () => {
    setConnecting(true)
    try {
      const url = await getOAuthUrl()
      setOauthUrl(url)
      setShowOAuth(true)
    } catch (err: any) {
      Alert.alert('Connection error', err?.message || 'Failed to start eBay sign-in. Please try again.')
    } finally {
      setConnecting(false)
    }
  }, [])

  const handleOAuthNavigation = useCallback((navState: WebViewNavigation) => {
    const result = classifyEbayOAuthNavigation(navState.url)
    if (result.type === 'pending') return
    setShowOAuth(false)
    if (result.type === 'success') {
      // Give the server a beat to persist the connection before re-checking.
      setTimeout(() => { refreshAll() }, 600)
    } else if (result.type === 'failure') {
      Alert.alert('eBay Connection Failed', result.message)
    } else {
      Alert.alert('eBay Connection Cancelled', 'You did not authorize the connection.')
    }
  }, [refreshAll])

  // ─── Pick a card to list → native ebay-list screen ────────────────────
  const handlePickCard = useCallback((card: EligibleCard) => {
    router.push({ pathname: '/pages/ebay-list', params: { cardId: card.id } })
  }, [router])

  // ─── Bulk selection + batch creation ──────────────────────────────────
  const toggleSelected = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
    setBatchError(null)
  }, [])

  /**
   * MERGE, never replace: the picker hands over only the cards to add (already
   * trimmed to the room left under the cap), so a hand-picked selection made
   * under an earlier search survives "Select all" under the next one.
   */
  const selectAllVisible = useCallback((ids: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const id of ids) {
        if (next.size >= MAX_BULK_ITEMS) break
        next.add(id)
      }
      return next
    })
    setBatchError(null)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setBatchError(null)
  }, [])

  const startBatch = useCallback(async () => {
    if (selectedIds.size === 0 || startingBatch) return
    setStartingBatch(true)
    setBatchError(null)
    try {
      // No settings: the server seeds the batch from the seller's saved
      // listing defaults, which is what they'd expect to get anyway.
      const result = await createBatch(Array.from(selectedIds))
      setSelectedIds(new Set())
      setSelectionResetKey(k => k + 1)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      // The route silently drops cards already listed on eBay (and ids that
      // aren't the seller's). Carried through so the batch screen can say why
      // it has fewer cards than were picked.
      router.push({
        pathname: '/pages/ebay-bulk',
        params: {
          batchId: result.batchId,
          skipped: String(result.skippedCount ?? 0),
          missing: String(result.missingCount ?? 0),
        },
      })
    } catch (err) {
      if (err instanceof BulkApiError) {
        // The routes author their own seller-facing copy; only the bare
        // feature-gate 404 ("Not found") needs translating into something a
        // seller can act on.
        setBatchError(
          err.status === 404 && err.body?.error === 'Not found'
            ? 'Bulk listing is not switched on for your account yet.'
            : err.message,
        )
      } else {
        setBatchError('Could not start the batch. Please try again.')
      }
    } finally {
      setStartingBatch(false)
    }
  }, [selectedIds, startingBatch, router])

  const handleRelist = useCallback((cardId: string) => {
    router.push({ pathname: '/pages/ebay-list', params: { cardId } })
  }, [router])

  // ─── Render ────────────────────────────────────────────────────────────

  if (authLoading || pageState === 'loading') {
    return (
      <View style={styles.screen}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.purple[600]} />
        </View>
      </View>
    )
  }

  if (pageState === 'guest') {
    return <View style={styles.screen}><InfoView variant="guest" /></View>
  }

  if (pageState === 'no-cards') {
    return <View style={styles.screen}><InfoView variant="no-cards" /></View>
  }

  if (pageState === 'connect') {
    return (
      <View style={styles.screen}>
        <InfoView variant="connect" onConnect={startOAuth} isConnecting={connecting} />
        <OAuthModal
          visible={showOAuth}
          url={oauthUrl}
          insets={insets.top}
          onClose={() => setShowOAuth(false)}
          onNavStateChange={handleOAuthNavigation}
        />
      </View>
    )
  }

  if (pageState === 'error') {
    return (
      <View style={styles.screen}>
        <InfoView variant="error" errorMessage={errorMessage ?? undefined} onRetry={refreshAll} />
      </View>
    )
  }

  // ───────────────── Full marketplace ─────────────────
  return (
    <View style={styles.screen}>
      {/* First-visit intro modal — auto-dismisses after first acknowledgment */}
      <IntroModal userId={user?.id} />

      {/* Connection chip + sync pill row */}
      {!picking && <View style={styles.subHeader}>
        {ebayStatus?.connection?.ebay_username && (
          <View style={styles.connectedChip}>
            <View style={styles.connectedDot} />
            <Text style={styles.connectedText} numberOfLines={1}>
              {ebayStatus.connection.ebay_username === 'eBay User'
                ? 'Connected to eBay'
                : `Connected as ${ebayStatus.connection.ebay_username}`}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <SyncStatusPill state={syncState} />
      </View>}

      {/* Stats strip */}
      {!picking && <View style={styles.statsWrap}>
        <StatsStrip stats={stats} loading={refreshing && !stats} />
      </View>}

      {/* Tab segmented control */}
      {!picking && <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsRow}
        contentContainerStyle={styles.tabsRowContent}
      >
        {TABS.map(t => {
          const active = activeTab === t.id
          const badge = t.id === 'active' ? stats?.activeCount
            : t.id === 'sold' ? stats?.soldCount
            : t.id === 'ended' ? stats?.endedCount
            : undefined
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {})
                setActiveTab(t.id)
              }}
              style={[styles.tab, active && styles.tabActive]}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${t.label} tab`}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              {badge != null && badge > 0 && (
                <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>}

      {/* Active tab content */}
      <View style={styles.tabContent}>
        {activeTab === 'list' && (
          <>
            {bulkAvailable && !picking && <BulkBatchesStrip />}
            <CardPicker
              cards={cards}
              truncated={cardsTruncated}
              searchInFlight={pickerSearchInFlight}
              onSelect={handlePickCard}
              onRefresh={refreshAll}
              refreshing={refreshing}
              onSearchQueryChange={handlePickerSearchQueryChange}
              selectable={bulkAvailable}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelected}
              selectionLimit={MAX_BULK_ITEMS}
              onSelectAllVisible={selectAllVisible}
              onClearSelection={clearSelection}
              selectionResetKey={selectionResetKey}
              onSelectionModeChange={setPicking}
            />
            {batchError && (
              <View style={styles.batchErrorBanner}>
                <Text style={styles.batchErrorText}>{batchError}</Text>
              </View>
            )}
            {selectedIds.size > 0 && (
              // The Tabs bar below already pads the home indicator; padding it
              // again here left a band of dead white under the button.
              <View style={styles.batchBar}>
                <TouchableOpacity
                  style={[styles.batchBtn, startingBatch && styles.batchBtnDisabled]}
                  onPress={startBatch}
                  disabled={startingBatch}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`List ${selectedIds.size} selected cards on eBay`}
                >
                  {startingBatch
                    ? <ActivityIndicator size="small" color={Colors.white} />
                    : <Ionicons name="pricetags" size={18} color={Colors.white} />}
                  <Text style={styles.batchBtnText}>
                    {startingBatch
                      ? 'Preparing…'
                      : `List ${selectedIds.size} card${selectedIds.size === 1 ? '' : 's'}`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        {activeTab === 'active' && (
          <ListingsTab
            mode="active"
            listings={listings.active}
            refreshing={refreshing}
            onRefresh={() => { refreshAll(); fireSyncMe() }}
          />
        )}
        {activeTab === 'sold' && (
          <ListingsTab
            mode="sold"
            listings={listings.sold}
            refreshing={refreshing}
            onRefresh={() => { refreshAll(); fireSyncMe() }}
          />
        )}
        {activeTab === 'ended' && (
          <ListingsTab
            mode="ended"
            listings={listings.ended}
            refreshing={refreshing}
            onRefresh={() => { refreshAll(); fireSyncMe() }}
            onRelist={handleRelist}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray[50] },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  subHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4,
  },
  connectedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.green[50],
    borderColor: Colors.green[100], borderWidth: 1,
    borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10,
    maxWidth: '60%',
  },
  connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green[500] },
  connectedText: { fontSize: 11, fontWeight: '600', color: Colors.green[600] },

  statsWrap: { paddingHorizontal: 12, marginTop: 4 },

  tabsRow: { maxHeight: 44, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[200] },
  tabsRowContent: { paddingHorizontal: 8, alignItems: 'center', height: 44, gap: 4 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
    height: '100%',
  },
  tabActive: { borderBottomColor: Colors.purple[600] },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.gray[500] },
  tabTextActive: { color: Colors.purple[700] },
  tabBadge: {
    minWidth: 18, paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: Colors.gray[100],
    alignItems: 'center', justifyContent: 'center',
  },
  tabBadgeActive: { backgroundColor: Colors.purple[100] },
  tabBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.gray[600] },
  tabBadgeTextActive: { color: Colors.purple[700] },

  tabContent: { flex: 1 },

  batchErrorBanner: {
    backgroundColor: Colors.red[50],
    borderTopWidth: 1, borderTopColor: Colors.red[100],
    paddingHorizontal: 12, paddingVertical: 8,
  },
  batchErrorText: { fontSize: 12, color: Colors.red[700], lineHeight: 17 },
  batchBar: {
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.gray[200],
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12,
  },
  batchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.purple[600],
    borderRadius: 12, paddingVertical: 14,
  },
  batchBtnDisabled: { opacity: 0.6 },
  batchBtnText: { fontSize: 15, fontWeight: '800', color: Colors.white },
})
