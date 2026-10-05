# Camera capture improvements

Implemented in an isolated checkout based on master `931e7c02263c25bc84f2f8827c229aefb7c293c0`. These changes address the Android tap-focus defect, unnecessary image degradation, limited browser capture detail, and misleading close-up guidance. The web changes were deployed to production on October 3, 2026 in commit `f2d41e23e2081fd911e790105d1bffa9f1ae3cac`. Compatible JavaScript improvements were also published by OTA from `bdacdc42` to iOS runtimes 1.0.1/1.0.2 and Android runtimes 1.0.0/1.0.2. All four production manifests and downloaded bundle hashes were verified. Release records are in `docs/MOBILE_CAMERA_OTA_2026-10-03.md` on branch `codex/camera-ota-production`. Native changes are committed on `codex/camera-native-focus`. Android APK and iOS simulator builds compiled successfully on EAS. Both downloaded artifacts contain the new native focus methods. Physical-device validation is still required. No new production OTA was published for the subsequent focus-hunting report.

## Native apps

- Tap positions now reach native autofocus and exposure metering. Android converts the visible preview coordinates through CameraX's PreviewView metering factory; iOS converts them through the preview layer. New binaries use these native controls instead of the legacy 150 ms autofocus toggle.
- Focus has cancellation, bounded timeouts, and explicit results. Android's green ring requires a successful autofocus result. iOS reports that lens adjustment settled, which is not proof of optical sharpness. Successful focus stays held until an explicit new tap, capture/retake, or session exit. Android disables CameraX auto-cancel; iOS removes the timed return to continuous autofocus. Failed or timed-out requests still release focus. Hiding the visual reticle preserves the successful focus status so the shutter does not trigger another center-focus sweep.
- The shutter waits for camera readiness and a focus attempt. Capture controls cannot change framing or camera selection while a photo is being saved. Backgrounding or leaving the screen invalidates pending camera results; startup errors offer retry and Gallery.
- Android uses CameraX's quality-prioritized still capture; iOS configures quality-prioritized photo output. The iOS photographic preset is selected at mount instead of reconfiguring the session after readiness.
- New binaries transfer native image references directly into ImageManipulator, then crop, resize, and save at JPEG quality 0.92. This removes an intermediate JPEG encode. iOS bakes image orientation into the referenced pixels before reporting dimensions. Image references and processing contexts are released after use.
- Older binaries are detected through a native capability property. They retain continuous autofocus and a file-based capture path. The October 3 follow-up hotfix (`2295abd1`) restores their earlier tap-to-refocus pulse: 150 ms in single-focus mode, then continuous AF, with neutral feedback and no claim of measured focus success. The first OTA incorrectly removed that useful fallback. These binaries still do not call unsupported native methods.
- The same hotfix adds Phone Camera through the already-installed image picker module. It unmounts the embedded camera before opening the system camera and brings the full composition into the existing review flow without guide cropping. Cancellation, permission denial, launch errors, and leaving the screen are handled. This route can use the phone camera's own focus controls; optical performance still needs device testing.
- Focus checks that cannot run are shown as unknown. Framing advice asks users to keep a margin around all four edges and move back slightly if text stays soft. Low file resolution no longer tells users to move closer.
- Capture telemetry records the native capability, focus result, processing path, input/output dimensions, sharpness measurement status, device model, OS, app/runtime version, and update ID. It adds no photo data or user-assigned device name.

## Mobile web

- Resolution requests follow the phone viewport orientation. Portrait phones request portrait video dimensions, reducing detail lost when a landscape stream is cropped to a tall viewfinder. Constraints are preferences; actual hardware/browser negotiation still varies.
- The burst selects sharpness within the visible guide rather than an unrelated central rectangle. Preview and still candidates are compared at equal sample dimensions with contrast normalization. A larger still cannot automatically replace a materially sharper preview; equally sized stills can qualify.
- Blank images no longer count as evidence of alignment. Stills that do not cover the guide are rejected before bounds clamping can hide the missing area.
- Still capture requests photographic dimensions within a memory budget, has timeouts, and retries without size constraints when a camera rejects its advertised range. Unsupported still capture continues to use the selected preview frame.
- The warning estimates pixels inside the guide, excluding crop padding. Throttled live hints advise on motion, lighting, and soft text; they do not claim that a card was detected or guarantee sharpness.
- “Use Phone Camera” opens the device's capture-capable file picker. Returned photos keep their composition, receive orientation-aware resizing, and go through the existing review/rotation flow. HEIC conversion uses the existing compatibility helper when needed.
- Permission denials no longer trigger repeated resolution fallbacks. Late camera requests are stopped, overlapping requests cannot replace the latest camera, and shutter controls remain disabled until video frames are available. The stream stops during photo review.

