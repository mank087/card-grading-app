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

export type AverySheet = 'avery6871' | 'avery8167-foldover' | 'avery8167-pair'

interface LabelPositionPickerProps {
  visible: boolean
  /** Title shown at top of modal — e.g. the label type name. */
  title: string
  sheet: AverySheet
  onCancel: () => void
  /** Called with chosen front-label slot index, plus optional back-label
   *  slot index for pair sheets (toploader front+back). For single-slot
   *  sheets (one-touch, foldover) only `position` is set. The picker has
   *  already persisted the user's choice when this fires. */
  onConfirm: (position: number, position2?: number) => void
}

interface SheetConfig {
  rows: number
  cols: number
  total: number
  label: string
  storageKey: string
  /** When true, each grid cell represents a CARD that occupies 2 adjacent
   *  raw-slot positions on the physical sheet (toploader front+back). The
   *  picker shows pairs visually and computes front/back slot indices
   *  before invoking onConfirm. */
  paired?: boolean
}

const SHEET_CONFIG: Record<AverySheet, SheetConfig> = {
  avery6871: {
    rows: 4, cols: 3, total: 12,
    label: 'Avery 6871 (3 × 4 = 12 labels)',
    storageKey: 'dcm_avery6871_last_pos',
  },
  // Foldover: each card uses 1 label slot, so the picker shows the raw
  // 4×20 = 80-slot grid. Mirrors generateFoldOverLabel8167 (80 cards/sheet).
  'avery8167-foldover': {
    rows: 20, cols: 4, total: 80,
    label: 'Avery 8167 (4 × 20 = 80 labels)',
    storageKey: 'dcm_avery8167_foldover_last_pos',
  },
  // Pair: each CARD uses 2 adjacent label slots in the same row (front +
  // back), so the sheet holds 40 cards. Mirrors generateToploaderLabelSheet
  // (40 cards/sheet, 2 cards per row across 4 cols). The picker shows 40
  // card cells (2 cols × 20 rows) and the confirm handler computes the
  // front/back raw-slot indices using the same formula as the web
  // generator at avery8167LabelGenerator.ts:707-733.
  'avery8167-pair': {
    rows: 20, cols: 2, total: 40,
    label: 'Avery 8167 (40 cards, front+back per card)',
    storageKey: 'dcm_avery8167_pair_last_pos',
    paired: true,
  },
}

/** Convert a card-position index (0-39) to its front + back raw-slot
 *  indices on a 4-column 8167 sheet. Mirrors web's
 *  avery8167LabelGenerator.ts:707-720. */
function cardPositionToSlots(cardPosition: number): { front: number; back: number } {
  const row = Math.floor(cardPosition / 2)
  const cardInRow = cardPosition % 2          // 0 = left card, 1 = right card
  const frontCol = cardInRow * 2              // 0 or 2
  const backCol = frontCol + 1                // 1 or 3
  return {
    front: row * 4 + frontCol,
    back: row * 4 + backCol,
  }
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

  const isPaired = !!cfg.paired
  // Smaller cells when there are many slots; pair view fits 2 wider cells per row
  const cellSize = sheet === 'avery8167-foldover' ? 28 : isPaired ? 56 : 56
  const cellNumberFontSize = sheet === 'avery8167-foldover' ? 8 : 11

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={s.backdrop} onPress={onCancel}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
          <View style={s.handle} />
          <Text style={s.title}>Choose Starting Position</Text>
          <Text style={s.subtitle}>{title} · {cfg.label}</Text>
          <Text style={s.helperText}>
            {isPaired
              ? 'Each card uses two adjacent label slots — front and back. Tap the next free card slot on your sheet.'
              : 'Tap the position where the next available label is on your sheet. Position is remembered for next time.'}
          </Text>
          <ScrollView style={{ maxHeight: 320 }}>
            <View style={{ alignSelf: 'center', flexDirection: 'column', gap: 4, padding: 4 }}>
              {Array.from({ length: cfg.rows }).map((_, r) => (
                <View key={r} style={{ flexDirection: 'row', gap: isPaired ? 8 : 4 }}>
                  {Array.from({ length: cfg.cols }).map((_, c) => {
                    const idx = r * cfg.cols + c
                    const sel = idx === position
                    if (isPaired) {
                      // Render each card as two adjacent sub-cells (front/back)
                      // so users can see exactly which slots they're claiming.
                      return (
                        <TouchableOpacity
                          key={c}
                          onPress={() => setPosition(idx)}
                          style={{
                            flexDirection: 'row',
                            borderRadius: 4,
                            borderWidth: sel ? 2 : 1,
                            borderColor: sel ? Colors.purple[600] : Colors.gray[300],
                            backgroundColor: sel ? Colors.purple[50] : '#fff',
                            overflow: 'hidden',
                          }}
                        >
                          {(['F', 'B'] as const).map((fb, sub) => (
                            <View
                              key={sub}
                              style={{
                                width: cellSize,
                                height: cellSize * 0.7,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderLeftWidth: sub === 1 ? StyleSheet.hairlineWidth : 0,
                                borderLeftColor: sel ? Colors.purple[300] : Colors.gray[200],
                              }}
                            >
                              <Text style={{ fontSize: cellNumberFontSize - 2, fontWeight: '600', color: sel ? Colors.purple[600] : Colors.gray[400] }}>{fb}</Text>
                              <Text style={{ fontSize: cellNumberFontSize, fontWeight: '700', color: sel ? Colors.purple[700] : Colors.gray[600] }}>
                                {sub === 0 ? cardPositionToSlots(idx).front + 1 : cardPositionToSlots(idx).back + 1}
                              </Text>
                            </View>
                          ))}
                        </TouchableOpacity>
                      )
                    }
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
                if (isPaired) {
                  const { front, back } = cardPositionToSlots(position)
                  onConfirm(front, back)
                } else {
                  onConfirm(position)
                }
              }}
            >
              <Text style={s.btnSaveText}>
                {isPaired ? `Use Card ${position + 1}` : `Use Position ${position + 1}`}
              </Text>
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
