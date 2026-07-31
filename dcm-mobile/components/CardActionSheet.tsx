import React from 'react'
import { View, Text, Modal, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'
import type { Binder } from '@/lib/bindersApi'

/**
 * Long-press sheet for a single card — the app's counterpart to the web one.
 *
 * Long-press on the collection already meant "enter multi-select", so this
 * sheet is a SUPERSET rather than a replacement: it opens on long-press and
 * carries "Select multiple" as an explicit action, so the old gesture still
 * gets you there in one extra tap instead of disappearing.
 *
 * Ordering is done with Top/Up/Down/Bottom rather than drag. On a phone that's
 * both easier to hit and more precise than aiming a drop, and it avoids a
 * gesture-handler dependency — which matters because this whole feature has to
 * ship over the air.
 *
 * Built on RN's own Modal/Pressable/ScrollView. No new native module.
 */

export interface CardActionSheetProps {
  visible: boolean
  cardName: string
  binders: Binder[]
  memberOf: Set<string>
  /** Set when viewing inside a manual binder — enables the reorder row. */
  currentBinder: { id: string; name: string } | null
  index: number
  total: number
  busy: boolean
  onToggleBinder: (binderId: string) => void
  onCreateBinder: () => void
  onMove: (to: 'top' | 'up' | 'down' | 'bottom') => void
  onRemoveFromBinder: () => void
  onSelectMultiple: () => void
  onOpenCard: () => void
  onClose: () => void
}

export default function CardActionSheet({
  visible,
  cardName,
  binders,
  memberOf,
  currentBinder,
  index,
  total,
  busy,
  onToggleBinder,
  onCreateBinder,
  onMove,
  onRemoveFromBinder,
  onSelectMultiple,
  onOpenCard,
  onClose,
}: CardActionSheetProps) {
  const atTop = index <= 0
  const atBottom = index >= total - 1

  const moveBtn = (to: 'top' | 'up' | 'down' | 'bottom', icon: string, label: string, disabled: boolean) => (
    <Pressable
      onPress={() => onMove(to)}
      disabled={disabled || busy}
      style={({ pressed }) => [s.moveBtn, (disabled || busy) && s.moveBtnOff, pressed && !disabled && s.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Move ${label}`}
      accessibilityState={{ disabled: disabled || busy }}
    >
      <Ionicons name={icon as any} size={18} color={disabled ? Colors.gray[300] : Colors.gray[700]} />
      <Text style={[s.moveTxt, disabled && s.moveTxtOff]}>{label}</Text>
    </Pressable>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        {/* Stops a tap inside the sheet closing it */}
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.grabber} />
          <Text style={s.title} numberOfLines={1}>{cardName}</Text>

          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            {currentBinder && total > 1 && (
              <>
                <Text style={s.section}>
                  Position in {currentBinder.name} · {index + 1} of {total}
                </Text>
                <View style={s.moveRow}>
                  {moveBtn('top', 'arrow-up-circle', 'Top', atTop)}
                  {moveBtn('up', 'chevron-up', 'Up', atTop)}
                  {moveBtn('down', 'chevron-down', 'Down', atBottom)}
                  {moveBtn('bottom', 'arrow-down-circle', 'Bottom', atBottom)}
                </View>
              </>
            )}

            <Text style={s.section}>Binders</Text>
            {binders.map(b => {
              const inIt = memberOf.has(b.id)
              return (
                <Pressable
                  key={b.id}
                  onPress={() => onToggleBinder(b.id)}
                  disabled={busy}
                  style={({ pressed }) => [s.row, inIt && s.rowOn, pressed && s.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: inIt }}
                  accessibilityLabel={`${inIt ? 'Remove from' : 'Add to'} ${b.name}`}
                >
                  <View style={[s.dot, { backgroundColor: b.accent_color || Colors.purple[400] }]} />
                  <Text style={s.rowTxt} numberOfLines={1}>{b.name}</Text>
                  {inIt
                    ? <Text style={s.inTxt}>✓ In</Text>
                    : <Text style={s.addTxt}>Add</Text>}
                </Pressable>
              )
            })}

            <Pressable
              onPress={onCreateBinder}
              disabled={busy}
              style={({ pressed }) => [s.row, s.rowDashed, pressed && s.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="add" size={18} color={Colors.gray[500]} />
              <Text style={[s.rowTxt, { color: Colors.gray[600] }]}>New binder with this card</Text>
            </Pressable>

            {currentBinder && (
              <Pressable
                onPress={onRemoveFromBinder}
                disabled={busy}
                style={({ pressed }) => [s.removeRow, pressed && s.pressed]}
                accessibilityRole="button"
              >
                <Text style={s.removeTxt}>Remove from {currentBinder.name}</Text>
                <Text style={s.removeSub}>Keeps the card in your collection</Text>
              </Pressable>
            )}

            <Text style={s.section}>Card</Text>
            <Pressable onPress={onOpenCard} style={({ pressed }) => [s.row, pressed && s.pressed]}>
              <Ionicons name="eye-outline" size={18} color={Colors.gray[700]} />
              <Text style={s.rowTxt}>View card details</Text>
            </Pressable>
            <Pressable onPress={onSelectMultiple} style={({ pressed }) => [s.row, pressed && s.pressed]}>
              <Ionicons name="checkbox-outline" size={18} color={Colors.gray[700]} />
              <Text style={s.rowTxt}>Select multiple</Text>
            </Pressable>
          </ScrollView>

          <Pressable onPress={onClose} style={({ pressed }) => [s.done, pressed && s.pressed]}>
            {busy ? <ActivityIndicator color={Colors.gray[700]} /> : <Text style={s.doneTxt}>Done</Text>}
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
  title: { fontSize: 17, fontWeight: '800', color: Colors.gray[900] },
  section: { fontSize: 11, fontWeight: '700', color: Colors.gray[500], textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  moveRow: { flexDirection: 'row', gap: 8 },
  moveBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.gray[100], gap: 2 },
  moveBtnOff: { opacity: 0.45 },
  moveTxt: { fontSize: 12, fontWeight: '700', color: Colors.gray[700] },
  moveTxtOff: { color: Colors.gray[300] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 10, borderWidth: 2, borderColor: Colors.gray[200], marginBottom: 8 },
  rowOn: { borderColor: Colors.purple[500], backgroundColor: Colors.purple[50] },
  rowDashed: { borderStyle: 'dashed', borderColor: Colors.gray[300] },
  rowTxt: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.gray[900] },
  dot: { width: 12, height: 12, borderRadius: 6 },
  inTxt: { fontSize: 13, fontWeight: '800', color: Colors.purple[700] },
  addTxt: { fontSize: 13, color: Colors.gray[400] },
  removeRow: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#fef2f2', marginTop: 4 },
  removeTxt: { fontSize: 15, fontWeight: '700', color: '#b91c1c' },
  removeSub: { fontSize: 12, color: '#dc2626', marginTop: 2 },
  done: { marginTop: 14, paddingVertical: 14, borderRadius: 10, backgroundColor: Colors.gray[100], alignItems: 'center' },
  doneTxt: { fontSize: 15, fontWeight: '700', color: Colors.gray[700] },
  pressed: { opacity: 0.7 },
})
