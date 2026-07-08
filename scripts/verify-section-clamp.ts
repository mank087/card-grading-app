/**
 * Verifies the Step 7.6 structured-section-score clamp against the REAL stored
 * grading JSON for Joey's cards. Re-implements the exact loop from visionGrader.ts
 * and prints the Detailed-Analysis section scores before/after, so we can confirm
 * no sub-number is left above the final grade.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const IDS = [
  ['1 Saddam', '910dd3de-d62f-4996-9fd4-f338039668fd'],
  ['4 Andre JPEG', '848ddbc1-7327-47c5-96b4-ef5e5385ef4d'],
  ['5 Andre camera', 'cd250fa5-e1d6-433b-b355-40233c83a89a'],
];
type Cat = 'centering' | 'corners' | 'edges' | 'surface';
const CATS: Cat[] = ['centering', 'corners', 'edges', 'surface'];

function sectionScores(j: any) {
  const out: Record<string, any> = {};
  for (const cat of CATS) {
    const s = j[cat]; if (!s) continue;
    const face: Record<string, any> = { catScore: s.score };
    for (const f of ['front', 'back']) {
      const fs = s[f]; if (!fs) continue;
      const pos: Record<string, number> = {};
      for (const k of Object.keys(fs)) if (fs[k] && typeof fs[k] === 'object' && typeof fs[k].score === 'number') pos[k] = fs[k].score;
      face[f] = { faceScore: fs.score, ...pos };
    }
    out[cat] = face;
  }
  return out;
}

// EXACT copy of the Step 7.6 loop
function clamp(jsonData: any, serverRounded: Record<Cat, number>) {
  const faceCapScore = (cat: Cat, face: 'front' | 'back'): number => {
    const rf = jsonData.raw_sub_scores?.[`${cat}_${face}`];
    return typeof rf === 'number' ? rf : serverRounded[cat];
  };
  for (const cat of CATS) {
    const section = jsonData[cat];
    if (!section || typeof section !== 'object') continue;
    if (typeof section.score === 'number' && section.score > serverRounded[cat]) section.score = serverRounded[cat];
    for (const face of ['front', 'back'] as const) {
      const fsec = section[face];
      if (!fsec || typeof fsec !== 'object') continue;
      const cap = faceCapScore(cat, face);
      let faceClamped = false;
      if (typeof fsec.score === 'number' && fsec.score > cap) { fsec.score = cap; faceClamped = true; }
      for (const key of Object.keys(fsec)) {
        const pos = fsec[key];
        if (pos && typeof pos === 'object' && typeof pos.score === 'number' && pos.score > cap) { pos.score = cap; faceClamped = true; }
      }
      if (faceClamped && cap < 10 && typeof fsec.summary === 'string' && !/magnified inspection/i.test(fsec.summary)) {
        fsec.summary = `${fsec.summary.trim()} Magnified inspection adjusted this face to ${cap}/10 — see the limiting factors and condition summary above.`;
      }
    }
  }
}

async function main() {
  for (const [label, id] of IDS) {
    const { data } = await supabase.from('cards').select('conversational_grading,conversational_sub_scores,conversational_whole_grade').eq('id', id).single();
    const j = JSON.parse((data as any).conversational_grading);
    const subs = (data as any).conversational_sub_scores;
    const serverRounded: Record<Cat, number> = {
      centering: subs.centering.weighted, corners: subs.corners.weighted, edges: subs.edges.weighted, surface: subs.surface.weighted,
    };
    console.log('\n' + '='.repeat(80));
    console.log(`${label}  overall=${(data as any).conversational_whole_grade}  finalSubgrades=${JSON.stringify(serverRounded)}`);
    console.log('  raw faces:', JSON.stringify(j.raw_sub_scores));
    console.log('  BEFORE:', JSON.stringify(sectionScores(j)));
    clamp(j, serverRounded);
    console.log('  AFTER :', JSON.stringify(sectionScores(j)));
    // Coherence invariant (matches what each tile displays):
    //  - category rollup .score <= serverRounded[cat]   (tile "Score:")
    //  - each face .score and its positions <= raw_sub_scores[cat_face]  (tile "F:"/"B:")
    let bad = 0;
    for (const cat of CATS) {
      const s = j[cat]; if (!s) continue;
      if (typeof s.score === 'number' && s.score > serverRounded[cat]) { bad++; console.log(`    ! ${cat}.score ${s.score} > final ${serverRounded[cat]}`); }
      for (const f of ['front', 'back'] as const) {
        const fs = s[f]; if (!fs) continue;
        const faceCap = j.raw_sub_scores?.[`${cat}_${f}`] ?? serverRounded[cat];
        const check = (v: any, where: string) => { if (typeof v === 'number' && v > faceCap) { bad++; console.log(`    ! ${cat}.${f}.${where} ${v} > face ${faceCap}`); } };
        check(fs.score, 'score');
        for (const k of Object.keys(fs)) if (fs[k]?.score !== undefined) check(fs[k].score, k);
      }
    }
    console.log(bad === 0 ? '  ✅ COHERENT: every section score matches the tile it renders next to' : `  ❌ ${bad} section score(s) still incoherent`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
