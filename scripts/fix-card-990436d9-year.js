require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Patch the year on card 990436d9-5a6a-44c0-b16a-584e9c8e98ca (1966 Topps
 * Mickey Mantle #50). AI mis-identified the year as 1960; PriceCharting
 * matched the correct 1966 product (dcm_cached_prices.setName = "Baseball
 * Cards 1966 Topps", dcm_price_product_id = 1850606), so the price is
 * correct but the year metadata on the card is wrong.
 *
 * Writes 1966 to all three year-storing locations:
 *   - release_date column
 *   - conversational_card_info.year (JSONB)
 *   - ai_grading.Card Information.year (legacy JSONB)
 *
 * Also regenerates label_data so the front label, collection, and any other
 * surface that reads label_data picks up the correction immediately.
 */

const CARD_ID = '990436d9-5a6a-44c0-b16a-584e9c8e98ca';
const CORRECT_YEAR = '1966';

async function main() {
  // 1. Read current state
  const { data: card, error: fetchErr } = await supabase
    .from('cards')
    .select('id, user_id, user_email, card_name, release_date, conversational_card_info, ai_grading, label_data')
    .eq('id', CARD_ID)
    .single();
  if (fetchErr || !card) { console.error('Fetch failed:', fetchErr); process.exit(1); }

  console.log('=== Before ===');
  console.log('owner            :', card.user_id, card.user_email);
  console.log('card_name        :', card.card_name);
  console.log('release_date     :', card.release_date);
  console.log('conv year        :', card.conversational_card_info?.year);
  console.log('ai_grading year  :', card.ai_grading?.['Card Information']?.year);
  console.log('');

  // 2. Build updated JSONB blobs (preserve everything else)
  const newConvCardInfo = { ...(card.conversational_card_info || {}), year: CORRECT_YEAR };

  const newAiGrading = { ...(card.ai_grading || {}) };
  if (newAiGrading['Card Information']) {
    newAiGrading['Card Information'] = { ...newAiGrading['Card Information'], year: CORRECT_YEAR };
  }

  // Patch label_data too if present, so cached labels render the right year
  let newLabelData = card.label_data;
  if (newLabelData && typeof newLabelData === 'object') {
    newLabelData = { ...newLabelData, year: CORRECT_YEAR };
    // Rebuild contextLine if it's there — simple find/replace 1960 → 1966
    if (typeof newLabelData.contextLine === 'string') {
      newLabelData.contextLine = newLabelData.contextLine.replace(/\b1960\b/g, CORRECT_YEAR);
    }
  }

  // 3. Apply update
  const { error: updateErr } = await supabase
    .from('cards')
    .update({
      release_date: CORRECT_YEAR,
      conversational_card_info: newConvCardInfo,
      ai_grading: newAiGrading,
      ...(newLabelData ? { label_data: newLabelData } : {}),
    })
    .eq('id', CARD_ID);
  if (updateErr) { console.error('Update failed:', updateErr); process.exit(1); }

  // 4. Verify
  const { data: after } = await supabase
    .from('cards')
    .select('release_date, conversational_card_info, ai_grading, label_data')
    .eq('id', CARD_ID)
    .single();
  console.log('=== After ===');
  console.log('release_date     :', after.release_date);
  console.log('conv year        :', after.conversational_card_info?.year);
  console.log('ai_grading year  :', after.ai_grading?.['Card Information']?.year);
  console.log('label_data.year  :', after.label_data?.year);
  console.log('label contextLine:', after.label_data?.contextLine);
  console.log('');
  console.log('✓ DONE — card year corrected to 1966.');
}

main().catch(e => { console.error(e); process.exit(1); });
