import { useMemo, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, Modal, TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'
import type { MarketplaceListing } from '@/lib/marketplaceApi'
import ListingCard from './ListingCard'

type Mode = 'active' | 'sold' | 'ended'
type SortKey = 'date' | 'price' | 'name'

const SORT_LABELS: Record<SortKey, string> = {
  date: 'Date (newest first)',
  price: 'Price (high → low)',
  name: 'Card name (A–Z)',
}

interface Props {
  mode: Mode
  listings: MarketplaceListing[]
  refreshing: boolean
  onRefresh: () => void
  onRelist?: (cardId: string) => void
}

/**
 * Reusable tab for Active/Sold/Ended. Each mode swaps the empty-state
 * copy, accent color, and date field, but the layout, sort, and pull-
 * to-refresh behavior are identical — which is why mobile collapses
 * the three web tabs into one component instead of three near-copies.
 */
export default function ListingsTab({ mode, listings, refreshing, onRefresh, onRelist }: Props) {
  const [sort, setSort] = useState<SortKey>('date')
  const [showSortSheet, setShowSortSheet] = useState(false)
  const [query, setQuery] = useState('')

  const sorted = useMemo(() => {
    // Filter by search first, then sort.
    const q = query.trim().toLowerCase()
    let arr = q
      ? listings.filter(l =>
          (l.cardName || '').toLowerCase().includes(q) ||
          (l.title || '').toLowerCase().includes(q),
        )
      : [...listings]
    if (sort === 'price') {
      arr.sort((a, b) => safe(b.price) - safe(a.price))
    } else if (sort === 'name') {
      arr.sort((a, b) => (a.cardName || '').localeCompare(b.cardName || ''))
    } else {
      // Date — uses mode-appropriate field
      const dateOf = (l: MarketplaceListing) => {
        const v = mode === 'sold' ? l.soldAt : mode === 'ended' ? l.endedAt : l.publishedAt
        return v ? new Date(v).getTime() : 0
      }
      arr.sort((a, b) => dateOf(b) - dateOf(a))
    }
    return arr
  }, [listings, sort, mode, query])

  // Sold-tab strip: "Lifetime gross" total.
  const totalGross = useMemo(() => {
    if (mode !== 'sold') return 0
    return listings.reduce((sum, l) => sum + safe(l.price) * Math.max(1, l.quantitySold), 0)
  }, [listings, mode])

  const renderItem = useCallback(({ item }: { item: MarketplaceListing }) => (
    <ListingCard listing={item} mode={mode} onRelist={onRelist} />
  ), [mode, onRelist])

  const keyExtractor = useCallback((l: MarketplaceListing) => l.id, [])

  if (listings.length === 0) {
    return (
      <FlatList
        data={[]}
        renderItem={() => null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.purple[600]} />}
        ListEmptyComponent={<EmptyState mode={mode} />}
        contentContainerStyle={styles.emptyContainer}
      />
    )
  }

  return (
    <>
      {/* Sold-only lifetime gross strip */}
      {mode === 'sold' && (
        <View style={styles.grossStrip}>
          <Text style={styles.grossLabel}>Lifetime gross</Text>
          <Text style={styles.grossValue}>${totalGross.toFixed(2)}</Text>
        </View>
      )}

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={Colors.gray[400]} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by card name or title"
            placeholderTextColor={Colors.gray[400]}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <View style={styles.toolbar}>
        <Text style={styles.count}>
          {sorted.length}{query.trim() ? ` of ${listings.length}` : ''} {listings.length === 1 ? 'listing' : 'listings'}
        </Text>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSortSheet(true)}
          accessibilityRole="button"
          accessibilityLabel="Sort listings"
        >
          <Ionicons name="swap-vertical" size={14} color={Colors.purple[600]} />
          <Text style={styles.sortButtonText}>{SORT_LABELS[sort]}</Text>
        </TouchableOpacity>
      </View>

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
            <Text style={styles.sheetTitle}>Sort by</Text>
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
        data={sorted}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.purple[600]} />}
      />
    </>
  )
}

function EmptyState({ mode }: { mode: Mode }) {
  const { icon, title, body } = (() => {
    if (mode === 'active') return {
      icon: 'pricetag' as const,
      title: 'No active listings yet',
      body: "Pick a card from the 'List a Card' tab to publish your first listing.",
    }
    if (mode === 'sold') return {
      icon: 'cart' as const,
      title: 'No sales yet',
      body: 'Your sold listings will show up here once buyers complete purchases.',
    }
    return {
      icon: 'time' as const,
      title: 'No ended listings',
      body: 'Listings that end without selling will appear here. You can relist them in one tap.',
    }
  })()

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={Colors.gray[400]} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  )
}

function safe(n: any): number {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : 0
}

const styles = StyleSheet.create({
  grossStrip: {
    backgroundColor: Colors.green[50],
    borderColor: Colors.green[100], borderWidth: 1,
    borderRadius: 12, padding: 14,
    marginHorizontal: 12, marginTop: 8,
  },
  grossLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.green[600],
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  grossValue: { fontSize: 22, fontWeight: '800', color: Colors.gray[900], marginTop: 2 },
  searchRow: {
    paddingHorizontal: 12, paddingTop: 10,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.white,
    borderColor: Colors.gray[200], borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1, paddingVertical: 8, fontSize: 14, color: Colors.gray[900],
  },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  count: {
    fontSize: 11, fontWeight: '700', color: Colors.gray[500],
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  sortButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 5, paddingHorizontal: 8,
    backgroundColor: Colors.purple[50],
    borderRadius: 6,
  },
  sortButtonText: { fontSize: 12, fontWeight: '600', color: Colors.purple[700] },
  listContent: { paddingHorizontal: 12, paddingBottom: 24 },
  separator: { height: 8 },
  emptyContainer: { flexGrow: 1 },
  emptyState: { padding: 32, alignItems: 'center', marginTop: 40 },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.gray[100],
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], textAlign: 'center', marginBottom: 6 },
  emptyBody: { fontSize: 13, color: Colors.gray[600], textAlign: 'center', maxWidth: 280, lineHeight: 18 },
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
