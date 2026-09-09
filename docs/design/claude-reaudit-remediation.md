# Claude re-audit: local remediation and review

Reviewed September 9, 2026. These changes are local and uncommitted. No deployment, grading submission, checkout, or email send was performed.

## Changes made

| Audit finding | Resolution |
| --- | --- |
| Homepage title overwritten | One shared homepage title feeds the root default and homepage absolute title. Homepage canonical stays page-specific. |
| Hero and marketing cards wait for hydration | Server boundaries supply reviewed public cards through the existing 60-second cache. Homepage HTML now contains a real first frame and Heritage label; browser fetching remains an outage fallback. Applied to home, pricing, memberships and learning/category pages. |
| Enterprise application labels | Added input IDs and associated visible labels. Existing implicit labels remain intact. |
| Metadata punctuation/social defaults | Shared metadata normalization applied to static and dynamic DCM metadata. Em dashes normalized; page canonicals, article fields and private-card handling preserved. Storefront metadata keeps the store identity. |
| Long metadata | Rewrote the long public-page descriptions and eight headline titles, preserving their subjects. Search engines still control displayed snippets and may rewrite or truncate them. |
| Dead upload/success links | Use the existing unified upload route with its category query. Card Lovers success now links to /upload. |
| Background timers | Floating CTA rotation requires visibility, an eligible visitor, a visible bar and normal motion preference. Latest-grades carousel updates its DOM scroll position through refs, without per-frame React renders; paused/hidden/reduced-motion states cancel its animation loop. |
| Missing service schema | Added service/offer descriptions to Card Grading, Why DCM, Get Started, VIP and Card Lovers, using shared package prices. AI grading's entry offer uses $2.99 instead of an annual plan's effective per-grade rate. |
| Social image | Added /opengraph-image: 1200 × 630 PNG, approximately 33 KB locally. Replaces the square logo default for DCM social previews. Real article/card images and storefront branding remain separate. Corrected Organization logo dimensions. |
| Keyboard skip link | Added a visible-on-focus skip link and focusable main-content target. |
| Contrast and palette | Shared muted text, accessible text-purple and control-border tokens; corrected photo errors on dark panels and report/Why/browse control boundaries. Grade colors and functional statuses remain meaningful. |
| Headings | Keyword-led H1s on Reports and Labels, Featured and Pricing. Removed the second full pricing tree from its Suspense loading fallback; confirmed one H1 in the browser. |
| Sitemap discovery | Existing static entries were already present. Added explicitly enabled active storefronts, public graded branded-card URLs and collection profiles whose owners have public graded cards. Private-only owners are not enumerated. Retained pagination and the URL-limit guard. |
| Showcase redirects/alt text | Card links use direct category report routes. Slab images use the card's display name in alt text. |
| Animation/font work | Scanlines and score bars use transforms. Disabled preloading the three secondary font families. |
| Forms/navigation announcements | Contact results use status/alert announcements; mobile Grade dropdown exposes expanded state. |
| Subscriber emails | Welcome and scheduled lifecycle delivery now include plain text. Escaped unsubscribe URLs in welcome and 24-hour follow-up templates. No sends performed. Other transactional/campaign dispatchers are outside this subscriber-lifecycle change. |
| Why DCM actions | Strengthened report and getting-started section actions while retaining useful contextual and commercial-intent cross-links. |
| Lint cleanup | Removed explicit-any catch handling in Floating CTA and the carousel's untyped card state/stray error logging. |

## Findings that did not require the suggested change

- The static sitemap entries listed as missing were already present.
- The welcome subject was already `Welcome to DCM Grading!`, without an em dash.
- Get Started does not need HowTo markup to qualify for a Google HowTo rich result: that search feature was retired. Its service information is now structured; existing visible instructions remain. Do not add unsupported schema solely to raise a schema count.
- The restored grading-wait benefits, inspection animation and PersistentStatusBar integration were preserved.
- This pass does not attempt the separate, substantial bundle split for card detail, Collection, Label Studio and Portfolio. Claude's quoted production bundle sizes were not remeasured here.

## Verification

- 37 focused tests pass: metadata defaults/private cards, public featured selection, sitemap pagination/discovery, subscriber email HTML/plain text and grading-wait features.
- Final TypeScript check passed (`npm run typecheck`).
- Targeted ESLint passed for the new metadata, cache/provider, motion, carousel, schema and email helper modules.
- Local HTTP responses returned 200 for home, pricing, Get Started, Why DCM, Card Grading, Enterprise application, Reports and Labels, and Featured.
- Homepage server HTML includes card images and the complete first-frame label. Main learning pages also contain card images in their server response.
- Live sitemap returned HTTP 200 with 34,075 URLs, including 124 storefront/branded-card URLs and 100 public collection profiles. Profile lookup batches are bounded to avoid long query strings.
- Link-mesh check passed for Home, Get Started, Why DCM and AI Card Grading, including the real server-rendered hero first frame and neutral authentication CTA.
- In-app browser: homepage animation renders, Gem Mint 10 retains rainbow styling, pricing has one H1 and no broken images.
- Social image returned PNG at 1200 × 630, 32,825 bytes, and was visually inspected.
- No new production build was run against the active dev server. A clean isolated release build remains a pre-shipping check.

## Your local review checklist

1. Home: fresh load, rotating card/scan/subgrades, rainbow 10, Heritage label and direct report links. Try reduced motion and switching tabs.
2. Pricing, VIP and Card Lovers: card imagery, package prices, membership billing wording, signed-in balance and signed-out actions. Do not make a real purchase just to review layout.
3. Get Started, Card Grading, AI Card Grading, Pokémon/Sports grading, Reports and Labels, Why DCM: read the revised headings and follow primary/contextual links.
4. Enterprise application: use Tab and each visible field label; confirm labels focus the right control. Do not submit a real application for this layout check.
5. Contact and mobile navigation: verify status announcements and dropdown state with your preferred screen reader.
6. Card reports: “grade another” should select the correct category; Heritage images should show the card name to assistive technology.
7. Grading preview at /dev/experience-review: retain rotating benefits, inspection highlights and the top status bar. A real grading lifecycle still needs your explicit end-to-end review.
8. Subscriber email previews: check welcome and follow-ups at /dev/experience-review. Review plain-text output and unsubscribe destinations; inbox delivery is untested because no messages were sent.
9. Phone and 200% zoom: inspect hero reflow, card rails, control borders, chat/offer spacing and keyboard focus. Desktop checks do not replace physical-device review.
10. Before production: clean isolated build, staging auth/checkout/grading lifecycle, social share preview and search-console indexing checks. Schedule the larger bundle split separately.
