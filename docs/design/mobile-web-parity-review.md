# DCM iOS, Android and web parity review

September 9, 2026. Review and implementation plan only. No app code, purchases, submissions, store settings, commits or releases were changed.

## Assessment and scope

DCM already has a substantial mobile product: native capture, grading, card reports, collection management, binders, labels, exports and eBay workflows. Heritage labels are supported and are the default saved-label selection. This is an alignment and reliability project, not a recommendation to rebuild both apps.

Three presentation systems coexist: the updated web design, an older native purple/gray interface, and embedded web pages with an aggressive chrome-hiding script. Feature coverage is stronger than the visual consistency, but some functional differences deserve priority over cosmetic work.

**Fix first:** embedded-page compatibility, collection completeness, gallery permissions, grading-state consistency, grade/condition appearance and platform-aware routing. Then migrate native visual primitives and secondary screens.

I inventoried 47 TSX modules in the mobile route tree, including layouts and fallback routes. Twenty-one reference the shared embedded-web wrapper. I inspected the shared architecture and principal implementations for authentication/onboarding, navigation, capture/review/processing, queue/status, collection, reports, labels/exports, marketplace, purchases, membership, shop and accessibility. These were compared with the current local web redesign, including the latest shop changes. This is not a claim that every line of every module was individually audited.

The mobile TypeScript check passed: `node node_modules/typescript/bin/tsc --noEmit -p dcm-mobile/tsconfig.json`.

**Native-device limitation:** I did not operate an installed iOS or Android build or a native simulator. No adb, Android emulator or xcrun command was found on the Windows PATH. Camera quality, touch behavior, operating-system dialogs, VoiceOver/TalkBack, purchases, background completion and frame rates require device testing. Findings distinguish source-confirmed differences from predicted effects and recommendations. No measured native performance score is claimed.

The local Expo configuration declares version 1.0.2 and production OTA updates using an app-version runtime policy. The public US App Store listing shows 1.0.2; Google Play reports an August 4, 2026 update. These do not establish the source commit, native build or OTA version on a user's device. Capture those identifiers during the device pass. [App Store](https://apps.apple.com/us/app/dcm-grading/id6768663163), [Google Play](https://play.google.com/store/apps/details?id=com.dcmgrading.app).

## Findings, in priority order

### 1. The embedded-web wrapper can hide actual page content — P0

**Source:** `dcm-mobile/components/ui/InAppPage.tsx` injects `header, nav, footer { display: none !important; }`. It also observes all descendant DOM mutations and sweeps floating elements by computed style.

The redesigned Pricing and Reports pages place their real introduction in `header`. Reports, Population Report, Portfolio and Why DCM use `nav` for page-level navigation. Those elements match the mobile hide rule. This is a confirmed selector collision; its exact appearance on released binaries still needs device reproduction.

**Impact:** missing headings, explanatory copy, visuals and section navigation in an otherwise functioning page. Android embeds the pricing page, so this affects a purchase path. Future web semantic markup can trigger the same problem.

**Plan:** introduce an explicit web app-shell contract. Mark only global navigation, global footer, launch promotion and designated help chrome for suppression. Keep content headers, section navigation, legal disclosures and controls. Replace broad mutation/computed-style sweeps with explicit markers wherever possible.

**Acceptance:** real-device checks of Pricing, Reports, Portfolio, Why DCM, Pop, Blog and Card Shows preserve useful content and hide duplicate global chrome across reloads and SPA transitions. Coordinate web/app release order: older installed wrappers may continue to contain the broad hide rule even after the web is updated.

### 2. Native Collection is capped at 1,000 cards — P1

**Source:** `app/(tabs)/collection.tsx` uses `.limit(1000)`, signs returned `front_path` values for one hour and searches/sorts the loaded list locally. Web Collection uses `/api/cards/my-collection` with 60-card pages.

**Impact:** large collections can appear incomplete and searches can miss older cards. Native startup fetches/signs substantially more than needed to paint its first screen. Cached signed URLs can expire; cached collection data does not guarantee complete offline image access.

