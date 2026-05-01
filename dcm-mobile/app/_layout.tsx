import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useFonts } from 'expo-font'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useState, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
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

// Auth guard — shows onboarding for first-time users, redirects to login otherwise
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null)

  // Check if user has seen onboarding
  useEffect(() => {
    AsyncStorage.getItem('dcm_onboarding_seen').then(val => {
      setShowOnboarding(val !== 'true')
    })
  }, [])

  useEffect(() => {
    if (isLoading || showOnboarding === null) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!user && !inAuthGroup && !showOnboarding) {
      router.replace('/(auth)/login')
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/grade')
    }
  }, [user, isLoading, segments, showOnboarding])

  const handleGetStarted = useCallback(() => {
    AsyncStorage.setItem('dcm_onboarding_seen', 'true')
    setShowOnboarding(false)
    router.replace('/(auth)/register')
  }, [router])

  const handleSignIn = useCallback(() => {
    AsyncStorage.setItem('dcm_onboarding_seen', 'true')
    setShowOnboarding(false)
    router.replace('/(auth)/login')
  }, [router])

  // Show onboarding for first-time unauthenticated users
  if (!user && showOnboarding && !isLoading) {
    return <OnboardingCarousel onGetStarted={handleGetStarted} onSignIn={handleSignIn} />
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
