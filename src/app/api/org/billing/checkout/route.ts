/**
 * POST /api/org/billing/checkout — owner self-serve Stripe checkout.
 *
 * Body: { kind: 'plan', planKey: 'dealer' | 'enterprise' }
 *     | { kind: 'topup', packs?: number }   // 1–40 overage packs, default 1
 *
 * Amounts come EXCLUSIVELY from src/lib/orgPlans.ts server-side — the client
 * never sends a price. Sessions carry the same metadata contract the admin
 * link generator uses (dcm_type org_plan / org_topup + orgId), so the
 * existing webhook handles them with zero changes. Custom pilot deals stay
 * admin-only via the admin checkout-link route.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/serverAuth'
import { getOrgForUser } from '@/lib/organizations'
import { stripe } from '@/lib/stripe'
import { ORG_PLANS, ORG_OVERAGE_PACK, OrgPlanKey } from '@/lib/orgPlans'
import { orgTaxParams, priceDataTaxBehavior } from '@/lib/stripeTax'

export const runtime = 'nodejs'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dcmgrading.com'
const MAX_PACKS = 40 // $500 / 1,000 grades in one purchase — above that, talk to us

/**
 * Redirect base for Stripe success/cancel URLs: the validated request origin
 * (same allowlist pattern as the consumer checkout), so local/preview
 * checkouts round-trip back to the environment that started them instead of
 * hardcoding production.
 */
function redirectBase(request: NextRequest): string {
  const allowed = [
    'https://dcmgrading.com',
    'https://www.dcmgrading.com',
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
  ]
  const origin = request.headers.get('origin')
  return origin && allowed.includes(origin) ? origin : SITE_URL
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult.authenticated || !authResult.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const membership = await getOrgForUser(authResult.user.id)
  if (!membership) {
    return NextResponse.json({ error: 'No organization' }, { status: 403 })
  }
  const { org, role } = membership
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Only the store owner can make purchases' }, { status: 403 })
  }
  if (org.status !== 'active') {
    return NextResponse.json(
      { error: org.status === 'pending' ? 'Your store is awaiting approval' : 'Store is not active' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const kind = body.kind as 'plan' | 'topup'

  const base = redirectBase(request)
  const common = {
    success_url: `${base}/store/billing?checkout=success`,
    cancel_url: `${base}/store/billing?checkout=cancelled`,
    ...(org.stripe_customer_id ? { customer: org.stripe_customer_id } : {}),
    ...orgTaxParams(Boolean(org.stripe_customer_id)),
  }

  try {
    if (kind === 'plan') {
      const planKey = body.planKey as OrgPlanKey
      const plan = ORG_PLANS[planKey]
      if (!plan) {
        return NextResponse.json({ error: 'Unknown plan' }, { status: 400 })
      }
      if (org.stripe_subscription_id) {
        // One subscription per org. Plan changes go through cancel + resub
        // or an admin-managed proration — not a second subscription.
        return NextResponse.json({ error: 'Store already has an active plan' }, { status: 409 })
      }
      // org.stripe_subscription_id is only set by the webhook AFTER checkout
      // completes, so two open checkout tabs could both pass the check above
      // and create two live subscriptions. Ask Stripe directly for any live
      // subscription on the org's customer before creating another session.
      if (org.stripe_customer_id) {
        const existing = await stripe.subscriptions.list({
          customer: org.stripe_customer_id,
          status: 'all',
          limit: 20,
        })
        const LIVE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete']
        const live = existing.data.find((s) => LIVE_STATUSES.includes(s.status))
        if (live) {
          console.warn('[org/billing/checkout] Blocked duplicate plan checkout — live subscription exists:', {
            orgId: org.id, subscriptionId: live.id, status: live.status,
          })
          return NextResponse.json({ error: 'Store already has an active plan' }, { status: 409 })
        }
      }
      const metadata = {
        dcm_type: 'org_plan',
        orgId: org.id,
        plan: plan.key,
        grades: String(plan.gradesPerMonth),
      }
      const session = await stripe.checkout.sessions.create({
        ...common,
        // New plans land on the welcome walkthrough instead of raw billing.
        success_url: `${base}/store/welcome?checkout=success`,
        mode: 'subscription',
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(plan.priceUsd * 100),
            recurring: { interval: 'month' },
            product_data: {
              name: `DCM Enterprise — ${org.name} (${plan.name}: ${plan.gradesPerMonth} grades/month)`,
            },
            ...priceDataTaxBehavior(),
          },
        }],
        metadata,
        subscription_data: { metadata },
      })
      return NextResponse.json({ url: session.url })
    }

    if (kind === 'topup') {
      // Packs are OVERAGE on top of a plan, not a standalone product: the
      // wholesale per-grade rate is justified by the monthly commitment.
      // Cancel-at-period-end orgs still have their subscription id until the
      // period lapses, so they can stock up during wind-down; fully
      // unsubscribed orgs cannot. (Admin-issued pack links bypass this
      // deliberately for special arrangements.)
      if (!org.stripe_subscription_id) {
        return NextResponse.json(
          { error: 'Overage packs require an active plan. Choose a plan first.' },
          { status: 403 }
        )
      }
      const packs = Number.isInteger(body.packs) ? body.packs : 1
      if (packs < 1 || packs > MAX_PACKS) {
        return NextResponse.json({ error: `packs must be 1 to ${MAX_PACKS}` }, { status: 400 })
      }
      const grades = packs * ORG_OVERAGE_PACK.grades
      const session = await stripe.checkout.sessions.create({
        ...common,
        mode: 'payment',
        line_items: [{
          quantity: packs,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(ORG_OVERAGE_PACK.priceUsd * 100),
            product_data: {
              name: `DCM Enterprise — ${org.name} overage pack (${ORG_OVERAGE_PACK.grades} grades, rolls over)`,
            },
            ...priceDataTaxBehavior(),
          },
        }],
        metadata: {
          dcm_type: 'org_topup',
          orgId: org.id,
          grades: String(grades),
        },
      })
      return NextResponse.json({ url: session.url })
    }

    return NextResponse.json({ error: 'kind must be "plan" or "topup"' }, { status: 400 })
  } catch (err) {
    console.error('[org/billing/checkout] Stripe error:', err)
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 })
  }
}
