# DCM Grading — Affiliate Program Setup & Testing Guide

## Status

- [x] Database migration applied (affiliates, affiliate_commissions, affiliate_clicks)
- [x] Core business logic (`src/lib/affiliates.ts`)
- [x] Admin API routes (`/api/admin/affiliates/*`)
- [x] Admin dashboard page (`/admin/affiliates`)
- [x] Public API routes (`/api/affiliate/click`, `/api/affiliate/validate`)
- [x] ReferralTracker component (added to ClientLayout)
- [x] Stripe checkout/subscribe routes updated to pass `ref_code` in metadata
- [x] Stripe webhook handles commission creation + reversal
- [x] Credits, VIP, and Card Lovers pages pass `ref_code` from localStorage
- [x] Public affiliate landing page (`/affiliates`)

---

## Stripe Webhook Configuration

The webhook already handles `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, and `customer.subscription.deleted`. Two additions were made:

### New event to enable in Stripe Dashboard

Go to **Stripe Dashboard > Developers > Webhooks** and add this event to the existing webhook endpoint:

- `charge.refunded` — triggers automatic commission reversal on refunds

This is the only Stripe configuration change needed. The existing `allow_promotion_codes: true` on checkout sessions already lets buyers type promo codes.

---

## How to Create Your First Affiliate

### Option A: Admin Dashboard (Recommended)

1. Log into the admin panel at `/admin`
2. Click **Affiliates** in the sidebar
3. Click **+ Add Affiliate**
4. Fill in:
   - **Name**: e.g., "Doug the Card Guy"
   - **Email**: their contact/payout email
   - **Referral Code**: e.g., "DOUG" (auto-uppercased)
   - **Commission Rate**: 20% (default)
   - **Payout Details**: their PayPal email or Venmo handle
5. Click **Create Affiliate**

This automatically creates a Stripe coupon (10% off, once) and a Stripe promotion code matching their referral code.

### Option B: API (for scripting)

```bash
curl -X POST https://www.dcmgrading.com/api/admin/affiliates \
  -H "Content-Type: application/json" \
  --cookie "admin_token=YOUR_SESSION_TOKEN" \
  -d '{
    "name": "Doug the Card Guy",
    "email": "doug@example.com",
    "code": "DOUG",
    "commission_rate": 0.20,
    "payout_details": "doug@paypal.com"
  }'
```

### What happens on creation

1. A row is inserted into the `affiliates` table
2. A Stripe coupon is created: "Affiliate: DOUG (10% off)" — 10% off, once
3. A Stripe promotion code is created with code "DOUG" linked to that coupon
4. Both Stripe IDs are stored on the affiliate record

If Stripe promo code creation fails (e.g., code already exists in Stripe), the affiliate is still created — it just won't have a Stripe promo code for direct checkout entry. The referral link flow still works.

---

## Attribution Flow (How It Works)

### Path 1: Referral Link

```
Visitor clicks: dcmgrading.com/?ref=DOUG
  → ReferralTracker component fires on page load
  → Validates code via GET /api/affiliate/validate?code=DOUG
  → Stores in localStorage: dcm_ref_code = "DOUG", dcm_ref_timestamp = now
  → Fire-and-forget: POST /api/affiliate/click (records click with hashed IP)

Later, visitor makes a purchase:
  → credits/vip/card-lovers page reads localStorage dcm_ref_code
  → Passes ref_code in the checkout/subscribe request body
  → Checkout route validates the affiliate, adds ref_code to Stripe session metadata
  → Webhook reads ref_code from session metadata → creates commission
```

### Path 2: Promo Code at Checkout

```
Visitor goes to checkout (no referral link)
  → Types "DOUG" in the Stripe promo code field
  → Stripe applies 10% discount via the promotion code
  → Webhook reads promotion_code from session → maps to affiliate → creates commission
```

### Path 3: Both

If a visitor uses a referral link AND types the promo code, the referral link attribution takes priority (checked first). No duplicate commission is created.

---

## Testing Checklist

### 1. Create a Test Affiliate

- Go to `/admin/affiliates` → Add Affiliate
- Name: "Test Affiliate", Email: your email, Code: "TEST"
- Verify the affiliate appears in the table
- Check Stripe Dashboard > Products > Coupons — confirm "Affiliate: TEST (10% off)" exists
- Check Stripe Dashboard > Products > Promotion Codes — confirm "TEST" code exists

### 2. Test Referral Link

- Open an incognito/private browser window
- Visit `http://localhost:3000/?ref=TEST` (or your staging URL)
- Open browser DevTools > Application > Local Storage
- Confirm `dcm_ref_code` = "TEST" and `dcm_ref_timestamp` is set
- Check the `affiliate_clicks` table in Supabase — confirm a row was created

### 3. Test Purchase with Referral Link

- While still having `dcm_ref_code` in localStorage, buy a Basic package ($2.99)
- After Stripe payment completes, check `affiliate_commissions` table:
  - `affiliate_id` matches the test affiliate
  - `referred_user_id` matches the buying user
  - `stripe_session_id` is populated
  - `status` = "pending"
  - `hold_until` is ~14 days in the future
  - `commission_amount` is calculated correctly (net_amount * 0.20)
- Check `affiliates` table: `total_referrals` incremented, `total_commission_earned` updated

### 4. Test Promo Code at Checkout (Without Referral Link)

