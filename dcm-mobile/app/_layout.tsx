import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useFonts } from 'expo-font'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useState } from 'react'
// StripeProvider wrapped in try/catch — fails gracefully in Expo Go
let StripeProvider: any
try {
  StripeProvider = require('@stripe/stripe-react-native').StripeProvider
} catch {
  StripeProvider = ({ children }: any) => children
}
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { CreditsProvider } from '@/contexts/CreditsContext'
import { Colors } from '@/lib/constants'
import WelcomeAnimation from '@/components/WelcomeAnimation'
import HelpBot from '@/components/HelpBot'

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''

export { ErrorBoundary } from 'expo-router'

SplashScreen.preventAutoHideAsync()

// Auth guard — redirects to login if not authenticated
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/grade')
    }
  }, [user, isLoading, segments])

  return <>{children}</>
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  })
  const [showWelcome, setShowWelcome] = useState(true)

  useEffect(() => {
    if (error) throw error
  }, [error])

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync()
  }, [loaded])

  if (!loaded) return null

  // Show animated welcome screen before anything else
  if (showWelcome) {
    return <WelcomeAnimation onComplete={() => setShowWelcome(false)} />
  }

  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} merchantIdentifier="merchant.com.dcmgrading">
    <AuthProvider>
      <CreditsProvider>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="card/[id]"
              options={{
                headerShown: true,
                title: 'Card Details',
                headerTintColor: Colors.purple[600],
                headerBackTitle: 'Back',
                headerStyle: { backgroundColor: Colors.white },
              }}
            />
            <Stack.Screen
              name="grade"
              options={{ headerShown: false, presentation: 'fullScreenModal' }}
            />
            <Stack.Screen
              name="pages"
              options={{ headerShown: false }}
            />
          </Stack>
          <HelpBot />
        </AuthGate>
      </CreditsProvider>
    </AuthProvider>
    </StripeProvider>
  )
}
