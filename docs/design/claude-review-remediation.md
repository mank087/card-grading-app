# Design review remediation

Local changes only. Nothing committed or deployed.

## Confirmed and addressed

- Restored the full AI card grading article, keyword H1, original explanatory sections, commercial links and structured data while retaining the new visual styling and real Heritage card examples.
- Restored the homepage proof links and added related grading guides on Get Started and Why DCM.
- Added a server-rendered homepage showreel skeleton and photo-loading shimmer/error states in the shared slab rendering pipeline.
- Changed Why DCM capability examples to stable card IDs with a visible report-link fallback. The Jordan crop entry already existed; a missing crop entry alone does not explain the reported blank band.
- Homepage population count fetches once per mount. Curated homepage queries request five records. Public marketing selections have a 60-second server cache; regular featured galleries retain their live selection.
- Added `npm run check:marketing-showcase`, comparing public pins, image paths, grades and crop serials to a reviewed baseline. Run against a running preview. Set SHOWCASE_BASE_URL to check another environment. An intentional replacement requires photo/report review before using `--write-baseline`.
- Debounced card-report section discovery and ignored text-only mutations.
- Strengthened the reported control borders, enlarged selector targets, added accessible group/region roles, raised tiny marketing text, and hid the mobile rail scrollbar.
- Replaced the desktop hero's absolute copy placement with a grid that reflows. Mobile grading progress now occupies the previously blank result area.
- Aligned the pricing FAQ, restored payment-security copy, and reserved space beside the mobile offer text for the chat launcher.
- Removed the unused FeaturedCardSlab and FloatingCardsBackground components. Removed doubled showreel line spacing and changed the animated card name from an H2 to ordinary text.
- Neutral homepage CTA before authentication resolves; free offer only appears after signed-out state is known.
- Removed the reported em dashes.

## Deliberate choices retained

- Card Lovers shows the $449 annual charge with the $37.42 monthly equivalent. Billing cadence remains explicit; no pricing or benefits changed.
- The blog's large featured image uses contain to preserve artwork and embedded text. Regular article cards still use cover. Some surrounding space is intentional.
- Sign-in accepts existing passwords without imposing the new-account minimum. Sign-up retains its minimum length.
- The unrelated Japanese Pokémon market-price lookup is outside this design change.

## Validation

- Locked dependencies restored with npm ci; package-lock.json unchanged.
- TypeScript check passes after dependency restoration.
- Four focused featured-API regression tests pass (public pinned selection and cap, live gallery behavior, unknown-selection guard, storage failure handling).
- Grading isolation check passes.
- Further runtime/build results recorded below after verification.

## Additional release concern

npm audit --omit=dev reports 49 production dependency findings (37 moderate, 9 high, 3 critical) in the restored lockfile. Critical packages include Next.js, jsPDF and transitive fast-xml-parser. npm proposes major-version changes for jsPDF and sharp. These require a focused dependency update and regression pass before claiming production readiness; no automatic audit fix was applied. See tmp/design-audit/review-dependency-audit.json for the recorded audit.


### Completed runtime verification

- Clean production build passed, including type validation and generation of 320 pages. After the build, the body-link check was rerun for one added related link, and the grade-chip caption spacing was corrected following homepage screenshot inspection.
- Body-link regression check passes: homepage 9, Get Started 9, Why DCM 8 and AI grading 12 required destinations. Navigation/footer links are excluded from this check.
- Homepage server output includes the complete loading skeleton and neutral authentication CTA.
- All 20 public card pins and 10 crop mappings pass the integrity check. Gengar and Brady retain their recorded Gem Mint 10 grades.
- Revised control border contrast is 3.62:1 on white and 3.38:1 on the light gray surface.
- Dedicated phone-width and 200% browser-zoom interaction checks remain part of local acceptance review; the responsive CSS has been corrected, but those viewport modes were not exercised by this browser tool.


- Homepage screenshot inspection completed. The final Why DCM screenshot/DOM inspection was blocked by automatic browser approval timing out, including the permitted retry. Its visual confirmation remains pending; the public Jordan record and crop mapping pass the data checks.

Follow-up: the user approved the browser retry. The Why DCM screenshot then succeeded, confirming the Jordan Heritage card. See seo-aeo-review-checklist.md for the subsequent SEO pass and acceptance checklist.
