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
// Sentry — wrapped in try/catch for the same reason as Stripe: native module
// unavailable in Expo Go. captureException is a no-op when not initialized.
let Sentry: any = { init: () => {}, captureException: () => {} }
try {
  Sentry = require('@sentry/react-native')
} catch {
  // Expo Go path — keep the no-op shim
}
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { CreditsProvider } from '@/contexts/CreditsContext'
import { EmblemsProvider } from '@/contexts/EmblemsContext'
import { GradingQueueProvider } from '@/contexts/GradingQueueContext'
import { useGradingPoller } from '@/hooks/useGradingPoller'
import { Colors } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import OnboardingCarousel from '@/components/OnboardingCarousel'
import HelpBot from '@/components/HelpBot'
import GradingStatusBar from '@/components/GradingStatusBar'
import OfflineBanner from '@/components/OfflineBanner'

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || ''

if (SENTRY_DSN && !__DEV__) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
    enableNative: true,
  })
}

// Custom error boundary — expo-router renders this automatically if a route's
// render throws. Friendly fallback with reset, instead of expo-router's
// default "An error occurred" generic screen.
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  useEffect(() => {
    if (error) Sentry.captureException(error)
  }, [error])
  return (
    <View style={{ flex: 1, backgroundColor: Colors.gray[50], justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.purple[100], justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 28 }}>⚠️</Text>
      </View>
      <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.gray[900], marginBottom: 8, textAlign: 'center' }}>
        Something went wrong
      </Text>
      <Text style={{ fontSize: 14, color: Colors.gray[500], textAlign: 'center', marginBottom: 20, maxWidth: 320 }}>
        The app hit an unexpected error. Tap Reload to try again — your work is safe.
      </Text>
      <TouchableOpacity
        onPress={retry}
        accessibilityLabel="Reload app"
        accessibilityRole="button"
        style={{ backgroundColor: Colors.purple[600], paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Reload</Text>
      </TouchableOpacity>
      {__DEV__ && error?.message && (
        <ScrollView style={{ maxHeight: 200, marginTop: 24, padding: 12, backgroundColor: '#fef2f2', borderRadius: 8, alignSelf: 'stretch' }}>
          <Text style={{ fontSize: 11, color: '#991b1b', fontFamily: 'SpaceMono' }}>{error.message}</Text>
          {error.stack && <Text style={{ fontSize: 9, color: '#991b1b', fontFamily: 'SpaceMono', marginTop: 8 }}>{error.stack}</Text>}
        </ScrollView>
      )}
    </View>
  )
}

SplashScreen.preventAutoHideAsync()

// Cap Dynamic Type / Android font scaling at 1.5x. Without a cap, the
// "Accessibility Sizes" range (up to ~3.5x) blows out fixed-height labels,
// tab bars, and tile layouts. 1.5x supports the common "Larger Text"
// accessibility settings while keeping the UI intact.
import { Text as RNText, TextInput as RNTextInput } from 'react-native'
;(RNText as any).defaultProps = (RNText as any).defaultProps || {}
;(RNText as any).defaultProps.maxFontSizeMultiplier = 1.5
;(RNTextInput as any).defaultProps = (RNTextInput as any).defaultProps || {}
;(RNTextInput as any).defaultProps.maxFontSizeMultiplier = 1.5

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
  // Match web's behavior: users with at least one graded card land on
  // collection; brand-new users (or users who've never finished a grade)
  // land on the grade tab so they're immediately prompted to grade.
  useEffect(() => {
    if (isLoading) return
    const inAuthGroup = segments[0] === '(auth)'
    if (!user || !inAuthGroup) return
    let cancelled = false
    supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('conversational_whole_grade', 'is', null)
      .then(({ count, error }) => {
        if (cancelled) return
        const hasGraded = !error && (count ?? 0) > 0
        router.replace(hasGraded ? '/(tabs)/collection' : '/(tabs)/grade')
      })
    return () => { cancelled = true }
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
        <EmblemsProvider>
        <GradingQueueProvider>
          <GradingPollerHost />
          <GradingStatusBar />
          <OfflineBanner />
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
        </EmblemsProvider>
      </CreditsProvider>
    </AuthProvider>
    </StripeProvider>
  )
}
