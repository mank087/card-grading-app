# Listing Templates — Post-Launch Workstream (planned Aug 13, 2026)

**Status: PLAN ONLY — sequence after the Aug 28 enterprise launch.**

Origin: direct customer feedback on the eBay/InstaList flow — "listings where I
leave the generated description get very little clicks until I customize it,"
plus requests for set-once defaults (disclaimers, shipping policy) and a
branded 'why buy' image in the photo set. Valuable to consumers AND enterprise
stores; build it org-aware from day one so stores get store-branded defaults
for free.

## Feature 1 — Listing defaults (set once, apply always)

A saved defaults record applied whenever a listing is created:
- Standard disclaimer block (condition/AI-grade language)
- Shipping policy (service, handling time, price or calculated)
- Returns policy
- Default listing format/duration/category preferences where applicable

Storage: `listing_templates` table (user_id, org_id nullable, jsonb config),
one active per user; org-scoped default overrides personal when listing in org
context (same resolution pattern as label styles: org → personal → built-in).
Surface: a "Listing defaults" section reachable from the InstaList/eBay flow +
/store/settings for org owners.

## Feature 2 — Description templates with merge fields

User-editable description template with merge fields, e.g.:
`{cardName} {setName} {year} {grade} {gradeLabel} {serial} {certUrl}
{subgrades} {storeName}`. Rendered at listing-generation time; falls back to
the current generated description when no template exists.

- Template editor with live preview against one of the user's real cards
- A few starter presets (clean/minimal, detailed/collector, store-branded)
- Same personal/org resolution order as Feature 1

This is the highest-signal item: the customer observed customized descriptions
materially outperform generated ones on clicks.

## Feature 3 — Branded "why buy" slide in the eBay photo set

`ebay-image-prep` already generates listing imagery. Add one templated trust
slide appended to the photo set:
- Store logo (or DCM logo for consumers), brand color background
- "Scan to verify" QR + cert serial + 1-line explanation of the registry
- Grade + sub-grades summary chip

Opt-in toggle in the listing flow; org branding threads through the existing
`loadLogosForCard` pipeline.

## Key files (current state)

- `src/components/ebay/EbayListingModal.tsx` — listing creation UI (org logos
  already threaded)
- `src/app/instalist-marketplace/MarketplaceClient.tsx` — InstaList flow
- `src/app/ebay-image-prep/[cardId]/page.tsx` + `src/lib/cardImageGenerator.ts`
  — imagery generation (logoOverrides param exists)
- Description generation: wherever the current eBay description text is built
  (locate during build — likely in the listing modal or a lib helper)

## Rough estimate

Feature 1: ~1 day · Feature 2: ~1.5 days (editor + merge rendering + presets) ·
Feature 3: ~1 day. Independent — can ship in any order; Feature 2 first by
customer signal.
