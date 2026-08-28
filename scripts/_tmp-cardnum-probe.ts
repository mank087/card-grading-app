/**
 * Isolate WHY card_number fails on the Shaq insert (printed "8 OF 12").
 * Three arms, same image, minimal prompt — separates "cannot see it" from
 * "was not told to look for it" from "the back is rotated 90 degrees".
 */
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import sharp from 'sharp';
import * as dotenv from 'dotenv';
import { BASELINE_MODEL, applyModelCompat } from '../src/lib/grading/modelRouter';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function ask(b64: string, q: string): Promise<string> {
  const { config } = applyModelCompat({
    model: BASELINE_MODEL, max_completion_tokens: 400, response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'Answer ONLY with JSON: {"answer": <string|null>, "verbatim_text_seen": <string|null>}' },
      { role: 'user', content: [
        { type: 'text', text: q },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' } },
      ] as any },
    ],
  }, BASELINE_MODEL);
  const r = await openai.chat.completions.create(config as any, { timeout: 90_000 });
  return r.choices[0]?.message?.content || '';
}

(async () => {
  const { data } = await sb.from('cards').select('back_path')
    .eq('id','cc855000-4e9f-4ffc-b2d4-cb007ba51f14').maybeSingle();
  const { data: blob } = await sb.storage.from('cards').download((data as any).back_path);
  const raw = Buffer.from(await blob!.arrayBuffer());

  const asIs = raw.toString('base64');
  // The back was photographed sideways; rotate upright to test whether
  // orientation is what defeats the read.
  const rot = (await sharp(raw, { failOn:'none' }).rotate(-90).jpeg({ quality: 95 }).toBuffer()).toString('base64');

  const Q_OPEN = 'What is this trading card\'s card number? Look at the whole card.';
  const Q_HINT = 'This card is part of a numbered insert set. Find the "N OF M" marking printed on it and report N as the answer. Quote what you see verbatim.';

  console.log('A. as-shot (sideways), open question :', await ask(asIs, Q_OPEN));
  console.log('B. as-shot (sideways), told to look  :', await ask(asIs, Q_HINT));
  console.log('C. rotated upright,    open question :', await ask(rot,  Q_OPEN));
  console.log('D. rotated upright,    told to look  :', await ask(rot,  Q_HINT));
})();
