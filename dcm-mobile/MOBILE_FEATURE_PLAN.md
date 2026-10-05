# Mobile feature status and release plan

Updated October 5, 2026. This replaces the April implementation checklist with the current app status. The camera and parity work are combined on `codex/camera-native-focus`; implementation does not establish physical-device acceptance or production deployment.

| Capability | Current implementation | Release validation |
| --- | --- | --- |
| Single-card grading and capture | Native front/back capture, review, rotation, system camera/gallery fallback, held tap focus, quality-prioritized capture, direct image processing | New binaries required. Test focus retention and saved fine print on the affected Android phone and physical iPhones. |
| Collection, binders, reports, labels, market pricing, InstaList | Existing native and embedded workflows retained; card report section shortcuts and larger explanatory text added | Check small screens, large system text, label exports, and save/share/print. |
| Grade review | Native eligibility, grade/detail dispute form, queued/processing/result status, proposed-grade accept/keep decisions | Exercise an eligible account, an ineligible account, existing review, and a completed review. |
| Bulk grading | Grade-tab entry opens existing web pairing, notes, binder, progress, and credit flow; 20-card mobile limit | Test OS photo selection, pairing/rotation, interrupted uploads, retry, and returning from purchase with selected images. |
| Upload retries | One in-memory submission attempt reuses its draft and stable card IDs; failed image uploads prevent commit; completed uploads are not repeated after a lost commit response | Force an upload failure and a lost commit response. Process-death/offline draft recovery is future work. |
| Public sharing | Signed-out public card, collection, and verification links; generic card route enforces public visibility; collection username setup and native sharing | Open links on cold/warm starts, signed out; private/deleted cards must remain inaccessible. |
| Password recovery | Native recovery screen consumes trusted recovery fragments/PKCE links without persisting credentials in router state | Exercise a fresh email link on each OS, cold/warm starts, expired link, and successful new-password login. |
| Embedded sessions/navigation | Native-owned refresh, origin-checked bridge, controlled routing, load errors/retry, checkout balance refresh, native download handoff | Test expiry, logout/account switch, external links, offline retry, and return navigation. |
| Export authentication | Tokens delivered to trusted export documents in memory; web receivers preserve installed clients' legacy URL-token compatibility | Deploy companion web changes before distributing these binaries. Test collection batch, Label Studio, card labels/reports, and eBay image generation. |
| Credit purchases | **iOS StoreKit; Android Stripe.** Existing purchase components and billing implementations retained | Confirm sandbox iOS purchase/restore/cancel and Android Stripe success/cancel, including balances on return. |
| Credits and support | Last confirmed credit balance survives errors with retry; account switches clear cached balances; native help available on embedded screens | Check offline/reconnect and avoid duplicate help overlays. |
| Automated release checks | Web/mobile TypeScript, regression tests, 19 web/mobile consistency pairs, camera patch/autolinking checks | CI must pass; JavaScript exports and EAS native compilation are separate checks. |

Release sequence and evidence are recorded in `../docs/MOBILE_PARITY_RELEASE_2026-10-05.md`. Native camera changes cannot be delivered to older app runtimes by OTA alone. Version 1.0.3 validation builds use the isolated `camera-validation` channel.

Future enhancements, outside this release: native batch capture, persisted/offline batch drafts, device-specific macro lens selection, and device-calibrated optical quality thresholds. Corner detection and grading algorithms are unchanged.
