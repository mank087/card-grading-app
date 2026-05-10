/**
 * Custom Expo config plugin — patches the iOS Podfile so the React
 * Native Firebase bridge can include React-Core's non-modular headers
 * inside framework modules (which static-framework builds reject by
 * default with -Werror).
 *
 * Without this, EAS iOS builds fail in the Xcode compile phase with:
 *   "include of non-modular header inside framework module
 *    'RNFBApp.RCTConvert_FIRApp'"
 *
 * Implementation: injects an `installer.pods_project.targets.each`
 * loop at the START of the existing `post_install do |installer|`
 * block. Critically: CocoaPods rejects two `post_install` blocks in
 * the same Podfile, so this plugin MUST find the existing one (added
 * by Expo's autolinking) rather than create a new one.
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const INJECTED_BLOCK = `
  # @injected by plugins/with-firebase-podfile-fix.js — required for
  # @react-native-firebase + useFrameworks:static. See the plugin
  # source for context.
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
  end
`;

const POST_INSTALL_MARKER = /post_install do \|installer\|\s*\n/;

module.exports = function withFirebasePodfileFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      // Idempotent — bail if already applied.
      if (contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        return config;
      }

      // Inject INTO the existing post_install block. We match
      // `post_install do |installer|` (a fixed pattern Expo always
      // emits) and prepend our targets loop right after that line.
      // Adding a second post_install block is unsupported by
      // CocoaPods so we never want to create one.
      if (POST_INSTALL_MARKER.test(contents)) {
        contents = contents.replace(POST_INSTALL_MARKER, (match) => `${match}${INJECTED_BLOCK}`);
        fs.writeFileSync(podfilePath, contents);
      } else {
        // Surface a clear error rather than silently creating a
        // second post_install (the previous failure mode).
        throw new Error(
          '[with-firebase-podfile-fix] Could not find a `post_install do |installer|` ' +
          'block in the generated Podfile. The Expo template may have changed — ' +
          'update plugins/with-firebase-podfile-fix.js to match.'
        );
      }

      return config;
    },
  ]);
};
