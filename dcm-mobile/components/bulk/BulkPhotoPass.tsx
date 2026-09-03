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

import { View, Text, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'

import { Colors } from '@/lib/constants'
import type { BulkPhotoPass as PhotoPassState } from '@/hooks/useBulkPhotoPass'

export default function BulkPhotoPass({ pass }: { pass: PhotoPassState }) {
  const idle = !pass.running && !pass.paused
  if (idle) return null

  // "12 of 40": the card in flight counts as the one being worked on, not as
  // one already done.
  const position = Math.min(pass.done + (pass.running ? 1 : 0), pass.total)
  const ratio = pass.total > 0 ? Math.min(1, pass.done / pass.total) : 0

  return (
    <View style={styles.strip}>
      <View style={styles.row}>
        <Text style={styles.label}>
          {pass.paused
            ? pass.pauseReason ?? 'Paused — keep the app open to continue'
            : `Preparing photos · ${position} of ${pass.total}`}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>

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
  track: { height: 3, borderRadius: 2, backgroundColor: Colors.purple[200], overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: Colors.purple[600] },
  hidden: {
    position: 'absolute', width: 1, height: 1, opacity: 0,
    overflow: 'hidden', top: -10000, left: -10000,
  },
})
