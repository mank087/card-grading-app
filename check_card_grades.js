const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCard() {
  const cardId = '7d8c02ee-6061-4d05-8179-c1d615c2449f';

  const { data, error } = await supabase
    .from('cards')
    .select('id, raw_decimal_grade, grade_status, conversational_decimal_grade, conversational_whole_grade, estimated_professional_grades, conversational_grading, ai_grading')
    .eq('id', cardId)
    .single();

  if (error) {
    console.error('Error fetching card:', error);
    return;
  }

  console.log('\n=== Card Grade Data ===');
  console.log('ID:', data.id);
  console.log('Raw Decimal Grade:', data.raw_decimal_grade);
  console.log('Grade Status:', data.grade_status);
  console.log('Conversational Decimal Grade:', data.conversational_decimal_grade);
  console.log('Conversational Whole Grade:', data.conversational_whole_grade);

  console.log('\n=== All Card Keys ===');
  console.log(Object.keys(data).join(', '));

  console.log('\n=== Conversational Grading ===');
  if (data.conversational_grading) {
    console.log(JSON.stringify(data.conversational_grading, null, 2));
  } else {
    console.log('NULL');
  }

  console.log('\n=== AI Grading ===');
  if (data.ai_grading) {
    console.log(JSON.stringify(data.ai_grading, null, 2));
  } else {
    console.log('NULL');
  }

  console.log('\n=== Professional Grades ===');
  if (data.estimated_professional_grades) {
    console.log('Professional Grades Present:', 'YES');
    console.log(JSON.stringify(data.estimated_professional_grades, null, 2));
  } else {
    console.log('Professional Grades Present:', 'NO - NULL or UNDEFINED');
  }
}

checkCard();
