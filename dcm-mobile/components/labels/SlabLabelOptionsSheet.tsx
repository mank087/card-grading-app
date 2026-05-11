/**
 * SlabLabelOptionsSheet — unified picker for the "Graded Slab Label"
 * download flow, replacing the older path where mobile listed three
 * separate entries (Modern / Traditional / current custom) and prompted
 * for format via Alert.alert.
 *
 * Mirrors web's BatchSlabLabelModal (src/components/reports/BatchSlabLabelModal.tsx):
 *   - Style picker exposes Modern, Traditional, AND every saved custom-N
 *     (custom-1 through custom-4), so the user can choose any style on
 *     the fly without changing their global preference.
 *   - Format toggle: Duplex (front + back on one sheet) vs Fold-Over
 *     (single sheet, fold in half).
 *   - One "Generate PDF" button at the bottom — single decision per
 *     download, like web.
 *
 * The actual download is handled by the parent's onGenerate callback,
 * which builds the /label-export URL via the existing openWebDownload
 * helper with the new optional `labelStyle` override.
 */

import { useState, useMemo } from 'react'
import { View, Text, Modal, Pressable, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'
import type { SavedCustomStyle } from '@/hooks/useLabelStyle'

type StyleChoice =
  | { kind: 'modern' }
  | { kind: 'traditional' }
  | { kind: 'custom'; id: string; name: string }

type Format = 'duplex' | 'foldover'

interface Props {
  visible: boolean
  onClose: () => void
  /** Saved custom styles from useLabelStyle().customStyles — drives the picker. */
  customStyles: SavedCustomStyle[]
  /**
   * The style id currently selected on the card (modern / traditional /
   * custom-N). Used to pre-select the matching chip when the sheet opens.
   */
  defaultStyleId?: string
  /**
   * Called when the user taps Generate. The parent's openWebDownload
   * helper takes care of the actual URL build + browser/WebView launch.
   * - type: 'slab-modern' | 'slab-traditional' | 'slab-custom'
   * - format: 'duplex' | 'foldover'
   * - labelStyle: only set when type is 'slab-custom' — the specific
   *   custom-N id to render. Server reads this from the URL param.
   */
  onGenerate: (type: string, format: Format, labelStyle?: string) => void
}

export default function SlabLabelOptionsSheet({
  visible,
  onClose,
  customStyles,
  defaultStyleId,
  onGenerate,
}: Props) {
  const insets = useSafeAreaInsets()

  // Resolve the initial style choice from the parent-provided default.
  // Falls back to Modern if the saved style isn't recognized.
  const initialStyle: StyleChoice = useMemo(() => {
    if (defaultStyleId === 'traditional') return { kind: 'traditional' }
    if (defaultStyleId?.startsWith('custom-')) {
      const found = customStyles.find(s => s.id === defaultStyleId)
      if (found) return { kind: 'custom', id: found.id, name: found.name }
    }
    return { kind: 'modern' }
  }, [defaultStyleId, customStyles])

  const [style, setStyle] = useState<StyleChoice>(initialStyle)
  const [format, setFormat] = useState<Format>('duplex')

  // Re-resolve when the parent reopens the sheet with a different default
  // (e.g., user changed their card's style and reopened the picker).
  // useMemo above gives a fresh initialStyle; this effect-like pattern via
  // state lift would normally need useEffect, but we keep state local —
  // the parent unmounts/remounts the sheet via `visible` toggling, which
  // is fine for our use case since useState picks up initialStyle each
  // time visible flips from false → true (the modal isn't mounted when
  // invisible).

  const handleGenerate = () => {
    if (style.kind === 'modern') onGenerate('slab-modern', format)
    else if (style.kind === 'traditional') onGenerate('slab-traditional', format)
    else onGenerate('slab-custom', format, style.id)
    onClose()
  }

  const isSelectedStyle = (s: StyleChoice): boolean => {
    if (s.kind !== style.kind) return false
    if (s.kind === 'custom' && style.kind === 'custom') return s.id === style.id
    return true
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={[st.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={e => e.stopPropagation()}>
          <View style={st.handle} />
          <Text style={st.title}>Graded Slab Label</Text>
          <Text style={st.subtitle}>Pick a style and print format for your slab label PDF.</Text>

          {/* ─── Style picker ─── */}
          <Text style={st.sectionLabel}>Style</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.styleScrollContent}
          >
            <StyleChip
              label="Modern"
              icon="card"
              selected={isSelectedStyle({ kind: 'modern' })}
              onPress={() => setStyle({ kind: 'modern' })}
            />
            <StyleChip
              label="Traditional"
              icon="card-outline"
              selected={isSelectedStyle({ kind: 'traditional' })}
              onPress={() => setStyle({ kind: 'traditional' })}
            />
            {customStyles.map(cs => (
              <StyleChip
                key={cs.id}
                label={cs.name}
                icon="color-palette"
                selected={isSelectedStyle({ kind: 'custom', id: cs.id, name: cs.name })}
                onPress={() => setStyle({ kind: 'custom', id: cs.id, name: cs.name })}
              />
            ))}
          </ScrollView>

          {/* ─── Format picker ─── */}
          <Text style={st.sectionLabel}>Print Format</Text>
          <View style={st.formatRow}>
            <FormatCard
              title="Duplex"
              desc="Front + back on one sheet — requires double-sided print"
              icon="copy"
              selected={format === 'duplex'}
              onPress={() => setFormat('duplex')}
            />
            <FormatCard
              title="Fold-Over"
              desc="Single sheet — cut and fold in half, no duplex needed"
              icon="reader"
              selected={format === 'foldover'}
              onPress={() => setFormat('foldover')}
            />
          </View>

          {/* ─── Action ─── */}
          <TouchableOpacity style={st.generateBtn} onPress={handleGenerate} activeOpacity={0.85}>
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={st.generateText}>Generate PDF</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function StyleChip({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  selected: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[st.chip, selected && st.chipSelected]}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={14} color={selected ? '#fff' : Colors.purple[600]} />
      <Text style={[st.chipLabel, selected && st.chipLabelSelected]}>{label}</Text>
    </TouchableOpacity>
  )
}

function FormatCard({
  title,
  desc,
  icon,
  selected,
  onPress,
}: {
  title: string
  desc: string
  icon: keyof typeof Ionicons.glyphMap
  selected: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[st.formatCard, selected && st.formatCardSelected]}
      activeOpacity={0.85}
    >
      <Ionicons name={icon} size={22} color={selected ? Colors.purple[600] : Colors.gray[400]} />
      <Text style={[st.formatTitle, selected && st.formatTitleSelected]}>{title}</Text>
      <Text style={st.formatDesc}>{desc}</Text>
    </TouchableOpacity>
  )
}

const st = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.gray[300],
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.gray[900] },
  subtitle: { fontSize: 11, color: Colors.gray[500], marginBottom: 12, marginTop: 2 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.gray[600],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 8,
    marginBottom: 6,
  },

  // Style chips
  styleScrollContent: { paddingVertical: 2, gap: 8, paddingRight: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.purple[200],
    backgroundColor: Colors.purple[50],
  },
  chipSelected: {
    backgroundColor: Colors.purple[600],
    borderColor: Colors.purple[600],
  },
  chipLabel: { fontSize: 12, fontWeight: '600', color: Colors.purple[700] },
  chipLabelSelected: { color: '#fff' },

  // Format cards
  formatRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  formatCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.gray[200],
    backgroundColor: Colors.gray[50],
    alignItems: 'center',
    gap: 4,
  },
  formatCardSelected: {
    borderColor: Colors.purple[600],
    backgroundColor: Colors.purple[50],
  },
  formatTitle: { fontSize: 13, fontWeight: '700', color: Colors.gray[700], marginTop: 4 },
  formatTitleSelected: { color: Colors.purple[700] },
  formatDesc: { fontSize: 10, color: Colors.gray[500], textAlign: 'center', lineHeight: 13 },

  generateBtn: {
    backgroundColor: Colors.purple[600],
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  generateText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
