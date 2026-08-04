import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, Modal, Pressable, Alert, Platform } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useResponsive } from '@/hooks/useResponsive'
import { useAuth } from '@/contexts/AuthContext'
import { Colors } from '@/lib/constants'
import BinderStrip from '@/components/BinderStrip'
import CardActionSheet from '@/components/CardActionSheet'
import MarkAsSoldModal from '@/components/MarkAsSoldModal'
import FilterSheet, { activeFilterCount, type MobileFilterState } from '@/components/FilterSheet'
import {
  listBinders, createBinder, getBinderCards, addCardsToBinder,
  removeCardsFromBinder, reorderBinderCard, getCardBinders,
  renameBinder, deleteBinder, type Binder,
} from '@/lib/bindersApi'
import GradeBadge from '@/components/ui/GradeBadge'
import SlabCard from '@/components/grading/SlabCard'
import { resolveHeritageBandColors } from '@/lib/heritage'
import { supabase, hasActiveSession } from '@/lib/supabase'
import { getDisplayName, getContextLine, getFeatures } from '@/lib/labelData'
import { resolveCardValue } from '@/lib/resolveCardValue'
import { useLabelStyle } from '@/hooks/useLabelStyle'
import LabelStylePicker from '@/components/labels/LabelStylePicker'
import SlabLabelOptionsSheet from '@/components/labels/SlabLabelOptionsSheet'
import ExportRunner, { type ExportSource } from '@/components/exports/ExportRunner'

// Star Wars was retired as a top-level category and is now an "Other" sub-category.
const CATEGORIES = ['All', 'Sports', 'Pokemon', 'MTG', 'Lorcana', 'One Piece', 'Yu-Gi-Oh', 'Other']

// Sports cards land in the database tagged with the specific sport
// detected at grading time (Football, Baseball, etc.) — the generic
// "Sports" bucket is only used as a fallback. The Sports filter at the
// top of Collection expands to all of these so the user sees their
// entire sports collection in one place. Tapping a specific sport in
// the sub-row then narrows further.
const SPORTS_CATEGORIES = ['Sports', 'Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling'] as const
const SORT_OPTIONS = [
  { value: 'created_at', label: 'Date' },
  { value: 'conversational_whole_grade', label: 'Grade' },
  { value: 'card_name', label: 'Name' },
  { value: 'dcm_price_estimate', label: 'Value' },
]

interface CardItem {
  id: string
  serial: string
  card_name: string | null
  featured: string | null
  category: string
  card_set: string | null
  card_number: string | null
  release_date: string | null
  manufacturer_name: string | null
  conversational_whole_grade: number | null
  conversational_condition_label: string | null
  conversational_card_info: any
  front_path: string
  front_url?: string
  created_at: string
  ebay_price_median: number | null
  dcm_price_estimate: number | null
  // Extra price-resolver fields so resolveCardValue can fall through to
  // legacy DCM cache or MTG-foil Scryfall data when dcm_price_estimate is
  // missing — keeps mobile prices matching web prices for the same card.
  dcm_cached_prices: { estimatedValue?: number | null } | null
  scryfall_price_usd: number | null
  scryfall_price_usd_foil: number | null
  is_foil: boolean | null
  visibility: string | null
}

