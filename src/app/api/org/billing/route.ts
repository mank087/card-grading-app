/**
 * GET /api/org/billing — the caller's org billing state for /store/billing.
 *
 * Returns both credit buckets (monthly resets each cycle, overage rolls
 * over), plan, subscription state (renewal date, pending-cancel flag from
 * Stripe), and the caller's role. Members see everything read-only; the
 * page gates actions to owners client-side and every mutating route
 * re-checks the role server-side.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/serverAuth'
import { getOrgForUser } from '@/lib/organizations'
import { stripe, getSubscriptionPeriodEnd } from '@/lib/stripe'
import { ORG_PLANS, ORG_OVERAGE_PACK } from '@/lib/orgPlans'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult.authenticated || !authResult.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const membership = await getOrgForUser(authResult.user.id)
  if (!membership) {
    return NextResponse.json({ org: null })
  }
  const { org, role } = membership

  // Live subscription state from Stripe: renewal date + pending-cancel flag.
  // Best-effort — a Stripe hiccup shouldn't blank the balances.
  let subscription: {
    attached: boolean
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: string | null
    status: string | null
  } = { attached: false, cancelAtPeriodEnd: false, currentPeriodEnd: null, status: null }
  if (org.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id)
      subscription = {
        attached: true,
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        currentPeriodEnd: getSubscriptionPeriodEnd(sub).toISOString(),
        status: sub.status,
      }
    } catch (err) {
      console.error('[org/billing] Failed to retrieve subscription:', err)
      subscription = { attached: true, cancelAtPeriodEnd: false, currentPeriodEnd: null, status: null }
    }
  }

  return NextResponse.json({
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      plan: org.plan,
      monthlyCredits: org.monthly_credits,
      overageCredits: org.overage_credits,
      totalCredits: org.grade_credits,
      monthlyAllotment: org.monthly_allotment,
      brandColor: org.brand_color,
      hasPaymentMethod: Boolean(org.stripe_customer_id),
    },
    role,
    subscription,
    // Published tiers + pack, so the page renders prices from the same
    // source of truth the checkout route charges from.
    plans: ORG_PLANS,
    overagePack: ORG_OVERAGE_PACK,
  })
}
