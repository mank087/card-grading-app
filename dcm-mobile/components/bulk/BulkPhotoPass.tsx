/**
 * The photo pass's two pieces of UI: a slim progress strip, and the single
 * hidden WebView that does the work.
 *
 * All of the state lives in useBulkPhotoPass — this renders it. The WebView is
 * off-screen and non-interactive (same wrapper the single-card wizard uses):
 * it is a renderer, not a page anyone looks at.
 *
 * Nothing is rendered at all once the queue drains.
 */

import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { WebView } from 'react-native-webview'

import { Colors } from '@/lib/constants'
import type { BulkPhotoPass as PhotoPassState } from '@/hooks/useBulkPhotoPass'

/** "~4 min left". Rounded up to the minute — a to-the-second number would be a lie. */
function formatEta(ms: number | null): string | null {
  if (ms == null || ms <= 0) return null
  const minutes = Math.max(1, Math.round(ms / 60_000))
  return `~${minutes} min left`
}

interface Props {
  pass: PhotoPassState
  /** Rows whose photo render failed, once the pass has drained. */
  failedPhotoCount?: number
  onRetryPhotos?: () => void
  retryingPhotos?: boolean
}

export default function BulkPhotoPass({
  pass, failedPhotoCount = 0, onRetryPhotos, retryingPhotos = false,
}: Props) {
  const idle = !pass.running && !pass.paused
  // Once the pass drains the strip has one job left: offering the failed rows
  // a second run. With none of those there is nothing to say.
  const retryOnly = idle && failedPhotoCount > 0 && !!onRetryPhotos
  if (idle && !retryOnly) return null

  // "12 of 40": the card in flight counts as the one being worked on, not as
  // one already done.
  const position = Math.min(pass.done + (pass.running ? 1 : 0), pass.total)
  const ratio = pass.total > 0 ? Math.min(1, pass.done / pass.total) : 0
  const eta = formatEta(pass.etaMs)

  return (
    <View style={styles.strip}>
      {!idle && (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>
              {pass.paused
                ? pass.pauseReason ?? 'Paused — keep the app open to continue'
                : `Preparing photos for ${pass.total} card${pass.total === 1 ? '' : 's'} — keep this screen open.`}
            </Text>
          </View>
          {!pass.paused && (
            <Text style={styles.sub}>
              {position} of {pass.total}{eta ? ` · ${eta}` : ''}
            </Text>
          )}
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
          </View>
        </>
      )}

      {failedPhotoCount > 0 && !!onRetryPhotos && (
        <TouchableOpacity
          style={[styles.retryBtn, retryingPhotos && styles.retryBtnDisabled]}
          onPress={onRetryPhotos}
          disabled={retryingPhotos}
          accessibilityRole="button"
          accessibilityLabel={`Retry photos on ${failedPhotoCount} cards`}
        >
          {retryingPhotos
            ? <ActivityIndicator size="small" color={Colors.purple[700]} />
            : <Ionicons name="refresh" size={14} color={Colors.purple[700]} />}
          <Text style={styles.retryBtnText}>
            Retry photos on {failedPhotoCount} card{failedPhotoCount === 1 ? '' : 's'}
          </Text>
        </TouchableOpacity>
      )}

      {/* One WebView, one card. `key` remounts it per card (and per retry of
          the same card), which is what re-runs the prep page from scratch. */}
      {pass.sourceUri && pass.webViewKey && (
        <View pointerEvents="none" style={styles.hidden}>
          <WebView
            key={pass.webViewKey}
            source={{ uri: pass.sourceUri }}
            originWhitelist={['*']}
            javaScriptEnabled
            onLoadStart={pass.onLoadStart}
            onMessage={e => pass.onMessage(e.nativeEvent.data)}
            onError={e => pass.onError(e.nativeEvent?.description)}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    backgroundColor: Colors.purple[50],
    borderBottomWidth: 1, borderBottomColor: Colors.purple[200],
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6,
    gap: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1, fontSize: 11, fontWeight: '600', color: Colors.purple[700] },
  sub: { fontSize: 10, color: Colors.purple[600] },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.purple[200], backgroundColor: Colors.white,
  },
  retryBtnDisabled: { opacity: 0.4 },
  retryBtnText: { fontSize: 12, fontWeight: '700', color: Colors.purple[700] },
  track: { height: 3, borderRadius: 2, backgroundColor: Colors.purple[200], overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: Colors.purple[600] },
  hidden: {
    position: 'absolute', width: 1, height: 1, opacity: 0,
    overflow: 'hidden', top: -10000, left: -10000,
  },
})
