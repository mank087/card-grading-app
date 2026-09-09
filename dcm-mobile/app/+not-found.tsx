import { useEffect, useMemo, useState } from 'react'
import { Stack, useRouter, usePathname, useGlobalSearchParams, Link } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'

import InAppPage from '@/components/ui/InAppPage'
import { Colors } from '@/lib/constants'
import { resolveDeepLink } from '@/lib/deepLinks'

/**
 * Smart catch-all for unmatched routes.
 *
 * Android App Links verification (enabled 2026-05-22) makes the OS route
 * every https://dcmgrading.com/* tap into the DCM app — including paths
 * the app doesn't natively serve (blog posts, marketing pages, pop reports,
 * QR-code targets on slab labels, etc.). Without this handler, those all
 * landed on the bare "screen doesn't exist" error.
 *
 * Behavior:
 *   1. If the path looks like a card detail URL (/<cardType>/<uuid>),
 *      replace with the native /card/[id] screen so the user gets the
 *      proper app experience.
 *   2. Otherwise, mount the InAppPage WebView pointed at the same path.
 *      The web version of dcmgrading.com renders there, and our existing
 *      CSS injector hides the launch banner / nav for a clean look.
 *   3. True "no idea where you wanted to go" fallback (empty pathname,
 *      or the literal /+not-found) keeps the original error message
 *      with a link back to home.
 *
 * Same iOS effect for free — iOS Universal Links go through the same
 * expo-router resolution path.
 */

export default function NotFoundScreen() {
  const pathname = usePathname()
  // usePathname() strips the query string. Universal links to /search,
  // /pop and label previews are meaningless without it, so rebuild the
  // query from the global search params and hand the whole thing to the
  // shared resolver (lib/deepLinks.ts).
  const params = useGlobalSearchParams()
  const router = useRouter()
  const [routed, setRouted] = useState(false)

  const resolved = useMemo(() => {
    const qs = Object.entries(params || {})
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v[0] : String(v))}`)
      .join('&')
    return resolveDeepLink(`${pathname || '/'}${qs ? `?${qs}` : ''}`)
  }, [pathname, params])

  useEffect(() => {
    // The native /card/[id] screen handles every card type uniformly, so
    // /sports/<id>, /pokemon/<id>, etc. all funnel into the same screen.
    if (resolved.kind === 'card' || resolved.kind === 'native-page') {
      router.replace(resolved.href as any)
      setRouted(true)
    }
  }, [resolved, router])

  // While redirecting, show a blank background instead of the not-found UI
  // so there's no visual flash before the redirect.
  if (routed) {
    return <View style={styles.blank} />
  }

  // Any other path — fall back to loading the web version inside the app.
  // Examples this catches: /blog, /blog/<slug>, /featured, /pop,
  // /pop/sports, /why-dcm, /grading-rubric, /collection/<username>,
  // /labels/<id>, etc. The InAppPage WebView injects the user's session
  // before page load so logged-in views work, and the query string is
  // carried through.
  if (resolved.kind === 'embedded-web') {
    return <InAppPage path={resolved.href} title="DCM Grading" />
  }

  // True "nowhere to go" fallback — keep the original error UX.
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn{'’'}t exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen</Text>
        </Link>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: Colors.gray[50] },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.gray[50],
  },
  title: { fontSize: 20, fontWeight: 'bold', color: Colors.gray[900] },
  link: { marginTop: 15, paddingVertical: 15 },
  linkText: { fontSize: 14, color: Colors.purple[600] },
})
