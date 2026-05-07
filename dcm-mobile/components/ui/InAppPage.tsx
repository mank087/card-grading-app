import { View, StyleSheet, ActivityIndicator } from 'react-native'
import { WebView } from 'react-native-webview'
import { useRouter } from 'expo-router'
import { useState, useEffect, useRef } from 'react'
import { Colors } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import MobileTabBar from '@/components/MobileTabBar'
import AppHeaderBar from '@/components/AppHeaderBar'

const WEB_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'

interface InAppPageProps {
  path: string
  /** Optional title shown in the in-app top bar. Defaults to "DCM Grading". */
  title?: string
}

/**
 * Renders a DCM web page inside the app using WebView.
 * Injects the user's auth session BEFORE page load so authenticated
 * features (Label Studio, Market Pricing, Account) work correctly.
 */
export default function InAppPage({ path, title }: InAppPageProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<{ access_token: string; refresh_token: string; user: any } | null>(null)
  const [ready, setReady] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const webViewRef = useRef<WebView>(null)
  const url = `${WEB_URL}${path}`

  const handleBack = () => {
    // Inside the WebView, walk back through web nav history first; if the
    // user is at the page they entered on, exit to the previous app screen.
    if (canGoBack) {
      webViewRef.current?.goBack()
    } else {
      router.back()
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        setSession({
          access_token: s.access_token,
          refresh_token: s.refresh_token,
          user: s.user,
        })
      }
      setReady(true)
    })
  }, [])

  // Inject auth BEFORE page content loads — ensures authenticated state on first render
  const injectedBeforeLoad = session ? `
    (function() {
      try {
        var sessionData = {
          access_token: '${session.access_token}',
          refresh_token: '${session.refresh_token}',
          expires_at: ${Math.floor(Date.now() / 1000) + 3600},
          user: ${JSON.stringify(session.user)}
        };
        localStorage.setItem('supabase.auth.token', JSON.stringify(sessionData));
      } catch(e) {}
    })();
    true;
  ` : 'true;'

  // After load: hide nav/footer/helpbot for clean in-app look.
  //
  // dcmgrading.com is a Next.js SPA — client-side routing tears down and
  // re-mounts the nav/footer when the user follows a link inside the
  // WebView. A one-shot hide doesn't survive route changes. We install a
  // CSS rule (instant, applies before paint) plus a MutationObserver that
  // re-runs the hide on every DOM mutation. The observer is mounted once
  // and persists across SPA navigations because it lives on `window`.
  const injectedAfterLoad = `
    (function() {
      if (window.__dcmInAppHideInstalled) { return; }
      window.__dcmInAppHideInstalled = true;

      // Inject a stylesheet — wins against most page styles and applies
      // pre-paint, so users never see a flash of nav/footer.
      var style = document.createElement('style');
      style.id = '__dcm-in-app-hide';
      style.textContent = [
        'header, nav, footer { display: none !important; }',
        'main { padding-top: 16px !important; }',
        // HelpBot floating button (fixed bottom-right, high z-index)
        '.fixed.bottom-6.right-6 { display: none !important; }',
        '[class*="fixed"][class*="bottom-6"][class*="right-6"] { display: none !important; }',
      ].join('\\n');
      document.head.appendChild(style);

      // Belt-and-suspenders: anything HelpBot-shaped that escapes the
      // class selectors gets hidden by computed-style sweep.
      function sweepFloating() {
        document.querySelectorAll('.fixed').forEach(function(el) {
          var s = window.getComputedStyle(el);
          if (s.position === 'fixed'
              && parseInt(s.bottom) < 50
              && parseInt(s.right) < 50
              && parseInt(s.zIndex) >= 40) {
            el.style.display = 'none';
          }
        });
      }
      sweepFloating();

      // Watch for DOM changes (Next.js client-side route transitions
      // swap out the page tree) and re-run the floating-element sweep.
      // The CSS rule already handles header/nav/footer.
      var obs = new MutationObserver(function() { sweepFloating(); });
      obs.observe(document.body, { childList: true, subtree: true });
    })();
    true;
  `

  // Wait for session check before rendering WebView
  if (!ready) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.purple[600]} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Shared header — DCM logo + page title + credits badge. The back
          handler walks WebView history first, then exits to the previous
          app screen, so users can step back through SPA navigations
          without leaving the page entirely. */}
      <AppHeaderBar showBack title={title} onBack={handleBack} />
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.purple[600]} />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webview}
        onLoadEnd={() => setLoading(false)}
        // Re-inject on every navigation. injectedJavaScript only fires on
        // initial load on iOS; this catches any edge cases where the
        // observer didn't get installed (full-page reloads, errors, etc.).
        onLoad={() => webViewRef.current?.injectJavaScript(injectedAfterLoad)}
        onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
        injectedJavaScriptBeforeContentLoaded={injectedBeforeLoad}
        injectedJavaScript={injectedAfterLoad}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        showsVerticalScrollIndicator={false}
        allowFileAccess
        allowFileAccessFromFileURLs
        // Share cookies/storage within the app
        sharedCookiesEnabled
      />
      <MobileTabBar />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray[50],
    zIndex: 10,
  },
  webview: { flex: 1 },
})
