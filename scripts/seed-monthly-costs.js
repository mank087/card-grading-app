require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Seed initial fixed-cost rows on the /admin/costs dashboard. Amounts are
 * BEST-GUESS defaults — review each on the dashboard and update with your
 * actual monthly bill from each vendor.
 *
 * Idempotent: skips a vendor if a recurring row for it already exists with
 * effective_to NULL (active). Safe to re-run.
 */

// effective_from = first day of the current month so it counts toward THIS
// month's fixed-cost total, not just future months.
const today = new Date();
const FROM = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-01`;

const SEEDS = [
  {
    vendor: 'Vercel',
    category: 'hosting',
    amount_usd: 20.00, // Pro plan default; update if Enterprise
    cost_type: 'recurring',
    effective_from: FROM,
    notes: 'Default Pro plan. Update with actual monthly bill — Vercel charges usage on top of the base.',
  },
  {
    vendor: 'Supabase',
    category: 'database',
    amount_usd: 25.00, // Pro plan base
    cost_type: 'recurring',
    effective_from: FROM,
    notes: 'Pro plan base. Add usage-based add-ons (compute, storage, egress) if applicable.',
  },
  {
    vendor: 'Expo (EAS)',
    category: 'dev_tools',
    amount_usd: 99.00, // Production plan with EAS Build credits
    cost_type: 'recurring',
    effective_from: FROM,
    notes: 'Production plan with EAS Build credits. Update if you are on a different tier.',
  },
  {
    vendor: 'Resend',
    category: 'email',
    amount_usd: 20.00, // Pro plan
    cost_type: 'recurring',
    effective_from: FROM,
    notes: 'Pro plan default — update with your actual tier.',
  },
];

async function main() {
  for (const seed of SEEDS) {
    const { data: existing } = await supabase
      .from('monthly_costs')
      .select('id, vendor, amount_usd, effective_from')
      .eq('vendor', seed.vendor)
      .eq('cost_type', 'recurring')
      .is('effective_to', null)
      .maybeSingle();

    if (existing) {
      console.log(`  ✓ skip ${seed.vendor.padEnd(14)} — active row already exists ($${existing.amount_usd}, from ${existing.effective_from})`);
      continue;
    }

    const { error } = await supabase.from('monthly_costs').insert(seed);
    if (error) {
      console.error(`  ✗ ${seed.vendor}: ${error.message}`);
    } else {
      console.log(`  + ${seed.vendor.padEnd(14)} — $${seed.amount_usd.toFixed(2)}/mo, category=${seed.category}, from ${seed.effective_from}`);
    }
  }

  // Show final active set
  const { data: active } = await supabase
    .from('monthly_costs')
    .select('vendor, category, amount_usd, effective_from')
    .is('effective_to', null)
    .order('vendor');
  const total = (active || []).reduce((s, r) => s + Number(r.amount_usd), 0);
  console.log('');
  console.log('Current active fixed costs:');
  (active || []).forEach((r) => console.log(`  ${r.vendor.padEnd(14)} ${r.category.padEnd(12)} $${Number(r.amount_usd).toFixed(2)}`));
  console.log(`  ${'TOTAL'.padEnd(14)} ${''.padEnd(12)} $${total.toFixed(2)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
