import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim());
(async () => {
  const held = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const outPath = process.argv[3];
  const out: Record<string, any> = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
  const ids = held.filter((x: any) => /independent evaluations (scored|did not agree)/.test(x.conversational_final_grade_summary)).map((x: any) => x.id);
  let n = 0;
  for (const id of ids) {
    if (out[id]) continue;
    const r = await sb.from('cards').select('card_name, featured, front_path, back_path, display_crop:capture_quality->display, conversational_grading').eq('id', id).maybeSingle();
    if (r.error) { console.error(id, r.error.message); if (/timeout|522/.test(r.error.message)) break; continue; }
    let j: any = null;
    try { j = typeof r.data!.conversational_grading === 'string' ? JSON.parse(r.data!.conversational_grading) : r.data!.conversational_grading; } catch {}
    const gp = j?.grading_passes || {};
    out[id] = {
      name: r.data!.card_name || r.data!.featured, front_path: r.data!.front_path, back_path: r.data!.back_path, display: r.data!.display_crop,
      passes: [gp.pass_1, gp.pass_2, gp.pass_3].map((p: any) => p && ({ c: p.centering, co: p.corners, e: p.edges, s: p.surface, f: p.final, d: p.defects_noted, r: p.centering_ratios, dev: p.centering_dev })),
      notes: gp.consensus_notes, hold: j?.grade_hold, iq: j?.image_quality ? { l: j.image_quality.confidence_letter, n: j.image_quality.notes, glare: j.image_quality.glare_present } : null,
      cen: j?.centering ? { f: { lr: j.centering.front?.left_right, tb: j.centering.front?.top_bottom }, b: { lr: j.centering.back?.left_right, tb: j.centering.back?.top_bottom } } : null,
      cv: j?.centering?.cv_measurement ?? j?.cv_centering ?? null,
      struct: j?.structural_damage ? { d: j.structural_damage.detected } : null,
      case: j?.case_detection?.case_type, ver: j?.metadata?.prompt_version,
    };
    if (++n % 25 === 0) { fs.writeFileSync(outPath, JSON.stringify(out)); console.log(n); }
    await new Promise(r => setTimeout(r, 150));
  }
  fs.writeFileSync(outPath, JSON.stringify(out));
  console.log('done', Object.keys(out).length);
})();
