# Cliff concept alignment: final review

Reviewed September 9, 2026. This is a review and recommendation pass; no application files changed, no commits, no deployment.

## Assessment

The principal marketing pages now have a recognizable DCM identity: Manrope/Inter, ink/navy environments, purple actions, real cards, Heritage labels, and the homepage condition-analysis animation. The remaining work is a focused consistency and workflow pass. Some secondary pages have received color and typography changes without the deeper hierarchy, imagery and reusable-component changes Cliff intended.

Read and visually inspected all 14 pages of `DCM Grading — Recommended Visual Design Direction_V4.pdf`. Also read the six supplied HTML concepts and their shared tokens: pricing, how-it-works, optic, grading-standards, population-report, reports-and-labels. These are design references, not authority for product claims, pricing, grade calculations, or offers. Your subsequent requirements take precedence, especially Heritage labels, rainbow-outline Gem Mint 10, varied real cards, compact membership sliders and the looping homepage showreel.

Coverage: source/template review of 124 route files, shared design/marketing components and selected product clients; fresh browser review of homepage, pricing, Why DCM, a public Pokemon report and signed-in Collection. The immediately preceding pass visually checked grading loading, database and event templates and an email. This is not a fresh browser walkthrough of every dynamic record, admin screen or signed-in state. See `cliff-final-route-review.csv` for every route and its next review focus. Source flags were checked against their relevant components; a gradient in label artwork or an emoji in a code comment is not counted as a UI problem.

## Prioritized findings

### 1. Pricing: packages should appear sooner; stop repeating the homepage selection

**Priority: high.** Cliff's pricing concept puts the credit decision directly after the introduction. In the current `/credits` browser preview, five large Heritage cards occupy the first screen before the packages. They are the same Gengar, Brady, Ohtani, Enel and Dalmatians used on the homepage.

`PricingExperience.tsx` renders `CardVisualRail` in its header. Both that rail and the VIP/Card Lovers `OfferCardSlider` use `useShowcaseCards`, whose fixed request is `showcase=1`. Thus the imagery repetition is confirmed in the data path as well as visually.

Recommended: bring packages immediately under the introductory copy, with one compact card/report example alongside or below. Give pricing, VIP and Card Lovers separate reviewed card selections. Keep the single-card membership sliders you requested. Preserve actual price, bonus and subscription calculations. Reserve dimensions for first paint; both rail and slider currently return nothing before cards load.

### 2. Why DCM: fix the signed-in hero composition

**Priority: high.** The current signed-in hero is three columns: heading/copy, one card, and an isolated “Go to My Collection” button. The action is detached from the explanation and leaves substantial empty space. The eyebrow still says “2 free grades” to this signed-in account.

Recommended: a two-column copy-and-card hero, with the account-appropriate primary CTA underneath the lead. Keep How It Works secondary and the benefits jump link tertiary. Retain the comprehensive portfolio, InstaList, labels, report and grading sections. Do not shorten this into a generic grading landing page. Label introductory credit language explicitly as a new-account offer.

Evidence: `why-dcm/page.tsx` signed-in CTA branch and `design-system.css` `.dcm-why-hero` three-column grid.

### 3. Grade colors need one source everywhere

**Priority: high.** `/grading-standard` uses the Heritage-aware grade explorer, but `/grading-rubric` still shows 10 in gold, 9 in silver and 8 in bronze. This conflicts with your explicit rainbow-outline 10 requirement and makes adjacent reference pages look like different systems.

Recommended: a reusable grade/condition component backed by the existing Heritage resolver, shared by marketing examples, rubric, standard, report summary and appropriate data legends. Keep full rendered label artwork unchanged. Do not apply Cliff's illustrative gold-for-premium suggestion over your later Heritage instruction. Subgrade values and final card grades should remain clearly distinguishable.

Evidence: `grading-rubric/page.tsx` grading scale around line 448; `GradeScaleExplorer.tsx` already uses `resolveGradeChip` and `GRADE_10_FOIL_CSS`.

### 4. Functional colors must survive brand styling

