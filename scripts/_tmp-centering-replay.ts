/**
 * Replay the v9.21 centering policy against the customer's stored grades and
 * report the OVERALL grade impact — weakest link means a centering cap only
 * moves the card when centering is the limiting subgrade.
 * Read-only. Bounded batches on the heavy grading JSON.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { applyCenteringPolicy, layoutFromCardType, ratioDeviation } from '../src/lib/grading/centeringPolicy';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** The customer's own words about what he expects. */
const EXPECTED: Record<string, string> = {
  'Lawrence Taylor': 'same grade is fine',
  'Dave Duerson':    'surface fix right; vintage 10 off B photos is aggressive',
  'Dick Butkus':     'centering clearly off, esp. back',
  'Don Maynard':     'centering 10 is wrong',
  'Alex Karras':     'centering 10 is wrong, front AND back',
};

(async () => {
  const { data: u } = await sb.from('users').select('id').eq('email', 'johnruss78@verizon.net').maybeSingle();
  const uid = (u as any)?.id;
  const rows: any[] = [];
  for (let f = 0; f < 40; f += 10) {
    const { data, error } = await sb.from('cards')
      .select('id, created_at, card_name, conversational_whole_grade, conversational_sub_scores, conversational_image_confidence, conversational_grading, cv_centering, conversational_card_info')
      .eq('user_id', uid)
      .or('card_name.ilike.%Butkus%,card_name.ilike.%Maynard%,card_name.ilike.%Karras%,card_name.ilike.%Taylor%,card_name.ilike.%Duerson%')
      .order('created_at', { ascending: false }).range(f, f + 9);
    if (error) { console.error('stopping:', error.message); break; }
    const b = (data as any[]) || []; rows.push(...b); if (b.length < 10) break;
  }

  let facesChanged = 0, overallChanged = 0;
  const table: string[] = [];

  for (const c of rows) {
    let g: any = c.conversational_grading;
    if (typeof g === 'string') { try { g = JSON.parse(g); } catch { continue; } }
    const gp = g?.grading_passes || {};
    const passes = ['pass_1', 'pass_2', 'pass_3'].map(k => gp[k]).filter(Boolean);
    const passDevs = passes.map((p: any) => typeof p?.centering_dev === 'number' ? p.centering_dev : null).filter((n: any): n is number => typeof n === 'number');
    const passScores = passes.map((p: any) => typeof p?.centering === 'number' ? p.centering : null).filter((n: any): n is number => typeof n === 'number');
    const yearNum = Number(String(c.conversational_card_info?.year ?? '').slice(0, 4)) || null;
    const cv = c.cv_centering || {};

    const newFace: Record<string, number> = {};
    const fired: string[] = [];
    for (const face of ['front', 'back'] as const) {
      const sec = g?.centering?.[face];
      if (!sec || typeof sec.score !== 'number') continue;
      const dLR = ratioDeviation(sec.left_right), dTB = ratioDeviation(sec.top_bottom);
      const worst = (dTB !== null && (dLR === null || dTB > dLR)) ? sec.top_bottom : sec.left_right;
      const m = cv[face];
      const cvDev = m?.worstAxisPct != null ? Math.abs(m.worstAxisPct - 50) : null;
      const res = applyCenteringPolicy({
        face, proposedScore: sec.score, ratio: worst ?? null, passDevs,
        layout: layoutFromCardType(sec.card_type), passScores,
        cv: m ? { dev: cvDev, bothAxes: !!m.bothAxes } : null,
        imageConfidence: c.conversational_image_confidence, year: yearNum,
      });
      newFace[face] = res.score;
      if (res.capped) { facesChanged++; fired.push(...res.firedRules); }
    }

    const sub = c.conversational_sub_scores || {};
    const others = ['corners', 'edges', 'surface']
      .map(k => sub[k]?.weighted ?? sub[k]?.front ?? null)
      .filter((n: any): n is number => typeof n === 'number');
    const oldCen = sub.centering?.weighted ?? sub.centering?.front ?? null;
    const newCen = Object.keys(newFace).length ? Math.min(...Object.values(newFace)) : oldCen;
    const cur = c.conversational_whole_grade;
    const newOverall = others.length && typeof newCen === 'number' ? Math.min(newCen, ...others) : null;
    const moved = newOverall !== null && newOverall !== cur;
    if (moved) overallChanged++;

    const who = Object.keys(EXPECTED).find(k => String(c.card_name).includes(k));
    table.push(
      `${String(c.card_name).slice(0,16).padEnd(17)} ${c.created_at?.slice(5,10)}  ` +
      `cen ${String(oldCen ?? '-').padStart(2)}→${String(newCen ?? '-').padEnd(2)}  ` +
      `OVERALL ${String(cur).padStart(2)} → ${String(newOverall ?? '?').padEnd(2)} ${moved ? '**' : '  '}  ` +
      `${[...new Set(fired)].join(',').padEnd(14)} ${who ? EXPECTED[who] : ''}`
    );
  }

  console.log('card              date   centering   overall        rules fired    customer expects');
  console.log('─'.repeat(132));
  table.forEach(t => console.log(t));
  console.log('─'.repeat(132));
  console.log(`${facesChanged} face scores change · ${overallChanged} of ${rows.length} cards change OVERALL grade`);
})();
