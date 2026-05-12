import { useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import InAppPage from '@/components/ui/InAppPage'
import AppHeaderBar from '@/components/AppHeaderBar'
import { useUserEmblems } from '@/hooks/useUserEmblems'
import { Colors } from '@/lib/constants'

/**
 * Card Lovers landing page. Behavior is platform-split for App Store
 * Reader-app compliance:
 *
 * - Android: load the full web `/card-lovers` page inside an InAppPage
 *   WebView. Web checkout (Stripe) handles purchase / management.
 *
 * - iOS members: show a native "your benefits" status screen. Members
 *   who subscribed via web still get to see what they unlocked — this
 *   is allowed under App Review Guideline 3.1.3(b) since the content
 *   they paid for elsewhere is accessible.
 *
 * - iOS non-members: bounce back to the previous screen. Apple does not
 *   allow targeting iOS users with messaging that promotes external
 *   purchase, so we surface nothing — no pricing, no link, no CTA.
 *   The Account menu likewise hides the entry point for non-members
 *   on iOS, so this fallback only matters if a deep link drops them here.
 */
export default function Page() {
  const router = useRouter()
  const { isCardLover } = useUserEmblems()
  const isIos = Platform.OS === 'ios'

  // iOS non-members get routed back to where they came from. Hook is
  // unconditional (no early-return above it) to keep hook order stable.
  useEffect(() => {
    if (!isIos) return
    if (isCardLover) return
    const t = setTimeout(() => {
      if (router.canGoBack()) router.back()
      else router.replace('/(tabs)/account')
    }, 0)
    return () => clearTimeout(t)
  }, [isIos, isCardLover, router])

  // Android keeps the full web checkout flow.
  if (!isIos) return <InAppPage path="/card-lovers" title="Card Lovers" />

  if (!isCardLover) return <View style={s.container} />

  return (
    <View style={s.container}>
      <AppHeaderBar showBack title="Card Lovers" />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.heroIcon}>
          <Ionicons name="heart" size={36} color={Colors.purple[600]} />
        </View>
        <Text style={s.title}>You{'’'}re a Card Lovers Member</Text>
        <Text style={s.subtitle}>
          Thanks for supporting DCM Grading. Here{'’'}s what your membership unlocks.
        </Text>

        <Benefit icon="diamond" title="Bonus credits each cycle" body="Card Lovers members receive credit drops on the same schedule as your billing." />
        <Benefit icon="trending-up" title="Market Pricing dashboard" body="Live and historical pricing across PriceCharting, eBay, and DCM estimates — for every card type." />
        <Benefit icon="ribbon" title="Members-only emblem" body="The Card Lovers heart emblem can be enabled on your slab labels from any card{'’'}s edit screen." />
        <Benefit icon="albums" title="Bulk valuation" body="Total your collection value across cards in a single tap from the Collection screen." />
        <Benefit icon="sparkles" title="First access to new features" body="Members get to try new label styles, report formats, and grading features before they go live for everyone." />
      </ScrollView>
    </View>
  )
}

function Benefit({ icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <View style={s.row}>
      <View style={s.rowIcon}>
        <Ionicons name={icon} size={18} color={Colors.purple[600]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowBody}>{body}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  scroll: { padding: 20, alignItems: 'stretch', gap: 12 },
  heroIcon: { alignSelf: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.purple[50], alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.gray[900], textAlign: 'center', marginTop: 8 },
  subtitle: { fontSize: 13, color: Colors.gray[600], textAlign: 'center', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.gray[200] },
  rowIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.purple[50], alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '700', color: Colors.gray[900], marginBottom: 2 },
  rowBody: { fontSize: 12, color: Colors.gray[600], lineHeight: 17 },
})
