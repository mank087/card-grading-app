# Card detail V2 — sports parity walk

**Date:** 2026-09-22
**Branch:** `card-detail-v2` (worktree `tmp/card-detail-v2`)
**Legacy source of truth:** `src/app/sports/[id]/CardDetailClient.tsx` (6,770 lines, frozen)
**V2 adapter:** `src/app/sports/[id]/CardDetailV2Client.tsx`

This is the block-by-block walk the plan asks for before a category is
rolled out: every visible block of the legacy sports page, read top to
bottom, with where it lands in V2 — or why it does not land at all.

"Dropped (Pokemon)" means the block was already dropped when the Pokemon
adapter was built, reviewed and deployed behind the flag. Sports inherits
that decision; it is recorded here, not re-opened.

---

## 1. Page chrome and hero

| Legacy block (line) | V2 location | Verdict |
| --- | --- | --- |
| `ReportSectionNav` (2757) | `CardDetailSectionNav` — the five-tab nav | replaced (plan §5: the legacy nav is superseded inside V2 only) |
| Back link + "Grade a card" link (2764-2775) | `CardDetailBreadcrumb` `backHref="/collection"`; not-found page uses `uploadHref="/upload/sports"` | placed |
| "Take a guided tour" button (2780) | `CardDetailBreadcrumb` → `OnboardingTour` | placed |
| Visibility toggle `#tour-visibility-toggle` (2785) | `CardDetailBreadcrumb`, with legacy's public → private confirm text | placed |
| `LabelStyleDropdown` (2828) | `LabelPreviewControls` in the hero showcase (preview-first; saving is an explicit owner action) | placed, behaviour widened by the shell |
| `OrgBrandingBadge` (2842) | `CardFacts`, gated on `vm.permissions.isOrgBranded` | placed |
| `SoldBanner` (2846) | `CardDetailShell`, above the hero | placed |
| Card images `#tour-card-images` + zoom (2856) | `CardLabelShowcase` + `CardLabelPiece`; `ImageZoomModal` always opens the ORIGINAL photo | placed |
| Slab-detected dual panel in the hero (3214) | `DetectedSlabPanel` inside `CardFacts` (Overview), plus `vm.detectedSlabGrade` in the grade summary | placed, moved out of the hero |
| Grade score `#tour-grade-score` (3243) | `GradeSummary` | placed |
| Subgrades `#tour-subgrades` (3374) | `GradeSummary` | placed |
| Condition summary `#tour-condition-summary` (3443) | `GradeDetailsSection` (Grade details tab); the hero links to it | placed |
| Thin-identity value callout (3473-3489) | `CardValueSummary` withheld state + `ConfirmCardDetailsCalloutButton` | placed |
| DCM estimated value + match-confidence chip (3490-3520) | `CardValueSummary`, fed by the adapter's `live` / `marketRange` | placed |
| `ConditionReportDisplay` (3541) | `GradeDetailsSection`, the user-report expander | placed |
| Download buttons `#tour-download-buttons` (3557-3565) | hero download action + the Reports tab + the mobile bar, all through `renderDownloadButton` / `renderReportDownload` | placed |
| Facebook / X / Copy-link share row (3570-3655) | `CardDetailBreadcrumb`'s Share menu, same `CardSharingData` payload | placed |
| `NotStandardCardNotice` (3663) | `CardFacts` | placed |
| `IdentityReview` (3664) | `CardDetailShell`, mounted OUTSIDE the tabs so it is present on every tab | placed |

## 2. "Card Information" collapsible (3672-4158)

