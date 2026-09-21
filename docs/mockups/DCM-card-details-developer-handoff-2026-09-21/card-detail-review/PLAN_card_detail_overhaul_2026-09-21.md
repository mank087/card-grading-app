# Card details overhaul — recommended plan

Date: September 21, 2026
Scope: Website card detail pages for all eight card categories. Planning only; no application changes.

## Recommendation

Make the page a personal card showcase and action hub: see the card, understand its grade and value, choose its presentation, and prepare it for sale. The holder and label should be the visual centerpiece. Labels, market value, and InstaList should be immediately discoverable while grading evidence remains easy to inspect.

Suggested supporting copy: **“Your card. Your grade. Your choice of holder.”**

## Review findings

This is a source-based review, with the Pokémon detail page inspected most closely and matching section placement checked across sports, MTG, Lorcana, One Piece, Yu-Gi-Oh!, Star Wars, and other cards. It is not a browser-tested audit or a measured performance baseline.

- The current page presents separate front/back images in metallic slab styling, a prominent grading score, subgrades, condition information, report/label downloads, detailed card information, market pricing, and owner-only InstaList. The functionality is substantial, but pricing and selling appear late in the report sequence.
- `ReportSectionNav` calls the page a “Card grade & condition report.” Its links include grading, downloads, card details, and pricing, but omit InstaList and a dedicated holder experience.
- The header returns users to the category upload page. Returning to the collection, binder, or portfolio they came from would better support repeat use.
- Label Studio already has realistic slab, top loader, and One-Touch mockups, label styles, custom configuration, and export generators. This is an existing foundation to extract and reuse.
- `LabelMockup` currently accepts rendered label artwork only for its top loader and One-Touch previews; its comments describe built-in label types. A universal saved-style holder preview needs deliberate integration, especially for custom slab artwork.
- The Pokémon detail client exceeds 7,000 lines and contains disabled legacy sections. Similar category clients repeat the report structure. File length is a maintenance signal, not a measured loading-time result.
- Pricing already includes identity/trust safeguards and portfolio persistence. The redesign should reuse those rules, rather than build a separate hero valuation calculation.
- The product catalog already contains slab options, a magnetic holder, Avery 6871 and 8167 labels, and accessories. The destination is `/shop`; portfolio is `/market-pricing`.

## Proposed page structure

Desktop layout:

```text
Collection / Card name                       Visibility · Share · More

┌────────────────────────────────┬─────────────────────────────────────┐
│ Slab | Top loader | One-Touch   │ Card name, set, number, variant      │
│                                │ DCM grade + condition                │
│       LARGE CARD + LABEL       │ Centering · Corners · Edges · Surface│
│       IN SELECTED HOLDER       │ Short explanation of the grade       │
│                                │                                     │
│ Front / Back · Zoom · Originals│ Estimated value · source · updated   │
│ Style: Heritage ▾              │ View pricing · View in portfolio     │
│ Download this label ▾          │                                     │
│ Customize · Shop this holder   │ InstaList · listing status           │
└────────────────────────────────┴─────────────────────────────────────┘

Overview | Labels & holders | Market & portfolio | Grade details | Reports

Overview: three holder previews + grade highlights + card information
```

The showcase and compact summary stay above the section tabs. Tabs replace the long report stack beneath them. Use URL-addressable sections and restore the chosen section after navigation. Existing report anchors should open the correct section and scroll to the target so shared links and guided tours continue to work.

### 1. Card showcase and visual design

- Show one large, realistically proportioned holder at a time. Provide visible Slab, Top loader, and One-Touch controls; use front/back controls and full-size original-photo inspection separately.
- Offer Heritage, Modern, Traditional, and saved custom labels next to the preview. Heritage is the fallback for a user without a saved preference; preserve existing personal and organization defaults.
- Use a warm neutral page background, white information surfaces, dark readable type, and restrained DCM purple actions. Let the card art and Heritage label supply most of the color. Keep foil effects within the label and subtle holder highlights.
- Use consistent spacing, softer borders, fewer competing colored panels, and a single strong grade treatment. Keep the card name, grade, price, and next actions visually distinct.
- Allow an optional subtle flip transition, respect reduced-motion settings, and avoid automatic rotation or autoplay.
- Clearly identify the composition as a holder preview. Selecting a holder changes presentation; it does not claim the user owns that holder or change the card's grading status.

