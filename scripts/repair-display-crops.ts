/**
 * Repair display copies that are not card-shaped (Oct 12 2026).
 *
 * dc-1 display crops (src/lib/images/displayCrop.ts, live since Oct 5 2026)
 * trusted the capture gate's card outline with a loose shape check (0.60-0.84).
 * That outline is a vision-model estimate and often stops short of the card's
 * bottom edge, so ~1 in 5 display copies came out 0.78-0.90 wide and cut off
 * the bottom of the card on every surface. dc-2 refuses those outlines.
 *
 * This finds stored display copies whose own shape fails the dc-2 rule
 * (isCardShaped on capture_quality.display.<face>.width/height) and, with
 * APPLY=1, CLEARS that face's display entry so every surface falls back to the
 * original photo. It does not regenerate: the stored outline is the thing that
 * was wrong, and dc-2 would refuse every one of these outlines anyway (replay of
 * 40 random faces Oct 12: all 12 off-shape faces -> not_card_shaped). The old
 * file is left in storage; the entry keeps its path as `was_path` for audit.
 *
 * Reads only light columns, 200 rows a page. Writes (APPLY=1 only) one card at
 * a time, and only if that face still points at the same bad copy.
 *
 *   npx tsx --env-file=.env.local scripts/repair-display-crops.ts            # dry run
 *   APPLY=1 npx tsx --env-file=.env.local scripts/repair-display-crops.ts    # clear them
 *   SINCE=2026-10-05 (default)
 */
import { createClient } from '@supabase/supabase-js';
import { isCardShaped } from '../src/lib/images/displayCrop';

const APPLY = process.env.APPLY === '1';
const SINCE = process.env.SINCE || '2026-10-05';
const PAGE = 200;

type Face = 'front' | 'back';
interface Bad { id: string; serial: string | null; created_at: string; face: Face; path: string; width: number; height: number; aspect: number }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  console.log(`[repair-display-crops] ${APPLY ? 'APPLY' : 'DRY RUN'} — cards created since ${SINCE}`);
  const bad: Bad[] = [];
  let cards = 0, withDisplay = 0, faces = 0;
  let lastId: string | null = null;
  // Keyset pagination on id (stable while rows are being added).
  for (;;) {
    let q = sb.from('cards')
      .select('id, serial, created_at, display:capture_quality->display')
      .gte('created_at', SINCE)
      .order('id', { ascending: true })
      .limit(PAGE);
    if (lastId) q = q.gt('id', lastId);
    const { data, error } = await q;
    if (error) throw new Error(`select failed: ${error.message}`);
    const rows = (data ?? []) as any[];
    for (const r of rows) {
      cards++;
      const display = typeof r.display === 'string' ? JSON.parse(r.display) : r.display;
      if (!display) continue;
      withDisplay++;
      for (const face of ['front', 'back'] as const) {
        const d = display[face];
        if (!d || typeof d.path !== 'string' || !d.path) continue;
        faces++;
        const w = Number(d.width), h = Number(d.height);
        if (isCardShaped(w, h)) continue;
        bad.push({ id: r.id, serial: r.serial ?? null, created_at: r.created_at, face, path: d.path, width: w, height: h,
          aspect: w > 0 && h > 0 ? +(Math.min(w, h) / Math.max(w, h)).toFixed(3) : NaN });
      }
    }
    if (rows.length < PAGE) break;
    lastId = rows[rows.length - 1].id;
  }

  const badCards = new Set(bad.map(b => b.id));
  console.log(`cards scanned: ${cards}; with a display record: ${withDisplay}; display faces: ${faces}`);
  console.log(`faces failing the card-shape check: ${bad.length} (${faces ? ((100 * bad.length) / faces).toFixed(1) : 0}%) on ${badCards.size} cards`);
  const buckets: Record<string, number> = {};
  for (const b of bad) {
    const k = b.aspect < 0.66 ? '<0.66 (too narrow)' : b.aspect < 0.80 ? '0.77-0.80' : b.aspect < 0.85 ? '0.80-0.85' : '>=0.85';
    buckets[k] = (buckets[k] || 0) + 1;
  }
  console.log('by shape (short/long side):', buckets);
  console.log('sample:');
  for (const b of bad.slice(0, 25)) {
    console.log(`  ${b.id} serial=${b.serial} ${b.face} ${b.width}x${b.height} aspect=${b.aspect} created=${b.created_at.slice(0, 10)}`);
  }

  if (!APPLY) {
    console.log('dry run: nothing written. Re-run with APPLY=1 to clear these faces (originals will be shown).');
    return;
  }

  let cleared = 0, changed = 0, failed = 0;
  for (const b of bad) {
    // Read this one card's capture_quality fresh, and write only if the face
    // still points at the copy we judged (a regrade may have replaced it).
    const { data, error } = await sb.from('cards').select('capture_quality').eq('id', b.id).single();
    if (error || !data) { failed++; console.warn(`  read failed ${b.id}: ${error?.message}`); continue; }
    const cq = typeof data.capture_quality === 'string' ? JSON.parse(data.capture_quality) : data.capture_quality;
    const entry = cq?.display?.[b.face];
    if (!entry || entry.path !== b.path) { changed++; continue; }
    cq.display[b.face] = { skipped: 'repair_not_card_shaped', was_path: b.path, was_size: `${b.width}x${b.height}`, repaired_at: new Date().toISOString() };
    const { error: upErr, count } = await sb.from('cards')
      .update({ capture_quality: cq }, { count: 'exact' })
      .eq('id', b.id)
      .eq(`capture_quality->display->${b.face}->>path`, b.path);
    if (upErr) { failed++; console.warn(`  update failed ${b.id} ${b.face}: ${upErr.message}`); continue; }
    if (!count) { changed++; continue; }
    cleared++;
    await new Promise(r => setTimeout(r, 50));
  }
  console.log(`cleared: ${cleared}; skipped (changed since scan): ${changed}; failed: ${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
