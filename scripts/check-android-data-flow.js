require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('=== Users by signup_source (all-time) ===');
  for (const v of ['web', 'ios_app', 'android_app', null]) {
    const q = supabase.from('users').select('id', { count: 'exact', head: true });
    if (v === null) q.is('signup_source', null); else q.eq('signup_source', v);
    const { count } = await q;
    console.log(`  signup_source = ${JSON.stringify(v).padEnd(15)} -> ${count}`);
  }

  console.log('\n=== Users by signup_source (last 7 days) ===');
  const sinceWeek = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  for (const v of ['web', 'ios_app', 'android_app', null]) {
    const q = supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', sinceWeek);
    if (v === null) q.is('signup_source', null); else q.eq('signup_source', v);
    const { count } = await q;
    console.log(`  signup_source = ${JSON.stringify(v).padEnd(15)} -> ${count}`);
  }

  console.log('\n=== Cards by graded_from (all-time) ===');
  for (const v of ['web', 'ios_app', 'android_app', null]) {
    const q = supabase.from('cards').select('id', { count: 'exact', head: true });
    if (v === null) q.is('graded_from', null); else q.eq('graded_from', v);
    const { count } = await q;
    console.log(`  graded_from = ${JSON.stringify(v).padEnd(15)} -> ${count}`);
  }

  console.log('\n=== Cards by graded_from (last 7 days) ===');
  for (const v of ['web', 'ios_app', 'android_app', null]) {
    const q = supabase.from('cards').select('id', { count: 'exact', head: true }).gte('created_at', sinceWeek);
    if (v === null) q.is('graded_from', null); else q.eq('graded_from', v);
    const { count } = await q;
    console.log(`  graded_from = ${JSON.stringify(v).padEnd(15)} -> ${count}`);
  }

  console.log('\n=== Most recent Android signups ===');
  const { data: androidUsers } = await supabase
    .from('users')
    .select('id, email, created_at, signup_source')
    .eq('signup_source', 'android_app')
    .order('created_at', { ascending: false })
    .limit(5);
  if (!androidUsers || androidUsers.length === 0) {
    console.log('  (none yet)');
  } else {
    androidUsers.forEach(u => {
      console.log(`  ${u.created_at}  ${u.email}`);
    });
  }

  console.log('\n=== Most recent Android cards graded ===');
  const { data: androidCards } = await supabase
    .from('cards')
    .select('id, card_type, created_at, graded_from')
    .eq('graded_from', 'android_app')
    .order('created_at', { ascending: false })
    .limit(5);
  if (!androidCards || androidCards.length === 0) {
    console.log('  (none yet)');
  } else {
    androidCards.forEach(c => {
      console.log(`  ${c.created_at}  ${c.card_type.padEnd(10)}  card=${c.id.slice(0, 8)}`);
    });
  }
}

main().catch(e => { console.error(e); process.exit(1); });
