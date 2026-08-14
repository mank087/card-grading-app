/**
 * Generate a Stripe Checkout link for an org (manual onboarding, v1).
 * Two kinds:
 *  - kind 'plan':  monthly subscription; each invoice RESETS the org's monthly
 *    bucket to `grades` — the allotment does not roll over (webhook:
 *    dcm_type org_plan)
 *  - kind 'topup': one-time overage pack of `grades`; lands in the rollover
 *    overage bucket (webhook: dcm_type org_topup)
 * Published tiers (Dealer/Enterprise, src/lib/orgPlans.ts) are preset in the
 * admin UI, but this API accepts arbitrary amounts so unpublished pilot deals
 * need no code changes — price_data is created inline, no Stripe products.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { stripe } from '@/lib/stripe'
import { isUuid } from '@/lib/uuid'
import { orgTaxParams, priceDataTaxBehavior } from '@/lib/stripeTax'

export const runtime = 'nodejs'

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return null
  return await verifyAdminSession(token)
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dcmgrading.com'

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, name, plan, stripe_customer_id')
    .eq('id', params.id)
    .maybeSingle()
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const body = await request.json()
  const kind = body.kind as 'plan' | 'topup'
  const grades = parseInt(body.grades, 10)
  const amountUsd = Number(body.amountUsd)
  const planName = String(body.planName || org.plan || 'enterprise').trim()

  if (kind !== 'plan' && kind !== 'topup') {
    return NextResponse.json({ error: 'kind must be "plan" or "topup"' }, { status: 400 })
  }
  if (!Number.isInteger(grades) || grades <= 0 || grades > 100000) {
    return NextResponse.json({ error: 'grades must be a positive integer' }, { status: 400 })
  }
  if (!isFinite(amountUsd) || amountUsd <= 0 || amountUsd > 100000) {
    return NextResponse.json({ error: 'amountUsd must be a positive number' }, { status: 400 })
  }
  const amountCents = Math.round(amountUsd * 100)

  try {
    const common = {
      success_url: `${SITE_URL}/account?enterprise=success`,
      cancel_url: `${SITE_URL}/account?enterprise=cancelled`,
      ...(org.stripe_customer_id ? { customer: org.stripe_customer_id } : {}),
      ...orgTaxParams(Boolean(org.stripe_customer_id)),
    }

    let session
    if (kind === 'plan') {
      session = await stripe.checkout.sessions.create({
        ...common,
        mode: 'subscription',
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            recurring: { interval: 'month' },
            product_data: {
              name: `DCM Enterprise — ${org.name} (${planName}: ${grades} grades/month)`,
            },
            ...priceDataTaxBehavior(),
          },
        }],
        metadata: {
          dcm_type: 'org_plan',
          orgId: org.id,
          plan: planName,
          grades: String(grades),
        },
        subscription_data: {
          metadata: {
            dcm_type: 'org_plan',
            orgId: org.id,
            plan: planName,
            grades: String(grades),
          },
        },
      })
    } else {
      session = await stripe.checkout.sessions.create({
        ...common,
        mode: 'payment',
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: `DCM Enterprise — ${org.name} overage pack (${grades} grades, rolls over)`,
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
    }

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (err: any) {
    console.error('[org checkout-link] Stripe error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to create checkout link' }, { status: 500 })
  }
}
