/**
 * Find (and optionally reprice) cards whose stored dcm_price_estimate was made
 * by the old TCG estimator bugs fixed Sept 28 (src/lib/pricing/gradedValueEstimate.ts):
 *   - raw × 3 for a grade below 9 with no matching graded comp (overvalued), and
 *   - a negative graded premium (grade 9/10 valued below raw).
 * DRY RUN BY DEFAULT. Run AFTER the estimator fix is deployed.
 *
 *   npx tsx scripts/_tmp-find-overvalued-fallback.ts                 # report only
 *   npx tsx scripts/_tmp-find-overvalued-fallback.ts --apply         # reprice changed cards
 *   npx tsx scripts/_tmp-find-overvalued-fallback.ts --limit=500     # stop after N cards scanned
 *
 * No API calls: the new estimate is recomputed from the card's own cached
 * PriceCharting payload (dcm_cached_prices.prices). A card is only considered
 * when that cache demonstrably produced the stored estimate (cached
 * estimatedValue equals dcm_price_estimate), so eBay-fallback or owner-entered
 * values are never touched. Writes are revision-guarded (guardedPriceUpdate).
 *
 * Safety: keyset pages of 100 by primary key, narrow columns only (never
 * ai_grading / conversational_* / label_data), a pause between pages, and the
 * run stops on the first database error (522s included).
 * Sports categories use a different estimator (dcmEstimate.ts) and are skipped.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { estimateGradedValue } from '../src/lib/pricing/gradedValueEstimate';
import { guardedPriceUpdate, readPriceRevisions } from '../src/lib/pricing/guardedPriceWrite';

const APPLY = process.argv.includes('--apply');
const LIMIT = Number(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? Infinity);
const PAGE = 100;
const PAUSE_MS = 400;
const CATEGORIES = ['Pokemon', 'MTG', 'Lorcana', 'One Piece', 'Other', 'Star Wars', 'Yu-Gi-Oh'];
const COLUMNS = 'id, category, serial, conversational_whole_grade, dcm_price_estimate, dcm_price_raw, dcm_cached_prices, identity_revision, pricing_selection_revision';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Hit { id: string; serial: string; category: string; grade: number; raw: number | null; old: number; next: number; reason: string; row: Record<string, any> }

function classify(prices: any, grade: number, old: number, next: number): string {
  const psa = prices?.psa ?? {};
  const matching = psa[String(Math.round(grade))] || (grade >= 9 ? psa['9.5'] : null);
  const raw = prices?.raw ?? null;
  if (!matching && grade < 9) return 'no-comp-below-9 (was raw x3)';
  if (!matching && grade >= 9) return 'no-comp-9+ (raw x3 capped by comps)';
  if (raw && old < raw && grade >= 9) return 'premium-below-raw';
  if (next < old) return 'monotonic-cap';
  return 'other';
}

async function main() {
  console.log(APPLY ? '*** APPLY MODE ***' : '(dry run — pass --apply to write)');
  const hits: Hit[] = [];
  let scanned = 0, eligible = 0, lastId: string | null = null;

  while (scanned < LIMIT) {
    let q = db.from('cards').select(COLUMNS)
      .in('category', CATEGORIES)
      .not('dcm_price_estimate', 'is', null)
      .is('deleted_at', null)
      .order('id', { ascending: true })
      .limit(PAGE);
    if (lastId) q = q.gt('id', lastId);
    const { data, error } = await q;
    if (error) { console.error('Stopping on database error:', error.message ?? error); break; }
    if (!data || data.length === 0) break;
    lastId = (data[data.length - 1] as any).id;

    for (const row of data as Record<string, any>[]) {
      scanned++;
      const cached = row.dcm_cached_prices;
      const prices = cached?.prices;
      const grade = Number(row.conversational_whole_grade);
      const old = Number(row.dcm_price_estimate);
      if (!prices || typeof prices.psa !== 'object' || !Number.isFinite(grade) || grade <= 0) continue;
      // Only cards whose stored estimate came from this cache.
      if (typeof cached.estimatedValue !== 'number' || Math.abs(cached.estimatedValue - old) > 0.01) continue;
      eligible++;
      const next = estimateGradedValue(prices, grade)?.value;
      if (next == null || Math.abs(next - old) <= 0.01) continue;
      hits.push({ id: row.id, serial: row.serial, category: row.category, grade, raw: prices.raw ?? null, old, next, reason: classify(prices, grade, old, next), row });
    }
    process.stdout.write(`\rscanned ${scanned}, eligible ${eligible}, would change ${hits.length}`);
    await sleep(PAUSE_MS);
  }
  console.log('\n');

  const byReason = new Map<string, { n: number; delta: number }>();
  for (const h of hits) {
    const r = byReason.get(h.reason) ?? { n: 0, delta: 0 };
    r.n++; r.delta += h.next - h.old; byReason.set(h.reason, r);
  }
  console.log('By reason:');
  for (const [reason, r] of byReason) console.log(`  ${reason.padEnd(38)} ${String(r.n).padStart(5)} cards, total change $${r.delta.toFixed(2)}`);
  console.log('\nLargest changes:');
  for (const h of [...hits].sort((x, y) => Math.abs(y.next - y.old) - Math.abs(x.next - x.old)).slice(0, 50)) {
    console.log(`  ${h.id} #${h.serial} ${h.category.padEnd(9)} g${h.grade} raw ${h.raw} : $${h.old} -> $${h.next}  [${h.reason}]`);
  }

  if (!APPLY) { console.log('\nDry run complete. Nothing written.'); return; }

  let written = 0, stale = 0;
  for (const h of hits) {
    const result = await guardedPriceUpdate(db, h.id, readPriceRevisions(h.row), {
      dcm_price_estimate: h.next,
      dcm_cached_prices: { ...h.row.dcm_cached_prices, estimatedValue: h.next },
    }, 'OvervaluedFallbackFix');
    if (result.status === 'error') { console.error(`Stopping: write failed for ${h.id}: ${result.error}`); break; }
    if (result.status === 'stale') stale++; else written++;
    if ((written + stale) % 50 === 0) await sleep(PAUSE_MS);
  }
  console.log(`\nRepriced ${written}, skipped ${stale} (identity or selection changed since read).`);
}

main().catch(e => { console.error(e); process.exit(1); });
