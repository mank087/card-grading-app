import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'
import { runCategoryLabel, type RunCategoryLock } from '@/lib/gradingRun'

/** "🔒 Locked: Sports ✕" — the visible sign a grading run pinned the card type. */
export default function RunLockChip({ lock, onUnlock }: { lock: RunCategoryLock; onUnlock: () => void }) {
  return (
    <View style={styles.chip}>
      <Ionicons name="lock-closed" size={14} color={Colors.purple[700]} />
      <Text style={styles.text} numberOfLines={1}>Locked: {runCategoryLabel(lock)}</Text>
      <TouchableOpacity
        onPress={onUnlock}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Unlock card type"
      >
        <Ionicons name="close-circle" size={18} color={Colors.purple[700]} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: Colors.purple[50], borderWidth: 1, borderColor: Colors.purple[200], borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
  text: { fontSize: 14, fontWeight: '700', color: Colors.purple[700], flexShrink: 1 },
})
