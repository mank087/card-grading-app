# Stripe Credits System Implementation Documentation

## Overview
This document details the complete Stripe monetization system implemented for DCM Grading. The system uses a credit-based model where users purchase credits to grade cards.

---

## Pricing Structure

| Tier | Credits | Price | Per Grade | Notes |
|------|---------|-------|-----------|-------|
| Basic | 1 | $2.99 | $2.99 | Single grade |
| Pro | 5 | $9.99 | $2.00 | Best value for casual |
| Elite | 20 | $19.99 | $1.00 | For serious collectors |

**First Purchase Bonus**: +1 FREE credit on first purchase only (not on account creation)

---

## Environment Variables

Located in `.env.local`:

```env
# Stripe Configuration (Sandbox/Test Mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Stripe Price IDs (Sandbox/Test Mode)
STRIPE_PRICE_BASIC=price_YOUR_BASIC_PRICE_ID
STRIPE_PRICE_PRO=price_YOUR_PRO_PRICE_ID
STRIPE_PRICE_ELITE=price_YOUR_ELITE_PRICE_ID
```

---

## Database Schema

**File**: `database/create_credits_tables.sql`

### Tables Created:

#### 1. `user_credits`
Stores user credit balances and purchase history.

```sql
- id (UUID, PK)
- user_id (UUID, FK to auth.users, UNIQUE)
- balance (INTEGER, default 0)
- total_purchased (INTEGER, default 0)
- total_used (INTEGER, default 0)
- first_purchase_bonus_claimed (BOOLEAN, default false)
- stripe_customer_id (TEXT, nullable)
- created_at, updated_at (TIMESTAMPS)
```

#### 2. `credit_transactions`
Audit log of all credit operations.

```sql
- id (UUID, PK)
- user_id (UUID, FK)
- type (TEXT: 'purchase', 'usage', 'bonus', 'refund', 'adjustment')
- amount (INTEGER, positive or negative)
- balance_after (INTEGER)
- description (TEXT)
- stripe_session_id (TEXT, nullable)
- card_id (UUID, nullable - links to graded card)
- created_at (TIMESTAMP)
```

### Row Level Security (RLS)
- Users can only view their own credits and transactions
- Service role can manage all records

**STATUS**: Migration has been run in Supabase

---

## Files Created/Modified

### New Files:

| File | Purpose |
|------|---------|
| `src/lib/stripe.ts` | Stripe client initialization and price configuration |
| `src/lib/credits.ts` | Credit management functions (get, add, deduct, check) |
| `src/app/api/stripe/checkout/route.ts` | Creates Stripe checkout sessions |
| `src/app/api/stripe/webhook/route.ts` | Handles Stripe webhook events |
| `src/app/api/stripe/credits/route.ts` | Returns user's credit balance |
| `src/app/api/stripe/deduct/route.ts` | Deducts credits for grading |
| `src/contexts/CreditsContext.tsx` | Global React context for credits state |
| `src/app/credits/page.tsx` | Purchase credits page |
| `src/app/credits/success/page.tsx` | Post-purchase success page |
| `database/create_credits_tables.sql` | Database migration script |

### Modified Files:

| File | Changes |
|------|---------|
| `src/components/ClientLayout.tsx` | Wrapped app in `CreditsProvider` |
| `src/app/upload/page.tsx` | Added credit check before upload, deduction after grading |
| `src/app/sports/[id]/CardDetailClient.tsx` | Added re-grade credit check and modals |
| `src/app/pokemon/[id]/CardDetailClient.tsx` | Added re-grade credit check and modals |
| `src/app/mtg/[id]/CardDetailClient.tsx` | Added re-grade credit check and modals |
| `src/app/lorcana/[id]/CardDetailClient.tsx` | Added re-grade credit check and modals |
| `src/app/other/[id]/CardDetailClient.tsx` | Added re-grade credit check and modals |
| `src/app/account/page.tsx` | Added credits display section |

