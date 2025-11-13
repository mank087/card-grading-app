const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLatestCard() {
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, conversational_grading, conversational_defects_front, conversational_defects_back, estimated_professional_grades')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!cards || cards.length === 0) {
    console.log('No cards found');
    return;
  }

  const card = cards[0];
  console.log('\n=== LATEST CARD DATA ===\n');
  console.log('Card ID:', card.id);
  console.log('\n--- Conversational Grading (first 500 chars) ---');
  console.log(card.conversational_grading ? card.conversational_grading.substring(0, 500) : 'NULL');
  console.log('\n--- Has Structured Defects? ---');
  console.log('Front:', card.conversational_defects_front ? 'YES' : 'NO');
  console.log('Back:', card.conversational_defects_back ? 'YES' : 'NO');
  console.log('\n--- Professional Grades ---');
  console.log(card.estimated_professional_grades ? JSON.stringify(card.estimated_professional_grades, null, 2) : 'NULL');
}

checkLatestCard().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
