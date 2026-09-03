import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Image, StyleSheet,
  Modal,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Colors } from '@/lib/constants'
import type { EligibleCard } from '@/lib/marketplaceApi'
import { BATCH_CAP_MESSAGE } from '@/lib/ebayBulkTypes'

type SortKey = 'recent' | 'name' | 'grade' | 'value'

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Most recent',
  name: 'Name (A–Z)',
  grade: 'Grade (high → low)',
  value: 'Value (high → low)',
}

interface Props {
  cards: EligibleCard[]
  truncated?: boolean
  /** True while a debounced server fetch is in flight for a search query. */
  searchInFlight?: boolean
  onSelect: (card: EligibleCard) => void
  onRefresh: () => void
  refreshing: boolean
  /** Fires after a 250ms debounce of the search input — parent runs the
   *  server fetch with `?q=`. Empty string clears the search. */
  onSearchQueryChange?: (q: string) => void

  // ── Bulk selection (all optional; omitting them leaves the picker exactly
  //    as it was — single tap opens the one-card wizard and nothing else).
  /** Enables long-press-to-select. The PARENT owns the selection state so it
   *  survives a re-render of this list and can drive its own action bar. */
  selectable?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  /** Hard cap; "Select all visible" fills up to it and never past it. */
  selectionLimit?: number
  /** Called with the visible cards, in the order shown, up to the cap. */
  onSelectAllVisible?: (ids: string[]) => void
  onClearSelection?: () => void
  /**
   * Bump this when the parent has USED the selection (it started a batch) and
   * the picker should drop out of selection mode. Not the same as the set going
   * empty — clearing the last checkbox by hand keeps the mode on, as it should.
   */
  selectionResetKey?: number
}

/** How long the "that's over the cap" notice stays up. */
const CAP_NOTICE_MS = 4000

/**
 * Left-rail card grid on web; full-screen FlatList on mobile. Mirrors the
 * web CardPicker's search/filter/sort surface but adapts to mobile (sort
 * is a bottom sheet, category filter is a horizontal pill row).
 */
