/**
 * The Set field's picker in the "Confirm your card details" sheet.
 *
 * Mirrors the web dialog's set dropdown (src/components/cards/ConfirmCardDetailsDialog.tsx):
 * the category's sets from DCM's own card databases (GET /api/cards/set-options),
 * each with its release year, plus "Not sure" and "Type a set that is not listed".
 * A searchable FlatList rather than a native picker because MTG alone has about
 * 1,000 sets, and because a picker library would need a store build.
 *
 * The parent owns the value and what a choice does (filling an empty Year, opening
 * the free-text box); this only reports which row was tapped.
 */
import { useMemo, useState } from 'react'
import { View, Text, Modal, Pressable, TextInput, FlatList, StyleSheet, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'
import type { SetOption } from '@/lib/identityReviewApi'

export type SetChoice =
  | { kind: 'set'; option: SetOption }
  | { kind: 'not_sure' }
  | { kind: 'custom' }

interface Props {
  visible: boolean
  sets: SetOption[]
  /** The set currently in the box, to tick its row. */
  selected: string
  onChoose: (choice: SetChoice) => void
  onClose: () => void
}

/** Case- and accent-insensitive, so "pokemon" finds "Pokémon". */
function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export default function SetPickerModal({ visible, sets, selected, onChoose, onClose }: Props) {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const term = fold(query.trim())
    if (!term) return sets
    return sets.filter(option => fold(option.name).includes(term) || (option.year || '').includes(term))
  }, [sets, query])

  const choose = (choice: SetChoice) => {
    setQuery('')
    onChoose(choice)
  }

  const header = (
    <View>
      <TouchableOpacity style={st.row} onPress={() => choose({ kind: 'not_sure' })} activeOpacity={0.7}>
        <Text style={[st.rowName, { color: Colors.gray[600] }]}>Not sure</Text>
        {!selected && <Ionicons name="checkmark-circle" size={20} color={Colors.purple[600]} />}
      </TouchableOpacity>
    </View>
  )

  const footer = (
    <TouchableOpacity style={[st.row, st.customRow]} onPress={() => choose({ kind: 'custom' })} activeOpacity={0.7}>
      <Ionicons name="create-outline" size={16} color={Colors.purple[700]} />
      <Text style={[st.rowName, { color: Colors.purple[700], flex: 1 }]}>Type a set that is not listed</Text>
    </TouchableOpacity>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={[st.sheet, { paddingBottom: insets.bottom + 12, marginTop: insets.top + 40 }]} onPress={e => e.stopPropagation()}>
          <View style={st.handle} />
          <View style={st.titleRow}>
            <Text style={st.title}>Choose the set</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={Colors.gray[500]} />
            </TouchableOpacity>
          </View>
          <Text style={st.subtitle}>{sets.length.toLocaleString()} sets to choose from.</Text>

          <View style={st.searchRow}>
            <Ionicons name="search" size={16} color={Colors.gray[400]} style={{ marginLeft: 10 }} />
            <TextInput
              style={st.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Search sets"
              placeholderTextColor={Colors.gray[400]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item, index) => `${item.name}-${index}`}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            windowSize={10}
            ListHeaderComponent={header}
            ListFooterComponent={footer}
            ListEmptyComponent={<Text style={st.empty}>No set matches that search. You can type it in instead.</Text>}
            renderItem={({ item }) => {
              const isSelected = item.name === selected
              return (
                <TouchableOpacity
                  style={[st.row, isSelected && st.rowSelected]}
                  onPress={() => choose({ kind: 'set', option: item })}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[st.rowName, isSelected && { color: Colors.purple[700] }]} numberOfLines={2}>{item.name}</Text>
                    {item.year ? <Text style={st.rowYear}>{item.year}</Text> : null}
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={Colors.purple[600]} />}
                </TouchableOpacity>
              )
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { flex: 1, backgroundColor: Colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 8 },
  handle: { width: 36, height: 4, backgroundColor: Colors.gray[300], borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700', color: Colors.gray[900] },
  subtitle: { fontSize: 11, color: Colors.gray[500], marginBottom: 10, marginTop: 2 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 10,
    backgroundColor: Colors.gray[50], marginBottom: 10,
  },
  input: { flex: 1, fontSize: 14, color: Colors.gray[900], paddingVertical: 10, paddingHorizontal: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.gray[200],
  },
  rowSelected: { backgroundColor: Colors.purple[50] },
  customRow: { borderBottomWidth: 0, marginTop: 4 },
  rowName: { fontSize: 14, fontWeight: '600', color: Colors.gray[900] },
  rowYear: { fontSize: 11, color: Colors.gray[500], marginTop: 2 },
  empty: { fontSize: 12, color: Colors.gray[500], textAlign: 'center', paddingVertical: 20 },
})
