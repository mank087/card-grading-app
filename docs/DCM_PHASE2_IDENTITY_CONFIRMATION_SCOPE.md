# Phase 2 scope: identity confirmation and matching prices

September 16, 2026. Source review and implementation plan only. No application code, database records, pricing selections or credits were changed for this scope.

## Proposed outcome

After a successful grade, the owner can confirm or correct what the card is on its details page. They can also select the corresponding pricing product when one exists. This saves identity and pricing preferences without invoking grading, consuming a credit, changing a condition score, or replacing photos.

Owner confirmation means the owner reviewed the details; it is not independent authentication or a guarantee of market value. An exact catalog match may have no usable price. DCM should display unavailable pricing rather than borrow a different parallel's value.

## Existing building blocks and gaps

| Source | Current behavior | Consequence for Phase 2 |
|---|---|---|
| [EditCardDetailsButton](../src/components/cards/EditCardDetailsButton.tsx) | Shared owner-only entry used by all eight category pages. | Reuse one shared confirmation entry and modal, rather than implement eight different flows. |
| [EditCardDetailsModal](../src/components/cards/EditCardDetailsModal.tsx:345) | Dedicated payload branches for Pokémon, sports and MTG; other categories submit common fields. Save is disabled unless something changes. | Add category field adapters and a confirm-without-editing action. Do not require users to invent a change just to approve correct information. |
| [Details PATCH](../src/app/api/cards/[id]/details/route.ts:280) | Authenticates owner, honors sold-record lock, maps fields to columns and JSON, attempts to preserve original AI info, regenerates labels. | Retain these controls; consolidate confirmation, identity updates and price invalidation into a single authoritative save. |
| [Details validation](../src/app/api/cards/[id]/details/route.ts:23) | Unknown fields default to accepted; maps separately decide what gets written. Fields have inconsistent validation coverage. | Use an explicit allowed field schema per category, distinguishing omitted, cleared and unchanged values. |
| [Details mapping](../src/app/api/cards/[id]/details/route.ts:190) | For example, card number is written to JSON `card_number_raw`; several consumers also use `card_number`. | Centralize identity projection so labels, pricing and details read the same corrected values. |
| [Details save](../src/app/api/cards/[id]/details/route.ts:348) | Identity, original snapshot, generated label and custom-label updates happen in separate writes; no pricing invalidation appears in this handler. | Fix partial-save risk and explicitly clear incompatible prices when identity changes. Preserve intentional custom-label text according to existing rules. |
| [Sports pricing component](../src/components/pricing/PriceChartingLookup.tsx:461) | Has parallel selection and broader search. Selection and price fetch/save are separate; failed selection persistence is caught and logged. | Extract a reusable draft product selector. A selection shown in the dialog must not imply it was saved. |
| [Selection API](../src/app/api/pricing/dcm-select/route.ts) | Authenticates owner and saves client-supplied product ID/name. Does not update identity or invalidate prices; does not apply the details editor's sold-record lock. | Resolve product metadata server-side, enforce consistent permissions, and bind saved selection to the identity revision. |
| [Price-save API](../src/app/api/pricing/dcm-save/route.ts) | Saves client-supplied prices/product metadata separately from identity. | Do not use browser-submitted amounts as authoritative pricing in the new save flow. Audit and migrate existing callers. |
| [PriceCharting cache writes](../src/app/api/pricing/pricecharting/route.ts:70) | Writes by card ID; no identity-revision condition. The reviewed route permits card-ID cache activity without the owner checks used by details PATCH. | Separate public lookup from authorized persistence and protect cache writes against identity/selection changes. |
| [Background price refresh](../src/lib/pricing/batchPriceRefresh.ts:152) | Prefers `dcm_price_product_id`, not the saved manual-selection fields; writes cache by card ID. | Give confirmed/manual selection precedence and reject stale asynchronous results. Clearing only the visible price is insufficient. |
| [Regrade identity preservation](../src/lib/grading/preserveIdentity.ts) | Preserves many identity fields on force-regrade unless reidentification is requested. | Extend preservation to confirmation and override metadata; audit every other identity-writing path as well. |

These are source findings, not newly measured production failure rates. Existing database schema availability and real catalog responses need validation during implementation.

## Recommended user flow