export default function CardPicker({
  cards, truncated, searchInFlight, onSelect, onRefresh, refreshing, onSearchQueryChange,
  selectable = false, selectedIds, onToggleSelect, selectionLimit = 100,
  onSelectAllVisible, onClearSelection, selectionResetKey,
}: Props) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [showSortSheet, setShowSortSheet] = useState(false)
  // Selection MODE is local (it's a view state); the selected SET is the
  // parent's, so the action bar and the batch POST read one source.
  const [selectionMode, setSelectionMode] = useState(false)
  const [capNotice, setCapNotice] = useState<string | null>(null)

  // Debounce the query → server fetch. 250ms feels snappy without
  // hammering the API. Cancel on every keystroke so we only fire the
  // request once the user pauses typing.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!onSearchQueryChange) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSearchQueryChange(query.trim())
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, onSearchQueryChange])

  const filtered = useMemo(() => {
    // Server already filtered by query when search is active; we keep
    // a thin local re-filter so the picker stays instant while the
    // debounced fetch is in flight (no flicker of unfiltered cards).
    let result = cards
    const q = query.trim().toLowerCase()
    if (q) {
      result = result.filter(c =>
        (c.card_name || '').toLowerCase().includes(q) ||
        (c.serial || '').toLowerCase().includes(q),
      )
    }
    const sorted = [...result]
    if (sort === 'name') sorted.sort((a, b) => (a.card_name || '').localeCompare(b.card_name || ''))
    else if (sort === 'grade') sorted.sort((a, b) => (b.conversational_whole_grade ?? 0) - (a.conversational_whole_grade ?? 0))
    else if (sort === 'value') {
      sorted.sort((a, b) => {
        const av = a.ebay_price_median ?? a.dcm_price_estimate ?? 0
        const bv = b.ebay_price_median ?? b.dcm_price_estimate ?? 0
        return bv - av
      })
    }
    return sorted
  }, [cards, query, sort])

  const selectedCount = selectedIds?.size ?? 0

  // Leaving selection mode always clears — a hidden selection that resurfaces
  // on the next long-press is the classic multi-select trap.
  const exitSelection = useCallback(() => {
    setSelectionMode(false)
    setCapNotice(null)
    onClearSelection?.()
  }, [onClearSelection])

  // The batch screen is pushed on top of this one, so without this the picker
  // is still sitting in selection mode — reading "0 of 100 selected" — when the
  // seller comes back. Skips the first run so the prop's initial value (and its
  // absence) changes nothing.
  const firstResetKey = useRef(true)
  useEffect(() => {
    if (firstResetKey.current) { firstResetKey.current = false; return }
    setSelectionMode(false)
    setCapNotice(null)
  }, [selectionResetKey])

  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showCapNotice = useCallback((message: string) => {
    setCapNotice(message)
    if (capTimer.current) clearTimeout(capTimer.current)
    capTimer.current = setTimeout(() => setCapNotice(null), CAP_NOTICE_MS)
  }, [])
  useEffect(() => () => { if (capTimer.current) clearTimeout(capTimer.current) }, [])

  const handleToggle = useCallback((id: string) => {
    const alreadyOn = selectedIds?.has(id) ?? false
    if (!alreadyOn && selectedCount >= selectionLimit) {
      // Refuse rather than silently swap one card for another.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
      showCapNotice(BATCH_CAP_MESSAGE)
      return
    }
    Haptics.selectionAsync().catch(() => {})
    onToggleSelect?.(id)
  }, [selectedIds, selectedCount, selectionLimit, onToggleSelect, showCapNotice])

  const handleLongPress = useCallback((id: string) => {
    if (!selectable) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    if (!selectionMode) setSelectionMode(true)
    if (!selectedIds?.has(id)) onToggleSelect?.(id)
  }, [selectable, selectionMode, selectedIds, onToggleSelect])

  const handleSelectAllVisible = useCallback(() => {
    // Cap-aware, and in the order the seller is looking at — the first N of
    // the current filter+sort, so "Select all" after sorting by value means
    // "the N most valuable".
    const ids = filtered.slice(0, selectionLimit).map(c => c.id)
    if (filtered.length > selectionLimit) showCapNotice(BATCH_CAP_MESSAGE)
    Haptics.selectionAsync().catch(() => {})
    onSelectAllVisible?.(ids)
  }, [filtered, selectionLimit, onSelectAllVisible, showCapNotice])

  return (
    <View style={styles.container}>
      {selectable && selectionMode && (
        <View style={styles.selectionBar}>
          <TouchableOpacity
            onPress={exitSelection}
            style={styles.selectionAction}
            accessibilityLabel="Cancel selection"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={20} color={Colors.gray[700]} />
          </TouchableOpacity>
          <Text style={styles.selectionCount} accessibilityLiveRegion="polite">
            {selectedCount} of {selectionLimit} selected
          </Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={handleSelectAllVisible}
            style={styles.selectionAction}
            accessibilityLabel="Select all visible cards"
            accessibilityRole="button"
          >
            <Text style={styles.selectionActionText}>Select all visible</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setCapNotice(null); onClearSelection?.() }}
            style={styles.selectionAction}
            accessibilityLabel="Clear selected cards"
            accessibilityRole="button"
          >
            <Text style={styles.selectionActionText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectionMode(false)}
            style={styles.selectionAction}
            accessibilityLabel="Done selecting"
            accessibilityRole="button"
          >
            <Text style={[styles.selectionActionText, styles.selectionActionDone]}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {capNotice && (
        <View style={styles.capNotice}>
          <Ionicons name="alert-circle" size={14} color={Colors.amber[600]} />
          <Text style={styles.capNoticeText}>{capNotice}</Text>
        </View>
      )}

      {truncated && (
        <View style={styles.truncatedBanner}>
          <Ionicons name="information-circle" size={14} color={Colors.amber[600]} />
          <Text style={styles.truncatedText}>
            {query.trim()
              ? `100+ matches. Refine your search to narrow it down.`
              : `Showing your 2000 most recently graded cards. Use search to find older ones.`}
          </Text>
        </View>
      )}

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={Colors.gray[400]} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search across your collection"
            placeholderTextColor={Colors.gray[400]}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchInFlight && (
            <View style={{ marginLeft: 4 }}>
              <Ionicons name="ellipsis-horizontal" size={14} color={Colors.gray[400]} />
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSortSheet(true)}
          accessibilityLabel="Sort cards"
          accessibilityRole="button"
        >
          <Ionicons name="swap-vertical" size={16} color={Colors.purple[600]} />
          <Text style={styles.sortButtonText}>Sort</Text>
        </TouchableOpacity>
      </View>

      {/* Sort bottom sheet — light-weight, no extra deps */}
      <Modal
        animationType="fade"
        transparent
        visible={showSortSheet}
        onRequestClose={() => setShowSortSheet(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setShowSortSheet(false)}
        >
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>Sort cards by</Text>
            {(Object.keys(SORT_LABELS) as SortKey[]).map(key => {
              const active = sort === key
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => { setSort(key); setShowSortSheet(false) }}
                  style={styles.sheetRow}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sheetRowText, active && styles.sheetRowTextActive]}>
                    {SORT_LABELS[key]}
                  </Text>
                  {active && <Ionicons name="checkmark" size={18} color={Colors.purple[600]} />}
                </TouchableOpacity>
              )
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No matching cards.</Text>
          </View>
        }
        ListHeaderComponent={
          <Text style={styles.resultCount}>
            {filtered.length} {filtered.length === 1 ? 'card' : 'cards'} ready to list
            {selectable && !selectionMode ? ' · hold to pick several' : ''}
          </Text>
        }
        extraData={selectionMode ? selectedIds : null}
        renderItem={({ item }) => {
          const picking = selectable && selectionMode
          const checked = selectedIds?.has(item.id) ?? false
          return (
          <TouchableOpacity
            style={[styles.row, picking && checked && styles.rowChecked]}
            onPress={() => (picking ? handleToggle(item.id) : onSelect(item))}
            onLongPress={selectable ? () => handleLongPress(item.id) : undefined}
            delayLongPress={350}
            activeOpacity={0.7}
            accessibilityLabel={picking
              ? `${checked ? 'Deselect' : 'Select'} ${item.card_name}`
              : `List ${item.card_name}`}
            accessibilityRole={picking ? 'checkbox' : 'button'}
            accessibilityState={picking ? { checked } : undefined}
          >
            {picking && (
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={22}
                color={checked ? Colors.purple[600] : Colors.gray[400]}
              />
            )}
            <View style={styles.thumb}>
              {item.front_url ? (
                <Image source={{ uri: item.front_url }} style={styles.thumbImg} resizeMode="cover" />
              ) : null}
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowName} numberOfLines={1}>{item.card_name}</Text>
              <Text style={styles.rowMeta}>
                {item.category}{item.serial ? ` · #${item.serial}` : ''}
              </Text>
              <View style={styles.rowChipRow}>
                {item.conversational_whole_grade != null && (
                  <View style={styles.gradeChip}>
                    <Text style={styles.gradeChipText}>Grade {item.conversational_whole_grade}</Text>
                  </View>
                )}
                {(item.ebay_price_median ?? item.dcm_price_estimate) != null && (
                  <Text style={styles.rowPrice}>
                    ~${((item.ebay_price_median ?? item.dcm_price_estimate) ?? 0).toFixed(2)}
                  </Text>
                )}
              </View>
            </View>
            {!picking && <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} />}
          </TouchableOpacity>
          )
        }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={filtered.length === 0 ? styles.listEmpty : undefined}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  truncatedBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.amber[50],
    borderColor: Colors.amber[100], borderWidth: 1,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
    marginHorizontal: 12, marginTop: 8,
  },
  truncatedText: { flex: 1, fontSize: 11, color: Colors.amber[600], lineHeight: 15 },
  selectionBar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[200],
    paddingHorizontal: 8, paddingVertical: 8,
  },
  selectionAction: { paddingHorizontal: 6, paddingVertical: 4 },
  selectionActionText: { fontSize: 12, fontWeight: '700', color: Colors.purple[600] },
  selectionActionDone: { color: Colors.gray[700] },
  selectionCount: { fontSize: 13, fontWeight: '700', color: Colors.gray[900] },
  capNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.amber[50],
    borderColor: Colors.amber[200], borderWidth: 1,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
    marginHorizontal: 12, marginTop: 8,
  },
  capNoticeText: { flex: 1, fontSize: 11, color: Colors.amber[700], lineHeight: 15 },
  searchRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.white,
    borderColor: Colors.gray[200], borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1, paddingVertical: 8, fontSize: 14, color: Colors.gray[900],
  },
  sortButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.white,
    borderColor: Colors.purple[200], borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12,
  },
  sortButtonText: { fontSize: 13, fontWeight: '600', color: Colors.purple[700] },
  resultCount: {
    fontSize: 11, fontWeight: '600', color: Colors.gray[500],
    paddingHorizontal: 12, paddingVertical: 8, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: Colors.white,
  },
  rowChecked: { backgroundColor: Colors.purple[50] },
  thumb: {
    width: 48, height: 64, borderRadius: 6,
    backgroundColor: Colors.gray[100], overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 14, fontWeight: '700', color: Colors.gray[900] },
  rowMeta: { fontSize: 11, color: Colors.gray[500], marginTop: 2 },
  rowChipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  gradeChip: {
    backgroundColor: Colors.green[50],
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  gradeChipText: { fontSize: 10, fontWeight: '800', color: Colors.green[600] },
  rowPrice: { fontSize: 11, color: Colors.gray[600] },
  separator: { height: 1, backgroundColor: Colors.gray[100] },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, color: Colors.gray[500] },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32,
  },
  sheetTitle: {
    fontSize: 13, fontWeight: '700', color: Colors.gray[500],
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingBottom: 8,
  },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.gray[100],
  },
  sheetRowText: { fontSize: 15, color: Colors.gray[700] },
  sheetRowTextActive: { color: Colors.purple[600], fontWeight: '700' },
})
