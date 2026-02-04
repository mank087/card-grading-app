# Card Lovers Subscription - Implementation Plan

**Created:** February 4, 2026
**Status:** Approved for Implementation

---

## Executive Summary

Card Lovers is a monthly subscription package that provides:
- 70 credits/month at $49.99 (or 900 credits/year at $449)
- Exclusive "Card Lovers" label emblem (red heart, purple/red theme)
- Badge on My Collection page
- 20% discount on additional credit purchases
- Loyalty bonuses at subscription milestones

---

## Core Policies

### Credits
| Policy | Details |
|--------|---------|
| **Monthly Credits** | 70 credits added each billing cycle |
| **Rollover** | Unlimited - credits accumulate indefinitely |
| **Ownership** | Credits are paid for, owned forever, never forfeited |
| **After Cancellation** | All accumulated credits remain usable |

### Subscription Lapse Behavior
| Item | When Active | When Lapsed |
|------|-------------|-------------|
| Accumulated credits | Usable | Still usable |
| New monthly credits | Yes | No |
| Card Lovers badge | Displayed | Hidden |
| Label emblem | Available | Reverts to Founder or none |
| 20% discount | Active | Lost |
| Loyalty progress | Accumulating | Resets to 0 |

### Re-subscription
- User can resubscribe at any time
- Regains all perks immediately
- Starts earning credits again
- Loyalty month counter resets to 0 (must re-earn bonuses)

---

## Pricing Structure

### Plans

| Plan | Price | Base Credits | Bonus | Total | Per Grade |
|------|-------|--------------|-------|-------|-----------|
| Monthly | $49.99/mo | 70/mo (840/yr) | +50/year | 890/year | $0.67 |
| Annual | $449/year | 840 | +60 | 900 | $0.50 |

### Comparison with Other Packages

| Package | Price | Credits | Per Grade |
|---------|-------|---------|-----------|
| Basic | $2.99 | 1 | $2.99 |
| Pro | $9.99 | 5 | $2.00 |
| Elite | $19.99 | 20 | $1.00 |
| **Card Lovers Monthly** | **$49.99/mo** | **70/mo** | **$0.67** |
| **Card Lovers Annual** | **$449/yr** | **900** | **$0.50** |
| Founders | $99 | 150 | $0.66 |

### Loyalty Bonuses (Monthly Subscribers)

| Milestone | Bonus Credits |
|-----------|---------------|
| Month 3 | +5 credits |
| Month 6 | +10 credits |
| Month 9 | +15 credits |
| Month 12 | +20 credits |
| **Total Year 1** | **+50 credits** |

### Annual Subscriber Bonus
- +60 credits awarded upfront with annual subscription
- Slightly more than accumulated monthly bonuses (incentivizes annual)

---

## Dual Membership (Founder + Card Lover)

Users can be both a Founder AND a Card Lover subscriber.

### Badge Display
- Both badges can be displayed on My Collection page
- Each badge has independent show/hide toggle in Account settings

### Label Emblem
- User chooses preferred emblem in Account settings
- Options: "Founder" (star), "Card Lovers" (heart), "None", or "Auto"
- "Auto" shows highest tier (Founder if available, else Card Lover)

---

## 20% Discount on Additional Credits

Active Card Lovers subscribers receive 20% off credit package purchases:

| Package | Regular Price | Card Lover Price | Savings |
|---------|---------------|------------------|---------|
| Basic (1) | $2.99 | $2.39 | $0.60 |
| Pro (5) | $9.99 | $7.99 | $2.00 |
| Elite (20) | $19.99 | $15.99 | $4.00 |

**Note:** Discount does not apply to Founders Package (already best one-time value).

---

## Database Schema

### Modify `user_credits` Table

