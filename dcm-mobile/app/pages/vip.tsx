import { useEffect } from 'react'
import { View, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import InAppPage from '@/components/ui/InAppPage'
import { Colors } from '@/lib/constants'

/**
 * VIP Package landing page. Platform-split for App Store Reader-app
 * compliance (Guideline 3.1.1): iOS cannot show steering to a web
 * purchase flow for digital goods.
 *
 * - Android: full web `/vip` page in a WebView. Stripe Checkout handles
 *   purchase end-to-end.
 *
 * - iOS: bounce back to the previous screen. No pricing, no CTA, no
 *   WebView. The Account menu already hides the VIP entry on iOS, but
 *   this route is still reachable via deep link (associated domain
 *   `applinks:dcmgrading.com/vip` from app.json) or programmatic
 *   navigation, so the page itself must enforce the guard.
 */
export default function Page() {
  const router = useRouter()
  const isIos = Platform.OS === 'ios'

  useEffect(() => {
    if (!isIos) return
    const t = setTimeout(() => {
      if (router.canGoBack()) router.back()
      else router.replace('/(tabs)/account')
    }, 0)
    return () => clearTimeout(t)
  }, [isIos, router])

  if (isIos) return <View style={{ flex: 1, backgroundColor: Colors.gray[50] }} />

  return <InAppPage path="/vip" title="VIP Package" />
}
