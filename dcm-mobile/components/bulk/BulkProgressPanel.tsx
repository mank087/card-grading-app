/**
 * What a running batch looks like: the tally, the bar, the one named reason it
 * stopped, and the controls.
 *
 * Web twin: the BatchProgress half of
 * src/app/instalist-marketplace/bulk/[batchId]/BulkBatchClient.tsx.
 *
 * The paused banner is the load-bearing part. A pause is never "something went
 * wrong, start again" — it is one condition with one action, and the batch
 * carries on from exactly where it stopped, so each reason gets its own CTA
 * rather than a generic Resume the seller has to guess at.
 *
 * Counts arrive already derived from the item rows (the batch's own *_count
 * columns are refreshed server-side after each drain tick and lag the screen).
 */

import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { Colors } from '@/lib/constants'
import { BATCH_STATUS_LABEL, PAUSE_REASONS, type BulkBatch } from '@/lib/ebayBulkTypes'

export interface ProgressCounts {
  total: number
  live: number
  failed: number
  blocked: number
  skipped: number
  /** queued + uploading + publishing. */
  inFlight: number
  /** Everything the drain is finished with, one way or another. */
  settled: number
  /** Rows Retry can act on: failed, held, and already-listed. */
  retryable: number
}

export type BatchControl = 'pause' | 'resume' | 'cancel'

interface Props {
  batch: BulkBatch
  counts: ProgressCounts
  /** A control call is in flight. */
  busy: BatchControl | null
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  /** disclaimer_required: show the seller-terms gate, then resume. */
  onAcceptTerms: () => void
  /** ebay_reconnect: open eBay sign-in, then resume. */
  onReconnect: () => void
  reconnecting: boolean
  onRetryAll: () => void
  /** Progress of a sequential "Retry all" run, or null when none is running. */
  retryAll: { done: number; total: number } | null
  onBack: () => void
}

const BATCH_TONE: Record<string, { bg: string; fg: string }> = {
  running: { bg: Colors.purple[100], fg: Colors.purple[700] },
  paused: { bg: Colors.amber[100], fg: Colors.amber[700] },
  complete: { bg: Colors.green[100], fg: Colors.green[700] },
  failed: { bg: Colors.red[100], fg: Colors.red[700] },
  cancelled: { bg: Colors.gray[100], fg: Colors.gray[500] },
  draft: { bg: Colors.gray[100], fg: Colors.gray[700] },
}

/** "Retry 3 cards" — but a run with only skipped rows is a re-check, not a retry. */
function retryLabel(counts: ProgressCounts): string {
  const n = counts.retryable
  const noun = `card${n === 1 ? '' : 's'}`
  return counts.failed + counts.blocked > 0
    ? `Retry ${n} ${noun}`
    : `Re-check ${n} skipped ${noun}`
}