```sql
-- Card Lovers subscription fields
ALTER TABLE user_credits ADD COLUMN is_card_lover BOOLEAN DEFAULT FALSE;
ALTER TABLE user_credits ADD COLUMN card_lover_subscribed_at TIMESTAMPTZ;
ALTER TABLE user_credits ADD COLUMN card_lover_current_period_end TIMESTAMPTZ;
ALTER TABLE user_credits ADD COLUMN card_lover_subscription_id TEXT;
ALTER TABLE user_credits ADD COLUMN card_lover_plan TEXT; -- 'monthly' or 'annual'
ALTER TABLE user_credits ADD COLUMN card_lover_months_active INTEGER DEFAULT 0;
ALTER TABLE user_credits ADD COLUMN show_card_lover_badge BOOLEAN DEFAULT TRUE;
ALTER TABLE user_credits ADD COLUMN preferred_label_emblem TEXT DEFAULT 'auto';
-- Values: 'founder', 'card_lover', 'none', 'auto'
```

### New `subscription_events` Table (Audit Trail)

```sql
CREATE TABLE subscription_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  -- Values: 'subscribed', 'renewed', 'cancelled', 'upgraded', 'loyalty_bonus', 'payment_failed'
  plan TEXT, -- 'monthly' or 'annual'
  credits_added INTEGER DEFAULT 0,
  bonus_credits INTEGER DEFAULT 0,
  stripe_subscription_id TEXT,
  stripe_invoice_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscription_events_user ON subscription_events(user_id);
CREATE INDEX idx_subscription_events_type ON subscription_events(event_type);
```

---

## Stripe Configuration

### Products & Prices

**Product:** Card Lovers Subscription

| Price ID | Plan | Amount | Interval |
|----------|------|--------|----------|
| `price_card_lovers_monthly` | Monthly | $49.99 | month |
| `price_card_lovers_annual` | Annual | $449.00 | year |

### Webhook Events to Handle

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Initial subscription setup |
| `invoice.paid` | Add credits, check loyalty bonus |
| `invoice.payment_failed` | Log event, send notification |
| `customer.subscription.updated` | Handle plan changes, proration |
| `customer.subscription.deleted` | Set `is_card_lover = false` |

### Proration (Monthly → Annual Upgrade)

- Stripe handles payment proration automatically
- Calculate credits to add: `(840 + 60) - credits_already_given_this_cycle`
- Update plan type and period end date

---

## Label Design Specifications

### Card Lovers Label

