/**
 * Credits screen — platform router.
 *
 * Apple App Review Guideline 3.1.1 mandates StoreKit IAP for digital
 * consumables on iOS; surfacing a web-checkout flow there would get the
 * binary rejected. Google approved Stripe-in-WebView for Android during
 * its own review, so Android gets the full web checkout experience.
 *
 *   iOS     → native CreditsIOSScreen with react-native-iap
 *   Android → web /credits page in an InAppPage WebView (Stripe checkout)
 *
 * Mirrors the same platform fork already used by pages/vip.tsx and
 * pages/card-lovers.tsx. Anything that needs to differ between the two
 * stores should live downstream of this router, never above it.
 */

import { Platform } from 'react-native'
import InAppPage from '@/components/ui/InAppPage'
import CreditsIOSScreen from './_credits_ios'

export default function CreditsRouter() {
  if (Platform.OS === 'ios') {
    return <CreditsIOSScreen />
  }
  return <InAppPage path="/credits" title="Buy Credits" />
}
