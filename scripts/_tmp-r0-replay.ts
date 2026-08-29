/**
 * Replay R0 through the REAL policy against every card graded since v9.21
 * that carries an unmeasured face. Read-only, bounded batches.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { applyCenteringPolicy, layoutFromCardType, ratioDeviation } from '../src/lib/grading/centeringPolicy';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const isXX = (s: any) => typeof s === 'string' && /x/i.test(s);

(async () => {
  const light: any[] = [];
  for (let f = 0; f < 1200; f += 100) {
    const { data, error } = await sb.from('cards')
      .select('id, card_name, conversational_centering_ratios, conversational_sub_scores, conversational_whole_grade, conversational_image_confidence, conversational_card_info')
      .gte('created_at', '2026-08-28T16:00:00Z').not('conversational_sub_scores', 'is', null)
      .order('created_at', { ascending: true }).range(f, f + 99);
    if (error) { console.error('stopping:', error.message); break; }
    const b = data || []; light.push(...b); if (b.length < 100) break;
  }
  const targets = light.filter(r => {
    const c = r.conversational_centering_ratios || {};
    return [c.front_lr, c.front_tb, c.back_lr, c.back_tb].some(isXX);
  });

  let facesRaised = 0, cardsMoved = 0;
  const moves: string[] = [];
  for (let i = 0; i < targets.length; i += 10) {
    const ids = targets.slice(i, i + 10).map(r => r.id);
    const { data, error } = await sb.from('cards').select('id, conversational_grading, cv_centering').in('id', ids);
    if (error) { console.error('stopping:', error.message); break; }
    for (const row of data || []) {
      let g: any = (row as any).conversational_grading;
      if (typeof g === 'string') { try { g = JSON.parse(g); } catch { continue; } }
      const meta = targets.find(t => t.id === row.id)!;
      const gp = g?.grading_passes || {};
      const passes = ['pass_1', 'pass_2', 'pass_3'].map(k => gp[k]).filter(Boolean);
      const passDevs = passes.map((p: any) => p?.centering_dev).filter((n: any): n is number => typeof n === 'number');
      const passScores = passes.map((p: any) => p?.centering).filter((n: any): n is number => typeof n === 'number');
      const year = Number(String(meta.conversational_card_info?.year ?? '').slice(0, 4)) || null;

      const faceFinal: number[] = [];
      const notes: string[] = [];
      for (const face of ['front', 'back'] as const) {
        const sec = g?.centering?.[face];
        if (!sec || typeof sec.score !== 'number') continue;
        const dLR = ratioDeviation(sec.left_right), dTB = ratioDeviation(sec.top_bottom);
        const worst = (dTB !== null && (dLR === null || dTB > dLR)) ? sec.top_bottom : sec.left_right;
        const m = (row as any).cv_centering?.[face];
        const res = applyCenteringPolicy({
          face, proposedScore: sec.score, ratio: worst ?? null, passDevs,
          layout: layoutFromCardType(sec.card_type), passScores,
          cv: m ? { dev: m.worstAxisPct != null ? Math.abs(m.worstAxisPct - 50) : null, bothAxes: !!m.bothAxes } : null,
          imageConfidence: meta.conversational_image_confidence, year,
        });
        // R0 only — the capping rules stay in shadow.
        const applied = res.firedRules.includes('R0') ? res.score : sec.score;
        if (res.raised) { facesRaised++; notes.push(`${face} ${sec.score}->10 (${sec.card_type})`); }
        faceFinal.push(applied);
      }
      if (!faceFinal.length) continue;
      const others = [meta.conversational_sub_scores?.corners?.weighted, meta.conversational_sub_scores?.edges?.weighted, meta.conversational_sub_scores?.surface?.weighted]
        .filter((n): n is number => typeof n === 'number');
      if (!others.length) continue;
      const then = Math.min(...others, Math.min(...faceFinal));
      if (then !== meta.conversational_whole_grade) {
        cardsMoved++;
        moves.push(`  ${String(meta.card_name).slice(0, 24).padEnd(24)} ${meta.conversational_whole_grade} -> ${then}   ${notes.join('; ')}`);
      }
    }
  }
  console.log(`cards examined: ${targets.length}`);
  console.log(`faces raised by R0: ${facesRaised}`);
  console.log(`overall grades moved: ${cardsMoved}`);
  moves.forEach(m => console.log(m));
})();