| Legacy block (line) | V2 location | Verdict |
| --- | --- | --- |
| Professional-grade slab panel (3677-3800) | `DetectedSlabPanel` | placed |
| Heading + `EditCardDetailsButton` `#tour-edit-details` (3803-3826) | `CardFacts` panel heading | placed |
| Player/Character (3831) | hero `<h1>` + `vm.identity.displayName` | placed |
| Set Name (3835) | `CardFacts` "Set" | placed |
| **Manufacturer (3839)** | **`SportsCardInfo`** | placed |
| Year (3842) | `CardFacts` "Year" | placed |
| Card Number (3846) | `CardFacts` "Card number" | placed |
| **Sport/Category (3849)** | **`SportsCardInfo`** | placed |
| **Team (3853)** | **`SportsCardInfo`**, same conditional | placed |
| **Parallel/Insert (3861)** | **`SportsCardInfo`**, same conditional | placed |
| Subset/Insert (3870) | `CardFacts` "Subset" | placed |
| **"Card Back Description" (3877-3890)** | **`SportsCardInfo`** — quoted prose + "— From card back" | placed |
| Special features: Subset/insert, Serial #, Rookie, Autograph (+ auth markers, + unverified footnote), Print finish, Authentic (3900-4020) | shared `SpecialFeatures` | placed |
| **Memorabilia badge (3954-3963)** | **`SportsFeatureBadges`** via `renderCategoryBadges` | placed, **re-ordered** (see §6) |
| **PARALLEL badge + generic-tier filter (3974-4013)** | **`SportsParallelBadge`** via the new `renderCategoryVariantBadge`, which REPLACES the shared "Variant" badge | placed |
| **The eleven relic/parallel flags (4022-4085)** — 1st Bowman, on-card auto, sticker auto, refractor/prizm, numbered, patch, jersey, game-used, short print, variation, case hit / 1-of-1 | **`SportsFeatureBadges`** | placed |
| Additional feature tags (4088-4103) | shared `SpecialFeatures` | placed |
| Card Description from `dvg_grading.card_text_blocks` (4107-4155) | shared `SpecialFeatures` | placed |

## 3. Analysis collapsibles

| Legacy block (line) | V2 location | Verdict |
| --- | --- | --- |
| "Centering Analysis" `#tour-centering` (4159) | Grade details → Centering evidence tab | placed |
| "Corners, Edges & Surface Analysis" (4463), incl. `DefectOverlay`, `SectionDefects`, `CornerZoomCrops` | Grade details → Corners/Edges/Surface evidence tabs + `DefectInspection` | placed |
| "DCM Optic™ Confidence Score" `#tour-optic-score` (4844) | Grade details → `ConfidencePanel` | placed |

## 4. Market and listing

| Legacy block (line) | V2 location | Verdict |
| --- | --- | --- |
| "Market Value" collapsible `#tour-market-value` + badge (5097) | hero `CardValueSummary` + the Market tab | placed |
| `PriceChartingLookup` `#tour-live-market-pricing` (5105-5138) | Market tab, via `renderPricing` — **the same props, field for field** | placed |
| "Find and price this card or similar" `#tour-market-pricing` (5141) | Market tab `renderMarketplaceLinks` | placed |
| eBay General Search (5155) | link "eBay — Active listings", same `generateEbaySearchUrl` payload | placed, copy shortened |
| eBay Sold Listings (5184) | link "eBay sold — Recent sold prices", same `generateEbaySoldListingsUrl` payload | placed, copy shortened |
| SportsCardsPro (5213) | link "SportsCardsPro — Market data", same URL rule (`dcmPriceData.sportsCardsProUrl`, else the search) | placed, copy shortened |
| "Estimated Mail-Away Grade Scores" `#tour-pro-estimates` (5243) | Market tab → `ProEstimatesPanel`; the heading is dropped when the column is null | placed |
| "Insta-List on eBay" `#tour-insta-list` + `EbayListingButton` (5415-5450) | hero `InstaListPanel` + the owner-only InstaList tab + the mobile bar | placed |

## 5. Footer, report and modals

