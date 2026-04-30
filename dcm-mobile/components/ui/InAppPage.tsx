import { View, StyleSheet, ActivityIndicator } from 'react-native'
import { WebView } from 'react-native-webview'
import { useState, useEffect } from 'react'
import { Colors } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

const WEB_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'

interface InAppPageProps {
  path: string
}

/**
 * Renders a DCM web page inside the app using WebView.
 * Injects the user's auth session BEFORE page load so authenticated
 * features (Label Studio, Market Pricing, Account) work correctly.
 */
export default function InAppPage({ path }: InAppPageProps) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<{ access_token: string; refresh_token: string; user: any } | null>(null)
  const [ready, setReady] = useState(false)
  const url = `${WEB_URL}${path}`

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

  // After load: hide nav/footer/helpbot for clean in-app look
  const injectedAfterLoad = `
    (function() {
      var nav = document.querySelector('nav');
      if (nav) nav.style.display = 'none';
      var footer = document.querySelector('footer');
      if (footer) footer.style.display = 'none';
      var headers = document.querySelectorAll('header');
      headers.forEach(function(h) { h.style.display = 'none'; });
      var main = document.querySelector('main');
      if (main) main.style.paddingTop = '16px';
      // Hide web HelpBot (fixed bottom-right floating button)
      var fixedEls = document.querySelectorAll('.fixed.bottom-6.right-6, [class*="fixed"][class*="bottom-6"][class*="right-6"]');
      fixedEls.forEach(function(el) { el.style.display = 'none'; });
      // Also hide by z-index pattern (HelpBot uses z-40)
      setTimeout(function() {
        document.querySelectorAll('.fixed').forEach(function(el) {
          var s = window.getComputedStyle(el);
          if (s.position === 'fixed' && parseInt(s.bottom) < 50 && parseInt(s.right) < 50 && parseInt(s.zIndex) >= 40) {
            el.style.display = 'none';
          }
        });
      }, 1000);
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
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.purple[600]} />
        </View>
      )}
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        onLoadEnd={() => setLoading(false)}
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
