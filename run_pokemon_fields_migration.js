// Run database migration for Pokemon-specific fields
// Usage: node run_pokemon_fields_migration.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('');
  console.log('========================================');
  console.log('🎮 Pokemon Card Fields Migration');
  console.log('========================================');
  console.log('');

  try {
    // Read SQL file
    const sqlPath = path.join(__dirname, 'migrations', 'add_pokemon_fields.sql');

    if (!fs.existsSync(sqlPath)) {
      console.error('❌ Migration file not found:', sqlPath);
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Migration File Loaded');
    console.log('   Location:', sqlPath);
    console.log('   Size:', sql.length, 'characters');
    console.log('');

    // For safety, always use manual migration instructions since exec_sql is not standard
    console.log('📋 Manual Migration Instructions:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('1. Go to your Supabase Dashboard:');
    console.log(`   ${supabaseUrl.replace('/v1', '')}`);
    console.log('');
    console.log('2. Navigate to: SQL Editor');
    console.log('');
    console.log('3. Create a new query and paste the following migration:');
    console.log('');
    console.log('─────────────────────────────────────────');
    console.log(sql);
    console.log('─────────────────────────────────────────');
    console.log('');
    console.log('4. Click "Run" to execute the migration');
    console.log('');
    console.log('5. Verify success by checking if these columns exist in the cards table:');
    console.log('   • pokemon_type');
    console.log('   • pokemon_stage');
    console.log('   • hp');
    console.log('   • card_type');
    console.log('');

    // Try to verify if fields already exist
    console.log('🔍 Checking if Pokemon fields already exist...');
    console.log('');

    try {
      const { data: testData, error: testError } = await supabase
        .from('cards')
        .select('id, pokemon_type, pokemon_stage, hp, card_type')
        .eq('category', 'Pokemon')
        .limit(1);

      if (testError) {
        if (testError.message && testError.message.includes('column')) {
          console.log('❌ Pokemon fields do not exist yet.');
          console.log('   Please run the migration in Supabase Dashboard (see instructions above)');
          console.log('');
        } else {
          console.error('❌ Verification query failed:', testError.message);
          console.log('');
        }
      } else {
        console.log('✅ Pokemon fields already exist!');
        console.log('');
        console.log('📦 Available Pokemon-specific Fields:');
        console.log('   • pokemon_type (e.g., Fire, Water, Fire/Flying)');
        console.log('   • pokemon_stage (e.g., Basic, Stage 1, VMAX, GX)');
        console.log('   • hp (e.g., 120)');
        console.log('   • card_type (Pokemon, Trainer, Supporter, Energy)');
        console.log('');
        console.log('🎉 Migration appears to be already applied!');
        console.log('');
        if (testData && testData.length > 0) {
          console.log('Sample data:', testData[0]);
          console.log('');
        }
      }
    } catch (verifyError) {
      console.log('⚠️  Could not verify field existence:', verifyError.message);
      console.log('   Please verify manually after running migration');
      console.log('');
    }

    console.log('📋 Next Steps After Migration:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. ✅ Database schema updated with Pokemon fields');
    console.log('2. ✅ Pokemon API route created (src/app/api/pokemon/[id]/route.ts)');
    console.log('3. ✅ visionGrader.ts updated for card type routing');
    console.log('4. ⏭️  Update Pokemon upload page to use new API route');
    console.log('5. ⏭️  Test Pokemon card grading with v4.2 system');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Script failed with exception:', error);
    console.log('');
    console.log('📋 Please follow manual migration instructions above');
    console.log('');
    process.exit(1);
  }
}

// Handle async execution
runMigration()
  .then(() => {
    console.log('✨ Script execution complete');
    console.log('');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
