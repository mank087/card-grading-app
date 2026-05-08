/**
 * Leftover Expo template route. Hidden from the tab bar via `href: null`
 * in (tabs)/_layout.tsx; redirects anyone who somehow lands here to the
 * Collection tab. Safe to delete once we're confident nothing links to
 * /(tabs)/two anywhere.
 */

import { Redirect } from 'expo-router'

export default function TabTwoLegacyRedirect() {
  return <Redirect href="/(tabs)/collection" />
}
