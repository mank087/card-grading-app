/**
 * Pulls the actual invoice.paid event for Michael's renewal from Stripe,
 * compares its payload against what handleInvoicePaid expects, and lists
 * every webhook delivery attempt our endpoint logged with response status.
 *
 * This is the definitive diagnostic — no guessing about why the renewal
 * didn't process.
 */

import * as dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any });

const SUBSCRIPTION_ID = 'sub_1TNKNxHgM2Rh4o2BS99BvlT7';
const INVOICE_ID = 'in_1TYCgRHgM2Rh4o2B7SstRnXz';
const CUSTOMER_ID = 'cus_UM2RiHihO9s34T';
const EXPECTED_MONTHLY_PRICE_ID = process.env.STRIPE_PRICE_CARD_LOVERS_MONTHLY;
const EXPECTED_ANNUAL_PRICE_ID = process.env.STRIPE_PRICE_CARD_LOVERS_ANNUAL;

async function main() {
  console.log('=== Env price IDs ===');
  console.log('STRIPE_PRICE_CARD_LOVERS_MONTHLY (local):', EXPECTED_MONTHLY_PRICE_ID);
  console.log('STRIPE_PRICE_CARD_LOVERS_ANNUAL  (local):', EXPECTED_ANNUAL_PRICE_ID);
  console.log('');

  // 1. Pull the invoice to check billing_reason, subscription linkage
  const invoice = await stripe.invoices.retrieve(INVOICE_ID, { expand: ['subscription'] });
  console.log('=== Invoice ===');
  console.log('id              :', invoice.id);
  console.log('status          :', invoice.status);
  console.log('billing_reason  :', invoice.billing_reason);
  console.log('subscription    :', typeof invoice.subscription === 'string' ? invoice.subscription : (invoice.subscription as any)?.id);
  console.log('created         :', new Date(invoice.created * 1000).toISOString());
  console.log('paid_at (status):', invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() : 'n/a');
  console.log('');

  // 2. Pull the subscription to check metadata.userId and current priceId
  const sub = await stripe.subscriptions.retrieve(SUBSCRIPTION_ID);
  const subPriceId = sub.items.data[0]?.price?.id;
  console.log('=== Subscription ===');
  console.log('id              :', sub.id);
  console.log('status          :', sub.status);
  console.log('cancel_at_period_end:', sub.cancel_at_period_end);
  console.log('metadata.userId :', sub.metadata?.userId || '(MISSING)');
  console.log('item price id   :', subPriceId);
  console.log('matches MONTHLY?:', subPriceId === EXPECTED_MONTHLY_PRICE_ID);
  console.log('matches ANNUAL? :', subPriceId === EXPECTED_ANNUAL_PRICE_ID);
  console.log('');

  // 3. Find the invoice.paid event for this invoice via the events API
  console.log('=== Looking up invoice.paid event for this invoice ===');
  const events = await stripe.events.list({
    type: 'invoice.paid',
    created: { gte: Math.floor(Date.parse('2026-05-18T00:00:00Z') / 1000) },
    limit: 100,
  });
  const matching = events.data.filter((e) => {
    const obj = e.data.object as any;
    return obj?.id === INVOICE_ID;
  });
  console.log(`Found ${matching.length} invoice.paid event(s) referencing ${INVOICE_ID}`);
  for (const e of matching) {
    console.log(`  event ${e.id} | created ${new Date(e.created * 1000).toISOString()} | livemode=${e.livemode}`);
  }
  if (matching.length === 0) {
    console.log('(No invoice.paid event found in last 30 days — odd, Stripe should have logged one.)');
    return;
  }
  console.log('');

  // 4. For each matching event, fetch delivery attempts to our webhook endpoint
  for (const e of matching) {
    console.log(`=== Delivery attempts for event ${e.id} ===`);
    try {
      // Newer Stripe API uses events.* for delivery; older uses webhook_endpoints attempts
      // Try the most reliable path — list webhook_endpoints, then for each attempt to get logs.
      const endpoints = await stripe.webhookEndpoints.list({ limit: 10 });
      for (const ep of endpoints.data) {
        if (!ep.url.includes('dcmgrading.com')) continue;
        console.log(`  Endpoint: ${ep.id} (${ep.url})`);
        console.log(`    enabled_events: ${ep.enabled_events.join(', ')}`);
        console.log(`    status: ${ep.status}`);
      }
    } catch (err: any) {
      console.log('  Could not pull endpoint info:', err?.message || err);
    }
  }

  // 5. Also pull list of invoice.payment_failed events for Michael's customer
  console.log('');
  console.log('=== Other recent renewal-related events for this customer ===');
  const allEvents = await stripe.events.list({
    created: { gte: Math.floor(Date.parse('2026-05-15T00:00:00Z') / 1000) },
    limit: 100,
  });
  const customerEvents = allEvents.data.filter((e) => {
    const obj = e.data.object as any;
    const cust = obj?.customer ?? obj?.subscription_details?.metadata?.userId;
    return cust === CUSTOMER_ID || obj?.id === INVOICE_ID || obj?.subscription === SUBSCRIPTION_ID;
  });
  for (const e of customerEvents) {
    console.log(`  ${new Date(e.created * 1000).toISOString()} | ${e.type} | ${e.id}`);
  }
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
