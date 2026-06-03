import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'

export type SyncState =
  | { kind: 'idle' }
  | { kind: 'syncing'; activeCount: number }
  | { kind: 'done'; transitions: number }
  | { kind: 'rate-limited'; retryAfterSec: number }

interface Props {
  state: SyncState
}

/**
 * Compact pill that surfaces the on-demand sync state. Same four states
 * as web: idle (hidden), syncing, done, rate-limited.
 */
export default function SyncStatusPill({ state }: Props) {
  if (state.kind === 'idle') return null

  if (state.kind === 'syncing') {
    return (
      <View style={[styles.pill, styles.syncing]}>
        <ActivityIndicator size="small" color={Colors.purple[700]} />
        <Text style={styles.syncingText}>
          Syncing{state.activeCount > 0 ? ` ${state.activeCount} listing${state.activeCount === 1 ? '' : 's'}` : ''}…
        </Text>
      </View>
    )
  }

  if (state.kind === 'done') {
    if (state.transitions === 0) {
      return (
        <View style={[styles.pill, styles.neutral]}>
          <Ionicons name="checkmark" size={12} color={Colors.green[600]} />
          <Text style={styles.neutralText}>Already up to date</Text>
        </View>
      )
    }
    return (
      <View style={[styles.pill, styles.done]}>
        <Ionicons name="checkmark" size={12} color={Colors.green[600]} />
        <Text style={styles.doneText}>
          Synced · {state.transitions} status change{state.transitions === 1 ? '' : 's'}
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.pill, styles.neutral]}>
      <Text style={styles.neutralText}>Sync available in {state.retryAfterSec}s</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  syncing: { backgroundColor: Colors.purple[50], borderColor: Colors.purple[200] },
  syncingText: { fontSize: 11, fontWeight: '600', color: Colors.purple[700] },
  done: { backgroundColor: Colors.green[50], borderColor: Colors.green[500] },
  doneText: { fontSize: 11, fontWeight: '600', color: Colors.green[600] },
  neutral: { backgroundColor: Colors.gray[50], borderColor: Colors.gray[200] },
  neutralText: { fontSize: 11, fontWeight: '600', color: Colors.gray[600] },
})
