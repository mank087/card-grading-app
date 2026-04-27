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
      <Stack.Screen name="pop-report" options={{ title: 'Pop Report' }} />
      <Stack.Screen name="featured" options={{ title: 'Featured Cards' }} />
      <Stack.Screen name="search" options={{ title: 'Search' }} />
      <Stack.Screen name="label-studio" options={{ title: 'Label Studio' }} />
      <Stack.Screen name="market-pricing" options={{ title: 'Market Pricing' }} />
      <Stack.Screen name="credits" options={{ title: 'Purchase Credits' }} />
      <Stack.Screen name="card-lovers" options={{ title: 'Card Lovers' }} />
      <Stack.Screen name="vip" options={{ title: 'VIP Package' }} />
      <Stack.Screen name="grading-rubric" options={{ title: 'Grading Rubric' }} />
      <Stack.Screen name="reports-labels" options={{ title: 'Reports & Labels' }} />
      <Stack.Screen name="faq" options={{ title: 'FAQ' }} />
      <Stack.Screen name="about" options={{ title: 'About Us' }} />
      <Stack.Screen name="why-dcm" options={{ title: 'Why DCM?' }} />
      <Stack.Screen name="blog" options={{ title: 'Blog' }} />
      <Stack.Screen name="grading-limitations" options={{ title: 'Grading Limitations' }} />
      <Stack.Screen name="card-shows" options={{ title: 'Card Shows' }} />
      <Stack.Screen name="my-account" options={{ title: 'My Account' }} />
      <Stack.Screen name="terms" options={{ title: 'Terms & Conditions' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
      <Stack.Screen name="ebay-list" options={{ title: 'List on eBay' }} />
    </Stack>
  )
}
