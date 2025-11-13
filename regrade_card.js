const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function regradeCard() {
  const cardId = '7d8c02ee-6061-4d05-8179-c1d615c2449f';

  console.log('Clearing cached grading data to trigger re-grade...');

  const { error } = await supabase
    .from('cards')
    .update({
      ai_grading: null,
      conversational_grading: null
    })
    .eq('id', cardId);

  if (error) {
    console.error('Error clearing card data:', error);
    return;
  }

  console.log('✅ Card data cleared. Now trigger re-grade by visiting:');
  console.log(`   http://localhost:3000/api/vision-grade/${cardId}`);
  console.log('\nOr just refresh the card page:');
  console.log(`   http://localhost:3000/sports/${cardId}`);
}

regradeCard();