| Legacy block (line) | V2 location | Verdict |
| --- | --- | --- |
| "DCM Confidence and Image Quality" (5530) | Grade details → `ConfidencePanel` | placed |
| **"Card Detection Assessment" (5685)** | — | **dropped (Pokemon)** — reads the retired `card.ai_grading` DVG blob; the Pokemon adapter dropped the same block |
| **"Front/Back Analysis" (5792)** | — | **dropped (Pokemon)** — `ai_grading.front_specific_feedback`; superseded by the per-face findings in Grade details |
| **"Card Text (OCR)" (5858)** | — | **dropped (Pokemon)** — `ai_grading.text_transcription_summary`; the card text that survives is `dvg_grading.card_text_blocks`, which IS shown |
| "DCM Optic™ Report" (5910-6430), incl. `ThreePassSummary` (6028) | Grade details → `FullAnalysisReport` / `FullAnalysisJson` / `ReportProvenance` | placed |
| `GradeReviewButton` (6535) | `GradeDetailsSection` | placed |
| "Grade another" / out-of-credits CTA (6502) | `CardDetailFooterActions` (`retakeHref="/upload?category=Sports"`) | placed |
| Delete button + confirm modal (6542-6580) | breadcrumb menu → `CardDetailModals` | placed |
| `PostResultOffer` (6521) | `CardDetailFooterActions` | placed |
| `MarkAsSoldButton` (6639) | `CardDetailFooterActions` | placed |
| `CardBinderPicker` (6647) | `CardDetailFooterActions` | placed |
| `ImageZoomModal` (6706) | `CardDetailShell` | placed |
| `OnboardingTour` (6727) | `CardDetailShell`, with `onBeforeStep` so a step in a closed tab opens it | placed, improved |
| `EditCardLabelModal` (6744) | `CardDetailShell` | placed |
| `FirstGradeCongratsModal`, `LowCreditsBottomBanner` | `CardDetailShell` | placed |
| Re-grade handler + modals | present, **no entry point** — the legacy clients removed the button too | parity, deliberate |

---

## 6. Deliberate differences, recorded

1. **Badge order.** Legacy sports orders the badges subset · serial · rookie ·
   autograph · memorabilia · print finish · parallel · authentic · flags. V2
   draws the shared badges first and the category ones after, so memorabilia
   and the eleven flags sit at the end of the grid. Same badges, same
   conditions, different order.
2. **No emoji in the badges.** Legacy prints 🏆 / ✒️ / 🎽 / 💎 inside each
   badge; V2's badge grid carries no emoji anywhere and the sports badges
   follow that.
3. **Structured data `brand`.** Legacy sports omits `brand` entirely when the
   card has no manufacturer (1471-1476). The shared `buildCardStructuredData`
   always emits one, so the adapter passes `fallbackBrand: 'Sports Cards'`.
   Pokemon legacy has the same fallback shape with `'Pokemon'`.
4. **Structured data grade.** Legacy sports reads only
   `dvg_grading.recommended_grade.recommended_decimal_grade`; the shared
   builder prefers `conversational_decimal_grade` when it is set (Pokemon's
   rule). This is the V2-wide choice made in Phase 1, not a sports decision.
5. **Marketplace link copy.** The three link descriptions are the V2 adapter's
   short form ("Active listings", "Recent sold prices", "Market data"), not
   legacy's sentences. The URLs and their payloads are legacy's exactly.
6. **`cardInfo` precedence is reproduced, not reconciled.** Sports reads
   `conversational_card_info` BEFORE the database columns — the opposite of
   Pokemon. `buildCardInfo(card, 'sports')` carries that verbatim, including
   the un-sliced `release_date`, the `sport` → `sport_or_category` → `sport`
   chain, and the stricter autograph/memorabilia column test (a NULL
   `memorabilia_type` does NOT read as true for sports, unlike Pokemon).
7. **Rarity buckets are kept.** `categoryUsesRarityBuckets` already answers
   true for sports and for every sport-named `cards.category`, so the subtitle
   and the Rarity/variant row print the grader's bucket, which is what a
   sports collector calls the card. Verified on screen: the test card shows
   `#358 · base_common · English`, while a Pokemon card on the same build
   shows `#TG06/30 · Ultra Rare · English` with the bucket filtered out.

## 7. Anchors

Sports legacy attaches `tour-card-info` through `tourId=`, not `id=`, which is
why the Phase 0 table first read as "not sports". The shell renders all
sixteen ids for every category, so nothing category-specific was needed.
Verified in the browser on the V2 sports page (logged out): every anchor whose
owning tab was mounted and whose content is not owner-only was present, and
`src/lib/cardDetail/anchorMap.test.ts` asserts the full sixteen-anchor
contract.
