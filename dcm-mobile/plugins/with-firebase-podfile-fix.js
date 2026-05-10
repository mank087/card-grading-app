/**
 * Custom Expo config plugin — adds `use_modular_headers!` near the top
 * of the iOS Podfile so Firebase's Swift pods (FirebaseCoreInternal)
 * can import C-header pods (GoogleUtilities) which would otherwise
 * fail with:
 *
 *   "The Swift pod `FirebaseCoreInternal` depends upon `GoogleUtilities`,
 *    which does not define modules."
 *
 * This is one of the two CocoaPods-recommended fixes for that error
 * (the other is `useFrameworks: 'static'`). For our combination —
 * Expo SDK 54 + new architecture (required by Reanimated 4) +
 * @react-native-firebase v24 — useFrameworks:'static' triggers a
 * cascade of Xcode compile errors when RNFirebase's bridge files
 * reference React-Core macros. `use_modular_headers!` keeps the
 * default dynamic frameworks but forces every pod to expose its
 * headers as a Clang module, satisfying both Firebase's Swift
 * imports AND the new architecture's stricter module rules.
 *
 * This file lives at dcm-mobile/plugins/with-firebase-podfile-fix.js
 * and is wired in app.json plugins array.
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const DIRECTIVE = 'use_modular_headers!';

module.exports = function withFirebasePodfileFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      // Idempotent — bail if already applied.
      if (contents.includes(DIRECTIVE)) {
        return config;
      }

      // Inject right after the `platform :ios, ...` line, which is the
      // canonical location for global Podfile directives in Expo's
      // generated Podfile. If that line isn't found (template change),
      // fall back to inserting at the top of the file.
      const platformLine = /^platform :ios.*$/m;
      if (platformLine.test(contents)) {
        contents = contents.replace(platformLine, (match) => `${match}\n${DIRECTIVE}`);
      } else {
        contents = `${DIRECTIVE}\n${contents}`;
      }

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
};
