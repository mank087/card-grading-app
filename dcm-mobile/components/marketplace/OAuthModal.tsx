/**
 * The eBay sign-in modal.
 *
 * Lifted out of app/(tabs)/instalist-marketplace.tsx unchanged when the bulk
 * screen needed the same reconnect flow: a batch the drain paused with
 * `ebay_reconnect` has to be re-authorised from where the seller is standing,
 * and a second WebView modal with its own subtly different close behaviour is
 * how the two start diverging.
 *
 * Deliberately dumb: it renders a URL and reports navigation. The caller owns
 * classifyEbayOAuthNavigation and decides what success means (refresh the
 * marketplace, or resume a paused batch).
 */

import { View, Text, Modal, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { WebView, type WebViewNavigation } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'

import { Colors } from '@/lib/constants'

export default function OAuthModal({
  visible, url, insets, onClose, onNavStateChange,
}: {
  visible: boolean
  url: string
  /** Top safe-area inset — the modal sits above the app's own chrome. */
  insets: number
  onClose: () => void
  onNavStateChange: (n: WebViewNavigation) => void
}) {
  if (!url) return null
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.oauthHeader, { paddingTop: insets + 6 }]}>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Close eBay sign-in"
        >
          <Ionicons name="close" size={26} color={Colors.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.oauthTitle}>Sign in to eBay</Text>
        <View style={{ width: 26 }} />
      </View>
      <WebView
        source={{ uri: url }}
        onNavigationStateChange={onNavStateChange}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.oauthLoading}>
            <ActivityIndicator size="large" color={Colors.purple[600]} />
          </View>
        )}
      />
    </Modal>
  )
}

const styles = StyleSheet.create({
  oauthHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[200],
  },
  oauthTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray[900] },
  oauthLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
