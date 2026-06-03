/**
 * MobileTabBar — bottom navigation strip that mirrors the (tabs) layout
 * tab bar, for screens that live OUTSIDE the (tabs) group (card detail,
 * etc.) but still want the user to jump back to a tab without using
 * Back/swipe gestures.
 *
 * Visually + behaviorally matches dcm-mobile/app/(tabs)/_layout.tsx so
 * users don't perceive a context shift when they tap a tab from a
 * detail screen.
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/lib/constants'
import EbayWordmark from '@/components/marketplace/EbayWordmark'

type TabKey = 'grade' | 'collection' | 'labels' | 'market-pricing' | 'instalist-marketplace' | 'account'

interface TabDef {
  key: TabKey
  href: string
  label: string
  icon: (color: string, size: number) => React.ReactNode
}

// Must match the order + identity of (tabs)/_layout.tsx so users don't
// perceive a tab order shift when they cross into card detail / pages.
const TABS: TabDef[] = [
  {
    key: 'grade',
    href: '/(tabs)/grade',
    label: 'Grade',
    icon: (color, size) => (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          width: size * 0.65, height: size * 0.9,
          borderRadius: 3, borderWidth: 2, borderColor: color,
          alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2,
        }}>
          <View style={{
            width: size * 0.45, height: size * 0.55,
            borderRadius: 2, borderWidth: 1.5, borderColor: color, opacity: 0.6,
          }} />
        </View>
      </View>
    ),
  },
  { key: 'collection',            href: '/(tabs)/collection',            label: 'Collection', icon: (c, s) => <Ionicons name="grid"      size={s} color={c} /> },
  { key: 'labels',                href: '/(tabs)/labels',                label: 'Labels',     icon: (c, s) => <Ionicons name="pricetags" size={s} color={c} /> },
  { key: 'market-pricing',        href: '/(tabs)/market-pricing',        label: 'Portfolio',  icon: (c, s) => <Ionicons name="cash"      size={s} color={c} /> },
  // The wordmark renders gray here because MobileTabBar always shows
  // non-active state (you're already on a non-tab screen by definition).
  // It still mirrors the bottom of the (tabs) layout 1:1.
  { key: 'instalist-marketplace', href: '/(tabs)/instalist-marketplace', label: 'InstaList',  icon: (c, s) => <EbayWordmark color={c} size={s} focused={false} /> },
  { key: 'account',               href: '/(tabs)/account',               label: 'Menu',       icon: (c, s) => <Ionicons name="menu"      size={s} color={c} /> },
]

export default function MobileTabBar() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8), height: 56 + Math.max(insets.bottom, 8) }]}>
      {TABS.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={styles.tab}
          onPress={() => router.push(tab.href as any)}
          activeOpacity={0.7}
          accessibilityLabel={tab.label}
          accessibilityRole="button"
        >
          {tab.icon(Colors.gray[400], 24)}
          <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[200],
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.gray[400],
  },
})
