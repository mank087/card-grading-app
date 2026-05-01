import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, ActivityIndicator, TextInput, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/AuthContext'
import { Colors } from '@/lib/constants'
import GradeBadge from '@/components/ui/GradeBadge'
import SlabCard from '@/components/grading/SlabCard'
import { supabase } from '@/lib/supabase'
import { getDisplayName, getContextLine, getFeatures } from '@/lib/labelData'
import { useLabelStyle } from '@/hooks/useLabelStyle'
import LabelStylePicker from '@/components/labels/LabelStylePicker'

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

  const fetchCollection = useCallback(async () => {
    if (!session?.user?.id) return
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
          const { data: urls } = await supabase.storage.from('cards').createSignedUrls(paths, 3600)
          const urlMap = new Map<string, string>()
          urls?.forEach(u => { if (u.signedUrl && u.path) urlMap.set(u.path, u.signedUrl) })
          data.forEach((c: any) => { c.front_url = urlMap.get(c.front_path) || null })
        }
      }

      setCards(data || [])
    } catch (err) {
      console.error('Collection fetch error:', err)
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

  // Stats
  const stats = useMemo(() => {
    const graded = cards.filter(c => c.conversational_whole_grade != null)
    const withPrice = cards.filter(c => c.dcm_price_estimate != null || c.ebay_price_median != null)
    const totalValue = withPrice.reduce((sum, c) => sum + (c.dcm_price_estimate || c.ebay_price_median || 0), 0)
    const avgGrade = graded.length > 0 ? graded.reduce((sum, c) => sum + (c.conversational_whole_grade || 0), 0) / graded.length : 0
    return { total: cards.length, graded: graded.length, totalValue, avgGrade, priced: withPrice.length }
  }, [cards])

  const renderListItem = ({ item }: { item: CardItem }) => {
    const name = getDisplayName(item as any)
    const contextParts = getContextLine(item as any)
    const featuresArr = getFeatures(item as any)
    const condition = item.conversational_condition_label || ''
    const price = item.dcm_price_estimate || item.ebay_price_median

    return (
      <TouchableOpacity style={st.listItem} onPress={() => router.push(`/card/${item.id}`)} activeOpacity={0.7}>
        {item.front_url ? (
          <Image source={{ uri: item.front_url }} style={st.listThumb} resizeMode="cover" />
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
  }

  const renderGridItem = ({ item }: { item: CardItem }) => {
    const name = getDisplayName(item as any)
    const contextLine = getContextLine(item as any)
    const featuresArr = getFeatures(item as any)
    const isPublic = item.visibility === 'public'
    const price = item.dcm_price_estimate || item.ebay_price_median
    return (
      <TouchableOpacity style={st.gridItem} onPress={() => router.push(`/card/${item.id}`)} activeOpacity={0.85}>
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
  }

  if (isLoading) {
    return <View style={st.loadingContainer}><ActivityIndicator size="large" color={Colors.purple[600]} /></View>
  }

  return (
    <View style={st.container}>
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
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.gray[400]} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => setShowSort(!showSort)} style={st.viewToggle}>
          <Ionicons name="swap-vertical" size={20} color={Colors.purple[600]} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setViewMode(v => v === 'list' ? 'grid' : 'list')} style={st.viewToggle}>
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
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode}
        contentContainerStyle={viewMode === 'grid' ? st.gridContainer : st.listContainer}
        refreshing={refreshing}
        onRefresh={onRefresh}
        removeClippedSubviews
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
      />
    </View>
  )
}

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
