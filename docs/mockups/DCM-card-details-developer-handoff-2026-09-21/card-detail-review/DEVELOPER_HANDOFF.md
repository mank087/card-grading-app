# Developer handoff: DCM card details redesign

## Request and intended outcome

Review the supplied interactive concept and implement its layout and workflows in the existing DCM website. Make each card detail page a card showcase and action hub, emphasizing **labels and holders, market value and portfolio, and InstaList**, while retaining the complete grading information and existing owner actions.

The concept is a direction for review, not evidence of final design approval. Build a staging implementation for review before replacing production pages. No production changes have been made as part of this handoff.

## Review materials and getting started

- `index.html`, `styles.css`, `app.js`: interactive standalone mockup.
- `desktop-preview.png`: full-page screenshot.
- `assets/`: copied Lugia artwork, original Heritage label, DCM logo, and holder backgrounds.
- `reference/CardDetailClient.original.tsx.txt`: snapshot of the original Pokémon detail client, for comparison only. Use the current repository source when implementing; this snapshot may become stale.
- `PLAN_card_detail_overhaul_2026-09-21.md`: full design rationale and phased plan, included with this handoff package.
- `README.md`: prototype capabilities and limitations.

To run after extracting the package, open a terminal in this directory and run:

```sh
node serve.cjs
```

Open `http://127.0.0.1:4317/#overview`. Node is the only requirement; there is no install or build step. If port 4317 is occupied, stop the other preview or change the port in this isolated server file. The localhost link runs on the machine hosting the preview; it is not a public preview URL. Alternatively, open `index.html` directly; the local server is preferable for image export testing.

## Design and interaction specification

### Hero: holder showcase and card summary

Desktop: two columns. Put the large card/holder composition on the left; card identity, grade, market value, and InstaList on the right. Maintain clear visual hierarchy, neutral surfaces, restrained purple actions, and the existing DCM brand.

Show visible **Graded slab / Top loader / One-Touch** selectors. Use the actual card images and the selected label design in a realistic holder. Provide front/back switching and full-size original image inspection. Clearly identify generated compositions as holder previews.

Place the label-style selector directly below the preview, followed by a prominent holder-specific download action, active format/dimensions, and a contextual shop link. Support Heritage, Modern, Traditional, and the user's actual saved custom styles. Preserve existing account and organization defaults; use Heritage only as the appropriate fallback.

Previewing a style or holder must not silently save an account-wide preference or imply that the card physically occupies that holder. Persistent per-card presentation is optional follow-up work, not required for the initial release.

On mobile, put card identity first, then the holder and summary sections. Keep label download and InstaList available through a bottom action bar that respects safe-area insets, permissions, sold state, and modal visibility. Ensure the card can be inspected without horizontal scrolling.

### Grading summary

Always display the current DCM grade, condition, and four existing subgrades. Link each subgrade to its relevant evidence. Derive the short “Why this grade?” explanation from saved findings; do not introduce new grading calculations or fabricated interpretations.

Keep non-gradable, altered/authentic, provisional, missing-data, and review states accurate. Distinguish a detected third-party slab grade from the DCM assessment.

### Value and portfolio

Show a trusted estimate with currency, source, and freshness. Link to expanded pricing and the existing portfolio. Use the existing identity guards and value-resolution rules everywhere, so hero and portfolio do not disagree.

Missing value must display as unavailable, not zero. Unverified/mismatched identity must expose the correction action rather than a misleading estimate. Preserve valid cached data with its timestamp during refresh failures. Do not show charts, percentage changes, purchase cost, or gain/loss unless genuine backing data exists.

### InstaList

Promote the existing listing workflow into a hero panel. Adapt its action to the real state: connect eBay, create listing, resume/manage an existing listing where supported, or show sold status. Preserve card context through connection and return navigation. Check the actual backend listing lifecycle before promising draft/resume behavior.

Open the existing listing editor for review; the hero must not publish immediately. Prevent unintended duplicate listings through existing or added server checks. Original images remain available. Generated holder imagery must not misrepresent a physical holder included in the sale.

### Five lower sections

