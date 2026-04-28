import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native'
import { useRouter } from 'expo-router'
import { useEffect, useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/AuthContext'
import { Colors } from '@/lib/constants'
import GradeBadge from '@/components/ui/GradeBadge'
import SlabCard from '@/components/grading/SlabCard'
import { supabase } from '@/lib/supabase'

interface CardItem {
  id: string
  serial: string
  card_name: string | null
  featured: string | null
  category: string
  card_set: string | null
  conversational_whole_grade: number | null
  conversational_condition_label: string | null
  conversational_card_info: any
  front_path: string
  front_url?: string
  created_at: string
  ebay_price_median: number | null
  dcm_price_estimate: number | null
}

export default function CollectionScreen() {
  const { session } = useAuth()
  const router = useRouter()
  const [cards, setCards] = useState<CardItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  const fetchCollection = useCallback(async () => {
    if (!session?.user?.id) return
    try {
      let query = supabase
        .from('cards')
        .select(`
          id, serial, card_name, featured, category, card_set,
          card_number, release_date, manufacturer_name,
          conversational_whole_grade, conversational_condition_label,
          conversational_card_info, front_path,
          ebay_price_median, dcm_price_estimate, created_at
        `)
        .eq('user_id', session.user.id)
        .not('conversational_whole_grade', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (search) {
        query = query.or(`serial.ilike.%${search}%,card_name.ilike.%${search}%`)
      }

      const { data, error } = await query
      if (error) throw error

      // Get signed URLs for thumbnails
      if (data && data.length > 0) {
        const paths = data.map(c => c.front_path).filter(Boolean)
        const { data: urls } = await supabase.storage.from('cards').createSignedUrls(paths, 3600)
        const urlMap = new Map<string, string>()
        urls?.forEach(u => { if (u.signedUrl && u.path) urlMap.set(u.path, u.signedUrl) })
        data.forEach((c: any) => { c.front_url = urlMap.get(c.front_path) || null })
      }

      setCards(data || [])
    } catch (err) {
      console.error('Collection fetch error:', err)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [session?.user?.id, search])

  useEffect(() => { fetchCollection() }, [fetchCollection])

  const onRefresh = () => {
    setRefreshing(true)
    fetchCollection()
  }

  const renderListItem = ({ item }: { item: CardItem }) => {
    const ci = item.conversational_card_info
    const name = item.card_name || item.featured || ci?.card_name || `Card #${item.serial}`
    const set = item.card_set || ci?.set_name || ''
    const year = item.release_date || ci?.year || ''
    const num = item.card_number || ci?.card_number || ''
    const condition = item.conversational_condition_label || ''
    const contextParts = [set, num ? `#${num}` : '', year].filter(Boolean).join(' \u2022 ')
    const price = item.ebay_price_median || item.dcm_price_estimate

    return (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => router.push(`/card/${item.id}`)}
        activeOpacity={0.7}
      >
        {item.front_url ? (
          <Image source={{ uri: item.front_url }} style={styles.listThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.listThumb, styles.placeholder]}>
            <Text style={styles.placeholderText}>DCM</Text>
          </View>
        )}
        <View style={styles.listInfo}>
          <Text style={styles.listName} numberOfLines={1}>{name}</Text>
          <Text style={styles.listSet} numberOfLines={1}>{contextParts}</Text>
          <View style={styles.listMeta}>
            <Text style={styles.listCategory}>{item.category}</Text>
            {condition ? <Text style={styles.listCondition}>{condition}</Text> : null}
            {price ? <Text style={styles.listPrice}>${price.toFixed(2)}</Text> : null}
          </View>
        </View>
        <GradeBadge grade={item.conversational_whole_grade} size="sm" />
      </TouchableOpacity>
    )
  }

  const renderGridItem = ({ item }: { item: CardItem }) => {
    const ci = item.conversational_card_info
    const name = item.card_name || item.featured || ci?.card_name || `#${item.serial}`
    const set = item.card_set || ci?.set_name || ''

    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => router.push(`/card/${item.id}`)}
        activeOpacity={0.7}
      >
        <SlabCard
          imageUrl={item.front_url || null}
          displayName={name}
          contextLine={set}
          serial={item.serial}
          grade={item.conversational_whole_grade}
          condition={item.conversational_condition_label || ''}
          size="sm"
        />
      </TouchableOpacity>
    )
  }

  if (isLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.purple[600]} /></View>
  }

  return (
    <View style={styles.container}>
      {/* Search + View Toggle */}
      <View style={styles.toolbar}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={Colors.gray[400]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search cards..."
            placeholderTextColor={Colors.gray[400]}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={fetchCollection}
            returnKeyType="search"
          />
          {search !== '' && (
            <TouchableOpacity onPress={() => { setSearch(''); }}>
              <Ionicons name="close-circle" size={18} color={Colors.gray[400]} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => setViewMode(v => v === 'list' ? 'grid' : 'list')} style={styles.viewToggle}>
          <Ionicons name={viewMode === 'list' ? 'grid' : 'list'} size={20} color={Colors.purple[600]} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>{cards.length} cards</Text>
      </View>

      {/* Card List */}
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        renderItem={viewMode === 'list' ? renderListItem : renderGridItem}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode}
        contentContainerStyle={viewMode === 'grid' ? styles.gridContainer : styles.listContainer}
        refreshing={refreshing}
        onRefresh={onRefresh}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={8}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="albums-outline" size={72} color={Colors.gray[300]} />
            <Text style={styles.emptyTitle}>No cards yet</Text>
            <Text style={styles.emptySubtitle}>Grade your first card to start building your collection</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.gray[50] },

  // Toolbar
  toolbar: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[200] },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.gray[100], borderRadius: 10, paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: Colors.gray[900] },
  viewToggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gray[100], borderRadius: 10 },

  // Stats
  statsBar: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.gray[50] },
  statsText: { fontSize: 12, color: Colors.gray[500], fontWeight: '600' },

  // List view
  listContainer: { padding: 12 },
  listItem: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    gap: 12,
  },
  listThumb: { width: 50, height: 70, borderRadius: 6 },
  placeholder: { backgroundColor: Colors.gray[200], alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: Colors.gray[400], fontSize: 10, fontWeight: '700' },
  listInfo: { flex: 1 },
  listName: { fontSize: 14, fontWeight: '600', color: Colors.gray[900] },
  listSet: { fontSize: 12, color: Colors.gray[500], marginTop: 2 },
  listMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  listCategory: { fontSize: 11, color: Colors.purple[600], fontWeight: '500' },
  listCondition: { fontSize: 10, color: Colors.purple[600], fontWeight: '500' },
  listPrice: { fontSize: 11, color: Colors.green[600], fontWeight: '600' },

  // Grid view
  gridContainer: { padding: 8 },
  gridItem: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    margin: 4,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    overflow: 'hidden',
  },
  gridImage: { width: '100%', aspectRatio: 0.714, },
  gridInfo: { padding: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gridName: { fontSize: 11, fontWeight: '600', color: Colors.gray[900], flex: 1, marginRight: 4 },

  // Empty state
  empty: { alignItems: 'center', padding: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.gray[800], marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.gray[500], textAlign: 'center' },
})