**Plan:** adopt the paginated collection contract with server-side search, filtering and ordering; use thumbnail/full-image pairs. Preserve FlatList, binders, owned/sold views, selection, batch actions and cache-first display. Keep totals collection-wide and make image refresh/retry explicit.

**Acceptance:** 0, 1, 60, 1,001 and several-thousand-card accounts; find the oldest card; matching web/native counts and filters; duplicate-free pagination; reconnect/expired-image recovery; no previous-account data after account switching.

### 3. Gallery mode incorrectly depends on camera permission — P1

**Source:** `app/grade/capture.tsx` accepts `mode=gallery` but returns a Camera Access Required view whenever camera permission is not granted, before rendering the chosen mode.

**Impact:** grading existing photos can require an unrelated camera permission. Permanently denied camera permission also needs a useful recovery path.

**Plan:** camera permission only for live capture; independent gallery entry and permission handling; offer Settings when another camera prompt cannot help. Preserve per-side capture provenance, resolution checks, focus checks and front/back review.

**Acceptance:** gallery works with camera denied; limited-photo access, cancellation and mode switching preserve the correct front/back images; camera denial is recoverable without restarting onboarding.

### 4. Grading has two polling systems and conflicting timeout rules — P1

**Source:** `app/grade/processing.tsx` polls every five seconds and displays a timeout after five minutes. `hooks/useGradingPoller.ts` polls every four seconds; `GradingQueueContext.tsx` derives stages from elapsed time and reaches error at ten minutes. Processing also advances visible inspection steps every 15 seconds.

The global poller already pauses in the background. The inspected processing, benefits and status-pulse effects lack equivalent shared motion/background guards. The status pulse starts even when the component subsequently renders nothing.

**Impact:** one screen can say failure while the top bar remains active. Time-derived “Saving” and “Calculating” can imply events the backend has not confirmed. Duplicate polling and unnecessary animation increase battery/network work.

**Plan:** a single queue-backed job state for processing, collection and top bar. Distinguish upload, accepted, processing, delayed, completed and failed using evidence. Keep the benefits carousel and animated inspection; label inspection progression as illustrative rather than confirmed backend stages. Reconcile after foreground/restart and handle delayed completion without declaring a failed job solely because a timer elapsed.

**Acceptance:** consistent full-screen/top-bar status for slow jobs, offline periods, app kill/relaunch and late completion; retry cannot double-charge. Include authentic/altered outcomes and report JSON arriving before the numeric grade column.

### 5. Heritage labels are present; general grade badges still use old colors — P1

**Source:** `hooks/useLabelStyle.ts` defaults to Heritage, and `SlabCard.tsx` supports Heritage patterns, emblems and rainbow 10. However, `GradeBadge.tsx` uses `GradeColors`, where 10 is solid green. That badge appears in Collection list rows and card reports. `SubgradeBar.tsx` uses another grouped color ladder.

**Impact:** one card can have a rainbow 10 on its label and a green 10 elsewhere. This directly conflicts with the agreed score/condition treatment.

**Plan:** one semantic grade-chip resolver and native component. Match the web's score, condition, rainbow outline for 10 and authentic/ungraded treatment. Preserve saved custom designs and user style choices.

**Acceptance:** fixtures for grades 1–10, null/ungraded, authentic/altered, long names and custom colors across Collection, report, grade reveal and label previews. Color must not be the only way to understand a result.

### 6. Native brand primitives lag behind the new web system — P1/P2

**Source:** native `lib/constants.ts` still uses primary purple `#7c3aed` and older gray tokens. Web uses primary `#9810fa`, ink `#0b1220`, navy `#14233b`, surface `#f6f7fa` and semantic contrast tokens. Root mobile font loading includes SpaceMono and icons rather than Manrope/Inter. Native screens mix gradients, emoji promotions, colored tier headers and faint borders.

**Plan:** a native theme with color roles, typography, spacing, radii, button hierarchy, control borders, grade chips, headings, skeletons and errors. Prefer Manrope headings and Inter body if bundling/scaling/startup checks pass; tuned platform body fonts are also acceptable. Use purple for primary actions, navy for deliberate emphasis and real card imagery for visual interest.

