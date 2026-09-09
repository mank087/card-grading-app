import { View, StyleSheet, ActivityIndicator, BackHandler } from 'react-native'
import { WebView } from 'react-native-webview'
import { useRouter, useSegments, useNavigation } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Colors } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import MobileTabBar from '@/components/MobileTabBar'
import AppHeaderBar from '@/components/AppHeaderBar'
import { APP_USER_AGENT_SUFFIX, withEmbeddedParams } from '@/lib/embeddedWeb'

const WEB_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'

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
  // Some tabs (e.g. Pricing) re-export an InAppPage-backed /pages screen
  // so the tab and the standalone route share one implementation. When
  // mounted as a tab, the (tabs) layout already provides AppHeaderBar +
  // tab bar, so suppress our inline chrome to avoid stacking two of each.
  const segments = useSegments()
  const isTabContext = segments[0] === '(tabs)'
  const navigation = useNavigation()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<{ access_token: string; refresh_token: string; user: any } | null>(null)
  const [ready, setReady] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const webViewRef = useRef<WebView>(null)
  // `app=1` tells the web side to render in embedded mode (see lib/embeddedWeb.ts).
  const url = useMemo(() => withEmbeddedParams(`${WEB_URL}${path}`), [path])

  const handleBack = () => {
    // Inside the WebView, walk back through web nav history first; if the
    // user is at the page they entered on, exit to the previous app screen.
    if (canGoBack) {
      webViewRef.current?.goBack()
    } else {
      router.back()
    }
  }

  // Tab re-tap: when the user is already on this tab and taps it again
  // in the bottom nav, snap the WebView back to its start URL. Without
  // this, SPA navigations inside the WebView (e.g. Portfolio → a card
  // detail page on the web side) leave the user stranded — the tab
  // press is a no-op because expo-router considers them "already there."
  useEffect(() => {
    if (!isTabContext) return
    const unsub = navigation.addListener('tabPress' as any, () => {
      webViewRef.current?.injectJavaScript(
        `try { window.location.replace(${JSON.stringify(url)}); } catch(e) {} true;`,
      )
    })
    return unsub
  }, [isTabContext, navigation, url])

  // Android hardware back: when this screen is focused, prefer walking
  // the WebView's own history before letting expo-router pop. Otherwise
  // tapping back from inside a SPA-navigated page exits the tab instead
  // of returning to the page the user came from.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (canGoBack) {
          webViewRef.current?.goBack()
          return true
        }
        return false
      })
      return () => sub.remove()
    }, [canGoBack]),
  )

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

  // After load: hide *global* chrome (site nav/footer/helpbot) for a clean
  // in-app look, without eating real page content.
  //
  // Two eras of web deployment are supported:
  //
  //  A) NEW web (sets `html[data-embedded="1"]` when it sees `?app=1` or the
  //     `DCMGradingApp/<version>` user agent). It marks only global chrome
  //     with `data-site-chrome`, so we hide exactly that. In-content
  //     `<header>`s (Pricing/Reports intros) and section `<nav>`s
  //     (Reports, Pop, Portfolio, Why DCM) survive.
  //
  //  B) OLD web (no `data-embedded`). We fall back to the historical blanket
  //     `header, nav, footer` rule so already-shipped pages still look right.
  //     This branch is the one that can eat content, which is exactly why it
  //     is gated on the absence of the new contract.
  //
  // dcmgrading.com is a Next.js SPA — client-side routing tears down and
  // re-mounts chrome, and `data-embedded` may be stamped by a client effect
  // *after* our first run. So the decision is re-evaluated on every DOM
  // mutation (cheap: it is one dataset read) and the stylesheet text is
  // rewritten only when the verdict actually changes. The observer is
  // mounted once and persists across SPA navigations via `window`.
  const injectedAfterLoad = `
    (function() {
      if (window.__dcmInAppHideInstalled) {
        // Re-entry after a full page load in the same WebView: make sure the
        // rule still reflects the current document.
        if (window.__dcmInAppApplyChrome) { window.__dcmInAppApplyChrome(); }
        return;
      }
      window.__dcmInAppHideInstalled = true;

      var SHARED = [
        'main { padding-top: 16px !important; }',
        // Explicitly-marked global chrome (new web contract).
        '[data-site-chrome] { display: none !important; }',
        // HelpBot floating button (fixed bottom-right, high z-index)
        '.fixed.bottom-6.right-6 { display: none !important; }',
        '[class*="fixed"][class*="bottom-6"][class*="right-6"] { display: none !important; }',
        // Site-wide "Download the app" launch banner — redundant in-app.
        // Selector is set on src/components/LaunchBanner.tsx (web).
        '[data-dcm-launch-banner] { display: none !important; }',
      ];
      // Legacy blanket rule. Applied ONLY when the page does not advertise
      // the data-embedded contract.
      var LEGACY = 'header, nav, footer { display: none !important; }';

      var style = document.createElement('style');
      style.id = '__dcm-in-app-hide';
      (document.head || document.documentElement).appendChild(style);

      var lastMode = null;
      function applyChrome() {
        var docEl = document.documentElement;
        var embedded = docEl && docEl.getAttribute('data-embedded') === '1';
        var mode = embedded ? 'marked' : 'legacy';
        if (mode === lastMode) { return; }
        lastMode = mode;
        var rules = SHARED.slice();
        if (!embedded) { rules.unshift(LEGACY); }
        style.textContent = rules.join('\\n');
      }
      window.__dcmInAppApplyChrome = applyChrome;
      applyChrome();

      // Belt-and-suspenders: anything HelpBot-shaped that escapes the
      // class selectors gets hidden by computed-style sweep. Never sweeps
      // non-fixed content, so it cannot hide page copy.
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

      // Watch for DOM changes (Next.js client-side route transitions swap
      // out the page tree, and the embedded flag can be stamped late) and
      // re-run both the chrome decision and the floating-element sweep.
      var obs = new MutationObserver(function() {
        applyChrome();
        sweepFloating();
      });
      obs.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-embedded'],
      });
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
          without leaving the page entirely. Skipped in tab context — the
          tab's own header already provides the same chrome. */}
      {!isTabContext && <AppHeaderBar showBack title={title} onBack={handleBack} />}
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.purple[600]} />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webview}
        // Appended to (not replacing) the platform's default WebView UA, so
        // the web side can detect the app via `DCMGradingApp/<version>`.
        applicationNameForUserAgent={APP_USER_AGENT_SUFFIX}
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
        // iOS: enable the native edge-swipe back/forward gesture so
        // users can swipe-back through WebView history the same way they
        // would in Safari. No-op on Android.
        allowsBackForwardNavigationGestures
      />
      {!isTabContext && <MobileTabBar />}
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
