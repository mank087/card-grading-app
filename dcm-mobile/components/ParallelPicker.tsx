/**
 * ParallelPicker — native "find the correct card/parallel/variant" picker.
 *
 * Two modes, mirroring what the web pricing components do per category:
 *
 *  • Sports ("search" mode) — free-text query against the LIVE SportsCardsPro
 *    catalog (GET /api/pricing/pricecharting/search), same as the web
 *    PriceChartingLookup manual search. The local sports_card_products mirror
 *    is disabled (SPORTS_LOCAL_DB_ENABLED off) so the live search is the only
 *    reliable source.
 *
 *  • Everything else ("variants" mode) — POST the card's identity fields to
 *    /api/pricing/{pokemon,mtg,lorcana,onepiece,other} with includeVariants:true
 *    and list data.availableVariants. This is exactly what the web
 *    {Pokemon,MTG,Lorcana,OnePiece,Other}PriceLookup "Load available variants"
 *    buttons do. There is no free-text catalog search for these categories —
 *    /api/pricing/pricecharting/search only covers SportsCardsPro.
 *
 * The parent supplies the variants request (path + body) because it already
 * knows how to pull each category's identity fields off the card row; see
 * buildVariantLookup() in app/card/[id].tsx. The body must NOT carry cardId or
 * selectedProductId — the category routes short-circuit to the price cache in
 * that case and never compute availableVariants.
 *
 * Selecting saves via POST /api/pricing/dcm-select (owner-only) and the parent
 * then reprices against exactly that product id.
 *
 * Auth mirrors app/card/[id].tsx: the parent passes session.access_token and we
 * send it as a Bearer header. Search/variants are public; dcm-select is owner-only.
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

/** POST target + body for the non-sports includeVariants lookup. */
export interface VariantLookup {
  path: string
  body: Record<string, unknown>
}

interface Props {
  visible: boolean
  onClose: () => void
  /** cards.id — target for the dcm-select save. */
  cardId: string
  /** cards.category — decides search vs variants mode. */
  category?: string | null
  /** Sports only: prefilled search query (player + year + set + #number). */
  initialQuery?: string
  /** Non-sports: the /api/pricing/{category} variants request. */
  variantLookup?: VariantLookup | null
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

export default function ParallelPicker({
  visible,
  onClose,
  cardId,
  category,
  initialQuery,
  variantLookup,
  currentProductId,
  accessToken,
  isOwner,
  onSelected,
}: Props) {
  const insets = useSafeAreaInsets()
  const isSearchMode = (category || '') === 'Sports'
  const [query, setQuery] = useState(initialQuery || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Sports: free-text SportsCardsPro catalog search.
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

  // Everything else: the category route's includeVariants list.
  const runVariants = useCallback(async (lookup: VariantLookup) => {
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const res = await fetch(`${API_BASE}${lookup.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lookup.body, includeVariants: true }),
      })
      const data = await res.json().catch(() => null)
      // 404 "No matching products found" is a legitimate empty result, not an
      // error worth a red box — fall through to the empty state.
      if (!data?.success) {
        if (res.status === 404 || data?.useEbayFallback) {
          setResults([])
          return
        }
        throw new Error(data?.error || `Status ${res.status}`)
      }
      const variants = Array.isArray(data?.data?.availableVariants) ? data.data.availableVariants : []
      setResults(variants.map((v: any) => ({
        id: String(v.id),
        name: v.name || '',
        // MTG/Pokemon/Lorcana/One Piece return setName; Other returns consoleName.
        setName: v.setName || v.consoleName || '',
        hasPrice: !!v.hasPrice,
      })))
    } catch (err: any) {
      setResults([])
      setError(err?.message || 'Could not load matching cards')
    } finally {
      setLoading(false)
    }
  }, [])

  const reload = useCallback(() => {
    if (isSearchMode) runSearch(query)
    else if (variantLookup) runVariants(variantLookup)
  }, [isSearchMode, query, variantLookup, runSearch, runVariants])

  // Reset and re-run each time the sheet opens.
  useEffect(() => {
    if (!visible) return
    setResults([])
    setSearched(false)
    setError(null)
    if (isSearchMode) {
      setQuery(initialQuery || '')
      if ((initialQuery || '').trim().length >= 2) runSearch(initialQuery || '')
    } else if (variantLookup) {
      runVariants(variantLookup)
    } else {
      setSearched(true)
    }
    // variantLookup is rebuilt per render by the parent; key on its path/body
    // contents rather than identity so we don't loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isSearchMode, initialQuery, variantLookup?.path, JSON.stringify(variantLookup?.body)])

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

  const subtitle = !isOwner
    ? 'Only the card owner can change the priced card.'
    : isSearchMode
    ? 'Search the SportsCardsPro catalog and tap the exact card/parallel you own to reprice it.'
    : 'Tap the exact printing/variant you own to reprice it against that product.'

  const emptyText = isSearchMode
    ? 'No matches. Try fewer words — e.g. just the player and year.'
    : 'No other printings found for this card. Try refreshing the price, or edit the card details so the lookup can find it.'

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={[st.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={e => e.stopPropagation()}>
          <View style={st.handle} />
          <Text style={st.title}>{isSearchMode ? 'Find the correct card' : 'Choose the correct printing'}</Text>
          <Text style={st.subtitle}>{subtitle}</Text>

          {/* Search box (sports only — the other categories have no free-text catalog search) */}
          {isSearchMode && (
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
          )}

          {loading && (
            <View style={st.centerBox}>
              <ActivityIndicator size="large" color={Colors.purple[600]} />
              <Text style={st.centerText}>{isSearchMode ? 'Searching…' : 'Loading printings…'}</Text>
            </View>
          )}

          {!loading && error && (
            <View style={st.centerBox}>
              <Ionicons name="cloud-offline-outline" size={28} color={Colors.gray[400]} />
              <Text style={st.centerText}>{error}</Text>
              <TouchableOpacity style={st.retryBtn} onPress={reload}>
                <Ionicons name="refresh" size={14} color={Colors.purple[700]} />
                <Text style={st.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && searched && results.length === 0 && (
            <View style={st.centerBox}>
              <Ionicons name="search-outline" size={28} color={Colors.gray[400]} />
              <Text style={st.centerText}>{emptyText}</Text>
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
