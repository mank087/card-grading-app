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
import { escapeHtml } from '@/lib/orgSlugs'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY)

/** Admin alert (fire-and-forget) — same Resend pattern as the enterprise lead route. */
async function sendAdminAlert(subject: string, html: string) {
  try {
    await resend.emails.send({
      from: 'DCM Grading <noreply@dcmgrading.com>',
      to: ['admin@dcmgrading.com'],
      subject,
      html,
    })
  } catch (emailErr) {
    console.error('[org/billing/manage] admin alert email failed:', emailErr)
  }
}

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
      // amount via the normal invoice.paid path. Stripe has already charged
      // the prorated Enterprise price above, so a failed write here would
      // leave the customer paying $399 on a 400-grade allotment — retry, and
      // if it still fails, alert + 500 (never silent). The subscription
      // metadata written above carries the new grades value, and
      // handleOrgInvoicePaid now self-heals monthly_allotment from that
      // metadata on the next renewal, so even a missed alert can't leave the
      // org stale forever.
      let orgUpdated = false
      let lastOrgError = ''
      for (let attempt = 1; attempt <= 3 && !orgUpdated; attempt++) {
        const { error: orgError } = await supabaseAdmin
          .from('organizations')
          .update({
            plan: target.key,
            monthly_allotment: target.gradesPerMonth,
            updated_at: new Date().toISOString(),
          })
          .eq('id', org.id)
        if (!orgError) {
          orgUpdated = true
        } else {
          lastOrgError = orgError.message
          console.error(`[org/billing/manage] upgrade org update failed (attempt ${attempt}/3):`, orgError.message)
        }
      }

      // Grant the difference into the monthly bucket — usage stays counted.
      // Idempotent on org_dedupe_key: the tx insert is the claim (backed by
      // the partial unique index on metadata->>'org_dedupe_key'), and the
      // balance increment runs only after the claim succeeds — same
      // claim-first ordering as depositOrgCredits, so a double-submitted
      // upgrade can never double-grant.
      const diff = target.gradesPerMonth - ORG_PLANS.dealer.gradesPerMonth
      // Key is deliberately price-independent: the Stripe update mints a new
      // inline price id, so a key embedding the price would differ between a
      // first attempt and a staggered double-submit or post-failure retry,
      // defeating the dedupe. One dealer→enterprise upgrade per subscription.
      const dedupeKey = `upgrade-${org.stripe_subscription_id}-dealer-to-enterprise`
      let newBalance: number | null = null
      let alreadyGranted = false

      const { data: priorGrant, error: dedupeError } = await supabaseAdmin
        .from('credit_transactions')
        .select('id')
        .eq('org_id', org.id)
        .eq('metadata->>org_dedupe_key', dedupeKey)
        .limit(1)
      if (dedupeError) {
        // Fail closed: without a verified dedupe check, don't grant.
        console.error('[org/billing/manage] CRITICAL: upgrade grant dedupe check failed — grant skipped:', dedupeError.message)
        await sendAdminAlert(
          `Org upgrade grant NOT applied — ${org.name}`,
          `<p>Upgrade to ${target.name} for org <strong>${escapeHtml(org.name)}</strong> (${org.id}) charged on Stripe, but the +${diff} monthly-grade grant was skipped because the dedupe check errored: ${escapeHtml(dedupeError.message)}</p><p>Verify and grant manually (dedupe key: ${dedupeKey}).</p>`
        )
      } else if (priorGrant && priorGrant.length > 0) {
        alreadyGranted = true
      } else {
        const { data: txRow, error: txError } = await supabaseAdmin
          .from('credit_transactions')
          .insert({
            user_id: org.owner_user_id,
            org_id: org.id,
            type: 'purchase',
            amount: diff,
            // Expected post-grant total; the increment runs next.
            balance_after: (org.grade_credits ?? 0) + diff,
            description: `${org.name} — upgraded to ${target.name} (${diff} additional monthly grades this cycle)`,
            metadata: {
              org_credit: true,
              org_bucket: 'monthly',
              org_dedupe_key: dedupeKey,
              source: 'subscription',
              plan_upgrade: true,
            },
          })
          .select('id')
          .single()
        if (txError) {
          if (txError.code === '23505') {
            // Unique-index backstop fired: a concurrent request already
            // granted. Treat as already-granted, not an error.
            alreadyGranted = true
          } else {
            console.error('[org/billing/manage] upgrade grant claim failed — nothing granted:', txError.message)
            await sendAdminAlert(
              `Org upgrade grant NOT applied — ${org.name}`,
              `<p>Upgrade to ${target.name} for org <strong>${escapeHtml(org.name)}</strong> (${org.id}) charged on Stripe, but the +${diff} monthly-grade grant transaction failed to insert: ${escapeHtml(txError.message)}</p><p>Grant manually (dedupe key: ${dedupeKey}).</p>`
            )
          }
        } else {
          newBalance = await returnOrgCredits(org.id, diff, 'monthly')
          if (newBalance === null) {
            // Increment failed after the claim — unwind the claim so a retry
            // can re-attempt cleanly (same recovery as depositOrgCredits).
            await supabaseAdmin.from('credit_transactions').delete().eq('id', txRow.id)
            console.error('[org/billing/manage] CRITICAL: upgrade grant increment failed after claim (claim unwound):', { orgId: org.id, dedupeKey })
            await sendAdminAlert(
              `Org upgrade grant NOT applied — ${org.name}`,
              `<p>Upgrade to ${target.name} for org <strong>${escapeHtml(org.name)}</strong> (${org.id}) charged on Stripe, but the +${diff} monthly-grade balance increment failed. Grant manually (dedupe key: ${dedupeKey}).</p>`
            )
          }
        }
      }

      if (!orgUpdated) {
        // Customer is now paying Enterprise on a Dealer allotment. Alert a
        // human and surface the failure to the caller — the charge went
        // through, so this must not look like success.
        await sendAdminAlert(
          `URGENT: org upgrade DB update failed — ${org.name}`,
          `<p>Org <strong>${escapeHtml(org.name)}</strong> (${org.id}) was charged for the ${target.name} upgrade on Stripe (subscription ${org.stripe_subscription_id}), but updating the org row (plan/monthly_allotment) failed after 3 attempts: ${escapeHtml(String(lastOrgError))}</p><p>Set plan='${target.key}' and monthly_allotment=${target.gradesPerMonth} manually. Credit grant status: ${alreadyGranted ? 'already granted' : newBalance !== null ? 'granted' : 'NOT granted — check preceding alert'}.</p>`
        )
        return NextResponse.json(
          { error: 'Your payment went through, but we hit an error finishing the upgrade. Our team has been alerted and will complete it shortly — no need to retry or pay again.' },
          { status: 500 }
        )
      }

      console.log('[org/billing/manage] Upgraded org to enterprise:', {
        orgId: org.id, diff, newBalance, alreadyGranted,
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
