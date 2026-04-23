import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useFonts } from 'expo-font'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { CreditsProvider } from '@/contexts/CreditsContext'
import { Colors } from '@/lib/constants'

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
      // Not logged in and not on auth screen — redirect to login
      router.replace('/(auth)/login')
    } else if (user && inAuthGroup) {
      // Logged in but on auth screen — redirect to main app
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

  useEffect(() => {
    if (error) throw error
  }, [error])

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync()
  }, [loaded])

  if (!loaded) return null

  return (
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
          </Stack>
        </AuthGate>
      </CreditsProvider>
    </AuthProvider>
  )
}
