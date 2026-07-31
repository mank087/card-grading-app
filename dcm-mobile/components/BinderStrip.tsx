import React from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { Colors } from '@/lib/constants'
import type { Binder } from '@/lib/bindersApi'

/**
 * Horizontally scrolling binder selector, mirroring the web strip.
 *
 * Selecting a binder scopes the list below it; "All Cards" is the default and
 * leaves the screen behaving exactly as it always has, so nothing changes for
 * users who never make a binder.
 *
 * No drag-to-file here — on a phone that gesture fights the scroll, so filing
 * happens through the long-press sheet instead.
 */
export default function BinderStrip({
  binders,
  selectedId,
  ownershipView,
  ownedCount,
  soldCount,
  onSelect,
  onSelectSold,
  onCreate,
}: {
  binders: Binder[]
  selectedId: string | null
  /** Sold is a scope chip here, not a separate tab row below the strip. */
  ownershipView: 'owned' | 'sold'
  ownedCount: number
  soldCount: number
  onSelect: (id: string | null) => void
  onSelectSold: () => void
  onCreate: () => void
}) {
  const allActive = selectedId === null && ownershipView === 'owned'
  return (
    <View style={s.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {/* Scope: everything, sold, then binders. Sold used to be its own tab
            row with a hint under it — two full-width rows for something the
            strip can express as one chip. */}
        <Pressable
          onPress={() => onSelect(null)}
          style={[s.chip, allActive && s.chipOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: allActive }}
        >
          <Text style={[s.chipTxt, allActive && s.chipTxtOn]}>All Cards</Text>
          {ownedCount > 0 && <Text style={[s.count, allActive && s.countOn]}>{ownedCount}</Text>}
        </Pressable>

        {soldCount > 0 && (
          <Pressable
            onPress={onSelectSold}
            style={[s.chip, ownershipView === 'sold' && s.chipSold]}
            accessibilityRole="button"
            accessibilityState={{ selected: ownershipView === 'sold' }}
            accessibilityLabel={`Sold, ${soldCount} cards`}
          >
            <Text style={[s.chipTxt, ownershipView === 'sold' && s.chipTxtOn]}>Sold</Text>
            <Text style={[s.count, ownershipView === 'sold' && s.countOn]}>{soldCount}</Text>
          </Pressable>
        )}

        {binders.map(b => {
          const on = selectedId === b.id
          return (
            <Pressable
              key={b.id}
              onPress={() => onSelect(b.id)}
              style={[s.chip, on && s.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${b.name}, ${b.card_count} cards`}
            >
              <View style={[s.dot, { backgroundColor: b.accent_color || (on ? '#fff' : Colors.purple[400]) }]} />
              <Text style={[s.chipTxt, on && s.chipTxtOn]} numberOfLines={1}>{b.name}</Text>
              <Text style={[s.count, on && s.countOn]}>{b.card_count}</Text>
            </Pressable>
          )
        })}

        <Pressable onPress={onCreate} style={[s.chip, s.chipNew]} accessibilityRole="button">
          <Text style={[s.chipTxt, { color: Colors.gray[500] }]}>＋ New binder</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { paddingVertical: 8 },
  row: { paddingHorizontal: 14, gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.gray[200], backgroundColor: '#fff',
    maxWidth: 200,
  },
  chipOn: { backgroundColor: Colors.purple[600], borderColor: Colors.purple[600] },
  chipSold: { backgroundColor: '#059669', borderColor: '#059669' },
  chipNew: { borderStyle: 'dashed', borderColor: Colors.gray[300] },
  chipTxt: { fontSize: 13, fontWeight: '700', color: Colors.gray[700], flexShrink: 1 },
  chipTxtOn: { color: '#fff' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  count: { fontSize: 11, color: Colors.gray[400] },
  countOn: { color: Colors.purple[100] },
})
