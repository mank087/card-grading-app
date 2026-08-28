/**
 * Reproduce the misidentification under the REAL production system prompt
 * (full ~79K rubric + sports delta), which is where it actually happened —
 * a short prompt identifies the card correctly, so dilution is the mechanism.
 * Identification output only; no grading, no DB write, no credit.
 *
 *   npx tsx scripts/_tmp-shaq-fullprompt.ts [--runs 3]
 */
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { BASELINE_MODEL, applyModelCompat } from '../src/lib/grading/modelRouter';
import { loadGradingPrompt } from '../src/lib/promptLoader_v5';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const argOf = (flag: string, dflt: string): string => {
  const i = process.argv.indexOf(flag);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const RUNS = Number(argOf('--runs', '3')) || 3;
const CARD_ID = argOf('--card', 'cc855000-4e9f-4ffc-b2d4-cb007ba51f14');
const EXPECT = argOf('--expect', "o'neal").toLowerCase();

(async () => {
  let { prompt } = loadGradingPrompt('sports' as any);
  if (process.argv.includes('--no-rule')) {
    for (const [x,y] of [['🚨 **SUBJECT ATTRIBUTION','🚨 **UNIVERSAL YEAR'],['🔄 **READ IN THE CARD','🚨 **CANONICAL FIELD']]) {
      const i = prompt.indexOf(x), j = prompt.indexOf(y);
      if (i > 0 && j > i) prompt = prompt.slice(0, i) + prompt.slice(j);
    }
    const a = -1;
    const b = prompt.indexOf('🚨 **UNIVERSAL YEAR');
    if (a > 0 && b > a) prompt = prompt.slice(0, a) + prompt.slice(b);
  }
  console.log('system prompt chars:', prompt.length, '(~' + Math.round(prompt.length/4/1000) + 'K tokens)');
  console.log('contains SUBJECT ATTRIBUTION rule:', prompt.includes('SUBJECT ATTRIBUTION'));

  const { data } = await sb.from('cards').select('front_path, back_path')
    .eq('id', CARD_ID).maybeSingle();
  const d:any = data; const bufs: string[] = [];
  for (const p of [d.front_path, d.back_path]) {
    const { data: blob } = await sb.storage.from('cards').download(p);
    bufs.push(Buffer.from(await blob!.arrayBuffer()).toString('base64'));
  }

  for (let i = 1; i <= RUNS; i++) {
    const { config } = applyModelCompat({
      model: BASELINE_MODEL, max_completion_tokens: 900, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: [
          { type: 'text', text: 'Photo 1 = FRONT, Photo 2 = BACK. Output ONLY the card_info object as JSON with keys player_or_character, team, card_number, subset, set_name, year, identification_confidence. Do not grade.' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${bufs[0]}`, detail: 'high' } },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${bufs[1]}`, detail: 'high' } },
        ] as any },
      ],
    }, BASELINE_MODEL);
    const res = await openai.chat.completions.create(config as any, { timeout: 120_000 });
    let o:any = {}; try { o = JSON.parse(res.choices[0]?.message?.content || '{}'); } catch {}
    const ci = o.card_info || o;
    const name = ci.player_or_character ?? ci.card_name ?? '?';
    const ok = String(name).toLowerCase().includes(EXPECT);
    console.log(`run ${i}: ${ok ? 'PASS' : 'FAIL'}  name=${JSON.stringify(name)} team=${JSON.stringify(ci.team)} num=${JSON.stringify(ci.card_number)} conf=${JSON.stringify(ci.identification_confidence)}`);
  }
})();
