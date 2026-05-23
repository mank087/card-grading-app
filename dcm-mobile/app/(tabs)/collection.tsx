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
import GradeBadge from '@/components/ui/GradeBadge'
import SlabCard from '@/components/grading/SlabCard'
import { supabase } from '@/lib/supabase'
import { getDisplayName, getContextLine, getFeatures } from '@/lib/labelData'
import { useLabelStyle } from '@/hooks/useLabelStyle'
import LabelStylePicker from '@/components/labels/LabelStylePicker'
import SlabLabelOptionsSheet from '@/components/labels/SlabLabelOptionsSheet'
import ExportRunner, { type ExportSource } from '@/components/exports/ExportRunner'

// Star Wars was retired as a top-level category and is now an "Other" sub-category.
const CATEGORIES = ['All', 'Sports', 'Pokemon', 'MTG', 'Lorcana', 'One Piece', 'Yu-Gi-Oh', 'Other']
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
  const [sortBy, setSortBy] = useState('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [showSort, setShowSort] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // ---- Multi-select + batch printing ----------------------------------
  // Long-press a card to enter selection mode; then tap toggles selection.
  // Tap-out-of-mode behavior preserved (single tap navigates to /card/[id]).
  // Bottom action bar appears when at least one card is selected.
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
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
    setFetchError(null)
    try {
      const { data, error } = await supabase
        .from('cards')
        .select(`
          id, serial, card_name, featured, category, sub_category, card_set,
          card_number, release_date, manufacturer_name, visibility,
          rookie_card, autographed, serial_numbering,
          conversational_whole_grade, conversational_condition_label,
          conversational_card_info, front_path,
          ebay_price_median, dcm_price_estimate, created_at
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1000)

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
  }, [session?.user?.id])

  useEffect(() => { fetchCollection() }, [fetchCollection])

  const onRefresh = () => { setRefreshing(true); fetchCollection() }

  // Filter + sort + search
  const filteredCards = useMemo(() => {
    let result = cards

    // Category filter
    if (category !== 'All') {
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
  }, [cards, category, search, sortBy, sortAsc])

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

  // Stats
  const stats = useMemo(() => {
    const graded = cards.filter(c => c.conversational_whole_grade != null)
    const withPrice = cards.filter(c => c.dcm_price_estimate != null || c.ebay_price_median != null)
    const totalValue = withPrice.reduce((sum, c) => sum + (c.dcm_price_estimate || c.ebay_price_median || 0), 0)
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
    const price = item.dcm_price_estimate || item.ebay_price_median
    const isSelected = selectedIds.has(item.id)

    return (
      <TouchableOpacity
        style={[st.listItem, isSelected && st.listItemSelected]}
        onPress={() => {
          if (selectionMode) toggleSelected(item.id)
          else router.push(`/card/${item.id}`)
        }}
        onLongPress={() => enterSelectionMode(item.id)}
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
  }, [selectionMode, selectedIds, toggleSelected, enterSelectionMode, router])

  const renderGridItem = useCallback(({ item }: { item: CardItem }) => {
    const name = getDisplayName(item as any)
    const contextLine = getContextLine(item as any)
    const featuresArr = getFeatures(item as any)
    const isPublic = item.visibility === 'public'
    const price = item.dcm_price_estimate || item.ebay_price_median
    const isSelected = selectedIds.has(item.id)
    return (
      <TouchableOpacity
        style={[st.gridItem, isSelected && st.gridItemSelected]}
        onPress={() => {
          if (selectionMode) toggleSelected(item.id)
          else router.push(`/card/${item.id}`)
        }}
        onLongPress={() => enterSelectionMode(item.id)}
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
  }, [selectionMode, selectedIds, toggleSelected, enterSelectionMode, router, labelStyle, colorOverrides])

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
        <TouchableOpacity
          onPress={() => setShowSort(!showSort)}
          style={st.viewToggle}
          accessibilityLabel={showSort ? 'Hide sort options' : 'Show sort options'}
          accessibilityRole="button"
        >
          <Ionicons name="swap-vertical" size={20} color={Colors.purple[600]} />
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

      {/* Sort options */}
      {showSort && (
        <View style={st.sortBar}>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[st.sortChip, sortBy === opt.value && st.sortChipActive]}
              onPress={() => {
                if (sortBy === opt.value) { setSortAsc(!sortAsc) }
                else { setSortBy(opt.value); setSortAsc(false) }
              }}
            >
              <Text style={[st.sortChipText, sortBy === opt.value && st.sortChipTextActive]}>{opt.label}</Text>
              {sortBy === opt.value && <Ionicons name={sortAsc ? 'arrow-up' : 'arrow-down'} size={10} color={Colors.purple[700]} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Category filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.catScroll} contentContainerStyle={st.catContent}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[st.catTab, category === cat && st.catTabActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[st.catTabText, category === cat && st.catTabTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
            <Text style={st.emptyTitle}>{category !== 'All' ? `No ${category} cards` : 'No cards yet'}</Text>
            <Text style={st.emptySubtitle}>
              {category !== 'All' ? 'Try a different category or grade a new card' : 'Grade your first card to start building your collection'}
            </Text>
          </View>
        }
        contentContainerStyle={[viewMode === 'grid' ? st.gridContainer : st.listContainer, selectionMode && selectedIds.size > 0 ? { paddingBottom: 96 } : undefined]}
      />

      {/* Batch action bar — shows when at least one card is selected.
          Two buttons mirror web's "Print" + "Download" dropdowns. */}
      {selectionMode && selectedIds.size > 0 && (
        <View style={[st.batchBar, { paddingBottom: insets.bottom + 10 }]}>
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
    </View>
  )
}

// Batch print types — mirror web's collection page Print dropdown
// (src/app/collection/page.tsx). The single "Graded Slab Label" entry
// opens SlabLabelOptionsSheet for style + format selection (same UX
// as the single-card flow on card/[id].tsx); Avery variants prompt
// for sheet starting position; card-image variants are direct.
const BATCH_PRINT_TYPES: Array<{ id: string; name: string; desc: string; icon: string; opensSlabOptions?: boolean }> = [
  { id: 'slab-options',        name: 'Graded Slab Label',         desc: 'Pick style + format (Modern / Traditional / Custom · Duplex / Fold-Over)', icon: 'card', opensSlabOptions: true },
  { id: 'onetouch',            name: 'Magnetic One-Touch',        desc: 'Avery 6871 — pick starting position', icon: 'magnet' },
  { id: 'toploader',           name: 'Toploader Front + Back',    desc: 'Avery 8167 — pick starting position', icon: 'copy' },
  { id: 'foldover',            name: 'Fold-Over Toploader',       desc: 'Avery 8167 fold-over — pick start position', icon: 'reader' },
  { id: 'card-image-modern',   name: 'Card Image — Modern',       desc: 'JPG with modern dark slab label', icon: 'image' },
  { id: 'card-image-traditional', name: 'Card Image — Traditional', desc: 'JPG with traditional light slab label', icon: 'image-outline' },
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

  // Stats
  statsBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.gray[50] },
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