| Element | Specification |
|---------|---------------|
| Icon | Red heart (❤️) - replaces Founder's gold star |
| Primary Color | Purple (#8B5CF6) |
| Accent Color | Rose/Red (#E11D48) |
| Text | "Card Lovers" |
| Dimensions | Same as existing labels |
| Position | Same as Founder emblem position |

### Label Selection Logic

```typescript
function getLabelEmblem(user: UserCredits): 'founder' | 'card_lover' | null {
  const preference = user.preferred_label_emblem;
  const isActiveCardLover = user.is_card_lover &&
    user.card_lover_current_period_end > new Date();

  if (preference === 'none') return null;
  if (preference === 'founder' && user.is_founder) return 'founder';
  if (preference === 'card_lover' && isActiveCardLover) return 'card_lover';

  // Auto: prefer founder, then card_lover
  if (preference === 'auto') {
    if (user.is_founder) return 'founder';
    if (isActiveCardLover) return 'card_lover';
  }

  return null;
}
```

---

## API Routes

### New Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/stripe/subscribe` | POST | Create subscription checkout session |
| `/api/stripe/cancel-subscription` | POST | Cancel subscription at period end |
| `/api/stripe/upgrade-subscription` | POST | Upgrade monthly to annual |
| `/api/subscription/status` | GET | Get current subscription details |
| `/api/account/preferences` | POST | Update badge/emblem preferences |

### Modified Routes

| Route | Changes |
|-------|---------|
| `/api/stripe/checkout` | Apply 20% discount for active Card Lovers |
| `/api/stripe/webhook` | Handle subscription events |

---

## Frontend Pages

### New Pages

| Page | Purpose |
|------|---------|
| `/card-lovers` | Sales/marketing page |
| `/card-lovers/success` | Post-purchase confirmation |

### Modified Pages

| Page | Changes |
|------|---------|
| `/account` | Badge toggles, emblem preference, subscription management |
| `/credits` | Show 20% discount pricing for active subscribers |
| `/collection` | Display Card Lovers badge |
| `/my-collection/[username]` | Display Card Lovers badge |

---

## Account Settings UI

### New Section: "Badge & Label Settings"

```
Badge & Label Settings
─────────────────────────────────────────
Display Badges on Collection Page:
  ☑ Show Founder Badge        (if is_founder)
  ☑ Show Card Lovers Badge    (if is_card_lover)

Label Emblem Preference:
  [Dropdown: Auto / Founder / Card Lovers / None]

  "Auto" shows Founder emblem if available,
  otherwise Card Lovers if subscribed.
─────────────────────────────────────────
```

### New Section: "Card Lovers Subscription"

```
Card Lovers Subscription
─────────────────────────────────────────
Status: Active (Monthly)
Next billing date: March 4, 2026
Monthly credits: 70

Loyalty Progress: Month 2 of 3
  → +5 bonus credits at Month 3!

[Upgrade to Annual - Save $150/year]
[Cancel Subscription]
─────────────────────────────────────────
```

---

## User Flows

### Flow 1: New Subscription

```
1. User visits /card-lovers
2. Clicks "Subscribe Monthly" or "Subscribe Annual"
3. Redirected to Stripe Checkout
4. Completes payment
5. Webhook: checkout.session.completed
   → Set is_card_lover = true
   → Add credits (70 for monthly, 900 for annual)
   → Set card_lover_plan, subscription_id, period_end
   → Log subscription_event
6. Redirect to /card-lovers/success
```

### Flow 2: Monthly Renewal

```
1. Stripe auto-charges on billing date
2. Webhook: invoice.paid
   → Verify subscription is for Card Lovers
   → Add 70 credits to balance
   → Increment card_lover_months_active
   → Check loyalty milestone
   → If milestone hit, add bonus credits
   → Update card_lover_current_period_end
   → Log subscription_event
```

### Flow 3: Cancellation

```
1. User clicks "Cancel Subscription" in Account
2. API calls Stripe to cancel at period end
3. User retains access until period end
4. Webhook: customer.subscription.deleted
   → Set is_card_lover = false
   → Set card_lover_months_active = 0
   → Credits remain in account (not forfeited)
   → Log subscription_event
```

### Flow 4: Monthly → Annual Upgrade

```
1. User clicks "Upgrade to Annual" in Account
2. API creates upgrade request to Stripe
3. Stripe calculates proration
4. Webhook: customer.subscription.updated
   → Calculate remaining credits to add
   → Add (900 - credits_already_given_this_cycle)
   → Set card_lover_plan = 'annual'
   → Set card_lover_months_active = 12
   → Update period_end
   → Log subscription_event
```

### Flow 5: Re-subscription After Lapse

```
1. User visits /card-lovers (or /account)
2. Clicks "Resubscribe"
3. Same as Flow 1 (New Subscription)
4. card_lover_months_active resets to 1
5. Previous credits still in account
```

---

## Implementation Phases

### Phase 1: Foundation (Database & Stripe)
- [ ] Run database migrations
- [ ] Create Stripe products and prices
- [ ] Update webhook endpoint configuration

### Phase 2: Subscription APIs
- [ ] POST /api/stripe/subscribe
- [ ] POST /api/stripe/cancel-subscription
- [ ] POST /api/stripe/upgrade-subscription
- [ ] GET /api/subscription/status

### Phase 3: Webhook Handler Updates
- [ ] Handle checkout.session.completed for subscriptions
- [ ] Handle invoice.paid for renewals
- [ ] Handle customer.subscription.updated
- [ ] Handle customer.subscription.deleted
- [ ] Implement loyalty bonus logic

### Phase 4: Card Lovers Page
- [ ] Create /card-lovers page with purple/red theme
- [ ] Monthly and Annual pricing cards
- [ ] Benefits breakdown
- [ ] Subscribe buttons (auth-aware)
- [ ] Create /card-lovers/success page

### Phase 5: Label Generation
- [ ] Design Card Lovers label (heart icon, purple/red)
- [ ] Update label generation code
- [ ] Implement emblem preference logic
- [ ] Test dual membership label selection

### Phase 6: Account Settings
- [ ] Add badge visibility toggles
- [ ] Add label emblem preference dropdown
- [ ] Add subscription status display
- [ ] Add cancel/upgrade buttons
- [ ] Add loyalty progress display

### Phase 7: Collection Badges
- [ ] Update /collection to show Card Lovers badge
- [ ] Update /my-collection/[username] for public view
- [ ] Implement badge visibility logic

### Phase 8: 20% Discount
- [ ] Check subscription status in checkout route
- [ ] Apply discount to eligible purchases
- [ ] Update Credits page to show discounted prices
- [ ] Add "Card Lovers Discount" badge/label on pricing

---

## File Changes Summary

### New Files
```
src/app/card-lovers/page.tsx
src/app/card-lovers/success/page.tsx
src/app/api/stripe/subscribe/route.ts
src/app/api/stripe/cancel-subscription/route.ts
src/app/api/stripe/upgrade-subscription/route.ts
src/app/api/subscription/status/route.ts
src/app/api/account/preferences/route.ts
src/components/labels/CardLoversLabel.tsx (or update existing)
```

### Modified Files
```
src/lib/credits.ts - Add Card Lover functions
src/lib/stripe.ts - Add subscription price IDs
src/app/api/stripe/webhook/route.ts - Handle subscription events
src/app/api/stripe/checkout/route.ts - Apply 20% discount
src/app/account/page.tsx - Badge toggles, subscription management
src/app/credits/page.tsx - Show discounted prices
src/app/collection/page.tsx - Display badges
src/app/my-collection/[username]/page.tsx - Display badges
src/components/labels/* - Add Card Lovers emblem option
```

---

## Testing Checklist

### Subscription Flow
- [ ] New monthly subscription creates correctly
- [ ] New annual subscription creates correctly
- [ ] Credits added on initial subscription
- [ ] Annual bonus credits (60) added correctly

### Renewal Flow
- [ ] Monthly renewal adds 70 credits
- [ ] Loyalty bonus at month 3 (+5)
- [ ] Loyalty bonus at month 6 (+10)
- [ ] Loyalty bonus at month 9 (+15)
- [ ] Loyalty bonus at month 12 (+20)

### Cancellation Flow
- [ ] Cancellation schedules for period end
- [ ] Access maintained until period end
- [ ] Credits retained after cancellation
- [ ] is_card_lover set to false after period end
- [ ] Loyalty progress resets

### Upgrade Flow
- [ ] Monthly to annual proration calculates correctly
- [ ] Correct credits added after proration
- [ ] Plan type updates correctly

### Discount Flow
- [ ] 20% discount applied to Basic package
- [ ] 20% discount applied to Pro package
- [ ] 20% discount applied to Elite package
- [ ] Discount NOT applied to Founders package
- [ ] Discount removed when subscription lapses

### Badge Display
- [ ] Card Lovers badge shows on own collection
- [ ] Card Lovers badge shows on public collection
- [ ] Badge respects show/hide setting
- [ ] Both badges show for dual members

### Label Emblem
- [ ] Card Lovers emblem appears on labels
- [ ] Preference setting works correctly
- [ ] "Auto" selects Founder over Card Lover
- [ ] "None" removes emblem from labels

---

## Open Questions / Future Considerations

1. **Pause Subscription** - Allow users to pause instead of cancel?
2. **Gift Subscriptions** - Allow purchasing for others?
3. **Team/Family Plans** - Multiple users under one subscription?
4. **Referral Bonus** - Credits for referring new subscribers?
5. **Seasonal Promotions** - Discount codes for subscription?

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-04 | 1.0 | Initial plan created |
