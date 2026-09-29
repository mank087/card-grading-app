// One-off (Sept 28): card b00f3ad5 (Mana Vault serial 311587) still carries the
// misread "129/040" in conversational_card_info.card_number; the card_number
// column is already U29. Fix that one field, then regenerate label_data.
import { config } from 'dotenv'; config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { generateLabelData, type CardForLabel } from '../src/lib/labelDataGenerator';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ID = 'b00f3ad5-637d-4fda-947d-d9035d53a11f';
(async () => {
  const { data: card, error } = await db.from('cards').select('*').eq('id', ID).single();
  if (error) throw error;
  if (card.serial !== '311587' || card.card_number !== 'U29') throw Error('unexpected row');
  const info = { ...(card.conversational_card_info || {}), card_number: 'U29' };
  const { error: e1 } = await db.from('cards').update({ conversational_card_info: info }).eq('id', ID).eq('conversational_card_info->>card_number', '129/040');
  if (e1) throw e1;
  const label = generateLabelData({ ...card, conversational_card_info: info } as unknown as CardForLabel);
  const cols: Record<string, any> = { label_data: label };
  if (card.original_label_data != null) cols.original_label_data = label;
  const { error: e2 } = await db.from('cards').update(cols).eq('id', ID);
  if (e2) throw e2;
  console.log('label:', label.contextLine);
})();
