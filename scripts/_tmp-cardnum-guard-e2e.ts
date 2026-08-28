/**
 * End-to-end check for the card-number evidence rule:
 *   1. does the full production prompt actually EMIT card_number_text_seen /
 *      card_number_source?
 *   2. does cardNumberGuard keep the right numbers and drop the wrong ones?
 *
 * Runs against the card that motivated it (printed "8 OF 12", stored as 101).
 *   npx tsx scripts/_tmp-cardnum-guard-e2e.ts [--runs 6] [--card <id>]
 */
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { BASELINE_MODEL, applyModelCompat } from '../src/lib/grading/modelRouter';
import { loadGradingPrompt } from '../src/lib/promptLoader_v5';
import { applyCardNumberGuard } from '../src/lib/cardNumberGuard';
dotenv.config({ path: '.env.local' });

const argOf = (f: string, d: string) => {
  const i = process.argv.indexOf(f);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const RUNS = Number(argOf('--runs', '6')) || 6;
const CARD_ID = argOf('--card', 'cc855000-4e9f-4ffc-b2d4-cb007ba51f14');
const TRUTH = argOf('--truth', '8');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

(async () => {
  const { prompt } = loadGradingPrompt('sports' as any);
  const { data } = await sb.from('cards').select('front_path, back_path').eq('id', CARD_ID).maybeSingle();
  const d: any = data;
  const bufs: string[] = [];
  for (const p of [d.front_path, d.back_path]) {
    const { data: blob } = await sb.storage.from('cards').download(p);
    bufs.push(Buffer.from(await blob!.arrayBuffer()).toString('base64'));
  }

  let emitted = 0, correct = 0, dropped = 0, wrongSurvived = 0;

  for (let i = 1; i <= RUNS; i++) {
    const { config } = applyModelCompat({
      model: BASELINE_MODEL, max_completion_tokens: 900, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: [
          { type: 'text', text: 'Photo 1 = FRONT, Photo 2 = BACK. Output ONLY the card_info object as JSON, including card_number, card_number_text_seen and card_number_source. Do not grade.' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${bufs[0]}`, detail: 'high' } },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${bufs[1]}`, detail: 'high' } },
        ] as any },
      ],
    }, BASELINE_MODEL);

    const res = await openai.chat.completions.create(config as any, { timeout: 120_000 });
    let o: any = {}; try { o = JSON.parse(res.choices[0]?.message?.content || '{}'); } catch {}
    const ci = o.card_info || o;
    const hadEvidence = ci.card_number_text_seen != null || ci.card_number_source != null;
    if (hadEvidence) emitted++;

    const g = applyCardNumberGuard(ci, 'e2e');
    const finalNum = g.cardNumber == null ? null : String(g.cardNumber);
    if (finalNum === TRUTH) correct++;
    else if (finalNum === null) dropped++;
    else wrongSurvived++;

    console.log(
      `run ${i}: raw=${JSON.stringify(g.originalCardNumber)} seen=${JSON.stringify(g.textSeen)} ` +
      `src=${JSON.stringify(g.source)} -> ${g.outcome} final=${JSON.stringify(finalNum)}`
    );
  }

  console.log(`\nevidence fields emitted : ${emitted}/${RUNS}`);
  console.log(`correct (${TRUTH})            : ${correct}/${RUNS}`);
  console.log(`blank (safe)            : ${dropped}/${RUNS}`);
  console.log(`WRONG NUMBER SURVIVED   : ${wrongSurvived}/${RUNS}   <-- must be 0`);
})();
