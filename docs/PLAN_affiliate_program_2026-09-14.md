# Affiliate program: completion plan (2026-09-14)

**Model change (owner decision, 2026-09-14):** no cash commissions. Approved affiliates get a unique
code. New customers who use it get 15% off their first purchase (Stripe promotion code with a
first-time-transaction restriction, auto-applied from the referral link). The affiliate earns 20
grading credits, granted instantly to their DCM account, each time a referred customer makes
their first paid web purchase. Refunds claw the credits back. Applications come through a form on
/affiliates and land in admin@dcmgrading.com plus an admin tab; approved partners see their code
and stats on the account page. Phase 1 below was built on 2026-09-14; the cash-payout items in
Phase 2 are dropped.


## Where it stands today (verified in code and data)

**Working**
- Public page `/affiliates` (not linked from nav or footer; only the help bot links to it).
- Attribution chain: `?ref=CODE` captured by `ReferralTracker` into localStorage for 30 days, passed as `ref_code` into Stripe Checkout metadata, and `processAffiliateAttribution` in the Stripe webhook records a commission on one-time packs and on the first invoice of a Card Lovers subscription. Renewals do not earn commission.
- Stripe: creating an affiliate through `POST /api/admin/affiliates` creates a 10% coupon and a promotion code for that affiliate. Method 2 attribution matches purchases where the buyer typed that code.
- Admin page `/admin/affiliates`: list, create, edit, approve pending commissions, mark approved commissions paid with a payout reference.
- Refund handling: `handleChargeRefunded` calls `reverseCommission`.

**Broken or missing**
1. Both "Apply" buttons open a mailto to `partners@dcmgrading.com`, which does not exist. Applications are lost.
2. The page promises a "real-time dashboard". No affiliate-facing page exists.
3. The fan discount is not applied by the referral link. Checkout sets `allow_promotion_codes` only, so a buyer arriving via `?ref=` still has to type the code by hand to get 10% off. The link only tracks.
4. Zero affiliates, clicks or commissions exist, so nothing has been exercised in production, including the Stripe coupon and promo-code creation.
5. No affiliate terms page; the public page's "generous commissions" copy names no rate.
6. iOS purchases (StoreKit) carry no referral, so App Store buyers never attribute. Accepted gap for now.

## Decisions needed from the owner

| # | Decision | Default if unanswered |
|---|---|---|
| D1 | Commission on Card Lovers renewals, or first invoice only | First invoice only (current) |
| D2 | Fan discount: first purchase only, or every purchase for 30 days | First purchase only (matches page copy) |
| D3 | Must an affiliate hold a DCM account | Yes (needed for the dashboard login) |
| D4 | Payout rail and schedule | PayPal, monthly, $20 minimum (current default) |
| D5 | Commission rate shown publicly | 20% (current default) |

## Phase 1: working program (about one day)

**1.1 Application form and emails**
- Replace both mailto buttons on `/affiliates` with a form: name, email, primary channel and URL, audience size, how they plan to promote, PayPal email, agreement checkbox.
- New route `POST /api/affiliate/apply`: validate, reuse the per-IP rate limit from `api/contact`, add a honeypot field, insert into a new `affiliate_applications` table (mirror `enterprise_leads`: id, fields, status `new | approved | declined`, created_at, admin_notes, affiliate_id).
- Resend: notify `admin@dcmgrading.com` with reply-to set to the applicant, and send the applicant a confirmation from `DCM Grading <admin@dcmgrading.com>` (the sender `welcomeEmail.ts` already uses). Plain HTML, no em dashes.
- Migration: `20260915_affiliate_applications.sql`.

**1.2 Admin approval flow**
- Applications tab on `/admin/affiliates`: list new applications, approve or decline.
- Approve opens the existing create form prefilled (name, email, suggested code, payout details) and links the application to the created affiliate.
- On create, send the affiliate a welcome email: their link `https://dcmgrading.com/?ref=CODE`, their promo code, rate, payout terms, dashboard link.

**1.3 Apply the discount from the link**
- In `api/stripe/checkout`, when `ref_code` resolves to an active affiliate and the buyer has no member or founder discount, pass `discounts: [{ promotion_code: affiliate.stripe_promotion_code_id }]` instead of `allow_promotion_codes`. Members keep their 20% and get no stacking, as today.
- Set the coupon to `duration: once` and, per D2, the promotion code to `restrictions.first_time_transaction: true` at creation time.

**1.4 Stripe live verification**
- Create one real affiliate in live mode and confirm the coupon and promotion code appear in the Stripe dashboard.
- Test a $2.99 purchase through the link and one by typing the code. Confirm both create a pending commission, approval works, and a refund reverses it.

**1.5 Discoverability**
- Footer link "Affiliates". Update page copy to state the rate (D5) and the discount rule (D2). Remove the dashboard promise until 2.1 ships.

## Phase 2: partner self-service (one to two days)

**2.1 Affiliate dashboard** at `/affiliate/dashboard`, gated by the signed-in user matching `affiliates.user_id` (D3). Shows link and code with copy buttons, clicks (30 days), referrals, pending, approved and paid totals, commission history. Backed by `GET /api/affiliate/me` using `getAffiliateStats` and `getCommissionHistory`, which already exist.

**2.2 Monthly payout run**
- Cron on the 1st: auto-approve pending commissions older than 30 days (past the refund window), then email each affiliate with an approved balance at or above `minimum_payout` a statement.
- Admin pays through PayPal and records the reference with the existing mark-paid action. Automated payouts (PayPal Payouts or Stripe Connect) are a later phase only if volume justifies it.

**2.3 Terms** page `/affiliate-terms`: eligibility, cookie window, self-referral ban, FTC disclosure requirement, payout schedule, termination. Linked from the form's agreement checkbox and the welcome email.

## Phase 3: later
- iOS attribution through StoreKit purchase metadata.
- Promo assets (QR, banners) and UTM presets per affiliate.
- Fraud checks: self-referral by matching payer email to affiliate email; velocity limits on clicks.

## Test checklist before announcing
- Application submitted: row created, admin email received with working reply-to, applicant confirmation received.
- Approve: affiliate row, Stripe coupon and promo code, welcome email.
- Link purchase: discount applied automatically, commission pending with correct amount.
- Code purchase without link: commission pending.
- Member purchase via link: member discount applied, no stacking, commission still recorded (or not, per D1 policy for members; default yes).
- Refund: commission reversed.
- Dashboard shows the above within a minute.
