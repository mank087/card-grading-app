# Combined mobile camera and parity release

Prepared October 5, 2026 on `codex/camera-native-focus`, following the October 3 mobile/web parity review. Production web base: `f2d41e23`. Prior native camera source: `e5922054`. Current production OTA source: `2295abd1` on its separate release branch.

## Included changes

- Native grade-review requests, details disputes, status/results, and proposed-grade decisions use the existing server APIs and eligibility rules.
- Bulk grading is accessible from the Grade tab, using existing pairing, notes, binder, progress, and credit workflows. Mobile intake is limited to 20 cards. A retry reuses the created draft and uploaded files; image failures prevent commit. Purchases open separately to preserve selected photos while the user returns.
- Public card/collection links work without sign-in. The new generic `/card/[id]` web redirect queries only public, nondeleted cards. Collection username setup and native sharing are available; existing per-card visibility controls remain authoritative.
- Password recovery preserves trusted recovery credentials transiently through native link handling and consumes them on a dedicated reset screen.
- Embedded pages synchronize native sessions, constrain navigation/messages to trusted origins, refresh credits after checkout, provide load retry, and hand downloads to native sharing. Native Supabase owns refresh-token rotation.
- Export authentication moves from URL parameters to an in-memory message handoff. Backward-compatible web receivers support installed versions. Card labels, previews, collection batch exports, and Label Studio use the handoff.
- Credit failures preserve the last confirmed balance and show an unavailable/retry state. Account switches cannot expose the previous balance. Header, report navigation, explanatory text, retake wording, accessibility labels, and embedded support were updated.
- Mobile TypeScript errors are fixed. CI now checks native TypeScript and the web/mobile consistency rules alongside the existing regression suite.
- The native camera patch already on this branch is included: point metering, retained successful focus, quality-prioritized capture, and direct image processing. See `CAMERA_CAPTURE_IMPROVEMENTS_2026-10-03.md` for implementation and earlier binary evidence.

## Purchase paths

**iOS continues to use StoreKit; Android continues to use Stripe.** Existing platform purchase components and payment API implementations were retained. The new embedded route policy sends iOS credit/membership links to their native routers and leaves Android checkout on Stripe. Completion messages request a server balance refresh; they cannot supply a trusted balance.

## Verification

The final complete regression suite passed: **170 test files, 2,128 tests passed, 6 skipped**. Web and mobile TypeScript passed. All 19 web/mobile consistency pairs passed. Both final iOS and Android JavaScript bundles compiled with Expo Metro/Hermes. Git whitespace checks passed. Vercel successfully built the companion web preview at application commit `d3101c78`.

Automated tests cover payment/navigation boundaries, native credit failure/account-switch races, authentic session expiry, recovery-link parsing, export receiver compatibility, mounted native export generation/preview, public-card filtering, grade-review API schema compatibility, and upload-attempt recovery. Mounted grade-review tests exercise the request form, details-only correction, accept/keep decisions, and non-owner access. The final export regression verifies that authentication reaches the hidden generator while the iOS PDF preview stays local. A final web fix keeps credit options reachable if the balance changes during upload; retry retains completed uploads.

Compilation and automated tests do not validate camera optics, physical-device UI, real purchases, or email universal-link delivery.

## Build artifacts

Both EAS builds finished successfully from native source `1a6438e570b98959b8aff69dcf4c57999b065dbc`. Commit `d3101c78` changes only web credit-recovery handling and tests; the native sources match these artifacts exactly. Both are version/runtime 1.0.3 on `camera-validation`.

| Platform | Build and artifact | Verification |
| --- | --- | --- |
| Android | [Build 7](https://expo.dev/accounts/dcm_grading/projects/dcm-mobile/builds/5ef268cb-3616-4ee0-91be-2a633bc7929b); [installable APK](https://expo.dev/artifacts/eas/GpwqQLncOSnRXEnjZ0SXvi0WFVQUYilG92aFakCagAc.apk) | Gradle compiled Expo Camera from source. Downloaded APK contains all three DCM native camera controls in `classes4.dex`. |
| iOS | [Build 15](https://expo.dev/accounts/dcm_grading/projects/dcm-mobile/builds/1dee2165-26d3-48e8-898d-99490c74bc1b); [signed IPA](https://expo.dev/artifacts/eas/BVmpYYr-eEa7KTR1YIu16-EBDPo93aAP1DaUUiYYQlk.ipa) | Physical-device App Store archive succeeded. Downloaded Mach-O contains the capability property and both method registrations, with the short Swift strings encoded as ARM64 immediate words. This is not a simulator build. TestFlight submission remains separate. |

Artifact SHA-256:

- Android, 143,679,956 bytes: `2601b593d6fa38038d6accb78d7a1e52b55ea3e367fb06d891dcc1a30ca8a962`.
- iOS, 26,259,296 bytes: `87827d0821607448bc58009f768268cb04c720a38ddb07b4fa17a53d822d2a66`.

Expo Doctor reports seven available SDK 54 patch updates (Expo, constants, file system, font, localization, router, updates). These are version-alignment notices, not native compilation failures. This release retains the tested dependency lock and pinned camera patch; dependency upgrades should receive a separate patch review and device check.

The Vercel preview is access-protected. Browser inspection reached Vercel sign-in in both available browser sessions, so no authenticated or visual acceptance result is claimed. Production web, production OTA channels, and app stores were not updated by this release preparation.

## Coordinated rollout

1. Pass web/mobile type checks, tests, consistency checks, and both Expo JavaScript exports. Compile the new signed Android and iOS binaries with the patched native camera module.
2. Deploy the companion web receivers and session/navigation bridge **before distributing the new app binaries**. New export flows depend on that receiver. Installed apps remain compatible through the legacy receiver path.
3. Validate the combined release on physical Android/iPhone devices. Focus acceptance: tap fine print, hold still for at least ten seconds, capture, and inspect saved detail; then change distance and tap again. Repeat front/back, torch, camera reopen, and background/foreground, comparing the phone's system camera under the same conditions.
4. Verify iOS StoreKit sandbox purchase/restore/cancel and Android Stripe success/cancel. Confirm credit refresh and retained batch photos on return. Exercise grade review, public/private sharing, recovery links, batch retry, labels/reports, external links, and large text.
5. Promote the accepted native binaries through their store release process. OTA cannot install the native camera methods into older runtimes. Keep older runtime lanes separate.

The Android `camera-validation` profile produces an installable APK. The iOS `release-validation` profile produces a signed physical-device/store build on the isolated `camera-validation` update channel; TestFlight distribution is a separate submission step.

## Deferred work and remaining limits

Native bulk capture, persisted offline/process-death batch drafts, device-specific macro switching, and calibrated blur thresholds are outside this release. This work does not change corner detection or grading algorithms. A failed in-memory batch can be retried in the same session; selected local files are not recoverable after the app process is killed.

No new production OTA or store release is implied by this document. Physical acceptance of the reported Android focus problem is still required.