The existing corner detection and grading algorithms are unchanged.

## Verification

- 55 focused tests passed across capture geometry, still alignment and selection, native bridge fallback/timeouts, patch installation, browser session lifecycle, local capture audit, historical layout behavior, capture reason codes, and corner tiles.
- The native patch was applied to isolated copies of the installed Expo sources. Tests verify repeatable installation, exact version enforcement, and refusal to write any files when an upstream anchor changes. These tests validate source installation; the EAS builds described below separately compile the native code.
- Final web TypeScript, targeted ESLint, and Git whitespace checks passed.
- Before the web production push, the complete web suite passed: 2,029 tests passed and 6 skipped across 160 files. The browser lifecycle tests now use a declared root development dependency instead of depending on the mobile installation. GitHub CI also passed on the deployed commit.
- Vercel confirmed successful Production deployment `6833870466`. The live `https://dcmgrading.com/upload` page and its `page-6aabc33ea0b1ca49.js` asset returned HTTP 200. The asset contains Phone Camera, the new framing copy, capture-v2 diagnostics, and sharpness-based still selection; the old move-close instruction is absent. The release contains 17 web/dependency/test files and no native app changes.
- Android and iOS JavaScript exports passed using Expo Metro and Hermes. These do not compile the Kotlin or Swift changes. The Android output was also checked for the new focus adapter and direct-image capture path.
- Browser checks used the real camera components with a synthetic canvas video stream at 390 by 844 and 375 by 667. Capture reached review, rotation changed the photo from 864 by 1209 to 1209 by 864, and retake returned to a ready camera. Physical camera optics and the mobile OS picker were not exercised by that test.
- Full mobile TypeScript reports four errors in unchanged files: three TS2493 tuple-index errors in `app/_layout.tsx` at lines 195 and 229, and an unused `@ts-expect-error` in `components/ExternalLink.tsx` at line 13. No capture-file errors were reported.

## Native release requirements

App version is now **1.0.3**, with the existing `appVersion` runtime policy. These native features require new Android and iOS binaries. Publishing an OTA alone cannot add the new focus methods. Existing runtime lanes should be maintained from a separate reviewed release checkout.

Expo Camera is pinned to **17.0.10**. `dcm-mobile/scripts/patch-camera.cjs` runs at npm postinstall; `npm run check:camera-patch` verifies the installation. It refuses other upstream versions or changed patch anchors. Any Expo Camera upgrade must review or replace this patch.

This native release checkout now has an independent dependency installation. A fresh npm ci installed all 836 packages and applied the patch to six native files; the verification command passed. The original checkout dependencies were left untouched. Reproduce with:

```text
cd dcm-mobile
npm ci
npm run check:camera-patch
```

The Android APK and iOS simulator builds compile successfully; an iOS device/store build is still needed. Test the reported Android phone, a recent Pixel, a recent Samsung Galaxy, and iPhones with and without macro-capable hardware. Check taps near each preview corner, near/far focus transitions, repeated shutter taps, foreground/background recovery, camera switching, portrait/landscape captures, all four card edges, and photo orientation. Compare fine print and edge detail at full resolution against each phone's own camera app in the same lighting.

## Remaining limits

This change does not implement device-specific macro lens switching, sensor-level minimum-focus-distance feedback, live card detection, or a new server quality gate. The guide region is still an approximation of where the card is. Absolute blur thresholds remain advisory and need device calibration, especially for foil, reflective sleeves, and low-texture card backs. The relative still-versus-preview selector also needs comparison against real phone captures before broad rollout.

Retain the Phone Camera/Gallery route for devices whose browser or embedded camera pipeline produces poorer photographs than the phone camera app. No camera setting can restore detail that was never in focus.

## Focus-hunting follow-up

