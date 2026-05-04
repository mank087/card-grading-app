import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'

/**
 * Top-of-screen banner that appears when the device loses network or
 * connects to a network with no internet reachability. Mounts once at the
 * root layout and stays mounted; toggles its own visibility via NetInfo.
 *
 * Subscribes to NetInfo's connection events (no polling) and renders nothing
 * when online, so there's zero overhead in the common case.
 */
export default function OfflineBanner() {
  const insets = useSafeAreaInsets()
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      // isInternetReachable is null on first event sometimes; treat null as
      // online to avoid a false "offline" flash on cold boot.
      const isOnline = state.isConnected !== false && state.isInternetReachable !== false
      setOffline(!isOnline)
    })
    return () => unsub()
  }, [])

  if (!offline) return null

  return (
    <View
      style={[styles.banner, { paddingTop: Math.max(insets.top, 8) + 6 }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
      <Text style={styles.text}>You're offline. Some features may not work.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 6,
    backgroundColor: Colors.gray[900],
    zIndex: 1000,
  },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
})
