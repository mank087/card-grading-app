import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Colors } from '@/lib/constants'
import GradeBadge from '@/components/ui/GradeBadge'
import { supabase } from '@/lib/supabase'

interface CardItem {
  id: string
  serial: string
  card_name: string | null
  category: string
  conversational_whole_grade: number | null
  conversational_condition_label: string | null
  front_path: string
  front_url?: string
  created_at: string
}

export default function CollectionScreen() {
  const { session } = useAuth()
  const router = useRouter()
  const [cards, setCards] = useState<CardItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchCollection = useCallback(async () => {
    if (!session) return
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('id, serial, card_name, category, conversational_whole_grade, conversational_condition_label, front_path, created_at')
        .eq('user_id', session.user.id)
        .not('conversational_whole_grade', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      // Get signed URLs for images
      if (data && data.length > 0) {
        const paths = data.map(c => c.front_path).filter(Boolean)
        const { data: urls } = await supabase.storage.from('cards').createSignedUrls(paths, 3600)
        const urlMap = new Map<string, string>()
        urls?.forEach(u => { if (u.signedUrl && u.path) urlMap.set(u.path, u.signedUrl) })
        data.forEach(c => { c.front_url = urlMap.get(c.front_path) || undefined })
      }

      setCards(data || [])
    } catch (err) {
      console.error('Collection fetch error:', err)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [session])

  useEffect(() => { fetchCollection() }, [fetchCollection])

  const onRefresh = () => {
    setRefreshing(true)
    fetchCollection()
  }

  const renderCard = ({ item }: { item: CardItem }) => (
    <TouchableOpacity
      style={styles.cardItem}
      onPress={() => router.push(`/card/${item.id}`)}
      activeOpacity={0.7}
    >
      {item.front_url ? (
        <Image source={{ uri: item.front_url }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, styles.placeholderImage]}>
          <Text style={styles.placeholderText}>DCM</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>
          {item.card_name || `Card #${item.serial}`}
        </Text>
        <Text style={styles.cardCategory}>{item.category}</Text>
      </View>
      <GradeBadge grade={item.conversational_whole_grade} size="sm" />
    </TouchableOpacity>
  )

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.purple[600]} />
      </View>
    )
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={cards.length === 0 ? styles.emptyContainer : styles.listContent}
      data={cards}
      keyExtractor={(item) => item.id}
      renderItem={renderCard}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No cards yet</Text>
          <Text style={styles.emptySubtitle}>Grade your first card to start building your collection</Text>
        </View>
      }
    />
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  listContent: { padding: 12 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.gray[50] },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.gray[800], marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.gray[500], textAlign: 'center' },
  cardItem: {
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
  cardImage: { width: 50, height: 70, borderRadius: 6 },
  placeholderImage: { backgroundColor: Colors.gray[200], alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: Colors.gray[400], fontSize: 10, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '600', color: Colors.gray[900] },
  cardCategory: { fontSize: 12, color: Colors.gray[500], marginTop: 2 },
})
