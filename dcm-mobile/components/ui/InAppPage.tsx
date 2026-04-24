import { View, StyleSheet, ActivityIndicator } from 'react-native'
import { WebView } from 'react-native-webview'
import { useState } from 'react'
import { Colors } from '@/lib/constants'

const WEB_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'

interface InAppPageProps {
  path: string
}

/**
 * Renders a DCM web page inside the app using WebView.
 * Hides the web navigation/footer to show just the content.
 */
export default function InAppPage({ path }: InAppPageProps) {
  const [loading, setLoading] = useState(true)
  const url = `${WEB_URL}${path}`

  // Injected JS to hide the web nav and footer for a cleaner in-app look
  const injectedJS = `
    (function() {
      var nav = document.querySelector('nav');
      if (nav) nav.style.display = 'none';
      var footer = document.querySelector('footer');
      if (footer) footer.style.display = 'none';
      // Hide any fixed headers
      var headers = document.querySelectorAll('header');
      headers.forEach(function(h) { h.style.display = 'none'; });
      // Add top padding to compensate for hidden nav
      var main = document.querySelector('main');
      if (main) main.style.paddingTop = '16px';
    })();
    true;
  `

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
        injectedJavaScript={injectedJS}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        showsVerticalScrollIndicator={false}
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
