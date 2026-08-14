/**
 * POST /api/org/billing/manage — owner subscription management.
 *
 * Body: { action: 'cancel' | 'resume' | 'portal' | 'upgrade' }
 * - cancel: flags cancel_at_period_end — the store keeps its paid monthly
 *   grades through the period; the webhook stops future resets and zeroes
 *   the monthly bucket only on final deletion (overage packs survive).
 * - resume: clears the flag before the period ends. No new charge.
 * - portal: Stripe hosted Billing Portal session (payment method, invoices).
 * - upgrade: Dealer → Enterprise mid-cycle. Swaps the subscription item to
 *   the Enterprise inline price with an immediate prorated invoice, bumps the
 *   org's allotment, and grants the allotment DIFFERENCE into the monthly
 *   bucket (usage this cycle is preserved, not forgiven). The webhook skips
 *   the resulting subscription_update invoice — credits are granted here.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/serverAuth'
import { getOrgForUser, returnOrgCredits } from '@/lib/organizations'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { stripe } from '@/lib/stripe'
import { ORG_PLANS } from '@/lib/orgPlans'
import { priceDataTaxBehavior } from '@/lib/stripeTax'

export const runtime = 'nodejs'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dcmgrading.com'

/** Validated request origin for the Billing Portal return URL. */
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
    return NextResponse.json({ error: 'Only the store owner can manage billing' }, { status: 403 })
  }

  const body = await request.json()
  const action = body.action as 'cancel' | 'resume' | 'portal' | 'upgrade'

  try {
    if (action === 'portal') {
      if (!org.stripe_customer_id) {
        return NextResponse.json({ error: 'No billing account yet — subscribe first' }, { status: 400 })
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: `${redirectBase(request)}/store/billing`,
      })
      return NextResponse.json({ url: session.url })
    }

    if (action === 'upgrade') {
      if (!org.stripe_subscription_id) {
        return NextResponse.json({ error: 'No active plan to upgrade' }, { status: 400 })
      }
      if (org.status !== 'active') {
        return NextResponse.json({ error: 'Store is not active' }, { status: 403 })
      }
      // v1: the only self-serve path is Dealer → Enterprise. Custom/pilot
      // plans are admin-managed.
      if (org.plan !== ORG_PLANS.dealer.key) {
        return NextResponse.json({ error: 'Your current plan cannot be upgraded here. Contact DCM.' }, { status: 400 })
      }
      const target = ORG_PLANS.enterprise

      const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id)
      if (sub.cancel_at_period_end || sub.status === 'canceled') {
        return NextResponse.json({ error: 'Resume your plan before upgrading' }, { status: 400 })
      }
      const itemId = sub.items.data[0]?.id
      if (!itemId) {
        return NextResponse.json({ error: 'Subscription has no items — contact DCM' }, { status: 500 })
      }

      // Swap the item to the Enterprise inline price. always_invoice charges
      // the prorated difference for the remainder of the cycle immediately.
      await stripe.subscriptions.update(org.stripe_subscription_id, {
        items: [{
          id: itemId,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(target.priceUsd * 100),
            recurring: { interval: 'month' },
            product: typeof sub.items.data[0].price.product === 'string'
              ? sub.items.data[0].price.product
              : sub.items.data[0].price.product.id,
            ...priceDataTaxBehavior(),
          },
        }],
        proration_behavior: 'always_invoice',
        metadata: {
          dcm_type: 'org_plan',
          orgId: org.id,
          plan: target.key,
          grades: String(target.gradesPerMonth),
        },
      })

      // Bump the org: new plan + allotment; renewals now reset to the new
      // amount via the normal invoice.paid path.
      const { error: orgError } = await supabaseAdmin
        .from('organizations')
        .update({
          plan: target.key,
          monthly_allotment: target.gradesPerMonth,
          updated_at: new Date().toISOString(),
        })
        .eq('id', org.id)
      if (orgError) {
        console.error('[org/billing/manage] upgrade org update failed:', orgError.message)
      }

      // Grant the difference into the monthly bucket — usage stays counted.
      const diff = target.gradesPerMonth - ORG_PLANS.dealer.gradesPerMonth
      const newBalance = await returnOrgCredits(org.id, diff, 'monthly')
      const { error: txError } = await supabaseAdmin.from('credit_transactions').insert({
        user_id: org.owner_user_id,
        org_id: org.id,
        type: 'purchase',
        amount: diff,
        balance_after: newBalance ?? 0,
        description: `${org.name} — upgraded to ${target.name} (${diff} additional monthly grades this cycle)`,
        metadata: {
          org_credit: true,
          org_bucket: 'monthly',
          org_dedupe_key: `upgrade-${org.stripe_subscription_id}-${sub.items.data[0].price.id}`,
          source: 'subscription',
          plan_upgrade: true,
        },
      })
      if (txError) {
        console.error('[org/billing/manage] upgrade tx record failed:', txError.message)
      }

      console.log('[org/billing/manage] Upgraded org to enterprise:', {
        orgId: org.id, diff, newBalance,
      })
      return NextResponse.json({ success: true, plan: target.key, added: diff, newBalance })
    }

    if (action === 'cancel' || action === 'resume') {
      if (!org.stripe_subscription_id) {
        return NextResponse.json({ error: 'No active plan' }, { status: 400 })
      }
      const sub = await stripe.subscriptions.update(org.stripe_subscription_id, {
        cancel_at_period_end: action === 'cancel',
      })
      return NextResponse.json({
        success: true,
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[org/billing/manage] Stripe error:', err)
    return NextResponse.json({ error: 'Billing action failed' }, { status: 500 })
  }
}
