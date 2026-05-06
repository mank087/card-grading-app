import { Stack } from 'expo-router'
import { Colors } from '@/lib/constants'

export default function PagesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.purple[600],
        headerBackTitle: 'Back',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      {/* WebView-backed pages render their own top bar via InAppPage so
          the user always has a clear "Back" button even when the web
          page goes full-bleed. Stack header disabled to avoid stacking. */}
      <Stack.Screen name="pop-report" options={{ headerShown: false }} />
      <Stack.Screen name="featured" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ headerShown: false }} />
      <Stack.Screen name="market-pricing" options={{ headerShown: false }} />
      <Stack.Screen name="credits" options={{ headerShown: false }} />
      <Stack.Screen name="card-lovers" options={{ headerShown: false }} />
      <Stack.Screen name="vip" options={{ headerShown: false }} />
      <Stack.Screen name="grading-rubric" options={{ headerShown: false }} />
      <Stack.Screen name="reports-labels" options={{ headerShown: false }} />
      <Stack.Screen name="faq" options={{ headerShown: false }} />
      <Stack.Screen name="about" options={{ headerShown: false }} />
      <Stack.Screen name="why-dcm" options={{ headerShown: false }} />
      <Stack.Screen name="blog" options={{ headerShown: false }} />
      <Stack.Screen name="grading-limitations" options={{ headerShown: false }} />
      <Stack.Screen name="card-shows" options={{ headerShown: false }} />
      <Stack.Screen name="my-account" options={{ headerShown: false }} />
      <Stack.Screen name="terms" options={{ headerShown: false }} />
      <Stack.Screen name="privacy" options={{ headerShown: false }} />

      {/* Native screens — keep the Stack header so they retain their
          existing back-button + title chrome. */}
      <Stack.Screen name="label-studio" options={{ title: 'Label Studio' }} />
      <Stack.Screen name="ebay-list" options={{ title: 'List on eBay' }} />
      <Stack.Screen name="contact" options={{ title: 'Contact Us' }} />
    </Stack>
  )
}