export default function CollectionScreen() {
  const { session } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useResponsive()
  // Target ~200px per grid item — gives 2 cols on phone, 3 on iPad
  // portrait, 5 on iPad landscape / Pro portrait, 6 on iPad Pro 12.9
  // landscape. Min 2 so phones never collapse to 1 column.
  const gridColumns = Math.max(2, Math.floor(screenWidth / 200))
  const { labelStyle, customStyles, colorOverrides, switchStyle } = useLabelStyle()
  const [cards, setCards] = useState<CardItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [category, setCategory] = useState('All')
  // When the Sports filter is active, sub-row lets the user narrow to a
  // single sport (e.g., just Football). null = show all sports cards.
  // Always reset to null when the top-level category changes — see the
  // pickCategory handler below.
  const [subSport, setSubSport] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // ---- Multi-select + batch printing ----------------------------------
  // Long-press a card to enter selection mode; then tap toggles selection.
  // Tap-out-of-mode behavior preserved (single tap navigates to /card/[id]).
  // Bottom action bar appears when at least one card is selected.
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ---- Binders + ownership view ---------------------------------------
  // `ownershipView` mirrors the web tabs: what you hold vs what you've sold.
  // `selectedBinderId` null = All Cards (never manually ordered).
  const [ownershipView, setOwnershipView] = useState<'owned' | 'sold'>('owned')
  const [binders, setBinders] = useState<Binder[]>([])
  const [bindersAvailable, setBindersAvailable] = useState(false)
  const [selectedBinderId, setSelectedBinderId] = useState<string | null>(null)
  const [binderCards, setBinderCards] = useState<CardItem[] | null>(null)
  const [binderReorderable, setBinderReorderable] = useState(false)
  // Long-press sheet
  const [sheetCard, setSheetCard] = useState<CardItem | null>(null)
  const [sheetMemberOf, setSheetMemberOf] = useState<Set<string>>(new Set())
  const [sheetBusy, setSheetBusy] = useState(false)
  const [newBinderOpen, setNewBinderOpen] = useState(false)
  const [newBinderName, setNewBinderName] = useState('')
  const [newBinderFor, setNewBinderFor] = useState<string[]>([])
  // Bulk "add selected cards to a binder" picker
  const [binderPickerOpen, setBinderPickerOpen] = useState(false)
  // Rename / delete the selected binder
  const [manageOpen, setManageOpen] = useState(false)
  const [manageName, setManageName] = useState('')
  const [confirmDeleteBinder, setConfirmDeleteBinder] = useState(false)
  // Card being marked sold from the long-press sheet
  const [sellCard, setSellCard] = useState<CardItem | null>(null)
  const [sellBusy, setSellBusy] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  // Counts for the scope chips. Head-only queries, so no rows come back.
  const [ownedCount, setOwnedCount] = useState(0)
  const [soldCount, setSoldCount] = useState(0)
  const [batchSheetOpen, setBatchSheetOpen] = useState<null | 'print' | 'reports'>(null)
  // Batch slab label options sheet — opened when user picks the single
  // "Graded Slab Label" entry from the batch print menu. Mirrors the
  // single-card flow from card/[id].tsx so style + format selection
  // works the same way for one card or many.
  const [slabOptionsOpen, setSlabOptionsOpen] = useState(false)
  // Avery sheet variants:
  //   avery6871        — one-touch (Avery 6871) — 18 labels per page (3×6),
  //                      one label per card.
  //   avery8167-pairs  — toploader front+back (Avery 8167) — 40 CARD slots
  //                      per page (2×20), each card occupies TWO physical
  //                      labels side-by-side (front | back). Position picked
  //                      is the card index, not the label index — matches
  //                      generateToploaderLabelSheetMultiPage's cardsPerPage
  //                      = 40 contract.
  //   avery8167        — fold-over toploader (Avery 8167) — 80 single labels
  //                      per page (4×20), one label per card.
  const [positionPicker, setPositionPicker] = useState<null | { type: string; sheet: 'avery6871' | 'avery8167-pairs' | 'avery8167'; format?: 'duplex' | 'foldover' }>(null)
  const [pickerStartPosition, setPickerStartPosition] = useState(0)
  // Drives the hidden-WebView ExportRunner that receives generated files
  // via postMessage. Used by openBatchDownload on both platforms — Android
  // used to route through WebBrowser.openBrowserAsync, but App Links
  // verification (2026-05-22) made the OS intercept those URLs back into
  // the app, breaking the flow. The in-app WebView avoids that.
  const [exportSource, setExportSource] = useState<ExportSource | null>(null)

  const enterSelectionMode = useCallback((firstId?: string) => {
    setSelectionMode(true)
    if (firstId) setSelectedIds(new Set([firstId]))
  }, [])
  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }, [])
  const toggleSelected = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  // Cache key is per-user so different accounts on the same device don't
  // collide.
  const cacheKey = session?.user?.id ? `dcm_collection_cache_${session.user.id}` : null

  // Hydrate from AsyncStorage on first mount so users see their cards
  // immediately while the network fetch happens in the background. Also
  // means the collection survives going offline (fetch may fail, but
  // the cached cards still render).
  useEffect(() => {
    if (!cacheKey) return
    // AsyncStorage on Android can throw under memory pressure (storage
    // module process unavailable, disk full, etc.). A bare .then() with
    // no catch leaves that as an unhandled promise rejection, which RN
    // surfaces as a redbox in dev and a Sentry crash in production.
    // Treat any failure as "no cache" and fall through to the network fetch.
    AsyncStorage.getItem(cacheKey)
      .then(raw => {
        if (!raw) return
        try {
          const parsed = JSON.parse(raw)
          if (parsed?.cards && Array.isArray(parsed.cards)) {
            setCards(parsed.cards)
            setIsLoading(false)
          }
        } catch { /* ignore corrupt cache */ }
      })
      .catch(err => { console.warn('[collection] cache hydrate failed:', err?.message) })
  }, [cacheKey])

  const fetchCollection = useCallback(async () => {
    if (!session?.user?.id) return
    // cards denies anon (RLS): skip until the client has its token attached,
    // otherwise the request goes out as anon and fails with 42501.
    if (!(await hasActiveSession())) return
    setFetchError(null)
    try {
      // Ownership filter: sold cards leave the collection (their grade page
      // stays online for the buyer) and soft-deleted ones are hidden entirely.
      // `applyOwnership` off = pre-migration fallback so an app build that
      // ships ahead of the schema still lists cards.
      const runQuery = (applyOwnership: boolean) => {
        let q = supabase
        .from('cards')
        .select(`
          id, serial, card_name, featured, category, sub_category, card_set,
          card_number, release_date, manufacturer_name, visibility,
          rookie_card, autographed, serial_numbering,
          conversational_whole_grade, conversational_condition_label,
          conversational_card_info, front_path,
          ebay_price_median, dcm_price_estimate,
          dcm_cached_prices, scryfall_price_usd, scryfall_price_usd_foil, is_foil,
          created_at
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1000)
        if (applyOwnership) q = q.eq('ownership_status', ownershipView).is('deleted_at', null)
        return q
      }

      let { data, error } = await runQuery(true)
      if (error && (error as any).code === '42703') {
        console.warn('[collection] ownership columns missing — listing all cards')
        ;({ data, error } = await runQuery(false))
      }

      if (error) throw error

      if (data && data.length > 0) {
        const paths = data.map(c => c.front_path).filter(Boolean)
        if (paths.length > 0) {
          // Check both the destructured error AND the urls array — a network
          // hiccup here used to silently leave every card with a null
          // front_url and an empty placeholder. Warn so the issue shows up
          // in Sentry, and fall through with whatever URLs we did get.
          const { data: urls, error: signErr } = await supabase.storage.from('cards').createSignedUrls(paths, 3600)
          if (signErr) {
            console.warn('[collection] createSignedUrls failed:', signErr.message)
          }
          const urlMap = new Map<string, string>()
          urls?.forEach(u => { if (u.signedUrl && u.path) urlMap.set(u.path, u.signedUrl) })
          data.forEach((c: any) => { c.front_url = urlMap.get(c.front_path) || null })
        }
      }

      setCards(data || [])

      // Persist to AsyncStorage so the next cold start can render instantly
      // from cache while the fresh fetch runs, and so we have something to
      // show when the user is offline. Only cache the fields needed for
      // list/grid rendering — front_url is a 1h-TTL signed URL anyway.
      if (cacheKey && data) {
        try {
          await AsyncStorage.setItem(cacheKey, JSON.stringify({
            cards: data,
            cachedAt: Date.now(),
          }))
        } catch { /* ignore quota errors */ }
      }
    } catch (err: any) {
      console.error('Collection fetch error:', err)
      // Surface the failure with a retry CTA instead of leaving the user
      // staring at a perpetual spinner or an empty "No cards" state when
      // the network is the actual problem.
      setFetchError(err?.message || 'Could not load your collection.')
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [session?.user?.id, ownershipView])

  useEffect(() => { fetchCollection() }, [fetchCollection])

  const onRefresh = () => { setRefreshing(true); fetchCollection(); refreshBinders() }

  // ---- Binders --------------------------------------------------------

  /** Owned/sold counts for the scope chips — head-only, no rows transferred. */
  const refreshCounts = useCallback(async () => {
    if (!session?.user?.id) return
    try {
      const [owned, sold] = await Promise.all(
        (['owned', 'sold'] as const).map(status =>
          supabase.from('cards').select('id', { count: 'exact', head: true })
            .eq('user_id', session.user.id).is('deleted_at', null).eq('ownership_status', status)
        )
      )
      setOwnedCount(owned.count ?? 0)
      setSoldCount(sold.count ?? 0)
    } catch { /* chips just render without counts */ }
  }, [session?.user?.id])

  useEffect(() => { refreshCounts() }, [refreshCounts, cards.length])

  const refreshBinders = useCallback(async () => {
    if (!session?.user?.id) return
    const { binders: list, available } = await listBinders()
    setBinders(list)
    setBindersAvailable(available)
  }, [session?.user?.id])

  useEffect(() => { refreshBinders() }, [refreshBinders])

  /** Load the selected binder's cards, in the user's order. */
  const loadBinderCards = useCallback(async (binderId: string | null) => {
    if (!binderId) { setBinderCards(null); return }
    try {
      const { cards: list, reorderable } = await getBinderCards(binderId)
      setBinderCards(list as CardItem[])
      setBinderReorderable(reorderable)
    } catch (e: any) {
      Alert.alert('Could not open binder', e?.message || 'Please try again.')
      setBinderCards([])
    }
  }, [])

  useEffect(() => { loadBinderCards(selectedBinderId) }, [selectedBinderId, loadBinderCards])

  const selectedBinder = binders.find(b => b.id === selectedBinderId) || null

  const filterState: MobileFilterState = { category, subSport, sortBy, sortAsc, ownershipView }
  const activeFilters = activeFilterCount(filterState, Boolean(selectedBinderId))

  /** Open the long-press sheet, pre-loading which binders hold this card. */
  const openSheet = useCallback(async (card: CardItem) => {
    setSheetCard(card)
    setSheetMemberOf(new Set())
    const ids = await getCardBinders(card.id)
    setSheetMemberOf(new Set(ids))
  }, [])

  const sheetToggleBinder = async (binderId: string) => {
    if (!sheetCard) return
    const inIt = sheetMemberOf.has(binderId)
    const binder = binders.find(b => b.id === binderId)
    setSheetBusy(true)
    setSheetMemberOf(prev => {
      const next = new Set(prev)
      if (inIt) next.delete(binderId); else next.add(binderId)
      return next
    })
    try {
      if (inIt) await removeCardsFromBinder(binderId, [sheetCard.id])
      else await addCardsToBinder(binderId, [sheetCard.id])
      await refreshBinders()
      if (selectedBinderId === binderId) await loadBinderCards(binderId)
    } catch (e: any) {
      setSheetMemberOf(prev => {
        const next = new Set(prev)
        if (inIt) next.add(binderId); else next.delete(binderId)
        return next
      })
      Alert.alert(`Could not update ${binder?.name ?? 'binder'}`, e?.message || 'Please try again.')
    } finally { setSheetBusy(false) }
  }

  /**
   * Step a card through the binder order. Uses the same "put this after that
   * card" API the web drag uses, so ordering lives in one place on the server.
   */
  const sheetMove = async (to: 'top' | 'up' | 'down' | 'bottom') => {
    if (!sheetCard || !selectedBinderId || !binderCards) return
    const list = binderCards
    const i = list.findIndex(c => c.id === sheetCard.id)
    if (i === -1) return

    let afterId: string | null
    if (to === 'top') afterId = null
    else if (to === 'up') afterId = i >= 2 ? list[i - 2].id : null
    else if (to === 'down') afterId = list[i + 1]?.id ?? null
    else afterId = list[list.length - 1]?.id ?? null
    if (to === 'bottom' && afterId === sheetCard.id) return

    const without = list.filter(c => c.id !== sheetCard.id)
    const at = afterId === null ? 0 : without.findIndex(c => c.id === afterId) + 1
    const next = [...without.slice(0, at), sheetCard, ...without.slice(at)]

    setSheetBusy(true)
    setBinderCards(next)  // optimistic so "3 of 12" updates instantly
    try {
      await reorderBinderCard(selectedBinderId, sheetCard.id, afterId)
    } catch (e: any) {
      setBinderCards(list)
      Alert.alert('Could not reorder', e?.message || 'Please try again.')
    } finally { setSheetBusy(false) }
  }

  const sheetRemoveFromBinder = async () => {
    if (!sheetCard || !selectedBinderId) return
    setSheetBusy(true)
    try {
      await removeCardsFromBinder(selectedBinderId, [sheetCard.id])
      setBinderCards(prev => (prev ?? []).filter(c => c.id !== sheetCard.id))
      await refreshBinders()
      setSheetCard(null)
    } catch (e: any) {
      Alert.alert('Could not remove', e?.message || 'Please try again.')
    } finally { setSheetBusy(false) }
  }

  const confirmNewBinder = async () => {
    const name = newBinderName.trim()
    if (!name) return
    setSheetBusy(true)
    try {
      const b = await createBinder(name)
      if (newBinderFor.length) await addCardsToBinder(b.id, newBinderFor)
      await refreshBinders()
      setNewBinderOpen(false)
      setNewBinderName('')
      setNewBinderFor([])
      setSheetCard(null)
      setSelectedIds(new Set())
      setSelectionMode(false)
    } catch (e: any) {
      Alert.alert('Could not create binder', e?.message || 'Please try again.')
    } finally { setSheetBusy(false) }
  }

  // Filter + sort + search
  const filteredCards = useMemo(() => {
    // Inside a binder the source is the binder's cards, already in the user's
    // order; everything downstream (category, search, sort) then works within
    // that scope exactly as it does for All Cards.
    //
    // The ownership tab has to be applied HERE for binders: the binder endpoint
    // returns every card regardless of owned/sold, and switching tabs only
    // refetches the main list — so inside a binder the Sold tab did nothing.
    let result = selectedBinderId
      ? (binderCards ?? []).filter(c => ((c as any).ownership_status ?? 'owned') === ownershipView)
      : cards

    // Category filter. "Sports" expands across every sport-specific
    // category present in the user's collection; a sub-sport narrows
    // within that. Any other top-level category is a literal match.
    if (category === 'Sports') {
      const sportsSet: ReadonlySet<string> = subSport
        ? new Set([subSport])
        : new Set(SPORTS_CATEGORIES)
      result = result.filter(c => sportsSet.has(c.category || ''))
    } else if (category !== 'All') {
      result = result.filter(c => c.category === category)
    }

    // Search (across multiple fields)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(c => {
        const ci = c.conversational_card_info
        return (c.card_name || '').toLowerCase().includes(q) ||
          (c.featured || '').toLowerCase().includes(q) ||
          (c.serial || '').toLowerCase().includes(q) ||
          (c.card_set || '').toLowerCase().includes(q) ||
          (c.card_number || '').toLowerCase().includes(q) ||
          (c.release_date || '').toLowerCase().includes(q) ||
          (c.manufacturer_name || '').toLowerCase().includes(q) ||
          (c.category || '').toLowerCase().includes(q) ||
          (ci?.card_name || '').toLowerCase().includes(q) ||
          (ci?.player_or_character || '').toLowerCase().includes(q)
      })
    }

    // Sort
    result = [...result].sort((a, b) => {
      let va: any = (a as any)[sortBy]
      let vb: any = (b as any)[sortBy]
      if (va == null) va = sortAsc ? Infinity : -Infinity
      if (vb == null) vb = sortAsc ? Infinity : -Infinity
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return sortAsc ? -1 : 1
      if (va > vb) return sortAsc ? 1 : -1
      return 0
    })

    return result
  }, [cards, binderCards, selectedBinderId, ownershipView, category, subSport, search, sortBy, sortAsc])

  // Sports actually present in the user's collection, with per-sport
  // counts. Powers the sub-row that appears under the category tabs
  // when "Sports" is the active filter. Built off the unfiltered card
  // list so the counts reflect the whole collection, not the currently
  // narrowed view.
  const sportsInCollection = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of cards) {
      const cat = c.category || ''
      if ((SPORTS_CATEGORIES as readonly string[]).includes(cat)) {
        counts.set(cat, (counts.get(cat) || 0) + 1)
      }
    }
    // Sort by count descending so the user's most-graded sport leads.
    return Array.from(counts.entries())
      .map(([sport, count]) => ({ sport, count }))
      .sort((a, b) => b.count - a.count)
  }, [cards])
  const totalSportsCount = useMemo(
    () => sportsInCollection.reduce((sum, s) => sum + s.count, 0),
    [sportsInCollection],
  )

  // Reset subSport whenever the top-level category changes so the sub-
  // row never leaks state from a previous Sports visit.
  const pickCategory = useCallback((next: string) => {
    setCategory(next)
    if (next !== 'Sports') setSubSport(null)
  }, [])

  // Select-all toggles between selecting every visible (filtered) card and
  // clearing — same UX as web's collection toolbar.
  const allFilteredSelected = filteredCards.length > 0 && filteredCards.every(c => selectedIds.has(c.id))
  const selectAllToggle = useCallback(() => {
    if (allFilteredSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredCards.map(c => c.id)))
    }
  }, [filteredCards, allFilteredSelected])

  // Open the batch download URL on the web in an in-app browser. Mirrors
  // the single-card pattern in label-studio.tsx + card/[id].tsx — same
  // download UX (file lands in device Downloads via the browser's native
  // download manager).
  const openBatchDownload = useCallback(async (
    type: string,
    opts?: { format?: 'duplex' | 'foldover'; positions?: number[]; customConfig?: string }
  ) => {
    if (!session?.access_token) { Alert.alert('Not signed in'); return }
    if (selectedIds.size === 0) { Alert.alert('Select cards first'); return }
    // Batch size limits — full reports run heavier than labels (per-card
    // pages with images + react-pdf rendering). Match the server-side cap
    // in /label-export/batch (100) and warn earlier for full reports.
    const fullReportCap = 50
    const labelCap = 100
    const cap = type === 'full-report' ? fullReportCap : labelCap
    if (selectedIds.size > cap) {
      Alert.alert(
        'Too many cards',
        `${type === 'full-report' ? 'Full reports' : 'Labels'} are capped at ${cap} cards per batch (you selected ${selectedIds.size}). Try a smaller selection or split into multiple batches.`,
      )
      return
    }
    const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'
    const cardIds = Array.from(selectedIds).join(',')
    const params = new URLSearchParams()
    params.set('token', session.access_token)
    params.set('cardIds', cardIds)
    params.set('type', type)
    if (opts?.format) params.set('format', opts.format)
    if (opts?.positions && opts.positions.length > 0) params.set('positions', opts.positions.join(','))
    // customConfig is a base64 JSON CustomLabelConfig — only set for
    // type='slab-custom' when the user picked a specific custom-N style
    // from the SlabLabelOptionsSheet. The web batch handler decodes it
    // and applies the colors/gradient/border to every selected card.
    if (opts?.customConfig) params.set('customConfig', opts.customConfig)

    // Both iOS and Android: load /label-export/batch in a hidden WebView via
    // ExportRunner. The page detects ReactNativeWebView and posts files back
    // as base64, which we save locally and surface via Sharing.shareAsync /
    // Print.printAsync from the preview modal.
    //
    // Android used to use WebBrowser.openBrowserAsync(url, ...) here, but
    // after enabling Android App Links verification (2026-05-22), Android
    // intercepts all https://dcmgrading.com/* URLs and routes them back into
    // the DCM app — which has no /label-export route, so expo-router
    // rendered +not-found ("the screen doesn't exist"). The in-app WebView
    // sidesteps that by loading the URL internally instead of asking the
    // OS to handle it externally.
    const urlNoDownload = `${API_BASE}/label-export/batch?${params.toString()}`
    const title = type === 'full-report' ? 'Full Reports'
      : type === 'mini-report-pdf' ? 'Mini-Reports (PDF)'
      : type === 'mini-report' ? 'Mini-Reports'
      : type.startsWith('card-image') ? 'Card Images'
      : type === 'onetouch' ? 'One-Touch Labels'
      : type === 'toploader' ? 'Toploader Labels'
      : type === 'foldover' ? 'Fold-Over Labels'
      : 'Slab Labels'
    setTimeout(() => setExportSource({ url: urlNoDownload, title }), 350)
  }, [session?.access_token, selectedIds])

  // Avery types need a starting position. Mirrors the single-card position
  // picker on the card detail page; cards beyond the start auto-fill in
  // sheet order (overflow paginates automatically — see Phase 4 in plan).
  const buildSequentialPositions = useCallback((start: number) => {
    const n = selectedIds.size
    return Array.from({ length: n }, (_, i) => start + i)
  }, [selectedIds.size])

  // Stats — uses the shared resolveCardValue so the totals here match
  // what /market-pricing and the card-detail screen show for the same
  // collection. Previously only dcm_price_estimate + ebay_price_median
  // were consulted, so cards priced via the legacy dcm_cached_prices
  // blob or Scryfall came up as $0 on mobile but >$0 on web.
  const stats = useMemo(() => {
    const graded = cards.filter(c => c.conversational_whole_grade != null)
    const resolved = cards.map(c => ({ c, r: resolveCardValue(c) }))
    const withPrice = resolved.filter(({ r }) => r.source !== 'none')
    const totalValue = withPrice.reduce((sum, { r }) => sum + r.value, 0)
    const avgGrade = graded.length > 0 ? graded.reduce((sum, c) => sum + (c.conversational_whole_grade || 0), 0) / graded.length : 0
    return { total: cards.length, graded: graded.length, totalValue, avgGrade, priced: withPrice.length }
  }, [cards])

  // useCallback keeps these stable across re-renders so FlatList doesn't
  // see a new function reference on every parent render — matters for
  // scroll perf at 50+ rows.
  const renderListItem = useCallback(({ item }: { item: CardItem }) => {
    const name = getDisplayName(item as any)
    const contextParts = getContextLine(item as any)
    const featuresArr = getFeatures(item as any)
    const condition = item.conversational_condition_label || ''
    const price = resolveCardValue(item).value || null
    const isSelected = selectedIds.has(item.id)

    return (
      <TouchableOpacity
        style={[st.listItem, isSelected && st.listItemSelected]}
        onPress={() => {
          if (selectionMode) toggleSelected(item.id)
          else router.push(`/card/${item.id}`)
        }}
        // Long-press opens the action sheet (add to binder, reorder). The
        // sheet carries "Select multiple" so the old long-press-to-select
        // behaviour is still one tap away rather than gone.
        onLongPress={() => { if (bindersAvailable) openSheet(item); else enterSelectionMode(item.id) }}
        delayLongPress={350}
        activeOpacity={0.7}
        accessibilityLabel={`${name}, grade ${item.conversational_whole_grade ?? 'pending'}. ${selectionMode ? (isSelected ? 'Selected' : 'Not selected') : 'Tap to view details'}`}
        accessibilityRole="button"
        accessibilityState={selectionMode ? { selected: isSelected } : undefined}
        accessibilityHint={selectionMode ? 'Toggles card selection' : 'Long-press to enter multi-select mode'}
      >
        {selectionMode && (
          <View style={[st.checkbox, isSelected && st.checkboxOn]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
        )}
        {item.front_url ? (
          <Image source={item.front_url} style={st.listThumb} contentFit="cover" cachePolicy="disk" transition={150} />
        ) : (
          <View style={[st.listThumb, st.placeholder]}><Text style={st.placeholderText}>DCM</Text></View>
        )}
        <View style={st.listInfo}>
          <Text style={st.listName} numberOfLines={1}>{name}</Text>
          <Text style={st.listSet} numberOfLines={1}>{contextParts}</Text>
          {featuresArr.length > 0 && (
            <Text style={st.listFeatures} numberOfLines={1}>{featuresArr.join(' \u2022 ')}</Text>
          )}
          <View style={st.listMeta}>
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', flex: 1 }}>
              <Text style={st.listCategory}>{item.category}</Text>
              {condition ? <Text style={st.listCondition}>{condition}</Text> : null}
              {item.visibility === 'private' && <Ionicons name="eye-off" size={10} color={Colors.gray[400]} />}
            </View>
            {price ? <Text style={st.listPrice}>${price.toFixed(2)}</Text> : null}
          </View>
        </View>
        {item.conversational_whole_grade != null ? (
          <GradeBadge grade={item.conversational_whole_grade} size="sm" />
        ) : (
          <View style={st.pendingBadge}><Text style={st.pendingText}>Grading...</Text></View>
        )}
      </TouchableOpacity>
    )
  }, [selectionMode, selectedIds, toggleSelected, enterSelectionMode, router, bindersAvailable, openSheet])

  const renderGridItem = useCallback(({ item }: { item: CardItem }) => {
    const name = getDisplayName(item as any)
    const contextLine = getContextLine(item as any)
    const featuresArr = getFeatures(item as any)
    const isPublic = item.visibility === 'public'
    const price = resolveCardValue(item).value || null
    const isSelected = selectedIds.has(item.id)
    return (
      <TouchableOpacity
        style={[st.gridItem, isSelected && st.gridItemSelected]}
        onPress={() => {
          if (selectionMode) toggleSelected(item.id)
          else router.push(`/card/${item.id}`)
        }}
        // Long-press opens the action sheet (add to binder, reorder). The
        // sheet carries "Select multiple" so the old long-press-to-select
        // behaviour is still one tap away rather than gone.
        onLongPress={() => { if (bindersAvailable) openSheet(item); else enterSelectionMode(item.id) }}
        delayLongPress={350}
        activeOpacity={0.85}
        accessibilityLabel={`${name}, grade ${item.conversational_whole_grade ?? 'pending'}. ${selectionMode ? (isSelected ? 'Selected' : 'Not selected') : 'Tap to view details'}`}
        accessibilityRole="button"
        accessibilityState={selectionMode ? { selected: isSelected } : undefined}
        accessibilityHint={selectionMode ? 'Toggles card selection' : 'Long-press to enter multi-select mode'}
      >
        {selectionMode && (
          <View style={[st.checkbox, st.checkboxFloating, isSelected && st.checkboxOn]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
        )}
        <SlabCard
          imageUrl={item.front_url || null}
          displayName={name}
          contextLine={contextLine}
          features={featuresArr}
          serial={item.serial}
          grade={item.conversational_whole_grade}
          condition={item.conversational_condition_label || ''}
          size="sm"
          labelStyle={labelStyle}
          colorOverrides={colorOverrides}
          heritageBandColors={resolveHeritageBandColors((item as any).card_colors)}
        />
        {item.conversational_whole_grade == null && (
          <View style={st.gridPendingBadge}><Text style={st.gridPendingText}>Grading...</Text></View>
        )}
        <View style={st.gridBadgeRow}>
          <View style={[st.gridVisBadge, isPublic ? st.gridVisPublic : st.gridVisPrivate]}>
            <Ionicons
              name={isPublic ? 'globe-outline' : 'lock-closed'}
              size={10}
              color={isPublic ? Colors.green[600] : Colors.gray[600]}
            />
            <Text style={[st.gridVisText, { color: isPublic ? Colors.green[600] : Colors.gray[600] }]} numberOfLines={1}>
              {isPublic ? 'Public' : 'Private'}
            </Text>
          </View>
          {price != null && (
            <View style={st.gridPriceBadge}>
              <Ionicons name="pricetag" size={10} color={Colors.green[600]} />
              <Text style={st.gridPriceText} numberOfLines={1}>${price.toFixed(2)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }, [selectionMode, selectedIds, toggleSelected, enterSelectionMode, router, labelStyle, colorOverrides, bindersAvailable, openSheet])

  if (isLoading) {
    return <View style={st.loadingContainer}><ActivityIndicator size="large" color={Colors.purple[600]} /></View>
  }
  if (fetchError && cards.length === 0) {
    return (
      <View style={[st.loadingContainer, { padding: 24 }]}>
        <Ionicons name="cloud-offline-outline" size={64} color={Colors.gray[300]} />
        <Text style={[st.emptyTitle, { marginTop: 12 }]}>Couldn't load your collection</Text>
        <Text style={[st.emptySubtitle, { textAlign: 'center', marginBottom: 16 }]}>{fetchError}</Text>
        <TouchableOpacity
          onPress={() => { setIsLoading(true); fetchCollection() }}
          accessibilityLabel="Retry loading collection"
          accessibilityRole="button"
          style={{ backgroundColor: Colors.purple[600], paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Tap to Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={st.container}>
      {/* Selection mode header — shows when user has long-pressed a card.
          Mirrors web's collection toolbar with Select All / Clear / count. */}
      {selectionMode && (
        <View style={st.selectionBar}>
          <TouchableOpacity
            onPress={exitSelectionMode}
            style={st.selectionAction}
            accessibilityLabel="Exit selection mode"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={20} color={Colors.gray[700]} />
          </TouchableOpacity>
          <Text style={st.selectionCount} accessibilityLiveRegion="polite">{selectedIds.size} selected</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={selectAllToggle}
            style={st.selectionAction}
            accessibilityLabel={allFilteredSelected ? 'Clear all selected cards' : 'Select all visible cards'}
            accessibilityRole="button"
          >
            <Text style={st.selectionActionText}>{allFilteredSelected ? 'Clear' : 'Select All'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search + Sort + View Toggle */}
      <View style={st.toolbar}>
        <View style={st.searchContainer}>
          <Ionicons name="search" size={18} color={Colors.gray[400]} />
          <TextInput
            style={st.searchInput}
            placeholder="Search name, set, serial, year..."
            placeholderTextColor={Colors.gray[400]}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search !== '' && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={Colors.gray[400]} />
            </TouchableOpacity>
          )}
        </View>
        {/* One Filter button replaces the sort bar, the category scroller and
            the sport sub-row. Badge shows how many are on. */}
        <TouchableOpacity
          onPress={() => setFilterOpen(true)}
          style={[st.viewToggle, activeFilters > 0 && st.viewToggleOn]}
          accessibilityLabel={`Filter and sort${activeFilters ? `, ${activeFilters} active` : ''}`}
          accessibilityRole="button"
        >
          <Ionicons name="options-outline" size={20} color={activeFilters > 0 ? '#fff' : Colors.purple[600]} />
          {activeFilters > 0 && (
            <View style={st.filterBadge}><Text style={st.filterBadgeTxt}>{activeFilters}</Text></View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}
          style={st.viewToggle}
          accessibilityLabel={viewMode === 'list' ? 'Switch to grid view' : 'Switch to list view'}
          accessibilityRole="button"
        >
          <Ionicons name={viewMode === 'list' ? 'grid' : 'list'} size={20} color={Colors.purple[600]} />
        </TouchableOpacity>
      </View>

      {/* Label-style picker (only meaningful in grid view, but useful to access here) */}
      {viewMode === 'grid' && (
        <View style={st.styleBar}>
          <LabelStylePicker labelStyle={labelStyle} customStyles={customStyles} onSwitch={switchStyle} compact />
        </View>
      )}

      {/* Sort, category and sport moved into the filter sheet — three
          horizontal rows on a screen that also has a nav header, a tab bar,
          a search row and the binder strip. Active picks show as chips. */}

      {/* Binder strip + ownership tabs — hidden entirely until the binders
          migration lands, so the screen behaves exactly as before. */}
      {bindersAvailable && (
        <>
          <BinderStrip
            binders={binders}
            selectedId={selectedBinderId}
            ownershipView={ownershipView}
            ownedCount={ownedCount}
            soldCount={soldCount}
            onSelectSold={() => { setOwnershipView('sold'); setSelectedBinderId(null); setSelectedIds(new Set()); setSelectionMode(false) }}
            onSelect={(id) => {
              setSelectedBinderId(id)
              // Picking a scope lands you on what you HOLD; Sold is its own
              // chip, and inside a binder it's a filter in the sheet.
              setOwnershipView('owned')
              setSelectedIds(new Set()); setSelectionMode(false)
            }}
            onCreate={() => { setNewBinderFor([]); setNewBinderName(''); setNewBinderOpen(true) }}
          />
          {selectedBinder && (
            <View style={st.binderBar}>
              {binderReorderable && (
                <Text style={[st.ownHint, { flex: 1, paddingHorizontal: 0, paddingBottom: 0 }]}>
                  Long-press a card to reorder or file it.
                </Text>
              )}
              {/* System binders (auto "Sold") are switched off by preference,
                  not deleted, so they don't get an Edit button. */}
              {!selectedBinder.system_key && (
                <TouchableOpacity
                  style={st.editBinderBtn}
                  onPress={() => { setManageName(selectedBinder.name); setConfirmDeleteBinder(false); setManageOpen(true) }}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit binder ${selectedBinder.name}`}
                >
                  <Ionicons name="create-outline" size={14} color={Colors.gray[700]} />
                  <Text style={st.editBinderTxt}>Edit binder</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      )}

      {/* Active filters only — state visible, controls in the sheet */}
      {activeFilters > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.activeRow}>
          {category !== 'All' && (
            <Pressable style={st.activeChip} onPress={() => { setCategory('All'); setSubSport(null) }}>
              <Text style={st.activeChipTxt}>{category}</Text>
              <Ionicons name="close" size={12} color={Colors.purple[700]} />
            </Pressable>
          )}
          {subSport && (
            <Pressable style={st.activeChip} onPress={() => setSubSport(null)}>
              <Text style={st.activeChipTxt}>{subSport}</Text>
              <Ionicons name="close" size={12} color={Colors.purple[700]} />
            </Pressable>
          )}
          {(sortBy !== 'created_at' || sortAsc) && (
            <Pressable style={st.activeChip} onPress={() => { setSortBy('created_at'); setSortAsc(false) }}>
              <Text style={st.activeChipTxt}>
                {SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? sortBy} {sortAsc ? '↑' : '↓'}
              </Text>
              <Ionicons name="close" size={12} color={Colors.purple[700]} />
            </Pressable>
          )}
          {selectedBinderId && ownershipView === 'sold' && (
            <Pressable style={st.activeChip} onPress={() => setOwnershipView('owned')}>
              <Text style={st.activeChipTxt}>Sold</Text>
              <Ionicons name="close" size={12} color={Colors.purple[700]} />
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* Stats bar */}
      <View style={st.statsBar}>
        <Text style={st.statsText}>{filteredCards.length} cards</Text>
        {stats.avgGrade > 0 && <Text style={st.statsText}>Avg: {stats.avgGrade.toFixed(1)}</Text>}
        {stats.totalValue > 0 && <Text style={[st.statsText, { color: Colors.green[600] }]}>${stats.totalValue.toFixed(2)}</Text>}
      </View>

      {/* Card List */}
      <FlatList
        data={filteredCards}
        keyExtractor={(item) => item.id}
        renderItem={viewMode === 'list' ? renderListItem : renderGridItem}
        numColumns={viewMode === 'grid' ? gridColumns : 1}
        // Key includes column count so FlatList re-mounts cleanly when
        // the user rotates iPad / changes to/from grid view. Without this,
        // FlatList errors out with "numColumns cannot be changed".
        key={`${viewMode}-${gridColumns}`}
        refreshing={refreshing}
        onRefresh={onRefresh}
        // removeClippedSubviews is intentionally OFF (default on Android is
        // true, which aggressively unmounts off-screen items and causes
        // expo-image's transition to restart on remount — images visibly
        // pop in/out during fast scroll). windowSize=5 +
        // maxToRenderPerBatch=10 already cap memory usage; we don't need
        // the extra optimization at the cost of jank.
        removeClippedSubviews={false}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={8}
        ListEmptyComponent={
          <View style={st.empty}>
            <Ionicons name="albums-outline" size={72} color={Colors.gray[300]} />
            {/* Scoped to what the user is actually looking at. "No cards yet"
                on a binder's empty Sold tab reads as data loss. */}
            {selectedBinder && ownershipView === 'sold' ? (
              <>
                <Text style={st.emptyTitle}>No sold cards in “{selectedBinder.name}”</Text>
                <Text style={st.emptySubtitle}>Nothing in this binder has been marked as sold yet.</Text>
                <TouchableOpacity style={st.emptyCta} onPress={() => setOwnershipView('owned')}>
                  <Text style={st.emptyCtaTxt}>Show owned cards</Text>
                </TouchableOpacity>
              </>
            ) : selectedBinder ? (
              <>
                <Text style={st.emptyTitle}>“{selectedBinder.name}” is empty</Text>
                <Text style={st.emptySubtitle}>Long-press a card in your collection to file it here.</Text>
                <TouchableOpacity style={st.emptyCta} onPress={() => setSelectedBinderId(null)}>
                  <Text style={st.emptyCtaTxt}>Back to all cards</Text>
                </TouchableOpacity>
              </>
            ) : ownershipView === 'sold' ? (
              <>
                <Text style={st.emptyTitle}>No sold cards yet</Text>
                <Text style={st.emptySubtitle}>Cards you mark as sold move here and stay verifiable for the buyer.</Text>
              </>
            ) : (
              <>
                <Text style={st.emptyTitle}>{category !== 'All' ? `No ${category} cards` : 'No cards yet'}</Text>
                <Text style={st.emptySubtitle}>
                  {category !== 'All' ? 'Try a different category or grade a new card' : 'Grade your first card to start building your collection'}
                </Text>
              </>
            )}
          </View>
        }
        contentContainerStyle={[viewMode === 'grid' ? st.gridContainer : st.listContainer, selectionMode && selectedIds.size > 0 ? { paddingBottom: 96 } : undefined]}
      />

      {/* Batch action bar — shows when at least one card is selected.
          Two buttons mirror web's "Print" + "Download" dropdowns. */}
      {selectionMode && selectedIds.size > 0 && (
        <View style={[st.batchBar, { paddingBottom: insets.bottom + 10 }]}>
          {/* Bulk file — the fast path when you've already ticked a stack */}
          {bindersAvailable && (
            <TouchableOpacity
              style={[st.batchBtn, { backgroundColor: Colors.purple[600] }]}
              onPress={() => { setNewBinderFor([...selectedIds]); setBinderPickerOpen(true) }}
              accessibilityLabel={`Add ${selectedIds.size} selected cards to a binder`}
              accessibilityRole="button"
            >
              <Ionicons name="folder-open" size={18} color="#fff" />
              <Text style={st.batchBtnText}>Binder ({selectedIds.size})</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[st.batchBtn, st.batchBtnPrint]}
            onPress={() => setBatchSheetOpen('print')}
            accessibilityLabel={`Print labels for ${selectedIds.size} selected cards`}
            accessibilityRole="button"
          >
            <Ionicons name="print" size={18} color="#fff" />
            <Text style={st.batchBtnText}>Print Labels ({selectedIds.size})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.batchBtn, st.batchBtnReports]}
            onPress={() => setBatchSheetOpen('reports')}
            accessibilityLabel={`Download reports for ${selectedIds.size} selected cards`}
            accessibilityRole="button"
          >
            <Ionicons name="document-text" size={18} color="#fff" />
            <Text style={st.batchBtnText}>Reports ({selectedIds.size})</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Batch type-selection sheet (Print Labels / Download Reports).
          Mirrors the web's two dropdowns from src/app/collection/page.tsx. */}
      <Modal visible={!!batchSheetOpen} transparent animationType="slide" onRequestClose={() => setBatchSheetOpen(null)}>
        <Pressable style={st.sheetBackdrop} onPress={() => setBatchSheetOpen(null)}>
          <Pressable style={[st.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={e => e.stopPropagation()}>
            <View style={st.sheetHandle} />
            <Text style={st.sheetTitle}>
              {batchSheetOpen === 'print' ? 'Print Labels' : 'Download Reports'}
            </Text>
            <Text style={st.sheetSubtitle}>{selectedIds.size} card{selectedIds.size === 1 ? '' : 's'} selected · same options as web</Text>
            <ScrollView style={{ maxHeight: 480 }}>
              {batchSheetOpen === 'print' && BATCH_PRINT_TYPES.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={st.sheetItem}
                  onPress={() => {
                    setBatchSheetOpen(null)
                    // Slab label: hand off to the unified options sheet
                    // (style + format in one step). Same UX as the
                    // single-card flow.
                    if (item.opensSlabOptions) {
                      setSlabOptionsOpen(true)
                      return
                    }
                    // Avery types prompt for starting position first
                    if (item.id === 'onetouch') {
                      setPositionPicker({ type: item.id, sheet: 'avery6871' })
                      AsyncStorage.getItem('dcm_avery6871_last_pos').then(p => setPickerStartPosition(p ? parseInt(p, 10) || 0 : 0))
                      return
                    }
                    if (item.id === 'toploader') {
                      // Toploader = 40 card-pair slots per page (front+back labels)
                      setPositionPicker({ type: item.id, sheet: 'avery8167-pairs' })
                      AsyncStorage.getItem('dcm_avery8167_pairs_last_pos').then(p => setPickerStartPosition(p ? parseInt(p, 10) || 0 : 0))
                      return
                    }
                    if (item.id === 'foldover') {
                      // Foldover = 80 single labels per page
                      setPositionPicker({ type: item.id, sheet: 'avery8167' })
                      AsyncStorage.getItem('dcm_avery8167_last_pos').then(p => setPickerStartPosition(p ? parseInt(p, 10) || 0 : 0))
                      return
                    }
                    openBatchDownload(item.id)
                  }}
                >
                  <Ionicons name={item.icon as any} size={20} color={Colors.purple[600]} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.sheetItemName}>{item.name}</Text>
                    <Text style={st.sheetItemDesc}>{item.desc}</Text>
                  </View>
                  <Ionicons name="download-outline" size={16} color={Colors.gray[400]} />
                </TouchableOpacity>
              ))}
              {batchSheetOpen === 'reports' && BATCH_REPORT_TYPES.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={st.sheetItem}
                  onPress={() => { setBatchSheetOpen(null); openBatchDownload(item.id) }}
                >
                  <Ionicons name={item.icon as any} size={20} color={Colors.purple[600]} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.sheetItemName}>{item.name}</Text>
                    <Text style={st.sheetItemDesc}>{item.desc}</Text>
                  </View>
                  <Ionicons name="download-outline" size={16} color={Colors.gray[400]} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Position picker for Avery 6871 (one-touch) and 8167 (toploader/
          foldover). User picks the FIRST position; selected cards
          auto-fill subsequent positions sequentially across pages.
          Persists last-used start position per Avery type. */}
      <Modal visible={!!positionPicker} transparent animationType="slide" onRequestClose={() => setPositionPicker(null)}>
        <Pressable style={st.sheetBackdrop} onPress={() => setPositionPicker(null)}>
          <Pressable style={[st.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={e => e.stopPropagation()}>
            <View style={st.sheetHandle} />
            {positionPicker && (() => {
              const cfg = positionPicker.sheet === 'avery6871'
                ? { rows: 6, cols: 3, total: 18, label: 'Avery 6871 — 18 labels (3 × 6)', storageKey: 'dcm_avery6871_last_pos', isPair: false }
                : positionPicker.sheet === 'avery8167-pairs'
                ? { rows: 20, cols: 2, total: 40, label: 'Avery 8167 — 40 card slots (2 × 20, each = front + back)', storageKey: 'dcm_avery8167_pairs_last_pos', isPair: true }
                : { rows: 20, cols: 4, total: 80, label: 'Avery 8167 — 80 labels (4 × 20)', storageKey: 'dcm_avery8167_last_pos', isPair: false }
              const n = selectedIds.size
              const startPage = Math.floor(pickerStartPosition / cfg.total)
              const endGlobal = pickerStartPosition + n - 1
              const endPage = Math.floor(endGlobal / cfg.total)
              const pages = endPage - startPage + 1
              return (
                <>
                  <Text style={st.sheetTitle}>Choose Starting Position</Text>
                  <Text style={st.sheetSubtitle}>{cfg.label} · {n} card{n === 1 ? '' : 's'} fill positions {pickerStartPosition + 1}–{endGlobal + 1}{pages > 1 ? ` across ${pages} pages` : ''}</Text>
                  <ScrollView style={{ maxHeight: 320 }}>
                    <View style={{ alignSelf: 'center', flexDirection: 'column', gap: 4, padding: 4 }}>
                      {Array.from({ length: cfg.rows }).map((_, r) => (
                        <View key={r} style={{ flexDirection: 'row', gap: 4 }}>
                          {Array.from({ length: cfg.cols }).map((_, c) => {
                            const idx = r * cfg.cols + c
                            // Highlight: solid = start, light = will-be-filled, white = empty
                            const isStart = idx === pickerStartPosition % cfg.total
                            const inRange = idx >= (pickerStartPosition % cfg.total) && idx < Math.min(cfg.total, (pickerStartPosition % cfg.total) + n)
                            // Toploader pair cells are wider (each cell = 2 physical labels)
                            const cellSize = cfg.isPair ? 56 : (positionPicker.sheet === 'avery8167' ? 28 : 48)
                            const cellHeight = (cfg.isPair ? cellSize * 0.45 : cellSize * 0.7)
                            return (
                              <TouchableOpacity
                                key={c}
                                onPress={() => setPickerStartPosition(idx)}
                                style={{
                                  width: cellSize,
                                  height: cellHeight,
                                  borderRadius: 4,
                                  borderWidth: isStart ? 2 : 1,
                                  borderColor: isStart ? Colors.purple[600] : Colors.gray[300],
                                  backgroundColor: isStart ? Colors.purple[600] : (inRange ? Colors.purple[100] : '#fff'),
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexDirection: cfg.isPair ? 'row' : 'column',
                                  overflow: 'hidden',
                                }}
                              >
                                {cfg.isPair && (
                                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: StyleSheet.hairlineWidth, backgroundColor: isStart ? 'rgba(255,255,255,0.4)' : Colors.gray[300] }} />
                                )}
                                <Text style={{ fontSize: cfg.isPair ? 11 : (positionPicker.sheet === 'avery8167' ? 8 : 11), fontWeight: '700', color: isStart ? '#fff' : (inRange ? Colors.purple[700] : Colors.gray[500]) }}>
                                  {idx + 1}
                                </Text>
                              </TouchableOpacity>
                            )
                          })}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity style={[st.btn, st.btnCancel]} onPress={() => setPositionPicker(null)}>
                      <Text style={st.btnCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[st.btn, st.btnPrimary]}
                      onPress={async () => {
                        await AsyncStorage.setItem(cfg.storageKey, String(pickerStartPosition))
                        const positions = buildSequentialPositions(pickerStartPosition)
                        const t = positionPicker.type
                        setPositionPicker(null)
                        openBatchDownload(t, { positions })
                      }}
                    >
                      <Text style={st.btnPrimaryText}>Generate {n} label{n === 1 ? '' : 's'} →</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Batch slab label options — style (Modern / Traditional / Custom)
          + format (Duplex / Fold-Over) applied to every selected card.
          Same component used on the single-card flow in card/[id].tsx;
          here it routes through openBatchDownload with customConfig
          base64-encoded if the user picks a saved custom-N. */}
      <SlabLabelOptionsSheet
        visible={slabOptionsOpen}
        onClose={() => setSlabOptionsOpen(false)}
        customStyles={customStyles}
        defaultStyleId={labelStyle}
        onGenerate={(type, format, customLabelStyleId) => {
          let customConfigB64: string | undefined
          if (type === 'slab-custom' && customLabelStyleId) {
            // Resolve the picked custom-N to its saved config and
            // base64-encode for the customConfig URL param. The web
            // batch handler decodes it via atob and applies to every
            // selected card.
            const cs = customStyles.find(s => s.id === customLabelStyleId)
            if (cs?.config) {
              try {
                const json = JSON.stringify(cs.config)
                // btoa is polyfilled in React Native (0.74+); falls back
                // to Buffer.from if anything goes wrong.
                customConfigB64 = typeof btoa === 'function'
                  ? btoa(unescape(encodeURIComponent(json)))
                  : Buffer.from(json, 'utf-8').toString('base64')
              } catch (e) {
                console.warn('[BatchSlab] failed to encode customConfig:', e)
              }
            }
          }
          openBatchDownload(type, { format, customConfig: customConfigB64 })
        }}
      />

      {/* iOS-only: hidden-WebView export runner. The web batch page detects
          ReactNativeWebView and posts files back as base64; we save them to
          Documents (visible in Files app) and offer Share. */}
      <ExportRunner source={exportSource} onClose={() => setExportSource(null)} />

      {/* Long-press sheet: file into binders, step position, remove */}
      <CardActionSheet
        visible={!!sheetCard}
        cardName={sheetCard ? getDisplayName(sheetCard as any) : ''}
        binders={binders.filter(b => !b.smart_filter)}
        memberOf={sheetMemberOf}
        currentBinder={selectedBinder && binderReorderable
          ? { id: selectedBinder.id, name: selectedBinder.name }
          : null}
        index={sheetCard ? (binderCards ?? []).findIndex(c => c.id === sheetCard.id) : -1}
        total={(binderCards ?? []).length}
        busy={sheetBusy}
        onToggleBinder={sheetToggleBinder}
        onCreateBinder={() => {
          if (!sheetCard) return
          setNewBinderFor([sheetCard.id]); setNewBinderName(''); setNewBinderOpen(true)
        }}
        onMove={sheetMove}
        onRemoveFromBinder={sheetRemoveFromBinder}
        onMarkSold={() => { setSellCard(sheetCard); setSheetCard(null) }}
        isSold={(sheetCard as any)?.ownership_status === 'sold'}
        onSelectMultiple={() => { if (sheetCard) enterSelectionMode(sheetCard.id); setSheetCard(null) }}
        onOpenCard={() => { const id = sheetCard?.id; setSheetCard(null); if (id) router.push(`/card/${id}`) }}
        onClose={() => setSheetCard(null)}
      />

      {/* Bulk: add the ticked cards to a binder */}
      <Modal visible={binderPickerOpen} transparent animationType="slide" onRequestClose={() => setBinderPickerOpen(false)}>
        <Pressable style={st.sheetBackdrop} onPress={() => setBinderPickerOpen(false)}>
          <Pressable style={[st.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={e => e.stopPropagation()}>
            <View style={st.sheetHandle} />
            <Text style={st.sheetTitle}>Add {newBinderFor.length} card{newBinderFor.length === 1 ? '' : 's'} to…</Text>
            <Text style={st.sheetSubtitle}>
              A card can live in as many binders as you like.
            </Text>
            <ScrollView style={{ maxHeight: 340 }}>
              {binders.filter(b => !b.smart_filter).map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={st.binderPickRow}
                  onPress={async () => {
                    try {
                      const r = await addCardsToBinder(b.id, newBinderFor)
                      await refreshBinders()
                      if (selectedBinderId === b.id) await loadBinderCards(b.id)
                      setBinderPickerOpen(false)
                      setSelectedIds(new Set())
                      setSelectionMode(false)
                      Alert.alert('Added', r.skipped
                        ? `Added ${r.added} to "${b.name}" (${r.skipped} already there).`
                        : `Added ${r.added} card${r.added === 1 ? '' : 's'} to "${b.name}".`)
                    } catch (e: any) {
                      Alert.alert('Could not add', e?.message || 'Please try again.')
                    }
                  }}
                >
                  <View style={[st.binderPickDot, { backgroundColor: b.accent_color || Colors.purple[400] }]} />
                  <Text style={st.binderPickName} numberOfLines={1}>{b.name}</Text>
                  <Text style={st.binderPickCount}>{b.card_count}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[st.nbPrimary, { marginTop: 12 }]}
              onPress={() => { setBinderPickerOpen(false); setNewBinderName(''); setNewBinderOpen(true) }}
            >
              <Text style={st.nbPrimaryTxt}>＋ New binder with these cards</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <FilterSheet
        visible={filterOpen}
        state={filterState}
        categories={CATEGORIES as unknown as string[]}
        sports={sportsInCollection}
        sortOptions={SORT_OPTIONS}
        inBinder={Boolean(selectedBinderId)}
        onChange={(patch) => {
          if (patch.category !== undefined) { setCategory(patch.category); setSubSport(null) }
          if (patch.subSport !== undefined) setSubSport(patch.subSport)
          if (patch.sortBy !== undefined) setSortBy(patch.sortBy)
          if (patch.sortAsc !== undefined) setSortAsc(patch.sortAsc)
          if (patch.ownershipView !== undefined) setOwnershipView(patch.ownershipView)
        }}
        onReset={() => {
          setCategory('All'); setSubSport(null)
          setSortBy('created_at'); setSortAsc(false); setOwnershipView('owned')
        }}
        onClose={() => setFilterOpen(false)}
      />

      {/* Mark as sold, with the same price/date/note fields as web */}
      <MarkAsSoldModal
        visible={!!sellCard}
        cardName={sellCard ? getDisplayName(sellCard as any) : ''}
        busy={sellBusy}
        onCancel={() => setSellCard(null)}
        onConfirm={async (details) => {
          if (!sellCard) return
          setSellBusy(true)
          try {
            const { data: { session: sess } } = await supabase.auth.getSession()
            const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'
            const res = await fetch(`${API_BASE}/api/cards/${sellCard.id}/ownership`, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${sess?.access_token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ ownership_status: 'sold', ...details }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(json.error || 'Could not mark as sold')
            setSellCard(null)
            fetchCollection()
            if (selectedBinderId) loadBinderCards(selectedBinderId)
          } catch (e: any) {
            Alert.alert('Could not mark as sold', e?.message || 'Please try again.')
          } finally { setSellBusy(false) }
        }}
      />

      {/* Edit binder — rename or delete. Delete leads with the reassurance
          because a binder LOOKS like it holds cards, so deleting one reads as
          deleting them. It doesn't: only the binder goes away. */}
      <Modal visible={manageOpen} transparent animationType="fade" onRequestClose={() => setManageOpen(false)}>
        <Pressable style={st.nbBackdrop} onPress={() => setManageOpen(false)}>
          <Pressable style={st.nbCard} onPress={() => {}}>
            {!confirmDeleteBinder ? (
              <>
                <Text style={st.nbTitle}>Edit binder</Text>
                <TextInput
                  value={manageName}
                  onChangeText={(t) => setManageName(t.slice(0, 60))}
                  placeholder="Binder name"
                  placeholderTextColor={Colors.gray[400]}
                  style={st.nbInput}
                  returnKeyType="done"
                />
                <Text style={[st.nbSub, { marginTop: 6 }]}>
                  {selectedBinder?.card_count ?? 0} card{(selectedBinder?.card_count ?? 0) === 1 ? '' : 's'} in this binder.
                </Text>
                <View style={st.nbRow}>
                  <TouchableOpacity
                    style={[st.nbPrimary, (!manageName.trim() || manageName.trim() === selectedBinder?.name || sheetBusy) && { opacity: 0.5 }]}
                    disabled={!manageName.trim() || manageName.trim() === selectedBinder?.name || sheetBusy}
                    onPress={async () => {
                      if (!selectedBinder) return
                      setSheetBusy(true)
                      try {
                        await renameBinder(selectedBinder.id, manageName.trim())
                        await refreshBinders()
                        setManageOpen(false)
                      } catch (e: any) {
                        Alert.alert('Could not rename', e?.message || 'Please try again.')
                      } finally { setSheetBusy(false) }
                    }}
                  >
                    <Text style={st.nbPrimaryTxt}>Save name</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.nbCancel} onPress={() => setManageOpen(false)} disabled={sheetBusy}>
                    <Text style={st.nbCancelTxt}>Cancel</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={st.deleteBinderBtn}
                  onPress={() => setConfirmDeleteBinder(true)}
                  disabled={sheetBusy}
                >
                  <Text style={st.deleteBinderTxt}>Delete binder</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={st.nbTitle}>Delete “{selectedBinder?.name}”?</Text>
                <View style={st.keepBox}>
                  <Text style={st.keepTitle}>
                    Your {selectedBinder?.card_count ?? 0} card{(selectedBinder?.card_count ?? 0) === 1 ? '' : 's'} stay in your collection.
                  </Text>
                  <Text style={st.keepBody}>
                    Only the binder itself goes away — nothing is deleted, and the cards
                    keep any other binders they’re in.
                  </Text>
                </View>
                <View style={st.nbRow}>
                  <TouchableOpacity
                    style={[st.nbPrimary, { backgroundColor: '#dc2626' }, sheetBusy && { opacity: 0.5 }]}
                    disabled={sheetBusy}
                    onPress={async () => {
                      if (!selectedBinder) return
                      setSheetBusy(true)
                      try {
                        await deleteBinder(selectedBinder.id)
                        setSelectedBinderId(null)
                        await refreshBinders()
                        setManageOpen(false)
                        setConfirmDeleteBinder(false)
                      } catch (e: any) {
                        Alert.alert('Could not delete', e?.message || 'Please try again.')
                      } finally { setSheetBusy(false) }
                    }}
                  >
                    <Text style={st.nbPrimaryTxt}>Delete binder</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.nbCancel} onPress={() => setConfirmDeleteBinder(false)} disabled={sheetBusy}>
                    <Text style={st.nbCancelTxt}>Back</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* New binder */}
      <Modal visible={newBinderOpen} transparent animationType="fade" onRequestClose={() => setNewBinderOpen(false)}>
        <Pressable style={st.nbBackdrop} onPress={() => setNewBinderOpen(false)}>
          <Pressable style={st.nbCard} onPress={() => {}}>
            <Text style={st.nbTitle}>New binder</Text>
            <Text style={st.nbSub}>
              {newBinderFor.length > 0
                ? `${newBinderFor.length} card${newBinderFor.length === 1 ? '' : 's'} will go straight into it.`
                : 'Group your cards however you like.'}
            </Text>
            <TextInput
              autoFocus
              value={newBinderName}
              onChangeText={(t) => setNewBinderName(t.slice(0, 60))}
              placeholder="e.g. Vintage Football, PC, For sale"
              placeholderTextColor={Colors.gray[400]}
              style={st.nbInput}
              returnKeyType="done"
              onSubmitEditing={confirmNewBinder}
            />
            <View style={st.nbRow}>
              <TouchableOpacity
                style={[st.nbPrimary, (!newBinderName.trim() || sheetBusy) && { opacity: 0.5 }]}
                onPress={confirmNewBinder}
                disabled={!newBinderName.trim() || sheetBusy}
              >
                <Text style={st.nbPrimaryTxt}>
                  {newBinderFor.length > 0 ? `Create and add ${newBinderFor.length}` : 'Create binder'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.nbCancel} onPress={() => setNewBinderOpen(false)} disabled={sheetBusy}>
                <Text style={st.nbCancelTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

// Batch print types — mirror web's collection page Print dropdown
// (src/app/collection/page.tsx). The single "Graded Slab Label" entry
// opens SlabLabelOptionsSheet for style + format selection (same UX
// as the single-card flow on card/[id].tsx); Avery variants prompt
// for sheet starting position; card-image variants are direct.
const BATCH_PRINT_TYPES: Array<{ id: string; name: string; desc: string; icon: string; opensSlabOptions?: boolean }> = [
  { id: 'slab-options',        name: 'Graded Slab Label',         desc: 'Pick style + format (Modern / Traditional / Heritage / Custom · Duplex / Fold-Over)', icon: 'card', opensSlabOptions: true },
  { id: 'onetouch',            name: 'Magnetic One-Touch',        desc: 'Avery 6871 — pick starting position', icon: 'magnet' },
  { id: 'toploader',           name: 'Toploader Front + Back',    desc: 'Avery 8167 — pick starting position', icon: 'copy' },
  { id: 'foldover',            name: 'Fold-Over Toploader',       desc: 'Avery 8167 fold-over — pick start position', icon: 'reader' },
  { id: 'card-image-modern',   name: 'Card Image — Modern',       desc: 'JPG with modern dark slab label', icon: 'image' },
  { id: 'card-image-traditional', name: 'Card Image — Traditional', desc: 'JPG with traditional light slab label', icon: 'image-outline' },
  { id: 'card-image-heritage', name: 'Card Image — Heritage',    desc: 'JPG with ivory Heritage slab label', icon: 'ribbon-outline' },
]

const BATCH_REPORT_TYPES: Array<{ id: string; name: string; desc: string; icon: string }> = [
  { id: 'full-report',     name: 'Full Grading Report',  desc: 'Complete PDF — grades, sub-grades, defect detail, card images', icon: 'document-text' },
  { id: 'mini-report-pdf', name: 'Mini-Report (PDF)',    desc: 'Foldable summary card per card — fold or cut to 2.5" × 3.5"', icon: 'document' },
  { id: 'mini-report',     name: 'Mini-Report Image',    desc: 'JPG version per card for marketplaces', icon: 'image' },
]

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.gray[50] },

  // Toolbar
  toolbar: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[200] },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.gray[100], borderRadius: 10, paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: Colors.gray[900] },
  viewToggle: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gray[100], borderRadius: 10 },

  // Sort bar
  sortBar: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, gap: 6, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  sortChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: Colors.gray[200] },
  sortChipActive: { borderColor: Colors.purple[600], backgroundColor: Colors.purple[50] },
  sortChipText: { fontSize: 11, fontWeight: '600', color: Colors.gray[500] },
  sortChipTextActive: { color: Colors.purple[700] },

  // Category tabs
  catScroll: { backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[200], height: 52, flexGrow: 0, flexShrink: 0 },
  catContent: { paddingHorizontal: 12, gap: 6, alignItems: 'center' },
  catTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: Colors.gray[100] },
  catTabActive: { backgroundColor: Colors.purple[600] },
  catTabText: { fontSize: 12, fontWeight: '600', color: Colors.gray[600] },
  catTabTextActive: { color: '#fff' },
  // Sport sub-row — visually subordinate to the main category row.
  // Lighter background, smaller pills, purple accent ring on the active
  // pill instead of a solid fill so it reads as "narrowing within
  // Sports" rather than a peer of the main category choice.
  subCatScroll: {
    backgroundColor: Colors.gray[50],
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
    height: 40,
    flexGrow: 0,
    flexShrink: 0,
  },
  subCatContent: { paddingHorizontal: 12, gap: 6, alignItems: 'center' },
  subCatPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  subCatPillActive: {
    backgroundColor: Colors.purple[50],
    borderColor: Colors.purple[600],
  },
  subCatPillText: { fontSize: 11, fontWeight: '600', color: Colors.gray[600] },
  subCatPillTextActive: { color: Colors.purple[700] },

  // Stats
  statsBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.gray[50] },
  ownRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 8 },
  ownTab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.gray[100] },
  ownTabOn: { backgroundColor: Colors.purple[600] },
  ownTabTxt: { fontSize: 13, fontWeight: '700', color: Colors.gray[600] },
  ownTabTxtOn: { color: '#fff' },
  ownHint: { fontSize: 12, color: Colors.gray[500], paddingHorizontal: 14, paddingBottom: 8 },
  nbBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  nbCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  nbTitle: { fontSize: 17, fontWeight: '800', color: Colors.gray[900] },
  nbSub: { fontSize: 13, color: Colors.gray[600], marginTop: 4 },
  nbInput: { marginTop: 14, borderWidth: 1, borderColor: Colors.gray[300], borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: Colors.gray[900] },
  nbRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  nbPrimary: { flex: 1, backgroundColor: Colors.purple[600], borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  nbPrimaryTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  nbCancel: { paddingHorizontal: 18, backgroundColor: Colors.gray[100], borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  nbCancelTxt: { color: Colors.gray[700], fontWeight: '700', fontSize: 15 },
  binderPickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 10, borderWidth: 2, borderColor: Colors.gray[200], marginBottom: 8 },
  binderPickDot: { width: 12, height: 12, borderRadius: 6 },
  binderPickName: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.gray[900] },
  binderPickCount: { fontSize: 13, color: Colors.gray[400] },
  binderBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 8 },
  editBinderBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.gray[100] },
  editBinderTxt: { fontSize: 12, fontWeight: '700', color: Colors.gray[700] },
  deleteBinderBtn: { marginTop: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: '#fef2f2', alignItems: 'center' },
  deleteBinderTxt: { fontSize: 15, fontWeight: '700', color: '#b91c1c' },
  keepBox: { marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  keepTitle: { fontSize: 14, fontWeight: '800', color: '#065f46' },
  keepBody: { fontSize: 13, color: '#047857', marginTop: 4, lineHeight: 18 },
  emptyCta: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.purple[600] },
  emptyCtaTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  viewToggleOn: { backgroundColor: Colors.purple[600] },
  filterBadge: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  activeRow: { paddingHorizontal: 12, paddingBottom: 8, gap: 6, flexDirection: 'row' },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: Colors.purple[100] },
  activeChipTxt: { fontSize: 12, fontWeight: '700', color: Colors.purple[700] },
  statsText: { fontSize: 11, color: Colors.gray[500], fontWeight: '600' },

  // List view
  listContainer: { padding: 12 },
  listItem: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: Colors.gray[200], gap: 12 },
  listItemSelected: { borderColor: Colors.purple[600], backgroundColor: Colors.purple[50] },
  gridItemSelected: { borderColor: Colors.purple[600], borderWidth: 2 },

  // Selection-mode header bar
  selectionBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.purple[50], borderBottomWidth: 1, borderBottomColor: Colors.purple[200], gap: 12 },
  selectionAction: { paddingHorizontal: 8, paddingVertical: 4 },
  selectionActionText: { fontSize: 13, fontWeight: '700', color: Colors.purple[700] },
  selectionCount: { fontSize: 14, fontWeight: '700', color: Colors.purple[700] },

  // Per-item checkbox
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.gray[300], alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkboxOn: { backgroundColor: Colors.purple[600], borderColor: Colors.purple[600] },
  checkboxFloating: { position: 'absolute', top: 6, left: 6, zIndex: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 3 },

  // Bottom batch action bar
  batchBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: Colors.white, paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 18, gap: 8, borderTopWidth: 1, borderTopColor: Colors.gray[200], shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: -2 }, elevation: 8 },
  batchBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10 },
  batchBtnPrint: { backgroundColor: Colors.purple[600] },
  batchBtnReports: { backgroundColor: Colors.blue[600] },
  batchBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Bottom-sheet (batch type pickers + position picker)
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 28 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.gray[300], alignSelf: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], paddingHorizontal: 8 },
  sheetSubtitle: { fontSize: 12, color: Colors.gray[500], paddingHorizontal: 8, marginTop: 2, marginBottom: 10 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 10, marginBottom: 8 },
  sheetItemName: { fontSize: 13, fontWeight: '700', color: Colors.gray[900] },
  sheetItemDesc: { fontSize: 10, color: Colors.gray[500], marginTop: 2 },

  // Buttons (sheet footer)
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnCancel: { backgroundColor: Colors.gray[100] },
  btnCancelText: { fontSize: 13, fontWeight: '700', color: Colors.gray[700] },
  btnPrimary: { backgroundColor: Colors.purple[600] },
  btnPrimaryText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  listThumb: { width: 50, height: 70, borderRadius: 6 },
  placeholder: { backgroundColor: Colors.gray[200], alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: Colors.gray[400], fontSize: 10, fontWeight: '700' },
  listInfo: { flex: 1 },
  listName: { fontSize: 14, fontWeight: '600', color: Colors.gray[900] },
  listSet: { fontSize: 12, color: Colors.gray[500], marginTop: 2 },
  listFeatures: { fontSize: 10, color: Colors.blue[600], fontWeight: '700', marginTop: 2 },
  listMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  listCategory: { fontSize: 10, color: Colors.purple[600], fontWeight: '500' },
  listCondition: { fontSize: 10, color: Colors.gray[500], fontWeight: '500' },
  pendingBadge: { backgroundColor: Colors.amber[50], borderWidth: 1, borderColor: Colors.amber[500], borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pendingText: { fontSize: 10, fontWeight: '600', color: Colors.amber[600] },
  listPrice: { fontSize: 11, color: Colors.green[600], fontWeight: '600' },

  // Style picker bar
  styleBar: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },

  // Grid view
  gridContainer: { padding: 8 },
  gridItem: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, margin: 4, borderWidth: 1, borderColor: Colors.gray[200], overflow: 'hidden', paddingBottom: 8 },
  gridPendingBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: Colors.amber[50], borderWidth: 1, borderColor: Colors.amber[500], borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, zIndex: 5 },
  gridPendingText: { fontSize: 9, fontWeight: '700', color: Colors.amber[600] },
  gridBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingTop: 8, gap: 6 },
  gridVisBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, borderWidth: 1.5 },
  gridVisPublic: { backgroundColor: Colors.green[50], borderColor: Colors.green[500] },
  gridVisPrivate: { backgroundColor: Colors.gray[100], borderColor: Colors.gray[300] },
  gridVisText: { fontSize: 9, fontWeight: '700' },
  gridPriceBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, borderWidth: 1.5, backgroundColor: Colors.green[50], borderColor: Colors.green[500] },
  gridPriceText: { fontSize: 9, fontWeight: '700', color: Colors.green[600] },

  // Empty state
  empty: { alignItems: 'center', padding: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.gray[800], marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.gray[500], textAlign: 'center' },
})