| Section | Required content |
| --- | --- |
| Overview | Three previews of this card in different holders, explicit label downloads, compact card information, and report entry point |
| Labels & holders | Holder/style previews, compatible print formats, Label Studio handoff, and contextual holder/label supplies |
| Market & portfolio | Existing price lookup and comparisons, real freshness/match states, portfolio navigation, available history |
| Grade details | All current front/back findings, centering measurements, defects, confidence, image quality, user condition, full analysis, and applicable review/correction actions |
| Reports | Existing full PDF, mini report, card images, and other currently supported report exports |

Use URL-addressable sections. Preserve old report anchors, QR destinations, guided-tour targets, and browser navigation behavior. Opening an existing deep link must reveal its containing section, not land on hidden content. Back-to-collection navigation should preserve the user's originating collection/binder/portfolio context when available.

## Integration map: reuse the application

The prototype is a visual specification. Do **not** deploy the standalone HTML, sample server, hard-coded card data, or prototype export functions as the production implementation.

| Repository area | Implementation responsibility |
| --- | --- |
| `src/app/{category}/[id]/CardDetailClient.tsx` | Integrate a shared shell with category adapters; pilot Pokémon and sports, then roll out to all eight categories |
| `src/components/design/ReportSectionNav.tsx` | Replace/extend section navigation and preserve old anchors/tour behavior |
| `src/app/labels/LabelStudioClient.tsx` | Reuse style resolution and export behavior; hand off the selected card and return context |
| `src/components/labels/LabelMockup.tsx` | Extract shared holder composition; allow resolved label artwork for all supported holder/style combinations |
| `src/hooks/useLabelPreview.ts` | Reuse artwork rendering rather than maintain a second renderer |
| `src/hooks/useOrgHouseStyle.ts`, `src/hooks/useCustomLabelStyle.ts`, `src/lib/labels/labelStyleResolution.ts` | Preserve actual personal, custom, and organization style semantics |
| `src/lib/useLabelData.ts`, `src/lib/labels/slabLabelDataAdapter.ts` | Reuse card-to-label data, overrides, grades, subgrades, and serials |
| `src/components/reports/DownloadReportButton.tsx` and existing generators | Reuse production PDF/image exports, paper formats, calibration, logos, emblems, and QR generation |
| `src/components/pricing/PokemonPriceLookup.tsx`, `PriceChartingLookup.tsx`, category equivalents | Reuse lookups, identity correction guards, and cached pricing |
| `src/lib/pricing/resolveCardValue.ts`, `src/app/market-pricing/page.tsx` | Align hero valuation and portfolio behavior |
| `src/components/ebay/EbayListingButton.tsx`, `EbayListingModal.tsx` | Reuse connection and listing editor workflows |
| `src/lib/shopProducts.ts`, `src/app/shop/page.tsx` | Reuse product IDs and catalog links; verify holder/label compatibility |

Routes covered: Pokémon, sports, MTG, Lorcana, One Piece, Yu-Gi-Oh!, Star Wars, and other. Organization/public report pages require explicit parity review; do not assume their access and branding behavior matches the personal-owner view.

Suggested shared components: `CardDetailShell`, `CardHolderShowcase`, `GradeSummary`, `CardValueSummary`, `InstaListPanel`, and `CardDetailSections`. A normalized view model should isolate category-specific identity and grading formats from shared presentation.

### Important integration gaps to resolve

1. Existing `LabelMockup` does not provide universal artwork substitution for every holder/style. Unify rendered artwork with the production download path. Long names, custom colors, text overrides, emblems, organization logos, serials, and QR links must agree in both.
2. Define and test holder/style/size compatibility. Do not stretch a custom slab design into an incompatible compact format or silently substitute a different style. Explain unsupported formats and offer a supported option.
3. Label Studio's existing `?card=` preselection uses a serial. Verify this contract. Holder, style, and return-target parameters require explicit support if added.
4. Verify portfolio card-focused navigation and existing listing status APIs. The mockup demonstrates desired entry points, not implemented backend support.
5. Enforce ownership/access on the server, not merely by hiding buttons. Keep private purchase information out of public report payloads. Preserve sold-record restrictions and organization permissions.

## Scope boundaries and sample content

The Lugia image and Heritage grade 7 label are copied existing artwork. Pricing, trend lines, subgrades, grade explanations, portfolio values, purchase data, eBay connection status, and listing state are illustrative. The prototype has no original back image; production must use real front/back images and graceful missing-image states.