- Clear localStorage (or use a fresh incognito window without `?ref=`)
- Go to `/credits` and buy Pro package ($9.99)
- At the Stripe checkout, enter promo code "TEST"
- Verify 10% discount is applied ($8.99)
- After payment, check `affiliate_commissions` — commission should still be attributed

### 5. Test Self-Referral Blocking

- If the test affiliate has a `user_id` linked, log in as that user
- Visit `?ref=TEST`, then make a purchase
- Check `affiliate_commissions` — no commission should be created (blocked)
- Check server logs for: `[Affiliate] Self-referral blocked`

### 6. Test Duplicate Attribution

- Using the same user from test #3, make another purchase with `?ref=TEST`
- Check `affiliate_commissions` — only the first commission should exist
- Check server logs for: `[Affiliate] Duplicate attribution blocked`

### 7. Test Commission Approval

- In `affiliate_commissions`, manually set `hold_until` to a past date for your test record
- Go to `/admin/affiliates` → click "Approve Pending"
- Verify the commission status changed from "pending" to "approved"
- Verify `approved_at` is populated

### 8. Test Payout Flow

- In the admin dashboard, click on the test affiliate row to expand details
- Click "Pay Out $X.XX" button
- Enter a payout reference (e.g., "PP-TEST-001")
- Confirm → verify commission status is now "paid" with `paid_at` and `payout_reference` set
- Verify `affiliates.total_commission_paid` is updated

### 9. Test Refund Reversal

- In Stripe Dashboard, find the test payment and issue a full refund
- The `charge.refunded` webhook should fire
- Check `affiliate_commissions` — status should be "reversed" with `reversal_reason` set
- Check `affiliates` — `total_referrals` and `total_commission_earned` should be decremented

### 10. Test Attribution Window Expiry

- Set `dcm_ref_code` in localStorage manually
- Set `dcm_ref_timestamp` to a date > 30 days ago (e.g., `Date.now() - 31*24*60*60*1000`)
- Refresh the page
- Check localStorage — both keys should be cleared (expired)

---

## Commission Calculation Reference

| Package | Price | After 10% Affiliate Discount | Net to DCM (approx) | Commission (20%) |
|---------|-------|------------------------------|---------------------|-------------------|
| Basic | $2.99 | $2.69 | $2.69 | $0.54 |
| Pro | $9.99 | $8.99 | $8.99 | $1.80 |
| Elite | $19.99 | $17.99 | $17.99 | $3.60 |
| VIP | $99.00 | $89.10 | $89.10 | $17.82 |
| Card Lovers Monthly | $49.99 | $44.99 | $44.99 | $9.00 |
| Card Lovers Annual | $449.00 | $404.10 | $404.10 | $80.82 |

Note: The 10% buyer discount is applied by Stripe (via promotion code). The commission is calculated on the `amount_total` from the Stripe session — whatever the buyer actually paid. VIP and Founders packages don't receive the existing Card Lovers/Founder 20% discount, but the affiliate's 10% Stripe promo code works on all tiers.

Commission on Card Lovers subscriptions is on the **first invoice only** (not recurring renewals).

---

## Admin Dashboard Features

**`/admin/affiliates`**

- **Affiliate table**: Name, code, status, commission rate, referrals, earned, paid, pending balance
- **Click row to expand**: Shows stats (clicks, conversions, conversion rate) + full commission history
- **Add Affiliate**: Modal form with all fields, auto-creates Stripe promo code
- **Pause/Activate**: Toggle affiliate status (paused affiliates don't earn commissions)
- **Approve Pending**: Batch approves all commissions past their 14-day hold period
- **Pay Out**: Select approved commissions, enter payout reference (PayPal/Venmo transaction ID), mark as paid

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/lib/affiliates.ts` | Core business logic (all DB operations) |
| `src/components/ReferralTracker.tsx` | Captures `?ref=CODE` on page load |
| `src/app/api/affiliate/click/route.ts` | Records clicks (public, no auth) |
| `src/app/api/affiliate/validate/route.ts` | Validates codes (public, no auth) |
| `src/app/api/admin/affiliates/route.ts` | List/create affiliates (admin) |
| `src/app/api/admin/affiliates/[id]/route.ts` | Get/update/deactivate affiliate (admin) |
| `src/app/api/admin/affiliates/commissions/route.ts` | List/pay commissions (admin) |
| `src/app/api/admin/affiliates/approve-commissions/route.ts` | Batch approve (admin) |
| `src/app/admin/(dashboard)/affiliates/page.tsx` | Admin dashboard UI |
| `src/app/affiliates/page.tsx` | Public info page |
| `supabase/migrations/20260211_add_affiliate_program.sql` | Database schema |

---

## Fraud Prevention Summary

| Protection | How It Works |
|------------|-------------|
| Self-referral blocking | `affiliate.user_id === referred_user_id` → skip |
| Duplicate attribution | Only first purchase per user per affiliate earns commission |
| IP hashing | Click tracking stores SHA-256 hash, never raw IPs |
| 14-day hold | Commissions aren't payable until 14 days after purchase |
| Auto-reversal | `charge.refunded` webhook reverses the commission automatically |
| Attribution window | localStorage ref codes expire after 30 days |

---

## Phase 2 Ideas (Not Implemented)

- Affiliate self-service dashboard (login, see own stats/earnings)
- Application form on `/affiliates` page (instead of email CTA)
- Automated payouts via PayPal API
- Tiered commission rates (higher volume = higher rate)
- Recurring commissions on Card Lovers renewals
- Affiliate-specific landing pages
- UTM parameter tracking for campaign analytics
