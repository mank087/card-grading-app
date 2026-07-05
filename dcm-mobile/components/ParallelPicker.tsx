/**
 * ParallelPicker — native "find the correct card/parallel" searcher for sports
 * cards. Mirrors the web PriceChartingLookup manual search: a free-text query
 * against the LIVE SportsCardsPro catalog (GET /api/pricing/pricecharting/search),
 * a results list, and — for the card owner — tap-to-select which saves the
 * choice (POST /api/pricing/dcm-select) and reprices the card against it.
 *
 * Why search, not a local family list: the local sports_card_products mirror is
 * disabled (SPORTS_LOCAL_DB_ENABLED off), so pricing/matching run against the
 * live API. The search endpoint is the same source, so this always works.
 *
 * Auth mirrors app/card/[id].tsx: the parent passes session.access_token and we
 * send it as a Bearer header. Search is public; dcm-select requires the owner.
 */

import { useEffect, useState, useCallback } from 'react'
import { View, Text, Modal, Pressable, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'

interface SearchResult {
  id: string
  name: string
  setName: string
  hasPrice: boolean
}

interface Props {
  visible: boolean
  onClose: () => void
  /** cards.id — target for the dcm-select save. */
  cardId: string
  /** Prefilled search query (player + year + set + #number). */
  initialQuery: string
  /** Product id currently pricing the card, to mark the active result. */
  currentProductId?: string | null
  /** session.access_token — required to save a selection (owner only). */
  accessToken?: string | null
  /** Only the owner may save; viewers get read-only results. */
  isOwner: boolean
  /** Fired after a successful save with the chosen product id so the parent
   *  can reprice the card against exactly that product. */
  onSelected: (productId: string) => void
}

export default function ParallelPicker({ visible, onClose, cardId, initialQuery, currentProductId, accessToken, isOwner, onSelected }: Props) {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState(initialQuery || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  const runSearch = useCallback(async (q: string) => {
    const term = q.trim()
    if (term.length < 2) {
      setError('Enter at least 2 characters to search.')
      return
    }
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const res = await fetch(`${API_BASE}/api/pricing/pricecharting/search?q=${encodeURIComponent(term)}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) throw new Error(data?.error || `Status ${res.status}`)
      setResults(Array.isArray(data.results) ? data.results : [])
    } catch (err: any) {
      setResults([])
      setError(err?.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [])

  // Reset to the prefilled query and auto-search each time the sheet opens.
  useEffect(() => {
    if (!visible) return
    setQuery(initialQuery || '')
    setResults([])
    setSearched(false)
    setError(null)
    if ((initialQuery || '').trim().length >= 2) runSearch(initialQuery)
  }, [visible, initialQuery, runSearch])

  const handleSelect = async (row: SearchResult) => {
    if (!isOwner || savingId) return
    if (!accessToken) {
      Alert.alert('Sign in required', 'You must be signed in to change the priced card.')
      return
    }
    setSavingId(row.id)
    try {
      const res = await fetch(`${API_BASE}/api/pricing/dcm-select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ cardId, productId: row.id, productName: row.name }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) throw new Error(data?.error || `Status ${res.status}`)
      onSelected(row.id)
      onClose()
    } catch (err: any) {
      console.warn('[ParallelPicker] select failed:', err)
      Alert.alert('Selection failed', err?.message || 'Could not save your selection. Please try again.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={[st.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={e => e.stopPropagation()}>
          <View style={st.handle} />
          <Text style={st.title}>Find the correct card</Text>
          <Text style={st.subtitle}>
            {isOwner
              ? 'Search the SportsCardsPro catalog and tap the exact card/parallel you own to reprice it.'
              : 'Only the card owner can change the priced card.'}
          </Text>

          {/* Search box */}
          <View style={st.searchRow}>
            <Ionicons name="search" size={16} color={Colors.gray[400]} style={{ marginLeft: 10 }} />
            <TextInput
              style={st.input}
              value={query}
              onChangeText={setQuery}
              placeholder="e.g. Patrick Mahomes 2017 Prizm #269"
              placeholderTextColor={Colors.gray[400]}
              returnKeyType="search"
              onSubmitEditing={() => runSearch(query)}
              autoCorrect={false}
            />
            <TouchableOpacity style={st.searchBtn} onPress={() => runSearch(query)} disabled={loading}>
              <Text style={st.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>

          {loading && (
            <View style={st.centerBox}>
              <ActivityIndicator size="large" color={Colors.purple[600]} />
              <Text style={st.centerText}>Searching…</Text>
            </View>
          )}

          {!loading && error && (
            <View style={st.centerBox}>
              <Ionicons name="cloud-offline-outline" size={28} color={Colors.gray[400]} />
              <Text style={st.centerText}>{error}</Text>
              <TouchableOpacity style={st.retryBtn} onPress={() => runSearch(query)}>
                <Ionicons name="refresh" size={14} color={Colors.purple[700]} />
                <Text style={st.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && searched && results.length === 0 && (
            <View style={st.centerBox}>
              <Ionicons name="search-outline" size={28} color={Colors.gray[400]} />
              <Text style={st.centerText}>No matches. Try fewer words — e.g. just the player and year.</Text>
            </View>
          )}

          {!loading && !error && results.length > 0 && (
            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              {results.map(row => {
                const isSelected = currentProductId != null && row.id === currentProductId
                const isSaving = savingId === row.id
                return (
                  <TouchableOpacity
                    key={row.id}
                    style={[st.row, isSelected && st.rowSelected, savingId != null && !isSaving && { opacity: 0.5 }]}
                    onPress={() => handleSelect(row)}
                    disabled={!isOwner || savingId != null}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[st.rowName, isSelected && { color: Colors.purple[700] }]} numberOfLines={2}>
                        {row.name}
                      </Text>
                      <View style={st.rowMetaLine}>
                        <Text style={st.rowSet} numberOfLines={1}>{row.setName}</Text>
                        {row.hasPrice
                          ? <View style={st.pricedChip}><Text style={st.pricedChipText}>Priced</Text></View>
                          : <Text style={st.noPrice}>No price data</Text>}
                      </View>
                    </View>
                    {isSaving
                      ? <ActivityIndicator size="small" color={Colors.purple[600]} />
                      : isSelected
                      ? <Ionicons name="checkmark-circle" size={20} color={Colors.purple[600]} />
                      : isOwner
                      ? <Ionicons name="ellipse-outline" size={20} color={Colors.gray[300]} />
                      : null}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 8 },
  handle: { width: 36, height: 4, backgroundColor: Colors.gray[300], borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.gray[900] },
  subtitle: { fontSize: 11, color: Colors.gray[500], marginBottom: 12, marginTop: 2 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 10,
    backgroundColor: Colors.gray[50], marginBottom: 12,
  },
  input: { flex: 1, fontSize: 14, color: Colors.gray[900], paddingVertical: 10, paddingHorizontal: 8 },
  searchBtn: { backgroundColor: Colors.purple[600], paddingHorizontal: 14, paddingVertical: 10, borderTopRightRadius: 9, borderBottomRightRadius: 9 },
  searchBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },

  centerBox: { alignItems: 'center', paddingVertical: 28, gap: 8, paddingHorizontal: 12 },
  centerText: { fontSize: 12, color: Colors.gray[500], textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: Colors.purple[50], borderWidth: 1, borderColor: Colors.purple[200], borderRadius: 8, marginTop: 4,
  },
  retryText: { fontSize: 11, fontWeight: '700', color: Colors.purple[700] },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 10, marginBottom: 8, backgroundColor: Colors.gray[50],
  },
  rowSelected: { borderColor: Colors.purple[600], backgroundColor: Colors.purple[50] },
  rowName: { fontSize: 13, fontWeight: '700', color: Colors.gray[900] },
  rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  rowSet: { fontSize: 11, color: Colors.gray[500], flexShrink: 1 },
  pricedChip: { backgroundColor: Colors.green[50], borderWidth: 1, borderColor: Colors.green[100], borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  pricedChipText: { fontSize: 9, fontWeight: '700', color: Colors.green[600] },
  noPrice: { fontSize: 10, color: Colors.gray[400] },
})
