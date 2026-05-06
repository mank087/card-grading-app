/**
 * LabelPositionPicker — modal sheet that lets the user choose which slot
 * on an Avery sheet (6871 or 8167) the next label should print into.
 *
 * Shared between the card detail page (Reports/Labels sheet flow) and
 * the label studio gallery downloads. Both surfaces need the same
 * "tap the next available position" UX so the printed sheet uses up
 * its slots in order across multiple downloads.
 *
 * Persists the last-used position to AsyncStorage per sheet type so the
 * dialog opens at the correct next slot every time.
 */

import { Modal, View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet } from 'react-native'
import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors } from '@/lib/constants'

export type AverySheet = 'avery6871' | 'avery8167'

interface LabelPositionPickerProps {
  visible: boolean
  /** Title shown at top of modal — e.g. the label type name. */
  title: string
  sheet: AverySheet
  onCancel: () => void
  /** Called with chosen position (0-indexed). Caller should hand position
   *  off to the download flow. The picker persists the last-used slot
   *  internally before invoking the callback. */
  onConfirm: (position: number) => void
}

const SHEET_CONFIG: Record<AverySheet, {
  rows: number
  cols: number
  total: number
  label: string
  storageKey: string
}> = {
  avery6871: {
    rows: 4, cols: 3, total: 12,
    label: 'Avery 6871 (3 × 4 = 12 labels)',
    storageKey: 'dcm_avery6871_last_pos',
  },
  avery8167: {
    rows: 20, cols: 4, total: 80,
    label: 'Avery 8167 (4 × 20 = 80 labels)',
    storageKey: 'dcm_avery8167_last_pos',
  },
}

export default function LabelPositionPicker({ visible, title, sheet, onCancel, onConfirm }: LabelPositionPickerProps) {
  const cfg = SHEET_CONFIG[sheet]
  const [position, setPosition] = useState(0)

  // Load last-used position whenever the picker is (re-)opened
  useEffect(() => {
    if (!visible) return
    AsyncStorage.getItem(cfg.storageKey)
      .then(p => setPosition(p ? parseInt(p, 10) || 0 : 0))
      .catch(() => setPosition(0))
  }, [visible, cfg.storageKey])

  const cellSize = sheet === 'avery8167' ? 28 : 56
  const cellNumberFontSize = sheet === 'avery8167' ? 8 : 12

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={s.backdrop} onPress={onCancel}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
          <View style={s.handle} />
          <Text style={s.title}>Choose Starting Position</Text>
          <Text style={s.subtitle}>{title} · {cfg.label}</Text>
          <Text style={s.helperText}>
            Tap the position where the next available label is on your sheet. Position is remembered for next time.
          </Text>
          <ScrollView style={{ maxHeight: 320 }}>
            <View style={{ alignSelf: 'center', flexDirection: 'column', gap: 4, padding: 4 }}>
              {Array.from({ length: cfg.rows }).map((_, r) => (
                <View key={r} style={{ flexDirection: 'row', gap: 4 }}>
                  {Array.from({ length: cfg.cols }).map((_, c) => {
                    const idx = r * cfg.cols + c
                    const sel = idx === position
                    return (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setPosition(idx)}
                        style={{
                          width: cellSize,
                          height: cellSize * 0.7,
                          borderRadius: 4,
                          borderWidth: sel ? 2 : 1,
                          borderColor: sel ? Colors.purple[600] : Colors.gray[300],
                          backgroundColor: sel ? Colors.purple[50] : '#fff',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: cellNumberFontSize, fontWeight: '700', color: sel ? Colors.purple[700] : Colors.gray[500] }}>
                          {idx + 1}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={onCancel}>
              <Text style={s.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.btnSave]}
              onPress={async () => {
                await AsyncStorage.setItem(cfg.storageKey, String(position)).catch(() => {})
                onConfirm(position)
              }}
            >
              <Text style={s.btnSaveText}>Use Position {position + 1}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.gray[200], alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '800', color: Colors.gray[900], marginBottom: 2 },
  subtitle: { fontSize: 12, color: Colors.gray[500], marginBottom: 6 },
  helperText: { fontSize: 12, color: Colors.gray[500], marginBottom: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { backgroundColor: Colors.gray[100] },
  btnCancelText: { fontSize: 14, fontWeight: '600', color: Colors.gray[700] },
  btnSave: { backgroundColor: Colors.purple[600] },
  btnSaveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