1. Grade completes and the card details page loads. Show the grade first, then an owner-only “Confirm card details” dialog for an eligible, unconfirmed result.
2. Display front/back images with zoom and a compact editable identity form. Primary fields: name or player/character, set, year, printed card number, parallel/variant, language and serial numbering where relevant. Distinguish printed card number from serial numbering, such as `123` versus `17/99`.
3. Highlight uncertain or conflicting AI fields where trustworthy existing evidence is available. Do not rely solely on the current confidence label: the earlier identification audit found weaknesses in that label.
4. Provide “Confirm details”, “Save changes and confirm”, and “Review later”. Confirmation works when all existing values are correct. Unknown values can remain unknown; do not force guessed years or variants.
5. Offer an optional “Match market pricing” section. Show the current candidate's product name, set and variant, plus alternatives from the category's existing lookup. Search uses the edited draft, not the stale saved identity. Include “No exact match / not sure”.
6. Persist the confirmation only after the server accepts the save. Keep the dialog open with entered values if saving fails. Pricing lookup failure must not discard a valid identity correction.
7. If dismissed, leave a visible review banner and manual entry point. Do not reopen on every render or refresh. Queue the dialog with existing tours/offers so two modals do not compete.

Recommended launch behavior: automatically prompt for newly graded cards after rollout; give existing cards a review banner/button rather than suddenly showing popups throughout old collections. Public viewers, cards still grading, failed grades and sold/locked records do not receive an editable confirmation prompt.

Ordinary condition regrading should not reset an unchanged confirmed identity. Explicit reidentification that changes identity should require a new confirmation. Previously saved manual price selections should be preserved but should not automatically be relabeled as a full identity confirmation.

## Category coverage

| Category | Proposed primary variant fields | Existing pricing component to adapt |
|---|---|---|
| Sports | Player, year, set/subset, printed number, parallel, serial numbering | `PriceChartingLookup` and sports-parallels endpoint |
| Pokémon | Name, set, printed number/set total, language, holo/reverse holo, edition/art variant | `PokemonPriceLookup` |
| MTG | Printed name, set/code, collector number, language, foil/finish, frame variant | `MTGPriceLookup` |
| Lorcana | Character/version, set, collector number, language, foil/rarity variant | `LorcanaPriceLookup` |
| One Piece | Character, set/code, card number, language, alternate-art/parallel designation | `OnePiecePriceLookup` |
| Yu-Gi-Oh! | Name, set/printing code, number, language, edition/rarity | `OtherPriceLookup`, with a category adapter |
| Star Wars | Game/product family, set, name, number, variant/parallel | `OtherPriceLookup`, with a category adapter |
| Other | Franchise/product, set, name, number, language, free-text variant | `OtherPriceLookup`, with conservative matching |

The exact editable schema should be derived from existing stored fields and catalog capabilities. Do not force sports parallel terminology onto all TCGs. The shared dialog should use category-specific field definitions, not expose the entire current advanced editor at once.

Changing the grading category, authenticity/alteration verdict, holder detection, structural findings or grades is outside this confirmation step. A wrong grading category may have affected the rubric; route it to support instead of silently presenting the existing grade as category-correct. User-reported autograph and similar attributes must remain distinguishable from model authentication verdicts.

## Data and save contract

Proposed additions, finalized after schema inspection:

- `identity_revision`: increment only on a material identity change.
- `identity_confirmed_revision`, `identity_confirmed_at`, `identity_confirmed_by`: bind confirmation to exactly what was reviewed. These fields cannot be supplied arbitrarily by clients.
- A server-recorded correction history containing actor, before/after fields, source and timestamp. Preserve original AI observations separately from user corrections.
- `pricing_selection_revision`: increment when a pricing selection is changed or cleared, even if identity is unchanged.
- Pricing binding fields for identity revision, selection revision, provider/product ID, and the grade or grade-run version used to estimate DCM value. This also prevents a slow request for an old selection from winning a race when identity remains unchanged.
- Dismissal state separate from confirmation. A dismissal never counts as approval.

Extend the existing details API through a shared identity service, or add a dedicated confirmation endpoint using that same service. Do not create two independent writers. A request supplies expected revisions, allowlisted draft changes, a confirmation action, and an optional pricing product choice. The server verifies ownership and sold-record lock at write time, validates the product using the provider, computes the canonical patch, and commits identity/confirmation/selection/cache invalidation together. A stale revision returns a conflict rather than overwriting a newer edit.

