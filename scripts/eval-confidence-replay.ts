/**
 * Replay the v9.26 evidence rule over production grades. READ-ONLY, no model calls.
 *
 * The hold is pure server logic applied to stored evaluation scores, so its effect can be
 * recomputed exactly for the clear case: all three evaluations at 10, held at 9 only by the
 * confidence letter. Cards with a 2-of-3 majority depend on the dissent-evidence gate, which
 * needs data the row does not keep, so they are reported as "possible", never counted.
 *
 * Usage: npx tsx scripts/eval-confidence-replay.ts [days=14]
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '../../.env.local' });
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'fs';
import { clippedCorners } from '../src/lib/grading/frameClipping';
import { holderPresent, letterUncertainty } from '../src/lib/grading/evidenceHold';

const DAYS = Number(process.argv[2] || 14);
const OUT = '../../grading-work/confidence-review/';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const QUALITY_WORDS = /soft|blur|focus|glare|reflect|lighting|shadow|resolution|grain/i;
const PATH: Record<string, string> = { Pokemon: 'pokemon', MTG: 'mtg', Lorcana: 'lorcana', 'One Piece': 'onepiece', 'Yu-Gi-Oh': 'yugioh', Other: 'other', 'Star Wars': 'starwars' };

(async () => {
  mkdirSync(OUT, { recursive: true });
  const light: any[] = [];
  for (let day = 0; day < DAYS; day++) {
    const to = new Date(Date.now() - day * 86400e3).toISOString(), from = new Date(Date.now() - (day + 1) * 86400e3).toISOString();
    const { data, error } = await db.from('cards')
      .select('id, category, conversational_whole_grade, conversational_image_confidence, fq:capture_quality->front->quad, bq:capture_quality->back->quad, zs:capture_quality->zoom_inspection_status, zc:capture_quality->zoom_coverage')
      .gte('created_at', from).lt('created_at', to).not('conversational_image_confidence', 'is', null).limit(1000);
    if (error) { console.error(`day -${day}: ${error.message}`); break; }
    light.push(...(data || []));
  }
  const graded = light.filter(r => r.conversational_whole_grade > 0);
  const tensNow = graded.filter(r => r.conversational_whole_grade === 10).length;
  const candidates = graded.filter(r => r.conversational_whole_grade === 9 && /^[CD]$/i.test(r.conversational_image_confidence));
  console.log(`graded cards: ${graded.length} | 10s today: ${tensNow} (${(100 * tensNow / graded.length).toFixed(1)}%) | C/D cards held at exactly 9: ${candidates.length}`);

  const byId = new Map(candidates.map(r => [r.id, r]));
  const flips: any[] = [], possible: any[] = []; const stay: Record<string, number> = {};
  const bump = (k: string) => { stay[k] = (stay[k] || 0) + 1; };
  const ids = [...byId.keys()];
  for (let i = 0; i < ids.length; i += 15) {
    const { data, error } = await db.from('cards').select('id, conversational_grading').in('id', ids.slice(i, i + 15));
    if (error) { console.error(error.message); break; }
    for (const row of data || []) {
      let j: any; try { j = JSON.parse(row.conversational_grading as any); } catch { bump('unparseable'); continue; }
      const c = byId.get(row.id)!;
      const gp = j.grading_passes || {}, iq = j.image_quality || {};
      const finals = ['pass_1', 'pass_2', 'pass_3'].map(k => Number(gp[k]?.final ?? gp[k]?.final_grade));
      const tens = finals.filter(f => f === 10).length;
      if (tens < 2) { bump('evaluations scored it 9 or lower'); continue; }
      const spread = Math.max(...finals) - Math.min(...finals);
      const clippedNow = [...clippedCorners(c.fq, 'front'), ...clippedCorners(c.bq, 'back')];
      const wasClipFlagged = Array.isArray(iq.out_of_frame) && iq.out_of_frame.length > 0;
      // A clip flag overwrote the model's own letter. If the new rule releases the clip, fall back to
      // what the model's notes imply: quality complaints mean it was C on its own merits, else B.
      const ownNotes = String(iq.notes || '').replace(/Part of the card is outside the photo[^.]*\./, '');
      let letter = String(c.conversational_image_confidence).toUpperCase();
      if (wasClipFlagged && clippedNow.length === 0) letter = QUALITY_WORDS.test(ownNotes) ? 'C' : 'B';
      const caseType = j.case_detection?.case_type ?? null;
      const zoomComplete = c.zs === 'complete' && !!c.zc && c.zc.incompleteBatches === 0 && c.zc.inspected >= c.zc.expected;
      const structural = j.structural_damage?.detected === true || j.structural_damage?.flagged === true;
      if (clippedNow.length) { bump('corner still out of frame'); continue; }
      if (holderPresent(caseType)) { bump('in a sleeve or holder (policy unchanged)'); continue; }
      if (letter === 'D') { bump('confidence D'); continue; }
      if (!zoomComplete) { bump('magnified inspection not recorded complete'); continue; }
      if (structural) { bump('possible damage flagged'); continue; }
      if (spread >= 2) { bump('evaluations 2+ apart'); continue; }
      if (letterUncertainty({ letter, zoomComplete, clippedCorners: clippedNow, caseType }).value >= 2) { bump('letter still holds'); continue; }
      const item = { id: row.id, category: c.category, url: `https://dcmgrading.com/${PATH[c.category] || 'sports'}/${row.id}`, finals, released_clip: wasClipFlagged, notes: ownNotes.trim().slice(0, 220) };
      (tens === 3 ? flips : possible).push(item);
    }
  }
  console.log(`\nWOULD MOVE 9 -> 10 (all three evaluations at 10): ${flips.length}`);
  console.log(`  of which had been flagged as clipped under the old rule: ${flips.filter(f => f.released_clip).length}`);
  console.log(`possible, 2 of 3 at 10 (depends on the dissent gate, NOT counted): ${possible.length}`);
  console.log('stay at 9 because:'); Object.entries(stay).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));
  const after = tensNow + flips.length;
  console.log(`\n10-rate: ${(100 * tensNow / graded.length).toFixed(1)}% today -> ${(100 * after / graded.length).toFixed(1)}% (upper bound with every "possible": ${(100 * (after + possible.length) / graded.length).toFixed(1)}%)`);
  const cats: Record<string, number> = {}; for (const f of flips) cats[f.category] = (cats[f.category] || 0) + 1;
  console.log('movers by category:', JSON.stringify(cats));
  writeFileSync(OUT + 'replay-flips.json', JSON.stringify({ days: DAYS, graded: graded.length, tensNow, flips, possible, stay }, null, 1));
})().catch(e => { console.error(e.message); process.exit(1); });