The user reported a briefly sharp preview followed by blur after the corrective OTA. Source inspection confirmed that the legacy refocus pulse cancels its own request after 150 ms. The installed Android implementation also supplies a top-left metering point rather than the user tap, and uses CameraX default auto-cancel. These defects are consistent with the report, but the phone model and physical cause have not been confirmed.

Native commit `0b9adeb1` includes explicit point metering, successful-focus retention, quality-prioritized capture, and direct image processing. The follow-up changes disable native timed release and preserve successful focus after the reticle disappears. The corrected Android validation build uses `f5f5c731`; the iOS simulator profile is added in `231a555a`. Both have runtime 1.0.3 and an isolated camera-validation channel.

Regression validation: 24 tests passed across the mobile capture screen, native bridge adapter, and guarded patch installation. The iOS and Android tap/capture tests advance seven seconds before pressing the shutter and confirm that the same successful focus is reused. Full mobile TypeScript still reports the four unchanged navigation/component errors listed above.

The EAS archive was inspected before upload: 251 files, 11.21 MB uncompressed, limited to dcm-mobile. Required native fragments and the postinstall script are included; environment files, credentials, dependencies, and unrelated repository content are excluded.

Android validation build: https://expo.dev/accounts/dcm_grading/projects/dcm-mobile/builds/da7d36b3-2001-430e-ba70-4217246bd16c (version 1.0.3, build 6). EAS reported FINISHED; Gradle completed successfully in 14m 20s. The initial build bb9b7e90-dfd1-40d7-a816-97f0e6331f41 was cancelled after logs showed Expo selecting its precompiled camera AAR, which bypasses source patches. It must not be distributed as a focus fix. No store submission has been performed. Do not claim optical performance is verified until the new native binary is tested on the affected device.


iOS simulator validation build: https://expo.dev/accounts/dcm_grading/projects/dcm-mobile/builds/ee0f8b40-77c5-4a10-b5c1-b205e0cb5e9f (version 1.0.3, build 14). EAS reported FINISHED and the native Swift build passed. This checks Swift compilation only; it cannot validate an iPhone camera or be installed on a physical iPhone.

Android build configuration now requires `expo.autolinking.android.buildFromSource: ["expo-camera"]`. The postinstall verifier refuses to run without that setting. An integration test invokes Expo's actual autolinking resolver and checks that the resolved camera Gradle projects match the source-build patterns. This prevents a successful build from silently linking the unmodified camera module. See https://docs.expo.dev/guides/prebuilt-expo-modules/ for the framework behavior.

The completed iOS simulator artifact was downloaded and its compiled Mach-O executable contains dcmCaptureControlsVersion, dcmFocusAtPoint, and dcmCancelFocus. Archive SHA-256: 03d7cbe6a1861197c4ecb377d36beea19c34a967e30632ec76cf9a45e2899143. Main executable SHA-256: cfc41e2d5cc79bf8b39d31fc36f1c5acc555a670fa9d76332e84c17040e12f38. This establishes that the native implementation is linked, not that phone optics have been tested.

Root project TypeScript passed. CI now installs pristine mobile sources with scripts disabled so the native patch tests can run without a local mobile installation or modifying installed source files.

The completed Android APK was downloaded and independently inspected. Its binary AndroidManifest contains com.dcmgrading.app and version 1.0.3. classes4.dex contains dcmCaptureControlsVersion, dcmFocusAtPoint, and dcmCancelFocus, confirming the native controls are in the delivered application rather than only in its JavaScript. APK size: 143,647,172 bytes. SHA-256: ef533e4ad138d8c69b0f9f6afdbbc3fa6c4fff91173d8ce9275536e6dd86c693.

APK: https://expo.dev/artifacts/eas/cP5SI07NM_2xdrssLx2BjOcNLExWZ39YQTAU3dv95xw.apk

Device acceptance still required: tap fine card text, keep the phone and card stationary, wait at least ten seconds, and capture. Confirm both the preview and saved text remain sharp. Then move to a different distance and tap again; check that focus reacquires. Repeat with card front/back, torch, camera reopening, and returning from the background. Compare against Phone Camera at the same distance and lighting. Do not claim the user's focus problem is resolved until this passes on the affected phone. The user's phone model and whether blur occurs without tapping remain unconfirmed.
