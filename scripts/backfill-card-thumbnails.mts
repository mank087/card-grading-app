/**
 * Backfill 480px thumbnails for cards graded before the grading pipeline began
 * writing them (src/lib/images/cardThumbnails.ts).
 *
 *   npx tsx scripts/backfill-card-thumbnails.mts --dry-run
 *   npx tsx scripts/backfill-card-thumbnails.mts --limit 300
 *   npx tsx scripts/backfill-card-thumbnails.mts --user <uuid> --since 2026-08-01
 *   npx tsx scripts/backfill-card-thumbnails.mts --offset 1300 --limit 500   (resume)
 *   npx tsx scripts/backfill-card-thumbnails.mts --before 2026-07-29T23:48:57Z --limit 3000   (keyset resume; deep --offset hit a statement timeout)
 *
 * PRODUCTION SAFETY (repo rule: never hammer the DB):
 *  - pages of 100 rows, only the 6 columns needed — never bulk-selects the
 *    heavy ai_grading JSON,
 *  - a hard per-invocation card cap (--limit, default 300) so one run can never
 *    pull unbounded egress,
 *  - 150 ms sleep between cards,
 *  - aborts on the first 5xx/522 from Supabase.
 *
 * Egress per card: one HEAD-ish list() on the folder, plus a download of each
 * original only when its thumbnail is missing.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

const { createClient } = await import('@supabase/supabase-js');
const { thumbPath, makeThumbnail } = await import('../src/lib/images/cardThumbnails');

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const DRY_RUN = argv.includes('--dry-run');
const LIMIT = Math.max(1, Number(flag('limit') ?? 300));
const USER = flag('user') || null;
const SINCE = flag('since') || null;
/** Keyset resume: only cards created BEFORE this ISO timestamp (avoids deep OFFSET statement timeouts). */
const BEFORE = flag('before') || null;
/** Skip the newest N eligible cards (resume a run that was interrupted). */
const START_OFFSET = Math.max(0, Number(flag('offset') ?? 0));
const PAGE_SIZE = 100;
const SLEEP_MS = 150;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const storage = supabase.storage.from('cards');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Any 5xx (Cloudflare 522 included) is a stop signal, not a retry signal. */
function isServerError(err: any): boolean {
  const status = Number(err?.status ?? err?.statusCode ?? err?.originalError?.status ?? 0);
  if (status >= 500) return true;
  return /\b(5\d\d|522)\b/.test(String(err?.message || ''));
}

const stats = {
  scanned: 0,
  alreadyHad: 0,
  created: 0,
  skipped: 0,
  bytesDown: 0,
  bytesUp: 0,
  errors: 0,
};

class FatalServerError extends Error {}

function folderOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i > 0 ? path.slice(0, i) : '';
}

async function listFolder(folder: string): Promise<Set<string>> {
  const { data, error } = await storage.list(folder, { limit: 100 });
  if (error) {
    if (isServerError(error)) throw new FatalServerError(`storage.list ${folder}: ${error.message}`);
    throw error;
  }
  return new Set((data || []).map((f: any) => f.name));
}

async function download(path: string): Promise<Buffer> {
  const { data, error } = await storage.download(path);
  if (error) {
    if (isServerError(error)) throw new FatalServerError(`download ${path}: ${error.message}`);
    throw error;
  }
  return Buffer.from(await (data as Blob).arrayBuffer());
}

async function processCard(card: { id: string; front_path: string | null; back_path: string | null }) {
  const paths = [card.front_path, card.back_path].filter(Boolean) as string[];
  if (paths.length === 0) { stats.skipped++; return; }

  const existing = await listFolder(folderOf(paths[0]));
  let madeAny = false;

  for (const path of paths) {
    const target = thumbPath(path);
    const name = target.slice(target.lastIndexOf('/') + 1);
    if (existing.has(name)) { stats.alreadyHad++; continue; }
    if (DRY_RUN) { console.log(`[dry-run] would create ${target}`); stats.created++; madeAny = true; continue; }

    const original = await download(path);
    stats.bytesDown += original.length;
    const thumb = await makeThumbnail(original);
    const { error } = await storage.upload(target, thumb, {
      upsert: true,
      contentType: 'image/jpeg',
      cacheControl: '31536000',
    });
    if (error) {
      if (isServerError(error)) throw new FatalServerError(`upload ${target}: ${error.message}`);
      throw error;
    }
    stats.bytesUp += thumb.length;
    stats.created++;
    madeAny = true;
  }
  if (madeAny) console.log(`  ${card.id}: thumbnails written`);
}

async function main() {
  console.log(
    `[backfill-thumbs] limit=${LIMIT} dryRun=${DRY_RUN}` +
    `${USER ? ` user=${USER}` : ''}${SINCE ? ` since=${SINCE}` : ''}`
  );

  let offset = START_OFFSET;
  let fatal: Error | null = null;

  outer: while (stats.scanned < LIMIT) {
    const take = Math.min(PAGE_SIZE, LIMIT - stats.scanned);
    let query = supabase
      .from('cards')
      .select('id, front_path, back_path, created_at')
      .is('deleted_at', null)
      .not('front_path', 'is', null)
      .eq('grade_status', 'complete')
      .order('created_at', { ascending: false })
      .range(offset, offset + take - 1);
    if (USER) query = query.eq('user_id', USER);
    if (SINCE) query = query.gte('created_at', SINCE);
    if (BEFORE) query = query.lt('created_at', BEFORE);

    const { data: rows, error } = await query;
    if (error) {
      if (isServerError(error)) { fatal = new FatalServerError(`select cards: ${error.message}`); break; }
      throw error;
    }
    if (!rows || rows.length === 0) break;
    offset += rows.length;

    for (const row of rows as any[]) {
      stats.scanned++;
      try {
        await processCard(row);
      } catch (err: any) {
        if (err instanceof FatalServerError) { fatal = err; break outer; }
        stats.errors++;
        console.warn(`  ${row.id}: ${err?.message}`);
      }
      await sleep(SLEEP_MS);
    }
  }

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;
  console.log('\n[backfill-thumbs] summary');
  console.log(`  cards scanned      : ${stats.scanned}`);
  console.log(`  thumbs created     : ${stats.created}${DRY_RUN ? ' (dry run — nothing written)' : ''}`);
  console.log(`  thumbs already set : ${stats.alreadyHad}`);
  console.log(`  cards skipped      : ${stats.skipped}`);
  console.log(`  bytes downloaded   : ${mb(stats.bytesDown)}`);
  console.log(`  bytes uploaded     : ${mb(stats.bytesUp)}`);
  console.log(`  errors             : ${stats.errors}`);
  if (fatal) {
    console.error(`\n[backfill-thumbs] ABORTED on a Supabase server error: ${fatal.message}`);
    console.error('Wait for the platform to recover before re-running.');
    process.exit(2);
  }
}

await main();
