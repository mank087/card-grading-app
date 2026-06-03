import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, Alert, BackHandler, Platform,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { WebView, type WebViewNavigation } from 'react-native-webview'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { Colors } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'
import {
  fetchEligibleCards, fetchMarketplaceStats, fetchMyListings, triggerSyncMe,
  type EligibleCard, type MarketplaceStats, type MarketplaceListing,
} from '@/lib/marketplaceApi'
import { checkEbayStatus, getOAuthUrl, type EbayConnectionStatus } from '@/lib/ebayApi'

import StatsStrip from '@/components/marketplace/StatsStrip'
import SyncStatusPill, { type SyncState } from '@/components/marketplace/SyncStatusPill'
import InfoView from '@/components/marketplace/InfoView'
import CardPicker from '@/components/marketplace/CardPicker'
import ListingsTab from '@/components/marketplace/ListingsTab'
import IntroModal from '@/components/marketplace/IntroModal'

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

      // Fully provisioned — pull dashboard data
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
    if (navState.url.includes('/ebay-auth-success')) {
      setShowOAuth(false)
      setTimeout(() => { refreshAll() }, 600)
    } else if (navState.url.includes('error=')) {
      setShowOAuth(false)
      Alert.alert('Connection failed', 'eBay sign-in was cancelled or rejected. Please try again.')
    }
  }, [refreshAll])

  // ─── Pick a card to list → native ebay-list screen ────────────────────
  const handlePickCard = useCallback((card: EligibleCard) => {
    router.push({ pathname: '/pages/ebay-list', params: { cardId: card.id } })
  }, [router])

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
      <View style={styles.subHeader}>
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
      </View>

      {/* Stats strip */}
      <View style={styles.statsWrap}>
        <StatsStrip stats={stats} loading={refreshing && !stats} />
      </View>

      {/* Tab segmented control */}
      <ScrollView
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
      </ScrollView>

      {/* Active tab content */}
      <View style={styles.tabContent}>
        {activeTab === 'list' && (
          <CardPicker
            cards={cards}
            truncated={cardsTruncated}
            searchInFlight={pickerSearchInFlight}
            onSelect={handlePickCard}
            onRefresh={refreshAll}
            refreshing={refreshing}
            onSearchQueryChange={handlePickerSearchQueryChange}
          />
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

// ───────────────────── OAuth modal (extracted) ─────────────────────

function OAuthModal({
  visible, url, insets, onClose, onNavStateChange,
}: {
  visible: boolean
  url: string
  insets: number
  onClose: () => void
  onNavStateChange: (n: WebViewNavigation) => void
}) {
  if (!url) return null
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.oauthHeader, { paddingTop: insets + 6 }]}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
          <Ionicons name="close" size={26} color={Colors.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.oauthTitle}>Sign in to eBay</Text>
        <View style={{ width: 26 }} />
      </View>
      <WebView
        source={{ uri: url }}
        onNavigationStateChange={onNavStateChange}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.oauthLoading}>
            <ActivityIndicator size="large" color={Colors.purple[600]} />
          </View>
        )}
      />
    </Modal>
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

  oauthHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[200],
  },
  oauthTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray[900] },
  oauthLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
