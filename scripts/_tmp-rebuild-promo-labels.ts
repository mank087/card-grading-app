// One-off (Sept 29): rebuild labels on Pokemon promo cards whose label shows a
// catalog set total after a bare promo number (#173/150). Dry run by default.
import { config } from 'dotenv'; config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { generateLabelData, type CardForLabel } from '../src/lib/labelDataGenerator';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const APPLY = process.argv.includes('--apply');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
(async () => {
  const { data: ids, error } = await db.from('cards').select('id')
    .eq('category', 'Pokemon').like('label_data->>formattedCardNumber', '#%/%').ilike('card_set', '%promo%').is('deleted_at', null).limit(500);
  if (error) throw error;
  let changed = 0, same = 0;
  for (const { id } of ids!) {
    const { data: card, error: e } = await db.from('cards').select('*').eq('id', id).single();
    if (e) { console.error('stop:', e.message); break; }
    const before = card.label_data?.formattedCardNumber;
    const label = generateLabelData(card as unknown as CardForLabel);
    if (label.formattedCardNumber === before) { same++; continue; }
    changed++;
    console.log(`${id.slice(0, 8)} ${card.card_name}: ${before} -> ${label.formattedCardNumber}`);
    if (APPLY) {
      const cols: Record<string, any> = { label_data: label };
      if (card.original_label_data != null) cols.original_label_data = label;
      const { error: w } = await db.from('cards').update(cols).eq('id', id);
      if (w) { console.error('stop:', w.message); break; }
    }
    await sleep(150);
  }
  console.log(`\n${APPLY ? 'rebuilt' : 'would rebuild'} ${changed}, unchanged ${same}`);
})();