---

## API Routes

### POST `/api/stripe/checkout`
Creates a Stripe checkout session.

**Request:**
```json
{
  "tier": "basic" | "pro" | "elite"
}
```

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

### POST `/api/stripe/webhook`
Handles Stripe webhooks (called by Stripe, not frontend).

**Event Handled:** `checkout.session.completed`
- Adds credits to user account
- Awards first purchase bonus if applicable
- Logs transaction

### GET `/api/stripe/credits`
Returns user's credit balance.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "balance": 5,
  "isFirstPurchase": false
}
```

### POST `/api/stripe/deduct`
Deducts 1 credit for grading/re-grading.

**Request:**
```json
{
  "cardId": "uuid-of-card" // optional, for audit trail
}
```

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "balance": 4
}
```

---

## React Context: CreditsContext

**File:** `src/contexts/CreditsContext.tsx`

### Provided Values:
```typescript
{
  balance: number;           // Current credit balance
  isLoading: boolean;        // Loading state
  isFirstPurchase: boolean;  // Eligible for first purchase bonus
  refreshCredits: () => Promise<void>;  // Refetch from server
  deductLocalCredit: () => void;        // Optimistic UI update
}
```

### Usage:
```typescript
import { useCredits } from '@/contexts/CreditsContext';

function MyComponent() {
  const { balance, isLoading, deductLocalCredit } = useCredits();
  // ...
}
```

---

## User Flows

### 1. New User Grading Flow
1. User uploads card on `/upload`
2. System checks `balance >= 1`
3. If insufficient: Shows "Insufficient Credits" modal with "Buy Credits" button
4. If sufficient: Proceeds with grading
5. After successful grading: Calls `/api/stripe/deduct`
6. Updates local credit state

### 2. Re-grade Flow (All Card Types)
1. User clicks "Re-grade" button on card detail page
2. System checks `balance >= 1`
3. If insufficient: Shows "Insufficient Credits" modal
4. If sufficient: Shows "Re-grade Confirmation" modal with credit warning
5. User confirms, grading proceeds
6. After success: Calls `/api/stripe/deduct`

### 3. Purchase Flow
1. User navigates to `/credits`
2. Selects a tier (Basic/Pro/Elite)
3. Clicks "Buy X Credits"
4. Redirected to Stripe Checkout
5. Completes payment
6. Stripe sends webhook to `/api/stripe/webhook`
7. Webhook adds credits + first purchase bonus (if applicable)
8. User redirected to `/credits/success`
9. Success page refreshes credit balance

---

## Stripe Webhook Configuration

**Webhook URL:** `https://dcmgrading.com/api/stripe/webhook`

**Events to Listen For:**
- `checkout.session.completed` (primary - handles credit fulfillment)

**Signing Secrets Configured:**
- Checkout webhook: `whsec_YOUR_WEBHOOK_SECRET`

**Note:** User created 3 separate webhook endpoints. Only the `checkout.session.completed` one is critical. The others (`payment_intent.succeeded`, `payment_intent.payment_failed`) are optional.

---

## Testing Checklist

### Prerequisites
1. Ensure `.env.local` has all Stripe variables
2. Database migration has been run
3. Start dev server: `npm run dev`

### Test 1: Credit Balance Display
- [ ] Go to `/account` - should see "Grading Credits" section with balance
- [ ] Balance should show 0 for new users
- [ ] "Buy Credits" button should link to `/credits`

### Test 2: Purchase Flow (Stripe Test Mode)
- [ ] Go to `/credits`
- [ ] See all three tiers with correct pricing
- [ ] See "First Purchase Bonus" banner (for new users)
- [ ] Click "Buy 1 Credit" (Basic tier)
- [ ] Should redirect to Stripe Checkout
- [ ] Use test card: `4242 4242 4242 4242`, any future date, any CVC
- [ ] After payment, should redirect to `/credits/success`
- [ ] Balance should update (1 + 1 bonus = 2 for first purchase)