### 2. Labels and holders as a core feature

Include three small holder tiles in Overview so the multiple-holder capability remains obvious even when one is selected in the hero. Each tile shows this actual card and its selected label, with separate **Preview** and **Download label** actions. Image clicks select or enlarge the preview; explicit download actions avoid surprising file downloads.

The hero button should say exactly what it does: “Download slab label,” “Download top loader label,” or “Download One-Touch label.” The selected holder and supported style determine the available print format. Show the active dimensions and paper format before downloading; keep sheet position, calibration, duplex, and fold-over choices in the relevant existing print dialog.

Add **Customize in Label Studio** with this card preselected and a return link. The existing `/labels?card=...` parameter uses a card serial; verify that contract when wiring it. Holder, style, and return-target parameters would be new work, not assumed existing support.

Add **Shop recommended holders & labels** below the preview, linking to `/shop`. In the labels section, show the compatible holder and label supply together. Reuse catalog records instead of copying prices or merchant links into card details. If product anchors or filters are needed, implement them explicitly. Do not label a physical size compatible until the mapping is verified.

Separate temporary preview selection from saved defaults. Changing a demo style should not silently overwrite the user's account-wide preference. An explicit save action can persist the preferred presentation for this card; server-side per-card persistence requires a data-model review. Preserve organization house styles and owner permissions.

### 3. Market value and portfolio

Show a compact value panel beside the grade with the estimated value, currency, source, and last-updated state. Label an estimate as an estimate; present raw and third-party graded comparisons separately in the detailed section.

Use the existing trusted-value resolution throughout the hero, detail section, and portfolio. A mismatch or unverified identity should show “Confirm card details to view a reliable estimate,” with the existing correction flow. Missing prices are “Unavailable,” not zero. Failed refreshes retain a clearly dated previous value when valid.

The Market & portfolio section should contain existing lookup/comparison tools and available history. Add a direct **View in portfolio** action; card-focused portfolio navigation may require new support. If the card is already counted in holdings, show “Included in portfolio” rather than suggesting users add it again. Sold cards need the appropriate sold state.

Purchase cost, personal notes, unrealized gain/loss, and percentage of portfolio are later enhancements, subject to confirming the available data model. These remain private owner information. Do not invent a historical chart from isolated price observations.

### 4. InstaList as a primary next action

Give InstaList a permanent summary panel beside the card and a clear hero action. Reuse the existing eBay connection and listing workflow.

- Disconnected: “Connect eBay,” preserving card and return context.
- Connected, unlisted: “Create listing with InstaList.”
- Existing draft or active listing: show the actual available state and a resume/manage action where supported, rather than encouraging accidental duplicates.
- Sold: display sold status and suppress inappropriate new-listing actions.

Keep the summary short: “Card details, images, and grading report prepared for you.” Open the listing editor for review before publishing. Confirm the supported listing lifecycle and backend guards during implementation; these states are target behavior, not all verified current capabilities.

Do not automatically use a simulated holder image as evidence of a physical holder included in a sale. Keep original card photos available, and make any generated showcase imagery clearly identifiable in the listing preparation flow.

### 5. Keep grading evidence useful

Always show the overall grade, condition, and four subgrades. Add a short “Why this grade?” summary drawn from existing findings, with a link to the full evidence. Preserve non-gradable, altered/authentic, provisional, and review states without coercing them into ordinary numeric scores.

Grade details should retain front/back inspection, centering measurements, defect findings, image quality/confidence, user-reported condition, and supported review/correction actions. Subgrade selection opens its corresponding evidence. Use existing annotations where present; adding a new interactive defect overlay is a separate enhancement.

Place complete identity and category-specific fields in a compact Card information section, with owner editing close by. Put detailed OCR and full analysis behind explicit expansion. Clearly distinguish any detected third-party slab grade from the DCM assessment.

The Reports section gives explicit actions for full PDF, mini report image, and card images. Printable holder labels belong in Labels & holders. Both surfaces can reuse the same export services without duplicating generation logic.

## Mobile and accessibility

Order mobile content as identity and compact grade/value summary, holder showcase, actions, then detail sections. Keep the holder within the viewport rather than forcing a large desktop composition into it. Make the three holder choices visible without hover.

