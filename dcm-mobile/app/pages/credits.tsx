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
 *
 * Why the iOS screen is lazy-required:
 *   A static `import` would evaluate the iOS module's body on Android
 *   too, which loads react-native-iap. v15's Nitro architecture installs
 *   JSI hooks at module-load time and that has been crashing the Android
 *   app when the user opens this screen. Lazy-requiring inside the
 *   Platform.OS branch keeps react-native-iap entirely out of the
 *   Android bundle's runtime graph — also the right answer for Play
 *   Store policy, which expects no IAP code paths in the Android build.
 */

import { Platform } from 'react-native'
import InAppPage from '@/components/ui/InAppPage'

// Evaluate the require at module-load time so the iOS path doesn't pay
// a per-render cost — but guarded by Platform.OS so Android never
// resolves the file at all.
const CreditsIOSScreen: React.ComponentType | null =
  Platform.OS === 'ios' ? require('./_credits_ios').default : null

export default function CreditsRouter() {
  if (Platform.OS === 'ios' && CreditsIOSScreen) {
    return <CreditsIOSScreen />
  }
  return <InAppPage path="/credits" title="Buy Credits" />
}
