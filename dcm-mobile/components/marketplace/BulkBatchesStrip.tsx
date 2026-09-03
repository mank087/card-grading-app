/**
 * "Your batches" — the way back into a bulk run from the List tab.
 *
 * A batch outlives the screen that started it (the server drain publishes with
 * the app closed), so without this the only route back to a running batch is
 * whatever the seller left on screen. Native twin of the web
 * BulkBatchesStrip: recent batches, what state each is in, and a tap target.
 *
 * Silent when there are none and silent on any error — a convenience strip is
 * not worth an error state on a tab that already carries four of its own.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'
import { listBatches } from '@/lib/ebayBulkApi'
import { BATCH_STATUS_LABEL, type BulkBatchSummary } from '@/lib/ebayBulkTypes'

/** Chip colours per status — the native reading of the web's Tailwind pairs. */
const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  draft: { bg: Colors.gray[100], fg: Colors.gray[700] },
  running: { bg: Colors.purple[100], fg: Colors.purple[700] },
  paused: { bg: Colors.amber[100], fg: Colors.amber[700] },
  complete: { bg: Colors.green[100], fg: Colors.green[700] },
  failed: { bg: Colors.red[100], fg: Colors.red[700] },
  cancelled: { bg: Colors.gray[100], fg: Colors.gray[500] },
}

export default function BulkBatchesStrip() {
  const router = useRouter()
  const [batches, setBatches] = useState<BulkBatchSummary[]>([])
  const mounted = useRef(true)

  useEffect(() => () => { mounted.current = false }, [])

  const load = useCallback(async () => {
    try {
      const rows = await listBatches(5)
      if (mounted.current) setBatches(rows)
    } catch {
      // Convenience only — leave whatever is already on screen.
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Re-read on focus: the drain moves a batch from draft → publishing →
  // finished while the seller is off in the review screen or another app.
  useFocusEffect(useCallback(() => { load() }, [load]))

  if (batches.length === 0) return null

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Your batches</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {batches.map(batch => {
          const chip = STATUS_STYLE[batch.status] ?? STATUS_STYLE.draft
          return (
            <TouchableOpacity
              key={batch.id}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/pages/ebay-bulk', params: { batchId: batch.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${BATCH_STATUS_LABEL[batch.status] ?? batch.status} batch, ${batch.total_count} cards`}
            >
              <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                <Text style={[styles.chipText, { color: chip.fg }]}>
                  {BATCH_STATUS_LABEL[batch.status] ?? batch.status}
                </Text>
              </View>
              <Text style={styles.count}>
                {batch.total_count} card{batch.total_count === 1 ? '' : 's'}
              </Text>
              <View style={styles.metaRow}>
                {batch.live_count > 0 && (
                  <Text style={styles.live}>{batch.live_count} live</Text>
                )}
                {batch.failed_count > 0 && (
                  <Text style={styles.failed}>{batch.failed_count} failed</Text>
                )}
                <Text style={styles.date}>
                  {new Date(batch.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.openRow}>
                <Text style={styles.openText}>
                  {batch.status === 'draft' ? 'Continue review' : 'Open'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.purple[600]} />
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[200],
    paddingTop: 8, paddingBottom: 10,
  },
  heading: {
    fontSize: 11, fontWeight: '700', color: Colors.gray[500],
    textTransform: 'uppercase', letterSpacing: 0.4,
    paddingHorizontal: 12, paddingBottom: 6,
  },
  row: { paddingHorizontal: 12, gap: 8 },
  card: {
    width: 190,
    borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 8, gap: 4,
    backgroundColor: Colors.gray[50],
  },
  chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontSize: 10, fontWeight: '800' },
  count: { fontSize: 13, fontWeight: '700', color: Colors.gray[900] },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  live: { fontSize: 11, fontWeight: '700', color: Colors.green[600] },
  failed: { fontSize: 11, fontWeight: '700', color: Colors.red[600] },
  date: { fontSize: 11, color: Colors.gray[500] },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  openText: { fontSize: 12, fontWeight: '700', color: Colors.purple[600] },
})
