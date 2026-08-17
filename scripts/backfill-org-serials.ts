/**
 * Assign org serials to a single org's existing cards (random 6-digit,
 * per-org-unique — e.g. MAN442921 — matching the live grade-path scheme).
 *
 * Usage:
 *   npx tsx scripts/backfill-org-serials.ts <org-slug>            # dry run
 *   npx tsx scripts/backfill-org-serials.ts <org-slug> --apply
 *
 * Safe by design: scoped to one org, light columns only, skips cards that
 * already have an org_serial, and uses the same collision-retrying helper
 * as the live grade path (the unique index arbitrates races).
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Dynamic import: the lib reads env at module load, so it must come after dotenv.
  const { assignOrgSerial, orgSerialPrefix } = await import('../src/lib/organizations');

  const slug = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!slug) { console.error('Usage: npx tsx scripts/backfill-org-serials.ts <org-slug> [--apply]'); process.exit(1); }

  const { data: org, error: orgErr } = await s.from('organizations')
    .select('id, name, slug, serial_prefix').eq('slug', slug).maybeSingle();
  if (orgErr || !org) { console.error('Org not found:', orgErr?.message ?? slug); process.exit(1); }
  console.log(`Org: ${org.name} (${org.id}) — prefix ${orgSerialPrefix(org)}`);

  // Page through ALL of the org's cards in small batches (light columns only;
  // small batches are required — see feedback_production_db_safety). Range
  // pagination is stable here: assigning serials never changes created_at
  // ordering, so pages don't shift under us.
  const BATCH = 500;
  let offset = 0;
  let total = 0;
  let missing = 0;
  for (;;) {
    const { data: cards, error: cardsErr } = await s.from('cards')
      .select('id, serial, org_serial, created_at')
      .eq('org_id', org.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }) // tiebreak so equal timestamps page deterministically
      .range(offset, offset + BATCH - 1);
    if (cardsErr) { console.error('Cards query failed:', cardsErr.message); process.exit(1); }
    const page = cards ?? [];
    if (page.length === 0) break;

    total += page.length;
    const todo = page.filter(c => c.org_serial === null);
    missing += todo.length;

    for (const c of todo) {
      if (!apply) { console.log(`[dry] would assign a random serial to ${c.id} (DCM ${c.serial})`); continue; }
      const display = await assignOrgSerial(c.id, org);
      if (!display) { console.error(`Assignment failed for ${c.id} — stopping.`); process.exit(1); }
      console.log(`${c.id}: ${display} (DCM ${c.serial})`);
    }

    if (page.length < BATCH) break;
    offset += BATCH;
  }
  console.log(`${total} org cards, ${missing} missing an org serial.`);
  console.log(apply ? 'Done.' : 'Dry run complete — re-run with --apply to write.');
}
main();