### Test 3: Upload Credit Check
- [ ] With 0 credits, go to `/upload`
- [ ] Try to upload a card
- [ ] Should see "Insufficient Credits" modal
- [ ] "Buy Credits" button should redirect to `/credits`
- [ ] With credits, upload should work normally
- [ ] After grading completes, credit should be deducted

### Test 4: Re-grade Credit Check (Test on each card type)
- [ ] Go to an existing graded card (e.g., `/sports/[id]`)
- [ ] With 0 credits, click "Re-grade"
- [ ] Should see "Insufficient Credits" modal
- [ ] With credits, should see "Re-grade Confirmation" modal
- [ ] Modal should show credit warning: "This will use 1 credit (Balance: X)"
- [ ] Confirm re-grade, verify credit deducted after completion

**Card types to test:**
- [ ] Sports (`/sports/[id]`)
- [ ] Pokemon (`/pokemon/[id]`)
- [ ] MTG (`/mtg/[id]`)
- [ ] Lorcana (`/lorcana/[id]`)
- [ ] Other (`/other/[id]`)

### Test 5: Webhook Processing
- [ ] Check Stripe Dashboard > Developers > Webhooks
- [ ] Verify webhook events are being received
- [ ] Check for any failed webhook deliveries
- [ ] Verify `user_credits` table updates correctly

### Test 6: Edge Cases
- [ ] Cancel payment at Stripe Checkout - should redirect to `/credits?canceled=true`
- [ ] Multiple rapid purchases - verify balance updates correctly
- [ ] Refresh `/account` page - balance should persist

---

## Stripe Test Cards

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 0002 | Card declined |
| 4000 0000 0000 9995 | Insufficient funds |
| 4000 0025 0000 3155 | Requires 3D Secure |

Use any future expiration date and any 3-digit CVC.

---

## Production Deployment Checklist

When ready to go live:

1. **Create Stripe Live Mode Products/Prices**
   - Create same 3 products in live mode
   - Get live price IDs

2. **Update Environment Variables**
   - Replace test keys with live keys
   - Update `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_live_...)
   - Update `STRIPE_SECRET_KEY` (sk_live_...)
   - Update `STRIPE_PRICE_*` with live price IDs

3. **Create Live Webhook**
   - In Stripe Dashboard, create webhook for production URL
   - Subscribe to `checkout.session.completed`
   - Get new signing secret
   - Update `STRIPE_WEBHOOK_SECRET`

4. **Test in Production**
   - Make a small real purchase to verify flow
   - Check webhook delivery in Stripe Dashboard

---

## Known Issues / Future Improvements

1. **Credit deduction timing**: Currently deducts after grading completes. Could fail if API call fails after grading. Consider deducting before grading with refund on failure.

2. **Webhook retry handling**: Stripe retries failed webhooks. Current implementation should handle idempotency via session ID checks, but verify in production.

3. **Credit refunds**: No UI for refunds yet. Admin would need to manually adjust via database or Stripe Dashboard.

4. **Transaction history UI**: Users can't see their credit transaction history. Could add a "Transaction History" section to account page.

5. **Rate limiting**: No rate limiting on credit check/deduct endpoints. Consider adding for production.

---

## Support Contacts

- Stripe Dashboard: https://dashboard.stripe.com
- Stripe Test Mode: Ensure "Test mode" toggle is ON in dashboard
- Webhook Logs: Dashboard > Developers > Webhooks > Select endpoint > View logs

---

## Quick Reference Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Check Supabase tables (via SQL editor in Supabase dashboard)
SELECT * FROM user_credits WHERE user_id = 'your-user-id';
SELECT * FROM credit_transactions ORDER BY created_at DESC LIMIT 10;
```

---

*Last Updated: December 3, 2025*
*Implementation by: Claude Code*