**Priority: high.** The latest directory CSS maps green, amber, yellow and blue text utilities to purple. This is too broad for pages with validation, warnings, availability and result states. Core action styles also still differ: account Save is green; some utility buttons retain gradients.

Recommended: explicit semantic components/tokens for primary action, success, warning, error, muted information and grade. Replace broad utility overrides with named directory components. Purple should mean action/selection; preserve red for errors, amber for caution and green for success. Test text/background combinations inside dark heroes, light cards and dialogs.

Evidence: `design-system.css` directory overrides around lines 782–794; `account/page.tsx` Save button. This is a CSS risk established in source, not a claim that every rendered status is currently unreadable.

### 5. Make inspection evidence the distinctive visual asset

**Priority: medium-high.** Cliff specifically recommends macro photography of corners, edges, surfaces and defects, combined with actual analysis. We have improved full-card imagery much more than close-up evidence.

Recommended: create a small library from reviewed public cards: corner whitening, edge wear, centering, foil/surface scratches, each tied to the original report. Use actual recorded findings and crop bounds. Add a few purposeful examples to Get Started, first-card guide, AI grading, grading accuracy, PSA alternative and standards. Show the full Heritage card plus a magnified detail and a short explanation. Never invent a defect/grade or imply a mockup is a measured result. Preserve SEO body content and links.

For reports/labels, compare Heritage and the other real label types using the same card so the design differences are obvious. For portfolio and InstaList, show actual product views and the steps they support instead of extra decorative slabs.

### 6. Card reports: connect the photos, grade and evidence more tightly

**Priority: medium-high.** The report sample shows large front/back photos, then another large grade panel. The actual card can occupy a small portion of an original upload with substantial background. The clean marketing crop and the report view therefore feel disconnected.

Recommended: a compact report overview with card identity, grade/condition, four subgrades, confidence and main report/label action together. Offer clearly labeled full original and card-focused views, retaining original evidence and zoom. Do not overwrite user images or conceal edges/defects with automatic cropping. Keep detailed analysis below, linked from the existing section navigation.

Apply through shared presentational components across all report categories; leave grading, authentication and label-generation behavior intact. Resolve the appropriate scope of keyboard/card-selection behavior before consolidating complex interactive wrappers.

### 7. Finish icons, spacing and controls in the deeper product UI

**Priority: medium.** Cliff explicitly removes emoji-as-icon from core UI. Event details still include a gift emoji and category emoji; collection visibility uses a globe emoji; report category badges use emoji. Decorative membership gradients and small control text remain. Collection select controls are 28px in source.

Recommended: use one outline icon family with accessible labels. Keep meaningful custom label graphics and editorial emoji. Standardize public primary buttons at 48px with the shared radius/type; maintain adequate compact control targets without unnecessarily enlarging dense tables. Use one spacing scale for headings, panels and forms. Do not mechanically apply Cliff's larger marketing headings to every product table.

Collection follow-up: clearly distinguish loaded/visible results from full collection totals, keep bulk actions contextual, and review nested interactive tile semantics with keyboard and touch. Browser snapshot exposed multiple different card totals and nested interactive content; this needs interaction testing, not an assumption that the underlying counts are wrong.

### 8. Databases and events: finish the task-first layout

**Priority: medium.** The new palette is a useful improvement. Database introductions and stat panels still take substantial vertical space before search. Users coming to find a card should reach search sooner.

Recommended: compact database introduction, search immediately below, secondary stats/explanation after results or in expandable information. Retain links among all seven databases. Catalog card artwork is not a graded card and should not receive fabricated Heritage labels; keep the real latest-grade section distinct.

Event pages should prioritize event name, date, location/directions and one grading CTA, with actual card analysis imagery near the explanation. Retain event-specific content and terms. Remove remaining green atmospheric blobs/emoji where merely decorative. Review the existing 60-second claims against the variable-time loading experience.

### 9. Loading, empty, error and motion states need the same design contract

**Priority: medium.** The homepage skeleton and new post-submission screen improve first paint. Other shared card showcases still disappear or fall back to a small link while waiting for their data. A consistent loaded page alone is not sufficient.

