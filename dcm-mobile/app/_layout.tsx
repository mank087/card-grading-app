import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useFonts } from 'expo-font'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useCallback } from 'react'
// StripeProvider wrapped in try/catch — fails gracefully in Expo Go
let StripeProvider: any
try {
  StripeProvider = require('@stripe/stripe-react-native').StripeProvider
} catch {
  StripeProvider = ({ children }: any) => children
}
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { CreditsProvider } from '@/contexts/CreditsContext'
import { GradingQueueProvider } from '@/contexts/GradingQueueContext'
import { useGradingPoller } from '@/hooks/useGradingPoller'
import { Colors } from '@/lib/constants'
import OnboardingCarousel from '@/components/OnboardingCarousel'
import HelpBot from '@/components/HelpBot'
import GradingStatusBar from '@/components/GradingStatusBar'

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''

export { ErrorBoundary } from 'expo-router'

SplashScreen.preventAutoHideAsync()

// Auth guard — the 4-panel welcome carousel is the default home for any
// unauthenticated user, including users who just logged out. From there
// they tap Get Started (register) or Sign In (login). The login/register
// screens are pushed onto the stack so back-navigating returns to the
// carousel rather than exiting the app.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  // Bounce authenticated users off the auth screens straight into the app.
  useEffect(() => {
    if (isLoading) return
    const inAuthGroup = segments[0] === '(auth)'
    if (user && inAuthGroup) {
      router.replace('/(tabs)/grade')
    }
  }, [user, isLoading, segments, router])

  const handleGetStarted = useCallback(() => {
    router.push('/(auth)/register' as any)
  }, [router])

  const handleSignIn = useCallback(() => {
    router.push('/(auth)/login' as any)
  }, [router])

  // Unauthenticated users always see the welcome carousel as the home
  // screen, except when they've explicitly navigated to login/register.
  // Logging out drops them back here.
  if (!isLoading && !user) {
    const inAuthGroup = segments[0] === '(auth)'
    if (!inAuthGroup) {
      return <OnboardingCarousel onGetStarted={handleGetStarted} onSignIn={handleSignIn} />
    }
  }

  return <>{children}</>
}

// Hide HelpBot on WebView pages (pages/* routes) to avoid duplicate with web's HelpBot
function ConditionalHelpBot() {
  const segments = useSegments()
  // WebView pages are under the 'pages' segment — hide mobile HelpBot there
  const isWebViewPage = segments[0] === 'pages'
  if (isWebViewPage) return null
  return <HelpBot />
}

// Drives the grading queue poller — must be inside GradingQueueProvider.
function GradingPollerHost() {
  useGradingPoller()
  return null
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  })
  useEffect(() => {
    if (error) throw error
  }, [error])

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync()
  }, [loaded])

  if (!loaded) return null

  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} merchantIdentifier="merchant.com.dcmgrading">
    <AuthProvider>
      <CreditsProvider>
        <GradingQueueProvider>
          <GradingPollerHost />
          <GradingStatusBar />
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
          <ConditionalHelpBot />
        </AuthGate>
        </GradingQueueProvider>
      </CreditsProvider>
    </AuthProvider>
    </StripeProvider>
  )
}
