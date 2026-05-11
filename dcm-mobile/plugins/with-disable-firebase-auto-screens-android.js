/**
 * Custom Expo config plugin — disables Firebase Analytics' automatic
 * screen reporting on Android, mirroring the iOS
 * `FirebaseAutomaticScreenReportingEnabled: false` flag we set in
 * app.json's iOS infoPlist.
 *
 * Without this, Firebase auto-captures the launcher Activity name
 * ("MainActivity") as a screen view on app open — useless for
 * user-facing analytics because it lumps every cold-start into one
 * non-descriptive screen. Combined with our manual logScreenView()
 * calls keyed on Expo Router paths, disabling auto-reporting ensures
 * GA4 ONLY sees the friendly names ("Collection", "Card Detail",
 * "Grade — Capture", etc.).
 *
 * Mechanism: adds a `<meta-data>` entry to the AndroidManifest under
 * the existing <application> tag, per Firebase Android SDK docs:
 *   https://firebase.google.com/docs/analytics/screenviews
 *
 * Wired in app.json plugins array alongside the iOS Podfile fix
 * plugin.
 */

const { withAndroidManifest } = require('@expo/config-plugins')

const META_NAME = 'google_analytics_automatic_screen_reporting_enabled'

module.exports = function withDisableFirebaseAutoScreensAndroid(config) {
  return withAndroidManifest(config, async (config) => {
    const application = config.modResults.manifest.application?.[0]
    if (!application) return config

    application['meta-data'] = application['meta-data'] || []

    // Idempotent — leave any existing entry alone if it's already there.
    const existing = application['meta-data'].find(
      (m) => m.$ && m.$['android:name'] === META_NAME,
    )
    if (existing) return config

    application['meta-data'].push({
      $: {
        'android:name': META_NAME,
        'android:value': 'false',
      },
    })

    return config
  })
}
