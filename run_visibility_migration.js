// Run database migration to add card visibility (public/private)
// Usage: node run_visibility_migration.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🔧 Running visibility migration...');
  console.log('');

  try {
    // Test connection
    console.log('📡 Testing database connection...');
    const { data: testData, error: testError } = await supabase
      .from('cards')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ Failed to connect to database:', testError);
      throw testError;
    }

    console.log('✅ Database connection successful');
    console.log('');

    // Read the SQL migration file
    const sqlContent = fs.readFileSync('./migrations/add_card_visibility.sql', 'utf8');

    console.log('📋 Migration SQL to run in Supabase SQL Editor:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(sqlContent);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🔗 Go to: https://supabase.com/dashboard/project/zyxtqcvwkbpvsjsszbzg/sql/new');
    console.log('');
    console.log('Instructions:');
    console.log('1. Copy the SQL above');
    console.log('2. Paste it into the Supabase SQL Editor');
    console.log('3. Click "Run" button');
    console.log('4. Press Enter here when done');
    console.log('');

    // Wait for user input
    process.stdin.setRawMode(true);
    process.stdin.resume();
    await new Promise(resolve => {
      process.stdin.once('data', () => {
        resolve();
      });
    });

    process.stdin.setRawMode(false);
    process.stdin.pause();

    console.log('');
    console.log('🔍 Verifying migration...');

    // Verify the visibility column exists
    const { data: verifyData, error: verifyError } = await supabase
      .from('cards')
      .select('id, visibility')
      .limit(1);

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
      console.log('');
      console.log('⚠️  The migration might not have been run correctly.');
      console.log('Please check the Supabase SQL Editor for any errors.');
      console.log('');
      process.exit(1);
    }

    console.log('✅ Migration verified! visibility column exists.');
    console.log('');

    // Get visibility statistics
    const { data: allCards, error: statsError } = await supabase
      .from('cards')
      .select('visibility');

    if (!statsError && allCards) {
      const stats = allCards.reduce((acc, card) => {
        const vis = card.visibility || 'null';
        acc[vis] = (acc[vis] || 0) + 1;
        return acc;
      }, {});

      console.log('📊 Card visibility breakdown:');
      Object.entries(stats).forEach(([visibility, count]) => {
        const icon = visibility === 'private' ? '🔒' : visibility === 'public' ? '🌐' : '❓';
        console.log(`   ${icon} ${visibility}: ${count} cards`);
      });
      console.log('');
    }

    console.log('🎉 Migration complete!');
    console.log('');
    console.log('✅ Step 1 Complete: Database migration');
    console.log('🚧 Next Step 2: Create API endpoints');
    console.log('🚧 Next Step 3: Create frontend UI');
    console.log('');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('');
    console.log('📋 Manual migration instructions:');
    console.log('1. Go to: https://supabase.com/dashboard/project/zyxtqcvwkbpvsjsszbzg/sql/new');
    console.log('2. Copy SQL from: migrations/add_card_visibility.sql');
    console.log('3. Run it in the SQL Editor');
    console.log('');
    process.exit(1);
  }
}

runMigration();
