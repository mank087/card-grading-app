# Enterprise Phase 1 — "Store Branding" Implementation Plan

**Status: PLAN ONLY — nothing implemented yet.**
Target: co-branded grading for card stores (org logo on labels, reports, verify page)
with monthly grade quotas billed via Stripe, onboarded manually through admin.
First customer: Apex Grading (launch Aug 28, 2026).

Strategic rule locked in: **store brand leads, "Powered by DCM Optic™" anchors.**
Label QR + serials + /verify stay DCM — the verification registry is the moat.

---

## 0. Public page: /enterprise — "Enterprise Card Stores & Dealers"

Static marketing page (same pattern as the existing marketing pages), linked from
the site footer + homepage. Sections:

1. **Hero** — "Turn your card shop into a local grading company" (Andy's line —
   it tested well). CTA: lead form, not self-serve checkout (manual onboarding
   in v1 keeps quality control and lets us hand-hold the first orgs).
2. **Benefits** —
   - Monthly allotment of grades, **unused grades roll over** month to month.
   - Fully branded labels + slabs (your logo, your colors) across all label
     styles including Heritage.
   - Branded graded-card detail pages, full report PDFs, and downloadable /
     listing imagery under your store's brand.
   - Every card still backed by the DCM verification registry (QR + serial +
     /verify) — buyers can always authenticate.
3. **Pricing tiers** — 2-3 packages by volume (see §4); each shows monthly
   grades + the discounted per-grade overage rate.
4. **Lead form** — store name, contact, monthly volume estimate, current
   grading spend → writes to a `enterprise_leads` table + email notification
   (Resend, same as other transactional email).

## 1. Data model (one migration)

```sql
-- organizations: the enterprise tenant
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- "Apex Grading"
  slug text not null unique,                -- "apex" (phase-2 subdomain, reserved now)
  owner_user_id uuid not null references auth.users(id),
  status text not null default 'active',    -- active | suspended | cancelled
  -- branding
  logo_path text,                           -- storage: org-assets/{id}/logo.png (original)
  logo_white_path text,                     -- derived at upload
  logo_black_path text,                     -- derived at upload
  brand_color text default '#7C3AED',
  -- billing
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text,                                -- tier id (see §4)
  grade_credits int not null default 0,     -- ROLLOVER BALANCE: monthly deposit
                                            -- adds to it, never resets; grades
                                            -- draw it down; top-ups add to it
  monthly_allotment int not null default 0, -- deposited each invoice.paid
  created_at timestamptz default now()
);

create table enterprise_leads (
  id uuid primary key default gen_random_uuid(),
  store_name text not null,
  contact_name text,
  email text not null,
  monthly_volume text,
  message text,
  status text not null default 'new',       -- new | contacted | converted | closed
  created_at timestamptz default now()
);

create table organization_members (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',      -- 'owner' | 'member'
  created_at timestamptz default now(),
  primary key (org_id, user_id)
);
-- v1 simplification: a user belongs to AT MOST ONE org (enforce unique user_id).
create unique index organization_members_user_uniq on organization_members(user_id);

alter table cards add column org_id uuid references organizations(id);
alter table credit_transactions add column org_id uuid references organizations(id);
```

RLS: orgs readable by their members; writable only by service role (admin console
uses service key server-side). `cards.org_id` follows existing card RLS.

New storage bucket: **org-assets** (private; branding served via short-lived signed
URLs from the branding API below).

## 2. Grading flow changes (quota draw-down)

Where: `src/lib/credits.ts` + `src/app/api/stripe/deduct/route.ts` (the idempotent
per-card deduction — one 'grade' charge per card_id — is the single choke point;
keep it that way).

- New helper `resolveGradePayer(userId)` in credits.ts:
  1. Look up `organization_members` for the user.
  2. If org active AND `grade_credits > 0` → payer is the org.
  3. Else → payer is the user (existing personal-credit path, unchanged).
     Org balance at 0 → the grading UI offers the discounted overage top-up
     (org owner only) alongside falling back to personal credits.
