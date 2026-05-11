import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useFonts } from 'expo-font'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useCallback, useRef, lazy, Suspense } from 'react'
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
import { WelcomeTourProvider, useWelcomeTour } from '@/contexts/WelcomeTourContext'
import WelcomeTour from '@/components/onboarding/WelcomeTour'
import { useGradingPoller } from '@/hooks/useGradingPoller'
import { Colors } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
// Lazy-load the welcome carousel — its module evaluates 27 require()d
// PNGs (welcome card strips, slabs, label studio shots, eBay listings)
// at module-load time. Static-importing here means every authenticated
// cold-start pays that cost even though only unauthenticated users see
// the carousel. React.lazy in RN defers MODULE EVALUATION (not bundle
// delivery — the bundle is monolithic), which is exactly the cost we
// want to skip for the 95% authenticated case.
const OnboardingCarousel = lazy(() => import('@/components/OnboardingCarousel'))
import HelpBot from '@/components/HelpBot'
import GradingStatusBar from '@/components/GradingStatusBar'
import OfflineBanner from '@/components/OfflineBanner'
import { Platform } from 'react-native'
import { logScreenView, segmentsToScreenName } from '@/lib/analytics'

// expo-tracking-transparency — wrapped in try/catch like Stripe / Sentry
// so Expo Go (which lacks the native module) doesn't crash on import.
let trackingTransparency: any = null
try {
  trackingTransparency = require('expo-tracking-transparency')
} catch {
  /* Expo Go path */
}

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
      // Suspense fallback matches the carousel's bg color (#0f0a1a) so
      // the 1-frame load gap looks like the carousel is just appearing,
      // not a flash of white.
      return (
        <Suspense fallback={<View style={{ flex: 1, backgroundColor: '#0f0a1a' }} />}>
          <OnboardingCarousel onGetStarted={handleGetStarted} onSignIn={handleSignIn} />
        </Suspense>
      )
    }
  }

  return <>{children}</>
}

// Hide HelpBot on:
//   - WebView pages (pages/*) — web has its own HelpBot, would duplicate
//   - Grade flow (grade/*) and Grade tab — focused task; floating button
//     overlaps the camera capture UI
//   - Auth screens ((auth)/*) — user isn't signed in, can't open a
//     ticket or get personalized help anyway
//   - Onboarding carousel (no segment, AuthGate intercepts) — see AuthGate
//   - Active welcome tour — its tooltip card sits in the bottom-right
//     corner area too; the FAB's Android elevation can stack above the
//     card and the "Next" button gets covered. Also a distraction
//     during a guided walkthrough.
function ConditionalHelpBot() {
  const segments = useSegments()
  const tour = useWelcomeTour()
  const top = segments[0]
  if (tour.active) return null
  if (top === 'pages' || top === 'grade' || top === '(auth)') return null
  // (tabs)/grade — hide while in the grade tab too
  if (top === '(tabs)' && segments[1] === 'grade') return null
  return <HelpBot />
}

// Drives the grading queue poller — must be inside GradingQueueProvider.
function GradingPollerHost() {
  useGradingPoller()
  return null
}

// Logs a friendly screen_view to Firebase/GA4 on every Expo Router
// route change. Without this, Firebase's automatic screen reporting
// captures the underlying native view controller class names
// (RNSScreen, UIViewController, RCTFabricModalHostViewController,
// PHPickerViewController, etc.) which are useless for user-facing
// analytics. We've also disabled the automatic reporting on iOS via
// `FirebaseAutomaticScreenReportingEnabled: false` in app.json's
// infoPlist so we get ONLY our friendly names in GA4.
function ScreenViewTracker() {
  // Expo Router types `useSegments()` as a tuple of known segments
  // when typedRoutes is enabled — cast to string[] for our generic
  // segments → screen name mapper, which doesn't need the precise type.
  const segments = useSegments() as readonly string[]
  const lastKeyRef = useRef<string>('')
  useEffect(() => {
    if (!segments || segments.length === 0) return
    const key = segments.join('/')
    if (key === lastKeyRef.current) return
    lastKeyRef.current = key
    const { name, className } = segmentsToScreenName(segments)
    logScreenView(name, className)
  }, [segments])
  return null
}

// Asks the iOS user for tracking permission once, on first launch after
// install. Without consent, IDFA is unavailable — Meta + Google Ads
// attribution falls back to aggregate methods (SKAdNetwork) with much
// lower fidelity. Android has no equivalent prompt; AAID is allowed by
// default subject to user opt-out in OS settings.
function ATTPromptHost() {
  useEffect(() => {
    if (Platform.OS !== 'ios') return
    if (!trackingTransparency) return // Expo Go — skip
    let cancelled = false
    // Defer past splash screen + first paint so the prompt doesn't
    // collide with launch animations or the welcome carousel render.
    const t = setTimeout(async () => {
      try {
        const { status } = await trackingTransparency.getTrackingPermissionsAsync()
        if (cancelled) return
        if (status === 'undetermined') {
          await trackingTransparency.requestTrackingPermissionsAsync()
        }
      } catch (e) {
        if (__DEV__) console.warn('[ATT] prompt failed:', e)
      }
    }, 1500)
    return () => { cancelled = true; clearTimeout(t) }
  }, [])
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
        <WelcomeTourProvider>
          <GradingPollerHost />
          <ATTPromptHost />
          <ScreenViewTracker />
          <GradingStatusBar />
          <OfflineBanner />
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            {/* card/[id] renders AppHeaderBar inline so it gets the
                shared chrome (DCM logo + credit balance) like every other
                screen — disable the Stack header to avoid stacking. */}
            <Stack.Screen
              name="card/[id]"
              options={{ headerShown: false }}
            />
            {/* No fullScreenModal — that would cover the persistent
                GradingStatusBar that lives in the layout chrome above
                AuthGate. Users want to see grading progress for cards
                already in the queue while submitting/processing the
                next one. */}
            <Stack.Screen
              name="grade"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="pages"
              options={{ headerShown: false }}
            />
          </Stack>
          <ConditionalHelpBot />
          {/* Welcome tour overlay — visibility controlled by
              WelcomeTourContext. Sits above all routes so it can render
              the intro / completion panels and the per-step tooltip
              card on whichever tab the tour is currently navigating. */}
          <WelcomeTour />
        </AuthGate>
        </WelcomeTourProvider>
        </GradingQueueProvider>
        </EmblemsProvider>
      </CreditsProvider>
    </AuthProvider>
    </StripeProvider>
  )
}
