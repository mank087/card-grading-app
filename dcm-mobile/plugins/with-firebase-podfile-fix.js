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
 * This is the workaround documented at https://rnfirebase.io/ for the
 * combo of @react-native-firebase v22+, Expo's static frameworks
 * (`useFrameworks: 'static'` in expo-build-properties), and the React
 * Native bridge module headers that ship as plain non-modular .h
 * files.
 *
 * Implementation: injects
 *   config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
 * into the existing post_install block of the Podfile so every target
 * inherits the relaxed header import policy.
 *
 * This file lives at dcm-mobile/plugins/with-firebase-podfile-fix.js
 * and is wired in app.json plugins array.
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FLAG_LINE = "      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'";

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

      // Expo's generated Podfile has a post_install block with the form:
      //   post_install do |installer|
      //     ...
      //     installer.pods_project.targets.each do |target|
      //       target.build_configurations.each do |config|
      //         ...
      //       end
      //     end
      //   end
      // Inject the flag right after the inner "target.build_configurations.each do |config|" line.
      const innerMarker = /target\.build_configurations\.each do \|config\|\s*\n/;
      if (innerMarker.test(contents)) {
        contents = contents.replace(innerMarker, (match) => `${match}${FLAG_LINE}\n`);
      } else {
        // Fallback — append a new post_install block at the end of the file.
        contents += `

post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
${FLAG_LINE}
    end
  end
end
`;
      }

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
};