- `deductCredit(...)` gains an org branch: atomic decrement
  (`update ... set grade_credits = grade_credits - 1 where grade_credits > 0
  returning`, so two concurrent grades can't both take the last unit), inserts
  `credit_transactions` with `org_id` and type `'org_grade'`. Refund path
  (`refundGradeCredit`) mirrors: increment the org balance when the original
  transaction carries org_id. This is the SAME shape as personal credits —
  rollover falls out for free because nothing ever resets.
- Stamp `cards.org_id = org.id` at the same moment (same place grading_model is
  stamped — piggyback the pattern from `recordGradingModel`).
- **No mobile changes needed**: mobile grades through the same APIs.

## 3. Branding pipeline

### 3a. Upload + derivation (admin-only API)
`POST /api/admin/organizations/[id]/branding` — accepts PNG (≤2MB, ≥512px):
- store original to `org-assets/{id}/logo.png`
- derive with sharp (already a dependency):
  - white variant: alpha preserved, RGB → white  (for dark labels)
  - black variant: RGB → #101014               (for Heritage / light labels)
- write the three paths onto the org row.

### 3b. Branding fetch (client generators)
`GET /api/org/branding` (auth; resolves caller's org — or `?cardId=` resolving the
card's org for shared surfaces): returns `{ name, logoUrl, logoWhiteUrl,
logoBlackUrl, brandColor }` as signed URLs, or `null` when no org. Small
client helper `src/lib/orgBranding.ts` caches per-session and converts to data
URLs (the pipeline's existing currency).

### 3c. Injection points (all already parameterized — this session's label work
centralized logos as data-URL inputs everywhere):
| Surface | File | Change |
|---|---|---|
| Slab labels (all styles) | callers of `loadLogoAsBase64/loadWhiteLogoAsBase64/loadBlackLogoAsBase64` (`LabelStudioClient`, `DownloadReportButton`, batch modals, `label-export/*` bridges, `label-preview`) | wrap the three loaders with org-aware versions: org logo when the card has org branding, DCM assets otherwise. ~1 helper + call-site sweep. |
| Heritage labels | same loaders feed `HeritageInputs.colorLogo/whiteLogo/blackLogo` | inherits from the wrapper — zero extra work. QR center mark: **stays DCM** (verification anchor). |
| Full report | `src/components/reports/CardGradingReport.tsx` header (line ~180: company name + logo) | org name + logo when `cardData.org` present; add subline "Powered by DCM Optic™". New optional `org` field on `ReportCardData`, populated by the 5 existing builders (they were all just touched for heritage — same seam). |
| Mini-report / card images | `miniReportJpgGenerator`, `cardImageGenerator` (logo params exist) | same wrapper. |
| Card detail pages (white-label) | 8× `src/app/{cat}/[id]/CardDetailClient.tsx` | when card.org_id: org logo + name replace the DCM header block, org brand_color accents, "Powered by DCM Optic™" subline retained. Org lookup server-side in each page.tsx (they already fetch the card), passed as one `org` prop. The heritage work touched all 8 files — same seam. |
| Verify page | `src/app/verify/[serial]/page.tsx` | when card.org_id: interstitial header "Graded for {Org}" + org logo above the redirect target, or org chip on the card page. Server-side org lookup. |
| Mobile previews | `dcm-mobile SlabCard` (logo is a bundled asset) | Phase 1: skip native previews (labels/downloads/report all come from web bridges and get branding free). Note in release comms. |

**Not branded in v1**: emails, homepage, pop report (registry stays DCM).

## 4. Billing: subscription deposit + rollover + discounted overage top-ups

> **SUPERSEDED (Aug 12-13, 2026):** pricing decided as Scenario D in
> docs/ENTERPRISE_PRICING_SCENARIOS.md — Dealer $199/400 and Enterprise
> $399/1,000, monthly allotments RESET each cycle (no rollover); overage packs
> $12.50/25 grades DO roll over in a separate bucket. Implemented Aug 13 as a
> two-bucket model (organizations.monthly_credits + overage_credits;
> grade_credits is a generated total). Tier constants: src/lib/orgPlans.ts.
> The section below is the original rollover design, kept for history.

Model: the monthly subscription DEPOSITS `monthly_allotment` into
`organizations.grade_credits` on every `invoice.paid`. Nothing resets, so
**unused grades roll over automatically**. Overage = one-time top-up purchases
at a discounted per-grade rate (same mechanics as the existing Basic/Pro/Elite
credit packs, but org-scoped).

- Stripe products:
  - 2-3 subscription tiers (PRICING TBD by Doug — working sketch below),
    metadata `{ dcm_type: 'org_plan', plan: '<tier>', grades: <n> }`.
  - Per-tier overage price (one-time), metadata
    `{ dcm_type: 'org_topup', grades: <n> }` — sold in small packs (e.g. 10)
    to avoid a checkout per single grade.
- Working pricing sketch (illustrative — Doug to confirm; anchor: VIP retail is
  $0.66/grade, so enterprise prices on branding + rollover + white-label, not
  on undercutting):
  | Tier | Monthly | Grades | Effective | Overage/grade |
  |---|---|---|---|---|
  | Shop | $149 | 100 | $1.49 | $1.25 |
  | Dealer | $399 | 300 | $1.33 | $1.10 |
  | Enterprise | $999 | 1000 | $1.00 | $0.85 |
- Checkout: admin generates Stripe checkout/payment links for the org owner
  (manual onboarding; the /enterprise page captures leads, it does not sell).
- Webhook (`src/app/api/stripe/webhook/route.ts` — subscription handlers exist):
  - `checkout.session.completed` (subscription + org metadata) → attach
    customer/subscription ids, set plan + monthly_allotment, make first deposit.
  - `invoice.paid` (renewals) → `grade_credits += monthly_allotment`
    (idempotent on invoice id via credit_transactions dedup, same guard style
    as the existing purchase webhook).
  - `checkout.session.completed` (one-time + org_topup metadata) →
    `grade_credits += n`.
  - `customer.subscription.updated/deleted` → plan change / suspend deposits
    (existing balance remains spendable — they paid for it).
- Balance at 0 → deduct API returns `ORG_QUOTA_EXHAUSTED`; grading UI shows
  the discounted top-up offer (org owner) / "contact {owner}" (member), and
  the user may still grade on personal credits if they choose.

## 5. Admin console

New section `src/app/admin/(dashboard)/organizations/`:
- List orgs (plan, quota used/total, period, status).
- Create/edit org: name, slug, owner (user lookup by email), plan + quota
  override, overage policy, status.
- Branding tab: logo upload (calls 3a), live preview strip — render the org logo
  into a sample Modern + Heritage label using the existing preview components.
- Members tab: add/remove by email.
- Billing tab: Stripe customer/subscription links, "generate checkout link".
- Server APIs under `/api/admin/organizations/*`, gated by the existing admin
  auth (`AdminAuthGuard` pattern / admin check used by other admin APIs).

## 6. User-facing touches (small in v1)

- Account page: "Store: {org name} — {n} store grades available" banner when
  the user is an org member.
- Grading flow: no UI change while the org balance covers it (silent); at 0,
  the ORG_QUOTA_EXHAUSTED state shows the discounted top-up (owner) or
  "contact {owner}" (member), with personal credits as a fallback choice.
- Label Studio: nothing — branding applies automatically via the loaders.

## 6b. Store Collection view (org members see the store's graded inventory)

Reuse the existing /collection infrastructure rather than building a parallel
page — it already has list + gallery views, batch label printing in both, the
ownership lifecycle (owned/sold/archived), and per-card label rendering.

- **Scope toggle** at the top of /collection for org members only:
  `My cards | {Store name}` — store scope lists ALL cards with
  `org_id = member's org`, regardless of which staff account graded them.
- **Server**: new `GET /api/org/cards` (auth → membership check → service-role
  query on cards by org_id, same shape as the collection query). Client RLS
  doesn't allow cross-user card reads, so this goes through the API like the
  admin console does.
- **Store-scope extras**:
  - "Graded by" column/filter (resolve member emails once, like the admin
    members tab)
  - Grade / category / date / ownership-status filters (the existing filter
    bar already covers most of this — it just needs to apply to the org query)
  - CSV export of the visible set (serial, name, set, grade, sub-grades,
    graded-by, date, status) — store inventory lists live in spreadsheets
  - Batch label printing works as-is once selection works in store scope
- **Permissions v1**: all org members see store scope read-only + can print
  labels; card edits (sell/archive/delete) stay with the card's grader and the
  org owner. (Finer roles are Phase 2.)
- **Later ideas (Phase 2, from Andy's LCS insights)**: per-card customer tag
  for submission tracking ("graded for walk-in customer X"), store stats
  header (grades this month, average grade, pop breakdown), public store
  showcase page at /{slug}.

## 6c. Onboarding-tailored store label (decided Aug 5, not yet built)

Decision: NO self-service Label Studio for enterprise. During onboarding, DCM
tailors the store's label design with them (their logo + our existing label
designs), and it's locked in as the org's house style. Rationale: brand
consistency — every slab out of one store should look identical — plus zero
new user-facing UI.

- `organizations.label_config` jsonb column (same CustomLabelConfig shape the
  Label Studio already saves — style, heritage pattern, band-color source or
  custom colors, grade chip colors).
- ADMIN console sets it: a "Label design" section in the org detail panel
  (/admin/organizations) with style choice + Heritage pattern/color pickers
  and a live preview via the existing HeritageLabelPreview / label preview
  components, rendered with the org's uploaded logo.
- Resolution order when rendering an org card's label:
  org label_config → else the grader's personal style → else default.
  One branch in the existing style-resolution path; every surface that
  already resolves per-user styles inherits it.
- Members simply see the store design on org cards; their personal Label
  Studio still governs their own non-org cards.
- Est. 2 days (admin UI + resolution branch). Sequence after the end-to-end
  pilot test passes.

## 7. Build order (est. ~12 working days)

1. **D1-2 — Foundation**: migration, RLS, org-assets bucket, admin CRUD +
   members (no branding yet). ✅ exit: org exists, member linked.
2. **D3-4 — Credits + billing**: resolveGradePayer, deductCredit org branch +
   refund mirror, card org_id stamp, Stripe products + webhook deposits/top-ups.
   ✅ exit: member grades draw the org balance; invoice.paid deposits roll over.
3. **D5-7 — Branding**: upload/derivation API, branding fetch API + client
   helper, loader wrapper + call-site sweep, report header, card detail pages
   (8 files), verify page.
   ✅ exit: Apex logo on labels/reports/detail pages/verify for org cards.
4. **D8 — Admin polish**: branding preview strip, balance dashboards, top-up
   link generation.
5. **D9-10 — /enterprise page**: marketing page + lead form + leads admin view
   + Resend notification. (Can run in parallel with 3-4 — it's independent.)
6. **D11-12 — Pilot**: create Apex org in prod, real logo, test grades end to
   end (labels incl. Heritage, report PDF, detail page, verify scan, eBay
   images, top-up purchase), then Steven live before Aug 28.

## 8. Test checklist

- Org member grades: org pool decrements once per card (retry the deduct API —
  idempotency must hold), card stamped, personal credits untouched.
- Balance edge: two concurrent grades at 1 remaining → exactly one succeeds.
- Rollover: unused balance + invoice.paid deposit = sum (no reset); duplicate
  webhook delivery of the same invoice deposits exactly once.
- Top-up: org_topup checkout adds to balance; only reachable by org owner.
- Refund: org grade refund restores the pool, not personal credits.
- Non-member: zero behavior change (regression guard on the whole credits path).
- Branding: every download surface (duplex/fold-over/batch, all 4 styles,
  report, mini-report, card images, eBay prep) shows org logo; QR still DCM;
  verify shows org attribution; card with org deleted → falls back to DCM.
- Webhook: invoice.paid resets; subscription.deleted suspends (grades fall back
  to personal credits, branding stays on already-graded cards).

## 9. Decisions needed from Doug before build

1. **Pricing**: confirm tier count (2 vs 3), monthly prices, grade counts,
   overage per-grade rates, and overage pack size (§4 sketch is illustrative).
2. **Co-brand lockup wording**: "Powered by DCM Optic™" everywhere? (recommended)
   Note: "white label access to detail pages/report/imagery" is implemented as
   store-brand-leads with the DCM subline retained — full invisibility would
   sever the verification story and is NOT recommended.
3. **Enterprise ToS**: one-pager from counsel before Apex goes live
   (logo license, no-misrepresentation, termination, registry ownership).
4. Whether org members' PERSONAL cards (graded before joining) can be
   retro-branded (recommend: no — org branding only from stamp-time forward).

## Deferred to Phase 2 (explicitly out of scope now)
Subdomain white-label portal, staff roles beyond owner/member, submission-center
screening flow, status center, org-wide collection views, wholesale/POS program,
Andy's rep tier on the affiliate system, native mobile branding.
