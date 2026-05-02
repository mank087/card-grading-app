import Stripe from 'stripe';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// NOTE: .env.local currently contains a TEST mode Stripe key. To verify a
// production customer, paste the production STRIPE_SECRET_KEY into the env
// (or pass it inline) before running. The script will surface a clear
// "No such customer" error if the key/environment mismatch.

const SECRET = process.env.STRIPE_SECRET_KEY;
if (!SECRET) { console.error('Missing STRIPE_SECRET_KEY in env'); process.exit(1); }

const stripe = new Stripe(SECRET, { apiVersion: '2024-06-20' as any });

const CUSTOMER_ID = 'cus_U3bF8d6elZfPpE';
const SUBSCRIPTION_ID = 'sub_1THOj4HgM2Rh4o2BDHhdroBm';

async function main() {
  console.log(`Stripe key mode: ${SECRET!.startsWith('sk_test_') ? 'TEST' : 'LIVE'}`);
  console.log(`Looking up customer: ${CUSTOMER_ID}`);
  console.log(`Looking up subscription: ${SUBSCRIPTION_ID}`);
  console.log('');

  // 1. Customer
  try {
    const customer = await stripe.customers.retrieve(CUSTOMER_ID);
    if ('deleted' in customer && customer.deleted) {
      console.log('Customer is DELETED');
    } else {
      const c = customer as Stripe.Customer;
      console.log('=== CUSTOMER ===');
      console.log(`  email: ${c.email}`);
      console.log(`  created: ${new Date(c.created * 1000).toISOString()}`);
      console.log(`  default payment method: ${c.invoice_settings?.default_payment_method ?? '(none)'}`);
      console.log(`  delinquent: ${c.delinquent}`);
    }
  } catch (err: any) {
    console.error('Customer lookup failed:', err.message);
    if (err.code === 'resource_missing') {
      console.error('\n>> The customer does not exist in this Stripe environment.');
      console.error('>> .env.local likely has the WRONG mode (test vs live). Swap');
      console.error('>> in the production STRIPE_SECRET_KEY (sk_live_...) and re-run.');
    }
    return;
  }

  // 2. Subscription
  console.log('\n=== SUBSCRIPTION ===');
  try {
    const sub = await stripe.subscriptions.retrieve(SUBSCRIPTION_ID, {
      expand: ['latest_invoice.charge', 'latest_invoice.payment_intent', 'items.data.price'],
    });
    console.log(`  status: ${sub.status}`);
    console.log(`  current period: ${new Date(sub.current_period_start * 1000).toISOString()} → ${new Date(sub.current_period_end * 1000).toISOString()}`);
    console.log(`  cancel at period end: ${sub.cancel_at_period_end}`);
    const item = sub.items.data[0];
    if (item) {
      console.log(`  price: ${item.price.id} (${(item.price.unit_amount ?? 0) / 100} ${item.price.currency})`);
      console.log(`  recurring: every ${item.price.recurring?.interval_count} ${item.price.recurring?.interval}`);
    }
    const latest = sub.latest_invoice as Stripe.Invoice | string | null;
    if (latest && typeof latest !== 'string') {
      console.log('\n  --- latest invoice ---');
      console.log(`  invoice id: ${latest.id}`);
      console.log(`  status: ${latest.status}`);
      console.log(`  paid: ${latest.paid}`);
      console.log(`  amount_paid: ${(latest.amount_paid ?? 0) / 100} ${latest.currency}`);
      console.log(`  created: ${new Date(latest.created * 1000).toISOString()}`);
      console.log(`  status_transitions.paid_at: ${latest.status_transitions?.paid_at ? new Date(latest.status_transitions.paid_at * 1000).toISOString() : '(unset)'}`);
      console.log(`  hosted_invoice_url: ${latest.hosted_invoice_url}`);
    }
  } catch (err: any) {
    console.error('Subscription lookup failed:', err.message);
  }

  // 3. Invoices for this subscription (last 12)
  console.log('\n=== INVOICES (last 12 for this subscription) ===');
  try {
    const invoices = await stripe.invoices.list({
      subscription: SUBSCRIPTION_ID,
      limit: 12,
    });
    if (invoices.data.length === 0) {
      console.log('(no invoices)');
    } else {
      invoices.data.forEach(inv => {
        const created = new Date(inv.created * 1000).toISOString();
        const paidAt = inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000).toISOString() : '(unpaid)';
        console.log(`  ${inv.id} | created: ${created} | paid_at: ${paidAt} | status: ${inv.status} | $${(inv.amount_paid ?? 0) / 100} | period: ${inv.period_start ? new Date(inv.period_start * 1000).toISOString().slice(0, 10) : ''} → ${inv.period_end ? new Date(inv.period_end * 1000).toISOString().slice(0, 10) : ''}`);
      });
    }
  } catch (err: any) {
    console.error('Invoice list failed:', err.message);
  }

  // 4. Webhook events for this customer (last 25 events of relevant types)
  console.log('\n=== RECENT EVENTS for customer (last 25) ===');
  try {
    const events = await stripe.events.list({
      type: 'invoice.paid',
      limit: 25,
    });
    const matches = events.data.filter(e => {
      const obj: any = e.data?.object;
      return obj?.customer === CUSTOMER_ID || obj?.subscription === SUBSCRIPTION_ID;
    });
    if (matches.length === 0) {
      console.log('(no matching invoice.paid events in last 25)');
    } else {
      matches.forEach(e => {
        const obj: any = e.data?.object;
        console.log(`  ${e.id} | ${e.type} | created: ${new Date(e.created * 1000).toISOString()} | invoice: ${obj?.id} | sub: ${obj?.subscription}`);
      });
    }
  } catch (err: any) {
    console.error('Events list failed:', err.message);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