Use a bottom action bar with **Download label** and **InstaList**, adapting to ownership and sold state. Keep value immediately available through the compact summary. Reserve space for the bar so it never covers content or dialogs.

Provide keyboard-operable holder controls and tabs, visible focus states, labeled zoom/flip buttons, meaningful image alternatives, touch targets of at least 44px, and announced loading/error states. Preserve focus when opening and closing exports or the listing editor. Test narrow screens and 200% text zoom.

## Implementation approach

1. Define a shared card-detail view model for identity, images, grade, permissions, trusted pricing, listing state, and effective label design. Retain category-specific adapters and existing grading calculations.
2. Build shared `CardDetailShell`, `CardHolderShowcase`, `CardValueSummary`, `InstaListPanel`, `GradeSummary`, and `CardDetailSections` components. Pilot with Pokémon and sports to expose category differences early.
3. Extract holder composition and a label-artwork interface from Label Studio. Feed resolved artwork into all three holders and the matching export path. Carry card text overrides, brand logos, emblems, subgrades, serial, and QR destination consistently.
4. Model holder/label compatibility explicitly. When a saved custom size cannot fit a compact holder, offer a supported adaptation or explain the unavailable format; do not distort the artwork or silently substitute a style.
5. Separate export operations from the large download-menu component. Dynamically load PDF, canvas export, report parsing, charts, and listing editor code when needed. Render the initial card image and grade without waiting for pricing, eBay, or export dependencies.
6. Reuse cached pricing and coalesce requests between summary and details. Only render the selected high-resolution holder preview; defer back images and thumbnail artwork where practical. Measure before and after rather than assuming a faster page from shorter files.
7. Roll out the shared shell to all eight categories after parity review. Handle organization/public report pages explicitly; their branding and permissions must not change accidentally. Preserve guided tours, verification URLs, and existing shared links.

## Phased delivery and release criteria

**Phase 1 — Structure and parity.** Inventory current actions and permissions, capture representative desktop/mobile baselines, implement shared hero and section navigation, elevate existing pricing and InstaList, and preserve grading/report behavior. Exit: every existing action has a working destination in the pilot categories.

**Phase 2 — Holder showcase and downloads.** Add realistic holder switching, label-style previews, supported exports, Label Studio handoff, and compatible shop links. Exit: preview/export parity confirmed for Heritage, Modern, Traditional, and representative custom designs on each supported holder.

**Phase 3 — Rollout and optimization.** Extend to all categories, improve loading behavior, refine listing/portfolio status, and validate owner/public/sold/organization views. Exit: route, permission, mobile, export, and regression checks pass.

**Later enhancements.** Persistent per-card presentation, shareable showcase images, purchase-cost/profit tools, richer available price history, and evidence overlays. Keep these separate from the core redesign.

Validation should cover long card names, missing back photos, legacy reports, non-gradable cards, custom dimensions, organization branding, identity corrections, unavailable pricing, disconnected eBay, and export failures. Confirm printed dimensions, QR destinations, label text, and front/back orientation in the actual generated files, including existing calibration behavior.

Proposed performance targets: mobile p75 LCP at or below 2.5s, INP at or below 200ms, and CLS at or below 0.1. Establish a baseline first. Track successful label exports by holder/style, InstaList starts and completions, portfolio navigation, shop visits, and task completion time. Increased shop clicks alone should not define success.

## Main source references

- `src/app/pokemon/[id]/CardDetailClient.tsx` — representative current layout and integration.
- `src/components/design/ReportSectionNav.tsx` — current section navigation.
- `src/app/labels/LabelStudioClient.tsx` — studio previews, exports, and card preselection.
- `src/components/labels/LabelMockup.tsx` — product-photo holder composition and artwork limitations.
- `src/hooks/useLabelPreview.ts` — debounced custom artwork rendering.
- `src/components/reports/DownloadReportButton.tsx` — existing report and label exports.
- `src/components/ebay/EbayListingButton.tsx` — eBay connection and listing entry.
- `src/components/pricing/PriceChartingLookup.tsx` and `src/app/market-pricing/page.tsx` — price persistence and portfolio.
- `src/lib/shopProducts.ts` and `src/app/shop/page.tsx` — existing product catalog and destination.