Recommended: stable dimensions, useful branded placeholders, understandable empty/error copy and safe retry actions across showcase, collection, portfolio, InstaList, labels and databases. Keep the homepage loop and your removal of its pause button/caption. Honor reduced motion and pause nonessential work when hidden. Never show fabricated measured progress or a finished grade before completion.

### 10. Emails: complete the same system in a separate delivery workstream

**Priority: medium for creative; high for delivery review.** The six templates have a palette/copy refresh, but welcome/reminder remain long, with numerous competing links and offers. A browser preview is not proof of Gmail/Outlook behavior.

Recommended: welcome focuses on first upload; reminder on the next useful action; education on the actual report; showcase on one next tool; offer on the credit decision; winback on the granted credit. Use the same button hierarchy and reviewed imagery, with limited supporting links. Preserve unsubscribe/footer readability. Keep the documented eligibility, unsubscribe, legacy endpoint authorization, duplicate-send and expiring-image issues in the pre-release engineering backlog; they are not solved by visual changes.

## Page-family disposition

| Family | Next action |
|---|---|
| Homepage | Keep concept; final image framing, grade-color and phone/reduced-motion checks. |
| Credits / VIP / Card Lovers | Prioritize price visibility and page-specific cards; keep membership sliders. |
| Why DCM | Fix signed-in CTA layout; retain full capability coverage. |
| Get Started / Grade Your First Card | Real upload examples, photo-quality guidance and evidence crops; align duplicate journey language. |
| AI grading / accuracy / PSA alternative / comparison pages | Preserve content and cross-links; add evidence imagery and standardize controls/claims. |
| Standard / rubric / limitations | Shared grade/condition styling; preserve exact published criteria; readable documents. |
| Reports and labels | Same-card comparisons of actual label types, report excerpts and clear print workflow. |
| Population root / category reports | Keep real SSR statistics and distribution charts; refine legends, definitions, grade styling and error treatment. |
| Featured / public collections / verification | Card framing and consistent labels; clear navigation into authentic reports and invalid-link states. |
| Collection / account | Task-oriented toolbar, counts, selection, focus and semantic state colors. |
| Portfolio / InstaList / bulk status | Consistent data visuals, source/date context, task actions and loading/error states. |
| Upload / submissions / report loading | Clear photo requirements, honest status and recovery; no extra promotional visual blocks. |
| Card details, all categories | Shared compact summary, original/cropped evidence choices and consistent actions. |
| Label wizard / classic / exports | Unify app controls while protecting label output typography and artwork. |
| Seven databases | Search-first hierarchy and functional colors; distinguish catalog art from real grades. |
| Card show index / event detail | Event-first information, outline icons, restrained branding and contextual card evidence. |
| Blog index / categories / articles | Refine image aspect ratios and title wrapping; use explanatory images where helpful, not a slab on every article. |
| Login / signup / password / success / unsubscribe | Keep forms focused; keyboard/error and offer-state verification. No decorative rail needed. |
| About / FAQ / contact / shop / affiliates | Finishing pass on buttons, icon system, spacing and purposeful illustrations. |
| Privacy / terms / enterprise terms | Readability and navigation; no need for forced card imagery. |
| Enterprise public / store onboarding | Separate store-owner story and CTA; actual workflow visuals. |
| Organization storefronts / billing / settings | Dedicated follow-on review respecting organization identity and operational flows. |
| Admin / developer / redirect routes | Inventoried separately; no blanket marketing design migration. |

## Recommended sequence and acceptance

1. Fix pricing order/repeated cards, Why DCM signed-in composition, rubric grade styling and broad status-color overrides.
2. Add a reviewed macro-evidence library and use it in the highest-value education pages.
3. Complete report, collection, database and utility component consistency, including keyboard and touch states.
4. Verify phone layouts, 200% zoom, reduced motion, slow loading and signed-in/signed-out variants; independently review actual email inbox rendering and delivery safeguards.

No new overall redesign is recommended. Preserve the homepage direction, compact membership sliders, comprehensive Why DCM content, restored SEO links, actual prices and all functional grading/label paths. These changes should make the current design more coherent and useful.