export default function BulkProgressPanel({
  batch, counts, busy, onPause, onResume, onCancel,
  onAcceptTerms, onReconnect, reconnecting, onRetryAll, retryAll, onBack,
}: Props) {
  const tone = BATCH_TONE[batch.status] ?? BATCH_TONE.draft
  const pct = counts.total > 0 ? Math.round((counts.settled / counts.total) * 100) : 0
  const finished =
    batch.status === 'complete' || batch.status === 'failed' || batch.status === 'cancelled'
  const reason = batch.status === 'paused' ? batch.last_error ?? '' : ''
  const busyAny = busy !== null || retryAll !== null

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={[styles.chip, { backgroundColor: tone.bg }]}>
            <Text style={[styles.chipText, { color: tone.fg }]}>
              {BATCH_STATUS_LABEL[batch.status] ?? batch.status}
            </Text>
          </View>
          <Text style={styles.headline}>
            {finished
              ? `${counts.live} of ${counts.total} listed`
              : `${counts.settled} of ${counts.total} done`}
          </Text>
        </View>

        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${pct}%` },
              batch.status === 'failed' && { backgroundColor: Colors.red[500] },
            ]}
          />
        </View>

        <View style={styles.tally}>
          <Text style={styles.live}>{counts.live} live</Text>
          {counts.inFlight > 0 && <Text style={styles.muted}>{counts.inFlight} to go</Text>}
          {counts.failed > 0 && <Text style={styles.failed}>{counts.failed} failed</Text>}
          {counts.blocked > 0 && <Text style={styles.held}>{counts.blocked} held</Text>}
          {counts.skipped > 0 && <Text style={styles.muted}>{counts.skipped} skipped</Text>}
        </View>

        {batch.status === 'running' && (
          <Text style={styles.reassure}>
            You can close the app — listing carries on without it.
          </Text>
        )}
      </View>

      {/* ─────────────────────────────────── paused, by reason ───────── */}
      {reason === 'disclaimer_required' && (
        <Banner tone="amber" title="Accept the seller terms to carry on">
          <Text style={styles.bannerText}>{PAUSE_REASONS.disclaimer_required}</Text>
          <TouchableOpacity
            style={[styles.bannerBtn, busyAny && styles.btnDisabled]}
            onPress={onAcceptTerms}
            disabled={busyAny}
            accessibilityRole="button"
            accessibilityLabel="Accept the InstaList seller terms and resume"
          >
            <Text style={styles.bannerBtnText}>Accept seller terms</Text>
          </TouchableOpacity>
        </Banner>
      )}

      {reason === 'ebay_reconnect' && (
        <Banner tone="amber" title="Reconnect your eBay account">
          <Text style={styles.bannerText}>{PAUSE_REASONS.ebay_reconnect}</Text>
          <TouchableOpacity
            style={[styles.bannerBtn, (busyAny || reconnecting) && styles.btnDisabled]}
            onPress={onReconnect}
            disabled={busyAny || reconnecting}
            accessibilityRole="button"
            accessibilityLabel="Reconnect eBay and resume this batch"
          >
            {reconnecting
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.bannerBtnText}>Reconnect eBay</Text>}
          </TouchableOpacity>
        </Banner>
      )}

      {reason === 'listing_limit' && (
        <Banner tone="amber" title="You have reached your eBay listing allowance">
          <Text style={styles.bannerText}>{PAUSE_REASONS.listing_limit}</Text>
        </Banner>
      )}

      {reason === 'paused_by_seller' && (
        <Banner tone="gray" title="Paused">
          <Text style={styles.bannerText}>
            Nothing was lost. Press Resume and the remaining cards carry on from here.
          </Text>
        </Banner>
      )}

      {/* ───────────────────────────────────────────── controls ───────── */}
      {(batch.status === 'running' || batch.status === 'paused') && (
        <View style={styles.controls}>
          {batch.status === 'running' ? (
            <TouchableOpacity
              style={[styles.control, busyAny && styles.btnDisabled]}
              onPress={onPause}
              disabled={busyAny}
              accessibilityRole="button"
              accessibilityLabel="Pause publishing"
            >
              {busy === 'pause'
                ? <ActivityIndicator size="small" color={Colors.purple[700]} />
                : <Ionicons name="pause" size={14} color={Colors.purple[700]} />}
              <Text style={styles.controlText}>Pause</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.control, styles.controlPrimary, busyAny && styles.btnDisabled]}
              onPress={onResume}
              disabled={busyAny}
              accessibilityRole="button"
              accessibilityLabel="Resume publishing"
            >
              {busy === 'resume'
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Ionicons name="play" size={14} color={Colors.white} />}
              <Text style={[styles.controlText, styles.controlPrimaryText]}>Resume</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.control, busyAny && styles.btnDisabled]}
            onPress={onCancel}
            disabled={busyAny}
            accessibilityRole="button"
            accessibilityLabel="Stop publishing this batch"
          >
            {busy === 'cancel'
              ? <ActivityIndicator size="small" color={Colors.red[600]} />
              : <Ionicons name="stop" size={14} color={Colors.red[600]} />}
            <Text style={[styles.controlText, { color: Colors.red[600] }]}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─────────────────────────────────────── done summary ─────────── */}
      {finished && (
        <View style={styles.card}>
          <Text style={styles.summary}>
            {batch.status === 'cancelled'
              ? `Cancelled · ${counts.live} live before stopping`
              : `All done · ${counts.live} live`}
            {counts.failed > 0 ? ` · ${counts.failed} failed` : ''}
            {counts.blocked > 0 ? ` · ${counts.blocked} held` : ''}
            {counts.skipped > 0 ? ` · ${counts.skipped} already listed` : ''}
          </Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to InstaList"
          >
            <Text style={styles.backBtnText}>Back to InstaList</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.purple[600]} />
          </TouchableOpacity>
        </View>
      )}

      {counts.retryable > 0 && batch.status !== 'cancelled' && (
        <TouchableOpacity
          style={[styles.retryAllBtn, busyAny && styles.btnDisabled]}
          onPress={onRetryAll}
          disabled={busyAny}
          accessibilityRole="button"
          accessibilityLabel={retryLabel(counts)}
        >
          {retryAll
            ? <ActivityIndicator size="small" color={Colors.purple[700]} />
            : <Ionicons name="refresh" size={14} color={Colors.purple[700]} />}
          <Text style={styles.retryAllText}>
            {retryAll ? `Retrying ${retryAll.done} of ${retryAll.total}…` : retryLabel(counts)}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function Banner({
  tone, title, children,
}: {
  tone: 'amber' | 'gray'
  title: string
  children: React.ReactNode
}) {
  const amber = tone === 'amber'
  return (
    <View
      style={[
        styles.banner,
        amber
          ? { backgroundColor: Colors.amber[50], borderColor: Colors.amber[200] }
          : { backgroundColor: Colors.gray[50], borderColor: Colors.gray[200] },
      ]}
    >
      <Text style={[styles.bannerTitle, amber && { color: Colors.amber[700] }]}>{title}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 10, gap: 10 },

  card: {
    backgroundColor: Colors.white, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.gray[200],
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontSize: 10, fontWeight: '800' },
  headline: { fontSize: 13, fontWeight: '700', color: Colors.gray[900] },

  track: { height: 6, borderRadius: 3, backgroundColor: Colors.gray[100], overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: Colors.purple[600] },

  tally: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  live: { fontSize: 11, fontWeight: '700', color: Colors.green[600] },
  failed: { fontSize: 11, fontWeight: '700', color: Colors.red[600] },
  held: { fontSize: 11, fontWeight: '700', color: Colors.amber[700] },
  muted: { fontSize: 11, color: Colors.gray[600] },
  reassure: { fontSize: 10, color: Colors.gray[500] },

  banner: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  bannerTitle: { fontSize: 12, fontWeight: '800', color: Colors.gray[800] },
  bannerText: { fontSize: 11, color: Colors.gray[700], lineHeight: 16 },
  bannerBtn: {
    alignSelf: 'flex-start', marginTop: 4,
    backgroundColor: Colors.amber[600], borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  bannerBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },

  controls: { flexDirection: 'row', gap: 8 },
  control: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.gray[200], backgroundColor: Colors.white,
  },
  controlPrimary: { backgroundColor: Colors.purple[600], borderColor: Colors.purple[600] },
  controlText: { fontSize: 12, fontWeight: '700', color: Colors.purple[700] },
  controlPrimaryText: { color: Colors.white },

  summary: { fontSize: 13, fontWeight: '700', color: Colors.gray[900], lineHeight: 19 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backBtnText: { fontSize: 12, fontWeight: '700', color: Colors.purple[600] },

  retryAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.purple[200], backgroundColor: Colors.purple[50],
  },
  retryAllText: { fontSize: 12, fontWeight: '700', color: Colors.purple[700] },

  btnDisabled: { opacity: 0.4 },
})
