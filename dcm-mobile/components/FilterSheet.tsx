import React from 'react'
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'

/**
 * Filter sheet for the collection — the app counterpart of the web one.
 *
 * Category, sub-sport, sort and ownership each had their own row on a screen
 * that also carries a nav header, a tab bar, a search row and the binder strip.
 * On a phone that left barely more than a card and a half visible. They move in
 * here behind one button; the screen keeps only what's ACTIVE, as chips.
 *
 * Built on RN's own Modal/Pressable/ScrollView — no new dependency, so it still
 * ships over the air.
 */

export interface MobileFilterState {
  category: string
  subSport: string | null
  sortBy: string
  sortAsc: boolean
  ownershipView: 'owned' | 'sold'
}

export function activeFilterCount(s: MobileFilterState, inBinder: boolean): number {
  let n = 0
  if (s.category !== 'All') n++
  if (s.subSport) n++
  if (s.sortBy !== 'created_at' || s.sortAsc) n++
  if (inBinder && s.ownershipView === 'sold') n++
  return n
}

export default function FilterSheet({
  visible,
  state,
  categories,
  sports,
  sortOptions,
  inBinder,
  onChange,
  onReset,
  onClose,
}: {
  visible: boolean
  state: MobileFilterState
  categories: string[]
  sports: { sport: string; count: number }[]
  sortOptions: { value: string; label: string }[]
  inBinder: boolean
  onChange: (patch: Partial<MobileFilterState>) => void
  onReset: () => void
  onClose: () => void
}) {
  const pill = (active: boolean) => [s.pill, active && s.pillOn]
  const pillTxt = (active: boolean) => [s.pillTxt, active && s.pillTxtOn]

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.grabber} />

          <View style={s.headRow}>
            <Text style={s.title}>Filter &amp; sort</Text>
            <Pressable onPress={onReset}><Text style={s.reset}>Reset</Text></Pressable>
          </View>

          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            {/* Ownership only matters inside a binder — outside, the strip's
                Sold chip already says it, and two controls for one thing is
                how people get confused. */}
            {inBinder && (
              <>
                <Text style={s.section}>Show</Text>
                <View style={s.wrap}>
                  {(['owned', 'sold'] as const).map(v => (
                    <Pressable key={v} style={pill(state.ownershipView === v)} onPress={() => onChange({ ownershipView: v })}>
                      <Text style={pillTxt(state.ownershipView === v)}>{v === 'owned' ? 'Owned' : 'Sold'}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={s.section}>Category</Text>
            <View style={s.wrap}>
              {categories.map(c => (
                <Pressable key={c} style={pill(state.category === c)} onPress={() => onChange({ category: c, subSport: null })}>
                  <Text style={pillTxt(state.category === c)}>{c}</Text>
                </Pressable>
              ))}
            </View>

            {state.category === 'Sports' && sports.length > 0 && (
              <>
                <Text style={s.section}>Sport</Text>
                <View style={s.wrap}>
                  {sports.map(sp => (
                    <Pressable
                      key={sp.sport}
                      style={pill(state.subSport === sp.sport)}
                      onPress={() => onChange({ subSport: state.subSport === sp.sport ? null : sp.sport })}
                    >
                      <Text style={pillTxt(state.subSport === sp.sport)}>{sp.sport} ({sp.count})</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={s.section}>Sort by</Text>
            <View style={s.wrap}>
              {sortOptions.map(o => {
                const on = state.sortBy === o.value
                return (
                  <Pressable
                    key={o.value}
                    style={pill(on)}
                    onPress={() => on ? onChange({ sortAsc: !state.sortAsc }) : onChange({ sortBy: o.value, sortAsc: false })}
                  >
                    <Text style={pillTxt(on)}>{o.label}</Text>
                    {on && <Ionicons name={state.sortAsc ? 'arrow-up' : 'arrow-down'} size={11} color="#fff" />}
                  </Pressable>
                )
              })}
            </View>
          </ScrollView>

          <Pressable onPress={onClose} style={s.done}>
            <Text style={s.doneTxt}>Show results</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 30 },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: Colors.gray[300], alignSelf: 'center', marginBottom: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '800', color: Colors.gray[900] },
  reset: { fontSize: 14, fontWeight: '700', color: Colors.purple[700] },
  section: { fontSize: 11, fontWeight: '700', color: Colors.gray[500], textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 2, borderColor: Colors.gray[200], backgroundColor: '#fff' },
  pillOn: { backgroundColor: Colors.purple[600], borderColor: Colors.purple[600] },
  pillTxt: { fontSize: 13, fontWeight: '700', color: Colors.gray[700] },
  pillTxtOn: { color: '#fff' },
  done: { marginTop: 16, paddingVertical: 14, borderRadius: 10, backgroundColor: Colors.purple[600], alignItems: 'center' },
  doneTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