Modern, Traditional, and custom visuals are illustrative design treatments in this prototype; use the site's actual label renderers and saved configurations. Its compact Heritage previews demonstrate placement, not validated paper layouts. The prototype's watermarked PNG downloads and text report are review samples, not calibrated print output.

Keep optional enhancements separate: new purchase-cost/profit storage, new price-history collection, persistent per-card style preferences, new defect annotations, and new marketplace channels. A real showcase-image export can be included only if generated through a reliable shared renderer and identified appropriately.

## Delivery sequence

1. **Review and inventory:** compare current production behavior with this concept, inventory actions and category differences, verify data/API availability, and identify any proposed schema work. Capture current performance and desktop/mobile baselines.
2. **Staging pilot:** implement shared layout and navigation for Pokémon and sports using real existing data/actions. Preserve grading calculations, exports, identity editing, ownership, and pricing guards.
3. **Holder integration:** implement real artwork switching, supported print formats, Label Studio context, and verified shop links. Validate preview/export parity.
4. **Category rollout and QA:** extend to the remaining categories and explicitly test public, owner, sold, and organization views. Add appropriate integration/regression coverage and measure loading behavior.
5. **Review and release:** provide a staging URL, desktop/mobile captures, behavior matrix, test results, and any remaining limitations. Review before production rollout. Use the site's existing release process with a reversible route/feature rollout and a documented rollback path.

No new migration should be required merely to reorganize the interface. If persistence or new financial/history features require one, document it separately with backfill and rollback implications.

## Acceptance checklist

- [ ] All eight category pages retain their existing data, grading states, and supported actions.
- [ ] Hero clearly exposes holder choice, labels, value, and InstaList; grade and subgrades remain easy to find.
- [ ] Front/back inspection uses the correct card images, with intentional missing-image states.
- [ ] Heritage, Modern, Traditional, and representative saved custom designs work for every supported holder combination.
- [ ] Preview and generated output agree on identity, grade, style, dimensions, logos, emblems, serials, and QR destination.
- [ ] Print PDFs retain front/back orientation, duplex/fold-over behavior, sheet placement, and calibration.
- [ ] Header, holder tiles, and mobile actions open the same underlying flows with consistent state.
- [ ] Shop links resolve to compatible products using the existing catalog.
- [ ] Trusted value, stale/missing pricing, identity corrections, and portfolio inclusion agree across views.
- [ ] eBay connection/return flow works; existing/sold listings do not expose inappropriate create actions.
- [ ] Owner-only edits, exports, private financial details, and organization permissions are respected server-side.
- [ ] Original links, report anchors, QR verification, guided tours, and category URLs continue to work.
- [ ] Keyboard navigation, visible focus, modal focus return, loading announcements, reduced motion, and touch targets are validated.
- [ ] Layout works at 320, 390, 768, 1024, and 1440px and at 200% text zoom; the mobile action bar obscures no content or dialogs.
- [ ] Grading/PDF/chart/listing code loads on demand where practical; external service failures do not block the card image or grade.
- [ ] Appropriate repository tests and checks pass, including grading-isolation checks and relevant label/identity/pricing regression coverage. Record failures or pre-existing issues explicitly.
- [ ] Long names, old reports, null grades, unsupported custom dimensions, failed exports, and missing prices have intentional behavior.

Suggested performance goals: mobile p75 LCP ≤2.5s, INP ≤200ms, CLS ≤0.1. These are proposed goals, not measured results of the prototype. Compare against the captured baseline; validate field performance after release.

## What has already been checked

The standalone prototype was visually inspected at desktop and mobile sizes, including a 320px overflow check. Holder/style switching, label download dialog, sample PNG export, InstaList preview, section navigation, and grading drill-down were exercised. No browser console errors were observed during those checks. The copied original Pokémon client matched the live source file by hash at the end of mockup work.

These checks apply only to the isolated concept. They do not establish production readiness or validate real pricing, printing, authentication, or listing APIs.

## Requested developer response

Please return: your review of this approach, any functionality at risk, confirmed integration gaps, a phased implementation estimate, and a staging implementation plan. Once built, provide the staging URL, screenshots, completed acceptance checklist, test results, and release/rollback notes for review.