External price lookup happens outside the database transaction. A persisted price result is accepted only if its identity, selection and grade inputs still match the current record. A provider outage leaves identity saved and pricing pending/unavailable. The confirmation request never invokes grading or credit APIs.

Current identity should take precedence in details, collection rows, labels, PDF presentation and pricing queries. Raw grading evidence and historical reports should remain attributable to the original run. Decide the display overlay explicitly instead of indiscriminately rewriting the full grading JSON. Existing custom-label overrides need the same targeted identity synchronization rule used today.

## Pricing rules

1. Any material change to name, set, number, year, language or variant invalidates the old product match and derived current prices unless a newly validated selection is saved in the same operation.
2. Clear both `dcm_selected_*` and applicable cached/current `dcm_price_*` fields when the old binding is invalid. Enumerate the exact columns during implementation; preserve historical price-at-grading records as history, not current pricing.
3. A confirmed product selection wins over automatic matching in detail-page fetches, collection refreshes, cron jobs and shared background refresh logic. An automatic result must never silently replace it.
4. A selected product must match the card, not merely share a player or character. Display meaningful differences and reject clearly incompatible category/set/number/language choices. Provider names and amounts are fetched server-side rather than trusted from the browser.
5. If a real variant has no listing or price, save identity with unavailable pricing. A base-card estimate is not an exact parallel price and must not be presented as one.
6. Product selection alone is not permission to overwrite printed card details. If it implies different fields, propose those differences for explicit review.
7. Before confirmation, existing automatic prices may remain visible as provisional. After identity changes, hide invalid old values immediately. A confirmed identity without a confirmed price match still has provisional or unavailable pricing.

## Implementation sequence

| Increment | Deliverable | Acceptance gate |
|---|---|---|
| 2A — identity/save foundation | Category schemas; revision checks; atomic identity/confirmation/selection invalidation; preserved AI provenance | Correct fields save consistently; conflicting edits are rejected; no grade/credit mutations |
| 2B — confirmation experience | Shared dialog, front/back review, unchanged confirmation, defer/banner state, all eight pages | Owner-only; sold lock; no repeated popup; failure preserves draft; keyboard/mobile usable |
| 2C — pricing integration | Reusable draft selector; provider-validated selection; revised cache writes and background refreshes | Old prices cannot survive an identity change or overwrite a newer selection |
| 2D — regression and rollout | Local fixtures, race tests, labels/collections checks, feature flag and historical-card behavior | End-to-end save/reload works without a grading call or credit deduction |

Start implementation with **2A**, then the dialog. Do not ship the automatic popup before save consistency and cache invalidation are ready. A bounded local implementation is likely several working days; pricing-writer consolidation and category inconsistencies are the main uncertainty, so a firm release estimate should follow 2A rather than assume this is just a modal change.

## Required tests

- Confirm without editing; corrected versus unknown fields; preserve leading zeros, alphanumeric collector codes, set totals and serial numbering.
- Category fixtures covering ordinary cards, similar names, same card across years/sets, language variants, foil/reverse foil, numbered parallels and missing catalog listings.
- Reject non-owner, sold-record, grade-field and stale-revision writes. Recheck sold status inside the save transaction.
- Assert no grading invocation, credit deduction/refund, image replacement, score change or altered grade timestamp.
- Confirm → reload; dismiss → banner; no viewer popup; regrade unchanged identity; reidentification changing identity.
- Price request A starts → identity or selection changes → response A arrives: it must be discarded. Repeat for a background refresh and changed grade.
- Selection save failure, provider timeout, invalid product, exact product without price, and clear-selection behavior.
- Labels, custom-label overrides, collection price badges, PDFs and card details all use the intended corrected identity/current price.
- Use mocked provider data and an isolated database first. Live account tests require an explicit test plan; this scope does not authorize additional account mutations.

## Exclusions and decisions

This phase does not rewrite AI identification, master grading prompts or category scoring deltas, build a physical retake workflow, offer free regrading, or publish anything. Native mobile UI is a separate follow-on; the API contract should support it.

Recommended defaults for implementation: optional pricing confirmation; “Review later” allowed; auto-prompt only newly graded owned/unlocked cards; legacy cards get a banner; category changes go to support; keep price certainty separate from identity confirmation. These are proposed product decisions, not implemented behavior.
