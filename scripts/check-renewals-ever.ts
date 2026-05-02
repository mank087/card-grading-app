import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  console.log('=== ALL "renewed" event_type subscription_events EVER ===');
  const { data, error } = await supabase
    .from('subscription_events')
    .select('*')
    .eq('event_type', 'renewed')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) console.error(error);
  else if (!data?.length) console.log('NONE — handleInvoicePaid renewal path has NEVER successfully fired.');
  else data.forEach((e: any) => {
    console.log(`  ${e.created_at} | user: ${e.user_id} | plan: ${e.plan} | credits: ${e.credits_added} | bonus: ${e.bonus_credits} | sub: ${e.stripe_subscription_id} | invoice: ${e.stripe_invoice_id}`);
  });

  console.log('\n=== ALL distinct event_type values in subscription_events ===');
  const { data: types } = await supabase
    .from('subscription_events')
    .select('event_type')
    .limit(500);
  const counts = new Map<string, number>();
  types?.forEach((t: any) => counts.set(t.event_type, (counts.get(t.event_type) ?? 0) + 1));
  counts.forEach((n, t) => console.log(`  ${t}: ${n}`));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
