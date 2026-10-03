# Mobile camera OTA release — October 3, 2026

Published to Expo project `382e423a-3284-4156-b21a-e9578f2a2f99`, production channel/branch. Source commit: `bdacdc421f16048f96f3bec5ff33c3d204f912a1`, branch `codex/camera-ota-production`, based on deployed web commit `f2d41e23` and the previous mobile release source `931e7c02`.

## Published updates

| Platform | Runtime | Update group | Update ID |
| --- | --- | --- | --- |
| iOS | 1.0.2 | `326c912c-6430-4eb2-952f-cb350c67306d` | `01a10402-247a-7272-a855-7f4fb661bc3a` |
| Android | 1.0.2 | `d141fa75-9d9d-412c-ad43-51e58dd9d58a` | `01a10403-1402-74b8-adf0-29f254b72ce3` |
| iOS | 1.0.1 | `455e3c8c-971b-4ca1-ade4-2b94d5fb9f1f` | `01a10404-20ea-7d5c-9d5c-81db016fe170` |
| Android | 1.0.0 | `a2963233-074e-4288-8155-d036071e6a75` | `01a10404-d992-7b12-a068-003325f97c4d` |

All four groups were confirmed as the latest production releases. Production manifest requests with each platform/runtime pair returned these update IDs. Their actual CDN bundles were downloaded using the manifest's asset request headers and matched the validated local SHA-256 hashes:

- iOS: `f5612280ad06eb32afdc6db385a209605569b49947d24fdcba1509d6c0ec8c28` (6,782,276 bytes).
- Android: `937d7f9f4f8ae20f8613b47aae0d449705a1cacebfd0ea37cf138aadd2d95a58` (6,770,675 bytes).

## Behavior and compatibility

The update captures camera JPEGs at quality 1 before the existing single crop/resize pass saves at quality 0.92. iOS selects its Photo preset at camera mount. Capture waits for readiness, blocks duplicate shutter taps, discards pending results after backgrounding, and supports retry/Gallery on startup failure. Framing advice preserves all four card edges and advises moving back slightly when text stays soft. Failed sharpness measurements display an explicit unknown state. Capture diagnostics include the runtime/update ID.

Existing binaries retain continuous autofocus and the established file-based ImageManipulator API. They never call the new native focus methods or request native image references. The capability adapter is covered by regression tests. The Android settling allowance remains 450 ms; iOS uses 250 ms. This allowance is not a focus measurement.

True tap-to-point focus, native quality-prioritized still capture, and direct native image transfer require the separate 1.0.3 binary work. They were not added to installed binaries by this OTA. The OTA does not change corner detection, purchase code, app initialization, native dependencies, or native configuration.

## Validation and publication

- Ten focused tests passed: old-binary native bridge guards, focus timeouts/cancellation, iOS/Android file capture, duplicate taps, camera background/resume, permission-denied Gallery access, and one-pass processing without the new image-reference API.
- Complete iOS and Android Expo/Hermes production exports passed with independently installed locked mobile dependencies. Both bundles contain the new camera code, production API/Supabase configuration, and the existing purchase API. No environment values were written into this document.
- A dependency-junction export initially produced a router-only bundle. It was rejected before publication. Fresh local mobile dependencies produced full app bundles of 1,830 iOS modules and 1,826 Android modules. Only these validated bundles were published.
- Full mobile TypeScript still reports four pre-existing errors in unchanged files: three tuple-index errors in `app/_layout.tsx` (195 and 229) and an unused directive in `components/ExternalLink.tsx` (13). No camera-file errors were reported.
- No physical phone, optical sharpness comparison, or real Android credit purchase was exercised. Store-device camera and purchase smoke checks remain outstanding. Publication and download verification do not establish device launch or optical quality.

Exports loaded the production EAS environment. Each platform's validated export was published separately with `--environment production --skip-bundler --input-dir dist/<platform>`. For legacy targets only the release checkout's app version was temporarily set to the existing runtime; `app.json` was restored to 1.0.2 afterward. The same compatible platform bundle was used for both versions. Native patch scripts and the proposed 1.0.3 configuration were excluded.

The app checks updates on launch. Fully close and reopen it online; a second restart may be needed after download. See [Expo's release-build update instructions](https://docs.expo.dev/eas-update/getting-started/).

## Previous releases for rollback

Republish the previous group for the affected platform/runtime to production if device regression evidence warrants it. Do not roll back to an unrelated runtime.

| Platform | Runtime | Previous group |
| --- | --- | --- |
| iOS | 1.0.2 | `e6e36556-b11a-42dc-9441-e04ced139f28` |
| Android | 1.0.2 | `5b3782b3-f792-43c5-953f-e509627e0bba` |
| iOS | 1.0.1 | `10566c11-4a69-4c4c-880d-807dd97bb55a` |
| Android | 1.0.0 | `9a6f9e7e-891d-4f0e-b9df-7f0f52839850` |
