require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CARD_ID = '990436d9-5a6a-44c0-b16a-584e9c8e98ca';

async function main() {
  const { data: card, error } = await supabase
    .from('cards')
    .select('*')
    .eq('id', CARD_ID)
    .single();
  if (error || !card) { console.error('Card lookup failed:', error); process.exit(1); }

  console.log('=== ALL COLUMNS ===');
  console.log(Object.keys(card).join(', '));
  console.log('');

  // Dump every field that mentions year, date, set, identification, ai
  console.log('=== YEAR / DATE / SET fields ===');
  for (const [k, v] of Object.entries(card)) {
    if (/year|date|set|series|edition/i.test(k)) {
      console.log(k.padEnd(45), '=', JSON.stringify(v));
    }
  }
  console.log('');

  console.log('=== AI / IDENTIFICATION fields ===');
  for (const [k, v] of Object.entries(card)) {
    if (/ai_|identif|card_info|product/i.test(k)) {
      const display = typeof v === 'object' && v !== null ? JSON.stringify(v).slice(0, 200) + '…' : JSON.stringify(v);
      console.log(k.padEnd(45), '=', display);
    }
  }
  console.log('');

  console.log('=== PRICING fields (compact) ===');
  for (const [k, v] of Object.entries(card)) {
    if (/price|dcm_|ebay_|scryfall|sportscards/i.test(k)) {
      const display = typeof v === 'object' && v !== null ? JSON.stringify(v).slice(0, 200) + '…' : JSON.stringify(v);
      console.log(k.padEnd(45), '=', display);
    }
  }
  console.log('');

  console.log('=== UPDATED_AT / CREATED_AT ===');
  console.log('created_at:', card.created_at);
  console.log('updated_at:', card.updated_at);

  // Pull edit/audit history if there's an audit table
  const { data: audit } = await supabase
    .from('card_audit')
    .select('*')
    .eq('card_id', CARD_ID)
    .order('created_at', { ascending: false })
    .limit(10);
  if (audit && audit.length) {
    console.log('');
    console.log('=== card_audit (last 10) ===');
    audit.forEach(a => console.log(a.created_at, '|', a.action || a.column_name || '?', '|', JSON.stringify(a)));
  }

  // Price history
  const { data: priceHist } = await supabase
    .from('card_price_history')
    .select('*')
    .eq('card_id', CARD_ID)
    .order('captured_at', { ascending: false })
    .limit(5);
  if (priceHist && priceHist.length) {
    console.log('');
    console.log('=== card_price_history (last 5) ===');
    priceHist.forEach(p => console.log(p.captured_at || p.created_at, '|', JSON.stringify(p).slice(0, 200)));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
