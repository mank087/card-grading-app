import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable, ScrollView } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Colors } from '@/lib/constants'
import type { LabelStyleId, SavedCustomStyle } from '@/hooks/useLabelStyle'

interface Props {
  labelStyle: LabelStyleId
  customStyles: SavedCustomStyle[]
  onSwitch: (id: LabelStyleId) => void
  compact?: boolean
}

export default function LabelStylePicker({ labelStyle, customStyles, onSwitch, compact = false }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const displayName = (id: LabelStyleId): string => {
    if (id === 'modern') return 'Modern (DCM)'
    if (id === 'traditional') return 'Traditional'
    return customStyles.find(s => s.id === id)?.name || id
  }

  const ColorDot = ({ config }: { config: SavedCustomStyle['config'] }) => {
    const isRainbow = config.colorPreset === 'rainbow'
    const colors = isRainbow
      ? ['#ff0000', '#ff8800', '#ffff00', '#00cc00', '#0066ff', '#8800ff', '#ff00ff'] as const
      : [config.gradientStart, config.gradientEnd] as const
    return (
      <LinearGradient
        colors={colors as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.dot}
      />
    )
  }

  const StyleRow = ({ id, name, dot }: { id: LabelStyleId; name: string; dot?: React.ReactNode }) => {
    const active = labelStyle === id
    return (
      <TouchableOpacity
        style={[styles.row, active && styles.rowActive]}
        onPress={() => { onSwitch(id); setOpen(false) }}
      >
        {dot}
        <Text style={[styles.rowText, active && styles.rowTextActive]} numberOfLines={1}>{name}</Text>
        {active && <Ionicons name="checkmark" size={18} color={Colors.purple[600]} style={{ marginLeft: 'auto' }} />}
      </TouchableOpacity>
    )
  }

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} style={[styles.trigger, compact && styles.triggerCompact]}>
        <Ionicons name="color-palette-outline" size={14} color={Colors.gray[500]} />
        <Text style={styles.triggerLabel}>Label:</Text>
        <Text style={styles.triggerValue} numberOfLines={1}>{displayName(labelStyle)}</Text>
        <Ionicons name="chevron-down" size={14} color={Colors.gray[400]} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.title}>Label Style</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              <StyleRow id="modern" name="Modern (DCM)" />
              <StyleRow id="traditional" name="Traditional" />
              {customStyles.length > 0 && <View style={styles.divider} />}
              {customStyles.map(s => (
                <StyleRow key={s.id} id={s.id as LabelStyleId} name={s.name} dot={<ColorDot config={s.config} />} />
              ))}
              {customStyles.length < 4 && (
                <>
                  <View style={styles.divider} />
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => { setOpen(false); router.push('/pages/label-studio') }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={Colors.purple[600]} />
                    <Text style={[styles.rowText, { color: Colors.purple[600] }]}>Create in Label Studio</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 8,
    maxWidth: 220,
  },
  triggerCompact: { paddingVertical: 5, paddingHorizontal: 8 },
  triggerLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray[500] },
  triggerValue: { fontSize: 11, fontWeight: '700', color: Colors.gray[900], flexShrink: 1 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
  },
  handle: { width: 36, height: 4, backgroundColor: Colors.gray[300], borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], paddingHorizontal: 8, paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
  },
  rowActive: { backgroundColor: Colors.purple[50] },
  rowText: { fontSize: 14, fontWeight: '600', color: Colors.gray[900], flexShrink: 1 },
  rowTextActive: { color: Colors.purple[700] },
  divider: { height: 1, backgroundColor: Colors.gray[200], marginVertical: 4, marginHorizontal: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
})