Keep native controls and interaction conventions. Do not mass-replace status colors, eBay branding, grade colors or custom labels. Light UI is configured; dark panels are not full dark-mode support. A full dark theme is separate scope if wanted.

### 7. Six tabs and a second tab-bar implementation create crowding — P2

**Source:** `(tabs)/_layout.tsx` and `MobileTabBar.tsx` separately define Grade, Collection, Labels, Portfolio, InstaList and More. Labels use 11-point text; the standalone bar pushes routes and shows inactive styling.

**Plan:** prototype five destinations: Collection, Grade, Portfolio, Sell and More. Keep Labels prominent in card/collection actions and More; test retaining it as a primary tab if usage makes it more valuable than another destination. This is a proposal, not a platform rule or a decision to remove capabilities. Use one navigation definition and consistent tab switching from detail screens.

**Acceptance:** small phones/large text retain readable labels, comfortable targets, sensible back behavior and no stacked duplicate tab screens. Grade remains immediately accessible.

### 8. Purchases need entitlement parity, not identical checkout — P1

**Source:** iOS credits use native IAP; Android credits embed web Stripe checkout. iOS Card Lovers is member-only; the dedicated VIP route returns iOS users, even though the iOS credit catalog includes a VIP consumable pack.

The iOS screen displays localized StoreKit price but hardcoded dollar cost-per-grade values. These can disagree in amount/currency. Public US Apple pricing lists VIP at $99.99; current web pricing is $99. Represent real platform prices rather than overwriting them during a design update. [App Store](https://apps.apple.com/us/app/dcm-grading/id6768663163).

**Plan:** calculate localized unit cost from the actual store price and credit quantity; avoid comparisons without equivalent inputs. Reconcile first-purchase bonus rules with the server, not copied web banners. Existing members should see accurate plan and entitlement information. The Card Lovers guard should wait for membership loading: it currently ignores the provider's `loading` state and can route away before a member is recognized.

Preserve verify-before-finish and unfinished-consumable recovery in `lib/iap.ts`. Test recovery rather than automatically adding a generic Restore Purchases button for consumable credits.

Source comments about reader apps or store approval are not proof of current eligibility. Validate region/storefront and purchase configuration against current policies before adding external purchase links or native subscriptions. [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/), [Google payments policy](https://support.google.com/googleplay/android-developer/answer/9858738).

### 9. Deep links need one routing and access contract — P1

**Source:** `+not-found.tsx` already maps category/ID links into the native report. Other paths embed web content using only `usePathname()`, without carrying query context. Direct `/vip` and `/card-lovers` fallbacks differ from guarded `/pages/...` routes. Signed-out AuthGate generally shows onboarding except for authentication and legal pages.

**Impact:** query-dependent destinations may lose state; entry paths can bypass intended platform routing; shared-card visitors may not see a public preview or return to the intended report after login. These require cold/warm-device reproduction before assigning release incidence.

**Plan:** central resolver for reports, QR verification, queries/hashes, login returns, plans and external URLs. Apply platform purchase decisions consistently to every entry. Allow public report reading where visibility permits without weakening private-card controls.

### 10. Embedded-web session/error handling needs a stronger contract — P1

**Source:** `InAppPage` captures session once on mount and has a loading spinner, but no explicit `onError`, `onHttpError` or destination-policy callback in the inspected WebView. Label preview/export bridges put bearer tokens in query URLs.

**Plan:** retryable failures, refresh/sign-out synchronization, same-origin navigation policy, explicit retailer/checkout/email/download handling. Replace bearer-token URLs with scoped, short-lived handoff or a validated same-origin bridge. This is exposure reduction, not a claim of a reproduced compromise.

**Acceptance:** expired sessions, HTTP/network errors and sign-out recover; secrets do not enter logs/breadcrumbs; downloads and external transitions behave consistently.

### 11. Accessibility primitives need a coordinated pass — P1/P2

**Source:** common Button lacks explicit role/state metadata; CollapsibleSection lacks expanded-state semantics; root attempts a global 1.5 font multiplier cap. Tabs use small gray-400 labels on white, and status chips use 9-point text. Motion preferences are not consistently respected.

**Plan:** names, roles, disabled/busy/expanded states and announcements in shared controls. Aim for 48-unit targets where practical with platform-appropriate sizing/hit slop. Prefer reflow over global large-text restriction. Distinguish miniature printed-label artwork from readable report text. Preserve non-motion ways to understand status.

**Acceptance:** actual VoiceOver/TalkBack task flows, large text, reduced motion, landscape, keyboard/tablet and modal-focus checks. React Native supplies the APIs; runtime behavior still needs device testing. [React Native accessibility](https://reactnative.dev/docs/accessibility).

### 12. Product facts and promotional copy have drifted — P1/P2

**Source:** BenefitCarousel says grading passes are averaged; web AI grading describes median consensus. A benefit advertises $0.50/card without annual-plan context. Card report tour text omits Heritage and describes eBay listing as one click. Store descriptions also mix grading-consensus and free-grade language.

**Plan:** version shared facts for grading, credits, membership, terminology and availability. Preserve the rotating use cases, but distinguish estimated value from guaranteed sale value and listing preparation from completed publishing. Avoid unsupported authenticity claims. Refresh onboarding and store copy from approved facts. [App Store](https://apps.apple.com/us/app/dcm-grading/id6768663163), [Google Play](https://play.google.com/store/apps/details?id=com.dcmgrading.app).

### 13. Native Shop missed the latest web optimization — P2

**Source:** `(tabs)/shop.tsx` is a native vertical product list with a separate product catalog. It lacks the new web grouping/guidance and has no affiliate disclosure in the screen component.

**Plan:** native task groups for photo setup, holders and printing; fit advice, optional-accessory copy, descriptive placeholders and visible disclosure. Preserve ASINs and attribution parameters. Share grouping/content or check it for drift. Keep physical-product browsing clearly separate from DCM credit checkout.

### 14. Resource discovery is incomplete — P2

More exposes Pop, Featured, Search, standards, reports, blog and shows. There is no dedicated direct menu/route for the full card-database family or the newer Grading Standard page. Embedded links/fallbacks can still reach content; this is a discoverability gap, not proof of total feature absence.

**Plan:** Learn, Explore cards, Supplies and Support groups. Link databases and the versioned standard directly. Retain web-based reading where it works; only build native database browsing if capture/identification usage justifies it.

### 15. Preserve strengths and reduce duplicated logic — P2/P3

Keep native capture, gallery provenance, haptics, tablet sizing, share sheets, cache-first collection, emblems, binders, marketplace workflows, purchase recovery and the root error boundary. LabelWebRenderer already reuses web canvas generation, a useful safeguard for output parity.

SlabCard approximates web Heritage geometry with native Views; verify visual fixtures rather than assuming pixel equality. Prefer shared/generated design facts over independent color/grade implementations.

Card report is approximately 3,324 lines, Label Studio 3,038, Collection 1,689 and single eBay listing 2,130. These indicate maintainability pressure, not measured slowness. Split sections and defer expensive work according to profiling, not file size alone.

## Journey-by-journey parity plan

| Journey | Current app approach | Recommended work | Priority |
| --- | --- | --- | --- |
| Welcome, sign in and onboarding | Native authentication and introductory screens | Align brand and approved claims; retain incoming destination through sign-in; large-text and keyboard checks | P1/P2 |
| Grade entry and photography | Native capture, gallery, guidance and quality checks | Separate permissions by input method; keep quality guidance, provenance, rotation and haptics; test real paired photos | P1 |
| Submission review | Native image/category review and upload | Match clear web hierarchy; show actionable retry without duplicate submission; preserve selected inputs | P1/P2 |
| Grading wait and global status | Dedicated processing page plus shared queue/status bar | One job-state model; retain scan animation and rotating benefits; consistent slow-job/error/completion behavior | P1 |
| My Collection | Native cached grid/list, filters, binders and exports | Server pagination/search, complete counts, thumbnail-first images, expired-image recovery, shared grade appearance | P1 |
| Card report | Extensive native report | Consistent Heritage score/condition presentation; clearer section hierarchy, accessible disclosures and coherent navigation; keep evidence and actions | P1/P2 |
| Label Studio and exports | Native controls with shared web canvas generation | Shared label facts, visual fixtures, accessible customization; verify generated PDF/image dimensions and platform save/share paths | P1/P2 |
| Portfolio | Embedded web | Fix wrapper first; align native shell/back behavior; test charts, selectors, large text and session continuity | P0/P2 |
| InstaList and eBay listing | Native single/bulk workflows | Align controls and steps with web; preserve connection, review and confirmation; test draft recovery and return from eBay | P1/P2 |
| Credits | iOS native IAP; Android embedded checkout | Platform-aware copy and localized prices; verify entitlement/bonus truth, pending and recovered transactions | P1 |
| Card Lovers and VIP | Conditional platform screens and web content | Resolve membership-loading race and route consistency; accurately explain platform availability and existing membership | P1 |
| Account and privacy | Native More/actions plus embedded account/legal pages | Consistent account state, clear deletion/support access, robust sign-out and error recovery | P1/P2 |
| Shop | Separate native product list | Match task groups, fit guidance and affiliate disclosure; preserve product links | P2 |
| Population, featured cards and search | Embedded pages | Keep meaningful page navigation, filter state, card-opening routes and correct native back behavior | P0/P2 |
| Card databases | Reachable web resources rather than a dedicated native hub | Add clear discovery from More; test filter/detail routes and return state before considering a native rewrite | P2 |
| Reports, standards and Why DCM | Embedded educational/product pages | Wrapper compatibility, accurate feature availability, clear onward routes into native actions | P0/P2 |
| Blog, shows, FAQ, About and legal | Mostly embedded reading pages | Readable content width, working links, accessible navigation and predictable external opening | P2 |

Parity means consistent facts, capabilities and recognizable design, with platform-appropriate interaction. It does not require identical layouts or checkout mechanics on every platform.

## Creative direction for native screens

Carry Cliff's card-led direction into the app selectively. Real Heritage-rendered cards should anchor onboarding, collection and reports. Task-heavy screens should prioritize the user's card and controls, rather than repeating decorative card rails. Avoid adding a marketing hero above capture or report actions.

Use a shared set of semantic tokens: primary action, ink, muted text, surface, border, warning, success and grade tiers. Bring the newer purple, navy and pale surfaces into native components with intentional spacing, corner radii and elevation. Use consistent typography roles and weights; native system text remains acceptable if its hierarchy matches the brand and supports accessibility. Avoid shrinking text to force web proportions onto phones.

The grade system needs two coordinated renderings: the actual Heritage label artwork and a readable interface score/condition component. A 10 must use the rainbow-outline treatment consistently; lower grades must use the approved tier colors and condition names. Validate 10, 9.5, 9, low grades, authentic/ungraded states, long names, Japanese text and autograph/emblem combinations. Do not invent scores or substitute an unrelated back image to improve presentation.

Use motion for orientation and feedback: scan indication, stage changes and gentle transitions. It must remain truthful about observed server progress, respect reduced motion and pause unnecessary work when backgrounded. Keep the benefits carousel the user requested, with approved, contextual claims.

## Implementation sequence

These are planning estimates for one engineer familiar with the repository, with working test accounts, physical devices and timely design review. They overlap in places and are not a fixed delivery commitment. Allow roughly **four to seven engineering weeks** plus any store-review or external integration delays; reassess after the first batch.

### Phase 0: Establish reproducible baselines — approximately 1–2 days

- Record iOS/Android installed build numbers, Expo runtime and OTA update identifiers, source commit and API environment.
- Capture equivalent native/web journeys using the same test cards and accounts.
- Create approved grade/label, product-fact and platform-entitlement fixtures. Include a collection larger than 1,000 cards and unusually long card names.
- Agree which capabilities should be native, embedded or deliberately platform-specific.

**Deliverable:** signed-off parity matrix and baseline screenshots. No production account writes are needed for the source review; transactional tests belong in authorized sandbox/test environments.

### Phase 1: Compatibility and correctness — approximately 5–8 days

- Replace generic header/nav/footer hiding with explicit web-shell integration. Verify compatibility with already-installed clients before shipping the web change.
- Separate gallery and camera permissions; add appropriate denied-permission recovery.
- Unify queue/processing state and timeout behavior while retaining benefits, scan animation and the top notification bar.
- Add collection pagination and complete search/filter behavior, with thumbnail and URL-refresh handling.
- Resolve membership loading, preserve deep-link destinations and query parameters, and centralize route/platform guards.
- Add predictable WebView error recovery and review token/session handoff.

**Gate:** users can enter, submit, leave/reopen, finish and find a card without silent truncation or contradictory status. All embedded core pages retain their content and navigation.

### Phase 2: Shared visual and accessibility foundation — approximately 4–6 days

- Introduce semantic tokens and reusable button, field, chip, section, empty/error and loading components.
- Implement the Heritage-aligned interface grade component, including rainbow 10 treatment.
- Apply accessible control semantics, readable text, large-text reflow and reduced-motion behavior.
- Evaluate the proposed five-tab arrangement against the existing six-tab layout before changing navigation.

**Gate:** representative screens pass screenshot review on small and large phones; VoiceOver and TalkBack users can complete the primary tasks. Existing label export output remains correct.

### Phase 3: Screen and content migration — approximately 5–9 days

- Apply the shared foundation to collection, report, capture/review and Label Studio, then marketplace/account screens.
- Align native Shop with the web task-based structure and disclosures.
- Improve More/resource discovery and embedded portfolio/database navigation.
- Reconcile onboarding, benefits, tours, plan descriptions and store listing copy with approved product facts.
- Review localized IAP pricing and platform-specific product messaging without casually changing billing or entitlements.

**Gate:** the same card, account and plan have consistent facts and actions across web/iOS/Android. Differences are intentional and explained.

### Phase 4: Native device validation and staged release — approximately 4–7 days

- Run the device/account matrix below, profile representative collection/report screens, and resolve regressions.
- Verify purchase handling in sandbox, exports on both platforms, external eBay transitions and background completion.
- Update store screenshots/descriptions after the UI is approved.
- Separate changes eligible for OTA from native dependencies/configuration requiring a new binary. Use internal builds/TestFlight first and a staged rollout with a rollback plan.

**Gate:** no open P0/P1 defects, known limitations documented, and explicit user approval before commits or production release under the current working agreement.

## Device and account validation matrix

| Dimension | Minimum coverage |
| --- | --- |
| iOS | Small supported iPhone, recent large iPhone, iPad portrait/landscape; oldest supported OS and current supported OS |
| Android | Smaller lower-memory phone and recent larger phone; gesture and three-button navigation; supported older and current OS |
| Accessibility | VoiceOver/TalkBack, largest practical text settings, reduced motion, focus order, disabled/busy states and announcements |
| Accounts | Signed out, new/free, returning paid, zero credits, active/inactive Card Lovers, VIP, large collection, expired session |
| Cards | Multiple sports and TCG categories; long/international names; all relevant grade states; front/back pairs; emblems and custom labels |
| Networks | Good connection, slow upload, intermittent/offline, reconnect, expired signed image URLs |
| Lifecycle | Background/foreground, screen lock, process termination/reopen, phone interruption, orientation changes |
| Entry points | App launch, web universal/app link, link while signed out, nested embedded link, external return and tab retap |

### Required end-to-end checks

1. Open a card link while signed out; authenticate and arrive at the intended card with relevant query state retained.
2. Select gallery input with camera access denied; select camera input with denied and permanently denied permissions; recover without losing selection.
3. Capture and review a valid front/back pair. Verify orientation, guidance and a clear opportunity to replace either image.
4. Submit in a test environment; leave the processing screen, background/reopen, and confirm the global bar and processing page agree. Test slow, failed and completed jobs and result states without a numeric grade.
5. Confirm retry does not duplicate a submission or consume credits unexpectedly; verify server-side idempotency rather than assuming UI guards suffice.
6. Find a card beyond the first 1,000 records using search, filters and sorting. Check counts, scrolling, binder changes and sold/owned states.
7. Compare the same report across web, iOS and Android: grade, condition, subgrades, evidence, label and available actions.
8. Export representative labels/reports; open the actual output, check dimensions, clipping and QR destination, and save/share successfully on each platform.
9. Exercise eBay connection, draft preparation, cancellation and return in an authorized test flow; publishing requires separate authorization.
10. Validate sandbox purchase success, cancellation, pending/unfinished transaction recovery and repeat-launch behavior. Confirm localized prices and actual credited entitlements.
11. Open each embedded resource and interact with its real content navigation. Simulate HTTP/session/network failures and recover without a blank page or login loop.
12. Complete the primary flow with screen readers and large text. Ensure motion is optional and critical information remains readable.

Record actual timings and device conditions for startup, first usable collection, image loading and report interaction before setting performance budgets. Do not treat desktop development-server timings as mobile production measurements.

## Verification results and limits

- Native TypeScript: **passed**.
- Route/module inventory and principal source comparisons: **completed**, with the scope limitations stated above.
- Existing `npm run check:twin-drift`: **could not complete**. Its `npx tsx` runner attempted to fetch from npm and failed with network/access `EACCES`; this is not a pass or evidence of a source mismatch. Rerun once the declared runner is available through the approved dependency setup.
- Device screenshots, real touch/keyboard behavior, screen readers, performance traces, camera validation and sandbox purchases: **pending**.
- Public listings were checked for release/copy context; they do not prove which OTA/source revision is installed.
- No app implementation, commits, deployment or transactional changes were performed for this review.

## Evidence map

Paths are relative to `C:/Users/benja/card-grading-app`.

| Area | Principal files inspected |
| --- | --- |
| Shared shell and routing | `dcm-mobile/app/_layout.tsx`, `app/+not-found.tsx`, `app/(tabs)/_layout.tsx`, `components/MobileTabBar.tsx`, `components/ui/InAppPage.tsx` |
| Native visual/grade system | `dcm-mobile/lib/constants.ts`, `dcm-mobile/lib/heritage.ts`, `dcm-mobile/components/ui/GradeBadge.tsx`, `dcm-mobile/components/grading/SubgradeBar.tsx`, `dcm-mobile/hooks/useLabelStyle.ts`, `dcm-mobile/components/grading/SlabCard.tsx` |
| Capture and wait | `dcm-mobile/app/grade/capture.tsx`, `review.tsx`, `processing.tsx`, GradingQueueContext, useGradingPoller, GradingStatusBar and BenefitCarousel implementations |
| Collection and reports | `dcm-mobile/app/(tabs)/collection.tsx`, `app/card/[id].tsx`, `app/pages/label-studio.tsx`, LabelWebRenderer |
| Commerce and selling | `dcm-mobile/app/pages/_credits_ios.tsx`, `app/pages/card-lovers.tsx`, `app/pages/vip.tsx`, `lib/iap.ts`, EmblemsContext, `app/pages/ebay-list.tsx`, native marketplace |
| Supplies | `dcm-mobile/app/(tabs)/shop.tsx`, `dcm-mobile/lib/shopProducts.ts`, `src/app/shop/page.tsx` |
| Web reference | `src/components/marketing/design-system.css`, PricingExperience, ReportsExperience, LearningExperience, Why DCM components; `src/app/collection/page.tsx`, `src/app/market-pricing/page.tsx` |
| Native configuration | `dcm-mobile/app.json`, `eas.json`, `package.json`, `tsconfig.json` |

## What you should review before implementation

- Approve the visual target: Heritage labels and rainbow 10s, newer purple/navy surfaces, native-friendly typography and compact task screens.
- Decide whether Labels merits a permanent tab or stronger placement within card actions/More; validate against actual usage before removing its tab.
- Confirm the current installed build/OTA baseline and intended availability of Card Lovers/VIP on each platform.
- Approve one source of truth for grading-method, free-credit and membership claims before changing promotional copy.
- Review the first compatibility/correctness batch locally or in an internal native build before the broader screen migration.

Keep grading calculations, label semantics, credit entitlements and marketplace publishing behavior outside cosmetic refactoring unless a separately verified defect requires a specific change. A complete native rewrite of portfolio, databases or educational pages is not justified by this review.
